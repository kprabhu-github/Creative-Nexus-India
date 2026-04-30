# Migrate from Hostinger to Vercel — emergency runbook

**Reason:** Hostinger's hCDN reCAPTCHA Enterprise quota exceeded → site returns 403/504 on every request.

**Time:** ~15-20 min start to live.

**Cost:** Free tier (Vercel hobby) handles this app fine.

---

## Step 1 — Sign up / log in to Vercel (1 min)

1. Go to https://vercel.com
2. Sign in with GitHub (use the same `kprabhu-github` account)
3. If first time: click **Sign up with GitHub** → authorise

## Step 2 — Import the repo (2 min)

1. On Vercel dashboard → **Add New…** → **Project**
2. Find `kprabhu-github/CreativeNexus2.0` → click **Import**
3. Project name: `cnx-command-centre`
4. **Production branch:** change from default `master` to **`prod`** (matches our existing flow)
5. Framework Preset: **Next.js** (auto-detected)
6. Build settings: leave defaults (we have `vercel.json`)
7. **Don't click Deploy yet** — env vars first

## Step 3 — Add env vars (5 min)

Click **Environment Variables** dropdown. Two ways:

### Option A — Bulk paste
Paste the entire content of `infra/builds/hostinger-import.env` into the bulk paste box. Vercel parses each `KEY=value` line.

### Option B — One by one
Add each from the list. The 22 vars we need:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- ANTHROPIC_API_KEY
- OPENAI_API_KEY
- NVIDIA_API_KEY
- APIFY_API_TOKEN
- APIFY_LINKEDIN_PROFILE_ACTOR
- APIFY_LINKEDIN_COMPANY_ACTOR
- RAZORPAY_ACCOUNT_ID
- RAZORPAY_KEY_ID
- RAZORPAY_KEY_SECRET
- SEMRUSH_USER_EMAIL
- SEMRUSH_USER_ID
- WOOCOMMERCE_URL
- WOOCOMMERCE_CONSUMER_KEY
- WOOCOMMERCE_CONSUMER_SECRET
- GRAVITY_FORMS_PUBLIC_KEY
- GRAVITY_FORMS_PRIVATE_KEY
- EMAIL_ENCRYPTION_KEY
- CRON_SECRET
- SMTP_CC

Apply each to all 3 environments (Production, Preview, Development).

## Step 4 — Deploy (3 min)

Click **Deploy**. Vercel pulls the `prod` branch, runs `npm install && npm run build`, deploys.

When done you'll get a URL like `cnx-command-centre.vercel.app`. Click it — should load the login page in 1-2 seconds, no JS challenge, no reCAPTCHA.

## Step 5 — Custom domain (5 min)

In Vercel project → **Settings** → **Domains** → **Add** → type `app.creativenexus.in`.

Vercel will tell you which DNS record to set. Usually:

```
Type: CNAME
Name: app
Target: cname.vercel-dns.com
TTL: auto
```

Go to your DNS provider (where `creativenexus.in` is hosted — Hostinger or another):
1. **Delete the old `app` A/CNAME record** that pointed to Hostinger
2. **Add the new CNAME** pointing to `cname.vercel-dns.com`
3. Save

Wait 5-15 min for DNS propagation. Vercel auto-issues SSL once DNS resolves.

## Step 6 — Update Supabase auth redirect URLs

In Supabase → Authentication → URL Configuration, **add the new Vercel URL**:

- Add to Redirect URLs: `https://cnx-command-centre.vercel.app/api/auth/callback`
- Add to Redirect URLs: `https://cnx-command-centre.vercel.app/**`
- Keep `app.creativenexus.in` entries — they keep working after DNS swap

## Step 7 — Update Google OAuth redirect URIs

In Google Cloud Console → Credentials → your OAuth client:
- **Authorized JavaScript origins:** add `https://cnx-command-centre.vercel.app`
- **Authorized redirect URIs:** keep `https://anbdkioadfhvbqptylee.supabase.co/auth/v1/callback` (it's the Supabase callback, no change needed)

## Step 8 — Verify

Visit `https://cnx-command-centre.vercel.app/login` (Vercel URL works immediately).

Wait for DNS propagation (~5-15 min) then `https://app.creativenexus.in/login`.

Sign in with Google — should land on dashboard.

## Step 9 — Hostinger cleanup (optional, can defer)

Once Vercel is verified working:
1. Hostinger panel → your project → Pause or Delete the deployment
2. Cancel any auto-renewal if applicable
3. Update cron job: configure on Vercel (the `vercel.json` already declares `*/2 * * * *` for `/api/cron/email-sync`)

## Cron note

`vercel.json` declares the cron. Hobby tier supports daily crons; if you need every-2-min email sync, you'll need Vercel Pro ($20/month) OR an external cron-as-a-service (cron-job.org is free — point it at `https://app.creativenexus.in/api/cron/email-sync?secret=<CRON_SECRET>` every 2 min).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build fails on Vercel | Check the build log; usually env var missing → add and redeploy |
| OAuth still goes to 0.0.0.0 | Add `NEXT_PUBLIC_SITE_URL=https://app.creativenexus.in` to Vercel env vars |
| Can't reach app.creativenexus.in after DNS swap | Wait longer (TTL was high), check `dig app.creativenexus.in` |
| Cron doesn't fire | Hobby tier limits — use cron-job.org instead |
