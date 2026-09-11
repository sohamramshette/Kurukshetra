import type { GuardianResultSource } from '../hooks/useGuardian'
import type { RiskSignal } from '../types/guardian'
import { Badge } from './ui/Badge'
import { Card } from './ui/Card'

export interface EvidenceListProps {
  signals: RiskSignal[]
  source: GuardianResultSource
}

function formatSignalType(type: string) {
  return type
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function signalTone(severity: RiskSignal['severity']) {
  if (severity === 'CRITICAL') return 'danger' as const
  if (severity === 'HIGH') return 'hold' as const
  if (severity === 'MEDIUM') return 'warning' as const
  return 'success' as const
}

export function EvidenceList({ signals, source }: EvidenceListProps) {
  const isMock = source === 'mock'

  return (
    <Card className="guardian-panel evidence-card">
      <div className="guardian-panel__header">
        <div>
          <p className="guardian-panel__eyebrow">Why it was flagged</p>
          <h2 className="guardian-panel__title">Guardian signals</h2>
        </div>
        <Badge tone={isMock ? 'neutral' : 'success'}>{isMock ? 'Demo signals' : 'Backend signals'}</Badge>
      </div>

      {signals.length > 0 ? (
        <ul className="evidence-list">
          {signals.map((signal) => (
            <li className={`evidence-item evidence-item--${signal.severity.toLowerCase()}`} key={`${signal.type}-${signal.reason}`}>
              <span aria-hidden="true" className="evidence-item__marker" />
              <div className="evidence-item__content">
                <div className="evidence-item__heading">
                  <h3>{formatSignalType(signal.type)}</h3>
                  <Badge tone={signalTone(signal.severity)}>{signal.severity}</Badge>
                </div>
                <p>{signal.reason}</p>
                <p className="guardian-signal-meta">
                  {Math.round(signal.confidence * 100)}% confidence · score delta {signal.score_delta > 0 ? '+' : ''}{signal.score_delta}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="evidence-empty">
          <span aria-hidden="true" className="evidence-empty__marker">✓</span>
          <div>
            <h3>No significant Guardian signals</h3>
            <p>Guardian found no meaningful risk indicators in this payment analysis.</p>
          </div>
        </div>
      )}
      <p className="guardian-panel__footnote">
        {isMock ? 'Signals are deterministic demo data.' : 'Signals were returned by the Guardian backend analysis.'}
      </p>
    </Card>
  )
}
