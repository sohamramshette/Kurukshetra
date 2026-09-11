import type { PaymentDraft } from '../types/payment'
import type {
  CancelPaymentResponse,
  ConfirmPaymentResponse,
  DashboardMetrics,
  FeatureAttribution,
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
  TemporalRiskAnalysis,
  VectorMatch,
  VerificationCheck,
  VerificationResults,
  ConversationTurnResponse,
  GraphAnalysisResult,
  GraphNode,
  GraphEdge,
  SensorAnalysisResult,
  RiskSignal,
  DashboardMetricsResponse,
  AuditLogsResponse,
  CounterfactualTweakInput,
  CounterfactualSimulationResult,
  OverrideResponse,
} from '../types/guardian'
import {
  mockConverseGuardian,
  mockFetchDashboardMetrics,
  mockFetchAuditLogs,
  mockSimulateCounterfactual,
  mockRequestPaymentOverride,
} from './mockGuardian'

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

interface PaymentAnalyzeRequest {
  recipient: string
  amount: number
  currency: PaymentDraft['currency']
  reason: string
  user_id: string
  payment_type: 'UPI'
  sensor_telemetry?: Record<string, unknown>
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

function parseTemporalRisk(value: unknown): TemporalRiskAnalysis {
  if (!isRecord(value) || typeof value.detected !== 'boolean' || !isString(value.summary) || !isFiniteNumber(value.score_delta)) throw new GuardianApiError('Guardian returned invalid temporal risk analysis.')
  return { ...value, detected: value.detected, summary: value.summary, score_delta: value.score_delta }
}

function parseGraphAnalysis(value: unknown): GraphAnalysisResult | undefined {
  if (!isRecord(value)) return undefined

  let networkGraph: GraphAnalysisResult['network_graph'] = undefined
  if (isRecord(value.network_graph)) {
    const rawNodes = Array.isArray(value.network_graph.nodes) ? value.network_graph.nodes : []
    const rawEdges = Array.isArray(value.network_graph.edges) ? value.network_graph.edges : []
    const rawMule = isRecord(value.network_graph.mule_metrics) ? value.network_graph.mule_metrics : {}
    const rawIntel = isRecord(value.network_graph.collective_intelligence) ? value.network_graph.collective_intelligence : {}

    const nodes: GraphNode[] = rawNodes
      .map((n): GraphNode | null => {
        if (!isRecord(n)) return null
        return {
          id: String(n.id || ''),
          label: String(n.label || ''),
          type: (n.type as GraphNode['type']) || 'RECIPIENT',
          risk_level: (n.risk_level as GraphNode['risk_level']) || 'LOW',
          subtitle: typeof n.subtitle === 'string' ? n.subtitle : undefined,
          badge: typeof n.badge === 'string' ? n.badge : undefined,
          status: typeof n.status === 'string' ? n.status : undefined,
          amount: typeof n.amount === 'string' ? n.amount : null,
        }
      })
      .filter((n): n is GraphNode => n !== null)

    const edges: GraphEdge[] = rawEdges
      .map((e): GraphEdge | null => {
        if (!isRecord(e)) return null
        return {
          id: String(e.id || ''),
          source: String(e.source || ''),
          target: String(e.target || ''),
          label: String(e.label || ''),
          status: String(e.status || 'CLEARED'),
          tone: (e.tone as GraphEdge['tone']) || 'neutral',
          animated: Boolean(e.animated),
        }
      })
      .filter((e): e is GraphEdge => e !== null)

    networkGraph = {
      nodes,
      edges,
      mule_metrics: {
        fan_in_count: Number(rawMule.fan_in_count || 0),
        mule_probability: Number(rawMule.mule_probability || 0),
        cluster_name: String(rawMule.cluster_name || 'UNKNOWN'),
        velocity_alert: Boolean(rawMule.velocity_alert),
        layer_depth: Number(rawMule.layer_depth || 1),
        total_inflow_estimate: typeof rawMule.total_inflow_estimate === 'string' ? rawMule.total_inflow_estimate : undefined,
      },
      collective_intelligence: {
        community_reports_count: Number(rawIntel.community_reports_count || 0),
        national_cybercrime_status: String(rawIntel.national_cybercrime_status || 'Synced with 1930 Helpline'),
        mule_cluster_id: typeof rawIntel.mule_cluster_id === 'string' ? rawIntel.mule_cluster_id : null,
        fan_in_velocity: String(rawIntel.fan_in_velocity || 'Normal'),
        risk_propagation_path: Array.isArray(rawIntel.risk_propagation_path) ? rawIntel.risk_propagation_path.map(String) : [],
        reputation_score: Number(rawIntel.reputation_score ?? 98),
        confidence_score: Number(rawIntel.confidence_score ?? 95),
        reported_patterns: Array.isArray(rawIntel.reported_patterns) ? rawIntel.reported_patterns.map(String) : [],
      }
    }
  }

  return {
    is_hub_recipient: Boolean(value.is_hub_recipient),
    unique_senders_to_recipient: Number(value.unique_senders_to_recipient || 0),
    user_previously_paid: Boolean(value.user_previously_paid),
    cascade_risk_detected: Boolean(value.cascade_risk_detected),
    cascade_overlap_count: Number(value.cascade_overlap_count || 0),
    user_graph_risk: String(value.user_graph_risk || 'NORMAL_NEW'),
    summary: String(value.summary || ''),
    score_delta: Number(value.score_delta || 0),
    network_graph: networkGraph,
  }
}

function parseSensorAnalysis(value: unknown): SensorAnalysisResult | undefined {
  if (!isRecord(value)) return undefined

  const rawCall = isRecord(value.active_call) ? value.active_call : {}
  const rawScreen = isRecord(value.screen_sharing) ? value.screen_sharing : {}
  const rawBio = isRecord(value.biometric_dynamics) ? value.biometric_dynamics : {}
  const rawDev = isRecord(value.device_integrity) ? value.device_integrity : {}
  const rawSignals = Array.isArray(value.signals) ? value.signals : []
  const rawCountermeasures = Array.isArray(value.countermeasures) ? value.countermeasures : []

  const signals = rawSignals.map((s): RiskSignal | null => {
    if (!isRecord(s)) return null
    return {
      type: String(s.type || ''),
      severity: (s.severity as RiskSignal['severity']) || 'LOW',
      confidence: Number(s.confidence || 0.9),
      reason: String(s.reason || ''),
      score_delta: Number(s.score_delta || 0),
      reference_sample: typeof s.reference_sample === 'string' ? s.reference_sample : undefined,
    }
  }).filter((s): s is RiskSignal => s !== null)

  return {
    status: String(value.status || 'ALL_SENSORS_CLEAN'),
    anomalies_detected: Number(value.anomalies_detected || 0),
    total_score_delta: Number(value.total_score_delta || 0),
    active_call: {
      detected: Boolean(rawCall.detected),
      duration_seconds: Number(rawCall.duration_seconds || 0),
      duration_formatted: String(rawCall.duration_formatted || '0s'),
      call_type: String(rawCall.call_type || 'cellular'),
      risk_attribution: String(rawCall.risk_attribution || '0 (Idle)'),
    },
    screen_sharing: {
      detected: Boolean(rawScreen.detected),
      tool_name: typeof rawScreen.tool_name === 'string' ? rawScreen.tool_name : null,
      risk_attribution: String(rawScreen.risk_attribution || '0 (Secure)'),
    },
    biometric_dynamics: {
      hesitation_index: Number(rawBio.hesitation_index || 15),
      inter_key_latency_ms: Number(rawBio.inter_key_latency_ms || 0),
      clipboard_paste_detected: Boolean(rawBio.clipboard_paste_detected),
      time_to_input_seconds: Number(rawBio.time_to_input_seconds || 0),
      stress_band: (rawBio.stress_band as 'NORMAL' | 'ELEVATED' | 'CRITICAL') || 'NORMAL',
      risk_attribution: String(rawBio.risk_attribution || '0 (Normal)'),
    },
    device_integrity: {
      developer_mode: Boolean(rawDev.developer_mode),
      accessibility_abuse: Boolean(rawDev.accessibility_abuse),
      untrusted_keyboard: Boolean(rawDev.untrusted_keyboard),
      sandbox_state: (rawDev.sandbox_state as 'HEALTHY' | 'WARNING' | 'COMPROMISED') || 'HEALTHY',
    },
    signals,
    countermeasures: rawCountermeasures.filter((c): c is string => typeof c === 'string'),
  }
}

function parseManipulationProfile(value: unknown): ManipulationProfile | undefined {
  if (!isRecord(value)) return undefined
  return {
    fear: Number(value.fear || 0),
    urgency: Number(value.urgency || 0),
    authority: Number(value.authority || 0),
    greed: Number(value.greed || 0),
    overall_manipulation_score: Number(value.overall_manipulation_score || 0),
    dominant_tactic: typeof value.dominant_tactic === 'string' ? value.dominant_tactic : null,
    manipulation_level: (value.manipulation_level as ManipulationProfile['manipulation_level']) || 'NONE',
    score_delta: Number(value.score_delta || 0),
  }
}

function parseFeatureAttribution(value: unknown): FeatureAttribution | undefined {
  if (!isRecord(value)) return undefined
  const rawContributions = isRecord(value.contributions) ? value.contributions : {}
  const contributions: Record<string, number> = {}
  for (const [k, v] of Object.entries(rawContributions)) {
    contributions[k] = Number(v || 0)
  }
  return {
    top_driver: String(value.top_driver || 'amount_ratio'),
    contributions,
    method: String(value.method || 'Shapley-Inspired Proportional Attribution'),
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
    sensor_analysis: parseSensorAnalysis(value.sensor_analysis),
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
  return {
    recipient,
    amount,
    currency: payment.currency,
    reason,
    user_id: 'aarav',
    payment_type: 'UPI',
    sensor_telemetry: payment.sensor_telemetry as Record<string, unknown> | undefined,
  }
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

export async function converseGuardian(
  transactionId: string,
  userAnswer?: string,
  language: 'en' | 'hinglish' | 'hi' = 'en'
): Promise<ConversationTurnResponse> {
  if (guardianMode === 'mock') {
    return mockConverseGuardian(transactionId, userAnswer, language)
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${backendBaseUrl}/api/guardian/converse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction_id: transactionId,
        language,
        ...(userAnswer ? { user_answer: userAnswer } : {}),
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new GuardianApiError(`Guardian conversation failed with status ${response.status}.`)
    }

    const payload = await response.json()
    return payload as ConversationTurnResponse
  } catch (error) {
    if (error instanceof GuardianApiError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new GuardianApiError('Safety interview timed out. Please try again.')
    }
    // Fallback to mock conversation if network/server issue
    return mockConverseGuardian(transactionId, userAnswer, language)
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function fetchDashboardMetrics(): Promise<DashboardMetricsResponse> {
  if (guardianMode === 'mock') {
    return mockFetchDashboardMetrics()
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${backendBaseUrl}/api/dashboard/metrics`, {
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new GuardianApiError(`Failed to fetch dashboard metrics (${response.status}).`)
    }
    return (await response.json()) as DashboardMetricsResponse
  } catch (error) {
    if (error instanceof GuardianApiError) throw error
    return mockFetchDashboardMetrics()
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function fetchAuditLogs(): Promise<AuditLogsResponse> {
  if (guardianMode === 'mock') {
    return mockFetchAuditLogs()
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${backendBaseUrl}/api/guardian/audit/logs`, {
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new GuardianApiError(`Failed to fetch audit logs (${response.status}).`)
    }
    return (await response.json()) as AuditLogsResponse
  } catch (error) {
    if (error instanceof GuardianApiError) throw error
    return mockFetchAuditLogs()
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function simulateCounterfactual(
  payment: PaymentDraft,
  tweaks: CounterfactualTweakInput
): Promise<CounterfactualSimulationResult> {
  if (guardianMode === 'mock') {
    return mockSimulateCounterfactual(payment, tweaks)
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const rawReq = toRequest(payment)
    const response = await fetch(`${backendBaseUrl}/api/payments/counterfactual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment: rawReq,
        tweaks,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new GuardianApiError(`Counterfactual simulation failed (${response.status}).`)
    }

    return (await response.json()) as CounterfactualSimulationResult
  } catch (error) {
    if (error instanceof GuardianApiError) throw error
    return mockSimulateCounterfactual(payment, tweaks)
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function requestPaymentOverride(
  transactionId: string,
  safeword?: string,
  reason?: string
): Promise<OverrideResponse> {
  if (guardianMode === 'mock') {
    return mockRequestPaymentOverride(transactionId, safeword, reason)
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${backendBaseUrl}/api/payments/${transactionId}/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: reason || 'User requested cooling-period override after verifying beneficiary.',
        safeword: safeword || 'CONFIRMED',
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new GuardianApiError(`Payment override failed (${response.status}).`)
    }

    return (await response.json()) as OverrideResponse
  } catch (error) {
    if (error instanceof GuardianApiError) throw error
    return mockRequestPaymentOverride(transactionId, safeword, reason)
  } finally {
    window.clearTimeout(timeout)
  }
}


