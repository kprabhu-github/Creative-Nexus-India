-- ---------------------------------------------------------------------------
-- GTM Engine tables — gtm_ prefix
-- ---------------------------------------------------------------------------
-- Depends on: core_schema migration (core_organisations)
-- Supports: W9 (ICP + Lead Gen), W10 (Outreach Campaigns)
-- ---------------------------------------------------------------------------

-- 1. gtm_icps — Ideal Customer Profiles
CREATE TABLE gtm_icps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES core_organisations(id) ON DELETE CASCADE,
    product_description TEXT NOT NULL,
    target_market TEXT,
    ideal_buyer TEXT,
    competitors TEXT[] DEFAULT '{}',
    firmographics JSONB,                                 -- company_size, industry, tech_stack, funding_stage, revenue_range
    buyer_personas JSONB,                                -- array of detailed personas
    buying_triggers JSONB,                               -- signals that indicate purchase intent
    disqualification_criteria JSONB,                     -- reasons to exclude a lead
    scoring_rubric JSONB,                                -- 0-100 weighted scoring factors
    full_icp JSONB NOT NULL DEFAULT '{}'::jsonb,         -- complete ICP document from Claude
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','active','archived')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_gtm_icps_org_id ON gtm_icps(org_id);
CREATE INDEX idx_gtm_icps_status ON gtm_icps(status);
CREATE INDEX idx_gtm_icps_created_at ON gtm_icps(created_at DESC);

CREATE TRIGGER set_gtm_icps_updated_at
BEFORE UPDATE ON gtm_icps
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. gtm_leads — Generated/enriched leads
CREATE TABLE gtm_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES core_organisations(id) ON DELETE CASCADE,
    icp_id UUID REFERENCES gtm_icps(id) ON DELETE SET NULL,
    company_name TEXT NOT NULL,
    company_domain TEXT,
    industry TEXT,
    employee_count TEXT,                                  -- range string e.g. "50-200"
    funding_stage TEXT,
    revenue_range TEXT,
    contact_name TEXT,
    contact_title TEXT,
    contact_email TEXT,
    contact_linkedin TEXT,
    icp_score INTEGER DEFAULT 0 CHECK (icp_score >= 0 AND icp_score <= 100),
    intent_signals JSONB DEFAULT '[]'::jsonb,            -- detected buying signals
    enrichment_data JSONB DEFAULT '{}'::jsonb,            -- extra data from research
    source TEXT DEFAULT 'ai_generated',                   -- 'ai_generated', 'scraped', 'imported', 'manual'
    status TEXT NOT NULL DEFAULT 'new'
        CHECK (status IN ('new','qualified','contacted','nurturing','converted','disqualified')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_gtm_leads_org_id ON gtm_leads(org_id);
CREATE INDEX idx_gtm_leads_icp_id ON gtm_leads(icp_id);
CREATE INDEX idx_gtm_leads_icp_score ON gtm_leads(icp_score DESC);
CREATE INDEX idx_gtm_leads_status ON gtm_leads(status);
CREATE INDEX idx_gtm_leads_created_at ON gtm_leads(created_at DESC);

CREATE TRIGGER set_gtm_leads_updated_at
BEFORE UPDATE ON gtm_leads
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. gtm_campaigns — Outreach campaign sequences
CREATE TABLE gtm_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES core_organisations(id) ON DELETE CASCADE,
    icp_id UUID REFERENCES gtm_icps(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    target_role TEXT,
    target_industry TEXT,
    product_value TEXT,
    tone TEXT DEFAULT 'professional'
        CHECK (tone IN ('professional','casual','direct')),
    sequence JSONB NOT NULL DEFAULT '[]'::jsonb,          -- 5-step campaign sequence
    emails JSONB NOT NULL DEFAULT '[]'::jsonb,            -- full email copy per step
    linkedin_messages JSONB NOT NULL DEFAULT '{}'::jsonb,  -- connection request, follow-up, engagement
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','active','paused','completed','archived')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_gtm_campaigns_org_id ON gtm_campaigns(org_id);
CREATE INDEX idx_gtm_campaigns_icp_id ON gtm_campaigns(icp_id);
CREATE INDEX idx_gtm_campaigns_status ON gtm_campaigns(status);
CREATE INDEX idx_gtm_campaigns_created_at ON gtm_campaigns(created_at DESC);

CREATE TRIGGER set_gtm_campaigns_updated_at
BEFORE UPDATE ON gtm_campaigns
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS Policies
-- ---------------------------------------------------------------------------

ALTER TABLE gtm_icps ENABLE ROW LEVEL SECURITY;
ALTER TABLE gtm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE gtm_campaigns ENABLE ROW LEVEL SECURITY;

-- gtm_icps: scoped to org
CREATE POLICY "ICPs scoped to org"
ON gtm_icps FOR SELECT TO authenticated
USING (org_id = get_user_org_id() OR get_user_role() = 'super_admin');

CREATE POLICY "ICPs insertable by org members"
ON gtm_icps FOR INSERT TO authenticated
WITH CHECK (org_id = get_user_org_id() OR get_user_role() = 'super_admin');

CREATE POLICY "ICPs updatable by org members"
ON gtm_icps FOR UPDATE TO authenticated
USING (org_id = get_user_org_id() OR get_user_role() = 'super_admin');

-- gtm_leads: scoped to org
CREATE POLICY "Leads scoped to org"
ON gtm_leads FOR SELECT TO authenticated
USING (org_id = get_user_org_id() OR get_user_role() = 'super_admin');

CREATE POLICY "Leads insertable by org members"
ON gtm_leads FOR INSERT TO authenticated
WITH CHECK (org_id = get_user_org_id() OR get_user_role() = 'super_admin');

CREATE POLICY "Leads updatable by org members"
ON gtm_leads FOR UPDATE TO authenticated
USING (org_id = get_user_org_id() OR get_user_role() = 'super_admin');

-- gtm_campaigns: scoped to org
CREATE POLICY "Campaigns scoped to org"
ON gtm_campaigns FOR SELECT TO authenticated
USING (org_id = get_user_org_id() OR get_user_role() = 'super_admin');

CREATE POLICY "Campaigns insertable by org members"
ON gtm_campaigns FOR INSERT TO authenticated
WITH CHECK (org_id = get_user_org_id() OR get_user_role() = 'super_admin');

CREATE POLICY "Campaigns updatable by org members"
ON gtm_campaigns FOR UPDATE TO authenticated
USING (org_id = get_user_org_id() OR get_user_role() = 'super_admin');
