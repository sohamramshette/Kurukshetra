ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS analysis_idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_owner_analysis_key
    ON public.transactions(owner_key, analysis_idempotency_key)
    WHERE analysis_idempotency_key IS NOT NULL;
