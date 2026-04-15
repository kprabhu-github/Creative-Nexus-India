-- Lead Qualification Scores
CREATE TABLE IF NOT EXISTS lead_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id text UNIQUE NOT NULL,
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  reasoning text NOT NULL DEFAULT '',
  qualified boolean NOT NULL DEFAULT false,
  spam boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'closed', 'spam')),
  org_id uuid NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_scores_lead_id ON lead_scores(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_scores_score ON lead_scores(score);
CREATE INDEX IF NOT EXISTS idx_lead_scores_org_id ON lead_scores(org_id);

ALTER TABLE lead_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_scores_org_access" ON lead_scores
  FOR ALL USING (org_id = 'a0000000-0000-0000-0000-000000000001'::uuid);

-- Lead Emails (drafts, sent, follow-ups)
CREATE TABLE IF NOT EXISTS lead_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id text NOT NULL,
  email_type text NOT NULL CHECK (email_type IN ('acknowledgement', 'followup_1', 'followup_2', 'followup_3', 'followup_4')),
  to_email text NOT NULL,
  cc_emails text[] NOT NULL DEFAULT '{}',
  subject text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  body_text text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'queued', 'sent', 'failed', 'cancelled')),
  sent_at timestamptz,
  error text,
  org_id uuid NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_emails_lead_id ON lead_emails(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_emails_status ON lead_emails(status);
CREATE INDEX IF NOT EXISTS idx_lead_emails_org_id ON lead_emails(org_id);

ALTER TABLE lead_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_emails_org_access" ON lead_emails
  FOR ALL USING (org_id = 'a0000000-0000-0000-0000-000000000001'::uuid);

-- Lead Follow-up Schedule
CREATE TABLE IF NOT EXISTS lead_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id text NOT NULL,
  step integer NOT NULL CHECK (step >= 1 AND step <= 4),
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'skipped')),
  email_id uuid REFERENCES lead_emails(id),
  org_id uuid NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_followups_status_scheduled ON lead_followups(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_lead_followups_lead_id ON lead_followups(lead_id);

ALTER TABLE lead_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_followups_org_access" ON lead_followups
  FOR ALL USING (org_id = 'a0000000-0000-0000-0000-000000000001'::uuid);
