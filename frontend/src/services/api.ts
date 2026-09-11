import type { PaymentDraft } from '../types/payment'
import type {
  CancelPaymentResponse,
  ConfirmPaymentResponse,
  DashboardMetrics,
  FeatureAttribution,
  GraphAnalysis,
  GuardianActionResponse,
  GuardianAnalysisResult,
  GuardianDecision,
  GuardianFrictionLevel,
  GuardianLifecycle,
  GuardianLifecycleStatus,
  GuardianRiskLevel,
  GuardianSignalSeverity,
  GuardianTimelineStage,
  GuardianUiMode,
  GuardianVerificationStatus,
  HandleIntelligence,
  ManipulationProfile,
  MlTelemetry,
  PaymentAnalyzeRequest,
  TemporalRiskAnalysis,
  VectorMatch,
  VerificationCheck,
  VerificationResults,
} from '../types/guardian'

export type GuardianMode = 'real' | 'mock'

export interface GuardianApiAdapter<TResult> {
  readonly source: GuardianMode
  analyze(payment: PaymentDraft, analysisIdempotencyKey: string): Promise<TResult>
  acknowledgeGuidance(result: TResult, idempotencyKey: string): Promise<GuardianActionResponse>
  confirm(result: TResult, idempotencyKey: string): Promise<ConfirmPaymentResponse>
  cancel(result: TResult, idempotencyKey: string): Promise<CancelPaymentResponse>
}

export const guardianMode: GuardianMode = import.meta.env.VITE_GUARDIAN_MODE === 'mock' ? 'mock' : 'real'
export const backendBaseUrl = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000').replace(/\/+$/, '')

const ANALYZE_PATH = '/api/payments/analyze'
const REQUEST_TIMEOUT_MS = 30_000
const lifecycleStatuses: GuardianLifecycleStatus[] = [
  'AWAITING_CONFIRMATION', 'WARN_ACKNOWLEDGEMENT_REQUIRED', 'WARN_ACKNOWLEDGED',
  'STEP_UP_ACKNOWLEDGEMENT_REQUIRED', 'STEP_UP_ACKNOWLEDGED', 'HELD', 'BLOCKED', 'COMPLETED', 'CANCELLED',
]

export class GuardianApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GuardianApiError'
  }
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
  return { check_name: value.check_name, status: value.status, summary: value.summary, details: value.details }
}

function parseVerificationResults(value: unknown): VerificationResults {
  if (!isRecord(value)) throw new GuardianApiError('Guardian returned no verification results.')
  return Object.fromEntries(Object.entries(value).map(([toolName, check]) => [toolName, parseVerificationCheck(check)]))
}

function parseVectorMatch(value: unknown): VectorMatch | null {
  if (value === null || value === undefined) return null
  if (!isRecord(value) || !isString(value.pattern_id) || !isString(value.pattern_name) || !isString(value.category) || !isFiniteNumber(value.similarity_score) || !isFiniteNumber(value.similarity_pct) || !isString(value.summary) || !isString(value.reference_sample) || !isFiniteNumber(value.score_delta)) {
    throw new GuardianApiError('Guardian returned invalid vector-match telemetry.')
  }
  return {
    pattern_id: value.pattern_id, pattern_name: value.pattern_name, category: value.category,
    similarity_score: value.similarity_score, similarity_pct: value.similarity_pct,
    summary: value.summary, reference_sample: value.reference_sample, score_delta: value.score_delta,
  }
}

function parseLifecycle(value: unknown): GuardianLifecycle {
  if (!isRecord(value) || !isOneOf<GuardianLifecycleStatus>(value.status, lifecycleStatuses) || !Number.isInteger(value.state_version) || (value.state_version as number) < 1 || typeof value.confirmation_allowed !== 'boolean' || typeof value.requires_independent_guidance_acknowledgement !== 'boolean' || typeof value.independent_guidance_acknowledged !== 'boolean') {
    throw new GuardianApiError('Guardian returned an invalid payment lifecycle state.')
  }
  const guidanceTextVersion = value.guidance_text_version
  const coolingEndsAt = value.cooling_ends_at
  if (guidanceTextVersion !== null && guidanceTextVersion !== 'independent-contact-v1') {
    throw new GuardianApiError('Guardian returned an invalid guidance acknowledgement policy.')
  }
  if (coolingEndsAt !== null && (typeof coolingEndsAt !== 'string' || Number.isNaN(Date.parse(coolingEndsAt)))) {
    throw new GuardianApiError('Guardian returned an invalid cooling period.')
  }
  return {
    status: value.status,
    state_version: value.state_version as number,
    confirmation_allowed: value.confirmation_allowed,
    requires_independent_guidance_acknowledgement: value.requires_independent_guidance_acknowledgement,
    independent_guidance_acknowledged: value.independent_guidance_acknowledged,
    guidance_text_version: guidanceTextVersion as 'independent-contact-v1' | null,
    cooling_ends_at: coolingEndsAt as string | null,
  }
}

function parseFeatureAttribution(value: unknown): FeatureAttribution {
  if (!isRecord(value) || !isString(value.top_driver) || !isString(value.method) || !isRecord(value.contributions)) {
    throw new GuardianApiError('Guardian returned invalid feature attribution.')
  }
  const contributions = Object.fromEntries(Object.entries(value.contributions).map(([name, contribution]) => {
    if (!isFiniteNumber(contribution)) throw new GuardianApiError('Guardian returned invalid feature attribution values.')
    return [name, contribution]
  }))
  return { top_driver: value.top_driver, method: value.method, contributions }
}

function parseReasoningChain(value: unknown) {
  if (!Array.isArray(value)) throw new GuardianApiError('Guardian returned no agent reasoning trace.')
  return value.map((entry) => {
    if (!isRecord(entry) || !Number.isInteger(entry.step) || (entry.tool_chosen !== null && !isString(entry.tool_chosen)) || !isString(entry.reason) || !isFiniteNumber(entry.risk_at_step) || !isFiniteNumber(entry.risk_after_step) || !isFiniteNumber(entry.score_delta) || !isOneOf(entry.result_status, ['PASSED', 'FAILED', 'ANOMALOUS', 'NOT_RUN'] as const) || !isString(entry.result_summary)) {
      throw new GuardianApiError('Guardian returned an invalid agent reasoning step.')
    }
    return {
      step: entry.step as number,
      tool_chosen: entry.tool_chosen as string | null,
      reason: entry.reason,
      risk_at_step: entry.risk_at_step,
      risk_after_step: entry.risk_after_step,
      score_delta: entry.score_delta,
      result_status: entry.result_status,
      result_summary: entry.result_summary,
    }
  })
}

function parseHandleIntelligence(value: unknown): HandleIntelligence {
  if (!isRecord(value) || !isOneOf<GuardianVerificationStatus>(value.status, ['PASSED', 'FAILED', 'ANOMALOUS']) || !isString(value.summary) || !isFiniteNumber(value.score_delta)) throw new GuardianApiError('Guardian returned invalid handle intelligence.')
  return { ...value, status: value.status, summary: value.summary, score_delta: value.score_delta }
}

function parseGraphAnalysis(value: unknown): GraphAnalysis {
  if (!isRecord(value) || !isString(value.user_graph_risk) || !isString(value.summary) || !isFiniteNumber(value.score_delta)) throw new GuardianApiError('Guardian returned invalid graph analysis.')
  return { ...value, user_graph_risk: value.user_graph_risk, summary: value.summary, score_delta: value.score_delta }
}

function parseTemporalRisk(value: unknown): TemporalRiskAnalysis {
  if (!isRecord(value) || typeof value.detected !== 'boolean' || !isString(value.summary) || !isFiniteNumber(value.score_delta)) throw new GuardianApiError('Guardian returned invalid temporal risk analysis.')
  return { ...value, detected: value.detected, summary: value.summary, score_delta: value.score_delta }
}

function parseManipulationProfile(value: unknown): ManipulationProfile {
  if (!isRecord(value) || !isFiniteNumber(value.fear) || !isFiniteNumber(value.urgency) || !isFiniteNumber(value.authority) || !isFiniteNumber(value.greed) || !isFiniteNumber(value.overall_manipulation_score) || (value.dominant_tactic !== null && !isString(value.dominant_tactic)) || !isString(value.manipulation_level) || !isFiniteNumber(value.score_delta)) throw new GuardianApiError('Guardian returned invalid manipulation telemetry.')
  return {
    fear: value.fear, urgency: value.urgency, authority: value.authority, greed: value.greed,
    overall_manipulation_score: value.overall_manipulation_score,
    dominant_tactic: value.dominant_tactic as string | null,
    manipulation_level: value.manipulation_level, score_delta: value.score_delta,
  }
}

function parseResult(value: unknown): GuardianAnalysisResult {
  if (!isRecord(value) || !isString(value.transaction_id) || !isString(value.action_token) || !isFiniteNumber(value.risk_score) || value.risk_score < 0 || value.risk_score > 100 || !isOneOf<GuardianRiskLevel>(value.risk_level, ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) || !isOneOf<GuardianDecision>(value.decision, ['ALLOW', 'WARN', 'STEP_UP', 'HOLD', 'BLOCK']) || !isString(value.recommended_action) || !isString(value.explanation) || !isRecord(value.intervention) || !Array.isArray(value.signals) || !Array.isArray(value.timeline) || !isString(value.counterfactual) || !isRecord(value.ml_telemetry)) {
    throw new GuardianApiError('Guardian returned an invalid analysis response.')
  }
  const signals = value.signals.map((signal) => {
    if (!isRecord(signal) || !isString(signal.type) || !isOneOf<GuardianSignalSeverity>(signal.severity, ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) || !isFiniteNumber(signal.confidence) || signal.confidence < 0 || signal.confidence > 1 || !isString(signal.reason) || !isFiniteNumber(signal.score_delta)) {
      throw new GuardianApiError('Guardian returned an invalid risk signal.')
    }
    if (signal.reference_sample !== undefined && !isString(signal.reference_sample)) throw new GuardianApiError('Guardian returned an invalid risk signal reference.')
    return { type: signal.type, severity: signal.severity, confidence: signal.confidence, reason: signal.reason, score_delta: signal.score_delta, ...(isString(signal.reference_sample) ? { reference_sample: signal.reference_sample } : {}) }
  })
  const intervention = value.intervention
  if (!isOneOf<GuardianUiMode>(intervention.ui_mode, ['SILENT', 'SOFT_WARNING', 'STEP_UP_VERIFICATION', 'PROTECTIVE_HOLD', 'HARD_BLOCK', 'STANDARD_REVIEW']) || !isOneOf<GuardianFrictionLevel>(intervention.friction_level, ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'MAXIMUM']) || !isFiniteNumber(intervention.cooling_period_seconds) || intervention.cooling_period_seconds < 0 || typeof intervention.requires_explicit_override !== 'boolean' || !isString(intervention.primary_button)) {
    throw new GuardianApiError('Guardian returned an invalid intervention.')
  }
  const timeline = value.timeline.map((event) => {
    if (!isRecord(event) || !isString(event.timestamp) || !isOneOf<GuardianTimelineStage>(event.stage, ['OBSERVE', 'REASON', 'VERIFY', 'REASSESS', 'ACT', 'EXPLAIN']) || !isString(event.description) || (event.risk_snapshot !== null && !isFiniteNumber(event.risk_snapshot))) {
      throw new GuardianApiError('Guardian returned an invalid timeline event.')
    }
    return { timestamp: event.timestamp, stage: event.stage, description: event.description, risk_snapshot: event.risk_snapshot as number | null }
  })
  const telemetry = value.ml_telemetry
  if (!isFiniteNumber(telemetry.isolation_forest_score) || !isFiniteNumber(telemetry.isolation_forest_pct) || !isOneOf(telemetry.planner_mode, ['gemini_react', 'static_allowlisted'] as const) || typeof telemetry.gemini_active !== 'boolean' || !isString(telemetry.gemini_model)) throw new GuardianApiError('Guardian returned invalid ML telemetry.')
  const mlTelemetry: MlTelemetry = { isolation_forest_score: telemetry.isolation_forest_score, isolation_forest_pct: telemetry.isolation_forest_pct, vector_match: parseVectorMatch(telemetry.vector_match), planner_mode: telemetry.planner_mode, gemini_active: telemetry.gemini_active, gemini_model: telemetry.gemini_model }
  return {
    transaction_id: value.transaction_id, action_token: value.action_token, lifecycle: parseLifecycle(value.lifecycle),
    risk_score: value.risk_score, risk_level: value.risk_level, decision: value.decision,
    recommended_action: value.recommended_action, signals, verification: parseVerificationResults(value.verification),
    explanation: value.explanation,
    intervention: { ui_mode: intervention.ui_mode, friction_level: intervention.friction_level, cooling_period_seconds: intervention.cooling_period_seconds, requires_explicit_override: intervention.requires_explicit_override, primary_button: intervention.primary_button },
    timeline, counterfactual: value.counterfactual,
    react_reasoning_chain: parseReasoningChain(value.react_reasoning_chain),
    handle_intelligence: parseHandleIntelligence(value.handle_intelligence),
    graph_analysis: parseGraphAnalysis(value.graph_analysis),
    pig_butchering: parseTemporalRisk(value.pig_butchering),
    manipulation_profile: parseManipulationProfile(value.manipulation_profile),
    feature_attribution: parseFeatureAttribution(value.feature_attribution),
    ml_telemetry: mlTelemetry,
  }
}

function toRequest(payment: PaymentDraft): PaymentAnalyzeRequest {
  const recipient = payment.recipient.trim()
  const amount = Number(payment.amount.replace(/,/g, '').trim())
  const reason = payment.reason.trim()
  if (!recipient || !/^[^\s@]+@[^\s@]+$/.test(recipient)) throw new GuardianApiError('Enter a valid recipient before requesting Guardian analysis.')
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) throw new GuardianApiError('Enter a valid payment amount before requesting Guardian analysis.')
  if (reason.length < 3) throw new GuardianApiError('Add a payment reason before requesting Guardian analysis.')
  return { recipient, amount, currency: payment.currency, reason, user_id: 'aarav', payment_type: 'UPI' }
}

async function requestJson(path: string, init: RequestInit, operation: string): Promise<unknown> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(`${backendBaseUrl}${path}`, { ...init, signal: controller.signal })
    let payload: unknown = null
    try { payload = await response.json() } catch { if (response.ok) throw new GuardianApiError(`${operation} returned malformed JSON.`) }
    if (!response.ok) {
      const detail = isRecord(payload) && isRecord(payload.detail) && isString(payload.detail.message) ? payload.detail.message : null
      throw new GuardianApiError(detail ? `Guardian: ${detail}` : `${operation} failed with status ${response.status}.`)
    }
    return payload
  } catch (error) {
    if (error instanceof GuardianApiError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') throw new GuardianApiError(`${operation} timed out before Guardian returned a result. Retry safely checks the same action; its final state may have changed.`)
    throw new GuardianApiError(`${operation} is unavailable before Guardian returned a result. Retry safely checks the same action; its final state may have changed.`)
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const value = await requestJson('/api/dashboard/metrics', { method: 'GET' }, 'Guardian metrics')
  if (!isRecord(value) || value.status !== 'active' || value.source !== 'persisted_guardian_transactions' || !isString(value.scope) || !isString(value.generated_at) || !isRecord(value.summary) || !isRecord(value.risk_distribution) || !isRecord(value.definitions)) {
    throw new GuardianApiError('Guardian returned invalid persisted metrics.')
  }
  const summaryKeys = ['payments_analyzed', 'threats_detected', 'payments_held', 'currently_held', 'payments_blocked', 'payments_cancelled', 'protection_rate_pct'] as const
  const summary = Object.fromEntries(summaryKeys.map((key) => {
    const metric = value.summary[key]
    if (!isFiniteNumber(metric) || metric < 0) throw new GuardianApiError('Guardian returned invalid metric values.')
    return [key, metric]
  })) as unknown as DashboardMetrics['summary']
  const riskLevels: GuardianRiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
  const riskDistribution = Object.fromEntries(riskLevels.map((level) => {
    const count = value.risk_distribution[level]
    if (!isFiniteNumber(count) || count < 0) throw new GuardianApiError('Guardian returned invalid risk distribution values.')
    return [level, count]
  })) as Record<GuardianRiskLevel, number>
  const definitions = Object.fromEntries(Object.entries(value.definitions).map(([key, definition]) => {
    if (!isString(definition)) throw new GuardianApiError('Guardian returned invalid metric definitions.')
    return [key, definition]
  }))
  return { status: 'active', source: 'persisted_guardian_transactions', scope: value.scope, generated_at: value.generated_at, summary, risk_distribution: riskDistribution, definitions }
}

export function createIdempotencyKey() {
  return window.crypto?.randomUUID?.() ?? `guardian-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function parseActionResponse(value: unknown, expectedTransactionId: string): GuardianActionResponse {
  if (!isRecord(value) || value.transaction_id !== expectedTransactionId || !isOneOf<GuardianLifecycleStatus>(value.status, lifecycleStatuses) || !Number.isInteger(value.state_version)) throw new GuardianApiError('Guardian returned an invalid payment action response.')
  const lifecycle = parseLifecycle(value.lifecycle)
  if (lifecycle.state_version !== value.state_version) throw new GuardianApiError('Guardian returned inconsistent payment state.')
  return { transaction_id: expectedTransactionId, status: value.status, state_version: value.state_version as number, lifecycle, ...(value.confirmed === true ? { confirmed: true } : {}) }
}

async function postAction(result: GuardianAnalysisResult, action: 'confirm' | 'cancel' | 'acknowledge-guidance', idempotencyKey: string): Promise<GuardianActionResponse> {
  const path = `/api/payments/${encodeURIComponent(result.transaction_id)}/${action}`
  const body = action === 'acknowledge-guidance'
    ? { expected_version: result.lifecycle.state_version, idempotency_key: idempotencyKey, kind: 'INDEPENDENT_GUIDANCE_ACK', text_version: 'independent-contact-v1', affirmed: true }
    : { expected_version: result.lifecycle.state_version, idempotency_key: idempotencyKey }
  const payload = await requestJson(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Guardian-Action-Token': result.action_token }, body: JSON.stringify(body) }, `Guardian ${action}`)
  return parseActionResponse(payload, result.transaction_id)
}

export async function confirmPayment(result: GuardianAnalysisResult, idempotencyKey: string): Promise<ConfirmPaymentResponse> {
  const response = await postAction(result, 'confirm', idempotencyKey)
  if (response.status !== 'COMPLETED' || response.confirmed !== true) throw new GuardianApiError('Guardian did not confirm this payment. It remains paused.')
  return { ...response, status: 'COMPLETED', confirmed: true }
}

export async function cancelPayment(result: GuardianAnalysisResult, idempotencyKey: string): Promise<CancelPaymentResponse> {
  const response = await postAction(result, 'cancel', idempotencyKey)
  if (response.status !== 'CANCELLED') throw new GuardianApiError('Guardian did not cancel this payment safely.')
  return { ...response, status: 'CANCELLED' }
}

export function acknowledgeGuidance(result: GuardianAnalysisResult, idempotencyKey: string) {
  return postAction(result, 'acknowledge-guidance', idempotencyKey)
}

export const realGuardianAdapter: GuardianApiAdapter<GuardianAnalysisResult> = {
  source: 'real',
  async analyze(payment, analysisIdempotencyKey) {
    const payload = await requestJson(ANALYZE_PATH, { body: JSON.stringify(toRequest(payment)), headers: { 'Content-Type': 'application/json', 'X-Guardian-Analysis-Key': analysisIdempotencyKey }, method: 'POST' }, 'Guardian analysis')
    return parseResult(payload)
  },
  acknowledgeGuidance,
  confirm: confirmPayment,
  cancel: cancelPayment,
}
