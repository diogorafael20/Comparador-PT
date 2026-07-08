# comparador.pt — MVP

Comparador neutro de custos domésticos em Portugal. Frontend Vite + React,
backend serverless em Cloudflare Pages Functions.

## Estado dos módulos

| Tab | Dados | Fonte |
|---|---|---|
| Combustíveis | **Reais** | DGEG (via `/api/combustiveis`) |
| Pacotes — cobertura | **Real** | GEO.ANACOM (via `/api/cobertura`) |
| Pacotes — preços | Demo | Fase 2: tarifários + Zwame |
| Móvel | Indicativos (campanhas 2026) | Fase 2: recolha automática |
| Eletricidade | Demo (modelo simplificado) | Fase 2: ERSE |
| Banca | Demo | Fase 2: preçários BdP |

## Desenvolvimento local

```bash
npm install
npx wrangler pages dev -- npm run dev
```

O `wrangler pages dev` é necessário para as Functions (`/api/*`) funcionarem
localmente; `npm run dev` sozinho serve apenas o frontend.

## Deploy no Cloudflare Pages

Opção A — CLI:
```bash
npm install
npm run build
npx wrangler login
npx wrangler pages deploy dist --project-name comparador-pt
```

Opção B — Git: cria um repositório, liga-o em dash.cloudflare.com → Workers &
Pages → Create → Pages. Build command: `npm run build`. Output: `dist`.
A pasta `functions/` é detetada automaticamente.


## Estrutura

```
comparador-pt/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx
│   └── App.jsx          # UI completa (5 tabs)
└── functions/
    └── api/
        ├── cobertura.js     # GEO.ANACOM (real)
        └── combustiveis.js  # DGEG (real)
```
