import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { PageContainer } from './ui/PageContainer'
import { StatusBadge } from './ui/StatusBadge'
import type { GuardianResultSource } from '../hooks/useGuardian'
import type { PaymentDraft } from '../types/payment'

const INVESTIGATION_METHOD = [
  { id: 'OBSERVE', label: 'Observe', copy: 'Receive recipient, amount, and payment context.' },
  { id: 'REASON', label: 'Reason', copy: 'Plan allowlisted checks from the available context.' },
  { id: 'VERIFY', label: 'Verify', copy: 'Run returned recipient, behavior, scam, identity, reputation, and velocity tools.' },
  { id: 'REASSESS', label: 'Reassess', copy: 'Combine completed checks and recorded intelligence layers.' },
  { id: 'ACT', label: 'Act', copy: 'Apply deterministic Guardian payment policy.' },
  { id: 'EXPLAIN', label: 'Explain', copy: 'Return evidence, trace, counterfactual, and lifecycle state.' },
] as const

export interface GuardianInterceptProps {
  payment: PaymentDraft
  phase: 'validating' | 'analyzing' | 'error'
  error?: string | null
  source: GuardianResultSource
  onRetry: () => void
  onBackToPayment: () => void
}

function formatAmount(amount: string) {
  const numericAmount = Number(amount.replace(/,/g, ''))
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) return '₹—'
  return new Intl.NumberFormat('en-IN', { currency: 'INR', maximumFractionDigits: 0, style: 'currency' }).format(numericAmount)
}

export function GuardianIntercept({ error, onBackToPayment, onRetry, payment, phase, source }: GuardianInterceptProps) {
  const isFailed = phase === 'error'
  const isMock = source === 'mock'
  return (
    <section aria-labelledby="guardian-intercept-title" className="guardian-intercept" id="guardian-intercept">
      <PageContainer><div className="guardian-intercept__shell">
        <div className="guardian-intercept__lead">
          <p className="guardian-intercept__eyebrow"><span aria-hidden="true" className="guardian-intercept__pulse" />Payment intercepted</p>
          <h1 className="guardian-intercept__title" id="guardian-intercept-title">{isFailed ? 'Guardian could not complete the security check.' : 'Guardian is investigating before any payment action.'}</h1>
          <p className="guardian-intercept__copy" role="status" aria-live={isFailed ? 'assertive' : 'polite'}>{isFailed ? (error ?? 'The security check did not finish. This payment has not been sent.') : phase === 'validating' ? 'Validating the payment request before analysis starts.' : 'A real Guardian analysis request is active. The completed backend trace will appear only after Guardian returns and durably records its decision.'}</p>
          <dl className="guardian-intercept__summary"><div><dt>Amount</dt><dd>{formatAmount(payment.amount)}</dd></div><div><dt>Recipient</dt><dd>{payment.recipient}</dd></div><div><dt>Payment type</dt><dd>UPI · {payment.currency}</dd></div></dl>
          {isFailed ? <div className="guardian-intercept__actions"><Button onClick={onRetry}>Try Again</Button><Button onClick={onBackToPayment} variant="ghost">Back to payment</Button></div> : null}
          <p className="guardian-intercept__failclosed">{isFailed ? 'Because Guardian could not evaluate this payment, it is not treated as safe and cannot continue.' : 'The browser cannot approve this payment. Backend policy must return a persisted lifecycle decision first.'}</p>
        </div>

        <Card className={isFailed ? 'guardian-intercept__panel guardian-intercept__panel--error' : 'guardian-intercept__panel'} elevated>
          <div className="guardian-intercept__panel-header"><div><p className="guardian-panel__eyebrow">Live investigation view</p><h2 className="guardian-panel__title">{isFailed ? 'Check incomplete' : 'Guardian methodology in progress'}</h2></div><StatusBadge label={isFailed ? 'Check failed' : 'Investigating'} status={isFailed ? 'danger' : 'pending'} /></div>
          <ol className="guardian-intercept__stages">
            {INVESTIGATION_METHOD.map((stage) => <li className="guardian-intercept__stage" key={stage.id}><span aria-hidden="true" className="guardian-intercept__stage-mark">•</span><span className="guardian-intercept__stage-body"><strong>{stage.label}</strong><span>{stage.copy}</span></span></li>)}
          </ol>
          {isFailed ? null : <div aria-label="Guardian analysis request in progress" className="guardian-status-card__progress" role="progressbar"><span /></div>}
          <div className="guardian-checking"><strong>Guardian can check in this analysis:</strong><ul><li>Recipient profile and handle</li><li>Transaction amount behavior</li><li>Payment-message scam patterns</li><li>Identity-claim and reputation context</li><li>Velocity, graph, temporal, and manipulation telemetry</li></ul></div>
          <p className="guardian-intercept__note"><Badge tone={isMock ? 'neutral' : 'accent'}>{isMock ? 'Mock analysis' : 'Backend analysis request'}</Badge><span>{isMock ? 'Frontend-only deterministic mode; no backend request was made.' : 'Stage completion is not simulated. Check marks and tool outcomes appear only in the returned backend investigation.'}</span></p>
        </Card>
      </div></PageContainer>
    </section>
  )
}
