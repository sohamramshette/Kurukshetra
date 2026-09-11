# Requirements Document

## Introduction

This feature hardens the Kurukshetra PS09 "Agentic Guardian for Real-Time Payment Scam Interception" so that it fulfils its core mandate: protecting users **before** a suspicious transaction completes. The work spans three intertwined goals against the existing FastAPI + SQLAlchemy/Supabase backend and React/Vite frontend:

1. **Data authenticity** — Replace inline hardcoded values (per-user spending baselines, demo seeds) with data computed from a user's real transaction history in the database, backed by a versioned, clearly labeled static seed dataset used only as a documented fallback. All approximations (Isolation Forest, SHAP-style attribution, vector RAG scam patterns) must be honestly labeled in status and telemetry surfaced to users.

2. **Agentic AI activation** — Fix the broken LLM activation (the `is_configured` check rejects the user's key because it requires the "AIza" prefix) so the ReAct agentic loop actually runs, while keeping an honest, graceful deterministic fallback and a truthful engine-status indicator.

3. **Protection-before-completion workflow** — Guarantee money never moves before a decision is issued, enforce a deterministic policy over protective actions (ALLOW / WARN / STEP_UP / HOLD / BLOCK), gate high-risk transactions with human-in-the-loop confirmation and coercion interviews, keep an auditable transaction history, and behave correctly across the four PS09 demo scenarios.

The intent is to keep the existing architecture and endpoints compatible while making the system's behavior real, honest, safe, and demonstrable.

## Glossary

- **Guardian**: The overall agentic payment-security system that intercepts, analyzes, and acts on a payment request before completion.
- **Guardian_Agent**: The ReAct-style orchestrator that runs the OBSERVE → REASON → VERIFY → REASSESS → ACT → EXPLAIN pipeline. Implemented in `backend/app/guardian/agent.py`.
- **Risk_Engine**: The component that aggregates verification evidence into a numeric risk score. Implemented in `backend/app/guardian/risk_engine.py`.
- **Decision_Engine**: The deterministic policy component that maps a risk score and signals to a protective action. AI output never directly authorizes money movement. Implemented in `backend/app/guardian/decision_engine.py`.
- **LLM_Service**: The Gemini client (`backend/app/services/llm_service.py`) providing scam analysis, handle intelligence, ReAct tool planning, conversation questions, and coercion evaluation.
- **Deterministic_Engine**: The pure-Python fallback stack (Isolation Forest anomaly scoring, vector RAG, heuristics) used when the live LLM is unavailable.
- **Payment_Service**: The transaction state machine (`backend/app/services/payment_service.py`) with states ANALYZING → HELD | ALLOWED | STEP_UP | BLOCK | COOLING_PERIOD_ACTIVE → COMPLETED | CANCELLED.
- **ReAct_Loop**: The dynamic reason → select tool → act → reassess cycle inside Guardian_Agent that selects verification tools based on accumulated evidence and supports early stopping.
- **Verification_Tool**: A discrete check (recipient profile, transaction history/ML anomaly, scam pattern detection, identity claim, reputation, velocity, handle intelligence).
- **Risk_Score**: An integer in the range 0–100 representing accumulated transaction risk.
- **Risk_Level**: A category derived from Risk_Score: LOW (< 25), MEDIUM (25–49), HIGH (50–74), CRITICAL (>= 75).
- **Decision_Action** (also "protective action"): One of ALLOW, WARN, STEP_UP, HOLD, BLOCK.
- **ALLOW**: Payment may proceed to user confirmation with no friction.
- **WARN**: Payment may proceed but the user is shown an explainable caution before confirming.
- **STEP_UP**: Payment requires additional user verification (step-up authentication / interview) before it can be confirmed.
- **HOLD**: Payment is paused pending human-in-the-loop review; it cannot complete until released.
- **BLOCK**: Payment is prohibited by policy and cannot be confirmed or overridden without an explicit human-in-the-loop safeword.
- **Static_Seed_Dataset**: A versioned, clearly labeled dataset (seed SQL and/or seed module) used to populate demo data and provide documented fallback baselines. Replaces inline literals.
- **Engine_Status**: A structure reported to the client indicating whether the live LLM is active or the Deterministic_Engine fallback is in use, plus the reason for fallback.
- **Coercion_Interview**: A multi-turn conversation (`/api/guardian/converse`) that detects third-party coercion or social-engineering pressure on the user.
- **Safeword**: A user-configured secret phrase required to override a BLOCK decision, ensuring a human-in-the-loop authorization step.
- **Cooling_Period**: A mandatory time delay enforced on user overrides of high-risk transactions to defeat real-time coercion pressure.
- **Pig_Butchering**: A scam pattern of escalating payments to the same recipient culminating in a large transfer.
- **Prompt_Injection**: An attempt embedded in untrusted payment-note text to manipulate the LLM into unsafe behavior.
- **Circuit_Breaker**: A mechanism that temporarily disables live LLM calls after failures/timeouts and routes to the Deterministic_Engine.

## Requirements

### Requirement 1: Compute spending baselines from real transaction history

**User Story:** As a security engineer, I want per-user spending baselines computed from real transaction history instead of hardcoded literals, so that anomaly detection reflects each user's actual behavior.

#### Acceptance Criteria

1. WHEN the Guardian analyzes a payment for a user AND that user has at least 3 recorded transactions in the database, THE Guardian SHALL compute the user's spending baseline as the median transaction amount and a normal-range upper bound derived from that user's recorded transactions, and SHALL use these computed values in the anomaly analysis.
2. IF the database contains fewer than 3 recorded transactions for the user, THEN THE Guardian SHALL use the fallback baseline defined in the Static_Seed_Dataset AND SHALL set the baseline source field in the analysis details to a value indicating seed-derived.
3. WHERE a baseline is computed from at least 3 database transactions, THE Guardian SHALL set the baseline source field in the analysis details to a value indicating history-derived.
4. THE Guardian SHALL NOT read any per-user spending baseline value from inline literals defined in transaction_history.py.
5. WHEN a baseline is used in an analysis, THE Guardian SHALL include in the analysis details the integer count of transactions the baseline was computed from, where the count is 0 when the seed fallback is used.
6. IF the transaction-history read fails or returns no records for a user, THEN THE Guardian SHALL fall back to the Static_Seed_Dataset baseline, SHALL set the baseline source to seed-derived, AND SHALL complete the analysis without raising an unhandled error.

### Requirement 2: Versioned static seed dataset for reproducible demos

**User Story:** As a demo operator, I want all demo-only data consolidated into a versioned, clearly labeled seed dataset, so that the four demo scenarios are reproducible and no demo data is hidden in inline literals.

#### Acceptance Criteria

1. THE Static_Seed_Dataset SHALL define the demo users, recipients, prior transactions, reputation records, and fallback baselines required to reproduce all four PS09 demo scenarios.
2. THE Static_Seed_Dataset SHALL carry a single version identifier string that is recorded together with the seeded data at seed time.
3. WHEN the seed routine runs against a database containing zero seeded records, THE Guardian SHALL insert every demo user, recipient, and prior transaction defined by the Static_Seed_Dataset and SHALL record the dataset version identifier with the seeded data.
4. WHEN the seed routine runs against a database whose recorded seed version identifier equals the current Static_Seed_Dataset version identifier, THE Guardian SHALL leave all existing seeded records unchanged and SHALL insert no duplicate records.
5. WHEN the seed routine runs against a database whose recorded seed version identifier differs from the current Static_Seed_Dataset version identifier, THE Guardian SHALL reconcile the seeded records to match the current Static_Seed_Dataset and SHALL update the recorded version identifier to the current value.
6. THE Guardian SHALL source recipient reputation, velocity, graph, and emotion demo values from the Static_Seed_Dataset rather than from inline literals in service modules.

### Requirement 3: Honest labeling of AI/ML approximations

**User Story:** As a user relying on security decisions, I want the system to honestly label which analyses are heuristic approximations versus real models, so that I am not misled about the technology protecting me.

#### Acceptance Criteria

1. WHEN the Guardian returns telemetry for the Isolation Forest anomaly analysis, THE Guardian SHALL include a label identifying that analysis as a pure-Python heuristic implementation.
2. WHEN the Guardian returns telemetry for the feature attribution, THE Guardian SHALL include a label identifying the SHAP-style attribution as an approximation.
3. WHEN the Guardian returns telemetry for the vector RAG scam-pattern match, THE Guardian SHALL include a label identifying it as a fixed-pattern heuristic AND SHALL include the integer count of known patterns compared against.
4. WHERE an analysis value in the telemetry is produced by a documented heuristic fallback rather than a live model, THE Guardian SHALL set that analysis's is_fallback indicator to the boolean value true.
5. WHERE an analysis value in the telemetry is produced by a live model rather than a heuristic fallback, THE Guardian SHALL set that analysis's is_fallback indicator to the boolean value false.

### Requirement 4: Correct live-LLM activation for the deployed key format

**User Story:** As a system operator, I want the agentic LLM to actually activate with my configured API key, so that the system uses live agentic reasoning instead of silently falling back to the deterministic engine.

#### Acceptance Criteria

1. WHEN an LLM API key of at least 10 characters is configured, THE LLM_Service SHALL report the live LLM as available using validation criteria that accept the deployed key format and SHALL NOT require any fixed key prefix.
2. IF no LLM API key is configured or the configured key is shorter than 10 characters, THEN THE LLM_Service SHALL report the live LLM as unavailable and SHALL route analysis to the Deterministic_Engine.
3. WHILE the Circuit_Breaker is open, THE LLM_Service SHALL report the live LLM as unavailable and SHALL route analysis to the Deterministic_Engine.
4. IF a live LLM request exceeds the configured timeout of 4 seconds, THEN THE LLM_Service SHALL open the Circuit_Breaker for a cooldown of 60 seconds and SHALL complete the analysis using the Deterministic_Engine.

### Requirement 5: Truthful engine-status indicator

**User Story:** As a user and as a judge evaluating the demo, I want a status indicator that truthfully states whether live agentic AI or the deterministic fallback produced a decision, so that the system's honesty is verifiable.

#### Acceptance Criteria

1. WHILE the live LLM is active for an analysis, THE Guardian SHALL report Engine_Status as live-LLM with is_fallback set to false.
2. WHILE the Deterministic_Engine is used for an analysis, THE Guardian SHALL report Engine_Status as fallback with is_fallback set to true and SHALL include a non-empty fallback reason string that identifies whether the cause was a missing/invalid key or an open Circuit_Breaker.
3. THE Guardian SHALL include Engine_Status in every payment analysis response.
4. THE Engine_Status reported for an analysis SHALL match the engine that actually produced that analysis.

### Requirement 6: ReAct agentic verification loop

**User Story:** As a security engineer, I want the agent to dynamically select verification tools based on accumulated evidence with safe early stopping, so that high-risk payments are intercepted quickly and low-risk payments are not over-verified.

#### Acceptance Criteria

1. WHEN the Guardian_Agent analyzes a payment, THE Guardian_Agent SHALL execute the pipeline stages in the order OBSERVE, REASON, VERIFY, REASSESS, ACT, EXPLAIN.
2. WHILE candidate verification tools remain and the accumulated Risk_Score is below the early-stop threshold of 85, THE Guardian_Agent SHALL select and run exactly one Verification_Tool per ReAct step.
3. WHEN the accumulated Risk_Score reaches or exceeds the early-stop threshold of 85, THE Guardian_Agent SHALL stop selecting further verification tools and SHALL record the early-stop reason and the Risk_Score at the stopping step in the reasoning chain.
4. WHERE the live LLM is active, THE Guardian_Agent SHALL use the LLM to select the next Verification_Tool from the remaining-candidates list.
5. WHERE the live LLM is unavailable, THE Guardian_Agent SHALL select the next Verification_Tool using the deterministic planner heuristics.
6. IF the LLM selects a tool that is not in the remaining-candidates list, THEN THE Guardian_Agent SHALL instead select a tool from the remaining-candidates list.
7. THE Guardian_Agent SHALL record each ReAct step, including the tool chosen, the selection reason, and the Risk_Score at that step, in the reasoning chain returned with the analysis.
8. THE Guardian_Agent SHALL bound the number of ReAct steps to at most the initial candidate-tool count plus one, so that analysis always terminates.

### Requirement 7: Hybrid risk scoring and category assignment

**User Story:** As a user, I want a clear numeric risk score and category for each payment, so that I understand how risky a transaction is.

#### Acceptance Criteria

1. THE Risk_Engine SHALL produce a Risk_Score as an integer bounded to the range 0 through 100 inclusive.
2. WHEN the Risk_Score is at least 0 and below 25, THE Guardian SHALL assign Risk_Level LOW.
3. WHEN the Risk_Score is at least 25 and below 50, THE Guardian SHALL assign Risk_Level MEDIUM.
4. WHEN the Risk_Score is at least 50 and below 75, THE Guardian SHALL assign Risk_Level HIGH.
5. WHEN the Risk_Score is at least 75 and at most 100, THE Guardian SHALL assign Risk_Level CRITICAL.
6. THE Guardian SHALL include the Risk_Score and Risk_Level in the payment analysis response.

### Requirement 8: Deterministic protective-action policy

**User Story:** As a compliance owner, I want protective actions decided by deterministic policy rather than directly by the LLM, so that AI output cannot authorize money movement on its own.

#### Acceptance Criteria

1. THE Decision_Engine SHALL map every analysis to exactly one Decision_Action from the set ALLOW, WARN, STEP_UP, HOLD, BLOCK.
2. IF a Prompt_Injection signal is present, THEN THE Decision_Engine SHALL return BLOCK.
3. WHEN the Risk_Score is at least 80 and at most 100, THE Decision_Engine SHALL return a Decision_Action of HOLD or BLOCK.
4. WHEN the Risk_Score is at least 50 and below 80, THE Decision_Engine SHALL return STEP_UP, HOLD, or BLOCK.
5. WHEN the Risk_Score is at least 25 and below 50, THE Decision_Engine SHALL return WARN, STEP_UP, HOLD, or BLOCK.
6. WHEN the Risk_Score is at least 0 and below 25 and no blocking signal is present, THE Decision_Engine SHALL return ALLOW.
7. THE Decision_Engine SHALL derive the Decision_Action solely from the Risk_Score, Risk_Level, and signals, and SHALL NOT derive it from free-form LLM text.

### Requirement 9: No money movement before a decision is issued

**User Story:** As a user, I want the system to never move money before it has finished analyzing and issued a decision, so that I am protected before completion, not after.

#### Acceptance Criteria

1. WHEN a payment is submitted for analysis, THE Payment_Service SHALL create the transaction in the ANALYZING state before analysis begins, and SHALL NOT assign the COMPLETED state during the ANALYZING state.
2. THE Payment_Service SHALL NOT transition a transaction to the COMPLETED state until the Guardian has issued a Decision_Action of ALLOW, WARN, STEP_UP, HOLD, or BLOCK for that transaction.
3. IF a confirmation is requested for a transaction whose Decision_Action is BLOCK, THEN THE Payment_Service SHALL reject the confirmation, SHALL keep the transaction in its current non-COMPLETED state, and SHALL return an error response indicating the payment is blocked by policy.
4. WHEN a confirmation is requested for a transaction whose Decision_Action is HOLD, THE Payment_Service SHALL keep the transaction in the HELD state until the human-in-the-loop release step completes successfully, and only then transition it to COMPLETED.
5. WHEN a payment analysis completes with ALLOW, WARN, or STEP_UP, THE Payment_Service SHALL keep the transaction in a non-COMPLETED state until the user confirmation step succeeds.
6. IF the user confirmation step does not succeed, THEN THE Payment_Service SHALL retain the transaction in its current non-COMPLETED state and SHALL NOT move funds.

### Requirement 10: Recipient verification workflow

**User Story:** As a user, I want the system to verify the recipient before I pay, so that I am warned about new, unverified, or flagged counterparties.

#### Acceptance Criteria

1. WHEN the Guardian verifies a recipient, THE Guardian SHALL query the recipient's registration status, verification status, and prior transaction count from the database before issuing a recipient check result.
2. IF the recipient is flagged in the database, THEN THE Guardian SHALL produce a recipient check result with status FAILED and SHALL raise the Risk_Score.
3. WHEN the recipient has zero prior transactions with the user, THE Guardian SHALL classify the recipient as new and SHALL include the new-recipient classification in the analysis response.
4. WHERE the recipient is not found in the database, THE Guardian SHALL apply the heuristic fallback check and SHALL label the recipient result data source as heuristic fallback.
5. IF the database query fails or the database is unavailable, THEN THE Guardian SHALL apply the heuristic fallback check, SHALL label the recipient result data source as heuristic fallback, and SHALL still return a recipient check result rather than aborting the analysis.
6. THE Guardian SHALL include the recipient verification status, the prior transaction count, and the recipient result data source in the analysis response.

### Requirement 11: Human-in-the-loop confirmation and coercion interview

**User Story:** As a user who may be under pressure, I want high-risk payments to require my explicit confirmation and a coercion check, so that a scammer cannot rush me into completing a transfer.

#### Acceptance Criteria

1. WHEN a Decision_Action of STEP_UP or HOLD is issued, THE Guardian SHALL require a human-in-the-loop confirmation step and SHALL keep the transaction in a non-COMPLETED state until that step completes successfully.
2. WHEN a Coercion_Interview is initiated, THE Guardian SHALL conduct at least 2 completed question-and-answer turns to detect third-party instruction and urgency pressure before producing a coercion assessment.
3. IF the Coercion_Interview produces a coercion assessment with coercion_detected true, THEN THE Guardian SHALL escalate the Decision_Action to BLOCK.
4. IF the live LLM is unavailable when a Coercion_Interview question or evaluation is required, THEN THE Guardian SHALL conduct the Coercion_Interview using the deterministic question and evaluation fallback and SHALL still return a coercion assessment.
5. IF a Coercion_Interview is requested for a transaction whose Decision_Action is BLOCK, THEN THE Guardian SHALL reject the interview request and SHALL return a response indicating no conversation is possible for a blocked transaction.
6. THE Guardian SHALL record the Coercion_Interview outcome, including the escalated Decision_Action, with the transaction in the audit history.

### Requirement 12: BLOCK override requires human-in-the-loop safeword and cooling period

**User Story:** As a user protected from coercion, I want a BLOCK to be non-overridable without my safeword and a cooling delay, so that a scammer with momentary access cannot force the payment through.

#### Acceptance Criteria

1. IF an override is requested for a transaction whose Decision_Action is BLOCK and no valid Safeword is supplied, THEN THE Guardian SHALL reject the override, SHALL keep the transaction in a non-COMPLETED state, and SHALL return an error response indicating the override is not permitted.
2. IF an override is requested with a missing or invalid Safeword, THEN THE Guardian SHALL record the Safeword-verification outcome as failed and SHALL NOT begin a Cooling_Period for that transaction.
3. WHEN an override is permitted for a high-risk transaction with a valid Safeword, THE Guardian SHALL enforce a Cooling_Period of 14400 seconds before the transaction can complete, and SHALL set the transaction to the COOLING_PERIOD_ACTIVE state.
4. WHILE the Cooling_Period is active for a transaction, THE Payment_Service SHALL keep the transaction in a non-COMPLETED state and SHALL reject any confirmation request until the Cooling_Period has fully elapsed.
5. THE Guardian SHALL record every override request, its Safeword-verification outcome, and the Cooling_Period duration applied in the audit history.

### Requirement 13: Explainable security alerts

**User Story:** As a user, I want each decision explained in clear language with the evidence behind it, so that I understand why a payment was allowed, warned, held, or blocked.

#### Acceptance Criteria

1. THE Guardian SHALL include a plain-language explanation of the Decision_Action in every payment analysis response.
2. THE Guardian SHALL include the list of detected risk signals, each with a type and a human-readable reason, in the payment analysis response.
3. WHERE the live LLM is active, THE Guardian SHALL generate the explanation with the LLM.
4. IF LLM explanation generation fails or the live LLM is unavailable, THEN THE Guardian SHALL produce the explanation using the deterministic explanation fallback and SHALL still return a non-empty explanation in the analysis response.
5. THE Guardian SHALL include a counterfactual describing what change would reduce the Risk_Score, in the payment analysis response.
6. THE Guardian SHALL express the explanation and counterfactual shown to the user without technical terms that are not defined in the Glossary.

### Requirement 14: Transaction audit history

**User Story:** As a compliance owner, I want every decision, signal, and verification check recorded, so that I can review the transaction history and audit outcomes.

#### Acceptance Criteria

1. WHEN a payment analysis completes, THE Guardian SHALL record the transaction identifier, the Decision_Action, the Risk_Score, the Risk_Level, and the explanation in the audit history.
2. WHEN a payment analysis produces risk signals, THE Guardian SHALL record each signal with its type, severity, and score contribution in the audit history.
3. WHEN a payment analysis runs verification checks, THE Guardian SHALL record each check with its type, status, and result in the audit history.
4. WHEN a transaction is confirmed, cancelled, held, or overridden, THE Guardian SHALL record the resulting state change in the audit history.
5. IF the audit history database write fails or the database is unavailable, THEN THE Guardian SHALL retain the audit entry in the in-memory fallback store and SHALL label the returned entry data source as in-memory fallback.
6. WHEN the guardian audit endpoint is queried, THE Guardian SHALL return the recorded audit history, including the data source label for each entry.

### Requirement 15: Prompt-injection defense on untrusted payment notes

**User Story:** As a security engineer, I want payment-note text treated as untrusted data, so that embedded instructions cannot manipulate the agent into approving a scam.

#### Acceptance Criteria

1. THE LLM_Service SHALL treat the payment-note text as untrusted data and SHALL NOT execute instructions contained within it.
2. WHEN a Prompt_Injection attempt is detected in the payment note, THE Guardian SHALL raise a Prompt_Injection signal with type and a human-readable reason.
3. IF a Prompt_Injection signal is present, THEN THE Decision_Engine SHALL return BLOCK regardless of the numeric Risk_Score.
4. IF the live LLM is unavailable when scanning the payment note, THEN THE Guardian SHALL apply the deterministic scam-pattern fallback scan and SHALL still raise a Prompt_Injection signal when an injection phrase is matched.

### Requirement 16: Demo Scenario A — normal payment

**User Story:** As a demo operator, I want a normal payment to a known recipient to pass smoothly, so that the system does not create friction for legitimate transactions.

#### Acceptance Criteria

1. WHEN a payment is analyzed for a recipient with verified status, at least one prior completed transaction, an amount within the recipient's established baseline range, and no scam-pattern signal detected, THE Guardian SHALL compute a Risk_Score below 25 and assign Risk_Level LOW.
2. WHEN Risk_Level is LOW and no BLOCK-triggering signal (PROMPT_INJECTION_ATTEMPT, or IDENTITY_MISMATCH combined with a scam-pattern signal) is present, THE Decision_Engine SHALL return Decision_Action ALLOW.
3. WHEN the Decision_Action is ALLOW, THE Guardian SHALL permit the user to confirm the payment with intervention friction_level NONE, cooling_period 0 seconds, and no Coercion_Interview required.

### Requirement 17: Demo Scenario B — new or unverified recipient

**User Story:** As a user, I want a first-time payment to an unverified recipient to trigger a caution and recipient verification, so that I do not blindly pay a stranger.

#### Acceptance Criteria

1. WHEN a payment is analyzed for a recipient with zero prior completed transactions and verified status equal to false, THE Guardian SHALL classify the recipient as new-and-unverified and raise a NEW_UNVERIFIED_RECIPIENT signal.
2. WHEN a NEW_UNVERIFIED_RECIPIENT signal is raised and the amount is within the established baseline range such that the Risk_Score is at least 25 and below 50, THE Decision_Engine SHALL return Decision_Action WARN.
3. WHEN a NEW_UNVERIFIED_RECIPIENT signal is raised and the Risk_Score is at least 50 and below 80, THE Decision_Engine SHALL return Decision_Action STEP_UP.
4. WHEN the recipient is classified as new-and-unverified, THE Guardian SHALL include the NEW_UNVERIFIED_RECIPIENT signal, with its severity, confidence, and human-readable reason, in the signals field of the analysis response.

### Requirement 18: Demo Scenario C — suspicious payment request

**User Story:** As a user, I want a payment note that shows social-engineering cues to be flagged as suspicious, so that I am warned before I pay a scammer.

#### Acceptance Criteria

1. WHEN a payment note contains an urgency cue, an authority-impersonation cue, or a refund/prize-bait cue, THE Guardian SHALL raise the corresponding scam-pattern signal (URGENCY_PRESSURE, AUTHORITY_IMPERSONATION, or REFUND_PRIZE_BAIT).
2. WHEN at least one scam-pattern signal is raised and the resulting Risk_Score is at least 50 and below 75, THE Guardian SHALL assign Risk_Level HIGH.
3. WHEN Risk_Level is HIGH and the Risk_Score is at least 50 and below 80, THE Decision_Engine SHALL return Decision_Action STEP_UP.
4. WHEN Risk_Level is HIGH and the Risk_Score is at least 80, THE Decision_Engine SHALL return Decision_Action HOLD.
5. WHEN one or more scam-pattern signals are raised, THE Guardian SHALL include each detected manipulation tactic, with its signal type and reason, in the explanation field of the analysis response.

### Requirement 19: Demo Scenario D — high-risk transaction requiring intervention

**User Story:** As a user targeted by a high-risk scam, I want the transaction paused or blocked with a coercion interview, so that I am protected before any money moves.

#### Acceptance Criteria

1. WHEN a payment combines a new-or-flagged recipient signal, an anomalous-amount signal, and at least one scam-pattern signal such that the Risk_Score is at least 75, THE Guardian SHALL assign Risk_Level CRITICAL.
2. WHEN Risk_Level is CRITICAL and the Risk_Score is at least 80, THE Decision_Engine SHALL return Decision_Action HOLD.
3. IF a PROMPT_INJECTION_ATTEMPT signal is present, THEN THE Decision_Engine SHALL return Decision_Action BLOCK.
4. WHEN the Decision_Action is HOLD, THE Guardian SHALL require a human-in-the-loop intervention with cooling_period 120 seconds and requires_explicit_override true before any completion is possible.
5. IF the Decision_Action is BLOCK, THEN THE Payment_Service SHALL prevent completion and SHALL only permit completion after both the Safeword override and the Cooling_Period requirements are satisfied.

### Requirement 20: Backward compatibility with existing interfaces

**User Story:** As a frontend developer, I want the existing endpoints and response fields to keep working, so that the current UI continues to function after these changes.

#### Acceptance Criteria

1. THE Guardian SHALL keep the existing payment endpoints for analyze, confirm, cancel, counterfactual, and override reachable and returning a success response for a valid request.
2. THE Guardian SHALL include all of the following fields in every analyze response: transaction_id, risk_score, risk_level, decision, signals, verification, explanation, intervention, timeline, counterfactual, and engine_status.
3. WHEN a new field is added to the analyze response, THE Guardian SHALL add it without removing or renaming any field listed in criterion 2.
4. IF a request to any existing endpoint is malformed or missing a required parameter, THEN THE Guardian SHALL reject the request with an error response indicating the invalid input and SHALL leave all existing response field names unchanged.

## Correctness Properties

These invariants must hold across all requirements above and should be tested directly:

1. **No premature completion (round-trip / invariant):** For every transaction, a Decision_Action is issued before the transaction can reach COMPLETED. A transaction never transitions to COMPLETED while its analysis is pending.
2. **BLOCK is protective (invariant):** A transaction with Decision_Action BLOCK cannot reach COMPLETED without a valid Safeword and a satisfied Cooling_Period. No automated path bypasses this.
3. **Deterministic authorization (invariant):** The Decision_Action is a pure function of Risk_Score, Risk_Level, and signals. Given identical evidence, the Decision_Engine returns the same Decision_Action regardless of whether the live LLM or the Deterministic_Engine produced the evidence.
4. **Risk score bounds (invariant):** Risk_Score is always an integer in [0, 100], and Risk_Level is always consistent with the thresholds LOW < 25 <= MEDIUM < 50 <= HIGH < 75 <= CRITICAL.
5. **Truthful engine status (invariant):** The Engine_Status reported for an analysis always matches the engine that actually produced it; is_fallback is true if and only if the Deterministic_Engine was used.
6. **Honest labeling (invariant):** Any analysis value produced by a heuristic approximation carries an is_fallback or heuristic label; no approximation is presented as a live-model result.
7. **Prompt-injection safety (metamorphic):** Adding injected instructions to a payment note never lowers the Risk_Score or relaxes the Decision_Action relative to the same payment without the injection; a detected injection always yields BLOCK.
8. **Baseline provenance (invariant):** Every spending baseline used in an analysis is labeled as either history-derived or seed-derived, and is never sourced from an inline literal.
9. **Termination (invariant):** The ReAct_Loop always terminates within its bounded step count and produces a Decision_Action.
10. **Seed idempotence (idempotence):** Running the seed routine twice with the same version identifier produces the same seeded database state as running it once.
