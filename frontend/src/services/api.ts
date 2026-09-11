import type { PaymentDraft } from '../types/payment'
import type {
  GuardianAnalysisResult,
  GuardianDecision,
  GuardianFrictionLevel,
  GuardianRiskLevel,
  GuardianSignalSeverity,
  GuardianTimelineStage,
  GuardianUiMode,
  GuardianVerificationStatus,
  MlTelemetry,
  VectorMatch,
  VerificationCheck,
  VerificationResults,
} from '../types/guardian'

export interface GuardianApiAdapter<TResult> {
  analyze(payment: PaymentDraft): Promise<TResult>
}

export type GuardianMode = 'real' | 'mock'

export const guardianMode: GuardianMode = import.meta.env.VITE_GUARDIAN_MODE === 'mock' ? 'mock' : 'real'
export const backendBaseUrl = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000').replace(/\/+$/, '')

const ANALYZE_PATH = '/api/payments/analyze'
const REQUEST_TIMEOUT_MS = 30_000

export class GuardianApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GuardianApiError'
  }
}

interface GuardianAnalysisRequest {
  recipient: string
  amount: number
  currency: PaymentDraft['currency']
  reason: string
  user_id: string
  payment_type: 'UPI'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.includes(value as T)
}

function parseVerificationCheck(value: unknown): VerificationCheck {
  if (!isRecord(value) || !isString(value.check_name) || !isOneOf<GuardianVerificationStatus>(value.status, ['PASSED', 'FAILED', 'ANOMALOUS']) || !isString(value.summary) || !isRecord(value.details)) {
    throw new GuardianApiError('Guardian returned an invalid verification result.')
  }

  return {
    check_name: value.check_name,
    status: value.status,
    summary: value.summary,
    details: value.details,
  }
}

function parseVerificationResults(value: unknown): VerificationResults {
  if (!isRecord(value)) {
    throw new GuardianApiError('Guardian returned no verification results.')
  }

  return Object.fromEntries(
    Object.entries(value).map(([toolName, check]) => [toolName, parseVerificationCheck(check)]),
  )
}

function parseVectorMatch(value: unknown): VectorMatch | null {
  if (value === null || value === undefined) return null

  if (!isRecord(value) || !isString(value.pattern_id) || !isString(value.pattern_name) || !isString(value.category) || !isFiniteNumber(value.similarity_score) || !isFiniteNumber(value.similarity_pct) || !isString(value.summary) || !isString(value.reference_sample) || !isFiniteNumber(value.score_delta)) {
    throw new GuardianApiError('Guardian returned invalid vector-match telemetry.')
  }

  return {
    pattern_id: value.pattern_id,
    pattern_name: value.pattern_name,
    category: value.category,
    similarity_score: value.similarity_score,
    similarity_pct: value.similarity_pct,
    summary: value.summary,
    reference_sample: value.reference_sample,
    score_delta: value.score_delta,
  }
}

function parseResult(value: unknown): GuardianAnalysisResult {
  if (!isRecord(value) || !isString(value.transaction_id) || !isFiniteNumber(value.risk_score) || value.risk_score < 0 || value.risk_score > 100 || !isOneOf<GuardianRiskLevel>(value.risk_level, ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) || !isOneOf<GuardianDecision>(value.decision, ['ALLOW', 'WARN', 'STEP_UP', 'HOLD', 'BLOCK']) || !isString(value.recommended_action) || !isString(value.explanation) || !isRecord(value.intervention) || !Array.isArray(value.signals) || !Array.isArray(value.timeline) || !isString(value.counterfactual) || !isRecord(value.ml_telemetry)) {
    throw new GuardianApiError('Guardian returned an invalid analysis response.')
  }

  const signals = value.signals.map((signal) => {
    if (!isRecord(signal)) {
      throw new GuardianApiError('Guardian returned an invalid risk signal.')
    }

    const referenceSample = signal.reference_sample
    if (!isString(signal.type) || !isOneOf<GuardianSignalSeverity>(signal.severity, ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) || !isFiniteNumber(signal.confidence) || signal.confidence < 0 || signal.confidence > 1 || !isString(signal.reason) || !isFiniteNumber(signal.score_delta)) {
      throw new GuardianApiError('Guardian returned an invalid risk signal.')
    }

    let parsedReferenceSample: string | undefined
    if (referenceSample !== undefined) {
      if (!isString(referenceSample)) {
        throw new GuardianApiError('Guardian returned an invalid risk signal reference.')
      }
      parsedReferenceSample = referenceSample
    }

    return {
      type: signal.type,
      severity: signal.severity,
      confidence: signal.confidence,
      reason: signal.reason,
      score_delta: signal.score_delta,
      ...(parsedReferenceSample ? { reference_sample: parsedReferenceSample } : {}),
    }
  })

  const intervention = value.intervention
  if (!isOneOf<GuardianUiMode>(intervention.ui_mode, ['SILENT', 'SOFT_WARNING', 'STEP_UP_VERIFICATION', 'PROTECTIVE_HOLD', 'HARD_BLOCK', 'STANDARD_REVIEW']) || !isOneOf<GuardianFrictionLevel>(intervention.friction_level, ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'MAXIMUM']) || !isFiniteNumber(intervention.cooling_period_seconds) || intervention.cooling_period_seconds < 0 || typeof intervention.requires_explicit_override !== 'boolean' || !isString(intervention.primary_button)) {
    throw new GuardianApiError('Guardian returned an invalid intervention.')
  }

  const timeline = value.timeline.map((event) => {
    if (!isRecord(event)) {
      throw new GuardianApiError('Guardian returned an invalid timeline event.')
    }

    const riskSnapshot = event.risk_snapshot
    if (!isString(event.timestamp) || !isOneOf<GuardianTimelineStage>(event.stage, ['OBSERVE', 'REASON', 'VERIFY', 'REASSESS', 'ACT', 'EXPLAIN']) || !isString(event.description)) {
      throw new GuardianApiError('Guardian returned an invalid timeline event.')
    }

    let parsedRiskSnapshot: number | null
    if (riskSnapshot === null) {
      parsedRiskSnapshot = null
    } else if (isFiniteNumber(riskSnapshot)) {
      parsedRiskSnapshot = riskSnapshot
    } else {
      throw new GuardianApiError('Guardian returned an invalid timeline risk snapshot.')
    }

    return {
      timestamp: event.timestamp,
      stage: event.stage,
      description: event.description,
      risk_snapshot: parsedRiskSnapshot,
    }
  })

  const telemetry = value.ml_telemetry
  if (!isFiniteNumber(telemetry.isolation_forest_score) || !isFiniteNumber(telemetry.isolation_forest_pct) || typeof telemetry.gemini_active !== 'boolean' || !isString(telemetry.gemini_model)) {
    throw new GuardianApiError('Guardian returned invalid ML telemetry.')
  }

  const mlTelemetry: MlTelemetry = {
    isolation_forest_score: telemetry.isolation_forest_score,
    isolation_forest_pct: telemetry.isolation_forest_pct,
    vector_match: parseVectorMatch(telemetry.vector_match),
    gemini_active: telemetry.gemini_active,
    gemini_model: telemetry.gemini_model,
  }

  return {
    transaction_id: value.transaction_id,
    risk_score: value.risk_score,
    risk_level: value.risk_level,
    decision: value.decision,
    recommended_action: value.recommended_action,
    signals,
    verification: parseVerificationResults(value.verification),
    explanation: value.explanation,
    intervention: {
      ui_mode: intervention.ui_mode,
      friction_level: intervention.friction_level,
      cooling_period_seconds: intervention.cooling_period_seconds,
      requires_explicit_override: intervention.requires_explicit_override,
      primary_button: intervention.primary_button,
    },
    timeline,
    counterfactual: value.counterfactual,
    ml_telemetry: mlTelemetry,
  }
}

function toRequest(payment: PaymentDraft): GuardianAnalysisRequest {
  const amount = Number(payment.amount.replace(/,/g, '').trim())
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new GuardianApiError('Enter a valid payment amount before requesting Guardian analysis.')
  }

  return {
    recipient: payment.recipient,
    amount,
    currency: payment.currency,
    reason: payment.reason,
    user_id: 'aarav',
    payment_type: 'UPI',
  }
}

async function postPaymentAction(transactionId: string, action: 'confirm' | 'cancel') {
  if (!transactionId.trim()) {
    throw new GuardianApiError('A transaction reference is required for this action.')
  }

  const response = await fetch(`${backendBaseUrl}/api/payments/${encodeURIComponent(transactionId)}/${action}`, {
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

  if (!response.ok) {
    throw new GuardianApiError(`Guardian ${action} request failed with status ${response.status}.`)
  }
}

export function confirmPayment(transactionId: string) {
  return postPaymentAction(transactionId, 'confirm')
}

export function cancelPayment(transactionId: string) {
  return postPaymentAction(transactionId, 'cancel')
}

export const realGuardianAdapter: GuardianApiAdapter<GuardianAnalysisResult> = {
  async analyze(payment) {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(`${backendBaseUrl}${ANALYZE_PATH}`, {
        body: JSON.stringify(toRequest(payment)),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new GuardianApiError(`Guardian analysis failed with status ${response.status}.`)
      }

      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        throw new GuardianApiError('Guardian returned malformed JSON.')
      }

      return parseResult(payload)
    } catch (error) {
      if (error instanceof GuardianApiError) {
        throw error
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new GuardianApiError('Guardian analysis timed out. Please try again.')
      }
      throw new GuardianApiError('Guardian is unavailable. Check the backend and try again.')
    } finally {
      window.clearTimeout(timeout)
    }
  },
}
