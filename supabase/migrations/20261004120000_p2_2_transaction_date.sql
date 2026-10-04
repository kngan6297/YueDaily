-- ============================================================
-- P2.2 — Explicit calendar transaction_date (YYYY-MM-DD)
-- Separates business date from row metadata.
--
-- Native Android still uses created_at TEXT as calendar domain
-- (unchanged). Cloud gains a clear transaction_date column;
-- created_at TEXT remains for P2.5 local-datetime mapping parity;
-- row_created_at is true insert metadata (timestamptz).
-- ============================================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS transaction_date TEXT;

-- Backfill from overloaded created_at local-datetime prefix
UPDATE public.transactions
SET transaction_date = left(created_at, 10)
WHERE transaction_date IS NULL
  AND created_at IS NOT NULL
  AND length(created_at) >= 10;

-- Any remaining nulls (should not exist) → today VN
UPDATE public.transactions
SET transaction_date = to_char(timezone('Asia/Ho_Chi_Minh', now()), 'YYYY-MM-DD')
WHERE transaction_date IS NULL;

ALTER TABLE public.transactions
  ALTER COLUMN transaction_date SET NOT NULL;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_transaction_date_ymd_check
  CHECK (transaction_date ~ '^\d{4}-\d{2}-\d{2}$');

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS row_created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_transactions_user_transaction_date
  ON public.transactions (user_id, transaction_date);

CREATE INDEX IF NOT EXISTS idx_transactions_user_status_transaction_date
  ON public.transactions (user_id, status, transaction_date);
