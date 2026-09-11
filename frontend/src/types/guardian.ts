export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type GuardianDecision = 'ALLOW' | 'WARN' | 'CHALLENGE' | 'HOLD' | 'BLOCK';

export type ToolCheckStatus = 'PASSED' | 'FAILED' | 'ANOMALOUS';

export interface PaymentAnalyzeRequest {
  user_id?: string;
  recipient_id?: string;
  recipient?: string;
  amount: number;
  currency?: string;
  message?: string;
  reason?: string;
  payment_type?: string;
}

export interface RiskSignal {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  reason: string;
  score_delta: number;
  reference_sample?: string;
}

export interface VerificationCheckResult {
  check_name: string;
  status: ToolCheckStatus;
  summary: string;
  details: Record<string, any>;
}

export interface VerificationResults {
  check_recipient_profile?: VerificationCheckResult;
  check_transaction_history?: VerificationCheckResult;
  detect_scam_patterns?: VerificationCheckResult;
  verify_identity_claim?: VerificationCheckResult;
  check_recipient_reputation?: VerificationCheckResult;
  check_transaction_velocity?: VerificationCheckResult;
  [toolName: string]: VerificationCheckResult | undefined;
}

export interface SecurityTimelineEvent {
  timestamp: string;
  stage: 'OBSERVE' | 'REASON' | 'VERIFY' | 'REASSESS' | 'ACT' | 'EXPLAIN';
  description: string;
  risk_snapshot: number | null;
}

export interface InterventionPolicy {
  ui_mode: 'DIRECT_PROCEED' | 'SOFT_WARNING_BANNER' | 'INTERACTIVE_CHALLENGE' | 'PROTECTIVE_HOLD' | 'HARD_INTERCEPTION_LOCK';
  friction_level: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'MAXIMUM';
  cooling_period_seconds: number;
  requires_explicit_override: boolean;
  primary_button: string;
}

export interface VectorMatch {
  pattern_id: string;
  pattern_name: string;
  category: string;
  similarity_score: number;
  similarity_pct: number;
  summary: string;
  reference_sample: string;
  score_delta: number;
}

export interface MLTelemetry {
  isolation_forest_score: number;
  isolation_forest_pct: number;
  vector_match: VectorMatch | null;
  gemini_active: boolean;
  gemini_model: string;
}

export interface GuardianAnalysisResult {
  transaction_id: string;
  risk_score: number;
  risk_level: RiskLevel;
  decision: GuardianDecision;
  recommended_action: GuardianDecision;
  signals: RiskSignal[];
  verification: VerificationResults;
  explanation: string;
  intervention: InterventionPolicy;
  timeline: SecurityTimelineEvent[];
  counterfactual: string;
  ml_telemetry: MLTelemetry;
}

export interface ConfirmPaymentResponse {
  transaction_id: string;
  status: 'COMPLETED';
  confirmed: boolean;
}

export interface CancelPaymentResponse {
  transaction_id: string;
  status: 'CANCELLED';
}
