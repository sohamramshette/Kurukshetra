-- Phase 2: durable, server-authoritative pre-payment lifecycle.
-- This migration is additive. Existing analysis, risk-event, verification, and decision data remain intact.

ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS public_id TEXT,
    ADD COLUMN IF NOT EXISTS owner_key TEXT NOT NULL DEFAULT 'demo:aarav',
    ADD COLUMN IF NOT EXISTS state_version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS action_token_hash TEXT,
    ADD COLUMN IF NOT EXISTS requires_guidance_ack BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS guidance_acknowledged_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS guidance_acknowledgement JSONB,
    ADD COLUMN IF NOT EXISTS cooling_ends_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_public_id
    ON public.transactions(public_id)
    WHERE public_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_owner_public
    ON public.transactions(owner_key, public_id);

CREATE TABLE IF NOT EXISTS public.payment_action_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    actor_key TEXT NOT NULL,
    action TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    prior_status TEXT NOT NULL,
    next_status TEXT NOT NULL,
    state_version INTEGER NOT NULL,
    acknowledgement JSONB,
    response_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_payment_action_event_idempotency UNIQUE (transaction_id, action, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_payment_action_events_transaction
    ON public.payment_action_events(transaction_id, created_at DESC);
