import { useState } from 'react'

import type { GuardianAnalysisResult, GuardianDecision } from '../types/guardian'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { StatusBadge } from './ui/StatusBadge'

export interface DecisionPanelProps {
  result: GuardianAnalysisResult
  actionMessage?: string
  onCancelPayment: () => void
  onProceedAnyway: () => void
  onVerifyRecipient: () => void
  onStartCoercionCheck?: () => void
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
  actionMessage,
  onBackToPayment,
  onCancelPayment,
  onProceedAnyway,
  onVerifyRecipient,
  onStartCoercionCheck,
  result,
}: DecisionPanelProps) {
  const [isConfirmingOverride, setIsConfirmingOverride] = useState(false)
  const requiresIntervention = result.decision !== 'ALLOW'
  const isBlocked = result.decision === 'BLOCK'

  if (!requiresIntervention) {
    return (
      <Card className="guardian-panel decision-card decision-card--safe">
        <div className="guardian-panel__header">
          <div>
            <p className="guardian-panel__eyebrow">Decision</p>
            <h2 className="guardian-panel__title">{decisionTitles[result.decision]}</h2>
          </div>
          <StatusBadge label={result.decision} status="secure" />
        </div>
        <p className="decision-card__copy">{result.explanation}</p>
        <div className="decision-card__recommendation">
          <span className="decision-card__recommendation-label">Recommended action</span>
          <strong>{result.recommended_action}</strong>
        </div>
        <p className="guardian-panel__footnote">The frontend does not process the payment. This result is a Guardian decision only.</p>
        <Button onClick={onBackToPayment} variant="secondary">Return to payment</Button>
      </Card>
    )
  }

  return (
    <Card className="guardian-panel decision-card decision-card--held" id="guardian-decision">
      <div className="guardian-panel__header">
        <div>
          <p className="guardian-panel__eyebrow">Protective action</p>
          <h2 className="guardian-panel__title">{decisionTitles[result.decision]}</h2>
        </div>
        <StatusBadge label={result.decision} status={isBlocked ? 'danger' : 'hold'} />
      </div>
      <div className="decision-card__score">
        <span>Risk score</span>
        <strong>{result.risk_score} / 100</strong>
      </div>
      <p className="decision-card__reason">{result.explanation}</p>
      <div className="decision-card__recommendation">
        <span className="decision-card__recommendation-label">Recommended action</span>
        <strong>{result.recommended_action}</strong>
        <span className="decision-card__recommendation-label">Intervention: {result.intervention.ui_mode} · {result.intervention.friction_level} friction</span>
        <span className="decision-card__recommendation-label">
          Cooling period: {result.intervention.cooling_period_seconds}s · explicit override required: {result.intervention.requires_explicit_override ? 'yes' : 'no'}
        </span>
      </div>
      <div className="decision-card__actions">
        {!isBlocked && onStartCoercionCheck && (
          <Button onClick={onStartCoercionCheck} variant="primary">
            🛡️ Safety Interview (Coercion Check)
          </Button>
        )}
        <Button onClick={onVerifyRecipient} variant={isBlocked ? 'primary' : 'secondary'}>
          {result.intervention.primary_button}
        </Button>
        <Button onClick={onCancelPayment} variant="ghost">Cancel Payment</Button>
        {result.intervention.requires_explicit_override && !isBlocked ? (
          <Button onClick={() => setIsConfirmingOverride(true)} variant="ghost">Proceed Anyway</Button>
        ) : null}
      </div>
      {isConfirmingOverride ? (
        <div className="decision-card__confirmation" role="alertdialog" aria-label="Confirm payment override">
          <strong>Confirm explicit override?</strong>
          <p>This frontend-only action does not send money or bypass a backend policy.</p>
          <div>
            <Button onClick={() => setIsConfirmingOverride(false)} size="sm" variant="ghost">Keep protection active</Button>
            <Button onClick={() => { setIsConfirmingOverride(false); onProceedAnyway() }} size="sm" variant="secondary">Confirm override</Button>
          </div>
        </div>
      ) : null}
      {actionMessage ? <p className="decision-card__demo-message" role="status">{actionMessage}</p> : null}
    </Card>
  )
}
