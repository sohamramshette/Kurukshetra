-- ============================================================================
-- KURUKSHETRA / PS09: PAYMENT GUARDIAN
-- SUPABASE SQL SCHEMA (Project: jqsppbnmxtmstlrbsyyl)
-- Single Source of Truth: brain.md Section 23 & Session 2 (S2.5, S2.8, S2.9)
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. USERS TABLE (brain.md Section 23)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    risk_profile JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. RECIPIENTS TABLE (brain.md Section 23, S2.6, S2.9)
CREATE TABLE IF NOT EXISTS public.recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT UNIQUE NOT NULL, -- UPI VPA handle e.g. "sbi-refund-kyc@okaxis"
    display_name TEXT NOT NULL,
    category TEXT DEFAULT 'INDIVIDUAL', -- FAMILY, MERCHANT, INDIVIDUAL, SUSPICIOUS_ENTITY, HIGH_RISK, MULE_ACCOUNT
    verification_status TEXT NOT NULL, -- verified, unverified, suspicious, failed, flagged
    reputation_score NUMERIC NOT NULL DEFAULT 50.0,
    is_flagged BOOLEAN DEFAULT FALSE NOT NULL,
    flag_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. TRANSACTIONS TABLE (brain.md Section 23 & S2.5)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.recipients(id) ON DELETE CASCADE,
    recipient_identifier TEXT, -- Direct UPI handle string
    amount NUMERIC NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR' NOT NULL,
    payment_type TEXT DEFAULT 'UPI' NOT NULL,
    status TEXT DEFAULT 'ANALYZING' NOT NULL, -- ANALYZING, ALLOWED, WARN, STEP_UP, HELD, BLOCKED, COMPLETED, CANCELLED
    reason TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    risk_score NUMERIC,
    risk_level TEXT, -- LOW, MEDIUM, HIGH, CRITICAL
    decision TEXT, -- ALLOW, WARN, STEP_UP, HOLD, BLOCK
    analysis_json JSONB -- Full AI telemetry (ReAct chain, SHAP, Graph, Emotion axes)
);

-- 5. RISK EVENTS TABLE (brain.md Section 8, 23 & S2.8)
CREATE TABLE IF NOT EXISTS public.risk_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    signal_type TEXT NOT NULL, -- SEMANTIC_SCAM_VECTOR_MATCH, URGENCY_PRESSURE, etc.
    severity TEXT NOT NULL, -- LOW, MEDIUM, HIGH, CRITICAL
    score_delta NUMERIC NOT NULL DEFAULT 0,
    evidence JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. VERIFICATION CHECKS TABLE (brain.md Section 10, 23 & S2.5)
CREATE TABLE IF NOT EXISTS public.verification_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    check_type TEXT NOT NULL, -- check_recipient_profile, detect_scam_patterns, handle_intelligence, etc.
    status TEXT NOT NULL, -- PASSED, FAILED, ANOMALOUS, WARNING
    result TEXT,
    evidence JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 7. GUARDIAN DECISIONS TABLE (brain.md Section 13, 23 & S2.5)
CREATE TABLE IF NOT EXISTS public.guardian_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    risk_score NUMERIC NOT NULL,
    risk_level TEXT NOT NULL, -- LOW, MEDIUM, HIGH, CRITICAL
    action TEXT NOT NULL, -- ALLOW, WARN, STEP_UP, HOLD, BLOCK
    reason TEXT,
    intervention_ui_mode TEXT, -- FRICTIONLESS, SOFT_WARNING, STEP_UP_VERIFY, PROTECTIVE_HOLD
    counterfactual TEXT,
    cooling_period_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 8. AUDIT LOGS TABLE (brain.md Section 41 & S2.5)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id TEXT,
    action TEXT NOT NULL,
    risk_score NUMERIC NOT NULL,
    signals_detected INTEGER DEFAULT 0 NOT NULL,
    reason TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 9. COERCION CONVERSATIONS TABLE (brain.md S2.5 & S2.6)
CREATE TABLE IF NOT EXISTS public.coercion_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    turn_number INTEGER NOT NULL,
    question TEXT NOT NULL,
    question_type TEXT DEFAULT 'COERCION_CHECK',
    user_answer TEXT,
    coercion_detected BOOLEAN,
    confidence NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_recipient ON public.transactions(recipient_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_recipients_identifier ON public.recipients(identifier);
CREATE INDEX IF NOT EXISTS idx_risk_events_txn ON public.risk_events(transaction_id);
CREATE INDEX IF NOT EXISTS idx_verification_checks_txn ON public.verification_checks(transaction_id);
CREATE INDEX IF NOT EXISTS idx_decisions_txn ON public.guardian_decisions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_coercion_txn ON public.coercion_conversations(transaction_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON public.audit_logs(timestamp DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coercion_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_users" ON public.users;
DROP POLICY IF EXISTS "allow_all_recipients" ON public.recipients;
DROP POLICY IF EXISTS "allow_all_transactions" ON public.transactions;
DROP POLICY IF EXISTS "allow_all_risk_events" ON public.risk_events;
DROP POLICY IF EXISTS "allow_all_verification_checks" ON public.verification_checks;
DROP POLICY IF EXISTS "allow_all_guardian_decisions" ON public.guardian_decisions;
DROP POLICY IF EXISTS "allow_all_audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "allow_all_coercion" ON public.coercion_conversations;

CREATE POLICY "allow_all_users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_recipients" ON public.recipients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_risk_events" ON public.risk_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_verification_checks" ON public.verification_checks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_guardian_decisions" ON public.guardian_decisions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_audit_logs" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_coercion" ON public.coercion_conversations FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- SEED DEMO DATA: ALL SCENARIOS A THROUGH G (brain.md Section 6, 27, 48, S2.9)
-- ============================================================================

-- Primary Demo User: Aarav Mehta
INSERT INTO public.users (id, name, risk_profile, created_at)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Aarav Mehta',
    '{"typical_payment_min": 500, "typical_payment_max": 3000, "trusted_contacts_count": 8}'::jsonb,
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Scenario Recipients A through G
INSERT INTO public.recipients (id, identifier, display_name, category, verification_status, reputation_score, is_flagged, flag_reason, created_at)
VALUES 
    (gen_random_uuid(), 'mom@upi', 'Neha Mehta (Mom)', 'FAMILY', 'verified', 99.0, FALSE, NULL, NOW()),
    (gen_random_uuid(), 'newshop@upi', 'Quick Mart Groceries', 'INDIVIDUAL', 'unverified', 50.0, FALSE, NULL, NOW()),
    (gen_random_uuid(), 'unknown@upi', 'Urgent Payment Receiver', 'INDIVIDUAL', 'unverified', 40.0, FALSE, NULL, NOW()),
    (gen_random_uuid(), 'support-verify@electricity-dept.in', 'Electricity Bill Desk (Fake)', 'SUSPICIOUS_ENTITY', 'failed', 5.0, TRUE, 'Electricity disconnection threat social engineering', NOW()),
    (gen_random_uuid(), 'sbi-refund-kyc@okaxis', 'SBI Refund & KYC Support (Fake)', 'SUSPICIOUS_ENTITY', 'failed', 0.0, TRUE, 'SBI brand impersonation and fake KYC phishing attempt', NOW()),
    (gen_random_uuid(), 'crypto-invest@upi', 'Global High-Yield Crypto', 'HIGH_RISK', 'suspicious', 15.0, TRUE, 'Escalating investment fraud pattern', NOW()),
    (gen_random_uuid(), 'anyfriend@upi', 'Rohan (Friend)', 'INDIVIDUAL', 'verified', 95.0, FALSE, NULL, NOW()),
    (gen_random_uuid(), 'priya@okaxis', 'Priya Sharma', 'INDIVIDUAL', 'verified', 98.5, FALSE, NULL, NOW()),
    (gen_random_uuid(), 'support-verify@demo', 'Support Team (Official Refund Desk)', 'SUSPICIOUS_ENTITY', 'failed', 12.0, TRUE, 'Fake refund verification desk', NOW()),
    (gen_random_uuid(), 'kirana-store@paytm', 'Sharma General Store', 'MERCHANT', 'verified', 92.0, FALSE, NULL, NOW()),
    (gen_random_uuid(), 'landlord@icici', 'Rajesh Verma (Rent)', 'INDIVIDUAL', 'verified', 95.0, FALSE, NULL, NOW()),
    (gen_random_uuid(), 'mule-account-99@ybl', 'Fast Remit Mule', 'MULE_ACCOUNT', 'flagged', 0.0, TRUE, 'Hub mule node receiving rapid payments', NOW())
ON CONFLICT (identifier) DO NOTHING;
