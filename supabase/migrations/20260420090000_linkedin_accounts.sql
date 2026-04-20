-- ---------------------------------------------------------------------------
-- LinkedIn account management — profiles, usage tracking, activity log
-- ---------------------------------------------------------------------------

-- LinkedIn accounts (personal profiles + company pages)
CREATE TABLE IF NOT EXISTS linkedin_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  type text NOT NULL CHECK (type IN ('personal', 'company')),
  url text UNIQUE NOT NULL,
  name text NOT NULL,
  headline text NOT NULL DEFAULT '',
  subline text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  connections integer,
  followers integer NOT NULL DEFAULT 0,
  recommendations integer,
  experience integer,
  employee_count integer,
  founded integer,
  company_size text,
  pic text,
  bg text,
  verified boolean NOT NULL DEFAULT false,
  premium boolean NOT NULL DEFAULT false,
  skills text[] NOT NULL DEFAULT '{}',
  prev_companies text[] NOT NULL DEFAULT '{}',
  specialties text[] NOT NULL DEFAULT '{}',
  education text,
  allowed_actions text[] NOT NULL DEFAULT '{}',
  daily_limits jsonb NOT NULL DEFAULT '{}',
  working_hours jsonb NOT NULL DEFAULT
    '{"from":"09:00","to":"18:00","days":["Mon","Tue","Wed","Thu","Fri"]}'::jsonb,
  status text NOT NULL DEFAULT 'ready'
    CHECK (status IN ('ready', 'active', 'paused')),
  role text NOT NULL DEFAULT '',
  scraped_at timestamptz NOT NULL DEFAULT now(),
  raw_apify jsonb,
  org_id uuid NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_org ON linkedin_accounts(org_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_type ON linkedin_accounts(type);
CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_status ON linkedin_accounts(status);

ALTER TABLE linkedin_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "linkedin_accounts_org_access" ON linkedin_accounts
  FOR ALL USING (org_id = 'a0000000-0000-0000-0000-000000000001'::uuid);

-- Trigger to bump updated_at
CREATE OR REPLACE FUNCTION set_linkedin_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_linkedin_accounts_updated_at ON linkedin_accounts;
CREATE TRIGGER set_linkedin_accounts_updated_at
BEFORE UPDATE ON linkedin_accounts
FOR EACH ROW
EXECUTE FUNCTION set_linkedin_accounts_updated_at();

-- Daily usage tracking (one row per account/date/action_key)
CREATE TABLE IF NOT EXISTS linkedin_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  action_key text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  org_id uuid NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, date, action_key)
);

CREATE INDEX IF NOT EXISTS idx_linkedin_usage_account_date
  ON linkedin_usage(account_id, date);

ALTER TABLE linkedin_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "linkedin_usage_org_access" ON linkedin_usage
  FOR ALL USING (org_id = 'a0000000-0000-0000-0000-000000000001'::uuid);

-- Activity log (append-only)
CREATE TABLE IF NOT EXISTS linkedin_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES linkedin_accounts(id) ON DELETE SET NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info'
    CHECK (type IN ('info', 'success', 'warn', 'error')),
  org_id uuid NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_linkedin_activity_log_created
  ON linkedin_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_linkedin_activity_log_account
  ON linkedin_activity_log(account_id);

ALTER TABLE linkedin_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "linkedin_activity_log_org_access" ON linkedin_activity_log
  FOR ALL USING (org_id = 'a0000000-0000-0000-0000-000000000001'::uuid);

-- Seed K. Prabhu and Creative Nexus India with current known data
INSERT INTO linkedin_accounts (
  slug, type, url, name, headline, subline, location,
  connections, followers, recommendations, experience,
  employee_count, founded, company_size, pic, bg,
  verified, premium, skills, prev_companies, specialties, education,
  allowed_actions, daily_limits, status, role, scraped_at
) VALUES
(
  'kprabhu', 'personal',
  'https://www.linkedin.com/in/k-prabhu-2062ba14/',
  'K. Prabhu',
  'Co-founder | Ex-BCG | KPMG | ZS Associates | Branding & Marketing Communication Strategist',
  'Building Creative Nexus · 9 yrs 1 mo',
  'Delhi, India',
  3933, 3898, 7, 25,
  NULL, NULL, NULL,
  'https://media.licdn.com/dms/image/v2/D5603AQFUSrmW-aaEQg/profile-displayphoto-crop_800_800/B56ZuzVIF7GoAM-/0/1768240219006?e=1778112000&v=beta&t=wygRIBmINn5KwMR32TmmFm9EHadhBLYI-mNoA7Oyjbw',
  'https://media.licdn.com/dms/image/v2/D5616AQERYSH7xS32-A/profile-displaybackgroundimage-shrink_350_1400/B56ZuzWPAIJoAY-/0/1768240510041?e=1778112000&v=beta&t=wJ_0MjPvzCcpplr3KuhIczxDn9ttiSdMRWxPLzfsKOQ',
  true, false,
  ARRAY['Branding & Identity','Corporate Branding','Email Marketing','Business Development','Marketing','Project Management'],
  ARRAY['BCG','KPMG','ZS Associates','Copal (Moodys)'],
  ARRAY[]::text[],
  'Symbiosis Institute of Management Studies — MBA',
  ARRAY['follow','visit','endorse','like','connect','message','inmail'],
  '{"connections":20,"messages":50,"follows":40,"likes":80,"endorsements":20}'::jsonb,
  'ready',
  'Personal outreach — connection requests, direct messages, endorsements, profile warm-up',
  '2026-04-20T03:30:00Z'::timestamptz
),
(
  'creativenexus', 'company',
  'https://www.linkedin.com/company/creativenexus.in/',
  'Creative Nexus India',
  'Digital Marketing · Video Production · UI/UX · Branding & Strategy',
  'Marketing Services · Founded 2016 · Partnership',
  'Gurugram, Haryana · Plot 1SP, 122002',
  NULL, 729, NULL, NULL,
  16, 2016, '11–50 employees',
  'https://media.licdn.com/dms/image/v2/C560BAQHwe65ToGg2NQ/company-logo_200_200/company-logo_200_200/0/1676881616293/creativenexusin_logo?e=2147483647&v=beta&t=Nu2so7xKTQgPZhh-PZd7u_Jwv4-SNttY5cQD1GgdZHw',
  NULL,
  false, false,
  ARRAY[]::text[],
  ARRAY[]::text[],
  ARRAY['SEO','Video Production','Shopify','Branding','Social Media','PPT Design','Website','BigCommerce','Animation','Photography'],
  NULL,
  ARRAY['invite_follow','boost_post','company_message','event_invite','employee_advocate'],
  '{"inviteFollowers":100,"companyMessages":20,"postEngagement":50,"eventInvites":50}'::jsonb,
  'ready',
  'Company page — grow followers, company awareness, post engagement, event invitations',
  '2026-04-20T03:33:00Z'::timestamptz
)
ON CONFLICT (slug) DO NOTHING;

-- Seed initial activity log
INSERT INTO linkedin_activity_log (account_id, message, type)
SELECT id, 'Account seeded from initial scrape', 'success'
FROM linkedin_accounts
WHERE slug IN ('kprabhu', 'creativenexus');
