import { useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// comparador.pt - v0.3
// Live data: /api/cobertura (GEO.ANACOM) and /api/combustiveis (DGEG),
// served by Cloudflare Pages Functions. Other tabs still use demo data.
// ---------------------------------------------------------------------------

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;900&family=IBM+Plex+Sans:wght@400;500;600&display=swap');

:root{
  --ink:#14232E; --ink-soft:#3E5563; --paper:#EFF3F2; --card:#FFFFFF;
  --line:#D8E0DF; --save:#0E9F6E; --save-bg:#E3F5EE; --warn:#B7791F; --warn-bg:#FCF3DE;
}
*{box-sizing:border-box;}
body{margin:0;}
.cpt-root{min-height:100vh;background:var(--paper);color:var(--ink);
  font-family:'IBM Plex Sans',sans-serif;font-variant-numeric:tabular-nums;}
.cpt-wrap{max-width:760px;margin:0 auto;padding:0 14px 56px;}
.cpt-brand{font-family:'Archivo',sans-serif;font-weight:900;font-size:26px;letter-spacing:-0.5px;}
.cpt-brand span{color:var(--save);}
.cpt-tag{color:var(--ink-soft);font-size:13px;margin-top:2px;}
.cpt-tabs{display:flex;gap:6px;overflow-x:auto;padding:14px 0 0;scrollbar-width:none;}
.cpt-tabs::-webkit-scrollbar{display:none;}
.cpt-tab{flex:0 0 auto;border:1px solid var(--line);border-bottom:none;background:#E4EAE8;
  color:var(--ink-soft);font-family:'Archivo',sans-serif;font-weight:700;font-size:13px;
  padding:10px 14px;border-radius:10px 10px 0 0;cursor:pointer;transition:background .15s;}
.cpt-tab:focus-visible{outline:2px solid var(--save);outline-offset:2px;}
.cpt-tab.on{background:var(--card);color:var(--ink);}
.cpt-panel{background:var(--card);border:1px solid var(--line);border-radius:0 12px 12px 12px;padding:16px;}
.cpt-h2{font-family:'Archivo',sans-serif;font-weight:700;font-size:17px;margin:0 0 4px;}
.cpt-sub{color:var(--ink-soft);font-size:13px;margin:0 0 14px;}
.cpt-row{display:flex;align-items:center;gap:10px;padding:12px 10px;border-top:1px solid var(--line);}
.cpt-row:first-of-type{border-top:none;}
.cpt-name{font-weight:600;font-size:14.5px;line-height:1.25;}
.cpt-meta{color:var(--ink-soft);font-size:12.5px;margin-top:2px;}
.cpt-price{font-family:'Archivo',sans-serif;font-weight:700;font-size:16px;text-align:right;white-space:nowrap;}
.cpt-delta{font-size:12px;text-align:right;white-space:nowrap;color:var(--ink-soft);}
.cpt-badge{display:inline-block;background:var(--save-bg);color:var(--save);font-weight:600;
  font-size:11.5px;padding:2px 8px;border-radius:99px;}
.cpt-badge.warn{background:var(--warn-bg);color:var(--warn);}
.cpt-select,.cpt-input{border:1px solid var(--line);border-radius:8px;background:var(--card);
  color:var(--ink);font:inherit;font-size:14px;padding:9px 10px;}
.cpt-select:focus-visible,.cpt-input:focus-visible{outline:2px solid var(--save);outline-offset:1px;}
.cpt-controls{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;align-items:center;}
.cpt-check{display:flex;align-items:center;gap:6px;font-size:13.5px;cursor:pointer;}
.cpt-check input{accent-color:var(--save);width:16px;height:16px;}
.cpt-star{background:none;border:none;font-size:18px;cursor:pointer;padding:4px;line-height:1;}
.cpt-star:focus-visible{outline:2px solid var(--save);border-radius:6px;}
.cpt-note{border-top:1px dashed var(--line);margin-top:14px;padding-top:10px;
  color:var(--ink-soft);font-size:12px;}
.cpt-hero{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;
  background:var(--ink);color:#F2F6F5;border-radius:12px;padding:14px 16px;margin:14px 0 4px;}
.cpt-hero b{font-family:'Archivo',sans-serif;font-size:22px;font-weight:900;color:#7BE0BC;}
.cpt-hero small{display:block;font-size:12px;color:#B9C9C4;margin-top:2px;}
.cpt-btn{background:var(--save);color:#fff;border:none;border-radius:8px;font-weight:600;
  font-size:14px;padding:9px 14px;cursor:pointer;}
.cpt-btn:focus-visible{outline:2px solid var(--ink);outline-offset:2px;}
.cpt-info{background:var(--paper);border:1px solid var(--line);border-radius:10px;
  padding:12px;font-size:13.5px;line-height:1.5;margin-top:12px;}
.cpt-info h4{font-family:'Archivo',sans-serif;font-size:13.5px;margin:0 0 4px;}
.cpt-spin{color:var(--ink-soft);font-size:13.5px;padding:14px 4px;}
@media (prefers-reduced-motion: reduce){ .cpt-tab{transition:none;} }
`;

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

// DGEG district ids (mainland; islands not covered by this API)
const DISTRITOS = [
  { id: 1, nome: "Aveiro" }, { id: 2, nome: "Beja" }, { id: 3, nome: "Braga" },
  { id: 4, nome: "Bragança" }, { id: 5, nome: "Castelo Branco" },
  { id: 6, nome: "Coimbra" }, { id: 7, nome: "Évora" }, { id: 8, nome: "Faro" },
  { id: 9, nome: "Guarda" }, { id: 10, nome: "Leiria" }, { id: 11, nome: "Lisboa" },
  { id: 12, nome: "Portalegre" }, { id: 13, nome: "Porto" },
  { id: 14, nome: "Santarém" }, { id: 15, nome: "Setúbal" },
  { id: 16, nome: "Viana do Castelo" }, { id: 17, nome: "Vila Real" },
  { id: 18, nome: "Viseu" },
];

// DGEG fuel type ids (verify against /api/PrecoComb/ListarTiposCombustiveis)
const FUEL_TYPES = [
  { id: 2101, label: "Gasóleo simples" },
  { id: 2105, label: "Gasóleo especial" },
  { id: 3201, label: "Gasolina simples 95" },
  { id: 3205, label: "Gasolina especial 95" },
  { id: 3400, label: "Gasolina 98" },
  { id: 3405, label: "Gasolina especial 98" },
  { id: 1120, label: "GPL Auto" },
];

const MOBILE = [
  { id: "m1", op: "Digi", plan: "50 GB", price: 4.0, gb: 50, min: "Ilimitadas", rede: "Rede própria", fidel: "3 meses" },
  { id: "m2", op: "Digi", plan: "100 GB", price: 5.0, gb: 100, min: "Ilimitadas", rede: "Rede própria", fidel: "3 meses" },
  { id: "m3", op: "Digi", plan: "Ilimitado", price: 7.0, gb: null, min: "Ilimitadas", rede: "Rede própria", fidel: "3 meses" },
  { id: "m4", op: "WOO", plan: "100 GB", price: 5.0, gb: 100, min: "2500 min/SMS", rede: "NOS", fidel: "Sem" },
  { id: "m5", op: "WOO", plan: "Ilimitado", price: 7.0, gb: null, min: "5000 min/SMS", rede: "NOS", fidel: "Sem" },
  { id: "m6", op: "UZO", plan: "100 GB", price: 6.0, gb: 100, min: "Ilimitadas", rede: "MEO", fidel: "Sem" },
  { id: "m7", op: "UZO", plan: "Ilimitado", price: 8.0, gb: null, min: "Ilimitadas", rede: "MEO", fidel: "Sem" },
  { id: "m8", op: "Amigo", plan: "100 GB", price: 6.0, gb: 100, min: "5000 min/SMS", rede: "Vodafone", fidel: "Sem" },
  { id: "m9", op: "Amigo", plan: "Ilimitado", price: 8.0, gb: null, min: "5000 min/SMS", rede: "Vodafone", fidel: "Sem" },
  { id: "m10", op: "Lycamobile", plan: "100 GB", price: 6.0, gb: 100, min: "Ilimitadas", rede: "Vodafone", fidel: "Sem" },
  { id: "m11", op: "NOWO", plan: "50 GB", price: 4.0, gb: 50, min: "Ilimitadas", rede: "Digi", fidel: "Sem" },
  { id: "m12", op: "MEO", plan: "Moche 30GB", price: 12.5, gb: 30, min: "Ilimitadas", rede: "MEO", fidel: "12 meses" },
  { id: "m13", op: "NOS", plan: "WTF 30GB", price: 12.5, gb: 30, min: "Ilimitadas", rede: "NOS", fidel: "Sem" },
  { id: "m14", op: "Vodafone", plan: "Yorn X", price: 13.9, gb: 30, min: "Ilimitadas", rede: "Vodafone", fidel: "12 meses" },
];

const PACOTES = [
  { id: "p1", op: "Digi", plan: "Fibra 1Gbps + TV", tabela: 25.0, zwame: null, tech: "Fibra 1 Gbps", fidel: "3 meses" },
  { id: "p2", op: "MEO", plan: "M4 1Gbps", tabela: 62.99, zwame: 39.99, tech: "Fibra 1 Gbps", fidel: "24 meses" },
  { id: "p3", op: "NOS", plan: "4P 1Gbps", tabela: 64.99, zwame: 42.5, tech: "Fibra 1 Gbps", fidel: "24 meses" },
  { id: "p4", op: "Vodafone", plan: "Fibra 4P 1Gbps", tabela: 61.9, zwame: 41.0, tech: "Fibra 1 Gbps", fidel: "24 meses" },
];

const ENERGIA = [
  { id: "e1", com: "Ibelectra", kwh: 0.1289, dia69: 0.3855 },
  { id: "e2", com: "Luzboa", kwh: 0.1312, dia69: 0.3912 },
  { id: "e3", com: "Coopérnico", kwh: 0.1358, dia69: 0.3898 },
  { id: "e4", com: "Plenitude", kwh: 0.1399, dia69: 0.4021 },
  { id: "e5", com: "Iberdrola", kwh: 0.1435, dia69: 0.4055 },
  { id: "e6", com: "Endesa", kwh: 0.1478, dia69: 0.4102 },
  { id: "e7", com: "Galp", kwh: 0.1489, dia69: 0.418 },
  { id: "e8", com: "EDP Comercial", kwh: 0.1552, dia69: 0.4235 },
];

const POTENCIAS = [
  { kva: 1.15, f: 0.25 }, { kva: 2.3, f: 0.42 }, { kva: 3.45, f: 0.55 },
  { kva: 4.6, f: 0.7 }, { kva: 5.75, f: 0.85 }, { kva: 6.9, f: 1.0 },
  { kva: 10.35, f: 1.42 }, { kva: 13.8, f: 1.85 }, { kva: 17.25, f: 2.3 },
  { kva: 20.7, f: 2.75 },
];

const TARIFA_SOCIAL_DESC = 0.338;

const CONTAS = [
  { id: "b1", banco: "ActivoBank", conta: "Conta Simples", com: 0, cartao: "Débito grátis", idadeMin: 18, jovem: false, cond: "Sem condições" },
  { id: "b2", banco: "Moey!", conta: "Conta Moey", com: 0, cartao: "Débito grátis", idadeMin: 18, jovem: false, cond: "Sem condições" },
  { id: "b3", banco: "Revolut", conta: "Standard", com: 0, cartao: "Débito grátis", idadeMin: 18, jovem: false, cond: "IBAN estrangeiro (LT)" },
  { id: "b4", banco: "CGD", conta: "Conta Jovem", com: 0, cartao: "Débito grátis", idadeMin: 0, jovem: true, cond: "Até aos 26 anos" },
  { id: "b5", banco: "Bankinter", conta: "Conta Mais Ordenado", com: 0, cartao: "Débito grátis", idadeMin: 18, jovem: false, cond: "Ordenado domiciliado" },
  { id: "b6", banco: "Santander", conta: "Conta Mundo", com: 5.5, cartao: "Incluído", idadeMin: 18, jovem: false, cond: "Isenção com condições" },
  { id: "b7", banco: "Millennium", conta: "Conta Simples", com: 6.24, cartao: "Incluído", idadeMin: 18, jovem: false, cond: "Isenção com condições" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const eur = (v, dec = 2) =>
  v.toLocaleString("pt-PT", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + " €";

function Delta({ value, perLitre }) {
  if (value <= 0.0001) return <span className="cpt-badge">Mais barato</span>;
  return (
    <div className="cpt-delta">
      +{eur(value, perLitre ? 3 : 2)}{perLitre ? "/L" : "/mês"}
    </div>
  );
}

function formatCP(raw) {
  const digits = raw.replace(/\D/g, "").slice(0, 7);
  return digits.length > 4 ? digits.slice(0, 4) + "-" + digits.slice(4) : digits;
}

// ---------------------------------------------------------------------------
// Combustiveis (live via /api/combustiveis -> DGEG)
// ---------------------------------------------------------------------------

function FuelTab() {
  const [distrito, setDistrito] = useState(14); // Santarem
  const [concelho, setConcelho] = useState(""); // DGEG municipio Id, "" = todos
  const [comb, setComb] = useState(2101); // gasoleo simples
  const [onlyFav, setOnlyFav] = useState(false);
  const [favs, setFavs] = useState(() => new Set());
  const [postos, setPostos] = useState([]);
  const [municipios, setMunicipios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch the real concelho list whenever the distrito changes
  useEffect(() => {
    let cancelled = false;
    setConcelho("");
    fetch(`/api/municipios?distrito=${distrito}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => { if (!cancelled) setMunicipios(data.municipios || []); })
      .catch(() => { if (!cancelled) setMunicipios([]); });
    return () => { cancelled = true; };
  }, [distrito]);

  // Fetch prices whenever distrito, concelho or combustivel changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const cq = concelho ? `&concelho=${concelho}` : "";
    fetch(`/api/combustiveis?distrito=${distrito}${cq}&tipo=${comb}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => { if (!cancelled) setPostos(data.postos || []); })
      .catch((e) => { if (!cancelled) { setError(String(e)); setPostos([]); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [distrito, concelho, comb]);

  const list = useMemo(() => {
    let l = [...postos];
    if (onlyFav) l = l.filter((f) => favs.has(f.id));
    return l.sort((a, b) => a.preco - b.preco);
  }, [postos, onlyFav, favs]);

  const best = list[0]?.preco;
  const worst = list[list.length - 1]?.preco;
  const savePerTank = best != null && worst != null ? (worst - best) * 50 : 0;
  const combLabel = FUEL_TYPES.find((t) => t.id === comb).label;
  const distNome = DISTRITOS.find((d) => d.id === distrito).nome;
  const concelhoNome = concelho ? municipios.find((m) => m.id === Number(concelho))?.nome : null;
  const areaLabel = concelhoNome || distNome;

  const toggleFav = (id) =>
    setFavs((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <div>
      <h2 className="cpt-h2">Combustíveis</h2>
      <p className="cpt-sub">Preços reais por posto · fonte: DGEG (Preços de Combustíveis Online)</p>
      <div className="cpt-controls">
        <select className="cpt-select" value={distrito} onChange={(e) => setDistrito(Number(e.target.value))} aria-label="Distrito">
          {DISTRITOS.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
        </select>
        <select className="cpt-select" value={concelho} onChange={(e) => setConcelho(e.target.value)} aria-label="Concelho" disabled={!municipios.length}>
          <option value="">Todos os concelhos</option>
          {municipios.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
        <select className="cpt-select" value={comb} onChange={(e) => setComb(Number(e.target.value))} aria-label="Combustível">
          {FUEL_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <button className="cpt-btn" style={{ background: onlyFav ? "var(--ink)" : "var(--save)" }} onClick={() => setOnlyFav(!onlyFav)}>
          {onlyFav ? "Todos" : "★ Favoritos"}
        </button>
      </div>

      {loading && <div className="cpt-spin">A carregar preços da DGEG…</div>}
      {error && (
        <div className="cpt-info">
          <h4>Não foi possível obter os preços</h4>
          A API da DGEG não respondeu ({error}). Tenta novamente dentro de momentos.
        </div>
      )}

      {!loading && !error && savePerTank > 0.005 && (
        <div className="cpt-hero">
          <div>
            Poupança num depósito de 50 L
            <small>{combLabel} · entre o posto mais caro e o mais barato de {areaLabel}</small>
          </div>
          <b>{eur(savePerTank)}</b>
        </div>
      )}

      {!loading && !error && list.length === 0 && (
        <p className="cpt-sub" style={{ paddingTop: 10 }}>
          {onlyFav ? "Sem postos favoritos neste filtro." : "Sem postos para este filtro."}
        </p>
      )}

      {!loading && list.map((f) => (
        <div className="cpt-row" key={f.id}>
          <button
            className="cpt-star"
            onClick={() => toggleFav(f.id)}
            aria-label={favs.has(f.id) ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          >
            {favs.has(f.id) ? "★" : "☆"}
          </button>
          <div style={{ flex: 1 }}>
            <div className="cpt-name">{f.nome}</div>
            <div className="cpt-meta">{f.marca} · {f.municipio}{f.atualizado ? ` · atualizado ${f.atualizado}` : ""}</div>
          </div>
          <div>
            <div className="cpt-price">{eur(f.preco, 3)}</div>
            <Delta value={f.preco - best} perLitre />
          </div>
        </div>
      ))}
      <p className="cpt-note">
        Dados da DGEG, atualizados pelos titulares dos postos. Utilização livre, proibida para
        fins comerciais. Favoritos guardados apenas nesta sessão.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pacotes (live via /api/cobertura -> GEO.ANACOM)
// ---------------------------------------------------------------------------

function PacotesTab() {
  const [cp, setCp] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const cpValid = /^\d{4}-\d{3}$/.test(cp);

  const check = () => {
    if (!cpValid) return;
    setLoading(true);
    setError(null);
    setResult(null);
    fetch(`/api/cobertura?cp=${cp}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setResult)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  };

  const ofertas = result?.ofertas ?? [];
  const satelite = result?.satelite ?? [];
  const covered = result?.operadores ?? [];

  // Best fixed offer per operator, sorted by download speed (fastest first)
  const porOperador = useMemo(() => {
    const map = new Map();
    for (const o of ofertas) {
      const cur = map.get(o.operador);
      if (!cur || (o.vel_dl_mbps || 0) > (cur.vel_dl_mbps || 0)) map.set(o.operador, o);
    }
    return [...map.values()].sort((a, b) => (b.vel_dl_mbps || 0) - (a.vel_dl_mbps || 0));
  }, [ofertas]);

  // Demo pricing matched against real coverage, for reference only
  const precosDemo = useMemo(() => {
    const l = PACOTES.filter((p) =>
      covered.some((op) => op.toUpperCase().includes(p.op.toUpperCase()))
    );
    return l.sort((a, b) => (a.zwame ?? a.tabela) - (b.zwame ?? b.tabela));
  }, [covered]);
  const bestPreco = precosDemo.length ? Math.min(...precosDemo.map((p) => p.zwame ?? p.tabela)) : 0;

  return (
    <div>
      <h2 className="cpt-h2">Pacotes (fibra + TV)</h2>
      <p className="cpt-sub">Validação real de cobertura por código postal · fonte: GEO.ANACOM</p>
      <div className="cpt-controls">
        <input
          className="cpt-input"
          placeholder="Código postal (ex.: 1000-123)"
          value={cp}
          onChange={(e) => { setCp(formatCP(e.target.value)); setResult(null); setError(null); }}
          inputMode="numeric"
          maxLength={8}
          style={{ flex: 1, minWidth: 180 }}
          aria-label="Código postal"
        />
        <button className="cpt-btn" onClick={check} disabled={!cpValid || loading} style={{ opacity: cpValid ? 1 : 0.5 }}>
          Verificar cobertura
        </button>
      </div>

      {loading && <div className="cpt-spin">A consultar GEO.ANACOM…</div>}
      {error && (
        <div className="cpt-info">
          <h4>Não foi possível validar a cobertura</h4>
          {error}. Confirma o código postal ou tenta mais tarde.
        </div>
      )}

      {!result && !loading && !error && (
        <p className="cpt-sub" style={{ paddingTop: 6 }}>
          {cp && !cpValid
            ? "Formato: NNNN-NNN (o hífen é inserido automaticamente)."
            : "Insere o código postal para veres apenas as ofertas disponíveis na tua morada."}
        </p>
      )}

      {result && (
        <>
          <div className="cpt-info" style={{ marginTop: 0, marginBottom: 12 }}>
            <h4>{result.morada || cp}</h4>
            {covered.length
              ? <>Rede fixa de {covered.join(", ")} · {result.edificios} edifício(s) analisados num raio de {result.raio_m} m.</>
              : <>Sem registos de rede fixa neste código postal — pode ser uma área branca de cobertura ou o raio de pesquisa não abrange edifícios registados.</>}
            {" "}Dados trimestrais reportados à ANACOM — confirma sempre no operador antes de contratar.
            {covered.length === 1 && (
              <> Só há um operador com rede fixa: sem concorrência direta, o preço real de renegociações é a tua melhor referência para negociar.</>
            )}
          </div>

          {porOperador.map((o, i) => (
            <div className="cpt-row" key={o.operador + i}>
              <div style={{ flex: 1 }}>
                <div className="cpt-name">{o.operador}</div>
                <div className="cpt-meta">{o.tecnologia}</div>
              </div>
              <div>
                <div className="cpt-price">
                  {o.vel_dl_mbps ? `${o.vel_dl_mbps} Mbps` : "—"}
                </div>
                <div className="cpt-delta">
                  {o.vel_ul_mbps ? `↑ ${o.vel_ul_mbps} Mbps` : ""}
                </div>
              </div>
            </div>
          ))}

          {!porOperador.length && satelite.length > 0 && (
            <div className="cpt-info">
              <h4>Sem rede fixa, mas há satélite</h4>
              Não há fibra, cabo ou cobre registados nesta morada, mas existem opções de internet
              via satélite — normalmente mais caras e com mais latência, mas úteis em zonas rurais.
            </div>
          )}

          {satelite.length > 0 && (
            <>
              {porOperador.length > 0 && <p className="cpt-sub" style={{ marginTop: 14 }}>Internet via satélite (alternativa)</p>}
              {satelite.map((s, i) => (
                <div className="cpt-row" key={"sat" + i}>
                  <div style={{ flex: 1 }}>
                    <div className="cpt-name">{s.operador}</div>
                    <div className="cpt-meta">Satélite</div>
                  </div>
                  <div>
                    <div className="cpt-price">{s.vel_dl_mbps} Mbps</div>
                    <div className="cpt-delta">↑ {s.vel_ul_mbps} Mbps</div>
                  </div>
                </div>
              ))}
            </>
          )}

          {precosDemo.length > 0 && (
            <>
              <p className="cpt-sub" style={{ marginTop: 16 }}>
                Preços de referência (demo) para os operadores com cobertura confirmada
              </p>
              {precosDemo.map((p) => (
                <div className="cpt-row" key={p.id}>
                  <div style={{ flex: 1 }}>
                    <div className="cpt-name">{p.op} — {p.plan}</div>
                    <div className="cpt-meta">
                      {p.tech} · fidelização: {p.fidel}
                      {p.zwame && <> · tabela {eur(p.tabela)}</>}
                    </div>
                    {p.zwame && (
                      <div className="cpt-meta" style={{ color: "var(--save)", fontWeight: 600 }}>
                        Preço real (renegociações Zwame, mediana) — dados demo
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="cpt-price">{eur(p.zwame ?? p.tabela)}</div>
                    <Delta value={(p.zwame ?? p.tabela) - bestPreco} />
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
      <p className="cpt-note">
        A cobertura e as velocidades são dados reais (GEO.ANACOM). Os preços apresentados são
        ainda demonstrativos — próxima fase: recolha automática dos tarifários e das renegociações.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Movel / Energia / Banca (demo)
// ---------------------------------------------------------------------------

function MobileTab() {
  const [sort, setSort] = useState("price");
  const list = useMemo(() => {
    const l = [...MOBILE];
    const perGb = (m) => (m.gb == null ? m.price / 300 : m.price / m.gb);
    if (sort === "price") l.sort((a, b) => a.price - b.price);
    if (sort === "perGb") l.sort((a, b) => perGb(a) - perGb(b));
    if (sort === "gb") l.sort((a, b) => (b.gb ?? Infinity) - (a.gb ?? Infinity) || a.price - b.price);
    return l;
  }, [sort]);
  const best = Math.min(...MOBILE.map((m) => m.price));

  return (
    <div>
      <h2 className="cpt-h2">Tarifários móveis</h2>
      <p className="cpt-sub">Standalone · MVNOs herdam a cobertura da rede de suporte · campanhas mudam com frequência</p>
      <div className="cpt-controls">
        <select className="cpt-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar por">
          <option value="price">Mais barato primeiro</option>
          <option value="perGb">Melhor €/GB</option>
          <option value="gb">Mais dados</option>
        </select>
      </div>
      {list.map((m) => (
        <div className="cpt-row" key={m.id}>
          <div style={{ flex: 1 }}>
            <div className="cpt-name">{m.op} — {m.plan}</div>
            <div className="cpt-meta">
              {m.gb == null ? "Dados ilimitados" : `${m.gb} GB`} · {m.min} · rede {m.rede}
              {m.gb != null && <> · {(m.price / m.gb).toLocaleString("pt-PT", { maximumFractionDigits: 2 })} €/GB</>}
              {m.fidel !== "Sem" && <> · <span className="cpt-badge warn">Fidelização {m.fidel}</span></>}
            </div>
          </div>
          <div>
            <div className="cpt-price">{eur(m.price)}</div>
            <Delta value={m.price - best} />
          </div>
        </div>
      ))}
      <p className="cpt-note">
        Valores indicativos de campanhas de 2026 — a validar contra os sites dos operadores.
        Próxima fase: recolha semanal automática com data de verificação por tarifário.
      </p>
    </div>
  );
}

function EnergiaTab() {
  const [kwh, setKwh] = useState(180);
  const [pot, setPot] = useState(6.9);
  const [social, setSocial] = useState(false);
  const [famNum, setFamNum] = useState(false);

  const list = useMemo(() => {
    const factor = POTENCIAS.find((p) => p.kva === pot).f;
    const ivaThreshold = pot <= 6.9 ? (famNum ? 150 : 100) : 0;
    const kwhLow = Math.min(kwh, ivaThreshold);
    const kwhHigh = Math.max(0, kwh - ivaThreshold);
    return ENERGIA.map((e) => {
      const fixed = e.dia69 * factor * 30;
      let subLow = e.kwh * kwhLow + fixed * (kwh > 0 ? kwhLow / kwh : 1);
      let subHigh = e.kwh * kwhHigh + fixed * (kwh > 0 ? kwhHigh / kwh : 0);
      if (social) { subLow *= 1 - TARIFA_SOCIAL_DESC; subHigh *= 1 - TARIFA_SOCIAL_DESC; }
      return { ...e, total: subLow * 1.06 + subHigh * 1.23 };
    }).sort((a, b) => a.total - b.total);
  }, [kwh, pot, social, famNum]);

  const best = list[0].total;
  const worst = list[list.length - 1].total;

  return (
    <div>
      <h2 className="cpt-h2">Eletricidade</h2>
      <p className="cpt-sub">Tarifa simples · estimativa simplificada com IVA por escalão</p>
      <div className="cpt-controls">
        <label htmlFor="kwh-in" style={{ fontSize: 14 }}>Consumo:</label>
        <input
          id="kwh-in" className="cpt-input" type="number" min="0" max="5000"
          value={kwh} onChange={(e) => setKwh(Math.max(0, Number(e.target.value)))}
          style={{ width: 90 }}
        />
        <span style={{ fontSize: 14 }}>kWh/mês</span>
        <label htmlFor="pot-in" style={{ fontSize: 14 }}>Potência:</label>
        <select id="pot-in" className="cpt-select" value={pot} onChange={(e) => setPot(Number(e.target.value))}>
          {POTENCIAS.map((p) => <option key={p.kva} value={p.kva}>{p.kva.toLocaleString("pt-PT")} kVA</option>)}
        </select>
      </div>
      <div className="cpt-controls">
        <label className="cpt-check">
          <input type="checkbox" checked={social} onChange={(e) => setSocial(e.target.checked)} />
          Tarifa social
        </label>
        <label className="cpt-check">
          <input type="checkbox" checked={famNum} onChange={(e) => setFamNum(e.target.checked)} disabled={pot > 6.9} />
          Família numerosa (IVA 6% até 150 kWh)
        </label>
      </div>

      {pot > 6.9 && (
        <p className="cpt-sub">Nota: acima de 6,9 kVA não se aplica o IVA reduzido nos primeiros kWh.</p>
      )}

      <div className="cpt-hero">
        <div>
          Poupança anual potencial
          <small>trocando do mais caro para o mais barato · {kwh} kWh/mês · {pot.toLocaleString("pt-PT")} kVA{social ? " · tarifa social" : ""}</small>
        </div>
        <b>{eur((worst - best) * 12)}</b>
      </div>

      {list.map((e) => (
        <div className="cpt-row" key={e.id}>
          <div style={{ flex: 1 }}>
            <div className="cpt-name">{e.com}</div>
            <div className="cpt-meta">
              {e.kwh.toLocaleString("pt-PT", { minimumFractionDigits: 4 })} €/kWh · termo fixo{" "}
              {(e.dia69 * POTENCIAS.find((p) => p.kva === pot).f).toLocaleString("pt-PT", { minimumFractionDigits: 4 })} €/dia
            </div>
          </div>
          <div>
            <div className="cpt-price">{eur(e.total)}</div>
            <Delta value={e.total - best} />
          </div>
        </div>
      ))}
      <p className="cpt-note">
        Dados e modelo demonstrativos: termo fixo por potência aproximado, tarifa social
        simplificada (33,8% antes de IVA), sem TSE, taxa DGEG nem contribuição audiovisual.
        Próxima fase: tarifários ERSE completos + validação com a tabela do Tiago Felícia.
      </p>
    </div>
  );
}

function BancaTab() {
  const [idade, setIdade] = useState(26);
  const list = useMemo(() => {
    return CONTAS.filter((c) => (c.jovem ? idade <= 26 : idade >= c.idadeMin)).sort((a, b) => a.com - b.com);
  }, [idade]);

  return (
    <div>
      <h2 className="cpt-h2">Contas à ordem</h2>
      <p className="cpt-sub">Comissões de manutenção · fonte futura: preçários Banco de Portugal</p>
      <div className="cpt-controls">
        <label htmlFor="idade-in" style={{ fontSize: 14 }}>Idade:</label>
        <input
          id="idade-in" className="cpt-input" type="number" min="16" max="99"
          value={idade} onChange={(e) => setIdade(Number(e.target.value))}
          style={{ width: 80 }}
        />
      </div>
      {list.map((c) => (
        <div className="cpt-row" key={c.id}>
          <div style={{ flex: 1 }}>
            <div className="cpt-name">{c.banco} — {c.conta}</div>
            <div className="cpt-meta">{c.cartao} · {c.cond}</div>
          </div>
          <div>
            <div className="cpt-price">{c.com === 0 ? "0 €" : eur(c.com)}</div>
            {c.com === 0 ? <span className="cpt-badge">Isenção total</span> : <div className="cpt-delta">/mês</div>}
          </div>
        </div>
      ))}

      <div className="cpt-info">
        <h4>Cashback — o essencial</h4>
        Cashback é a devolução de uma percentagem do que gastas. Sem custos, existe em três formas:
        cartões com cashback nativo, apps de cashback com ligação a lojas online, e programas de
        fidelização de supermercados. Regra de ouro: nunca alterar hábitos de consumo para
        "ganhar" cashback — só conta o que já ias gastar. Verifica sempre custos escondidos
        (anuidades, mínimos de gasto) antes de aderir.
      </div>
      <p className="cpt-note">
        Dados demonstrativos. Próxima fase: preçários oficiais + guia editorial de literacia
        financeira com divulgação clara de afiliados.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

const TABS = [
  { id: "fuel", label: "Combustíveis", El: FuelTab },
  { id: "mobile", label: "Móvel", El: MobileTab },
  { id: "pacotes", label: "Pacotes", El: PacotesTab },
  { id: "energia", label: "Eletricidade", El: EnergiaTab },
  { id: "banca", label: "Banca", El: BancaTab },
];

export default function App() {
  const [tab, setTab] = useState("fuel");
  const Active = TABS.find((t) => t.id === tab).El;
  return (
    <div className="cpt-root">
      <style>{CSS}</style>
      <div className="cpt-wrap">
        <header style={{ paddingTop: 22 }}>
          <div className="cpt-brand">comparador<span>.pt</span></div>
          <div className="cpt-tag">Comparação neutra de custos domésticos · fontes oficiais · sem leads enviesados</div>
        </header>
        <nav className="cpt-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={"cpt-tab" + (tab === t.id ? " on" : "")}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <main className="cpt-panel"><Active /></main>
        <footer style={{ marginTop: 14, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5 }}>
          Projeto independente e sem fins comerciais. Preços finais sempre confirmados na fonte
          oficial (DGEG, ERSE, ANACOM, Banco de Portugal, operadores).
        </footer>
      </div>
    </div>
  );
}
