-- Single-tenant deployment: all ais_* tables auto-fill org_id with the
-- one and only agency UUID. Eliminates an entire class of "null value in
-- column org_id" failures across AI Lab and AI SearchLens routes, regardless
-- of whether the inserting code remembers to pass org_id explicitly.

alter table public.ais_agent_sessions
  alter column org_id set default 'a0000000-0000-0000-0000-000000000001'::uuid;
alter table public.ais_agent_templates
  alter column org_id set default 'a0000000-0000-0000-0000-000000000001'::uuid;
alter table public.ais_citations
  alter column org_id set default 'a0000000-0000-0000-0000-000000000001'::uuid;
alter table public.ais_competitors
  alter column org_id set default 'a0000000-0000-0000-0000-000000000001'::uuid;
alter table public.ais_prompt_scores
  alter column org_id set default 'a0000000-0000-0000-0000-000000000001'::uuid;
alter table public.ais_prompts
  alter column org_id set default 'a0000000-0000-0000-0000-000000000001'::uuid;
alter table public.ais_scans
  alter column org_id set default 'a0000000-0000-0000-0000-000000000001'::uuid;
alter table public.ais_trending_prompts
  alter column org_id set default 'a0000000-0000-0000-0000-000000000001'::uuid;
alter table public.ais_visibility_scores
  alter column org_id set default 'a0000000-0000-0000-0000-000000000001'::uuid;
