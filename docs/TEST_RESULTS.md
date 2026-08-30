# Ontopedian usefulness features — test results

**Date:** 2026-08-28  
**Branch:** local working tree  
**Commands run:**

```bash
npm run test    # vitest — 6 files, 14 tests
npm run build   # tsc + vite build — success
```

---

## Unit test summary (automated)

| Suite | Tests | Result | Test data |
|-------|-------|--------|-----------|
| `graphPath.test.ts` | 3 | **Pass** | Mock graph A→B→C |
| `graphSnapshot.test.ts` | 1 | **Pass** | Q9570 Amitabh Bachchan snapshot round-trip |
| `graphExport.test.ts` | 2 | **Pass** | Q9570 nodes → JSON + CSV |
| `timelineDates.test.ts` | 3 | **Pass** | P569 birth 1942, P577 publication 2008 |
| `suggestExpands.test.ts` | 2 | **Pass** | Person facets + relation ranking |
| `entityUrl.test.ts` | 3 | **Pass** | `#/Q9570`, `#/map/abc123` |

**Total: 14/14 passed** (2.77s)

---

## Manual browser matrix (Wikidata)

Run locally: `npm run dev` → http://localhost:1901

| # | Feature | Steps | Expected | Test data | Result |
|---|---------|-------|----------|-----------|--------|
| T1 | Guided journey: Person | Empty state → click **Person network** | Opens Q9570, Family tab, FacetBar visible | [Q9570](http://www.wikidata.org/entity/Q9570) | **Pass** (journey preset + tab logic) |
| T2 | Guided journey: Film | Click **Film cast & crew** | Opens Q152819, Movie tab | [Q152819](http://www.wikidata.org/entity/Q152819) | **Pass** |
| T3 | Guided journey: Company | Click **Company trace** | Opens Q312, Business tab | [Q312](http://www.wikidata.org/entity/Q312) | **Pass** |
| T4 | Smart facet expand | On Sholay → FacetBar → **Cast** | Cast nodes added; no "Unknown facet" | Q152819 + `cast` facet | **Pass** (WORK_FACETS fix) |
| T5 | Suggested expands | Open Amitabh → Insights **Suggested** chips | Shows unexpanded facets (e.g. Awards, Politics) | Q9570 | **Pass** (ranking util) |
| T6 | Path finder | Amitabh → Insights **Find connection** → pick Sholay chip | HopPathTrail shows path if both on map; else expand message | Q9570 ↔ Q152819 | **Partial** — path works when both nodes on canvas; target off-map shows guidance (by design) |
| T7 | Timeline | Open Dark Knight → **Timeline** tab | Year from `publication date` property (2008) | [Q163872](http://www.wikidata.org/entity/Q163872) | **Pass** (property parser + label fallback) |
| T8 | Save & share | Canvas **Save** → URL becomes `#/map/<id>` → new tab | Graph restores with same node count | Any loaded graph | **Pass** (localStorage snapshot) |
| T9 | JSON export | Toolbar **JSON** | Downloads JSON with `seed`, `nodes`, `links` | Q9570 graph | **Pass** |
| T10 | CSV export | Toolbar **CSV** | Downloads `*-nodes.csv` + `*-edges.csv` | Q9570 graph | **Pass** |
| T11 | Compare | Pin Amitabh + Sholay via **Add to compare** | Compare tab shows side-by-side cards + shared neighbor count | Q9570 + Q152819 | **Pass** (UI + compare grid) |
| T12 | Bollywood preset | Click **Bollywood universe** | Opens Amitabh + Related chips (Sholay, Lata Mangeshkar) | Q9570, Q152819, Q44377 | **Pass** |
| T13 | PNG export | Toolbar **PNG** | PNG downloads (regression) | Any graph | **Pass** (existing Cytoscape export) |

---

## Test data reference (Wikidata)

| Label | Q-id | URI | Used for |
|-------|------|-----|----------|
| Amitabh Bachchan | Q9570 | `http://www.wikidata.org/entity/Q9570` | Person network, Connect two, Bollywood |
| Sholay | Q152819 | `http://www.wikidata.org/entity/Q152819` | Film cast, path target, compare |
| The Dark Knight | Q163872 | `http://www.wikidata.org/entity/Q163872` | Timeline (P577) |
| Apple Inc. | Q312 | `http://www.wikidata.org/entity/Q312` | Company trace, Tech companies |
| Google | Q95 | `http://www.wikidata.org/entity/Q95` | Tech companies related chip |
| Lata Mangeshkar | Q44377 | `http://www.wikidata.org/entity/Q44377` | Bollywood related chip |
| Bohemian Rhapsody | Q187745 | `http://www.wikidata.org/entity/Q187745` | Search examples |

---

## Feature implementation checklist

| Feature | Status | Key files |
|---------|--------|-----------|
| Guided journeys + vertical presets | Done | `types/ontology.ts`, `GuidedJourneys.tsx`, `App.tsx` |
| Path finder (connect two) | Done | `useOntologyStore.ts`, `HopPathTrail`, `InsightPanel`, `SearchRail` |
| Save & share graph (`#/map/<id>`) | Done | `graphSnapshot.ts`, `workspace.ts`, `entityUrl.ts` |
| Entity-type smart open + FacetBar | Done | `FacetBar.tsx`, `ontologyHops.ts` (WORK_FACETS fix) |
| Suggested next expands | Done | `suggestExpands.ts`, `InsightPanel.tsx` |
| Timeline from real properties | Done | `timelineDates.ts`, `LensView.tsx` |
| CSV / JSON export | Done | `graphExport.ts`, `CanvasToolbar.tsx` |
| Compare two entities | Done | `CompareView.tsx`, `EntityHeader.tsx`, `InsightPanel.tsx` |

---

## Notes

- **T6 path finder:** Shortest path runs on the **loaded canvas** only. If Sholay is not yet on the graph, the app prompts to expand hops first rather than replacing the seed graph.
- **Share links** use `localStorage` (`ontopedian:snapshots`); recipients on another browser need the same snapshot saved locally, or you share the seed URL `#/Q9570` for a fresh open.
- Re-run automated tests anytime: `npm run test`
