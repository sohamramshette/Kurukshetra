export type GuardianRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type RiskLevel = GuardianRiskLevel

export type GuardianDecision = 'ALLOW' | 'WARN' | 'STEP_UP' | 'HOLD' | 'BLOCK'
export type GuardianSignalSeverity = GuardianRiskLevel
export type GuardianVerificationStatus = 'PASSED' | 'FAILED' | 'ANOMALOUS'
export type ToolCheckStatus = GuardianVerificationStatus
export type GuardianFrictionLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'MAXIMUM'
export type GuardianTimelineStage = 'OBSERVE' | 'REASON' | 'VERIFY' | 'REASSESS' | 'ACT' | 'EXPLAIN'
export type GuardianUiMode = 'SILENT' | 'SOFT_WARNING' | 'STEP_UP_VERIFICATION' | 'PROTECTIVE_HOLD' | 'HARD_BLOCK' | 'STANDARD_REVIEW'

export interface PaymentAnalyzeRequest {
  user_id?: string
  recipient_id?: string
  recipient?: string
  amount: number
  currency?: string
  message?: string
  reason?: string
  payment_type?: string
}

export interface RiskSignal {
  type: string
  severity: GuardianSignalSeverity
  confidence: number
  reason: string
  score_delta: number
  reference_sample?: string
}

export interface VerificationCheck {
  check_name: string
  status: GuardianVerificationStatus
  summary: string
  details: Record<string, unknown>
}

export type VerificationCheckResult = VerificationCheck

export interface VerificationResults {
  check_recipient_profile?: VerificationCheck
  check_transaction_history?: VerificationCheck
  detect_scam_patterns?: VerificationCheck
  verify_identity_claim?: VerificationCheck
  check_recipient_reputation?: VerificationCheck
  check_transaction_velocity?: VerificationCheck
  [toolName: string]: VerificationCheck | undefined
}

export interface GuardianIntervention {
  ui_mode: GuardianUiMode
  friction_level: GuardianFrictionLevel
  cooling_period_seconds: number
  requires_explicit_override: boolean
  primary_button: string
}

export type InterventionPolicy = GuardianIntervention

export interface GuardianTimelineEvent {
  timestamp: string
  stage: GuardianTimelineStage
  description: string
  risk_snapshot: number | null
}

export type SecurityTimelineEvent = GuardianTimelineEvent

export interface VectorMatch {
  pattern_id: string
  pattern_name: string
  category: string
  similarity_score: number
  similarity_pct: number
  summary: string
  reference_sample: string
  score_delta: number
}

export interface MlTelemetry {
  isolation_forest_score: number
  isolation_forest_pct: number
  vector_match?: VectorMatch | null
  gemini_active: boolean
  gemini_model: string
}

export type MLTelemetry = MlTelemetry

export interface ReactReasoningStep {
  step: number
  tool_chosen: string | null
  reason: string
  risk_at_step: number
}

export interface GraphNode {
  id: string
  label: string
  type: 'USER' | 'RECIPIENT' | 'MULE_HUB' | 'CO_VICTIM' | 'SAFE_CONTACT' | 'COMMUNITY_REPORT'
  risk_level: GuardianRiskLevel
  subtitle?: string
  badge?: string
  status?: string
  amount?: string | null
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  label: string
  status: 'PENDING_HOLD' | 'REPORTED' | 'MULE_HOP' | 'CLEARED' | 'SUSPICIOUS' | string
  tone: 'danger' | 'warning' | 'success' | 'neutral'
  animated?: boolean
}

export interface MuleMetrics {
  fan_in_count: number
  mule_probability: number
  cluster_name: string
  velocity_alert: boolean
  layer_depth?: number
  total_inflow_estimate?: string
}

export interface CollectiveIntelligenceData {
  community_reports_count: number
  national_cybercrime_status: string
  mule_cluster_id?: string | null
  fan_in_velocity: string
  risk_propagation_path: string[]
  reputation_score: number
  confidence_score: number
  reported_patterns: string[]
}

export interface NetworkGraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  mule_metrics: MuleMetrics
  collective_intelligence: CollectiveIntelligenceData
}

export interface GraphAnalysisResult {
  is_hub_recipient: boolean
  unique_senders_to_recipient: number
  user_previously_paid: boolean
  cascade_risk_detected: boolean
  cascade_overlap_count: number
  user_graph_risk: string
  summary: string
  score_delta: number
  network_graph?: NetworkGraphData
}

export interface ActiveCallTelemetry {
  detected: boolean
  duration_seconds: number
  duration_formatted: string
  call_type: string
  risk_attribution: string
}

export interface ScreenSharingTelemetry {
  detected: boolean
  tool_name?: string | null
  risk_attribution: string
}

export interface BiometricDynamicsTelemetry {
  hesitation_index: number
  inter_key_latency_ms: number
  clipboard_paste_detected: boolean
  time_to_input_seconds: number
  stress_band: 'NORMAL' | 'ELEVATED' | 'CRITICAL'
  risk_attribution: string
}

export interface DeviceIntegrityTelemetry {
  developer_mode: boolean
  accessibility_abuse: boolean
  untrusted_keyboard: boolean
  sandbox_state: 'HEALTHY' | 'WARNING' | 'COMPROMISED'
}

export interface SensorAnalysisResult {
  status: string
  anomalies_detected: number
  total_score_delta: number
  active_call: ActiveCallTelemetry
  screen_sharing: ScreenSharingTelemetry
  biometric_dynamics: BiometricDynamicsTelemetry
  device_integrity: DeviceIntegrityTelemetry
  signals: RiskSignal[]
  countermeasures: string[]
}

export interface GuardianAnalysisResult {
  transaction_id: string
  risk_score: number
  risk_level: GuardianRiskLevel
  decision: GuardianDecision
  recommended_action: string
  signals: RiskSignal[]
  verification: VerificationResults
  explanation: string
  intervention: GuardianIntervention
  timeline: GuardianTimelineEvent[]
  counterfactual: string
  ml_telemetry: MlTelemetry
  react_reasoning_chain?: ReactReasoningStep[]
  graph_analysis?: GraphAnalysisResult
  sensor_analysis?: SensorAnalysisResult
  manipulation_profile?: ManipulationProfile
  feature_attribution?: FeatureAttribution
}

export interface ManipulationProfile {
  fear: number
  urgency: number
  authority: number
  greed: number
  overall_manipulation_score: number
  dominant_tactic?: string | null
  manipulation_level: 'NONE' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  score_delta: number
}

export interface FeatureAttribution {
  top_driver: string
  contributions: Record<string, number>
  method: string
}

export interface DashboardSummary {
  transactions_analyzed: number
  high_risk_flagged: number
  critical_scams_detected: number
  payments_held: number
  potential_loss_prevented_inr: number
  avg_decision_latency_ms: number
  false_positive_rate_pct: number
}

export interface DashboardRiskDistribution {
  LOW: number
  MEDIUM: number
  HIGH: number
  CRITICAL: number
}

export interface DashboardScamPattern {
  pattern: string
  frequency: number
}

export interface DashboardMetricsResponse {
  status: string
  benchmark_label: string
  summary: DashboardSummary
  risk_distribution: DashboardRiskDistribution
  top_scam_patterns: DashboardScamPattern[]
}

export interface AuditLogEntry {
  id: string
  timestamp: string
  transaction_id: string
  action: string
  risk_score: number
  signals_detected: number
  reason: string
}

export interface AuditLogsResponse {
  count: number
  logs: AuditLogEntry[]
}

export interface ConfirmPaymentResponse {
  transaction_id: string
  status: 'COMPLETED'
  confirmed: boolean
}

export interface CancelPaymentResponse {
  transaction_id: string
  status: 'CANCELLED'
}

export interface CoercionAssessment {
  coercion_detected: boolean
  confidence: number
  updated_decision: GuardianDecision
  coercion_indicators: string[]
  assessment: string
}

export interface ConversationTurnResponse {
  transaction_id: string
  conversation_active: boolean
  conversation_complete: boolean
  turns_completed: number
  question: string
  question_type?: string
  is_final_question?: boolean
  coercion_assessment?: CoercionAssessment | null
  message?: string
}

export interface CounterfactualTweakInput {
  amount?: number
  prior_payment_count?: number
  has_urgency?: boolean
  active_call?: boolean
  screen_sharing?: boolean
  verified_identity?: boolean
}

export interface CounterfactualSimulationResult {
  baseline_score: number
  baseline_decision: GuardianDecision
  simulated_score: number
  simulated_decision: GuardianDecision
  score_delta: number
  required_actions: string[]
}

export interface OverrideResponse {
  transaction_id: string
  status: 'COOLING_PERIOD_ACTIVE'
  cooling_period_seconds: number
  cooling_ends_at: string
  safeword_verified: boolean
  override_allowed: boolean
  message: string
}

