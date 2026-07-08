// functions/api/cobertura.js
// Cloudflare Pages Function: fixed-network coverage lookup via GEO.ANACOM.
// Flow: postal code -> coordinates (GeoAPI.pt) -> spatial query on the
// public ArcGIS service -> related attribute table -> operators list.
// Responses are cached at the edge for 24h (data changes quarterly).

const BASE = "https://geo.anacom.pt/server/rest/services/publico/Coberturas_Disponiveis/MapServer";
const GEOAPI = "https://json.geoapi.pt/cp/";
const RADIUS_M = 75;
const CACHE_TTL = 86400; // 24h

// Coded value domains from the service schema (Portaria 77/2023)
const OPERADOR = {
  21: "DIGI", 24: "Dstelecom", 29: "Fastfiber", 30: "Fibroglobal",
  32: "G9Telecom", 45: "LIGAT", 48: "MEO", 51: "NOS Acores", 52: "NOS",
  53: "NOS Madeira", 55: "NOWO", 56: "ONI", 69: "Starlink", 81: "Vodafone",
};
const TECNOLOGIA = {
  1: "Fibra otica (PON)", 2: "Fibra otica (P2P)",
  3: "Cabo DOCSIS 3.0", 4: "Cabo DOCSIS 3.1+",
  5: "Cobre", 6: "Cobre (ADSL)", 7: "FWA licenciado", 8: "FWA nao licenciado",
  9: "Outros",
};

const HEADERS = { "User-Agent": "comparador-pt/0.3 (nao comercial; prototipo)" };

async function fetchJson(url) {
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) throw new Error(`upstream ${r.status} em ${new URL(url).hostname}`);
  return r.json();
}

async function geocode(cp) {
  const data = await fetchJson(GEOAPI + encodeURIComponent(cp) + "?json=1");
  if (Array.isArray(data.centro) && data.centro.length >= 2) {
    return { lat: Number(data.centro[0]), lon: Number(data.centro[1]) };
  }
  const pts = data.pontos || data.partes || [];
  if (pts.length && pts[0].coordenadas) {
    return { lat: Number(pts[0].coordenadas[0]), lon: Number(pts[0].coordenadas[1]) };
  }
  throw new Error("codigo postal nao geocodificavel");
}

async function arcgisQuery(layer, params) {
  const qs = new URLSearchParams({ f: "json", ...params });
  const data = await fetchJson(`${BASE}/${layer}/query?${qs}`);
  if (data.error) throw new Error(`ArcGIS: ${data.error.message || data.error.code}`);
  return data;
}

async function fixedCoverage(lat, lon) {
  const geometry = JSON.stringify({ x: lon, y: lat, spatialReference: { wkid: 4326 } });
  const step1 = await arcgisQuery(0, {
    geometry,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    distance: String(RADIUS_M),
    units: "esriSRUnit_Meter",
    outFields: "edif_cod",
    returnGeometry: "false",
  });
  const codes = [...new Set((step1.features || []).map((f) => f.attributes.edif_cod))];
  const ofertas = [];
  for (let i = 0; i < codes.length; i += 50) {
    const chunk = codes.slice(i, i + 50);
    const where = `estado = 1 AND cod_rel IN (${chunk.map((c) => `'${c}'`).join(",")})`;
    const step2 = await arcgisQuery(1, {
      where,
      outFields: "cod_rel,operador,tecnologia_a,vel_max_dl_a,vel_max_ul_a,tecnologia_b,vel_max_dl_b,vel_max_ul_b",
      returnGeometry: "false",
    });
    for (const feat of step2.features || []) {
      const a = feat.attributes;
      const op = OPERADOR[a.operador] || `cod:${a.operador}`;
      for (const s of ["a", "b"]) {
        const tec = a[`tecnologia_${s}`];
        if (tec == null) continue;
        ofertas.push({
          operador: op,
          tecnologia: TECNOLOGIA[tec] || `cod:${tec}`,
          vel_dl_mbps: a[`vel_max_dl_${s}`] ?? null,
          vel_ul_mbps: a[`vel_max_ul_${s}`] ?? null,
        });
      }
    }
  }
  return { edificios: codes.length, ofertas };
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const cp = (url.searchParams.get("cp") || "").trim();
  if (!/^\d{4}-\d{3}$/.test(cp)) {
    return Response.json({ error: "cp invalido (formato NNNN-NNN)" }, { status: 400 });
  }

  // Edge cache: same postal code answered from cache for 24h
  const cacheKey = new Request(`https://cache.local/cobertura/${cp}`);
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  try {
    const { lat, lon } = await geocode(cp);
    const { edificios, ofertas } = await fixedCoverage(lat, lon);
    const operadores = [...new Set(ofertas.map((o) => o.operador))].sort();
    const body = {
      cp, lat, lon,
      raio_m: RADIUS_M,
      edificios,
      operadores,
      ofertas,
      fonte: "GEO.ANACOM (DL 40/2022, atualizacao trimestral)",
    };
    const resp = Response.json(body, {
      headers: { "Cache-Control": `public, max-age=${CACHE_TTL}` },
    });
    context.waitUntil(cache.put(cacheKey, resp.clone()));
    return resp;
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 502 });
  }
}
