// functions/api/combustiveis.js
// Cloudflare Pages Function: fuel prices per station via the public DGEG API.
// Note: DGEG data is free to use but commercial use is forbidden - this
// endpoint must not be monetised (no ads/affiliates on this tab).

const DGEG = "https://precoscombustiveis.dgeg.gov.pt/api/PrecoComb/PesquisarPostos";
const CACHE_TTL = 3600; // 1h - station owners update prices during the day

const HEADERS = {
  "User-Agent": "comparador-pt/0.3 (nao comercial; prototipo)",
  "Accept": "application/json",
};

function parsePreco(raw) {
  // DGEG returns prices like "1,579 €" or numbers depending on the field
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const n = parseFloat(raw.replace("€", "").replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const distrito = url.searchParams.get("distrito");
  const tipo = url.searchParams.get("tipo");
  if (!/^\d{1,2}$/.test(distrito || "") || !/^\d{3,5}$/.test(tipo || "")) {
    return Response.json({ error: "parametros: distrito=1..18, tipo=idTipoCombustivel" }, { status: 400 });
  }

  const cacheKey = new Request(`https://cache.local/combustiveis/${distrito}/${tipo}`);
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const qs = new URLSearchParams({
    idsTiposComb: tipo,
    idDistrito: distrito,
    idsMunicipios: "",
    qtdPorPagina: "500",
    pagina: "1",
  });

  try {
    const r = await fetch(`${DGEG}?${qs}`, { headers: HEADERS });
    if (!r.ok) throw new Error(`DGEG ${r.status}`);
    const data = await r.json();
    const rows = data.resultado || data.Resultado || [];

    const postos = rows.map((p) => ({
      id: String(p.Id ?? p.id),
      nome: p.Nome ?? p.nome ?? "Posto",
      marca: p.Marca ?? p.marca ?? "",
      municipio: p.Municipio ?? p.municipio ?? "",
      morada: p.Morada ?? p.morada ?? "",
      preco: parsePreco(p.Preco ?? p.preco),
      atualizado: p.DataAtualizacao ?? p.dataAtualizacao ?? null,
    })).filter((p) => p.preco != null);

    const body = {
      distrito: Number(distrito),
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
