import type { GuardianResultSource } from '../hooks/useGuardian'
import type { VerificationCheck, VerificationResults } from '../types/guardian'
import { Badge } from './ui/Badge'
import { Card } from './ui/Card'
import { StatusBadge } from './ui/StatusBadge'

export interface VerificationPanelProps { checks: VerificationResults; source: GuardianResultSource }

const verificationOrder = ['check_recipient_profile', 'check_transaction_history', 'detect_scam_patterns', 'verify_identity_claim', 'check_recipient_reputation', 'check_transaction_velocity'] as const
const knownVerificationKeys = new Set<string>(verificationOrder)

function statusProps(check: VerificationCheck) {
  const unavailable = check.details.error === 'TOOL_UNAVAILABLE' || check.details.error === 'UNKNOWN_TOOL'
  if (unavailable) return { label: 'Unable to verify', status: 'warning' as const, unavailable: true }
  if (check.status === 'PASSED') return { label: 'No issue found', status: 'secure' as const, unavailable: false }
  if (check.status === 'ANOMALOUS') return { label: 'Attention', status: 'hold' as const, unavailable: false }
  return { label: 'Evidence found', status: 'danger' as const, unavailable: false }
}

function humanize(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }

function displayDetails(check: VerificationCheck) {
  return Object.entries(check.details).flatMap(([name, value]) => {
    if (value === null || value === undefined || name === 'detected_patterns' || name === 'vector_match') return []
    if (['string', 'number', 'boolean'].includes(typeof value)) return [[name, String(value)] as const]
    if (Array.isArray(value) && value.every((item) => ['string', 'number', 'boolean'].includes(typeof item))) return [[name, value.join(', ')] as const]
    return []
  })
}

export function VerificationPanel({ checks, source }: VerificationPanelProps) {
  const knownChecks = verificationOrder.flatMap((key) => checks[key] ? [{ check: checks[key] as VerificationCheck, key }] : [])
  const additionalChecks = Object.entries(checks).flatMap(([key, check]) => check && !knownVerificationKeys.has(key) ? [{ check, key }] : [])
  const returnedChecks = [...knownChecks, ...additionalChecks]
  const unavailableCount = returnedChecks.filter(({ check }) => statusProps(check).unavailable).length
  const hasAttention = returnedChecks.some(({ check }) => check.status !== 'PASSED')
  const heading = !returnedChecks.length ? 'Verification incomplete' : hasAttention ? 'Verification needs attention' : 'Verification complete'

  return (
    <Card className="guardian-panel verification-card" id="guardian-verification">
      <div className="guardian-panel__header">
        <div><p className="guardian-panel__eyebrow">Agent verification tools</p><h2 className="guardian-panel__title">{heading}</h2></div>
        <Badge tone={!returnedChecks.length ? 'neutral' : hasAttention ? 'hold' : 'success'}>{source === 'mock' ? 'Demo result' : `${returnedChecks.length} backend checks`}</Badge>
      </div>
      <p className="verification-card__intro">Only tools actually returned by Guardian are shown. A dependency failure is displayed as uncertainty, never as a successful verification.</p>
      {unavailableCount ? <p className="verification-card__warning" role="status">⚠ {unavailableCount} check{unavailableCount === 1 ? ' was' : 's were'} unable to verify. Guardian added friction rather than treating the missing evidence as safe.</p> : null}
      {returnedChecks.length ? (
        <ul className="verification-list">
          {returnedChecks.map(({ check, key }) => {
            const status = statusProps(check)
            const details = displayDetails(check)
            return (
              <li className={check.status === 'PASSED' ? 'verification-item' : 'verification-item verification-item--attention'} key={key}>
                <StatusBadge label={status.label} status={status.status} />
                <div><h3>{check.check_name}</h3><p>{check.summary}</p>
                  {details.length ? <details className="verification-details"><summary>Evidence returned by this check</summary><dl>{details.map(([name, value]) => <div key={name}><dt>{humanize(name)}</dt><dd>{value}</dd></div>)}</dl></details> : null}
                </div>
              </li>
            )
          })}
        </ul>
      ) : <p className="guardian-panel__empty">No verification checks were returned for this analysis.</p>}
      <p className="guardian-panel__footnote">{source === 'mock' ? 'Verification statuses are deterministic demo data.' : 'These are Guardian tool results; they do not claim external identity verification unless explicitly stated.'}</p>
    </Card>
  )
}
