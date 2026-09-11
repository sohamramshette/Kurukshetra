import type { GuardianResultSource } from '../hooks/useGuardian'
import type { GuardianVerificationStatus, VerificationCheck, VerificationResults } from '../types/guardian'
import { Badge } from './ui/Badge'
import { Card } from './ui/Card'
import { StatusBadge } from './ui/StatusBadge'

export interface VerificationPanelProps {
  checks: VerificationResults
  source: GuardianResultSource
}

const verificationOrder = [
  'check_recipient_profile',
  'check_transaction_history',
  'detect_scam_patterns',
  'verify_identity_claim',
  'check_recipient_reputation',
  'check_transaction_velocity',
] as const

const knownVerificationKeys = new Set<string>(verificationOrder)

function statusProps(status: GuardianVerificationStatus) {
  if (status === 'PASSED') return { label: 'Passed', status: 'secure' as const }
  if (status === 'ANOMALOUS') return { label: 'Anomalous', status: 'hold' as const }
  return { label: 'Failed', status: 'danger' as const }
}

function primitiveDetails(check: VerificationCheck) {
  return Object.entries(check.details).filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value)).slice(0, 3)
}

export function VerificationPanel({ checks, source }: VerificationPanelProps) {
  const isMock = source === 'mock'
  const knownChecks = verificationOrder.flatMap((key) => {
    const check = checks[key]
    return check ? [{ check, key }] : []
  })
  const additionalChecks = Object.entries(checks).flatMap(([key, check]) => (
    check && !knownVerificationKeys.has(key) ? [{ check, key }] : []
  ))
  const returnedChecks = [...knownChecks, ...additionalChecks]
  const hasChecks = returnedChecks.length > 0
  const hasAttention = returnedChecks.some(({ check }) => check.status !== 'PASSED')
  const heading = !hasChecks ? 'Verification incomplete' : hasAttention ? 'Verification needs attention' : 'Verification complete'

  return (
    <Card className="guardian-panel verification-card" id="guardian-verification">
      <div className="guardian-panel__header">
        <div>
          <p className="guardian-panel__eyebrow">Guardian verification</p>
          <h2 className="guardian-panel__title">{heading}</h2>
        </div>
        <Badge tone={!hasChecks ? 'neutral' : hasAttention ? 'hold' : 'success'}>{isMock ? 'Demo result' : 'Backend result'}</Badge>
      </div>
      <p className="verification-card__intro">
        {!hasChecks
          ? 'The Guardian backend returned no completed verification checks for this analysis.'
          : hasAttention
            ? 'The returned checks identify the context that should be independently verified before this payment proceeds.'
            : 'The returned checks found no verification issue requiring additional friction.'}
      </p>
      {hasChecks ? (
        <ul className="verification-list">
          {returnedChecks.map(({ check, key }) => {
            const status = statusProps(check.status)
            const details = primitiveDetails(check)
            return (
              <li className={check.status === 'PASSED' ? 'verification-item' : 'verification-item verification-item--attention'} key={key}>
                <StatusBadge label={status.label} status={status.status} />
                <div>
                  <h3>{check.check_name}</h3>
                  <p>{check.summary}</p>
                  {details.length > 0 ? (
                    <ul className="verification-item__details">
                      {details.map(([name, value]) => <li key={name}>{name}: {String(value)}</li>)}
                    </ul>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="guardian-panel__empty">No verification checks were returned for this analysis.</p>
      )}
      <p className="guardian-panel__footnote">
        {isMock ? 'Verification statuses are deterministic demo data.' : 'Only checks completed by the Guardian backend are shown.'}
      </p>
    </Card>
  )
}
