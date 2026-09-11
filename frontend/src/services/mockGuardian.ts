import type { GuardianApiAdapter } from './api'
import type {
  CancelPaymentResponse,
  ConfirmPaymentResponse,
  GuardianActionResponse,
  GuardianAnalysisResult,
  GuardianTimelineStage,
  VerificationCheck,
  VerificationResults,
} from '../types/guardian'
import { classifyDemoPayment, type DemoScenario, type PaymentDraft } from '../types/payment'

const verificationCheck = (check_name: string, status: VerificationCheck['status'], summary: string): VerificationCheck => ({ check_name, status, summary, details: {} })

function timeline(scenario: DemoScenario, submittedAt: string): GuardianAnalysisResult['timeline'] {
  const stages: GuardianTimelineStage[] = ['OBSERVE', 'REASON', 'VERIFY', 'REASSESS', 'ACT', 'EXPLAIN']
  return stages.map((stage, index) => ({
    timestamp: submittedAt, stage,
    description: scenario === 'suspicious'
      ? ['Payment context received for review.', 'Signals were compared with the payment context.', 'Recipient and scam-pattern checks were reviewed.', 'The risk remained elevated after verification.', 'The payment was held before processing.', 'The deterministic demo prepared its explanation.'][index]
      : ['Payment context received for review.', 'The payment pattern was compared with the provided reason.', 'Recipient and transaction checks were reviewed.', 'No significant risk was found in the demo context.', 'The payment was allowed to continue to the next step.', 'The deterministic demo prepared its explanation.'][index],
    risk_snapshot: scenario === 'suspicious' ? [10, 20, 100, 100, 100, 100][index] : [10, 10, 10, 10, 10, 10][index],
  }))
}

function createResult(payment: PaymentDraft, scenario: DemoScenario, submittedAt: string): GuardianAnalysisResult {
  const isSuspicious = scenario === 'suspicious'
  const transactionId = `demo-${scenario}-${payment.amount.replace(/\D/g, '') || 'payment'}`
  const verification: VerificationResults = {
    check_recipient_profile: verificationCheck('Recipient Profile & History', isSuspicious ? 'FAILED' : 'PASSED', isSuspicious ? 'This recipient is new in the demo context.' : 'The recipient is familiar in the demo context.'),
    check_transaction_history: verificationCheck('Transaction History & ML Anomaly', isSuspicious ? 'ANOMALOUS' : 'PASSED', isSuspicious ? 'The amount and recipient pattern are unusual.' : 'The payment pattern is consistent with the demo history.'),
    detect_scam_patterns: verificationCheck('Scam Intent & Language Analysis', isSuspicious ? 'FAILED' : 'PASSED', isSuspicious ? 'The payment reason uses verification language associated with scams.' : 'No scam language was detected in the demo reason.'),
    verify_identity_claim: verificationCheck('Identity Claim Consistency', isSuspicious ? 'FAILED' : 'PASSED', isSuspicious ? 'The claimed official role conflicts with the demo handle syntax; no external identity verification was performed.' : 'No official identity claim was present to compare; no external identity verification was performed.'),
    check_recipient_reputation: verificationCheck('Collective Intelligence & Reputation', 'PASSED', 'No negative reputation signal is present in the demo.'),
    check_transaction_velocity: verificationCheck('Transaction Velocity & Frequency', 'PASSED', 'The demo payment frequency is within the expected range.'),
  }
  return {
    transaction_id: transactionId,
    action_token: `mock-capability-${transactionId}`,
    lifecycle: {
      status: isSuspicious ? 'HELD' : 'AWAITING_CONFIRMATION', state_version: 1,
      confirmation_allowed: !isSuspicious, requires_independent_guidance_acknowledgement: isSuspicious,
      independent_guidance_acknowledged: false, guidance_text_version: isSuspicious ? 'independent-contact-v1' : null,
      cooling_ends_at: null,
    },
    risk_score: isSuspicious ? 100 : 10, risk_level: isSuspicious ? 'CRITICAL' : 'LOW', decision: isSuspicious ? 'HOLD' : 'ALLOW',
    recommended_action: isSuspicious ? 'Verify the recipient independently before continuing.' : 'This demo payment can continue to the next step.',
    signals: isSuspicious ? [
      { type: 'NEW_UNVERIFIED_RECIPIENT', severity: 'MEDIUM', confidence: 0.9, reason: 'This recipient has not been used in previous demo transactions.', score_delta: 20 },
      { type: 'UNUSUAL_AMOUNT', severity: 'HIGH', confidence: 0.93, reason: '₹25,000 is significantly above the normal demo payment amount.', score_delta: 25 },
      { type: 'SCAM_PATTERN_MATCH', severity: 'HIGH', confidence: 0.91, reason: 'The electricity disconnection and verification-fee language matches a common scam pattern.', score_delta: 25 },
      { type: 'URGENCY_PRESSURE', severity: 'HIGH', confidence: 0.88, reason: 'The request creates pressure to act before checking the recipient independently.', score_delta: 16 },
    ] : [],
    verification,
    explanation: isSuspicious ? 'Guardian detected multiple suspicious signals that require verification before this payment can proceed.' : 'Guardian found no significant risk signals in this demo transaction.',
    intervention: { ui_mode: isSuspicious ? 'PROTECTIVE_HOLD' : 'STANDARD_REVIEW', friction_level: isSuspicious ? 'HIGH' : 'LOW', cooling_period_seconds: isSuspicious ? 120 : 0, requires_explicit_override: false, primary_button: isSuspicious ? 'Review independent-contact guidance' : 'Continue' },
    timeline: timeline(scenario, submittedAt), counterfactual: isSuspicious ? 'Without the hold, this payment could have been sent to an unverified recipient under social pressure.' : 'The demo payment shows no material risk signal requiring additional friction.',
    react_reasoning_chain: [],
    handle_intelligence: { status: isSuspicious ? 'ANOMALOUS' : 'PASSED', summary: isSuspicious ? 'The demo handle contains a verification-role keyword.' : 'No suspicious handle pattern was found in the demo.', score_delta: isSuspicious ? 10 : 0 },
    graph_analysis: { user_graph_risk: isSuspicious ? 'NORMAL_NEW' : 'KNOWN_CONTACT', summary: 'Frontend-only deterministic graph demonstration.', score_delta: 0 },
    pig_butchering: { detected: false, summary: 'No temporal escalation is available in frontend-only demo mode.', score_delta: 0 },
    manipulation_profile: { fear: isSuspicious ? 0.45 : 0, urgency: isSuspicious ? 0.7 : 0, authority: isSuspicious ? 0.45 : 0, greed: 0, overall_manipulation_score: isSuspicious ? 0.458 : 0, dominant_tactic: isSuspicious ? 'URGENCY' : null, manipulation_level: isSuspicious ? 'HIGH' : 'NONE', score_delta: isSuspicious ? 12 : 0 },
    feature_attribution: { top_driver: isSuspicious ? 'amount_ratio' : 'recipient_novelty', contributions: isSuspicious ? { amount_ratio: 0.62, recipient_novelty: 0.38 } : { amount_ratio: 0, recipient_novelty: 0 }, method: 'Frontend deterministic demo attribution' },
    ml_telemetry: { isolation_forest_score: isSuspicious ? 0.605 : 0.12, isolation_forest_pct: isSuspicious ? 60.5 : 12, vector_match: null, planner_mode: 'static_allowlisted', gemini_active: false, gemini_model: 'deterministic-demo' },
  }
}

/** Deterministic frontend-only adapter for explicitly enabled offline development mode. */
export const mockGuardianAdapter: GuardianApiAdapter<GuardianAnalysisResult> = {
  source: 'mock',
  async analyze(payment, _analysisIdempotencyKey) { return createResult(payment, classifyDemoPayment(payment), new Date().toISOString()) },
  async acknowledgeGuidance(result, _idempotencyKey): Promise<GuardianActionResponse> {
    return { transaction_id: result.transaction_id, status: result.lifecycle.status, state_version: result.lifecycle.state_version + 1, lifecycle: { ...result.lifecycle, state_version: result.lifecycle.state_version + 1, requires_independent_guidance_acknowledgement: false, independent_guidance_acknowledged: true } }
  },
  async confirm(result, _idempotencyKey): Promise<ConfirmPaymentResponse> {
    return { transaction_id: result.transaction_id, status: 'COMPLETED', state_version: result.lifecycle.state_version + 1, confirmed: true, lifecycle: { ...result.lifecycle, status: 'COMPLETED', state_version: result.lifecycle.state_version + 1, confirmation_allowed: false } }
  },
  async cancel(result, _idempotencyKey): Promise<CancelPaymentResponse> {
    return { transaction_id: result.transaction_id, status: 'CANCELLED', state_version: result.lifecycle.state_version + 1, lifecycle: { ...result.lifecycle, status: 'CANCELLED', state_version: result.lifecycle.state_version + 1, confirmation_allowed: false } }
  },
}
