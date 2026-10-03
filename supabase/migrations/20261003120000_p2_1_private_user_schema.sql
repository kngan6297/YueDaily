-- ============================================================
-- P2.1 — Per-user private YueDaily cloud schema + RLS
-- Applied to DEV via Supabase MCP (project cpbmhbcobnluayzsceau).
--
-- Invariant: auth.uid() = user_id on every financial/catalog row.
-- No shared household / workspace tables.
-- Receipt media Storage / archive deferred (P1.7B/C).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Shared updated_at helper (timestamptz columns only)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- categories
-- ------------------------------------------------------------
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'both',
  icon TEXT NOT NULL DEFAULT '💰',
  color TEXT NOT NULL DEFAULT '#FF8FAB',
  budget_group TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT categories_user_id_id_key UNIQUE (user_id, id),
  CONSTRAINT categories_user_id_name_key UNIQUE (user_id, name)
);

CREATE TRIGGER categories_set_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- sources
-- ------------------------------------------------------------
CREATE TABLE public.sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  spending_group TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sources_user_id_id_key UNIQUE (user_id, id),
  CONSTRAINT sources_user_id_name_key UNIQUE (user_id, name)
);

CREATE TRIGGER sources_set_updated_at
BEFORE UPDATE ON public.sources
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- payers (legacy catalog; transactions.payer remains TEXT)
-- ------------------------------------------------------------
CREATE TABLE public.payers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '👤',
  color TEXT NOT NULL DEFAULT '#FF8FAB',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payers_user_id_id_key UNIQUE (user_id, id),
  CONSTRAINT payers_user_id_name_key UNIQUE (user_id, name)
);

CREATE TRIGGER payers_set_updated_at
BEFORE UPDATE ON public.payers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- transactions
-- image_uri may exist for compatibility but is NOT cloud Storage (P1.7B deferred).
-- created_at TEXT mirrors local SQLite local-datetime string semantics for P2.5 mapping.
-- ------------------------------------------------------------
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  amount INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'chi',
  category_id UUID,
  source_id UUID,
  payer TEXT NOT NULL DEFAULT 'Vợ',
  expense_audience TEXT NOT NULL DEFAULT 'couple',
  image_uri TEXT,
  location TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'complete',
  created_at TEXT NOT NULL DEFAULT to_char(timezone('Asia/Ho_Chi_Minh', now()), 'YYYY-MM-DD HH24:MI:SS'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT transactions_user_id_id_key UNIQUE (user_id, id),
  CONSTRAINT transactions_category_same_owner_fkey
    FOREIGN KEY (user_id, category_id)
    REFERENCES public.categories (user_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT transactions_source_same_owner_fkey
    FOREIGN KEY (user_id, source_id)
    REFERENCES public.sources (user_id, id)
    ON DELETE RESTRICT
);

-- Match existing report/query patterns (user-scoped date + filters)
CREATE INDEX idx_transactions_user_created_at
  ON public.transactions (user_id, created_at);
CREATE INDEX idx_transactions_user_status_created_at
  ON public.transactions (user_id, status, created_at);
CREATE INDEX idx_transactions_user_source_created_at
  ON public.transactions (user_id, source_id, created_at);
CREATE INDEX idx_transactions_user_category_created_at
  ON public.transactions (user_id, category_id, created_at);

CREATE TRIGGER transactions_set_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- budget_periods (Woori / household_food cycle capability)
-- Do NOT seed personal historical periods/carryover.
-- ------------------------------------------------------------
CREATE TABLE public.budget_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  budget_key TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  limit_amount INTEGER NOT NULL,
  carryover_amount INTEGER NOT NULL DEFAULT 0,
  adjustment_amount INTEGER NOT NULL DEFAULT 0,
  envelope_source_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT budget_periods_user_id_id_key UNIQUE (user_id, id),
  CONSTRAINT budget_periods_user_key_start_key UNIQUE (user_id, budget_key, period_start),
  CONSTRAINT budget_periods_envelope_same_owner_fkey
    FOREIGN KEY (user_id, envelope_source_id)
    REFERENCES public.sources (user_id, id)
    ON DELETE RESTRICT
);

CREATE TRIGGER budget_periods_set_updated_at
BEFORE UPDATE ON public.budget_periods
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- tracked_source_periods (VPBank-capable)
-- opening_balance NULL remains distinct from 0 — no auto carry-forward.
-- ------------------------------------------------------------
CREATE TABLE public.tracked_source_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  source_id UUID NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  opening_balance INTEGER,
  adjustment_amount INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tracked_source_periods_user_id_id_key UNIQUE (user_id, id),
  CONSTRAINT tracked_source_periods_user_source_start_key UNIQUE (user_id, source_id, period_start),
  CONSTRAINT tracked_source_periods_source_same_owner_fkey
    FOREIGN KEY (user_id, source_id)
    REFERENCES public.sources (user_id, id)
    ON DELETE RESTRICT
);

CREATE TRIGGER tracked_source_periods_set_updated_at
BEFORE UPDATE ON public.tracked_source_periods
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- AI chat (schema ready; orchestration = P2.4 Edge turn)
-- ------------------------------------------------------------
CREATE TABLE public.ai_chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  title TEXT,
  anchor_year INTEGER NOT NULL,
  anchor_month INTEGER NOT NULL,
  context_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_chat_threads_user_id_id_key UNIQUE (user_id, id)
);

CREATE TRIGGER ai_chat_threads_set_updated_at
BEFORE UPDATE ON public.ai_chat_threads
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  thread_id UUID NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_chat_messages_user_id_id_key UNIQUE (user_id, id),
  CONSTRAINT ai_chat_messages_thread_same_owner_fkey
    FOREIGN KEY (user_id, thread_id)
    REFERENCES public.ai_chat_threads (user_id, id)
    ON DELETE CASCADE
);

CREATE INDEX idx_ai_chat_messages_user_thread
  ON public.ai_chat_messages (user_id, thread_id);

CREATE TABLE public.ai_saved_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_saved_prompts_user_id_id_key UNIQUE (user_id, id)
);

CREATE INDEX idx_ai_saved_prompts_user_sort
  ON public.ai_saved_prompts (user_id, sort_order, id);

CREATE TRIGGER ai_saved_prompts_set_updated_at
BEFORE UPDATE ON public.ai_saved_prompts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- RLS — every user-owned table
-- ------------------------------------------------------------
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracked_source_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_saved_prompts ENABLE ROW LEVEL SECURITY;

-- Helper macro via repeated policies
-- (ENABLE RLS is enough for anon/authenticated; avoid FORCE so SECURITY DEFINER seed can run)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'categories',
    'sources',
    'payers',
    'transactions',
    'budget_periods',
    'tracked_source_periods',
    'ai_chat_threads',
    'ai_chat_messages',
    'ai_saved_prompts'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (auth.uid() = user_id)',
      t || '_select_own', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)',
      t || '_insert_own', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
      t || '_update_own', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (auth.uid() = user_id)',
      t || '_delete_own', t
    );
  END LOOP;
END $$;

-- Grants: authenticated can DML; anon has no financial access policies
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.categories,
  public.sources,
  public.payers,
  public.transactions,
  public.budget_periods,
  public.tracked_source_periods,
  public.ai_chat_threads,
  public.ai_chat_messages,
  public.ai_saved_prompts
TO authenticated;

REVOKE ALL ON
  public.categories,
  public.sources,
  public.payers,
  public.transactions,
  public.budget_periods,
  public.tracked_source_periods,
  public.ai_chat_threads,
  public.ai_chat_messages,
  public.ai_saved_prompts
FROM anon;

-- ------------------------------------------------------------
-- Safe new-user catalog seed (NO personal finance state)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user_catalog_seed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Own rows only: NEW.id from auth.users insert. Never accept client user_id.
  -- Categories = universal YueDaily defaults (not personal history).
  INSERT INTO public.categories (user_id, name, type, icon, color, budget_group)
  VALUES
    (NEW.id, 'Ăn uống', 'chi', '🍜', '#FF8FAB', 'household_food'),
    (NEW.id, 'Trà & Cà phê', 'chi', '🧋', '#FBBAD3', 'household_food'),
    (NEW.id, 'Mua sắm', 'chi', '🛍️', '#B882FF', NULL),
    (NEW.id, 'Di chuyển', 'chi', '🛵', '#82C0FF', NULL),
    (NEW.id, 'Làm đẹp', 'chi', '💄', '#F990B6', NULL),
    (NEW.id, 'Sức khoẻ', 'chi', '💊', '#6FCBA0', NULL),
    (NEW.id, 'Giải trí', 'chi', '🎮', '#FFD966', NULL),
    (NEW.id, 'Giáo dục', 'chi', '📚', '#FFAA75', NULL),
    (NEW.id, 'Gia đình', 'chi', '🏠', '#A8E6D3', NULL),
    (NEW.id, 'Điện - Nước', 'chi', '💡', '#FFE9A0', NULL),
    (NEW.id, 'Thú cưng', 'chi', '🐱', '#D4AEFF', NULL),
    (NEW.id, 'Khác', 'chi', '✨', '#EBD9FF', NULL)
  ON CONFLICT (user_id, name) DO NOTHING;

  -- Sources are NOT auto-seeded for every Auth user.
  -- Native DEFAULT_SOURCE_SEEDS (Woori / VPBank / cash) are Yue-installation
  -- examples, not universal product defaults for Meo/other accounts.
  -- Users create/select sources in P2.2+ UI.

  -- Legacy payer catalog (matches native seed; transactions.payer remains TEXT)
  INSERT INTO public.payers (user_id, name, icon, color)
  VALUES
    (NEW.id, 'Vợ', '👩‍🦰', '#FF8FAB'),
    (NEW.id, 'Chồng', '👨‍🦱', '#4BBFA0')
  ON CONFLICT (user_id, name) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_catalog_seed ON auth.users;
CREATE TRIGGER on_auth_user_created_catalog_seed
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_catalog_seed();

-- Trigger-only: block PostgREST RPC abuse of SECURITY DEFINER seed.
REVOKE ALL ON FUNCTION public.handle_new_user_catalog_seed() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_catalog_seed() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user_catalog_seed() TO supabase_auth_admin, postgres, service_role;
