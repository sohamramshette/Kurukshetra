import { useState } from 'react'

import { PaymentForm } from '../components/PaymentForm'
import { GuardianIntercept } from '../components/GuardianIntercept'
import { PaymentOutcome } from '../components/PaymentOutcome'
import Guardian from './Guardian'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { PageContainer } from '../components/ui/PageContainer'
import { StatusBadge } from '../components/ui/StatusBadge'
import { useGuardian } from '../hooks/useGuardian'
import {
  DEMO_PAYMENT_SCENARIOS,
  type DemoScenario,
  type PaymentDraft,
} from '../types/payment'

const scenarioOptions: DemoScenario[] = [
  'safe',
  'new_recipient',
  'urgency_spike',
  'suspicious',
  'sbi_impersonation',
  'pig_butchering',
  'prompt_injection',
]

function formatAmount(amount: string) {
  const numericAmount = Number(amount.replace(/,/g, ''))
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) return '₹—'

  return new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(numericAmount)
}

function PaymentStatusCard() {
  return (
    <Card className="guardian-status-card guardian-status-card--empty">
      <span className="guardian-status-card__empty-icon" aria-hidden="true">⌁</span>
      <h2 className="guardian-status-card__title">Your payment review will appear here.</h2>
      <p className="guardian-status-card__copy">Press Pay to pause this payment at the Guardian interception boundary before any money moves.</p>
    </Card>
  )
}

export default function Payment() {
  const guardian = useGuardian()
  const [draft, setDraft] = useState<PaymentDraft>(DEMO_PAYMENT_SCENARIOS.suspicious.values)
  const [selectedScenario, setSelectedScenario] = useState<DemoScenario | null>('suspicious')
  const isSubmitting = guardian.status === 'validating' || guardian.status === 'analyzing'
  const isMockMode = guardian.source === 'mock'

  const handleRetry = () => {
    if (guardian.payment) void guardian.submitPayment(guardian.payment)
  }

  // Guardian interception: the payment never completes at this point.
  if (isSubmitting && guardian.payment) {
    return (
      <GuardianIntercept
        onBackToPayment={guardian.reset}
        onRetry={handleRetry}
        payment={guardian.payment}
        phase={guardian.status === 'validating' ? 'validating' : 'analyzing'}
        source={guardian.source}
      />
    )
  }

  // Fail-closed: a failed security check is never presented as safe.
  if (guardian.status === 'error' && guardian.payment) {
    return (
      <GuardianIntercept
        error={guardian.error}
        onBackToPayment={guardian.reset}
        onRetry={handleRetry}
        payment={guardian.payment}
        phase="error"
        source={guardian.source}
      />
    )
  }

  if ((guardian.status === 'payment_completed' || guardian.status === 'payment_cancelled') && guardian.payment && guardian.result) {
    return (
      <PaymentOutcome
        onStartNewPayment={guardian.reset}
        outcome={guardian.status === 'payment_completed' ? 'completed' : 'cancelled'}
        payment={guardian.payment}
        result={guardian.result}
        source={guardian.source}
      />
    )
  }

  if ((guardian.status === 'guardian_result' || guardian.status === 'action_pending') && guardian.payment && guardian.result) {
    return (
      <Guardian
        actionError={guardian.actionError}
        actionMessage={guardian.actionMessage}
        onAcknowledgeGuidance={guardian.acknowledgeGuidance}
        onBackToPayment={guardian.reset}
        onCancelPayment={guardian.cancelPayment}
        onConfirmPayment={guardian.confirmPayment}
        payment={guardian.payment}
        pendingAction={guardian.pendingAction}
        result={guardian.result}
        source={guardian.source}
      />
    )
  }

  const handleDraftChange = (nextDraft: PaymentDraft) => {
    setDraft(nextDraft)
    setSelectedScenario(null)
  }

  const handleScenarioSelect = (scenario: DemoScenario) => {
    setDraft(DEMO_PAYMENT_SCENARIOS[scenario].values)
    setSelectedScenario(scenario)
    guardian.reset()
  }

  return (
    <section className="payment-section" id="payment" aria-labelledby="payment-title">
      <PageContainer>
        <div className="payment-page__header">
          <div>
            <p className="eyebrow"><span aria-hidden="true" className="eyebrow__line" />Protected payment flow</p>
            <h1 className="payment-page__title" id="payment-title">Make a Payment</h1>
            <p className="payment-page__subtitle">Enter the payment details and press Pay. Payment Guardian intercepts the payment for a security review before any money leaves your account.</p>
          </div>
          <div className="payment-page__active-state">
            <StatusBadge label={isMockMode ? 'Guardian demo active' : 'Backend Guardian selected'} status="protected" />
            <span>{isMockMode ? 'Simulated review enabled' : 'Backend review enabled'}</span>
          </div>
        </div>

        <div className="payment-layout">
          <Card className="payment-form-card" elevated>
            <div className="payment-card-heading">
              <div>
                <p className="payment-card-heading__eyebrow">Payment details</p>
                <h2 className="payment-card-heading__title">Who are you paying?</h2>
              </div>
              <Badge tone="accent">Secure setup</Badge>
            </div>

            <div className="demo-scenarios">
              <div className="demo-scenarios__heading">
                <span className="payment-form__label">Input presets</span>
                <Badge tone={isMockMode ? 'neutral' : 'accent'}>{isMockMode ? 'Mock analysis' : 'Real analysis'}</Badge>
              </div>
              <div aria-label="Choose a payment input preset" className="demo-scenarios__options" role="group">
                {scenarioOptions.map((scenario) => {
                  const definition = DEMO_PAYMENT_SCENARIOS[scenario]
                  const isSelected = selectedScenario === scenario
                  return <Button className={isSelected ? 'demo-scenario demo-scenario--selected' : 'demo-scenario'} disabled={isSubmitting} key={scenario} onClick={() => handleScenarioSelect(scenario)} size="sm" type="button" variant={isSelected ? 'secondary' : 'ghost'}>{definition.label}</Button>
                })}
              </div>
              <p className="demo-scenarios__description">{selectedScenario ? DEMO_PAYMENT_SCENARIOS[selectedScenario].description : 'Edit the fields to create your own payment analysis.'}</p>
            </div>

            <PaymentForm isMockMode={isMockMode} isSubmitting={isSubmitting} onChange={handleDraftChange} onSubmit={guardian.submitPayment} value={draft} />
          </Card>

          <aside className="payment-sidebar" aria-label="Payment summary and Guardian status">
            <Card className="payment-summary-card">
              <div className="payment-summary-card__header">
                <div>
                  <p className="payment-card-heading__eyebrow">Payment summary</p>
                  <h2 className="payment-card-heading__title">Review before you send</h2>
                </div>
                <StatusBadge label="Protected" status="protected" />
              </div>
              <p className="payment-summary-card__amount">{formatAmount(draft.amount)}</p>
              <dl className="payment-summary-card__details">
                <div><dt>Recipient</dt><dd>{draft.recipient || 'Not entered yet'}</dd></div>
                <div><dt>Reason</dt><dd>{draft.reason || 'No reason added yet'}</dd></div>
                <div><dt>Currency</dt><dd>{draft.currency}</dd></div>
              </dl>
              <div className="payment-summary-card__note"><span aria-hidden="true" className="status-dot" />Pressing Pay does not complete the payment. Guardian reviews it first.</div>
            </Card>
            <PaymentStatusCard />
          </aside>
        </div>
      </PageContainer>
    </section>
  )
}
