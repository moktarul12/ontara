import type { GuidedJourney, GuidedJourneyTab } from '../types/ontology'
import { GUIDED_JOURNEYS } from '../types/ontology'

export type JourneyLaunchOptions = {
  journey: GuidedJourney
  defaultTab?: GuidedJourneyTab
  postOpen?: 'applyHops2' | 'pathMode'
  pathTargetUri?: string
}

interface Props {
  compact?: boolean
  onLaunch: (opts: JourneyLaunchOptions) => void
}

export function GuidedJourneys({ compact = false, onLaunch }: Props) {
  const journeys = compact ? GUIDED_JOURNEYS.slice(0, 4) : GUIDED_JOURNEYS

  return (
    <div className={`guided-journeys ${compact ? 'compact' : ''}`}>
      {!compact && <h2 className="guided-journeys-h">Start a journey</h2>}
      <div className="guided-journeys-grid">
        {journeys.map((j) => (
          <button
            key={j.id}
            type="button"
            className="phase-card journey-card"
            onClick={() =>
              onLaunch({
                journey: j,
                defaultTab: j.defaultTab,
                postOpen: j.postOpen,
                pathTargetUri: j.pathTargetUri,
              })
            }
          >
            <strong>{j.title}</strong>
            <p>{j.blurb}</p>
            <em>{j.seedLabel}</em>
          </button>
        ))}
      </div>
    </div>
  )
}

export { GUIDED_JOURNEYS }
