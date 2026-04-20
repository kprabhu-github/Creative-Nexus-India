-- ---------------------------------------------------------------------------
-- Seed demo campaigns + prospects for K. Prabhu and Creative Nexus India
-- Runs ONLY if the accounts exist (safe to re-run)
-- ---------------------------------------------------------------------------

-- ─── Demo Campaign 1: CMO Outreach from K. Prabhu (personal) ───────────────
INSERT INTO linkedin_campaigns (
  name, account_id, source, source_url, status, description,
  funnel_steps
)
SELECT
  'CMO Outreach — SaaS & E-Commerce India',
  a.id,
  'company_employees',
  'https://www.linkedin.com/company/razorpay/',
  'active',
  'Target marketing leaders at SaaS + E-commerce companies in India. Personal outreach via K. Prabhu.',
  '[
    {"id":"step_1","actionId":"follow","delay":0,"dailyLimit":40,"template":"","replyDetect":true,"aiPersonalise":true,"spintax":false,"attachImage":false},
    {"id":"step_2","actionId":"visit","delay":1,"dailyLimit":100,"template":"","replyDetect":true,"aiPersonalise":true,"spintax":false,"attachImage":false},
    {"id":"step_3","actionId":"like","delay":3,"dailyLimit":80,"template":"","replyDetect":true,"aiPersonalise":true,"spintax":false,"attachImage":false},
    {"id":"step_4","actionId":"connect","delay":4,"dailyLimit":20,"template":"Hi {firstName}, I noticed {company}''s work in {industry} — would love to connect and share some ideas on digital growth.","replyDetect":true,"aiPersonalise":true,"spintax":false,"attachImage":false},
    {"id":"step_5","actionId":"message","delay":7,"dailyLimit":50,"template":"Hi {firstName}, thanks for connecting. Quick one — are you currently working with a marketing partner? We''ve helped similar companies with {service}. Happy to share details.","replyDetect":true,"aiPersonalise":true,"spintax":false,"attachImage":false},
    {"id":"step_6","actionId":"followup","delay":14,"dailyLimit":50,"template":"Hi {firstName}, following up on my last note. Would love to show you what we''ve done for brands like {company}. Worth a 20-min call?","replyDetect":true,"aiPersonalise":true,"spintax":false,"attachImage":false}
  ]'::jsonb
FROM linkedin_accounts a
WHERE a.slug = 'kprabhu'
  AND NOT EXISTS (
    SELECT 1 FROM linkedin_campaigns
    WHERE name = 'CMO Outreach — SaaS & E-Commerce India'
  );

-- ─── Demo Campaign 2: Follower growth for Creative Nexus (company) ─────────
INSERT INTO linkedin_campaigns (
  name, account_id, source, source_url, status, description,
  funnel_steps
)
SELECT
  'Creative Nexus — Follower Growth',
  a.id,
  'company_employees',
  'https://www.linkedin.com/company/creativenexus.in/',
  'draft',
  'Grow Creative Nexus company page followers through invite + content engagement.',
  '[
    {"id":"step_1","actionId":"follow","delay":0,"dailyLimit":100,"template":"","replyDetect":false,"aiPersonalise":false,"spintax":false,"attachImage":false},
    {"id":"step_2","actionId":"like","delay":2,"dailyLimit":50,"template":"","replyDetect":false,"aiPersonalise":false,"spintax":false,"attachImage":false},
    {"id":"step_3","actionId":"message","delay":5,"dailyLimit":20,"template":"Hi {firstName}, I noticed your post on {industry} — stop by @CreativeNexusIndia for more on branding, video, and performance marketing.","replyDetect":true,"aiPersonalise":true,"spintax":false,"attachImage":false}
  ]'::jsonb
FROM linkedin_accounts a
WHERE a.slug = 'creativenexus'
  AND NOT EXISTS (
    SELECT 1 FROM linkedin_campaigns
    WHERE name = 'Creative Nexus — Follower Growth'
  );

-- ─── Seed sample prospects into Campaign 1 (CMO Outreach) ──────────────────
INSERT INTO linkedin_prospects (
  campaign_id, name, first_name, headline, company, industry, location,
  email, profile_url, score, step, status, reply_received, last_action
)
SELECT c.id, v.name, v.first_name, v.headline, v.company, v.industry, v.location,
       v.email, v.profile_url, v.score, v.step, v.status, v.reply_received,
       v.last_action::timestamptz
FROM linkedin_campaigns c
CROSS JOIN (VALUES
  ('Ankit Bhatia','Ankit','VP Marketing @ Zomato','Zomato','E-Commerce','Gurugram','a.bhatia@zomato.com','https://linkedin.com/in/ankit-bhatia-seed',92,2,'in_sequence',false,'2026-04-18T10:00:00Z'),
  ('Ritu Shenoy','Ritu','CMO @ Meesho','Meesho','E-Commerce','Bengaluru',NULL,'https://linkedin.com/in/ritu-shenoy-seed',88,1,'pending',false,NULL),
  ('Karan Malhotra','Karan','Head of Digital @ HDFC Life','HDFC Life','Finance','Mumbai',NULL,'https://linkedin.com/in/karan-malhotra-seed',79,3,'in_sequence',true,'2026-04-15T14:00:00Z'),
  ('Sneha Iyer','Sneha','Brand Manager @ Nykaa','Nykaa','E-Commerce','Mumbai','sneha.iyer@nykaa.com','https://linkedin.com/in/sneha-iyer-seed',95,0,'replied',true,'2026-04-19T09:30:00Z'),
  ('Deepak Verma','Deepak','VP Growth @ Razorpay','Razorpay','SaaS','Bengaluru',NULL,'https://linkedin.com/in/deepak-verma-seed',83,1,'pending',false,NULL),
  ('Prachi Gupta','Prachi','Marketing Director @ Apollo247','Apollo247','Healthcare','Hyderabad','prachi.g@apollo247.com','https://linkedin.com/in/prachi-gupta-seed',87,2,'in_sequence',false,'2026-04-17T11:00:00Z'),
  ('Vivek Nair','Vivek','Co-founder @ UrbanPiper','UrbanPiper','SaaS','Bengaluru',NULL,'https://linkedin.com/in/vivek-nair-seed',81,0,'meeting',true,'2026-04-19T13:00:00Z'),
  ('Sonal Mehta','Sonal','CMO @ Wow! Momo','Wow! Momo','F&B / FMCG','Kolkata','sonal@wowmomo.in','https://linkedin.com/in/sonal-mehta-seed',74,1,'pending',false,NULL)
) AS v(name, first_name, headline, company, industry, location, email, profile_url, score, step, status, reply_received, last_action)
WHERE c.name = 'CMO Outreach — SaaS & E-Commerce India'
  AND NOT EXISTS (
    SELECT 1 FROM linkedin_prospects
    WHERE profile_url = v.profile_url
  );

-- ─── Log the seeding ──────────────────────────────────────────────────────
INSERT INTO linkedin_activity_log (account_id, message, type)
SELECT a.id,
       'Seeded demo campaign "CMO Outreach — SaaS & E-Commerce India" with 8 sample prospects',
       'success'
FROM linkedin_accounts a
WHERE a.slug = 'kprabhu'
  AND NOT EXISTS (
    SELECT 1 FROM linkedin_activity_log
    WHERE message LIKE 'Seeded demo campaign "CMO Outreach%'
  );

INSERT INTO linkedin_activity_log (account_id, message, type)
SELECT a.id,
       'Seeded demo campaign "Creative Nexus — Follower Growth" (draft, 3-step funnel)',
       'success'
FROM linkedin_accounts a
WHERE a.slug = 'creativenexus'
  AND NOT EXISTS (
    SELECT 1 FROM linkedin_activity_log
    WHERE message LIKE 'Seeded demo campaign "Creative Nexus%'
  );
