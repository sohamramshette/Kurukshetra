import { useState } from 'react'

import { DecisionPanel } from '../components/DecisionPanel'
import { EvidenceList } from '../components/EvidenceList'
import { GuardianAlert } from '../components/GuardianAlert'
import { GuardianInvestigation } from '../components/GuardianInvestigation'
import { IndependentVerificationPanel } from '../components/IndependentVerificationPanel'
import { SecurityTimeline } from '../components/SecurityTimeline'
import { VerificationPanel } from '../components/VerificationPanel'
import { ReactReasoningPanel } from '../components/ReactReasoningPanel'
import { ScamGraphVisualizer } from '../components/ScamGraphVisualizer'
import { ThreatSensorPanel } from '../components/ThreatSensorPanel'
import { CoercionChatModal } from '../components/CoercionChatModal'
import { CounterfactualSimulator } from '../components/CounterfactualSimulator'
import { CoolingOverrideModal } from '../components/CoolingOverrideModal'
import { PageContainer } from '../components/ui/PageContainer'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import type { GuardianAction, GuardianResultSource } from '../hooks/useGuardian'
import type { GuardianAnalysisResult, GuardianDecision, GuardianTimelineStage, OverrideResponse } from '../types/guardian'
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

export type AnalysisTab = 'react' | 'scam-graph' | 'sensors' | 'counterfactual' | 'evidence' | 'verification' | 'investigation' | 'timeline' | 'telemetry'

export default function Guardian({
  actionError = null,
  actionMessage: initialActionMessage = null,
  onAcknowledgeGuidance,
  onBackToPayment,
  onCancelPayment,
  onConfirmPayment,
  payment,
  pendingAction = null,
  result,
  source,
}: GuardianProps) {
  const [currentResult, setCurrentResult] = useState<GuardianAnalysisResult>(result)
  const [actionMessage, setActionMessage] = useState<string | null>(initialActionMessage)
  const [isCoercionModalOpen, setIsCoercionModalOpen] = useState(false)
  const [isCoolingModalOpen, setIsCoolingModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<AnalysisTab>('react')
  const [viewMode, setViewMode] = useState<'tabs' | 'all'>('tabs')

  const requiresIntervention = currentResult.decision !== 'ALLOW'
  const isMock = source === 'mock'
  const vectorMatch = currentResult.ml_telemetry.vector_match
  const checksCount = Object.keys(currentResult.verification).length
  const hasEarlyStop = currentResult.react_reasoning_chain?.some(
    (s) => s.tool_chosen === null || s.reason.toUpperCase().includes('EARLY STOP')
  )

  const handleReviewVerification = () => {
    setActiveTab('verification')
    document.getElementById('guardian-analysis-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const handleVerifyRecipient = () => {
    setIsCoercionModalOpen(true)
  }

  const handleCancelPayment = () => {
    onCancelPayment()
  }

  const handleProceedAnyway = () => {
    setIsCoolingModalOpen(true)
  }

  const handleVerifyIndependently = () => {
    const behavior: ScrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    document.getElementById('independent-verification')?.scrollIntoView({ behavior, block: 'center' })
  }

  const handleOverrideComplete = (res: OverrideResponse) => {
    setActionMessage(res.message)
  }

  const handleDecisionUpdated = (newDecision: GuardianDecision, reason: string) => {
    setCurrentResult((prev) => ({
      ...prev,
      decision: newDecision,
      explanation: `${prev.explanation} [Coercion Check: ${reason}]`,
    }))
    setActionMessage(`Safety Interview complete: Decision updated to ${newDecision}.`)
  }

  const renderTelemetryCard = () => (
    <Card className="guardian-panel guardian-context-card">
      <div className="guardian-panel__header">
        <div>
          <p className="guardian-panel__eyebrow">Machine Learning &amp; Scam Graph</p>
          <h2 className="guardian-panel__title">Telemetry &amp; Threat Intelligence</h2>
        </div>
        <Badge tone="neutral">ML Pipeline</Badge>
      </div>
      <p className="decision-card__copy">{currentResult.counterfactual}</p>
      <dl className="guardian-context-card__telemetry">
        <div><dt>Isolation Forest</dt><dd>{currentResult.ml_telemetry.isolation_forest_pct}% anomaly score</dd></div>
        <div><dt>Gemini Analysis</dt><dd>{currentResult.ml_telemetry.gemini_active ? currentResult.ml_telemetry.gemini_model : 'Not active'}</dd></div>
        {vectorMatch ? (
          <div className="guardian-context-card__telemetry-item--wide">
            <dt>Vector Scam-Pattern Match</dt>
            <dd>{vectorMatch.pattern_name} · {vectorMatch.similarity_pct}% similarity</dd>
            <dd className="guardian-context-card__telemetry-detail">{vectorMatch.summary}</dd>
            <dd className="guardian-context-card__telemetry-reference">Reference: {vectorMatch.reference_sample}</dd>
          </div>
        ) : null}
      </dl>

      {/* Psychological Manipulation Profile (§S2.6 Tier 3) */}
      {currentResult.manipulation_profile && (
        <div className="manipulation-telemetry-section mt-4 pt-3 border-t border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Psychological Manipulation Profile</h4>
            {currentResult.manipulation_profile.dominant_tactic && (
              <Badge tone={currentResult.manipulation_profile.manipulation_level === 'CRITICAL' ? 'danger' : 'warning'}>
                Dominant: {currentResult.manipulation_profile.dominant_tactic} ({currentResult.manipulation_profile.manipulation_level})
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-2 rounded bg-slate-50 border border-slate-200">
              <div className="flex justify-between text-[11px] mb-1">
                <span>🔴 Fear</span>
                <span className="font-bold">{Math.round(currentResult.manipulation_profile.fear * 100)}%</span>
              </div>
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.round(currentResult.manipulation_profile.fear * 100)}%` }} />
              </div>
            </div>
            <div className="p-2 rounded bg-slate-50 border border-slate-200">
              <div className="flex justify-between text-[11px] mb-1">
                <span>🟠 Urgency</span>
                <span className="font-bold">{Math.round(currentResult.manipulation_profile.urgency * 100)}%</span>
              </div>
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.round(currentResult.manipulation_profile.urgency * 100)}%` }} />
              </div>
            </div>
            <div className="p-2 rounded bg-slate-50 border border-slate-200">
              <div className="flex justify-between text-[11px] mb-1">
                <span>🟡 Authority</span>
                <span className="font-bold">{Math.round(currentResult.manipulation_profile.authority * 100)}%</span>
              </div>
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${Math.round(currentResult.manipulation_profile.authority * 100)}%` }} />
              </div>
            </div>
            <div className="p-2 rounded bg-slate-50 border border-slate-200">
              <div className="flex justify-between text-[11px] mb-1">
                <span>🟢 Greed</span>
                <span className="font-bold">{Math.round(currentResult.manipulation_profile.greed * 100)}%</span>
              </div>
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.round(currentResult.manipulation_profile.greed * 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SHAP Feature Attribution (§S2.6 Tier 3) */}
      {currentResult.feature_attribution && (
        <div className="shap-telemetry-section mt-3 pt-3 border-t border-dashed border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">SHAP Anomaly Feature Attribution</h4>
            <span className="text-[11px] font-mono text-slate-500">Top Driver: {currentResult.feature_attribution.top_driver}</span>
          </div>
          <div className="space-y-1.5">
            {Object.entries(currentResult.feature_attribution.contributions).map(([feature, val]) => (
              <div key={feature} className="text-xs">
                <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                  <span className="font-mono">{feature}</span>
                  <span className="font-bold">{Math.round(val * 100)}%</span>
                </div>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.round(val * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )

  return (
    <section className="guardian-page" id="guardian-page" aria-labelledby="guardian-page-title">
      <PageContainer>
        {/* Compact Header */}
        <div className="guardian-page__header">
          <div>
            <p className="eyebrow">
              <span aria-hidden="true" className="eyebrow__line" />
              Guardian Interception
            </p>
            <h1 className="guardian-page__title" id="guardian-page-title">Payment Guardian</h1>
            <p className="guardian-page__subtitle">Real-time agentic review before an unsafe payment can proceed.</p>
          </div>
          <Button disabled={pendingAction !== null} onClick={onBackToPayment} variant="ghost">← Start another payment</Button>
        </div>

        <div className="guardian-demo-note mb-3">
          <Badge tone={isMock ? 'neutral' : 'success'}>{isMock ? 'Demo mode' : 'Live backend result'}</Badge>
          <span>{isMock ? 'Simulated Guardian analysis • offline mock mode.' : 'Live Guardian analysis • decision, lifecycle, and audit are backend-controlled.'}</span>
        </div>

        {/* Top Row: Executive Alert & Decision Actions (Side-by-side, perfectly balanced) */}
        <div className="guardian-top-grid">
          <div className="guardian-top-grid__alert">
            <GuardianAlert
              onReviewVerification={handleReviewVerification}
              payment={payment}
              result={currentResult}
              source={source}
            />
            {(currentResult.lifecycle?.requires_independent_guidance_acknowledgement || currentResult.lifecycle?.independent_guidance_acknowledged) ? (
              <div className="mt-4" id="independent-verification">
                <IndependentVerificationPanel
                  lifecycle={currentResult.lifecycle}
                  onAcknowledge={onAcknowledgeGuidance}
                  pendingAction={pendingAction}
                  source={source}
                />
              </div>
            ) : null}
          </div>

          <aside className="guardian-top-grid__decision" aria-label="Guardian decision">
            <DecisionPanel
              actionError={actionError}
              actionMessage={actionMessage}
              onBackToPayment={onBackToPayment}
              onCancelPayment={handleCancelPayment}
              onConfirmPayment={onConfirmPayment}
              onProceedAnyway={handleProceedAnyway}
              onVerifyRecipient={handleVerifyIndependently}
              onStartCoercionCheck={handleVerifyRecipient}
              pendingAction={pendingAction}
              result={currentResult}
            />
          </aside>
        </div>

        {/* Streamlined Decision Path Ribbon (Compact single row) */}
        <div className="guardian-stage-ribbon" role="list" aria-label="Guardian analysis stages">
          <div className="guardian-stage-ribbon__meta">
            <span className="guardian-stage-ribbon__label">Autonomous Decision Path:</span>
            <span className="guardian-stage-ribbon__badge">
              {requiresIntervention ? '⚡ Protective Path' : '✓ Safe Path'}
            </span>
          </div>
          <div className="guardian-stage-ribbon__steps">
            {agentLoop.map((step, index) => (
              <div className="guardian-stage-pill guardian-stage-pill--active" key={step} role="listitem">
                <span className="guardian-stage-pill__num">0{index + 1}</span>
                <span className="guardian-stage-pill__name">{step}</span>
                {index < agentLoop.length - 1 && <span className="guardian-stage-pill__arrow">›</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Full-Width Deep Intelligence Workspace (No side squeezing, zero overlap) */}
        <div className="guardian-analysis-workspace" id="guardian-analysis-workspace">
          {/* Tab Switcher */}
          <div className="guardian-tabs-header">
            <div className="guardian-tabs" role="tablist" aria-label="Guardian analysis sections">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'react'}
                className={`guardian-tab ${activeTab === 'react' ? 'guardian-tab--active' : ''}`}
                onClick={() => setActiveTab('react')}
              >
                <span className="guardian-tab__icon">🧠</span>
                <span>ReAct Loop</span>
                {hasEarlyStop ? (
                  <span className="guardian-tab__pill guardian-tab__pill--stop">Early Stop</span>
                ) : currentResult.react_reasoning_chain ? (
                  <span className="guardian-tab__pill">{currentResult.react_reasoning_chain.length}</span>
                ) : null}
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'scam-graph'}
                className={`guardian-tab ${activeTab === 'scam-graph' ? 'guardian-tab--active' : ''}`}
                onClick={() => setActiveTab('scam-graph')}
              >
                <span className="guardian-tab__icon">🕸️</span>
                <span>Scam Graph</span>
                {currentResult.graph_analysis?.is_hub_recipient || currentResult.graph_analysis?.user_graph_risk === 'HUB_MULE_PATTERN' ? (
                  <span className="guardian-tab__pill guardian-tab__pill--stop">Mule Hub</span>
                ) : currentResult.graph_analysis?.network_graph?.nodes ? (
                  <span className="guardian-tab__pill">{currentResult.graph_analysis.network_graph.nodes.length}</span>
                ) : null}
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'sensors'}
                className={`guardian-tab ${activeTab === 'sensors' ? 'guardian-tab--active' : ''}`}
                onClick={() => setActiveTab('sensors')}
              >
                <span className="guardian-tab__icon">📡</span>
                <span>Threat Sensors</span>
                {currentResult.sensor_analysis?.anomalies_detected ? (
                  <span className="guardian-tab__pill guardian-tab__pill--stop">
                    {currentResult.sensor_analysis.anomalies_detected} Threat{currentResult.sensor_analysis.anomalies_detected > 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className="guardian-tab__pill">Clean</span>
                )}
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'counterfactual'}
                className={`guardian-tab ${activeTab === 'counterfactual' ? 'guardian-tab--active' : ''}`}
                onClick={() => setActiveTab('counterfactual')}
              >
                <span className="guardian-tab__icon">🔮</span>
                <span>What-If Simulator</span>
                <span className="guardian-tab__pill">§34</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'evidence'}
                className={`guardian-tab ${activeTab === 'evidence' ? 'guardian-tab--active' : ''}`}
                onClick={() => setActiveTab('evidence')}
              >
                <span className="guardian-tab__icon">🛡️</span>
                <span>Threat Signals</span>
                <span className="guardian-tab__pill">{currentResult.signals.length}</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'verification'}
                className={`guardian-tab ${activeTab === 'verification' ? 'guardian-tab--active' : ''}`}
                onClick={() => setActiveTab('verification')}
              >
                <span className="guardian-tab__icon">🔍</span>
                <span>Verification Checks</span>
                <span className="guardian-tab__pill">{checksCount}</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'timeline'}
                className={`guardian-tab ${activeTab === 'timeline' ? 'guardian-tab--active' : ''}`}
                onClick={() => setActiveTab('timeline')}
              >
                <span className="guardian-tab__icon">⏱️</span>
                <span>Timeline</span>
                <span className="guardian-tab__pill">{currentResult.timeline.length}</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'telemetry'}
                className={`guardian-tab ${activeTab === 'telemetry' ? 'guardian-tab--active' : ''}`}
                onClick={() => setActiveTab('telemetry')}
              >
                <span className="guardian-tab__icon">🔬</span>
                <span>ML &amp; Telemetry</span>
              </button>
            </div>

            {/* View mode toggle (Tabs vs Stacked All) */}
            <div className="guardian-view-mode-toggle">
              <button
                type="button"
                className={`guardian-view-btn ${viewMode === 'tabs' ? 'guardian-view-btn--active' : ''}`}
                onClick={() => setViewMode('tabs')}
                title="Tabbed clean view (compact, no scrolling)"
              >
                📑 Tabs
              </button>
              <button
                type="button"
                className={`guardian-view-btn ${viewMode === 'all' ? 'guardian-view-btn--active' : ''}`}
                onClick={() => setViewMode('all')}
                title="Stacked full report"
              >
                📜 All
              </button>
            </div>
          </div>

          {/* Content Display (Tabbed vs Stacked) */}
          <div className="guardian-tab-body">
            {viewMode === 'all' ? (
              <div className="guardian-stacked-content">
                <ReactReasoningPanel
                  chain={currentResult.react_reasoning_chain}
                  isGeminiActive={currentResult.ml_telemetry.gemini_active}
                  geminiModel={currentResult.ml_telemetry.gemini_model}
                />
                <ScamGraphVisualizer
                  graphAnalysis={currentResult.graph_analysis}
                  recipientHandle={payment.recipient}
                  paymentAmount={`₹${payment.amount}`}
                />
                <ThreatSensorPanel
                  sensorAnalysis={currentResult.sensor_analysis}
                  recipientHandle={payment.recipient}
                  paymentAmount={`₹${payment.amount}`}
                />
                <CounterfactualSimulator baselineResult={currentResult} payment={payment} />
                <EvidenceList signals={currentResult.signals} source={source} />
                <VerificationPanel checks={currentResult.verification} source={source} />
                <GuardianInvestigation result={currentResult} source={source} />
                <SecurityTimeline events={currentResult.timeline} source={source} />
                {renderTelemetryCard()}
              </div>
            ) : (
              <div className="guardian-tab-pane">
                {activeTab === 'react' && (
                  <ReactReasoningPanel
                    chain={currentResult.react_reasoning_chain}
                    isGeminiActive={currentResult.ml_telemetry.gemini_active}
                    geminiModel={currentResult.ml_telemetry.gemini_model}
                  />
                )}
                {activeTab === 'scam-graph' && (
                  <ScamGraphVisualizer
                    graphAnalysis={currentResult.graph_analysis}
                    recipientHandle={payment.recipient}
                    paymentAmount={`₹${payment.amount}`}
                  />
                )}
                {activeTab === 'sensors' && (
                  <ThreatSensorPanel
                    sensorAnalysis={currentResult.sensor_analysis}
                    recipientHandle={payment.recipient}
                    paymentAmount={`₹${payment.amount}`}
                  />
                )}
                {activeTab === 'counterfactual' && (
                  <CounterfactualSimulator baselineResult={currentResult} payment={payment} />
                )}
                {activeTab === 'evidence' && (
                  <div className="guardian-tab-substack">
                    <EvidenceList signals={currentResult.signals} source={source} />
                    <Card className="guardian-panel guardian-context-card">
                      <div className="guardian-panel__header">
                        <div>
                          <p className="guardian-panel__eyebrow">Counterfactual Impact</p>
                          <h2 className="guardian-panel__title">Why this decision matters</h2>
                        </div>
                        <Badge tone="neutral">Guardian context</Badge>
                      </div>
                      <p className="decision-card__copy">{currentResult.counterfactual}</p>
                    </Card>
                  </div>
                )}
                {activeTab === 'verification' && (
                  <div className="space-y-4">
                    <VerificationPanel checks={currentResult.verification} source={source} />
                    <GuardianInvestigation result={currentResult} source={source} />
                  </div>
                )}
                {activeTab === 'timeline' && (
                  <SecurityTimeline events={currentResult.timeline} source={source} />
                )}
                {activeTab === 'telemetry' && renderTelemetryCard()}
              </div>
            )}
          </div>
        </div>

        <CoercionChatModal
          initialRiskScore={currentResult.risk_score}
          isOpen={isCoercionModalOpen}
          onClose={() => setIsCoercionModalOpen(false)}
          onDecisionUpdated={handleDecisionUpdated}
          payment={payment}
          transactionId={currentResult.transaction_id}
        />

        <CoolingOverrideModal
          isOpen={isCoolingModalOpen}
          onClose={() => setIsCoolingModalOpen(false)}
          transactionId={currentResult.transaction_id}
          recipient={payment.recipient}
          amount={payment.amount}
          riskScore={currentResult.risk_score}
          onOverrideComplete={handleOverrideComplete}
        />
      </PageContainer>
    </section>
  )
}
