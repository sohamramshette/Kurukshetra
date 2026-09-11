import { useState, type ChangeEvent, type FormEvent } from 'react'

import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { StatusBadge } from './ui/StatusBadge'
import type { PaymentDraft } from '../types/payment'

export type PaymentFormField = 'recipient' | 'amount' | 'reason'
export type PaymentFieldErrors = Partial<Record<PaymentFormField, string>>

export interface PaymentFormProps {
  value: PaymentDraft
  onChange: (value: PaymentDraft) => void
  onSubmit: (value: PaymentDraft) => Promise<void> | void
  isSubmitting?: boolean
  isMockMode?: boolean
}

function validatePayment(value: PaymentDraft): PaymentFieldErrors {
  const errors: PaymentFieldErrors = {}
  const recipient = value.recipient.trim()
  const amount = Number(value.amount.replace(/,/g, ''))
  const reason = value.reason.trim()

  if (!recipient) {
    errors.recipient = 'Enter the recipient email or payment identifier.'
  } else if (!/^[^\s@]+@[^\s@]+$/.test(recipient)) {
    errors.recipient = 'Enter a valid recipient email or payment identifier.'
  }

  if (!value.amount.trim()) {
    errors.amount = 'Enter an amount to continue.'
  } else if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Enter an amount greater than ₹0.'
  } else if (amount > 10000000) {
    errors.amount = 'For this demo, amounts must be below ₹1,00,00,000.'
  }

  if (!reason) {
    errors.reason = 'Add a short reason for this payment.'
  } else if (reason.length < 3) {
    errors.reason = 'Use at least 3 characters so the payment context is clear.'
  }

  return errors
}

export function PaymentForm({ isMockMode = false, isSubmitting = false, onChange, onSubmit, value }: PaymentFormProps) {
  const [errors, setErrors] = useState<PaymentFieldErrors>({})
  const [simCall, setSimCall] = useState<boolean>(Boolean(value.sensor_telemetry?.active_call || (value.amount === '25000')))
  const [simScreen, setSimScreen] = useState<boolean>(Boolean(value.sensor_telemetry?.screen_sharing || (value.recipient.includes('support'))))
  const [simHesitation, setSimHesitation] = useState<boolean>(Boolean(value.sensor_telemetry?.keystroke_dynamics?.clipboard_paste || (value.amount === '25000')))

  const updateField = (field: PaymentFormField, nextValue: string) => {
    onChange({ ...value, [field]: nextValue })
    if (errors[field]) {
      setErrors((current) => {
        const nextErrors = { ...current }
        delete nextErrors[field]
        return nextErrors
      })
    }
  }

  const handleInputChange = (field: PaymentFormField) => (event: ChangeEvent<HTMLInputElement>) => {
    updateField(field, event.target.value)
  }

  const handleReasonChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    updateField('reason', event.target.value)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validatePayment(value)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    const sensorTelemetry = {
      active_call: simCall,
      call_duration_seconds: simCall ? 340 : 0,
      call_type: 'cellular' as const,
      screen_sharing: simScreen,
      remote_app_name: simScreen ? 'AnyDesk Remote Support' : undefined,
      keystroke_dynamics: {
        inter_key_hesitation_ms: simHesitation ? 3800 : 320,
        clipboard_paste: simHesitation,
        time_to_input_seconds: simHesitation ? 38 : 7,
      },
      device_integrity: {
        developer_mode_enabled: false,
        accessibility_service_flag: simScreen,
        untrusted_keyboard: false,
      },
    }

    await onSubmit({
      ...value,
      amount: value.amount.replace(/,/g, '').trim(),
      reason: value.reason.trim(),
      recipient: value.recipient.trim(),
      sensor_telemetry: sensorTelemetry,
    })
  }

  const reasonDescribedBy = errors.reason ? 'payment-reason-hint payment-reason-error' : 'payment-reason-hint'

  return (
    <form className="payment-form" noValidate onSubmit={handleSubmit}>
      <div className="payment-form__fields">
        <Input
          autoComplete="email"
          disabled={isSubmitting}
          error={errors.recipient}
          hint="Use an email or payment identifier you recognize."
          label="Recipient"
          onChange={handleInputChange('recipient')}
          placeholder="support@merchant-demo.com"
          type="email"
          value={value.recipient}
        />

        <Input
          disabled={isSubmitting}
          error={errors.amount}
          hint="The amount will be reviewed before any payment is sent."
          inputMode="decimal"
          label="Amount"
          min="0"
          onChange={handleInputChange('amount')}
          placeholder="25,000"
          type="text"
          value={value.amount}
        />
      </div>

      <div className="payment-form__field">
        <label className="payment-form__label" htmlFor="payment-reason">Payment reason / note</label>
        <textarea
          aria-describedby={reasonDescribedBy}
          aria-invalid={Boolean(errors.reason)}
          className={errors.reason ? 'payment-form__textarea payment-form__textarea--error' : 'payment-form__textarea'}
          disabled={isSubmitting}
          id="payment-reason"
          onChange={handleReasonChange}
          placeholder="What is this payment for?"
          rows={4}
          value={value.reason}
        />
        <span className="payment-form__hint" id="payment-reason-hint">A clear reason helps keep the payment context understandable.</span>
        {errors.reason ? <span className="payment-form__error" id="payment-reason-error" role="alert">{errors.reason}</span> : null}
      </div>

      {/* Feature 4: Silent Threat Sensor Simulation & Telemetry Bar */}
      <div className="payment-sensor-sim">
        <div className="payment-sensor-sim__header">
          <div>
            <span className="payment-sensor-sim__eyebrow">📡 Silent Threat Sensors (Live Telemetry Simulator)</span>
            <p className="payment-sensor-sim__subtitle">Simulate real-world victim coercion &amp; device compromise for demo testing.</p>
          </div>
          <span className="payment-sensor-sim__badge">PS09 Feature 4</span>
        </div>

        <div className="payment-sensor-sim__chips">
          <button
            type="button"
            className={`payment-sensor-chip ${simCall ? 'payment-sensor-chip--active-danger' : ''}`}
            onClick={() => setSimCall(!simCall)}
            title="Toggle active phone call detection during payment"
          >
            <span>📞</span>
            <span>{simCall ? 'Active Call (Ongoing 5m 40s)' : 'Call Sensor: Idle'}</span>
            <span className="payment-sensor-chip__indicator" />
          </button>

          <button
            type="button"
            className={`payment-sensor-chip ${simScreen ? 'payment-sensor-chip--active-danger' : ''}`}
            onClick={() => setSimScreen(!simScreen)}
            title="Toggle background screen mirroring / AnyDesk detection"
          >
            <span>🖥️</span>
            <span>{simScreen ? 'Screen Mirror: AnyDesk RAT' : 'Screen Share: Secure'}</span>
            <span className="payment-sensor-chip__indicator" />
          </button>

          <button
            type="button"
            className={`payment-sensor-chip ${simHesitation ? 'payment-sensor-chip--active-warning' : ''}`}
            onClick={() => setSimHesitation(!simHesitation)}
            title="Toggle biometric typing hesitation & clipboard paste anomaly"
          >
            <span>⌨️</span>
            <span>{simHesitation ? 'Biometrics: High Hesitation (3.8s)' : 'Biometrics: Normal Velocity'}</span>
            <span className="payment-sensor-chip__indicator" />
          </button>
        </div>
      </div>

      <div className="payment-form__security-note">
        <StatusBadge label={isMockMode ? 'Guardian demo active' : 'Backend Guardian selected'} status="protected" />
        <span>{isMockMode ? 'Simulated review runs before this payment can complete.' : 'Guardian intercepts this payment before it can complete.'}</span>
      </div>

      <Button className="payment-form__submit" disabled={isSubmitting} loading={isSubmitting} size="lg" type="submit">
        {isSubmitting ? 'Guardian is checking this payment' : 'Pay'}
      </Button>
    </form>
  )
}
