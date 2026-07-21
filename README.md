# Ontara

Interactive React knowledge-graph studio for exploring ontologies via SPARQL (DBpedia by default).

## Run locally

```bash
npm install
npm run dev
```

Opens at [http://localhost:1901](http://localhost:1901).

Production-style (build + Express + SPARQL proxy):

```bash
npm run build
npm start
```

## Deploy on Render

1. Push this repo to GitHub.
2. In [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**, connect the repo (uses [`render.yaml`](render.yaml)), **or** create a **Web Service** manually:
   - **Build:** `npm install && npm run build`
   - **Start:** `npm start`
   - **Health check path:** `/health`
3. After deploy, open the Render URL and search (e.g. Albert Einstein).

The Node server serves the Vite `dist` folder and proxies `/sparql` → DBpedia (avoids browser CORS).

## Features

- Search-first knowledge graph (class + value)
- Expand hops (in / out / both)
- Force-directed graph with pinned drag
- Data properties panel
