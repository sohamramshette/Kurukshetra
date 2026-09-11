import { useState } from 'react'

import { DecisionPanel } from '../components/DecisionPanel'
import { EvidenceList } from '../components/EvidenceList'
import { GuardianAlert } from '../components/GuardianAlert'
import { SecurityTimeline } from '../components/SecurityTimeline'
import { VerificationPanel } from '../components/VerificationPanel'
import { PageContainer } from '../components/ui/PageContainer'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import type { GuardianAnalysisResult } from '../types/guardian'
import type { GuardianResultSource } from '../hooks/useGuardian'
import type { PaymentDraft } from '../types/payment'

export interface GuardianProps {
  payment: PaymentDraft
  result: GuardianAnalysisResult
  source: GuardianResultSource
  onBackToPayment: () => void
}

const agentLoop = ['OBSERVE', 'REASON', 'VERIFY', 'REASSESS', 'ACT', 'EXPLAIN']

export default function Guardian({ onBackToPayment, payment, result, source }: GuardianProps) {
  const [actionMessage, setActionMessage] = useState('')
  const requiresIntervention = result.decision !== 'ALLOW'
  const isMock = source === 'mock'
  const vectorMatch = result.ml_telemetry.vector_match

  const handleReviewVerification = () => {
    const behavior: ScrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    document.getElementById('guardian-verification')?.scrollIntoView({ behavior, block: 'center' })
  }

  const handleVerifyRecipient = () => {
    handleReviewVerification()
    setActionMessage(isMock ? 'Demo verification requested. No external service was queried.' : 'Verification review selected. No payment action was sent.')
  }

  const handleCancelPayment = () => {
    setActionMessage(isMock ? 'Demo cancellation selected. No payment was sent.' : 'Cancellation selected for review. No cancellation request was sent.')
  }

  const handleProceedAnyway = () => {
    setActionMessage('Explicit override recorded in the frontend. No payment was sent and the hold remains visible.')
  }

  return (
    <section className="guardian-page" id="guardian-page" aria-labelledby="guardian-page-title">
      <PageContainer>
        <div className="guardian-page__header">
          <div>
            <p className="eyebrow">
              <span aria-hidden="true" className="eyebrow__line" />
              Guardian interception
            </p>
            <h1 className="guardian-page__title" id="guardian-page-title">Payment Guardian</h1>
            <p className="guardian-page__subtitle">A clear security review before a potentially unsafe payment can move forward.</p>
          </div>
          <Button onClick={onBackToPayment} variant="ghost">← Start another payment</Button>
        </div>

        <GuardianAlert
          onReviewVerification={handleReviewVerification}
          payment={payment}
          result={result}
          source={source}
        />

        <div className="guardian-demo-note">
          <Badge tone={isMock ? 'neutral' : 'success'}>{isMock ? 'Demo mode' : 'Live backend result'}</Badge>
          <span>{isMock ? 'Simulated Guardian analysis • no payment was processed.' : 'Backend Guardian analysis • no payment was processed by this frontend.'}</span>
        </div>

        <Card className="guardian-loop-card">
          <div className="guardian-loop-card__header">
            <div>
              <p className="guardian-panel__eyebrow">Guardian decision path</p>
              <h2 className="guardian-panel__title">From observation to explanation</h2>
            </div>
            <Badge tone={requiresIntervention ? 'hold' : 'success'}>{requiresIntervention ? 'Protective path' : 'Safe path'}</Badge>
          </div>
          <div aria-label="Guardian analysis stages" className="guardian-loop" role="list">
            {agentLoop.map((step, index) => (
              <div className="guardian-loop__step guardian-loop__step--complete" key={step} role="listitem">
                <span className="guardian-loop__number">0{index + 1}</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
          <p className="guardian-loop-card__copy">The returned Guardian result is presented as a concise decision path; no raw backend payload is exposed.</p>
        </Card>

        <div className="guardian-content-grid">
          <div className="guardian-content-grid__main">
            <EvidenceList signals={result.signals} source={source} />
            <VerificationPanel checks={result.verification} source={source} />
            <SecurityTimeline events={result.timeline} source={source} />
            <Card className="guardian-panel guardian-context-card">
              <div className="guardian-panel__header">
                <div>
                  <p className="guardian-panel__eyebrow">Additional context</p>
                  <h2 className="guardian-panel__title">Why this decision matters</h2>
                </div>
                <Badge tone="neutral">Guardian context</Badge>
              </div>
              <p className="decision-card__copy">{result.counterfactual}</p>
              <dl className="guardian-context-card__telemetry">
                <div><dt>Isolation Forest</dt><dd>{result.ml_telemetry.isolation_forest_pct}% anomaly score</dd></div>
                <div><dt>Gemini analysis</dt><dd>{result.ml_telemetry.gemini_active ? result.ml_telemetry.gemini_model : 'Not active'}</dd></div>
                {vectorMatch ? (
                  <div className="guardian-context-card__telemetry-item--wide">
                    <dt>Vector scam-pattern match</dt>
                    <dd>{vectorMatch.pattern_name} · {vectorMatch.similarity_pct}% similarity</dd>
                    <dd className="guardian-context-card__telemetry-detail">{vectorMatch.summary}</dd>
                    <dd className="guardian-context-card__telemetry-reference">Reference: {vectorMatch.reference_sample}</dd>
                  </div>
                ) : null}
              </dl>
            </Card>
          </div>
          <aside className="guardian-content-grid__side" aria-label="Guardian decision">
            <DecisionPanel
              actionMessage={actionMessage}
              onBackToPayment={onBackToPayment}
              onCancelPayment={handleCancelPayment}
              onProceedAnyway={handleProceedAnyway}
              onVerifyRecipient={handleVerifyRecipient}
              result={result}
            />
          </aside>
        </div>
      </PageContainer>
    </section>
  )
}
