import { useState, useEffect, useCallback } from 'react'
import { Card } from './ui/Card'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import type { PaymentDraft } from '../types/payment'
import type { GuardianAnalysisResult, CounterfactualSimulationResult, CounterfactualTweakInput } from '../types/guardian'
import { simulateCounterfactual } from '../services/api'

interface CounterfactualSimulatorProps {
  payment: PaymentDraft
  baselineResult: GuardianAnalysisResult
}

export function CounterfactualSimulator({ payment, baselineResult }: CounterfactualSimulatorProps) {
  const origAmount = Number(payment.amount.replace(/,/g, '').trim()) || 25000
  const origSensor = payment.sensor_telemetry || {}

  // Interactive tweak state
  const [simAmount, setSimAmount] = useState<number>(origAmount)
  const [simHistory, setSimHistory] = useState<number>(0)
  const [simUrgency, setSimUrgency] = useState<boolean>(true)
  const [simCall, setSimCall] = useState<boolean>(Boolean(origSensor.active_call))
  const [simScreen, setSimScreen] = useState<boolean>(Boolean(origSensor.screen_sharing))
  const [simVerified, setSimVerified] = useState<boolean>(false)

  const [simulation, setSimulation] = useState<CounterfactualSimulationResult | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)

  const runSimulation = useCallback(async () => {
    setIsSimulating(true)
    try {
      const tweaks: CounterfactualTweakInput = {
        amount: simAmount,
        prior_payment_count: simHistory,
        has_urgency: simUrgency,
        active_call: simCall,
        screen_sharing: simScreen,
        verified_identity: simVerified,
      }
      const res = await simulateCounterfactual(payment, tweaks)
      setSimulation(res)
    } catch {
      // Fallback calculation if network blip
      let reduction = 0
      const actions: string[] = []

      if (simAmount <= 2000 && origAmount > 10000) {
        reduction += 35
        actions.push(`Transfer amount reduced to ₹${simAmount.toLocaleString()}: -35 pts`)
      } else if (simAmount <= 5000 && origAmount > 10000) {
        reduction += 25
        actions.push(`Transfer amount reduced to ₹${simAmount.toLocaleString()}: -25 pts`)
      }

      if (simHistory >= 3) {
        reduction += 40
        actions.push(`Recipient established as trusted contact (${simHistory} payments): -40 pts`)
      } else if (simHistory >= 1) {
        reduction += 25
        actions.push(`Recipient has 1 prior successful payment: -25 pts`)
      }

      if (!simUrgency) {
        reduction += 20
        actions.push('Payment note cleared of artificial threat/urgency keywords: -20 pts')
      }

      if (!simCall) {
        reduction += 25
        actions.push('Ongoing phone call disconnected (eliminates voice coercion): -25 pts')
      }

      if (!simScreen) {
        reduction += 35
        actions.push('Remote screen-sharing tool terminated (prevents screen spying): -35 pts')
      }

      if (simVerified) {
        reduction += 25
        actions.push('Beneficiary independently verified via official public portal: -25 pts')
      }

      const simScore = Math.max(0, Math.min(100, baselineResult.risk_score - reduction))
      const simDec = simScore >= 75 ? 'HOLD' : simScore >= 50 ? 'STEP_UP' : simScore >= 25 ? 'WARN' : 'ALLOW'

      setSimulation({
        baseline_score: baselineResult.risk_score,
        baseline_decision: baselineResult.decision,
        simulated_score: simScore,
        simulated_decision: simDec,
        score_delta: -reduction,
        required_actions: actions.length > 0 ? actions : ['Modify parameters below to observe score adjustments.'],
      })
    } finally {
      setIsSimulating(false)
    }
  }, [simAmount, simHistory, simUrgency, simCall, simScreen, simVerified, payment, origAmount, baselineResult])

  // Debounced auto-simulation on slider/toggle change
  useEffect(() => {
    const timer = setTimeout(() => {
      void runSimulation()
    }, 120)
    return () => clearTimeout(timer)
  }, [runSimulation])

  // Reset to initial payment baseline
  const resetBaseline = () => {
    setSimAmount(origAmount)
    setSimHistory(0)
    setSimUrgency(true)
    setSimCall(Boolean(origSensor.active_call))
    setSimScreen(Boolean(origSensor.screen_sharing))
    setSimVerified(false)
  }

  // Quick preset: Safe Resolution
  const applySafeRemediation = () => {
    setSimAmount(Math.min(origAmount, 2000))
    setSimHistory(3)
    setSimUrgency(false)
    setSimCall(false)
    setSimScreen(false)
    setSimVerified(true)
  }

  const simScore = simulation ? simulation.simulated_score : baselineResult.risk_score
  const simDecision = simulation ? simulation.simulated_decision : baselineResult.decision
  const delta = simulation ? simulation.score_delta : 0

  const decisionTone =
    simDecision === 'ALLOW' ? 'success' : simDecision === 'WARN' ? 'warning' : 'danger'

  return (
    <Card className="counterfactual-card">
      {/* 1. Header */}
      <div className="counterfactual-header">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="guardian-panel__eyebrow">Explainability &amp; Remediation (§34)</span>
            <span className="counterfactual-pulse-dot" />
            <span className="text-xs font-semibold text-indigo-600 font-mono">Live Counterfactual Engine</span>
          </div>
          <h2 className="guardian-panel__title">What-If Risk Reduction Simulator</h2>
          <p className="counterfactual-subtitle">
            Directly implements <strong>brain.md §34</strong>. Tweak the operational parameters below in real-time to discover the exact combination of safeguards required to clear this payment safely.
          </p>
        </div>

        <div className="counterfactual-header__actions">
          <Button onClick={applySafeRemediation} size="sm" variant="secondary" title="Apply full safety remediation preset">
            ✨ Auto-Remediate
          </Button>
          <Button onClick={resetBaseline} size="sm" variant="ghost" title="Reset all sliders to original transaction state">
            ↺ Reset
          </Button>
        </div>
      </div>

      {/* 2. Dual-Gauge Score Comparison Strip */}
      <div className="counterfactual-gauges-grid">
        {/* Baseline Card */}
        <div className="counterfactual-gauge-card counterfactual-gauge-card--baseline">
          <span className="counterfactual-gauge-card__label">Original Transaction Risk</span>
          <div className="counterfactual-gauge-card__score-wrap">
            <span className="counterfactual-gauge-card__score text-red-600">{baselineResult.risk_score}</span>
            <span className="counterfactual-gauge-card__total">/100</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <Badge tone="danger">{baselineResult.decision}</Badge>
            <span className="text-[11px] text-slate-500">Pre-check Hold</span>
          </div>
        </div>

        {/* Transition Indicator */}
        <div className="counterfactual-transition">
          <span className="counterfactual-transition__arrow">➔</span>
          <span className={`counterfactual-transition__delta ${delta < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
            {delta < 0 ? `${delta} pts` : 'No change'}
          </span>
        </div>

        {/* Simulated Counterfactual Card */}
        <div className={`counterfactual-gauge-card counterfactual-gauge-card--simulated counterfactual-gauge-card--${decisionTone}`}>
          <div className="flex justify-between items-center">
            <span className="counterfactual-gauge-card__label">Simulated Counterfactual Risk</span>
            {isSimulating && <span className="text-[10px] text-indigo-600 font-mono animate-pulse">Calculating...</span>}
          </div>
          <div className="counterfactual-gauge-card__score-wrap">
            <span className={`counterfactual-gauge-card__score ${simScore <= 25 ? 'text-emerald-600' : simScore <= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {simScore}
            </span>
            <span className="counterfactual-gauge-card__total">/100</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <Badge tone={decisionTone}>{simDecision}</Badge>
            <span className="text-[11px] font-semibold text-slate-600">
              {simScore <= 25 ? '✅ Cleared for Transfer' : simScore <= 50 ? '⚠️ Step-Up Verification' : '🔒 Protective Hold'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Interactive Parameter Controls Grid */}
      <div className="counterfactual-controls-grid">
        {/* Control 1: Transfer Amount Slider */}
        <div className="counterfactual-control-item">
          <div className="counterfactual-control-item__header">
            <label className="counterfactual-control-item__label" htmlFor="cf-amount">
              💵 Transfer Amount:
            </label>
            <span className="counterfactual-control-item__val font-mono font-bold text-slate-900">
              ₹{simAmount.toLocaleString()}
            </span>
          </div>
          <input
            id="cf-amount"
            type="range"
            min="500"
            max="50000"
            step="500"
            value={simAmount}
            onChange={(e) => setSimAmount(Number(e.target.value))}
            className="counterfactual-slider"
          />
          <div className="counterfactual-control-item__ticks">
            <button type="button" onClick={() => setSimAmount(1200)}>₹1.2k (Safe)</button>
            <button type="button" onClick={() => setSimAmount(5000)}>₹5k (Threshold)</button>
            <button type="button" onClick={() => setSimAmount(15000)}>₹15k</button>
            <button type="button" onClick={() => setSimAmount(25000)}>₹25k (Orig)</button>
          </div>
        </div>

        {/* Control 2: Prior Payment History Slider */}
        <div className="counterfactual-control-item">
          <div className="counterfactual-control-item__header">
            <label className="counterfactual-control-item__label" htmlFor="cf-history">
              👤 Prior Successful Payments to Recipient:
            </label>
            <span className="counterfactual-control-item__val font-mono font-bold text-slate-900">
              {simHistory === 0 ? '0 (New Payee)' : `${simHistory} prior transfers`}
            </span>
          </div>
          <input
            id="cf-history"
            type="range"
            min="0"
            max="5"
            step="1"
            value={simHistory}
            onChange={(e) => setSimHistory(Number(e.target.value))}
            className="counterfactual-slider"
          />
          <div className="counterfactual-control-item__ticks">
            <button type="button" onClick={() => setSimHistory(0)}>0 (New)</button>
            <button type="button" onClick={() => setSimHistory(1)}>1 (Verified)</button>
            <button type="button" onClick={() => setSimHistory(3)}>3 (Trusted)</button>
            <button type="button" onClick={() => setSimHistory(5)}>5+ (Frequent)</button>
          </div>
        </div>
      </div>

      {/* 4. Toggle Safeguards Grid */}
      <div className="counterfactual-toggles-grid">
        {/* Toggle 1: Urgency Keywords */}
        <button
          type="button"
          className={`counterfactual-toggle-btn ${!simUrgency ? 'counterfactual-toggle-btn--active-safe' : 'counterfactual-toggle-btn--active-danger'}`}
          onClick={() => setSimUrgency(!simUrgency)}
        >
          <span className="counterfactual-toggle-btn__icon">{simUrgency ? '⚠️' : '✓'}</span>
          <div className="counterfactual-toggle-btn__info">
            <span className="counterfactual-toggle-btn__title">Urgency &amp; Threat Words</span>
            <span className="counterfactual-toggle-btn__status">
              {simUrgency ? 'Active: "Power cut tonight / Pay urgent fee"' : 'Cleared: Clean invoice purpose (-20 pts)'}
            </span>
          </div>
        </button>

        {/* Toggle 2: Ongoing Phone Call */}
        <button
          type="button"
          className={`counterfactual-toggle-btn ${!simCall ? 'counterfactual-toggle-btn--active-safe' : 'counterfactual-toggle-btn--active-danger'}`}
          onClick={() => setSimCall(!simCall)}
        >
          <span className="counterfactual-toggle-btn__icon">{simCall ? '📞' : '✓'}</span>
          <div className="counterfactual-toggle-btn__info">
            <span className="counterfactual-toggle-btn__title">Active Voice Call Status</span>
            <span className="counterfactual-toggle-btn__status">
              {simCall ? 'Ongoing Phone Call Detected (+25 risk)' : 'Call Disconnected / User Alone (-25 pts)'}
            </span>
          </div>
        </button>

        {/* Toggle 3: Screen Mirroring Tool */}
        <button
          type="button"
          className={`counterfactual-toggle-btn ${!simScreen ? 'counterfactual-toggle-btn--active-safe' : 'counterfactual-toggle-btn--active-danger'}`}
          onClick={() => setSimScreen(!simScreen)}
        >
          <span className="counterfactual-toggle-btn__icon">{simScreen ? '🖥️' : '✓'}</span>
          <div className="counterfactual-toggle-btn__info">
            <span className="counterfactual-toggle-btn__title">Remote Screen Mirroring (AnyDesk)</span>
            <span className="counterfactual-toggle-btn__status">
              {simScreen ? 'AnyDesk Remote Tool Active (+35 risk)' : 'Screen Mirroring Terminated (-35 pts)'}
            </span>
          </div>
        </button>

        {/* Toggle 4: Official Identity Verification */}
        <button
          type="button"
          className={`counterfactual-toggle-btn ${simVerified ? 'counterfactual-toggle-btn--active-safe' : ''}`}
          onClick={() => setSimVerified(!simVerified)}
        >
          <span className="counterfactual-toggle-btn__icon">{simVerified ? '🛡️' : '⚪'}</span>
          <div className="counterfactual-toggle-btn__info">
            <span className="counterfactual-toggle-btn__title">Independent Channel Verification</span>
            <span className="counterfactual-toggle-btn__status">
              {simVerified ? 'Verified via Official State Portal (-25 pts)' : 'Unverified third-party request'}
            </span>
          </div>
        </button>
      </div>

      {/* 5. Dynamic Remediation Roadmap */}
      <div className="counterfactual-remediation">
        <h4 className="counterfactual-remediation__title">
          🛡️ Actionable Remediation Roadmap ({simulation?.required_actions.length || 0} Safeguards Triggered):
        </h4>
        <div className="counterfactual-remediation__list">
          {(simulation?.required_actions || []).map((action, idx) => (
            <div key={idx} className="counterfactual-remediation__item">
              <span className="counterfactual-remediation__bullet">⚡</span>
              <span className="counterfactual-remediation__text">{action}</span>
            </div>
          ))}
        </div>

        {simScore <= 25 ? (
          <div className="counterfactual-success-banner">
            <span className="counterfactual-success-banner__icon">🎉</span>
            <div>
              <strong>Target Safety Achieved!</strong> Under these simulated conditions, the transaction drops from <strong>{baselineResult.risk_score}</strong> to <strong>{simScore}</strong> and automatically clears with <strong>ALLOW</strong>.
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  )
}
