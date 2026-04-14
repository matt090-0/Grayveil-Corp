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
