import { useState } from 'react'

import { DecisionPanel } from '../components/DecisionPanel'
import { EvidenceList } from '../components/EvidenceList'
import { GuardianAlert } from '../components/GuardianAlert'
import { GuardianInvestigation } from '../components/GuardianInvestigation'
import { IndependentVerificationPanel } from '../components/IndependentVerificationPanel'
import { SecurityTimeline } from '../components/SecurityTimeline'
import { VerificationPanel } from '../components/VerificationPanel'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { PageContainer } from '../components/ui/PageContainer'
import type { GuardianAction, GuardianResultSource } from '../hooks/useGuardian'
import type { GuardianAnalysisResult, GuardianTimelineStage } from '../types/guardian'
import type { PaymentDraft } from '../types/payment'

export interface GuardianProps {
  payment: PaymentDraft
  result: GuardianAnalysisResult
  source: GuardianResultSource
  actionError?: string | null
  actionMessage?: string | null
  pendingAction?: GuardianAction | null
  onConfirmPayment: () => void
  onCancelPayment: () => void
  onAcknowledgeGuidance: () => void
  onBackToPayment: () => void
}

const agentLoop: GuardianTimelineStage[] = ['OBSERVE', 'REASON', 'VERIFY', 'REASSESS', 'ACT', 'EXPLAIN']

export default function Guardian({ actionError = null, actionMessage = null, onAcknowledgeGuidance, onBackToPayment, onCancelPayment, onConfirmPayment, payment, pendingAction = null, result, source }: GuardianProps) {
  const [reviewMessage, setReviewMessage] = useState('')
  const requiresIntervention = result.decision !== 'ALLOW'
  const isMock = source === 'mock'
  const vectorMatch = result.ml_telemetry.vector_match
  const completedStages = new Set(result.timeline.map((event) => event.stage))

  const handleReviewVerification = () => {
    const behavior: ScrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    document.getElementById('guardian-verification')?.scrollIntoView({ behavior, block: 'center' })
  }

  const handleVerifyIndependently = () => {
    const behavior: ScrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    document.getElementById('independent-verification')?.scrollIntoView({ behavior, block: 'center' })
    setReviewMessage('Review this guidance using only independent official channels. Guardian will record an acknowledgement, not an external verification result.')
  }

  return (
    <section className="guardian-page" id="guardian-page" aria-labelledby="guardian-page-title">
      <PageContainer>
        <div className="guardian-page__header">
          <div>
            <p className="eyebrow"><span aria-hidden="true" className="eyebrow__line" />Guardian interception</p>
            <h1 className="guardian-page__title" id="guardian-page-title">Payment Guardian</h1>
            <p className="guardian-page__subtitle">This payment is paused at the Guardian boundary. It moves only if backend policy permits and you make an explicit choice.</p>
          </div>
          <Button disabled={pendingAction !== null} onClick={onBackToPayment} variant="ghost">← Start another payment</Button>
        </div>

        <GuardianAlert onReviewVerification={handleReviewVerification} payment={payment} result={result} source={source} />
        <div className="guardian-demo-note"><Badge tone={isMock ? 'neutral' : 'success'}>{isMock ? 'Demo mode' : 'Live backend result'}</Badge><span>{isMock ? 'Simulated Guardian analysis • no backend request was made.' : 'Live Guardian analysis • decision, lifecycle, and action audit are backend-controlled.'}</span></div>

        <Card className="guardian-loop-card">
          <div className="guardian-loop-card__header"><div><p className="guardian-panel__eyebrow">Guardian investigation</p><h2 className="guardian-panel__title">From observation to protective decision</h2></div><Badge tone={requiresIntervention ? 'hold' : 'success'}>{requiresIntervention ? 'Protective path' : 'Safe path'}</Badge></div>
          <div aria-label="Guardian analysis stages" className="guardian-loop" role="list">
            {agentLoop.map((step, index) => <div className={completedStages.has(step) ? 'guardian-loop__step guardian-loop__step--complete' : 'guardian-loop__step'} key={step} role="listitem"><span className="guardian-loop__number">{completedStages.has(step) ? '✓' : `0${index + 1}`}</span><span>{step}</span></div>)}
          </div>
          <p className="guardian-loop-card__copy">The investigation timeline below is returned by Guardian. The lifecycle state shown in the decision panel is persisted and enforced by the backend.</p>
        </Card>

        <div className="guardian-content-grid">
          <div className="guardian-content-grid__main">
            <GuardianInvestigation result={result} source={source} />
            <Card className="guardian-panel guardian-explanation-card">
              <div className="guardian-panel__header"><div><p className="guardian-panel__eyebrow">Explainable decision</p><h2 className="guardian-panel__title">Why Guardian made this decision</h2></div><Badge tone={requiresIntervention ? 'hold' : 'success'}>{result.decision}</Badge></div>
              <p className="guardian-explanation-card__summary">{result.explanation}</p>
              {result.signals.length ? <ul>{result.signals.slice(0, 3).map((signal) => <li key={`${signal.type}-${signal.reason}`}>{signal.reason}</li>)}</ul> : <p className="guardian-explanation-card__clear">Guardian found no significant indicators requiring intervention. This is a risk assessment, not a guarantee.</p>}
              <dl className="guardian-explanation-card__action"><div><dt>Guardian action</dt><dd>{result.decision.replaceAll('_', ' ')}</dd></div><div><dt>Policy intervention</dt><dd>{result.intervention.ui_mode.replaceAll('_', ' ')}</dd></div></dl>
            </Card>
            <EvidenceList signals={result.signals} source={source} />
            <VerificationPanel checks={result.verification} source={source} />
            {result.lifecycle.requires_independent_guidance_acknowledgement || result.lifecycle.independent_guidance_acknowledged ? <IndependentVerificationPanel lifecycle={result.lifecycle} onAcknowledge={onAcknowledgeGuidance} pendingAction={pendingAction} source={source} /> : null}
            {reviewMessage ? <p className="guardian-review-message" role="status">{reviewMessage}</p> : null}
            <SecurityTimeline events={result.timeline} source={source} />
            <Card className="guardian-panel guardian-context-card">
              <div className="guardian-panel__header"><div><p className="guardian-panel__eyebrow">Counterfactual</p><h2 className="guardian-panel__title">What would have happened without Guardian?</h2></div><Badge tone="neutral">Backend explanation</Badge></div>
              <blockquote className="guardian-counterfactual">{result.counterfactual}</blockquote>
              <dl className="guardian-context-card__telemetry">
                <div><dt>Isolation Forest</dt><dd>{result.ml_telemetry.isolation_forest_pct}% model anomaly index</dd></div>
                <div><dt>Gemini analysis</dt><dd>{result.ml_telemetry.gemini_active ? result.ml_telemetry.gemini_model : 'Not active'}</dd></div>
                <div><dt>Lifecycle version</dt><dd>v{result.lifecycle.state_version} · {result.lifecycle.status.replaceAll('_', ' ')}</dd></div>
                {vectorMatch ? <div className="guardian-context-card__telemetry-item--wide"><dt>Local semantic pattern match</dt><dd>{vectorMatch.pattern_name} · {vectorMatch.similarity_pct}% similarity</dd><dd className="guardian-context-card__telemetry-detail">{vectorMatch.summary}</dd><dd className="guardian-context-card__telemetry-reference">Bundled reference: {vectorMatch.reference_sample}</dd></div> : null}
              </dl>
            </Card>
          </div>
          <aside className="guardian-content-grid__side" aria-label="Guardian decision">
            <DecisionPanel actionError={actionError} actionMessage={actionMessage} onBackToPayment={onBackToPayment} onCancelPayment={onCancelPayment} onConfirmPayment={onConfirmPayment} onVerifyRecipient={handleVerifyIndependently} pendingAction={pendingAction} result={result} />
          </aside>
        </div>
      </PageContainer>
    </section>
  )
}
