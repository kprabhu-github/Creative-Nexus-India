-- ---------------------------------------------------------------------------
-- Signal Engine tables — sig_ prefix
-- ---------------------------------------------------------------------------
-- Depends on: core_schema migration (core_organisations, core_users)
-- ---------------------------------------------------------------------------

-- 1. sig_workflows — catalog of available workflows
CREATE TABLE sig_workflows (
    code TEXT PRIMARY KEY,                              -- e.g. "W7"
    name TEXT NOT NULL,                                 -- e.g. "Client Onboarding"
    description TEXT,
    agent_sequence TEXT[] NOT NULL DEFAULT '{}',         -- ordered agent codes ["A01","A02","A03"]
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER set_sig_workflows_updated_at
BEFORE UPDATE ON sig_workflows
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed W7 workflow
INSERT INTO sig_workflows (code, name, description, agent_sequence) VALUES
('W7', 'Client Onboarding', 'Brand intel + audience insights + brand strategy brief', ARRAY['A01','A02','A03']);

-- 2. sig_runs — individual workflow executions
CREATE TABLE sig_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES core_organisations(id) ON DELETE CASCADE,
    client_id UUID,                                     -- references core_clients if exists
    workflow_code TEXT NOT NULL REFERENCES sig_workflows(code),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','running','completed','failed','cancelled')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    input JSONB NOT NULL DEFAULT '{}'::jsonb,
    output JSONB,
    error TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_sig_runs_org_id ON sig_runs(org_id);
CREATE INDEX idx_sig_runs_workflow_code ON sig_runs(workflow_code);
CREATE INDEX idx_sig_runs_status ON sig_runs(status);
CREATE INDEX idx_sig_runs_created_at ON sig_runs(created_at DESC);

CREATE TRIGGER set_sig_runs_updated_at
BEFORE UPDATE ON sig_runs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. sig_agent_runs — individual agent executions within a run
CREATE TABLE sig_agent_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES sig_runs(id) ON DELETE CASCADE,
    agent_code TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','running','completed','failed','skipped')),
    input JSONB NOT NULL DEFAULT '{}'::jsonb,
    output JSONB,
    error TEXT,
    tokens_in INTEGER DEFAULT 0,
    tokens_out INTEGER DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_sig_agent_runs_run_id ON sig_agent_runs(run_id);
CREATE INDEX idx_sig_agent_runs_agent_code ON sig_agent_runs(agent_code);
CREATE INDEX idx_sig_agent_runs_status ON sig_agent_runs(status);

-- 4. sig_brand_briefs — compiled brand briefs from onboarding
CREATE TABLE sig_brand_briefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES core_organisations(id) ON DELETE CASCADE,
    client_id UUID,
    run_id UUID REFERENCES sig_runs(id) ON DELETE SET NULL,
    version INTEGER DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','review','approved','archived')),
    positioning JSONB,                                  -- brand positioning data
    voice_guidelines JSONB,                             -- tone, vocabulary, banned phrases
    content_pillars JSONB,                              -- 5-7 topic pillars
    competitor_map JSONB,                               -- competitive positioning
    audience_personas JSONB,                            -- buyer personas from A02
    strategy_recommendations JSONB,                     -- from A03
    full_brief JSONB,                                   -- complete compiled brief
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_sig_brand_briefs_org_id ON sig_brand_briefs(org_id);
CREATE INDEX idx_sig_brand_briefs_client_id ON sig_brand_briefs(client_id);
CREATE INDEX idx_sig_brand_briefs_status ON sig_brand_briefs(status);

CREATE TRIGGER set_sig_brand_briefs_updated_at
BEFORE UPDATE ON sig_brand_briefs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. sig_deliverables — output files/documents from workflows
CREATE TABLE sig_deliverables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES core_organisations(id) ON DELETE CASCADE,
    client_id UUID,
    run_id UUID REFERENCES sig_runs(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL,                                 -- 'brand_brief', 'content_plan', etc.
    format TEXT DEFAULT 'json',                         -- 'json', 'pdf', 'docx', 'csv'
    content JSONB,                                      -- the deliverable payload
    file_url TEXT,                                       -- optional file storage URL
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','review','approved','published','archived')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_sig_deliverables_org_id ON sig_deliverables(org_id);
CREATE INDEX idx_sig_deliverables_run_id ON sig_deliverables(run_id);
CREATE INDEX idx_sig_deliverables_type ON sig_deliverables(type);

CREATE TRIGGER set_sig_deliverables_updated_at
BEFORE UPDATE ON sig_deliverables
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. sig_onboarding — client onboarding questionnaire responses
CREATE TABLE sig_onboarding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES core_organisations(id) ON DELETE CASCADE,
    client_id UUID,
    client_domain TEXT,
    competitors TEXT[] DEFAULT '{}',
    target_audience TEXT,
    industry TEXT,
    additional_context JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending','in_progress','completed')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_sig_onboarding_org_id ON sig_onboarding(org_id);

CREATE TRIGGER set_sig_onboarding_updated_at
BEFORE UPDATE ON sig_onboarding
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS Policies
-- ---------------------------------------------------------------------------

ALTER TABLE sig_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE sig_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sig_agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sig_brand_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sig_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE sig_onboarding ENABLE ROW LEVEL SECURITY;

-- sig_workflows: readable by all authenticated users
CREATE POLICY "Workflows readable by all"
ON sig_workflows FOR SELECT TO authenticated USING (true);

-- sig_runs: scoped to org
CREATE POLICY "Runs scoped to org"
ON sig_runs FOR SELECT TO authenticated
USING (org_id = get_user_org_id() OR get_user_role() = 'super_admin');

CREATE POLICY "Runs insertable by org members"
ON sig_runs FOR INSERT TO authenticated
WITH CHECK (org_id = get_user_org_id() OR get_user_role() = 'super_admin');

-- sig_agent_runs: readable if user can see the parent run
CREATE POLICY "Agent runs readable via run access"
ON sig_agent_runs FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM sig_runs
        WHERE sig_runs.id = sig_agent_runs.run_id
        AND (sig_runs.org_id = get_user_org_id() OR get_user_role() = 'super_admin')
    )
);

-- sig_brand_briefs: scoped to org
CREATE POLICY "Brand briefs scoped to org"
ON sig_brand_briefs FOR SELECT TO authenticated
USING (org_id = get_user_org_id() OR get_user_role() = 'super_admin');

-- sig_deliverables: scoped to org
CREATE POLICY "Deliverables scoped to org"
ON sig_deliverables FOR SELECT TO authenticated
USING (org_id = get_user_org_id() OR get_user_role() = 'super_admin');

-- sig_onboarding: scoped to org
CREATE POLICY "Onboarding scoped to org"
ON sig_onboarding FOR ALL TO authenticated
USING (org_id = get_user_org_id() OR get_user_role() = 'super_admin');
