import type { GuardianApiAdapter } from './api'
import type {
  GuardianAnalysisResult,
  GuardianTimelineStage,
  VerificationCheck,
  VerificationResults,
} from '../types/guardian'
import {
  classifyDemoPayment,
  type DemoScenario,
  type PaymentDraft,
} from '../types/payment'

const verificationCheck = (check_name: string, status: VerificationCheck['status'], summary: string): VerificationCheck => ({
  check_name,
  status,
  summary,
  details: {},
})

function timeline(scenario: DemoScenario, submittedAt: string): GuardianAnalysisResult['timeline'] {
  const stages: GuardianTimelineStage[] = ['OBSERVE', 'REASON', 'VERIFY', 'REASSESS', 'ACT']
  return stages.map((stage, index) => ({
    timestamp: submittedAt,
    stage,
    description: scenario === 'suspicious'
      ? ['Payment context received for review.', 'Signals were compared with the payment context.', 'Recipient and scam-pattern checks were reviewed.', 'The risk remained elevated after verification.', 'The payment was held before processing.'][index]
      : ['Payment context received for review.', 'The payment pattern was compared with the provided reason.', 'Recipient and transaction checks were reviewed.', 'No significant risk was found in the demo context.', 'The payment was allowed to continue to the next step.'][index],
    risk_snapshot: scenario === 'suspicious' ? [10, 58, 86, 100, 100][index] : [5, 12, 18, 18, 18][index],
  }))
}

function createResult(payment: PaymentDraft, scenario: DemoScenario, submittedAt: string): GuardianAnalysisResult {
  const isSuspicious = scenario === 'suspicious'
  const transactionId = `demo-${scenario}-${payment.amount.replace(/\D/g, '') || 'payment'}`
  const recipientChecks: VerificationResults = {
    check_recipient_profile: verificationCheck('Recipient Profile & History', isSuspicious ? 'FAILED' : 'PASSED', isSuspicious ? 'This recipient is new in the demo context.' : 'The recipient is familiar in the demo context.'),
    check_transaction_history: verificationCheck('Transaction History & ML Anomaly', isSuspicious ? 'ANOMALOUS' : 'PASSED', isSuspicious ? 'The amount and recipient pattern are unusual.' : 'The payment pattern is consistent with the demo history.'),
    detect_scam_patterns: verificationCheck('Scam Intent & Language Analysis', isSuspicious ? 'FAILED' : 'PASSED', isSuspicious ? 'The payment reason uses verification language associated with scams.' : 'No scam language was detected in the demo reason.'),
    verify_identity_claim: verificationCheck('Identity Claim Verification', isSuspicious ? 'FAILED' : 'PASSED', isSuspicious ? 'The claimed payment context needs independent verification.' : 'No additional identity review is needed in this demo.'),
    check_recipient_reputation: verificationCheck('Collective Intelligence & Reputation', 'PASSED', 'No negative reputation signal is present in the demo.'),
    check_transaction_velocity: verificationCheck('Transaction Velocity & Frequency', 'PASSED', 'The demo payment frequency is within the expected range.'),
  }

  return {
    transaction_id: transactionId,
    risk_score: isSuspicious ? 86 : 18,
    risk_level: isSuspicious ? 'HIGH' : 'LOW',
    decision: isSuspicious ? 'HOLD' : 'ALLOW',
    recommended_action: isSuspicious ? 'Verify the recipient independently before continuing.' : 'This demo payment can continue to the next step.',
    signals: isSuspicious ? [
      { type: 'NEW_UNVERIFIED_RECIPIENT', severity: 'MEDIUM', confidence: 0.9, reason: 'This recipient has not been used in previous demo transactions.', score_delta: 20 },
      { type: 'UNUSUAL_AMOUNT', severity: 'HIGH', confidence: 0.93, reason: '₹25,000 is significantly above the normal demo payment amount.', score_delta: 25 },
      { type: 'SCAM_PATTERN_MATCH', severity: 'HIGH', confidence: 0.91, reason: 'The electricity disconnection and verification-fee language matches a common scam pattern.', score_delta: 25 },
      { type: 'URGENCY_PRESSURE', severity: 'HIGH', confidence: 0.88, reason: 'The request creates pressure to act before checking the recipient independently.', score_delta: 16 },
    ] : [],
    verification: recipientChecks,
    explanation: isSuspicious ? 'Guardian detected multiple suspicious signals that require verification before this payment can proceed.' : 'Guardian found no significant risk signals in this demo transaction.',
    intervention: {
      ui_mode: isSuspicious ? 'PROTECTIVE_HOLD' : 'STANDARD_REVIEW',
      friction_level: isSuspicious ? 'HIGH' : 'LOW',
      cooling_period_seconds: isSuspicious ? 120 : 0,
      requires_explicit_override: isSuspicious,
      primary_button: isSuspicious ? 'Verify Independently' : 'Continue',
    },
    timeline: timeline(scenario, submittedAt),
    counterfactual: isSuspicious ? 'Without the hold, this payment could have been sent to an unverified recipient under social pressure.' : 'The demo payment shows no material risk signal requiring additional friction.',
    ml_telemetry: {
      isolation_forest_score: isSuspicious ? 0.605 : 0.12,
      isolation_forest_pct: isSuspicious ? 60.5 : 12,
      gemini_active: false,
      gemini_model: 'deterministic-demo',
    },
  }
}

/** Deterministic frontend-only adapter for explicit offline/demo mode. */
export const mockGuardianAdapter: GuardianApiAdapter<GuardianAnalysisResult> = {
  async analyze(payment: PaymentDraft) {
    const submittedAt = new Date().toISOString()
    return createResult(payment, classifyDemoPayment(payment), submittedAt)
  },
}
