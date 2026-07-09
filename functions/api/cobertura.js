// functions/api/cobertura.js
// Cloudflare Pages Function: fixed-network + satellite coverage via GEO.ANACOM.
//
// Flow (confirmed working against the live services):
//   1. Geocode the postal code with Esri's World geocoder (official, reliable
//      for PT addresses, no dependency on third-party geocoders).
//   2. Query layer 0 (RedeFixa points) near that location to find building
//      objectIds within a small buffer.
//   3. queryRelatedRecords on layer 0 (relationshipId 0) to pull the actual
//      coverage attributes (operator, technology, speeds) for those buildings.
//   4. Query layer 2 directly at the point for satellite coverage, which is
//      independent of buildings and always available as a fallback.
//
// Responses are cached at the edge for 24h (fixed/satellite data is reported
// quarterly to ANACOM under DL 40/2022).

const BASE = "https://geo.anacom.pt/server/rest/services/publico/Coberturas_Disponiveis/MapServer";
const GEOCODER = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";
const BUILDING_SEARCH_RADIUS_M = 60;
const CACHE_TTL = 86400; // 24h

// Coded value domains from the service schema (Portaria 77/2023)
const OPERADOR = {
  21: "DIGI", 24: "Dstelecom", 25: "EchoStar Mobile", 29: "Fastfiber",
  30: "Fibroglobal", 32: "G9Telecom", 41: "Iridium Italia",
  44: "Leosat Portugal", 45: "LIGAT", 48: "MEO", 50: "Nextweb",
  51: "NOS Acores", 52: "NOS", 53: "NOS Madeira", 55: "NOWO", 56: "ONI",
  61: "Quantis Global", 69: "Starlink", 81: "Vodafone",
};
const TECNOLOGIA = {
  1: "Fibra otica (PON)", 2: "Fibra otica (P2P)",
  3: "Cabo DOCSIS 3.0", 4: "Cabo DOCSIS 3.1+",
  5: "Cobre", 6: "Cobre (ADSL)", 7: "FWA licenciado", 8: "FWA nao licenciado",
  9: "Outros",
};

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; comparador-pt/0.4)",
  "Accept": "application/json",
  "Referer": "https://comparadorpt.pages.dev/",
};

async function fetchJson(url) {
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) throw new Error(`upstream ${r.status} em ${new URL(url).hostname}`);
  return r.json();
}

async function geocode(cp) {
  const qs = new URLSearchParams({
    f: "json",
    outSR: JSON.stringify({ wkid: 4326 }),
    sourceCountry: "PT",
    SingleLine: cp,
    maxSuggestions: "1",
  });
  const data = await fetchJson(`${GEOCODER}?${qs}`);
  const cand = data.candidates && data.candidates[0];
  if (!cand || cand.score < 80) throw new Error("codigo postal nao encontrado");
  return { lat: cand.location.y, lon: cand.location.x, address: cand.address };
}

async function arcgisQuery(layer, params) {
  const qs = new URLSearchParams({ f: "json", ...params });
  const data = await fetchJson(`${BASE}/${layer}/query?${qs}`);
  if (data.error) throw new Error(`ArcGIS: ${data.error.message || data.error.code}`);
  return data;
}

async function arcgisRelated(layer, objectIds, relationshipId) {
  const qs = new URLSearchParams({
    f: "json",
    objectIds: objectIds.join(","),
    relationshipId: String(relationshipId),
    outFields: "*",
    returnGeometry: "false",
  });
  const data = await fetchJson(`${BASE}/${layer}/queryRelatedRecords?${qs}`);
  if (data.error) throw new Error(`ArcGIS: ${data.error.message || data.error.code}`);
  return data;
}

async function fixedCoverage(lat, lon) {
  // Step 1: find building points near the location
  const points = await arcgisQuery(0, {
    geometry: `${lon},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    distance: String(BUILDING_SEARCH_RADIUS_M),
    units: "esriSRUnit_Meter",
    outFields: "objectid",
    returnGeometry: "false",
  });
  const objectIds = (points.features || []).map((f) => f.attributes.objectid);
  if (!objectIds.length) return { edificios: 0, ofertas: [] };

  // Step 2: pull the related coverage attributes for those buildings
  const related = await arcgisRelated(0, objectIds, 0);
  const ofertas = [];
  for (const group of related.relatedRecordGroups || []) {
    for (const rec of group.relatedRecords || []) {
      const a = rec.attributes;
      if (a.estado !== 1) continue; // only active offers
      const op = OPERADOR[a.operador] || `cod:${a.operador}`;
      for (const s of ["a", "b"]) {
        const tec = a[`tecnologia_${s}`];
        if (!tec) continue;
        ofertas.push({
          operador: op,
          tecnologia: TECNOLOGIA[tec] || `cod:${tec}`,
          vel_dl_mbps: a[`vel_max_dl_${s}`] || null,
          vel_ul_mbps: a[`vel_max_ul_${s}`] || null,
        });
      }
    }
  }
  return { edificios: objectIds.length, ofertas };
}

async function satelliteCoverage(lat, lon) {
  const data = await arcgisQuery(2, {
    geometry: `${lon},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "operador,operador_alias,vel_dl_sat,vel_ul_sat",
    returnGeometry: "false",
    where: "(vel_dl_sat is not null and vel_dl_sat <> 0) and (vel_ul_sat is not null and vel_ul_sat <> 0)",
    orderByFields: "vel_dl_sat DESC,vel_ul_sat DESC",
  });
  return (data.features || []).map((f) => ({
    operador: f.attributes.operador_alias || OPERADOR[f.attributes.operador] || `cod:${f.attributes.operador}`,
    vel_dl_mbps: f.attributes.vel_dl_sat,
    vel_ul_mbps: f.attributes.vel_ul_sat,
  }));
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const cp = (url.searchParams.get("cp") || "").trim();
  if (!/^\d{4}-\d{3}$/.test(cp)) {
    return Response.json({ error: "cp invalido (formato NNNN-NNN)" }, { status: 400 });
  }

  const cacheKey = new Request(`https://cache.local/cobertura/${cp}`);
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  try {
    const { lat, lon, address } = await geocode(cp);
    const [fixa, satelite] = await Promise.all([
      fixedCoverage(lat, lon),
      satelliteCoverage(lat, lon).catch(() => []), // satellite is a bonus, never block on it
    ]);
    const operadores = [...new Set(fixa.ofertas.map((o) => o.operador))].sort();
    const body = {
      cp, lat, lon, morada: address,
      raio_m: BUILDING_SEARCH_RADIUS_M,
      edificios: fixa.edificios,
      operadores,
      ofertas: fixa.ofertas,
      satelite,
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
