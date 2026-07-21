# Ontara — Knowledge Graph Studio

Search-first ontology explorer backed by **Wikidata** (default) or **DBpedia** SPARQL. Search a person, place, or concept, open a 1-hop knowledge graph, inspect full entity details, and grow the graph like a family tree with multi-hop expand.

**Live demo:** [https://ontara.onrender.com](https://ontara.onrender.com)  
**Repo:** [github.com/moktarul12/ontara](https://github.com/moktarul12/ontara)

Toggle **Wikidata** / **DBpedia** in the header.

---

## Demo walkthrough

### 1. Search a person
1. Open the app (local or deployed URL).
2. Set **Class** → `Person`.
3. Set **Value** → `Albert Einstein` (or `Marie Curie`).
4. Pick a result from the dropdown.
5. You get a star graph of related entities plus the **Data** panel (abstract, properties, classes).

### 2. Search cities within a country
1. Search **Class** `All` / **Value** `India` and open India.
2. Enable **Within selected: India**.
3. Set **Class** → `City`.
4. Leave value empty and **Search**, or type `Mumbai`.
5. Open a city to load its knowledge graph.

### 3. Expand hops (family-tree style)
1. With a node focused (e.g. Einstein).
2. Use the **Expand hops** bar (top-right):
   - Depth: `1` / `2` / `3`
   - Direction: `Out →` / `← In` / `Both`
3. Click **Grow tree** — connected nodes and edges appear on the graph.

### 4. Drag & explore
- Nodes settle and stay put after layout.
- Drag a node to reposition; it stays where you drop it.
- Click a neighbor to open *that* entity’s full knowledge graph.
- Use **Relations → Expand** for a single predicate, or hops for breadth.

### Quick chips on empty screen
`Albert Einstein` · `Paris` · `India` · `Marie Curie`

---

## Features

| Area | What you get |
|------|----------------|
| Search | Class → Value cascade; Person / City / Place / Organisation scopes |
| Context search | Search within the selected node (e.g. cities in India) |
| Knowledge graph | 1-hop star with labeled edges on open |
| Hops | 1–3 hops, in / out / both |
| Details | Abstract, classes, literal data properties |
| Graph UX | Stable layout, smooth pin-on-drag, zoom / pan |
| Production | Express serves `dist` + `/sparql` proxy (DBpedia CORS-safe) |

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

## Deploy on Render

Config is in [`render.yaml`](render.yaml).

### Option A — Blueprint
1. Push this repo to GitHub (already: `moktarul12/ontara`).
2. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint** → select the repo.
3. Apply → wait for the first deploy.

### Option B — Web Service (manual)
| Setting | Value |
|--------|--------|
| Runtime | Node |
| Build | `npm install && npm run build` |
| Start | `npm start` |
| Health check | `/health` |
| Env | `NODE_VERSION=22`, `SPARQL_UPSTREAM=https://dbpedia.org/sparql` |

Connect the GitHub repo in Render (authorize private repos if needed). After deploy, open `https://<service-name>.onrender.com`.

> Free tier sleeps when idle; the first hit after sleep can take ~30–60s.

---

## Stack

- React + TypeScript + Vite
- `react-force-graph-2d`
- Express (`server.mjs`) for static hosting + SPARQL proxy
- DBpedia SPARQL by default

---

## Project layout

```
src/
  components/   GraphSearch, KnowledgeGraph, HopControls, ExplorePanel…
  hooks/        useOntologyStore
  services/     sparql.ts
server.mjs      production server + /sparql proxy
render.yaml     Render Blueprint
```
