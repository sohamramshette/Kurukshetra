import type { GuardianResultSource } from '../hooks/useGuardian'
import type { GuardianAnalysisResult, GuardianReasoningStep } from '../types/guardian'
import { Badge } from './ui/Badge'
import { Card } from './ui/Card'
import { StatusBadge } from './ui/StatusBadge'

export interface GuardianInvestigationProps {
  result: GuardianAnalysisResult
  source: GuardianResultSource
}

function formatName(value: string) {
  return value.replace(/^check_/, '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function statusBadge(step: GuardianReasoningStep) {
  if (step.result_status === 'PASSED') return <StatusBadge label="Completed" status="secure" />
  if (step.result_status === 'FAILED') return <StatusBadge label="Evidence found" status="danger" />
  if (step.result_status === 'ANOMALOUS') return <StatusBadge label="Attention" status="hold" />
  return <StatusBadge label="Not run" status="warning" />
}

export function GuardianInvestigation({ result, source }: GuardianInvestigationProps) {
  const trace = result.react_reasoning_chain
  const snapshots = result.timeline.filter((event) => event.risk_snapshot !== null)
  const hasIntermediateRisk = trace.some((step) => step.tool_chosen && step.risk_after_step !== step.risk_at_step)
  const intelligence = [
    {
      label: 'Recipient handle',
      value: result.handle_intelligence.status,
      detail: result.handle_intelligence.summary,
      delta: result.handle_intelligence.score_delta,
    },
    {
      label: 'Transaction graph',
      value: result.graph_analysis.user_graph_risk.replaceAll('_', ' '),
      detail: result.graph_analysis.summary,
      delta: result.graph_analysis.score_delta,
    },
    {
      label: 'Temporal escalation',
      value: result.pig_butchering.detected ? 'DETECTED' : 'NOT DETECTED',
      detail: result.pig_butchering.summary,
      delta: result.pig_butchering.score_delta,
    },
    {
      label: 'Manipulation axes',
      value: result.manipulation_profile.manipulation_level,
      detail: result.manipulation_profile.dominant_tactic
        ? `${formatName(result.manipulation_profile.dominant_tactic)} was the strongest detected tactic. It is shown as corroborating context and is not separately added to the final score.`
        : 'No dominant manipulation tactic was detected.',
      delta: 0,
    },
  ]

  return (
    <Card className="guardian-panel investigation-card">
      <div className="guardian-panel__header">
        <div>
          <p className="guardian-panel__eyebrow">Agent action trace</p>
          <h2 className="guardian-panel__title">Guardian Investigation</h2>
        </div>
        <Badge tone={source === 'mock' ? 'neutral' : 'accent'}>{source === 'mock' ? 'Deterministic demo trace' : 'Backend execution trace'}</Badge>
      </div>
      <p className="investigation-card__intro">Guardian {result.ml_telemetry.planner_mode === 'gemini_react' ? 'used model-assisted ReAct planning to select' : 'used deterministic ordering to run'} allowlisted checks, recorded their returned evidence, reassessed risk, and passed the result to deterministic payment policy.</p>

      <details className="investigation-disclosure" open>
        <summary>{result.ml_telemetry.planner_mode === 'gemini_react' ? 'Model-assisted ReAct tool activity' : 'Static allowlisted tool activity'} <span>{trace.length} recorded step{trace.length === 1 ? '' : 's'}</span></summary>
        {trace.length ? (
          <ol className="agent-trace">
            {trace.map((step) => (
              <li className="agent-trace__step" key={`${step.step}-${step.tool_chosen ?? 'stop'}`}>
                <span className="agent-trace__index">{String(step.step).padStart(2, '0')}</span>
                <div className="agent-trace__body">
                  <div className="agent-trace__heading">
                    <h3>{step.tool_chosen ? formatName(step.tool_chosen) : 'Planner stopped'}</h3>
                    {statusBadge(step)}
                  </div>
                  <p>{step.result_summary}</p>
                  <p className="agent-trace__reason">Why selected: {step.reason}</p>
                  <div className="agent-trace__risk" aria-label={`Risk changed from ${step.risk_at_step} to ${step.risk_after_step}`}>
                    <span>Risk {step.risk_at_step}</span><strong aria-hidden="true">→</strong><span>{step.risk_after_step}</span>
                    <Badge tone={step.score_delta > 0 ? 'hold' : step.score_delta < 0 ? 'success' : 'neutral'}>{step.score_delta > 0 ? '+' : ''}{step.score_delta}</Badge>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : <p className="guardian-panel__empty">No selectable tool steps were returned. Guardian combined the other recorded analysis layers.</p>}
      </details>

      <details className="investigation-disclosure">
        <summary>Always-run intelligence layers <span>4 recorded results</span></summary>
        <div className="intelligence-grid">
          {intelligence.map((item) => (
            <article className="intelligence-result" key={item.label}>
              <div><span>{item.label}</span><Badge tone={item.delta > 0 ? 'hold' : 'neutral'}>{item.value}</Badge></div>
              <p>{item.detail}</p>
              <small>Risk contribution {item.delta > 0 ? '+' : ''}{item.delta}</small>
            </article>
          ))}
        </div>
        <p className="guardian-panel__footnote">Graph and temporal context are process-local prototype intelligence. Verification statuses are evidence inputs, not external identity guarantees.</p>
      </details>

      <div className="risk-evolution" aria-labelledby="risk-evolution-title">
        <div className="risk-evolution__heading"><div><p className="guardian-panel__eyebrow">Risk evolution</p><h3 id="risk-evolution-title">Evidence changed the risk picture</h3></div><Badge tone={result.risk_level === 'LOW' ? 'success' : result.risk_level === 'MEDIUM' ? 'warning' : 'danger'}>{result.risk_level} final</Badge></div>
        {hasIntermediateRisk ? (
          <div className="risk-evolution__track">
            {trace.filter((step) => step.tool_chosen).map((step) => (
              <div className="risk-evolution__point" key={`risk-${step.step}`}>
                <span>{formatName(step.tool_chosen ?? 'Step')}</span>
                <div className="risk-evolution__bar"><span style={{ width: `${Math.max(2, step.risk_after_step)}%` }} /></div>
                <strong>{step.risk_after_step}</strong>
              </div>
            ))}
            <div className="risk-evolution__point risk-evolution__point--final"><span>Final reassessment</span><div className="risk-evolution__bar"><span style={{ width: `${Math.max(2, result.risk_score)}%` }} /></div><strong>{result.risk_score}</strong></div>
          </div>
        ) : (
          <p className="risk-evolution__empty">Guardian combined multiple independent signals. No per-tool score change was reported for this analysis.</p>
        )}
        <p className="guardian-panel__footnote">{snapshots.length} stage snapshot{snapshots.length === 1 ? '' : 's'} and {trace.length} planner step{trace.length === 1 ? '' : 's'} were returned by Guardian. No values are interpolated.</p>
      </div>
    </Card>
  )
}
