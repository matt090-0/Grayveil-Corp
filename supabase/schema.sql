-- ============================================================
-- GRAYVEIL CORPORATION — DATABASE SCHEMA
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  handle TEXT UNIQUE NOT NULL,
  rank TEXT NOT NULL DEFAULT 'GREY CONTRACT',
  tier INTEGER NOT NULL DEFAULT 9,
  division TEXT,
  speciality TEXT,
  bio TEXT,
  status TEXT DEFAULT 'ACTIVE',
  is_founder BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT DEFAULT 'ROUTINE',
  posted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.fleet (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vessel_name TEXT NOT NULL,
  ship_class TEXT NOT NULL,
  manufacturer TEXT,
  role TEXT,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'AVAILABLE',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  contract_type TEXT NOT NULL,
  description TEXT,
  location TEXT,
  reward BIGINT DEFAULT 0,
  min_tier INTEGER DEFAULT 9,
  status TEXT DEFAULT 'OPEN',
  posted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.contract_claims (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contract_id, member_id)
);

CREATE TABLE public.intelligence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  classification TEXT DEFAULT 'OPEN',
  min_tier INTEGER DEFAULT 9,
  posted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.ledger (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL,
  description TEXT NOT NULL,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.recruitment (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  handle TEXT NOT NULL,
  discord TEXT,
  referred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'PENDING',
  notes TEXT,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.polls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  min_tier INTEGER DEFAULT 9,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.poll_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL,
  voted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(poll_id, member_id)
);

-- ============================================================
-- HELPER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_tier()
RETURNS INTEGER AS $$
  SELECT COALESCE((SELECT tier FROM public.profiles WHERE id = auth.uid()), 9);
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR get_my_tier() <= 2);

-- ANNOUNCEMENTS
CREATE POLICY "ann_select" ON public.announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "ann_insert" ON public.announcements FOR INSERT TO authenticated WITH CHECK (get_my_tier() <= 4);
CREATE POLICY "ann_delete" ON public.announcements FOR DELETE TO authenticated
  USING (posted_by = auth.uid() OR get_my_tier() <= 2);

-- FLEET
CREATE POLICY "fleet_select" ON public.fleet FOR SELECT TO authenticated USING (true);
CREATE POLICY "fleet_insert" ON public.fleet FOR INSERT TO authenticated WITH CHECK (get_my_tier() <= 4);
CREATE POLICY "fleet_update" ON public.fleet FOR UPDATE TO authenticated USING (get_my_tier() <= 4);
CREATE POLICY "fleet_delete" ON public.fleet FOR DELETE TO authenticated USING (get_my_tier() <= 3);

-- CONTRACTS
CREATE POLICY "contracts_select" ON public.contracts FOR SELECT TO authenticated
  USING (get_my_tier() <= min_tier);
CREATE POLICY "contracts_insert" ON public.contracts FOR INSERT TO authenticated
  WITH CHECK (get_my_tier() <= 4);
CREATE POLICY "contracts_update" ON public.contracts FOR UPDATE TO authenticated
  USING (posted_by = auth.uid() OR get_my_tier() <= 3);

-- CONTRACT CLAIMS
CREATE POLICY "claims_select" ON public.contract_claims FOR SELECT TO authenticated USING (true);
CREATE POLICY "claims_insert" ON public.contract_claims FOR INSERT TO authenticated
  WITH CHECK (member_id = auth.uid());
CREATE POLICY "claims_delete" ON public.contract_claims FOR DELETE TO authenticated
  USING (member_id = auth.uid() OR get_my_tier() <= 4);

-- INTELLIGENCE
CREATE POLICY "intel_select" ON public.intelligence FOR SELECT TO authenticated
  USING (get_my_tier() <= min_tier);
CREATE POLICY "intel_insert" ON public.intelligence FOR INSERT TO authenticated
  WITH CHECK (get_my_tier() <= 6);
CREATE POLICY "intel_delete" ON public.intelligence FOR DELETE TO authenticated
  USING (posted_by = auth.uid() OR get_my_tier() <= 3);

-- LEDGER
CREATE POLICY "ledger_select" ON public.ledger FOR SELECT TO authenticated
  USING (member_id = auth.uid() OR get_my_tier() <= 3);
CREATE POLICY "ledger_insert" ON public.ledger FOR INSERT TO authenticated
  WITH CHECK (get_my_tier() <= 4);

-- RECRUITMENT
CREATE POLICY "recruit_select" ON public.recruitment FOR SELECT TO authenticated
  USING (get_my_tier() <= 6);
CREATE POLICY "recruit_insert" ON public.recruitment FOR INSERT TO authenticated
  WITH CHECK (get_my_tier() <= 6);
CREATE POLICY "recruit_update" ON public.recruitment FOR UPDATE TO authenticated
  USING (get_my_tier() <= 4);
CREATE POLICY "recruit_delete" ON public.recruitment FOR DELETE TO authenticated
  USING (get_my_tier() <= 3);

-- POLLS
CREATE POLICY "polls_select" ON public.polls FOR SELECT TO authenticated
  USING (get_my_tier() <= min_tier);
CREATE POLICY "polls_insert" ON public.polls FOR INSERT TO authenticated
  WITH CHECK (get_my_tier() <= 3);
CREATE POLICY "poll_votes_select" ON public.poll_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "poll_votes_insert" ON public.poll_votes FOR INSERT TO authenticated
  WITH CHECK (member_id = auth.uid());

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER contracts_updated_at BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER recruitment_updated_at BEFORE UPDATE ON public.recruitment
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- AFTER FIRST SIGNUP: run this to make yourself Architect
-- Replace the email with your actual signup email
-- ============================================================
-- UPDATE public.profiles
-- SET rank = 'ARCHITECT', tier = 1, is_founder = true
-- WHERE handle = 'SearthNox';

-- ============================================================
-- FEATURE EXPANSION — Run this after the initial schema
-- ============================================================

-- Activity log: add target_type for generic references
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS target_type TEXT;

-- Profiles: activity tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL, title TEXT NOT NULL, message TEXT,
  is_read BOOLEAN DEFAULT FALSE, link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id, is_read, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- CONTRACT COMMENTS
CREATE TABLE IF NOT EXISTS public.contract_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.contract_comments ENABLE ROW LEVEL SECURITY;

-- FLEET REQUESTS
CREATE TABLE IF NOT EXISTS public.fleet_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vessel_id UUID REFERENCES public.fleet(id) ON DELETE CASCADE NOT NULL,
  requester_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  reason TEXT, status TEXT DEFAULT 'PENDING',
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.fleet_requests ENABLE ROW LEVEL SECURITY;

-- INVITE LINKS
CREATE TABLE IF NOT EXISTS public.invite_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  label TEXT, max_uses INTEGER, uses INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.invite_links ENABLE ROW LEVEL SECURITY;

-- APPLICATIONS
CREATE TABLE IF NOT EXISTS public.applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  handle TEXT NOT NULL, discord TEXT, email TEXT, timezone TEXT,
  experience TEXT, referral_code TEXT,
  referred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT, status TEXT DEFAULT 'PENDING',
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- ORG SETTINGS
CREATE TABLE IF NOT EXISTS public.org_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);
ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;

-- Helper RPC
CREATE OR REPLACE FUNCTION public.increment_invite_uses(invite_code TEXT)
RETURNS VOID AS $$ UPDATE public.invite_links SET uses = uses + 1 WHERE code = invite_code; $$ LANGUAGE SQL SECURITY DEFINER;

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contract_comments;

-- ============================================================
-- DISCIPLINE + WALLET COLUMNS
-- Adds columns used by the Admin discipline panel and wallet flows.
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS strike_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wallet_balance BIGINT NOT NULL DEFAULT 0;

-- BLACKLIST (KOS / threat registry)
CREATE TABLE IF NOT EXISTS public.blacklist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  target_handle TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'KOS',
  threat_level TEXT NOT NULL DEFAULT 'HIGH',
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  added_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.blacklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blacklist_select" ON public.blacklist FOR SELECT TO authenticated
  USING (get_my_tier() <= 6);
CREATE POLICY "blacklist_insert" ON public.blacklist FOR INSERT TO authenticated
  WITH CHECK (get_my_tier() <= 2);
CREATE POLICY "blacklist_update" ON public.blacklist FOR UPDATE TO authenticated
  USING (get_my_tier() <= 2);
CREATE POLICY "blacklist_delete" ON public.blacklist FOR DELETE TO authenticated
  USING (get_my_tier() <= 2);

-- ============================================================
-- ACTIVE-MEMBER ENFORCEMENT
-- Write policies now require the caller to be ACTIVE and not mid-suspension.
-- SUSPENDED/BANNED members retain read access but cannot post/modify anything.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_active_member()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT status = 'ACTIVE' AND (suspended_until IS NULL OR suspended_until < NOW())
       FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated
  USING (
    (id = auth.uid() AND is_active_member())
    OR (get_my_tier() <= 2 AND is_active_member())
  );

DROP POLICY IF EXISTS "ann_insert" ON public.announcements;
CREATE POLICY "ann_insert" ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (is_active_member() AND get_my_tier() <= 4);

DROP POLICY IF EXISTS "fleet_insert" ON public.fleet;
CREATE POLICY "fleet_insert" ON public.fleet FOR INSERT TO authenticated
  WITH CHECK (is_active_member() AND get_my_tier() <= 4);
DROP POLICY IF EXISTS "fleet_update" ON public.fleet;
CREATE POLICY "fleet_update" ON public.fleet FOR UPDATE TO authenticated
  USING (is_active_member() AND get_my_tier() <= 4);

DROP POLICY IF EXISTS "contracts_insert" ON public.contracts;
CREATE POLICY "contracts_insert" ON public.contracts FOR INSERT TO authenticated
  WITH CHECK (is_active_member() AND get_my_tier() <= 4);
DROP POLICY IF EXISTS "contracts_update" ON public.contracts;
CREATE POLICY "contracts_update" ON public.contracts FOR UPDATE TO authenticated
  USING (is_active_member() AND (posted_by = auth.uid() OR get_my_tier() <= 3));

DROP POLICY IF EXISTS "claims_insert" ON public.contract_claims;
CREATE POLICY "claims_insert" ON public.contract_claims FOR INSERT TO authenticated
  WITH CHECK (is_active_member() AND member_id = auth.uid());

DROP POLICY IF EXISTS "intel_insert" ON public.intelligence;
CREATE POLICY "intel_insert" ON public.intelligence FOR INSERT TO authenticated
  WITH CHECK (is_active_member() AND get_my_tier() <= 6);

DROP POLICY IF EXISTS "ledger_insert" ON public.ledger;
CREATE POLICY "ledger_insert" ON public.ledger FOR INSERT TO authenticated
  WITH CHECK (is_active_member() AND get_my_tier() <= 4);

DROP POLICY IF EXISTS "recruit_insert" ON public.recruitment;
CREATE POLICY "recruit_insert" ON public.recruitment FOR INSERT TO authenticated
  WITH CHECK (is_active_member() AND get_my_tier() <= 6);
DROP POLICY IF EXISTS "recruit_update" ON public.recruitment;
CREATE POLICY "recruit_update" ON public.recruitment FOR UPDATE TO authenticated
  USING (is_active_member() AND get_my_tier() <= 4);

DROP POLICY IF EXISTS "polls_insert" ON public.polls;
CREATE POLICY "polls_insert" ON public.polls FOR INSERT TO authenticated
  WITH CHECK (is_active_member() AND get_my_tier() <= 3);

DROP POLICY IF EXISTS "poll_votes_insert" ON public.poll_votes;
CREATE POLICY "poll_votes_insert" ON public.poll_votes FOR INSERT TO authenticated
  WITH CHECK (is_active_member() AND member_id = auth.uid());

-- ============================================================
-- BAN SCREEN: status reason + self-serve expiry clearance
-- ============================================================

-- Human-readable reason shown on the ban/suspension screen.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status_reason TEXT;

-- Members whose timed suspension has elapsed call this from the client on
-- login; is_active_member() already honors the timestamp at the RLS layer,
-- but this keeps the displayed status in sync with reality.
CREATE OR REPLACE FUNCTION public.clear_expired_suspension()
RETURNS VOID AS $$
  UPDATE public.profiles
     SET status = 'ACTIVE', suspended_until = NULL, status_reason = NULL
   WHERE id = auth.uid()
     AND status = 'SUSPENDED'
     AND suspended_until IS NOT NULL
     AND suspended_until <= NOW();
$$ LANGUAGE SQL SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.clear_expired_suspension() TO authenticated;

-- ============================================================
-- ACTIVE-MEMBER GATES FOR REMAINING WRITE PATHS
-- (policies below were already live in the production DB but were missing
-- from this file; re-applied here with is_active_member() added so SUSPENDED
-- and BANNED members are locked out of writes everywhere.)
-- activity_log inserts and anonymous application submissions are intentionally
-- left ungated.
-- ============================================================

DROP POLICY IF EXISTS "notif_select_own" ON public.notifications;
CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());
DROP POLICY IF EXISTS "notif_insert_auth" ON public.notifications;
CREATE POLICY "notif_insert_auth" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (is_active_member() AND get_my_tier() <= 6);
DROP POLICY IF EXISTS "notif_update_own" ON public.notifications;
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid());
DROP POLICY IF EXISTS "notif_delete_own" ON public.notifications;
CREATE POLICY "notif_delete_own" ON public.notifications FOR DELETE TO authenticated
  USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "comments_select" ON public.contract_comments;
CREATE POLICY "comments_select" ON public.contract_comments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "comments_insert" ON public.contract_comments;
CREATE POLICY "comments_insert" ON public.contract_comments FOR INSERT TO authenticated
  WITH CHECK (is_active_member() AND author_id = auth.uid());
DROP POLICY IF EXISTS "comments_delete" ON public.contract_comments;
CREATE POLICY "comments_delete" ON public.contract_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR get_my_tier() <= 3);

DROP POLICY IF EXISTS "fleet_req_select" ON public.fleet_requests;
CREATE POLICY "fleet_req_select" ON public.fleet_requests FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "fleet_req_insert" ON public.fleet_requests;
CREATE POLICY "fleet_req_insert" ON public.fleet_requests FOR INSERT TO authenticated
  WITH CHECK (is_active_member() AND requester_id = auth.uid());
DROP POLICY IF EXISTS "fleet_req_update" ON public.fleet_requests;
CREATE POLICY "fleet_req_update" ON public.fleet_requests FOR UPDATE TO authenticated
  USING (is_active_member() AND get_my_tier() <= 4);
DROP POLICY IF EXISTS "fleet_req_delete" ON public.fleet_requests;
CREATE POLICY "fleet_req_delete" ON public.fleet_requests FOR DELETE TO authenticated
  USING (requester_id = auth.uid() OR get_my_tier() <= 4);

DROP POLICY IF EXISTS "invite_select" ON public.invite_links;
CREATE POLICY "invite_select" ON public.invite_links FOR SELECT TO authenticated
  USING (get_my_tier() <= 6);
DROP POLICY IF EXISTS "invite_anon_select" ON public.invite_links;
CREATE POLICY "invite_anon_select" ON public.invite_links FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "invite_insert" ON public.invite_links;
CREATE POLICY "invite_insert" ON public.invite_links FOR INSERT TO authenticated
  WITH CHECK (is_active_member() AND get_my_tier() <= 4);
DROP POLICY IF EXISTS "invite_delete" ON public.invite_links;
CREATE POLICY "invite_delete" ON public.invite_links FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR get_my_tier() <= 3);

DROP POLICY IF EXISTS "app_select" ON public.applications;
CREATE POLICY "app_select" ON public.applications FOR SELECT TO authenticated
  USING (get_my_tier() <= 6);
DROP POLICY IF EXISTS "app_insert_anon" ON public.applications;
CREATE POLICY "app_insert_anon" ON public.applications FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "app_insert_auth" ON public.applications;
CREATE POLICY "app_insert_auth" ON public.applications FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "app_update" ON public.applications;
CREATE POLICY "app_update" ON public.applications FOR UPDATE TO authenticated
  USING (get_my_tier() <= 4);
DROP POLICY IF EXISTS "app_delete" ON public.applications;
CREATE POLICY "app_delete" ON public.applications FOR DELETE TO authenticated
  USING (get_my_tier() <= 3);

DROP POLICY IF EXISTS "settings_select" ON public.org_settings;
CREATE POLICY "settings_select" ON public.org_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "settings_insert" ON public.org_settings;
CREATE POLICY "settings_insert" ON public.org_settings FOR INSERT TO authenticated
  WITH CHECK (is_active_member() AND get_my_tier() <= 2);
DROP POLICY IF EXISTS "settings_update" ON public.org_settings;
CREATE POLICY "settings_update" ON public.org_settings FOR UPDATE TO authenticated
  USING (is_active_member() AND get_my_tier() <= 2);
DROP POLICY IF EXISTS "settings_delete" ON public.org_settings;
CREATE POLICY "settings_delete" ON public.org_settings FOR DELETE TO authenticated
  USING (get_my_tier() <= 1);
