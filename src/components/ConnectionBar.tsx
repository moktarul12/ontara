import { useState, type FormEvent } from 'react'
import { DEFAULT_CONFIG, OWL_THING } from '../types/ontology'

interface Props {
  endpoint: string
  loading: boolean
  onChangeEndpoint: (endpoint: string) => void
  onBrowseClasses: () => void
  onClear: () => void
  hasGraph: boolean
}

export function ConnectionBar({
  endpoint,
  loading,
  onChangeEndpoint,
  onBrowseClasses,
  onClear,
  hasGraph,
}: Props) {
  const [advanced, setAdvanced] = useState(false)

  const handleEndpoint = (e: FormEvent) => {
    e.preventDefault()
    setAdvanced(false)
  }

  return (
    <header className="topbar slim">
      <div className="brand">
        <span className="brand-mark" aria-hidden />
        <div>
          <h1 className="brand-name">Ontara</h1>
          <p className="brand-tag">Knowledge Graph Studio</p>
        </div>
      </div>

      <div className="header-actions">
        <button
          type="button"
          className="ghost"
          disabled={loading}
          onClick={onBrowseClasses}
          title={`Load ${OWL_THING} class backbone`}
        >
          Browse classes
        </button>
        {hasGraph && (
          <button type="button" className="ghost" disabled={loading} onClick={onClear}>
            New search
          </button>
        )}
        <button type="button" className="ghost" onClick={() => setAdvanced((v) => !v)}>
          {advanced ? 'Hide endpoint' : 'Endpoint'}
        </button>
      </div>

      {advanced && (
        <form className="endpoint-form" onSubmit={handleEndpoint}>
          <label className="field grow full">
            <span>SPARQL endpoint</span>
            <input
              value={endpoint}
              onChange={(e) => onChangeEndpoint(e.target.value)}
              placeholder={DEFAULT_CONFIG.endpoint}
              spellCheck={false}
            />
          </label>
        </form>
      )}
    </header>
  )
}
