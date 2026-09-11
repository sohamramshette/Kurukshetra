import type { GuardianAnalysisResult, GuardianDecision } from '../types/guardian'
import type { GuardianResultSource } from '../hooks/useGuardian'
import type { PaymentDraft } from '../types/payment'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { StatusBadge } from './ui/StatusBadge'
import { RiskBadge } from './RiskBadge'

export interface GuardianAlertProps {
  payment: PaymentDraft
  result: GuardianAnalysisResult
  source: GuardianResultSource
  onReviewVerification: () => void
}

const decisionTitles: Record<GuardianDecision, string> = {
  ALLOW: 'Payment cleared for processing',
  WARN: 'PAYMENT WARNING',
  STEP_UP: 'VERIFICATION REQUIRED',
  HOLD: 'PAYMENT HELD',
  BLOCK: 'PAYMENT BLOCKED',
}

function formatAmount(amount: string) {
  const numericAmount = Number(amount.replace(/,/g, ''))
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) return '₹—'

  return new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(numericAmount)
}

export function GuardianAlert({ onReviewVerification, payment, result, source }: GuardianAlertProps) {
  const requiresIntervention = result.decision !== 'ALLOW'
  const isBlocked = result.decision === 'BLOCK'
  const isMock = source === 'mock'

  return (
    <Card className={requiresIntervention ? 'guardian-alert guardian-alert--held' : 'guardian-alert guardian-alert--safe'} elevated>
      <div className="guardian-alert__topline">
        <div className="guardian-alert__label">
          <span aria-hidden="true" className="guardian-alert__mark">✦</span>
          <span>Payment Guardian Alert</span>
        </div>
        <Badge tone={isMock ? 'neutral' : 'success'}>{isMock ? 'Demo mode' : 'Live backend result'}</Badge>
      </div>
      <div className="guardian-alert__body">
        <div className="guardian-alert__copy">
          <p className="guardian-alert__eyebrow">{requiresIntervention ? 'Protective review required' : 'Guardian review complete'}</p>
          <h1 className="guardian-alert__title">{decisionTitles[result.decision]}</h1>
          <p className="guardian-alert__message">
            {requiresIntervention ? 'Payment Guardian applied a protective decision before processing. ' : ''}
            {result.explanation}
          </p>
          <p className="guardian-alert__disclaimer">
            {isMock ? 'This is a deterministic frontend demo. No payment was sent or live service queried.' : 'No payment was sent by this frontend. Review the backend decision before taking any action.'}
          </p>
          <Button onClick={onReviewVerification} size="md" variant={requiresIntervention ? 'primary' : 'secondary'}>
            {requiresIntervention ? 'Review verification' : 'View Guardian checks'}
          </Button>
        </div>
        <div className="guardian-alert__risk">
          <RiskBadge level={result.risk_level} score={result.risk_score} />
        </div>
      </div>
      <dl className="guardian-alert__details">
        <div>
          <dt>Risk status</dt>
          <dd><StatusBadge label={requiresIntervention ? decisionTitles[result.decision] : result.decision} status={isBlocked ? 'danger' : requiresIntervention ? 'hold' : 'secure'} /></dd>
        </div>
        <div>
          <dt>Amount</dt>
          <dd>{formatAmount(payment.amount)}</dd>
        </div>
        <div>
          <dt>Recipient</dt>
          <dd>{payment.recipient}</dd>
        </div>
        <div>
          <dt>Reason</dt>
          <dd>{payment.reason}</dd>
        </div>
        <div>
          <dt>Reference</dt>
          <dd>{result.transaction_id}</dd>
        </div>
      </dl>
    </Card>
  )
}
