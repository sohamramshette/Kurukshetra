import { useEffect, useState } from 'react'

import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { StatusBadge } from './ui/StatusBadge'
import { canConfirmResult, type GuardianAction } from '../hooks/useGuardian'
import type { GuardianAnalysisResult, GuardianDecision } from '../types/guardian'

export interface DecisionPanelProps {
  result: GuardianAnalysisResult
  actionMessage?: string | null
  actionError?: string | null
  pendingAction?: GuardianAction | null
  onConfirmPayment: () => void
  onCancelPayment: () => void
  onVerifyRecipient: () => void
  onStartCoercionCheck?: () => void
  onProceedAnyway?: () => void
  onBackToPayment: () => void
}

const decisionTitles: Record<GuardianDecision, string> = {
  ALLOW: 'Payment cleared for processing',
  WARN: 'PAYMENT WARNING',
  STEP_UP: 'VERIFICATION REQUIRED',
  HOLD: 'PAYMENT HELD',
  BLOCK: 'PAYMENT BLOCKED',
}

export function DecisionPanel({
  actionError,
  actionMessage,
  onBackToPayment,
  onCancelPayment,
  onConfirmPayment,
  onVerifyRecipient,
  onStartCoercionCheck,
  onProceedAnyway,
  pendingAction = null,
  result,
}: DecisionPanelProps) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!result.lifecycle?.cooling_ends_at) return undefined
    const interval = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(interval)
  }, [result.lifecycle?.cooling_ends_at])
  const requiresIntervention = result.decision !== 'ALLOW'
  const isBlocked = result.decision === 'BLOCK'
  const isHeld = result.decision === 'HOLD'
  const requiresGuidance = result.lifecycle.requires_independent_guidance_acknowledgement
  const confirmAllowed = canConfirmResult(result, now)
  const isConfirming = pendingAction === 'confirm'
  const isCancelling = pendingAction === 'cancel'
  const isActionPending = pendingAction !== null
  const coolingActive = result.lifecycle.status === 'STEP_UP_ACKNOWLEDGED' && result.lifecycle.cooling_ends_at && new Date(result.lifecycle.cooling_ends_at).getTime() > now

  if (!requiresIntervention) {
    return (
      <Card className="guardian-panel decision-card decision-card--safe">
        <div className="guardian-panel__header"><div><p className="guardian-panel__eyebrow">Guardian decision</p><h2 className="guardian-panel__title">{decisionTitles[result.decision]}</h2></div><StatusBadge label={result.decision} status="secure" /></div>
        <p className="decision-card__copy">{result.explanation}</p>
        <div className="decision-card__recommendation"><span className="decision-card__recommendation-label">Recommended action</span><strong>{result.recommended_action}</strong></div>
        <div className="decision-card__actions">
          <Button disabled={isActionPending} loading={isConfirming} onClick={onConfirmPayment} variant="primary">{isConfirming ? 'Confirming with Guardian' : 'Continue to Payment'}</Button>
          <Button disabled={isActionPending} loading={isCancelling} onClick={onCancelPayment} variant="ghost">Cancel Payment</Button>
        </div>
        <p className="guardian-panel__footnote">Nothing is sent until you explicitly choose Continue. The backend, not this frontend, records the simulated completion.</p>
        {actionError ? <p className="decision-card__action-error" role="alert">{actionError}</p> : null}
        {actionMessage ? <p className="decision-card__demo-message" role="status">{actionMessage}</p> : null}
        <Button disabled={isActionPending} onClick={onBackToPayment} size="sm" variant="ghost">Return to payment</Button>
      </Card>
    )
  }

  return (
    <Card className="guardian-panel decision-card decision-card--held" id="guardian-decision">
      <div className="guardian-panel__header"><div><p className="guardian-panel__eyebrow">Protective action</p><h2 className="guardian-panel__title">{decisionTitles[result.decision]}</h2></div><StatusBadge label={result.decision} status={isBlocked ? 'danger' : 'hold'} /></div>
      <div className="decision-card__score"><span>Risk score</span><strong>{result.risk_score} / 100</strong></div>
      <p className="decision-card__reason">{result.explanation}</p>
      <div className="decision-card__recommendation">
        <span className="decision-card__recommendation-label">Recommended action</span><strong>{result.recommended_action}</strong>
        <span className="decision-card__recommendation-label">Intervention: {result.intervention.ui_mode} · {result.intervention.friction_level} friction</span>
        <span className="decision-card__recommendation-label">Lifecycle: {result.lifecycle.status.replaceAll('_', ' ')}</span>
      </div>
      <div className="decision-card__actions">
        {!isBlocked && onStartCoercionCheck && (
          <Button onClick={onStartCoercionCheck} variant="primary">
            🛡️ Safety Interview (Coercion Check)
          </Button>
        )}
        {(requiresGuidance || !result.lifecycle?.independent_guidance_acknowledged) && !isBlocked ? (
          <Button disabled={isActionPending} onClick={onVerifyRecipient} variant={onStartCoercionCheck ? 'secondary' : 'primary'}>
            {result.intervention.primary_button}
          </Button>
        ) : null}
        {confirmAllowed ? (
          <Button disabled={isActionPending} loading={isConfirming} onClick={onConfirmPayment} variant="secondary">
            {isConfirming ? 'Confirming with Guardian' : 'Continue to Payment'}
          </Button>
        ) : null}
        <Button disabled={isActionPending} loading={isCancelling} onClick={onCancelPayment} variant="ghost">
          {isCancelling ? 'Cancelling payment' : 'Cancel Payment'}
        </Button>
        {onProceedAnyway && !isBlocked && (
          <Button disabled={isActionPending} onClick={onProceedAnyway} variant="ghost">
            Proceed Anyway
          </Button>
        )}
      </div>
      {isBlocked ? <p className="decision-card__policy-note">Guardian blocked this payment. Confirmation is rejected by backend policy, so no bypass or override is available.</p> : null}
      {isHeld ? <p className="decision-card__policy-note">Guardian is holding this payment. You may record independent-contact guidance or cancel, but the backend will not confirm a held payment.</p> : null}
      {requiresGuidance && !isHeld ? <p className="decision-card__policy-note">Record the independent-contact guidance acknowledgement before Guardian can consider any confirmation request.</p> : null}
      {coolingActive ? <p className="decision-card__policy-note">The backend cooling period remains active. Confirmation will stay unavailable until it expires.</p> : null}
      {actionError ? <p className="decision-card__action-error" role="alert">{actionError}</p> : null}
      {actionMessage ? <p className="decision-card__demo-message" role="status">{actionMessage}</p> : null}
    </Card>
  )
}
