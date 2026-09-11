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
