import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { PageContainer } from './ui/PageContainer'
import { StatusBadge } from './ui/StatusBadge'
import type { GuardianResultSource } from '../hooks/useGuardian'
import type { GuardianAnalysisResult } from '../types/guardian'
import type { PaymentDraft } from '../types/payment'

export interface PaymentOutcomeProps {
  outcome: 'completed' | 'cancelled'
  payment: PaymentDraft
  result: GuardianAnalysisResult
  source: GuardianResultSource
  onStartNewPayment: () => void
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

export function PaymentOutcome({ onStartNewPayment, outcome, payment, result, source }: PaymentOutcomeProps) {
  const isCompleted = outcome === 'completed'
  const isMock = source === 'mock'

  return (
    <section aria-labelledby="payment-outcome-title" className="payment-outcome" id="payment-outcome">
      <PageContainer>
        <Card
          aria-live="polite"
          className={isCompleted ? 'payment-outcome__card payment-outcome__card--completed' : 'payment-outcome__card payment-outcome__card--cancelled'}
          elevated
        >
          <div className="payment-outcome__header">
            <StatusBadge
              label={isCompleted ? 'Payment completed' : 'Payment cancelled'}
              status={isCompleted ? 'secure' : 'danger'}
            />
            <Badge tone={isMock ? 'neutral' : 'accent'}>{isMock ? 'Simulated demo mode' : 'Backend confirmed state'}</Badge>
          </div>

          <p className="payment-outcome__eyebrow">{isCompleted ? 'You explicitly confirmed the Guardian-approved lifecycle action' : 'You stopped this payment'}</p>
          <h1 className="payment-outcome__title" id="payment-outcome-title">
            {isCompleted ? 'DEMO PAYMENT COMPLETED' : 'PAYMENT CANCELLED'}
          </h1>

          <p className="payment-outcome__copy">
            {isMock
              ? (isCompleted
                ? 'This frontend-only demo marked the payment COMPLETED after your explicit action. No backend record was created and no real money moved.'
                : 'This frontend-only demo marked the payment CANCELLED. No backend record was created and no money was sent.')
              : (isCompleted
                ? 'The backend recorded this transaction as COMPLETED after your explicit confirmation. This project has no payment rail, so no real money moved. Treat this as the simulated payment completion state.'
                : 'The backend recorded this transaction as CANCELLED. No money was sent and the Guardian protection stayed in place.')}
          </p>

          <dl className="payment-outcome__details">
            <div>
              <dt>Amount</dt>
              <dd>{formatAmount(payment.amount)}</dd>
            </div>
            <div>
              <dt>Recipient</dt>
              <dd>{payment.recipient}</dd>
            </div>
            <div>
              <dt>Transaction ID</dt>
              <dd>{result.transaction_id}</dd>
            </div>
            <div>
              <dt>Guardian decision</dt>
              <dd>{result.decision} · {result.risk_level} · {result.risk_score}/100</dd>
            </div>
            <div>
              <dt>Final state</dt>
              <dd>{isCompleted ? 'COMPLETED (simulated)' : 'CANCELLED'}</dd>
            </div>
          </dl>

          <p className="payment-outcome__footnote">
            {isCompleted
              ? 'Guardian analysis ran before this state was reached. The frontend never confirms a payment on its own.'
              : 'Cancellation was sent only because you chose it explicitly.'}
          </p>

          <Button onClick={onStartNewPayment} variant="secondary">Start another payment</Button>
        </Card>
      </PageContainer>
    </section>
  )
}
