import type { GuardianApiAdapter } from './api'
import type {
  CancelPaymentResponse,
  ConfirmPaymentResponse,
  GuardianActionResponse,
  GuardianAnalysisResult,
  GuardianTimelineStage,
  VerificationCheck,
  VerificationResults,
  DashboardMetricsResponse,
  AuditLogsResponse,
  CounterfactualTweakInput,
  CounterfactualSimulationResult,
  OverrideResponse,
  GuardianDecision,
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
      vector_match: null,
      planner_mode: 'static_allowlisted',
      gemini_active: false,
      gemini_model: 'deterministic-demo',
    },
    react_reasoning_chain: isSuspicious ? [
      {
        step: 1,
        tool_chosen: 'detect_scam_patterns',
        reason: 'Payment note contains urgent coercion indicators (disconnection threat, verification fee). Prioritizing scam pattern vector classification.',
        risk_at_step: 35,
      },
      {
        step: 2,
        tool_chosen: 'check_recipient_profile',
        reason: 'Scam intent detected (+25 risk). Inspecting beneficiary handle age and recipient graph relationship.',
        risk_at_step: 55,
      },
      {
        step: 3,
        tool_chosen: 'check_transaction_history',
        reason: 'Recipient is unverified. Running Isolation Forest anomaly check on ₹25,000 against 90-day baseline.',
        risk_at_step: 86,
      },
      {
        step: 4,
        tool_chosen: null,
        reason: 'EARLY STOP TRIGGERED — Accumulated risk score (86/100) breached critical threshold (85). Halting 3 remaining tool calls to prevent immediate financial loss.',
        risk_at_step: 86,
      },
    ] : [
      {
        step: 1,
        tool_chosen: 'check_recipient_profile',
        reason: 'Evaluating beneficiary handle trust age and relationship history.',
        risk_at_step: 10,
      },
      {
        step: 2,
        tool_chosen: 'check_transaction_history',
        reason: 'Beneficiary has established trust record. Validating amount velocity against personal median.',
        risk_at_step: 18,
      },
      {
        step: 3,
        tool_chosen: null,
        reason: 'EARLY STOP TRIGGERED — All primary security heuristics cleared with risk score 18/100 (LOW). No additional tool invocation needed.',
        risk_at_step: 18,
      },
    ],
    graph_analysis: {
      is_hub_recipient: isSuspicious,
      unique_senders_to_recipient: isSuspicious ? 5 : 1,
      user_previously_paid: !isSuspicious,
      cascade_risk_detected: false,
      cascade_overlap_count: 0,
      user_graph_risk: isSuspicious ? 'HUB_MULE_PATTERN' : 'KNOWN_CONTACT',
      summary: isSuspicious
        ? 'Recipient receives payments from 5 unique users — identified money mule hub.'
        : 'Recipient is an existing known contact with established transaction history.',
      score_delta: isSuspicious ? 25 : -10,
      network_graph: {
        nodes: isSuspicious
          ? [
              { id: 'aarav', label: 'Aarav (You)', type: 'USER', risk_level: 'LOW', subtitle: 'Originating Account', badge: 'KYC Verified', status: 'ACTIVE' },
              { id: payment.recipient, label: payment.recipient, type: 'RECIPIENT', risk_level: 'CRITICAL', subtitle: 'Flagged Beneficiary', badge: '14 Disputes (1930)', status: 'FLAGGED' },
              { id: 'victim-1', label: 'Rajesh K.', type: 'CO_VICTIM', risk_level: 'HIGH', subtitle: 'Victim (Defrauded ₹15,000)', badge: 'Filed 1930 Report', amount: '₹15,000' },
              { id: 'victim-2', label: 'Ananya M.', type: 'CO_VICTIM', risk_level: 'HIGH', subtitle: 'Victim (Defrauded ₹22,000)', badge: 'Dispute Active', amount: '₹22,000' },
              { id: 'victim-3', label: 'Vikram T.', type: 'CO_VICTIM', risk_level: 'HIGH', subtitle: 'Victim (Defrauded ₹18,500)', badge: 'CyberCell Case', amount: '₹18,500' },
              { id: 'mule-hub-44', label: 'Mule Ring Hub #44', type: 'MULE_HUB', risk_level: 'CRITICAL', subtitle: 'Layer-2 Dispersal Wallet', badge: 'High Fan-Out', amount: '₹85,000' },
              { id: 'offramp-crypto', label: 'Crypto Cashout P2P', type: 'MULE_HUB', risk_level: 'CRITICAL', subtitle: 'Rapid Liquidation Node', badge: 'Foreign IP', amount: '₹1,20,000' },
            ]
          : [
              { id: 'aarav', label: 'Aarav (You)', type: 'USER', risk_level: 'LOW', subtitle: 'Originating Account', badge: 'KYC Verified', status: 'ACTIVE' },
              { id: payment.recipient, label: payment.recipient, type: 'RECIPIENT', risk_level: 'LOW', subtitle: 'Verified Contact', badge: '4 Past Payments', status: 'VERIFIED' },
              { id: 'mom@upi', label: 'Mom', type: 'SAFE_CONTACT', risk_level: 'LOW', subtitle: 'Family Contact', badge: '12 Past Payments' },
              { id: 'landlord@bank', label: 'Landlord', type: 'SAFE_CONTACT', risk_level: 'LOW', subtitle: 'Monthly Rent', badge: 'Recurring' },
            ],
        edges: isSuspicious
          ? [
              { id: 'edge-user-target', source: 'aarav', target: payment.recipient, label: 'Attempted Transfer', status: 'PENDING_HOLD', tone: 'danger', animated: true },
              { id: 'edge-vic-1', source: 'victim-1', target: payment.recipient, label: 'Defrauded ₹15,000', status: 'REPORTED', tone: 'danger', animated: true },
              { id: 'edge-vic-2', source: 'victim-2', target: payment.recipient, label: 'Defrauded ₹22,000', status: 'REPORTED', tone: 'danger', animated: true },
              { id: 'edge-vic-3', source: 'victim-3', target: payment.recipient, label: 'Defrauded ₹18,500', status: 'REPORTED', tone: 'danger', animated: true },
              { id: 'edge-mule-1', source: payment.recipient, target: 'mule-hub-44', label: 'Rapid Dispersal (88%)', status: 'MULE_HOP', tone: 'danger', animated: true },
              { id: 'edge-mule-2', source: 'mule-hub-44', target: 'offramp-crypto', label: 'Cashout Hop', status: 'MULE_HOP', tone: 'danger', animated: true },
            ]
          : [
              { id: 'edge-user-target', source: 'aarav', target: payment.recipient, label: 'Cleared Payment', status: 'CLEARED', tone: 'success', animated: false },
              { id: 'edge-user-mom', source: 'aarav', target: 'mom@upi', label: 'Regular Contact', status: 'CLEARED', tone: 'success', animated: false },
              { id: 'edge-user-landlord', source: 'aarav', target: 'landlord@bank', label: 'Verified Payee', status: 'CLEARED', tone: 'success', animated: false },
            ],
        mule_metrics: {
          fan_in_count: isSuspicious ? 5 : 1,
          mule_probability: isSuspicious ? 94 : 4,
          cluster_name: isSuspicious ? 'I4C-MULE-RING-AP44' : 'ORGANIC_PEER_NETWORK',
          velocity_alert: isSuspicious,
          layer_depth: isSuspicious ? 3 : 1,
          total_inflow_estimate: isSuspicious ? '₹1,40,500 across 48h' : 'Normal baseline activity',
        },
        collective_intelligence: {
          community_reports_count: isSuspicious ? 14 : 0,
          national_cybercrime_status: isSuspicious ? '1930 Helpline & I4C Citizen Portal Confirmed' : 'Clean Record. 0 Reports on 1930 Portal',
          mule_cluster_id: isSuspicious ? 'I4C-AP44-SCAM-RING' : null,
          fan_in_velocity: isSuspicious ? '14 incoming transfers in past 48 hours' : 'Normal (1-2 transfers / month)',
          risk_propagation_path: isSuspicious
            ? ['Aarav (Victim)', payment.recipient, 'Mule Ring Hub #44', 'Crypto Cashout P2P']
            : ['Aarav (Originator)', payment.recipient],
          reputation_score: isSuspicious ? 8 : 98,
          confidence_score: isSuspicious ? 96 : 99,
          reported_patterns: isSuspicious
            ? [
                'Electricity Power Disconnection Extortion',
                'Impersonation of State Utility Officers',
                'Multi-tier Layered Mule Laundering',
              ]
            : [],
        },
      },
    },
    sensor_analysis: isSuspicious
      ? {
          status: 'CRITICAL_COMPROMISE',
          anomalies_detected: 3,
          total_score_delta: 75,
          active_call: {
            detected: true,
            duration_seconds: 385,
            duration_formatted: '6m 25s',
            call_type: 'cellular',
            risk_attribution: '+25 (Coercion)',
          },
          screen_sharing: {
            detected: true,
            tool_name: 'AnyDesk Remote Support',
            risk_attribution: '+35 (Visual Exfiltration)',
          },
          biometric_dynamics: {
            hesitation_index: 85,
            inter_key_latency_ms: 3450,
            clipboard_paste_detected: true,
            time_to_input_seconds: 42,
            stress_band: 'CRITICAL',
            risk_attribution: '+15 (Stress Jitter)',
          },
          device_integrity: {
            developer_mode: false,
            accessibility_abuse: true,
            untrusted_keyboard: false,
            sandbox_state: 'COMPROMISED',
          },
          signals: [
            { type: 'ACTIVE_CALL_COERCION', severity: 'HIGH', confidence: 0.94, reason: 'Active voice call (6m 25s ongoing) detected during payment authoring.', score_delta: 25 },
            { type: 'REMOTE_SCREEN_SHARING_ACTIVE', severity: 'CRITICAL', confidence: 0.98, reason: 'Active screen mirroring / remote access tool (AnyDesk) detected in background.', score_delta: 35 },
            { type: 'BIOMETRIC_STRESS_HESITATION', severity: 'MEDIUM', confidence: 0.86, reason: 'Elevated keystroke hesitation latency (3.5s) and clipboard paste indicate unfamiliar handle dictation under stress.', score_delta: 15 },
          ],
          countermeasures: [
            'Disconnect ongoing voice call immediately before proceeding.',
            'Terminate background AnyDesk remote access tool.',
            'Manually verify recipient identity via an independent official channel.',
          ],
        }
      : {
          status: 'ALL_SENSORS_CLEAN',
          anomalies_detected: 0,
          total_score_delta: 0,
          active_call: {
            detected: false,
            duration_seconds: 0,
            duration_formatted: '0s',
            call_type: 'cellular',
            risk_attribution: '0 (Idle)',
          },
          screen_sharing: {
            detected: false,
            tool_name: null,
            risk_attribution: '0 (Secure)',
          },
          biometric_dynamics: {
            hesitation_index: 18,
            inter_key_latency_ms: 380,
            clipboard_paste_detected: false,
            time_to_input_seconds: 6,
            stress_band: 'NORMAL',
            risk_attribution: '0 (Normal)',
          },
          device_integrity: {
            developer_mode: false,
            accessibility_abuse: false,
            untrusted_keyboard: false,
            sandbox_state: 'HEALTHY',
          },
          signals: [],
          countermeasures: [],
        },
    manipulation_profile: isSuspicious
      ? {
          fear: 0.85,
          urgency: 0.92,
          authority: 0.78,
          greed: 0.05,
          overall_manipulation_score: 0.745,
          dominant_tactic: 'URGENCY',
          manipulation_level: 'CRITICAL',
          score_delta: 20,
        }
      : {
          fear: 0.0,
          urgency: 0.0,
          authority: 0.0,
          greed: 0.0,
          overall_manipulation_score: 0.0,
          dominant_tactic: null,
          manipulation_level: 'NONE',
          score_delta: 0,
        },
    feature_attribution: {
      top_driver: isSuspicious ? 'amount_ratio' : 'normal_baseline',
      contributions: isSuspicious
        ? {
            amount_ratio: 0.445,
            recipient_novelty: 0.278,
            reputation_deficit: 0.222,
            velocity_1h: 0.055,
          }
        : {
            amount_ratio: 0.15,
            recipient_novelty: 0.0,
            reputation_deficit: 0.0,
            velocity_1h: 0.05,
          },
      method: 'Shapley-Inspired Proportional Attribution',
    },
    handle_intelligence: {
      status: isSuspicious ? 'ANOMALOUS' : 'PASSED',
      summary: isSuspicious ? 'The demo handle contains a verification-role keyword.' : 'No suspicious handle pattern was found in the demo.',
      score_delta: isSuspicious ? 10 : 0,
    },
    pig_butchering: {
      detected: false,
      summary: 'No temporal escalation is available in frontend-only demo mode.',
      score_delta: 0,
    },
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

const mockConversationStore: Record<string, number> = {}

export async function mockConverseGuardian(
  transactionId: string,
  userAnswer?: string,
  language: 'en' | 'hinglish' | 'hi' = 'en'
) {
  const currentTurn = mockConversationStore[transactionId] || 0

  if (!userAnswer || currentTurn === 0) {
    mockConversationStore[transactionId] = 1
    let q = 'Did someone contact you by phone, SMS, or WhatsApp and ask you to make this payment?'
    if (language === 'hinglish') q = 'Kya kisi ne aapko phone, WhatsApp ya message par ye payment turant karne ko kaha?'
    if (language === 'hi') q = 'क्या किसी ने आपको फोन, एसएमएस या व्हाट्सएप पर यह भुगतान तुरंत करने का निर्देश दिया है?'

    return {
      transaction_id: transactionId,
      conversation_active: true,
      conversation_complete: false,
      turns_completed: 0,
      question: q,
      question_type: 'COERCION_CHECK',
      is_final_question: false,
      coercion_assessment: null,
    }
  }

  if (currentTurn === 1) {
    mockConversationStore[transactionId] = 2
    let q = 'Are they claiming an urgent deadline, power disconnection, account lock, or legal action if you do not pay right now?'
    if (language === 'hinglish') q = 'Kya wo bijli katne, account block hone ya police action ki dhamki dekar jaldi karne ka pressure bana rahe hain?'
    if (language === 'hi') q = 'क्या वे बिजली काटने, खाता बंद होने या कानूनी कार्रवाई की धमकी देकर जल्दी करने का दबाव बना रहे हैं?'

    return {
      transaction_id: transactionId,
      conversation_active: true,
      conversation_complete: false,
      turns_completed: 1,
      question: q,
      question_type: 'PRESSURE_CHECK',
      is_final_question: true,
      coercion_assessment: null,
    }
  }

  // Turn 2 completed -> evaluate
  mockConversationStore[transactionId] = 3
  const isCoerced = /(yes|called|told me|disconnect|urgently|police|support|scam|power|threat|haan|ha|bijli|dhamki|katne|kat)/i.test(userAnswer)

  return {
    transaction_id: transactionId,
    conversation_active: false,
    conversation_complete: true,
    turns_completed: 2,
    question: 'Guardian security assessment complete.',
    question_type: 'ASSESSMENT',
    coercion_assessment: isCoerced
      ? {
          coercion_detected: true,
          confidence: 0.94,
          updated_decision: 'BLOCK' as const,
          coercion_indicators: ['third-party phone instruction', 'urgency extortion pressure', 'authority impersonation'],
          assessment: language === 'hi'
            ? 'उच्च-विश्वास दबाव की पुष्टि: उपयोगकर्ता ने पुष्टि की कि उन्हें समय सीमा के दबाव में भुगतान करने का निर्देश दिया गया था। सुरक्षा कार्रवाई को BLOCK में अपग्रेड किया गया।'
            : language === 'hinglish'
            ? 'High-confidence coercion detected: User ne confirm kiya ki phone par deadline aur disconnection ke pressure me transfer karne ko bola gaya. Escalated to BLOCK.'
            : 'High-confidence coercion detected: User confirmed being instructed under active deadline pressure. Escalating protective action to BLOCK.',
        }
      : {
          coercion_detected: false,
          confidence: 0.88,
          updated_decision: 'HOLD' as const,
          coercion_indicators: [],
          assessment: language === 'hi'
            ? 'उपयोगकर्ता द्वारा किसी तीसरे पक्ष के दबाव की पुष्टि नहीं हुई है, लेकिन स्वतंत्र सत्यापन तक भुगतान HOLD पर रहेगा।'
            : 'No active third-party coercion confirmed by user, but transaction remains on HOLD pending recipient independent verification.',
        },
  }
}

export async function mockFetchDashboardMetrics(): Promise<DashboardMetricsResponse> {
  return {
    status: 'active',
    benchmark_label: 'Prototype / Synthetic Telemetry (PS09)',
    summary: {
      transactions_analyzed: 1251,
      high_risk_flagged: 74,
      critical_scams_detected: 34,
      payments_held: 30,
      potential_loss_prevented_inr: 915000,
      avg_decision_latency_ms: 182,
      false_positive_rate_pct: 2.1,
    },
    risk_distribution: {
      LOW: 78,
      MEDIUM: 14,
      HIGH: 5,
      CRITICAL: 3,
    },
    top_scam_patterns: [
      { pattern: 'Fake Refund / Reversal Verification', frequency: 42 },
      { pattern: 'Authority & Customer Support Impersonation', frequency: 28 },
      { pattern: 'Urgent Utility Disconnection Extortion', frequency: 19 },
      { pattern: 'Prompt Injection / Adversarial Override', frequency: 11 },
    ],
  }
}

export async function mockFetchAuditLogs(): Promise<AuditLogsResponse> {
  return {
    count: 4,
    logs: [
      {
        id: 'audit_0001',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        transaction_id: 'txn_b95fb02e',
        action: 'HOLD',
        risk_score: 100,
        signals_detected: 8,
        reason: 'Payment held because recipient is brand new with zero prior history and amount is unusually high compared to baseline spending.',
      },
      {
        id: 'audit_0002',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        transaction_id: 'txn_c81fa990',
        action: 'COERCION_EVAL:BLOCK',
        risk_score: 100,
        signals_detected: 9,
        reason: 'High-confidence coercion detected: User confirmed being instructed under active phone call deadline pressure. Escalated to BLOCK.',
      },
      {
        id: 'audit_0003',
        timestamp: new Date(Date.now() - 14400000).toISOString(),
        transaction_id: 'txn_e44d18fa',
        action: 'HOLD',
        risk_score: 85,
        signals_detected: 4,
        reason: 'Brand impersonation detected: Recipient VPA mimics official SBI desk while registered on third-party PSP.',
      },
      {
        id: 'audit_0004',
        timestamp: new Date(Date.now() - 28800000).toISOString(),
        transaction_id: 'txn_a129ef99',
        action: 'ALLOW',
        risk_score: 12,
        signals_detected: 0,
        reason: 'Payment cleared: Regular verified beneficiary with established transaction velocity and 0 dispute records.',
      },
    ],
  }
}

export async function mockSimulateCounterfactual(
  payment: PaymentDraft,
  tweaks: CounterfactualTweakInput
): Promise<CounterfactualSimulationResult> {
  const origAmount = Number(payment.amount.replace(/,/g, '').trim()) || 25000
  const simAmount = tweaks.amount ?? origAmount
  const simHistory = tweaks.prior_payment_count ?? 0
  const simUrgency = tweaks.has_urgency ?? true
  const simCall = tweaks.active_call ?? true
  const simScreen = tweaks.screen_sharing ?? true
  const simVerified = tweaks.verified_identity ?? false

  let reduction = 0
  const actions: string[] = []

  if (simAmount <= 2000 && origAmount > 10000) {
    reduction += 35
    actions.push(`Transfer amount reduced to ₹${simAmount.toLocaleString()} (below spending volatility threshold): -35 pts`)
  } else if (simAmount <= 5000 && origAmount > 10000) {
    reduction += 25
    actions.push(`Transfer amount reduced to ₹${simAmount.toLocaleString()} (moderate amount): -25 pts`)
  }

  if (simHistory >= 3) {
    reduction += 40
    actions.push(`Recipient established as trusted contact (${simHistory} prior payments): -40 pts`)
  } else if (simHistory >= 1) {
    reduction += 25
    actions.push(`Recipient has 1 prior successful payment: -25 pts`)
  }

  if (!simUrgency) {
    reduction += 20
    actions.push('Payment message cleared of artificial urgency & threat keywords: -20 pts')
  }

  if (!simCall) {
    reduction += 25
    actions.push('Active phone call disconnected (eliminates real-time voice duress): -25 pts')
  }

  if (!simScreen) {
    reduction += 35
    actions.push('Remote screen-sharing tool terminated (prevents credential exfiltration): -35 pts')
  }

  if (simVerified) {
    reduction += 25
    actions.push('Recipient identity independently verified through official registry: -25 pts')
  }

  const baseScore = 100
  const simulatedScore = Math.max(0, Math.min(100, baseScore - reduction))

  let simulatedDecision: GuardianDecision = 'HOLD'
  if (simulatedScore >= 75) simulatedDecision = 'HOLD'
  else if (simulatedScore >= 50) simulatedDecision = 'STEP_UP'
  else if (simulatedScore >= 25) simulatedDecision = 'WARN'
  else simulatedDecision = 'ALLOW'

  return {
    baseline_score: baseScore,
    baseline_decision: 'HOLD',
    simulated_score: simulatedScore,
    simulated_decision: simulatedDecision,
    score_delta: -reduction,
    required_actions: actions.length > 0 ? actions : ['Modify any parameter above to see simulated risk reduction.'],
  }
}

export async function mockRequestPaymentOverride(
  transactionId: string,
  safeword?: string,
  _reason?: string
): Promise<OverrideResponse> {
  const coolingSeconds = 14400
  const coolingEnd = new Date(Date.now() + coolingSeconds * 1000).toISOString()

  return {
    transaction_id: transactionId,
    status: 'COOLING_PERIOD_ACTIVE',
    cooling_period_seconds: coolingSeconds,
    cooling_ends_at: coolingEnd,
    safeword_verified: Boolean(safeword),
    override_allowed: true,
    message: 'User override recorded. Enforcing statutory 4-hour cooling window to protect against coercion pressure.',
  }
}

