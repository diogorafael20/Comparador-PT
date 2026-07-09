// functions/api/municipios.js
// Cloudflare Pages Function: list of concelhos (municipios) for a given
// distrito, via the real DGEG endpoint.
//
// GetMunicipios with no idDistrito param returns the FULL national list
// (~308 municipios) in one call. We fetch that once, cache it long-term
// (the list essentially never changes), and filter by distrito server-side -
// this means at most one upstream request to DGEG per cache window,
// regardless of how many different distritos people search for.

const DGEG = "https://precoscombustiveis.dgeg.gov.pt/api/PrecoComb/GetMunicipios";
const CACHE_TTL = 604800; // 7 days

const HEADERS = {
  "Accept": "*/*",
  "Accept-Language": "pt-PT,pt;q=0.8",
  "Referer": "https://precoscombustiveis.dgeg.gov.pt/",
  "X-Requested-With": "XMLHttpRequest",
  "User-Agent": "Mozilla/5.0 (compatible; comparador-pt/0.4)",
  "Cookie": "ACCEPTED_TERMS=true; cookiekit=1",
};

async function fetchAllMunicipios(cache) {
  // Separate cache slot for the raw full list, independent of the
  // per-distrito response cache below.
  const rawKey = new Request("https://cache.local/municipios/_all");
  const hit = await cache.match(rawKey);
  if (hit) return hit.json();

  const r = await fetch(DGEG, { headers: HEADERS });
  if (!r.ok) throw new Error(`DGEG ${r.status}`);
  const data = await r.json();
  if (!data.status) throw new Error(data.mensagem || "resposta invalida da DGEG");

  const all = (data.resultado || []).map((m) => ({
    id: m.Id,
    nome: m.Descritivo,
    distrito: m.IdDistrito,
  }));

  const rawResp = new Response(JSON.stringify(all), {
    headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${CACHE_TTL}` },
  });
  cache.put(rawKey, rawResp.clone()); // fire and forget within this call
  return all;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const distrito = url.searchParams.get("distrito");
  if (!/^\d{1,2}$/.test(distrito || "")) {
    return Response.json({ error: "parametro: distrito=1..18" }, { status: 400 });
  }

  const cache = caches.default;
  const cacheKey = new Request(`https://cache.local/municipios/${distrito}`);
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  try {
    const all = await fetchAllMunicipios(cache);
    const municipios = all
      .filter((m) => m.distrito === Number(distrito))
      .map(({ id, nome }) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt"));

    const body = { distrito: Number(distrito), municipios };
    const resp = Response.json(body, {
      headers: { "Cache-Control": `public, max-age=${CACHE_TTL}` },
    });
    context.waitUntil(cache.put(cacheKey, resp.clone()));
    return resp;
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 502 });
  }
}
