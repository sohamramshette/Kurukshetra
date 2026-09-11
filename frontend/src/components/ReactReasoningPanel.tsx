import { useState } from 'react'
import type { ReactReasoningStep } from '../types/guardian'
import { Badge } from './ui/Badge'
import { Card } from './ui/Card'

export interface ReactReasoningPanelProps {
  chain?: ReactReasoningStep[]
  isGeminiActive?: boolean
  geminiModel?: string
}

const toolIcons: Record<string, string> = {
  detect_scam_patterns: '🛡️',
  check_recipient_profile: '👤',
  check_transaction_history: '📊',
  verify_identity_claim: '🪪',
  check_recipient_reputation: '🌐',
  check_transaction_velocity: '⚡',
}

function formatToolName(tool: string | null): string {
  if (!tool) return 'Early Stop Termination'
  return tool
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function getRiskTone(score: number): { label: string; color: string; bg: string } {
  if (score >= 75) return { label: 'CRITICAL', color: '#f87171', bg: 'rgba(239, 68, 68, 0.15)' }
  if (score >= 50) return { label: 'HIGH', color: '#fb923c', bg: 'rgba(249, 115, 22, 0.15)' }
  if (score >= 25) return { label: 'MEDIUM', color: '#facc15', bg: 'rgba(234, 179, 8, 0.15)' }
  return { label: 'LOW', color: '#4ade80', bg: 'rgba(34, 197, 94, 0.15)' }
}

export function ReactReasoningPanel({
  chain,
  isGeminiActive = false,
  geminiModel = 'gemini-1.5-flash',
}: ReactReasoningPanelProps) {
  const [showDetails, setShowDetails] = useState(false)

  if (!chain || chain.length === 0) {
    return null
  }

  const hasEarlyStop = chain.some(
    (step) => step.tool_chosen === null || step.reason.toUpperCase().includes('EARLY STOP')
  )

  const toolSteps = chain.filter((s) => s.tool_chosen !== null)

  const initialRisk = chain[0]?.risk_at_step ?? 10
  const finalRisk = chain[chain.length - 1]?.risk_at_step ?? initialRisk

  return (
    <Card className="guardian-panel react-reasoning-card" id="react-reasoning-chain">
      <div className="guardian-panel__header">
        <div>
          <div className="react-panel__badge-row">
            <span className="react-panel__eyebrow">Dynamic Agentic Loop</span>
            <span className="react-model-chip">
              <span className="react-model-pulse" />
              {isGeminiActive ? `AI Orchestrator (${geminiModel})` : 'Autonomous ReAct Engine'}
            </span>
          </div>
          <h2 className="guardian-panel__title">ReAct Reasoning &amp; Tool Chain</h2>
        </div>
        <div className="react-panel__actions">
          {hasEarlyStop && (
            <Badge tone="hold" className="react-early-badge">
              ⚡ Early Stop Triggered
            </Badge>
          )}
          <Badge tone="neutral">{chain.length} Cycle Steps</Badge>
        </div>
      </div>

      <p className="react-panel__intro">
        Guardian does not run a static script. Instead, its ReAct (Reason + Act) loop evaluates
        intermediate evidence at each step to decide which security check to run next, or when to
        terminate early to halt high-risk fraud without added latency.
      </p>

      {/* KPI summary strip */}
      <div className="react-kpi-strip">
        <div className="react-kpi-item">
          <span className="react-kpi-label">Reasoning Steps</span>
          <span className="react-kpi-value">{chain.length}</span>
        </div>
        <div className="react-kpi-item">
          <span className="react-kpi-label">Tools Dispatched</span>
          <span className="react-kpi-value">{toolSteps.length}</span>
        </div>
        <div className="react-kpi-item">
          <span className="react-kpi-label">Risk Trajectory</span>
          <span className="react-kpi-value">
            {initialRisk} → <strong style={{ color: getRiskTone(finalRisk).color }}>{finalRisk}</strong>
            <span className="react-kpi-sub">/100</span>
          </span>
        </div>
        <div className="react-kpi-item">
          <span className="react-kpi-label">Loop State</span>
          <span className="react-kpi-value">
            {hasEarlyStop ? '⚡ Short-circuited' : '✓ Full Traverse'}
          </span>
        </div>
      </div>

      {/* Step by step ReAct tree */}
      <div className="react-timeline-flow" role="list">
        {chain.map((step, idx) => {
          const isEarlyStop =
            step.tool_chosen === null || step.reason.toUpperCase().includes('EARLY STOP')
          const tone = getRiskTone(step.risk_at_step)
          const icon = step.tool_chosen ? toolIcons[step.tool_chosen] || '⚙️' : '⚡'

          if (isEarlyStop) {
            return (
              <div
                key={`step-${step.step}-${idx}`}
                className="react-step-item react-step-item--early-stop"
                role="listitem"
              >
                <div className="react-step-connector">
                  <div className="react-step-node react-step-node--stop">⚡</div>
                </div>
                <div className="react-step-content react-stop-banner">
                  <div className="react-stop-header">
                    <span className="react-stop-title">
                      Autonomous Early Stop · Step 0{step.step}
                    </span>
                    <span
                      className="react-risk-badge"
                      style={{ color: tone.color, backgroundColor: tone.bg }}
                    >
                      Risk Cap: {step.risk_at_step}/100 ({tone.label})
                    </span>
                  </div>
                  <p className="react-stop-reason">{step.reason}</p>
                  <div className="react-stop-benefit">
                    <span className="react-benefit-tag">✓ Latency Optimization</span>
                    <span className="react-benefit-tag">✓ Zero Redundant API Queries</span>
                    <span className="react-benefit-tag">✓ Immediate User Protection</span>
                  </div>
                </div>
              </div>
            )
          }

          return (
            <div
              key={`step-${step.step}-${idx}`}
              className="react-step-item"
              role="listitem"
            >
              <div className="react-step-connector">
                <div className="react-step-node">0{step.step}</div>
                {idx < chain.length - 1 && <div className="react-step-line" />}
              </div>

              <div className="react-step-content">
                <div className="react-step-top">
                  <div className="react-tool-chip">
                    <span className="react-tool-icon">{icon}</span>
                    <span className="react-tool-name">{formatToolName(step.tool_chosen)}</span>
                    <code className="react-tool-raw">({step.tool_chosen})</code>
                  </div>

                  <div className="react-step-risk">
                    <span className="react-risk-label">Intermediate Risk:</span>
                    <span
                      className="react-risk-badge"
                      style={{ color: tone.color, backgroundColor: tone.bg }}
                    >
                      {step.risk_at_step}/100 · {tone.label}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="react-risk-bar-track">
                  <div
                    className="react-risk-bar-fill"
                    style={{
                      width: `${Math.min(100, Math.max(5, step.risk_at_step))}%`,
                      backgroundColor: tone.color,
                    }}
                  />
                </div>

                {/* Agent Thought / Rationale */}
                <div className="react-thought-bubble">
                  <span className="react-thought-label">
                    <svg
                      className="react-thought-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
                      <path d="M9 21h6" />
                    </svg>
                    Reasoning Thought:
                  </span>
                  <p className="react-thought-text">{step.reason}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer / Toggle details */}
      <div className="react-panel-footer">
        <button
          type="button"
          className="react-toggle-btn"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? 'Hide Raw Chain Payload ▲' : 'Inspect Raw ReAct Trace ▼'}
        </button>

        {showDetails && (
          <pre className="react-raw-code">
            {JSON.stringify(chain, null, 2)}
          </pre>
        )}
      </div>
    </Card>
  )
}
