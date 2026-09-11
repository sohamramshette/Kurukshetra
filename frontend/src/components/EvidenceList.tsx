import type { GuardianResultSource } from '../hooks/useGuardian'
import type { RiskSignal } from '../types/guardian'
import { Badge } from './ui/Badge'
import { Card } from './ui/Card'

export interface EvidenceListProps {
  signals: RiskSignal[]
  source: GuardianResultSource
}

function formatSignalType(type: string) {
  return type.toLowerCase().split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

function signalTone(severity: RiskSignal['severity']) {
  if (severity === 'CRITICAL') return 'danger' as const
  if (severity === 'HIGH') return 'hold' as const
  if (severity === 'MEDIUM') return 'warning' as const
  return 'success' as const
}

function isPrimary(signal: RiskSignal) {
  return /SCAM|INJECTION|URGENCY|AUTHORITY|MANIPULATION|RECIPIENT|AMOUNT|HANDLE|PIG_BUTCHERING/.test(signal.type)
}

function EvidenceGroup({ label, signals }: { label: string; signals: RiskSignal[] }) {
  if (!signals.length) return null
  return (
    <section className="evidence-group" aria-label={`${label} evidence`}>
      <div className="evidence-group__heading"><h3>{label}</h3><span>{signals.length} finding{signals.length === 1 ? '' : 's'}</span></div>
      <ul className="evidence-list">
        {signals.map((signal) => (
          <li className={`evidence-item evidence-item--${signal.severity.toLowerCase()}`} key={`${signal.type}-${signal.reason}`}>
            <span aria-hidden="true" className="evidence-item__marker" />
            <div className="evidence-item__content">
              <div className="evidence-item__heading"><h4>{formatSignalType(signal.type)}</h4><Badge tone={signalTone(signal.severity)}>{signal.severity}</Badge></div>
              <div className="evidence-causal-chain">
                <div><span>Signal</span><strong>{formatSignalType(signal.type)}</strong></div><span aria-hidden="true">↓</span>
                <div><span>Evidence</span><p>{signal.reason}</p></div><span aria-hidden="true">↓</span>
                <div><span>Impact</span><p>Detector weight {signal.score_delta > 0 ? '+' : ''}{signal.score_delta} at {Math.round(signal.confidence * 100)}% reported confidence. Correlated evidence may be bounded by the backend aggregate.</p></div>
              </div>
              {signal.reference_sample ? <details className="evidence-reference"><summary>Pattern reference used</summary><p>{signal.reference_sample}</p></details> : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function EvidenceList({ signals, source }: EvidenceListProps) {
  const primary = signals.filter(isPrimary)
  const secondary = signals.filter((signal) => !isPrimary(signal))
  return (
    <Card className="guardian-panel evidence-card">
      <div className="guardian-panel__header">
        <div><p className="guardian-panel__eyebrow">Multi-signal evidence</p><h2 className="guardian-panel__title">What changed Guardian's assessment</h2></div>
        <Badge tone={source === 'mock' ? 'neutral' : 'success'}>{source === 'mock' ? 'Demo signals' : 'Backend signals'}</Badge>
      </div>
      {signals.length ? <><EvidenceGroup label="Primary evidence" signals={primary} /><EvidenceGroup label="Supporting evidence" signals={secondary} /></> : (
        <div className="evidence-empty"><span aria-hidden="true" className="evidence-empty__marker">✓</span><div><h3>No significant Guardian signals</h3><p>Guardian found no meaningful indicators requiring intervention. This does not guarantee the payment is risk-free.</p></div></div>
      )}
      <p className="guardian-panel__footnote">{source === 'mock' ? 'Signals are deterministic demo data.' : 'Every finding, confidence value, and score contribution shown above was returned by the Guardian backend.'}</p>
    </Card>
  )
}
