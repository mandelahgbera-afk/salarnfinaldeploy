-- ================================================================
-- SALARN — Complete Supabase Schema (v4 — production-ready)
-- Run this entire script once in the Supabase SQL Editor.
-- It is fully idempotent: safe to re-run on fresh or existing projects.
-- ================================================================

-- ── EXTENSIONS ──────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- TABLE: users
-- ================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id        UUID UNIQUE,
  email          TEXT NOT NULL UNIQUE,
  full_name      TEXT,
  role           TEXT NOT NULL DEFAULT 'user'
                   CHECK (role IN ('user', 'admin')),
  wallet_address TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_auth_id_idx ON public.users (auth_id);
CREATE INDEX IF NOT EXISTS users_email_idx   ON public.users (email);

-- ================================================================
-- TABLE: user_balances
-- ================================================================
CREATE TABLE IF NOT EXISTS public.user_balances (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email        TEXT NOT NULL UNIQUE REFERENCES public.users(email) ON DELETE CASCADE,
  balance_usd       NUMERIC(18, 8) NOT NULL DEFAULT 0 CHECK (balance_usd >= 0),
  total_invested    NUMERIC(18, 8) NOT NULL DEFAULT 0,
  total_profit_loss NUMERIC(18, 8) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_balances_email_idx ON public.user_balances (user_email);

-- ================================================================
-- TABLE: cryptocurrencies
-- ================================================================
CREATE TABLE IF NOT EXISTS public.cryptocurrencies (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol     TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  price      NUMERIC(24, 8) NOT NULL DEFAULT 0,
  change_24h NUMERIC(10, 4) NOT NULL DEFAULT 0,
  market_cap NUMERIC(30, 2) NOT NULL DEFAULT 0,
  volume_24h NUMERIC(30, 2) NOT NULL DEFAULT 0,
  icon_color TEXT NOT NULL DEFAULT '#6366f1',
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cryptos_symbol_idx ON public.cryptocurrencies (symbol);
CREATE INDEX IF NOT EXISTS cryptos_active_idx ON public.cryptocurrencies (is_active, market_cap DESC);

-- ================================================================
-- TABLE: portfolio
-- ================================================================
CREATE TABLE IF NOT EXISTS public.portfolio (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email    TEXT NOT NULL REFERENCES public.users(email) ON DELETE CASCADE,
  crypto_symbol TEXT NOT NULL REFERENCES public.cryptocurrencies(symbol) ON DELETE CASCADE,
  amount        NUMERIC(24, 8) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  avg_buy_price NUMERIC(24, 8) NOT NULL DEFAULT 0 CHECK (avg_buy_price >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_email, crypto_symbol)
);

CREATE INDEX IF NOT EXISTS portfolio_user_email_crypto_idx ON public.portfolio (user_email, crypto_symbol);

-- ================================================================
-- TABLE: transactions
-- ================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email     TEXT NOT NULL REFERENCES public.users(email) ON DELETE CASCADE,
  type           TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'buy', 'sell', 'copy_profit')),
  amount         NUMERIC(18, 8) NOT NULL CHECK (amount > 0),
  crypto_symbol  TEXT,
  crypto_amount  NUMERIC(24, 8),
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  notes          TEXT,
  wallet_address TEXT,
  otp_code       TEXT,
  otp_verified   BOOLEAN DEFAULT FALSE,
  otp_expires_at TIMESTAMPTZ,
  reviewed_by    TEXT,
  reviewed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS txns_user_email_idx ON public.transactions (user_email, created_at DESC);
CREATE INDEX IF NOT EXISTS txns_status_idx     ON public.transactions (status);
-- Enable full replica identity so realtime UPDATE events include
-- the full row data (required for the withdrawal processing page).
ALTER TABLE public.transactions REPLICA IDENTITY FULL;

-- ================================================================
-- TABLE: copy_traders
-- ================================================================
CREATE TABLE IF NOT EXISTS public.copy_traders (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trader_name        TEXT NOT NULL,
  specialty          TEXT,
  total_profit_pct   NUMERIC(10, 4) NOT NULL DEFAULT 0,
  monthly_profit_pct NUMERIC(10, 4) NOT NULL DEFAULT 0,
  win_rate           NUMERIC(5, 2) NOT NULL DEFAULT 0,
  total_trades       INT NOT NULL DEFAULT 0,
  followers          INT NOT NULL DEFAULT 0,
  profit_split_pct   NUMERIC(5, 2) NOT NULL DEFAULT 20,
  min_allocation     NUMERIC(18, 8) NOT NULL DEFAULT 100,
  is_approved        BOOLEAN NOT NULL DEFAULT FALSE,
  risk_level         TEXT NOT NULL DEFAULT 'medium'
                       CHECK (risk_level IN ('low', 'medium', 'high')),
  avatar_color       TEXT NOT NULL DEFAULT '#6366f1',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- TABLE: copy_trades
-- ================================================================
CREATE TABLE IF NOT EXISTS public.copy_trades (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email      TEXT NOT NULL REFERENCES public.users(email) ON DELETE CASCADE,
  trader_id       UUID NOT NULL REFERENCES public.copy_traders(id) ON DELETE CASCADE,
  trader_name     TEXT NOT NULL,
  allocation      NUMERIC(18, 8) NOT NULL CHECK (allocation > 0),
  profit_loss     NUMERIC(18, 8) NOT NULL DEFAULT 0,
  profit_loss_pct NUMERIC(10, 4) NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add updated_at if schema was run without it previously
ALTER TABLE public.copy_trades ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS copy_trades_user_email_idx ON public.copy_trades (user_email);

-- ================================================================
-- TABLE: platform_settings
-- ================================================================
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key        TEXT NOT NULL UNIQUE,
  value      TEXT NOT NULL DEFAULT '',
  label      TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- AUTO-UPDATE TRIGGERS
-- ================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'users_set_updated_at') THEN
    CREATE TRIGGER users_set_updated_at
      BEFORE UPDATE ON public.users
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'user_balances_set_updated_at') THEN
    CREATE TRIGGER user_balances_set_updated_at
      BEFORE UPDATE ON public.user_balances
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'cryptos_set_updated_at') THEN
    CREATE TRIGGER cryptos_set_updated_at
      BEFORE UPDATE ON public.cryptocurrencies
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'portfolio_set_updated_at') THEN
    CREATE TRIGGER portfolio_set_updated_at
      BEFORE UPDATE ON public.portfolio
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'transactions_set_updated_at') THEN
    CREATE TRIGGER transactions_set_updated_at
      BEFORE UPDATE ON public.transactions
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'copy_trades_set_updated_at') THEN
    CREATE TRIGGER copy_trades_set_updated_at
      BEFORE UPDATE ON public.copy_trades
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ================================================================
-- AUTO-CREATE PROFILE TRIGGER
-- Runs server-side when someone signs up — creates users + user_balances
-- rows before the frontend even requests them, eliminating race conditions.
-- Uses SECURITY DEFINER so it runs as the DB owner (bypasses RLS).
-- ================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Insert new user profile row; on email conflict, update auth_id and full_name
  -- only when the existing row has no auth_id (orphaned legacy row) so we never
  -- accidentally overwrite a valid profile with a different auth_id.
  INSERT INTO public.users (auth_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    'user'
  )
  ON CONFLICT (email) DO UPDATE
    SET auth_id   = CASE
                      WHEN public.users.auth_id IS NULL THEN EXCLUDED.auth_id
                      ELSE public.users.auth_id
                    END,
        full_name = COALESCE(public.users.full_name, EXCLUDED.full_name),
        updated_at = NOW()
  WHERE public.users.auth_id IS NULL OR public.users.auth_id = EXCLUDED.auth_id;

  -- Always ensure a balance row exists (idempotent)
  INSERT INTO public.user_balances (user_email, balance_usd, total_invested, total_profit_loss)
  VALUES (NEW.email, 0, 0, 0)
  ON CONFLICT (user_email) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Recreate trigger safely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================
ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_balances     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cryptocurrencies  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copy_traders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copy_trades       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- ── Admin helper (STABLE so it's cached per statement, not per row) ──
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role = 'admin'
  );
$$;

-- ── Drop all policies so this script is fully idempotent ──────────
DROP POLICY IF EXISTS "users_insert_own"        ON public.users;
DROP POLICY IF EXISTS "users_select_own"        ON public.users;
DROP POLICY IF EXISTS "users_update_own"        ON public.users;
DROP POLICY IF EXISTS "users_admin_all"         ON public.users;
DROP POLICY IF EXISTS "users_admin_delete"      ON public.users;

DROP POLICY IF EXISTS "balances_select"         ON public.user_balances;
DROP POLICY IF EXISTS "balances_insert"         ON public.user_balances;
DROP POLICY IF EXISTS "balances_update"         ON public.user_balances;

DROP POLICY IF EXISTS "cryptos_select"          ON public.cryptocurrencies;
DROP POLICY IF EXISTS "cryptos_admin_write"     ON public.cryptocurrencies;

DROP POLICY IF EXISTS "portfolio_select"        ON public.portfolio;
DROP POLICY IF EXISTS "portfolio_insert"        ON public.portfolio;
DROP POLICY IF EXISTS "portfolio_update"        ON public.portfolio;
DROP POLICY IF EXISTS "portfolio_delete"        ON public.portfolio;

DROP POLICY IF EXISTS "txns_select"             ON public.transactions;
DROP POLICY IF EXISTS "txns_insert"             ON public.transactions;
DROP POLICY IF EXISTS "txns_update"             ON public.transactions;
DROP POLICY IF EXISTS "txns_update_admin"       ON public.transactions;
DROP POLICY IF EXISTS "txns_update_own_otp"     ON public.transactions;

DROP POLICY IF EXISTS "traders_select_approved" ON public.copy_traders;
DROP POLICY IF EXISTS "traders_admin_write"     ON public.copy_traders;
DROP POLICY IF EXISTS "traders_admin_all"       ON public.copy_traders;

DROP POLICY IF EXISTS "copy_trades_select"      ON public.copy_trades;
DROP POLICY IF EXISTS "copy_trades_insert"      ON public.copy_trades;
DROP POLICY IF EXISTS "copy_trades_update"      ON public.copy_trades;
DROP POLICY IF EXISTS "copy_trades_delete"      ON public.copy_trades;

DROP POLICY IF EXISTS "settings_select"         ON public.platform_settings;
DROP POLICY IF EXISTS "settings_write"          ON public.platform_settings;

-- ── users ─────────────────────────────────────────────────────────
CREATE POLICY "users_insert_own" ON public.users FOR INSERT
  WITH CHECK (auth_id = auth.uid() OR public.is_admin());

CREATE POLICY "users_select_own" ON public.users FOR SELECT
  USING (auth_id = auth.uid() OR public.is_admin());

CREATE POLICY "users_update_own" ON public.users FOR UPDATE
  USING (auth_id = auth.uid() OR public.is_admin())
  WITH CHECK (auth_id = auth.uid() OR public.is_admin());

CREATE POLICY "users_admin_delete" ON public.users FOR DELETE
  USING (public.is_admin());

-- ── user_balances ─────────────────────────────────────────────────
CREATE POLICY "balances_select" ON public.user_balances FOR SELECT
  USING (
    user_email = (SELECT email FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
    OR public.is_admin()
  );
CREATE POLICY "balances_insert" ON public.user_balances FOR INSERT
  WITH CHECK (
    user_email = (SELECT email FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
    OR public.is_admin()
  );
CREATE POLICY "balances_update" ON public.user_balances FOR UPDATE
  USING (
    user_email = (SELECT email FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
    OR public.is_admin()
  )
  WITH CHECK (
    user_email = (SELECT email FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
    OR public.is_admin()
  );

-- ── cryptocurrencies ──────────────────────────────────────────────
CREATE POLICY "cryptos_select" ON public.cryptocurrencies FOR SELECT
  USING (TRUE);
-- Admin-only write; use a single ALL policy to cover INSERT/UPDATE/DELETE
CREATE POLICY "cryptos_admin_write" ON public.cryptocurrencies FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── portfolio ─────────────────────────────────────────────────────
CREATE POLICY "portfolio_select" ON public.portfolio FOR SELECT
  USING (
    user_email = (SELECT email FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
    OR public.is_admin()
  );
CREATE POLICY "portfolio_insert" ON public.portfolio FOR INSERT
  WITH CHECK (
    user_email = (SELECT email FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
    OR public.is_admin()
  );
CREATE POLICY "portfolio_update" ON public.portfolio FOR UPDATE
  USING (
    user_email = (SELECT email FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
    OR public.is_admin()
  )
  WITH CHECK (
    user_email = (SELECT email FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
    OR public.is_admin()
  );
CREATE POLICY "portfolio_delete" ON public.portfolio FOR DELETE
  USING (
    user_email = (SELECT email FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
    OR public.is_admin()
  );

-- ── transactions ──────────────────────────────────────────────────
CREATE POLICY "txns_select" ON public.transactions FOR SELECT
  USING (
    user_email = (SELECT email FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
    OR public.is_admin()
  );
CREATE POLICY "txns_insert" ON public.transactions FOR INSERT
  WITH CHECK (
    user_email = (SELECT email FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
    OR public.is_admin()
  );
-- Admins can update any transaction
CREATE POLICY "txns_update_admin" ON public.transactions FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
-- Users can update their own approved withdrawal to verify OTP
-- (This is what allows verifyOtp() to work for non-admin users)
CREATE POLICY "txns_update_own_otp" ON public.transactions FOR UPDATE
  USING (
    user_email = (SELECT email FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
    AND type = 'withdrawal'
    AND status = 'approved'
    AND otp_code IS NOT NULL
  )
  WITH CHECK (
    user_email = (SELECT email FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
    AND type = 'withdrawal'
  );

-- ── copy_traders ──────────────────────────────────────────────────
-- Regular users can only see approved traders
CREATE POLICY "traders_select_approved" ON public.copy_traders FOR SELECT
  USING (is_approved = TRUE OR public.is_admin());
-- Admins can do everything (INSERT, UPDATE, DELETE)
CREATE POLICY "traders_admin_all" ON public.copy_traders FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── copy_trades ───────────────────────────────────────────────────
CREATE POLICY "copy_trades_select" ON public.copy_trades FOR SELECT
  USING (
    user_email = (SELECT email FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
    OR public.is_admin()
  );
CREATE POLICY "copy_trades_insert" ON public.copy_trades FOR INSERT
  WITH CHECK (
    user_email = (SELECT email FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
    OR public.is_admin()
  );
CREATE POLICY "copy_trades_update" ON public.copy_trades FOR UPDATE
  USING (
    user_email = (SELECT email FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
    OR public.is_admin()
  )
  WITH CHECK (
    user_email = (SELECT email FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
    OR public.is_admin()
  );
CREATE POLICY "copy_trades_delete" ON public.copy_trades FOR DELETE
  USING (
    user_email = (SELECT email FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
    OR public.is_admin()
  );

-- ── platform_settings ─────────────────────────────────────────────
CREATE POLICY "settings_select" ON public.platform_settings FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "settings_write" ON public.platform_settings FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ================================================================
-- GRANTS
-- ================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Public read access for crypto prices (used on landing page too)
GRANT SELECT ON public.cryptocurrencies TO anon, authenticated;

-- Authenticated user access
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT DELETE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_balances TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.transactions TO authenticated;
GRANT SELECT ON public.copy_traders TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.copy_traders TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.copy_trades TO authenticated;
GRANT DELETE ON public.copy_trades TO authenticated;
GRANT SELECT ON public.platform_settings TO authenticated;
GRANT INSERT, UPDATE ON public.platform_settings TO authenticated;

-- ================================================================
-- DONE — Schema v4 is complete and production-ready.
-- ================================================================
