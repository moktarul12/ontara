# Ontopedian — map what connects

Search-first knowledge graph studio. Open a person, place, film, or company from **Wikidata** (default), **DBpedia**, or **YAGO**, explore relations as a living graph, deepen curated facets, and grow multi-hop neighborhoods.

**Live demo:** [https://ontara.onrender.com](https://ontara.onrender.com)  
**Repo:** [github.com/moktarul12/ontara](https://github.com/moktarul12/ontara)

---

## How it works

1. **Home** — brand + search. Pick a source, type a name (or tap an example).
2. **Studio** — immersive graph canvas, facet lenses for people/orgs, hop grow/shrink, inspector for relations and literal data.
3. **Share** — Wikidata entities get a hash URL like `/#/Q937`.

### Explore
- Click a node → inspector lists relations → **List** / **Add** neighbors
- Facet chips deepen family, career, awards, etc.
- Hops 1–5 from the seed; double-click a node to expand it
- Layout: Hops / Orbit / Auto · Fit · PNG · Fullscreen

---

## Run locally

```bash
npm install
npm run dev
```

App: [http://localhost:1901](http://localhost:1901)

Production-style (build + Express + SPARQL proxy):

```bash
npm run build
npm start
```

---

## Deploy on Vercel

Config is in [`vercel.json`](vercel.json). Serverless routes under `api/` proxy SPARQL and the Wikidata search API (same paths as local / Render).

### Option A — CLI
```bash
npx vercel --prod
```

### Option B — GitHub
1. [Vercel Dashboard](https://vercel.com/new) → import `moktarul12/ontara`
2. Framework: Vite · Build: `npm run build` · Output: `dist`
3. Deploy

Optional env vars (defaults work without them):
`SPARQL_UPSTREAM_WIKIDATA`, `SPARQL_UPSTREAM_DBPEDIA`, `SPARQL_UPSTREAM_YAGO`

---

## Deploy on Render

Config is in [`render.yaml`](render.yaml). Build `npm install && npm run build`, start `npm start`, health `/health`.

---

## AI content (OpenAI or Gemini)

Set at least one API key for rich editorial profiles (summary, timeline, history, wiki chapters):

```bash
# Free option — get a key at https://aistudio.google.com/apikey
export GEMINI_API_KEY=your-key

# Or OpenAI (requires billing credits)
export OPENAI_API_KEY=sk-...

npm run dev
```

On first visit to an entity (e.g. `#/Q9570`), the app calls the LLM and **saves the full response** to:

`data/ai-cache/Q9570.json`

The next load reads from that file instantly — no API call. To regenerate, delete the file or POST with `{ "force": true }` to `/api/ai/entity/Q9570`.

Without a key, a rule-based template fallback is used and still cached.

---

## Stack

- React 19 + TypeScript + Vite
- Cytoscape + cose-bilkent
- Express (`server.mjs`) — Render static + SPARQL proxy
- Vercel serverless (`api/`) — same proxy paths on Vercel
- Wikidata by default (DBpedia + YAGO available)
