export type GuardianRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type RiskLevel = GuardianRiskLevel

export type GuardianDecision = 'ALLOW' | 'WARN' | 'STEP_UP' | 'HOLD' | 'BLOCK'
export type GuardianSignalSeverity = GuardianRiskLevel
export type GuardianVerificationStatus = 'PASSED' | 'FAILED' | 'ANOMALOUS'
export type ToolCheckStatus = GuardianVerificationStatus
export type GuardianFrictionLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'MAXIMUM'
export type GuardianTimelineStage = 'OBSERVE' | 'REASON' | 'VERIFY' | 'REASSESS' | 'ACT' | 'EXPLAIN'
export type GuardianUiMode = 'SILENT' | 'SOFT_WARNING' | 'STEP_UP_VERIFICATION' | 'PROTECTIVE_HOLD' | 'HARD_BLOCK' | 'STANDARD_REVIEW'
export type GuardianLifecycleStatus =
  | 'AWAITING_CONFIRMATION'
  | 'WARN_ACKNOWLEDGEMENT_REQUIRED'
  | 'WARN_ACKNOWLEDGED'
  | 'STEP_UP_ACKNOWLEDGEMENT_REQUIRED'
  | 'STEP_UP_ACKNOWLEDGED'
  | 'HELD'
  | 'BLOCKED'
  | 'COMPLETED'
  | 'CANCELLED'

export interface PaymentAnalyzeRequest {
  recipient: string
  amount: number
  currency: 'INR'
  reason: string
  user_id: string
  payment_type: 'UPI'
}

export interface GuardianLifecycle {
  status: GuardianLifecycleStatus
  state_version: number
  confirmation_allowed: boolean
  requires_independent_guidance_acknowledgement: boolean
  independent_guidance_acknowledged: boolean
  guidance_text_version: 'independent-contact-v1' | null
  cooling_ends_at: string | null
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
  planner_mode: 'gemini_react' | 'static_allowlisted'
  gemini_active: boolean
  gemini_model: string
}

export type MLTelemetry = MlTelemetry

export interface GuardianReasoningStep {
  step: number
  tool_chosen: string | null
  reason: string
  risk_at_step: number
  risk_after_step: number
  score_delta: number
  result_status: GuardianVerificationStatus | 'NOT_RUN'
  result_summary: string
}

export interface HandleIntelligence {
  status: GuardianVerificationStatus
  summary: string
  score_delta: number
  confidence?: number
  [key: string]: unknown
}

export interface GraphAnalysis {
  user_graph_risk: string
  summary: string
  score_delta: number
  [key: string]: unknown
}

export interface TemporalRiskAnalysis {
  detected: boolean
  summary: string
  score_delta: number
  [key: string]: unknown
}

export interface ManipulationProfile {
  fear: number
  urgency: number
  authority: number
  greed: number
  overall_manipulation_score: number
  dominant_tactic: string | null
  manipulation_level: string
  score_delta: number
}

export interface FeatureAttribution {
  top_driver: string
  contributions: Record<string, number>
  method: string
}

export interface DashboardMetrics {
  status: 'active'
  source: 'persisted_guardian_transactions'
  scope: string
  generated_at: string
  summary: {
    payments_analyzed: number
    threats_detected: number
    payments_held: number
    currently_held: number
    payments_blocked: number
    payments_cancelled: number
    protection_rate_pct: number
  }
  risk_distribution: Record<GuardianRiskLevel, number>
  definitions: Record<string, string>
}

export interface GuardianAnalysisResult {
  transaction_id: string
  /** Capability returned only for this analyzed transaction; never a project secret. */
  action_token: string
  lifecycle: GuardianLifecycle
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
  react_reasoning_chain: GuardianReasoningStep[]
  handle_intelligence: HandleIntelligence
  graph_analysis: GraphAnalysis
  pig_butchering: TemporalRiskAnalysis
  manipulation_profile: ManipulationProfile
  feature_attribution: FeatureAttribution
  ml_telemetry: MlTelemetry
}

export interface GuardianActionResponse {
  transaction_id: string
  status: GuardianLifecycleStatus
  state_version: number
  lifecycle: GuardianLifecycle
  confirmed?: boolean
}

export interface ConfirmPaymentResponse extends GuardianActionResponse {
  status: 'COMPLETED'
  confirmed: true
}

export interface CancelPaymentResponse extends GuardianActionResponse {
  status: 'CANCELLED'
}
