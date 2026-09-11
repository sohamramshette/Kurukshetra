import type { GuardianResultSource } from '../hooks/useGuardian'
import type { GuardianTimelineEvent } from '../types/guardian'
import { Badge } from './ui/Badge'
import { Card } from './ui/Card'

export interface SecurityTimelineProps {
  events: GuardianTimelineEvent[]
  source: GuardianResultSource
}

export function SecurityTimeline({ events, source }: SecurityTimelineProps) {
  const isMock = source === 'mock'

  return (
    <Card className="guardian-panel timeline-card">
      <div className="guardian-panel__header">
        <div>
          <p className="guardian-panel__eyebrow">Audit trail</p>
          <h2 className="guardian-panel__title">Guardian security timeline</h2>
        </div>
        <Badge tone={isMock ? 'neutral' : 'success'}>Observe → Act</Badge>
      </div>
      {events.length > 0 ? (
        <ol className="security-timeline">
          {events.map((event, index) => {
            const isCurrent = index === events.length - 1
            return (
              <li className={isCurrent ? 'timeline-item timeline-item--current' : 'timeline-item timeline-item--complete'} key={`${event.timestamp}-${event.stage}`}>
                <span aria-hidden="true" className="timeline-item__marker">{index + 1}</span>
                <div className="timeline-item__content">
                  <div className="timeline-item__heading">
                    <h3>{event.stage}</h3>
                    <span className="timeline-item__state">{isCurrent ? 'Current' : 'Complete'}</span>
                  </div>
                  <p>{event.description}</p>
                </div>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="guardian-panel__empty">No timeline events were returned for this analysis.</p>
      )}
      <p className="guardian-panel__footnote">
        {isMock ? 'The sequence represents the deterministic demo workflow.' : 'The sequence was returned by the Guardian backend.'}
      </p>
    </Card>
  )
}
