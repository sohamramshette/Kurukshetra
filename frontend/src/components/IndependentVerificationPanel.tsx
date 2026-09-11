import { useState } from 'react'

import type { GuardianAction, GuardianResultSource } from '../hooks/useGuardian'
import type { GuardianLifecycle } from '../types/guardian'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { StatusBadge } from './ui/StatusBadge'

const guidance = [
  'I will use the organization’s official website or app, not a link in this payment request.',
  'I will contact the organization through an independently found official number or trusted channel.',
  'I understand that Guardian has not externally verified this recipient or request.',
]

export interface IndependentVerificationPanelProps {
  lifecycle: GuardianLifecycle
  source: GuardianResultSource
  pendingAction?: GuardianAction | null
  onAcknowledge: () => void
}

export function IndependentVerificationPanel({ lifecycle, onAcknowledge, pendingAction = null, source }: IndependentVerificationPanelProps) {
  const [checked, setChecked] = useState<boolean[]>(() => guidance.map(() => false))
  const isMock = source === 'mock'
  const acknowledged = lifecycle.independent_guidance_acknowledged
  const canAcknowledge = lifecycle.requires_independent_guidance_acknowledgement && checked.every(Boolean)
  const isPending = pendingAction === 'acknowledge_guidance'

  return (
    <Card className="guardian-panel independent-verification" id="independent-verification">
      <div className="guardian-panel__header">
        <div>
          <p className="guardian-panel__eyebrow">Independent verification guidance</p>
          <h2 className="guardian-panel__title">Verify outside this payment request</h2>
        </div>
        <StatusBadge label={acknowledged ? 'Acknowledged' : 'Guidance required'} status={acknowledged ? 'secure' : 'hold'} />
      </div>
      <p className="verification-card__intro">
        Do not use a phone number, link, QR code, or contact detail included in the payment request. These are protective steps for you to take independently; they are not an external identity verification performed by Guardian.
      </p>
      <ul className="independent-verification__list">
        {guidance.map((item, index) => (
          <li key={item}>
            <label>
              <input
                checked={acknowledged || checked[index]}
                disabled={acknowledged || isPending}
                onChange={(event) => setChecked((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.checked : value))}
                type="checkbox"
              />
              <span>{item}</span>
            </label>
          </li>
        ))}
      </ul>
      {lifecycle.cooling_ends_at ? <p className="independent-verification__cooling">Guardian cooling period ends at {new Date(lifecycle.cooling_ends_at).toLocaleTimeString()}.</p> : null}
      {lifecycle.requires_independent_guidance_acknowledgement ? (
        <Button disabled={!canAcknowledge} loading={isPending} onClick={onAcknowledge} variant="secondary">
          {isPending ? 'Recording acknowledgement' : 'Record guidance acknowledgement'}
        </Button>
      ) : acknowledged ? (
        <p className="guardian-panel__footnote">Your acknowledgement is recorded. {lifecycle.status === 'HELD' ? 'The payment remains held by Guardian policy.' : 'Guardian still enforces any remaining policy before confirmation.'}</p>
      ) : null}
      <p className="guardian-panel__footnote">{isMock ? 'Demo mode records a local acknowledgement only.' : 'The acknowledgement is recorded by the backend as your attestation, not as proof that the recipient was verified.'}</p>
    </Card>
  )
}
