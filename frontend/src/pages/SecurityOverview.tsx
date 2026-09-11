import { useEffect, useState } from 'react'

import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { PageContainer } from '../components/ui/PageContainer'
import { StatusBadge } from '../components/ui/StatusBadge'
import { getDashboardMetrics } from '../services/api'
import type { DashboardMetrics } from '../types/guardian'

interface SecurityOverviewProps { isMockMode: boolean; onMakePayment: () => void }

const intelligence = [
  { icon: '◎', name: 'Recipient context', description: 'Handle analysis and profile familiarity returned by Guardian.' },
  { icon: '↗', name: 'Transaction behavior', description: 'Amount deviation and local anomaly-model telemetry.' },
  { icon: '✦', name: 'Scam language', description: 'Deterministic injection, urgency, impersonation, and pattern checks.' },
  { icon: '✓', name: 'Verification tools', description: 'Allowlisted checks selected by model-assisted or deterministic Guardian planning.' },
]

const flowSteps = [
  { stage: 'INTERCEPT', copy: 'Pause before any payment action.' },
  { stage: 'INVESTIGATE', copy: 'Observe context and plan checks.' },
  { stage: 'VERIFY', copy: 'Run allowlisted evidence tools.' },
  { stage: 'REASSESS', copy: 'Combine returned signals and uncertainty.' },
  { stage: 'PROTECT', copy: 'Apply deterministic backend policy.' },
  { stage: 'EXPLAIN', copy: 'Show the trace, evidence, and consequence.' },
]

export default function SecurityOverview({ isMockMode, onMakePayment }: SecurityOverviewProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [metricsError, setMetricsError] = useState<string | null>(null)

  useEffect(() => {
    if (isMockMode) return
    let active = true
    getDashboardMetrics().then((result) => { if (active) setMetrics(result) }).catch(() => { if (active) setMetricsError('Persisted metrics are currently unavailable.') })
    return () => { active = false }
  }, [isMockMode])

  const metricCards = metrics ? [
    { label: 'Payments analyzed', value: String(metrics.summary.payments_analyzed), detail: 'Durably recorded analyses', tone: 'accent' as const },
    { label: 'Threats detected', value: String(metrics.summary.threats_detected), detail: 'HIGH/CRITICAL or HOLD/BLOCK', tone: 'hold' as const },
    { label: 'Payments held', value: String(metrics.summary.payments_held), detail: `${metrics.summary.currently_held} currently held`, tone: 'hold' as const },
    { label: 'Payments blocked', value: String(metrics.summary.payments_blocked), detail: 'Original BLOCK decisions', tone: 'danger' as const },
    { label: 'Payments cancelled', value: String(metrics.summary.payments_cancelled), detail: 'Explicit lifecycle cancellations', tone: 'accent' as const },
    { label: 'Protection rate', value: `${metrics.summary.protection_rate_pct}%`, detail: 'Protected threat transactions', tone: 'success' as const },
  ] : []

  return (
    <section className="overview-page" id="security-overview" aria-labelledby="overview-title">
      <div className="overview-hero"><PageContainer className="overview-hero__inner">
        <div className="overview-hero__copy">
          <p className="eyebrow eyebrow--hero"><span aria-hidden="true" className="eyebrow__line" />Agentic pre-payment protection</p>
          <h1 className="overview-page__title" id="overview-title">Intercept. Investigate.<span>Protect.</span></h1>
          <p className="overview-page__subtitle">Guardian runs allowlisted checks using model-assisted planning when configured and deterministic planning otherwise, then applies server-authoritative payment policy before any explicit action.</p>
          <div className="overview-hero__actions"><Button onClick={onMakePayment} size="lg">Start the judge flow <span aria-hidden="true">→</span></Button><Badge tone="neutral">{isMockMode ? 'Frontend demo mode' : 'Backend Guardian mode'}</Badge></div>
          <ul className="overview-hero__trust" aria-label="Payment Guardian guarantees"><li><span aria-hidden="true">✓</span>No LLM authorizes payment</li><li><span aria-hidden="true">✓</span>Actual tool trace exposed</li><li><span aria-hidden="true">✓</span>Backend lifecycle enforced</li></ul>
        </div>
        <div className="overview-hero__visual" aria-label="Illustrative Guardian investigation preview">
          <div className="overview-product-card overview-product-card--back" aria-hidden="true"><span className="overview-product-card__bar" /><span className="overview-product-card__line" /><span className="overview-product-card__line overview-product-card__line--short" /></div>
          <div className="overview-product-card overview-product-card--main"><div className="overview-product-card__header"><div><span className="overview-product-card__logo">G</span><strong>Guardian investigation</strong></div><StatusBadge label="Illustrative" status="protected" /></div><div className="overview-product-card__amount"><span>Payment boundary</span><strong>PAUSED</strong></div><div className="overview-product-card__risk"><div><span>Agent method</span><strong>6 stages</strong></div><div className="overview-product-card__meter"><span /></div></div><div className="overview-product-card__decision"><span className="overview-product-card__shield" aria-hidden="true">✓</span><div><small>Authoritative decision</small><strong>Backend policy</strong></div></div><div className="overview-product-card__checks"><span>Observe</span><span>Verify</span><span>Protect</span></div></div>
          <div className="overview-hero__floating overview-hero__floating--top"><span aria-hidden="true">✦</span><div><strong>Allowlisted tools</strong><small>Actual results only</small></div></div><div className="overview-hero__floating overview-hero__floating--bottom"><span aria-hidden="true">✓</span><div><strong>Payment paused</strong><small>Explicit action required</small></div></div>
        </div>
      </PageContainer></div>

      <div className="overview-content"><PageContainer>
        <div className="overview-section-heading overview-section-heading--centered"><div><p className="overview-section-heading__eyebrow">Guardian intelligence</p><h2>An autonomous investigator with visible boundaries</h2><p>Every capability below exists in the current backend. Prototype and process-local intelligence is labeled in the returned investigation.</p></div></div>
        <div className="overview-intelligence-options">{intelligence.map((item) => <Card className="overview-intelligence-option" key={item.name}><span className="overview-intelligence-option__icon" aria-hidden="true">{item.icon}</span><h3>{item.name}</h3><p>{item.description}</p><button onClick={onMakePayment} type="button">Run investigation <span aria-hidden="true">→</span></button></Card>)}</div>

        <div className="overview-section-heading"><div><p className="overview-section-heading__eyebrow">Persisted protection snapshot</p><h2>Real Guardian records at a glance</h2></div><Badge tone={metrics ? 'success' : 'neutral'}>{isMockMode ? 'Unavailable in mock mode' : metrics ? 'Persisted backend data' : metricsError ? 'Unavailable' : 'Loading records'}</Badge></div>
        {metrics ? <><div className="overview-metrics" aria-label="Persisted Guardian security metrics">{metricCards.map((metric) => <Card className="overview-metric" key={metric.label}><div className={`overview-metric__signal overview-metric__signal--${metric.tone}`} aria-hidden="true" /><p>{metric.label}</p><strong>{metric.value}</strong><span>{metric.detail}</span></Card>)}</div><p className="overview-metrics__source">Source: aggregate transaction records for the canonical demo actor. No recipient or payment-note data is exposed by this endpoint.</p><div className="overview-risk-distribution" aria-label="Persisted risk distribution">{Object.entries(metrics.risk_distribution).map(([level, count]) => <div key={level}><span>{level}</span><strong>{count}</strong></div>)}</div></> : <Card className="overview-metrics-empty"><strong>{isMockMode ? 'Live metrics are disabled in frontend-only mock mode.' : metricsError ?? 'Loading persisted Guardian records…'}</strong><p>No synthetic values are substituted.</p></Card>}

        <div className="overview-showcase overview-showcase--agentic"><div className="overview-showcase__copy"><p className="overview-section-heading__eyebrow">2–3 minute judge mode</p><h2>One flow makes the agent visible.</h2><p>Submit the suspicious preset, watch the payment boundary, then expand the returned tool trace and evidence chain before demonstrating that HOLD or BLOCK cannot be bypassed.</p><Button onClick={onMakePayment} size="lg">Open protected payment</Button></div><ol className="overview-flow" aria-label="Guardian judge demonstration stages">{flowSteps.map((step, index) => <li key={step.stage}><span className="overview-flow__index">0{index + 1}</span><div><strong>{step.stage}</strong><p>{step.copy}</p></div><span className="overview-flow__arrow" aria-hidden="true">→</span></li>)}</ol></div>
      </PageContainer></div>
    </section>
  )
}
