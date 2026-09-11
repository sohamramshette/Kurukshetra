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
  ConversationTurnResponse,
  ReactReasoningStep,
  GraphAnalysisResult,
  GraphNode,
  GraphEdge,
  SensorAnalysisResult,
  RiskSignal,
  DashboardMetricsResponse,
  AuditLogsResponse,
  ManipulationProfile,
  FeatureAttribution,
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
    ai_engine: typeof telemetry.ai_engine === 'string' ? telemetry.ai_engine : undefined,
    is_fallback: typeof telemetry.is_fallback === 'boolean' ? telemetry.is_fallback : undefined,
    fallback_reason: typeof telemetry.fallback_reason === 'string' ? telemetry.fallback_reason : undefined,
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
    react_reasoning_chain: Array.isArray(value.react_reasoning_chain)
      ? value.react_reasoning_chain.map((step) => {
          if (!isRecord(step)) return null
          return {
            step: typeof step.step === 'number' ? step.step : 0,
            tool_chosen: typeof step.tool_chosen === 'string' ? step.tool_chosen : null,
            reason: typeof step.reason === 'string' ? step.reason : '',
            risk_at_step: typeof step.risk_at_step === 'number' ? step.risk_at_step : 0,
          }
        }).filter((s): s is ReactReasoningStep => s !== null)
      : undefined,
    graph_analysis: parseGraphAnalysis(value.graph_analysis),
    sensor_analysis: parseSensorAnalysis(value.sensor_analysis),
    manipulation_profile: parseManipulationProfile(value.manipulation_profile),
    feature_attribution: parseFeatureAttribution(value.feature_attribution),
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
    sensor_telemetry: payment.sensor_telemetry as Record<string, unknown> | undefined,
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
    // Fallback to mock conversation if network/server issue (explicitly tagged)
    const fallback = await mockConverseGuardian(transactionId, userAnswer, language)
    return {
      ...fallback,
      data_source: 'mock_fallback',
      is_fallback: true,
    }
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function fetchDashboardMetrics(): Promise<DashboardMetricsResponse> {
  if (guardianMode === 'mock') {
    const mockData = await mockFetchDashboardMetrics()
    return { ...mockData, data_source: 'mock_scenario', is_fallback: true }
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
    const fallback = await mockFetchDashboardMetrics()
    return {
      ...fallback,
      data_source: 'synthetic_fallback',
      is_fallback: true,
    }
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function fetchAuditLogs(): Promise<AuditLogsResponse> {
  if (guardianMode === 'mock') {
    const mockData = await mockFetchAuditLogs()
    return {
      count: mockData.count,
      logs: mockData.logs.map((l) => ({ ...l, data_source: 'mock_scenario', is_fallback: true })),
    }
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
    const fallback = await mockFetchAuditLogs()
    return {
      count: fallback.count,
      logs: fallback.logs.map((l) => ({ ...l, data_source: 'synthetic_fallback', is_fallback: true })),
    }
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


