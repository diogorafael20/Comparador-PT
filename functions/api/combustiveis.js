// functions/api/combustiveis.js
// Cloudflare Pages Function: fuel prices per station via the real DGEG search
// endpoint (confirmed via HAR capture on 2026-07-09).
//
// The endpoint returns 404 without the terms-accepted cookie and the
// X-Requested-With header - the DGEG server treats requests missing these
// as invalid rather than returning 403, which is what caused the earlier
// "PesquisarPostos" attempts to fail.
//
// Note: DGEG data is free to use but commercial use is forbidden - this
// endpoint must not be monetised (no ads/affiliates on this tab).

const DGEG = "https://precoscombustiveis.dgeg.gov.pt/api/PrecoComb/PesquisarPostos";
const CACHE_TTL = 3600; // 1h - station owners update prices during the day

const HEADERS = {
  "Accept": "*/*",
  "Accept-Language": "pt-PT,pt;q=0.8",
  "Referer": "https://precoscombustiveis.dgeg.gov.pt/",
  "X-Requested-With": "XMLHttpRequest",
  "User-Agent": "Mozilla/5.0 (compatible; comparador-pt/0.4)",
  "Cookie": "ACCEPTED_TERMS=true; cookiekit=1",
};

function parsePreco(raw) {
  // DGEG returns e.g. "1,739 €" (search results) or "1,739 €/litro" (map popup)
  if (typeof raw !== "string") return null;
  const n = parseFloat(raw.replace("€", "").replace("/litro", "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const distrito = url.searchParams.get("distrito");
  const concelho = url.searchParams.get("concelho"); // optional, DGEG municipio Id
  const tipo = url.searchParams.get("tipo");

  if (!/^\d{1,2}$/.test(distrito || "") || !/^\d{3,5}$/.test(tipo || "")) {
    return Response.json({ error: "parametros: distrito=1..18, tipo=idTipoCombustivel" }, { status: 400 });
  }

  const cacheKey = new Request(`https://cache.local/combustiveis/${distrito}/${concelho || "all"}/${tipo}`);
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const qs = new URLSearchParams({
    idsTiposComb: tipo,
    idMarca: "",
    idTipoPosto: "",
    idDistrito: distrito,
    idsMunicipios: concelho || "",
    qtdPorPagina: "2000",
    pagina: "1",
  });

  try {
    const r = await fetch(`${DGEG}?${qs}`, { headers: HEADERS });
    if (!r.ok) throw new Error(`DGEG ${r.status}`);
    const data = await r.json();
    if (!data.status) throw new Error(data.mensagem || "resposta invalida da DGEG");

    const postos = (data.resultado || []).map((p) => ({
      id: String(p.Id),
      nome: p.Nome || "Posto",
      marca: p.Marca || "",
      municipio: p.Municipio || "",
      distrito: p.Distrito || "",
      morada: p.Morada || "",
      localidade: p.Localidade || "",
      codPostal: p.CodPostal || "",
      lat: p.Latitude || null,
      lon: p.Longitude || null,
      preco: parsePreco(p.Preco),
      atualizado: p.DataAtualizacao || null,
    })).filter((p) => p.preco != null);

    const body = {
      distrito: Number(distrito),
      concelho: concelho ? Number(concelho) : null,
      tipo: Number(tipo),
      total: postos.length,
      postos,
      fonte: "DGEG - Precos de Combustiveis Online (uso nao comercial)",
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
