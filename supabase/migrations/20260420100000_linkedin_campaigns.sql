-- ---------------------------------------------------------------------------
-- LinkedIn campaigns + prospects
-- funnel_steps stored as JSONB in linkedin_campaigns for simplicity
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS linkedin_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  account_id uuid REFERENCES linkedin_accounts(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'company_employees',
  source_url text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'complete')),
  funnel_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  description text NOT NULL DEFAULT '',
  org_id uuid NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_linkedin_campaigns_account ON linkedin_campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_campaigns_status ON linkedin_campaigns(status);

ALTER TABLE linkedin_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "linkedin_campaigns_org_access" ON linkedin_campaigns;
CREATE POLICY "linkedin_campaigns_org_access" ON linkedin_campaigns
  FOR ALL USING (org_id = 'a0000000-0000-0000-0000-000000000001'::uuid);

CREATE OR REPLACE FUNCTION set_linkedin_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_linkedin_campaigns_updated_at ON linkedin_campaigns;
CREATE TRIGGER set_linkedin_campaigns_updated_at
BEFORE UPDATE ON linkedin_campaigns
FOR EACH ROW
EXECUTE FUNCTION set_linkedin_campaigns_updated_at();

-- Prospects discovered via Apify, tracked through the funnel
CREATE TABLE IF NOT EXISTS linkedin_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES linkedin_campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  first_name text NOT NULL DEFAULT '',
  headline text NOT NULL DEFAULT '',
  company text NOT NULL DEFAULT '',
  industry text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  profile_url text,
  email text,
  score integer NOT NULL DEFAULT 50 CHECK (score BETWEEN 0 AND 100),
  step integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_sequence', 'replied', 'meeting', 'opted_out')),
  reply_received boolean NOT NULL DEFAULT false,
  last_action timestamptz,
  last_message text,
  raw_apify jsonb,
  org_id uuid NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, profile_url)
);

CREATE INDEX IF NOT EXISTS idx_linkedin_prospects_campaign ON linkedin_prospects(campaign_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_prospects_status ON linkedin_prospects(status);
CREATE INDEX IF NOT EXISTS idx_linkedin_prospects_score ON linkedin_prospects(score DESC);

ALTER TABLE linkedin_prospects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "linkedin_prospects_org_access" ON linkedin_prospects;
CREATE POLICY "linkedin_prospects_org_access" ON linkedin_prospects
  FOR ALL USING (org_id = 'a0000000-0000-0000-0000-000000000001'::uuid);

CREATE OR REPLACE FUNCTION set_linkedin_prospects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_linkedin_prospects_updated_at ON linkedin_prospects;
CREATE TRIGGER set_linkedin_prospects_updated_at
BEFORE UPDATE ON linkedin_prospects
FOR EACH ROW
EXECUTE FUNCTION set_linkedin_prospects_updated_at();

-- View for campaign stats
CREATE OR REPLACE VIEW linkedin_campaigns_with_stats AS
SELECT
  c.*,
  COALESCE(stats.prospect_count, 0) AS prospect_count,
  COALESCE(stats.in_sequence, 0) AS in_sequence,
  COALESCE(stats.replied, 0) AS replied,
  COALESCE(stats.meetings, 0) AS meetings
FROM linkedin_campaigns c
LEFT JOIN (
  SELECT
    campaign_id,
    COUNT(*) AS prospect_count,
    COUNT(*) FILTER (WHERE status = 'in_sequence') AS in_sequence,
    COUNT(*) FILTER (WHERE status = 'replied' OR reply_received) AS replied,
    COUNT(*) FILTER (WHERE status = 'meeting') AS meetings
  FROM linkedin_prospects
  GROUP BY campaign_id
) stats ON stats.campaign_id = c.id;
