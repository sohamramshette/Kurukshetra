import type { GuardianResultSource } from '../hooks/useGuardian'
import type { GuardianTimelineEvent } from '../types/guardian'
import { Badge } from './ui/Badge'
import { Card } from './ui/Card'

export interface SecurityTimelineProps { events: GuardianTimelineEvent[]; source: GuardianResultSource }

function formatTime(timestamp: string) {
  const parsed = new Date(timestamp.endsWith('Z') || /[+-]\d\d:\d\d$/.test(timestamp) ? timestamp : `${timestamp}Z`)
  return Number.isNaN(parsed.getTime()) ? 'Time unavailable' : parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function SecurityTimeline({ events, source }: SecurityTimelineProps) {
  return (
    <Card className="guardian-panel timeline-card">
      <div className="guardian-panel__header"><div><p className="guardian-panel__eyebrow">Security timeline</p><h2 className="guardian-panel__title">Observe → Reason → Verify → Protect</h2></div><Badge tone={source === 'mock' ? 'neutral' : 'success'}>{events.length} recorded events</Badge></div>
      {events.length ? (
        <ol className="security-timeline">
          {events.map((event, index) => (
            <li className="timeline-item timeline-item--complete" key={`${event.timestamp}-${event.stage}-${index}`}>
              <span aria-hidden="true" className="timeline-item__marker">{index + 1}</span>
              <div className="timeline-item__content">
                <div className="timeline-item__heading"><h3>{event.stage}</h3><span className="timeline-item__state">{formatTime(event.timestamp)}</span></div>
                <p>{event.description}</p>
                {event.risk_snapshot !== null ? <div className="timeline-item__risk"><span>Recorded risk</span><div><span style={{ width: `${Math.max(2, event.risk_snapshot)}%` }} /></div><strong>{event.risk_snapshot}/100</strong></div> : <small className="timeline-item__no-risk">No risk snapshot was returned for this stage.</small>}
              </div>
            </li>
          ))}
        </ol>
      ) : <p className="guardian-panel__empty">No timeline events were returned for this analysis.</p>}
      <p className="guardian-panel__footnote">{source === 'mock' ? 'This is the deterministic demo sequence.' : 'Descriptions, timestamps, and score snapshots were returned by the backend. Missing values are not interpolated.'}</p>
    </Card>
  )
}
