import { useState, useEffect } from 'react'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { StatusBadge } from './ui/StatusBadge'
import { requestPaymentOverride } from '../services/api'
import type { OverrideResponse } from '../types/guardian'

interface CoolingOverrideModalProps {
  isOpen: boolean
  onClose: () => void
  transactionId: string
  recipient: string
  amount: string
  riskScore: number
  onOverrideComplete?: (response: OverrideResponse) => void
}

export function CoolingOverrideModal({
  isOpen,
  onClose,
  transactionId,
  recipient,
  amount,
  riskScore,
  onOverrideComplete,
}: CoolingOverrideModalProps) {
  const [reason, setReason] = useState('')
  const [safeword, setSafeword] = useState('')
  const [isDemoMode, setIsDemoMode] = useState(true)
  const [countdownSeconds, setCountdownSeconds] = useState(10)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [overrideState, setOverrideState] = useState<OverrideResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Countdown timer for active cooling period
  useEffect(() => {
    if (!overrideState) return

    const initial = isDemoMode ? 10 : 14400
    setCountdownSeconds(initial)

    const timer = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [overrideState, isDemoMode])

  if (!isOpen) return null

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) {
      setError('Please provide a legitimate justification for overriding the protective hold.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await requestPaymentOverride(transactionId, safeword || 'CONFIRMED', reason)
      setOverrideState(res)
      if (onOverrideComplete) onOverrideComplete(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register override.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatTimer = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="cooling-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="cooling-modal-title">
      <Card className="cooling-modal-card" elevated>
        {/* Header */}
        <div className="cooling-modal-header">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="guardian-panel__eyebrow">Protective Counter-Action (§13 &amp; §39)</span>
              <StatusBadge label="Statutory Hold" status="danger" />
            </div>
            <h2 className="cooling-modal-title" id="cooling-modal-title">
              Adaptive Cooling-Period User Override
            </h2>
            <p className="cooling-modal-subtitle">
              Guardian detected elevated threat indicators (Score: {riskScore}/100). To protect against voice duress, overriding this hold mandates a cooling window before funds can move.
            </p>
          </div>

          <button
            type="button"
            className="cooling-modal-close"
            onClick={onClose}
            aria-label="Close override window"
          >
            ✕
          </button>
        </div>

        {/* Transaction Summary Strip */}
        <div className="cooling-modal-summary-strip">
          <div>
            <span className="text-xs text-slate-500">Transaction ID:</span>
            <span className="font-mono font-bold text-xs ml-1 text-slate-800">{transactionId}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500">Target Recipient:</span>
            <span className="font-semibold text-xs ml-1 text-slate-800">{recipient}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500">Amount:</span>
            <span className="font-bold text-xs ml-1 text-red-600">₹{amount}</span>
          </div>
        </div>

        {/* Active Cooling State */}
        {overrideState ? (
          <div className="cooling-active-container">
            <div className="cooling-active-banner">
              <span className="cooling-active-banner__icon">⏳</span>
              <div>
                <h3 className="cooling-active-banner__title">Mandatory Cooling Period Active</h3>
                <p className="cooling-active-banner__desc">
                  {overrideState.message}
                </p>
              </div>
            </div>

            {/* Countdown Clock */}
            <div className="cooling-clock-wrap">
              <div className="cooling-clock-time">{formatTimer(countdownSeconds)}</div>
              <span className="cooling-clock-label">
                {countdownSeconds === 0 ? '✓ Cooling Window Complete — Clearance Permitted' : 'Protective Lock Active'}
              </span>
            </div>

            {/* Audit Log Confirmation */}
            <div className="cooling-audit-receipt">
              <span className="text-xs font-bold text-slate-700">📜 Audit Receipt:</span>
              <span className="text-xs text-slate-600">
                Action logged to Immutable Regulatory Ledger as <code>USER_OVERRIDE_COOLING_ACTIVE</code>.
              </span>
            </div>

            <div className="cooling-active-actions">
              <Button
                onClick={() => setIsDemoMode(!isDemoMode)}
                size="sm"
                variant="ghost"
                title="Switch between 10s demo countdown and full 4h regulatory window"
              >
                {isDemoMode ? 'Toggle 4-Hour Mode' : 'Toggle 10-Second Demo'}
              </Button>
              <Button onClick={onClose} size="md" variant="secondary">
                Close &amp; Monitor in Dashboard
              </Button>
            </div>
          </div>
        ) : (
          /* Override Form */
          <form className="cooling-override-form" onSubmit={handleOverrideSubmit}>
            {error && (
              <div className="cooling-error-banner">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <div className="cooling-form-field">
              <label className="cooling-form-label" htmlFor="override-reason">
                Justification for Overriding Guardian Security Hold *
              </label>
              <textarea
                id="override-reason"
                className="cooling-form-textarea"
                rows={3}
                placeholder="E.g., I independently called the utility company customer care line and verified this invoice number."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
              <span className="cooling-form-hint">
                Required for regulatory compliance and dispute records.
              </span>
            </div>

            <div className="cooling-form-field">
              <label className="cooling-form-label" htmlFor="override-safeword">
                Two-Factor Security Safe-Word / PIN
              </label>
              <input
                id="override-safeword"
                type="password"
                className="cooling-form-input"
                placeholder="Enter personal security safe-word or MPIN"
                value={safeword}
                onChange={(e) => setSafeword(e.target.value)}
              />
              <span className="cooling-form-hint">
                Confirms authorization is not being dictated by a third-party scammer.
              </span>
            </div>

            <div className="cooling-disclaimer-box">
              <span className="cooling-disclaimer-box__icon">⚖️</span>
              <p className="cooling-disclaimer-box__text">
                <strong>Statutory Notice:</strong> Overriding this hold initiates a mandatory cooling window. If you suspect you are currently talking to an impersonator or being coerced, hang up the phone immediately and dial <strong>1930</strong> (National Cyber Crime Helpline).
              </p>
            </div>

            <div className="cooling-modal-actions">
              <Button onClick={onClose} size="md" type="button" variant="ghost">
                Back to Safety Review
              </Button>
              <Button
                size="md"
                type="submit"
                loading={isSubmitting}
                className="cooling-submit-btn"
              >
                Confirm &amp; Start Cooling Period
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}
