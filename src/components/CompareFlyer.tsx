import { useMemo } from 'react'
import type { OntologyStore } from '../hooks/useOntologyStore'
import { useCompareCategory } from '../hooks/useCompareCategory'
import type { ComparePin } from './CompareView'
import { CompareSearchAdd, MAX_COMPARE } from './CompareSearchAdd'

interface Props {
  store: OntologyStore
  comparePins: ComparePin[]
  onAdd: (uri: string, label: string) => void
  onRemove: (uri: string) => void
  onClear: () => void
}

export function CompareFlyer({ store, comparePins, onAdd, onRemove, onClear }: Props) {
  const anchorUri = comparePins[0]?.uri
  const excludeUris = useMemo(() => comparePins.map((p) => p.uri), [comparePins])
  const { category, peers, loading } = useCompareCategory(
    store.config.endpoint,
    anchorUri,
    excludeUris,
  )

  const step =
    comparePins.length === 0
      ? 'Step 1 — pick any entity (this locks the category)'
      : comparePins.length < MAX_COMPARE
        ? category
          ? `Step 2 — add peers in “${category.label}”`
          : 'Step 2 — add one or two more in the same category'
        : 'Compare set full (3/3)'

  return (
    <section className="compare-flyer" aria-label="Build compare set">
      <div className="compare-flyer-head">
        <p className="facet-kicker">Compare builder</p>
        <p className="facet-hint">{step}</p>
        {category && comparePins.length > 0 && (
          <p className="compare-flyer-category">
            Locked category: <strong>{category.label}</strong>
            {loading && <span className="muted"> · refreshing peers…</span>}
          </p>
        )}
        {!category && comparePins.length > 0 && !loading && (
          <p className="compare-flyer-category muted">
            Category: detecting from Wikidata occupation / industry / type…
          </p>
        )}
      </div>

      {comparePins.length < MAX_COMPARE && (
        <CompareSearchAdd
          store={store}
          comparePins={comparePins}
          onAdd={onAdd}
          category={category}
          categoryPeers={peers}
          peersLoading={loading}
          compact
        />
      )}

      {comparePins.length > 0 && (
        <ul className="compare-flyer-pins">
          {comparePins.map((p, i) => (
            <li key={p.uri}>
              <span className="compare-flyer-pin-idx">{i + 1}</span>
              <span className="compare-flyer-pin-label">{p.label}</span>
              {i === 0 && category && (
                <span className="compare-flyer-pin-cat muted">{category.label}</span>
              )}
              <button type="button" className="linkish" onClick={() => onRemove(p.uri)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {comparePins.length >= 2 && (
        <p className="compare-flyer-tip muted">
          Side-by-side facts appear in the main Compare view.
        </p>
      )}

      {comparePins.length > 0 && (
        <button type="button" className="insight-cta ghost compact" onClick={onClear}>
          Clear compare set
        </button>
      )}
    </section>
  )
}
