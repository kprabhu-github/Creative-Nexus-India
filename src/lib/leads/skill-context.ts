// Condensed marketing skill knowledge extracted from 25 Corey Haines skills.
// These get injected into AI agent system prompts as context — not displayed in UI.

/** Copywriting + copy-editing + email-sequence principles for the email agent */
export const EMAIL_WRITING_SKILLS = `
COPYWRITING PRINCIPLES (from expert copywriting framework):
- Clarity over cleverness. If you have to choose, choose clear.
- Benefits over features. Don't say what it does — say what it means for them.
- Specificity over vagueness. "Cut reporting from 4 hours to 15 minutes" beats "Save time."
- Customer language over company language. Mirror how they wrote their message.
- One idea per paragraph. Each paragraph advances one point.

WRITING STYLE RULES:
- "Use" not "utilize." "Help" not "facilitate." "Set up" not "implement."
- Cut these words: very, really, just, actually, basically, incredibly, innovative, robust, seamless, cutting-edge.
- Active voice always. "We build websites" not "Websites are built by us."
- Remove adverbs. If the verb is strong, it doesn't need help.
- No exclamation points. Confidence doesn't shout.
- Front-load the important information in each sentence.
- Vary sentence length. Mix short punchy with medium. Never long.

EMAIL SEQUENCE INTELLIGENCE:
- One email = one job. One primary CTA per email.
- Value before ask. Lead with usefulness, then earn the right to ask.
- Structure every email: Hook (first line grabs) → Context (why this matters to them) → Value (the useful content) → CTA (what to do next).
- Subject lines: Clear > Clever. 40-60 characters. Benefit or curiosity-driven.
- Patterns that work: Questions ("Still thinking about X?"), How-to ("How to achieve Y"), Direct ("{Name}, your Z is ready").
- Email length: 150-300 words for outreach. Never exceed 300.
- Preview text: Extend the subject, don't repeat it. 90-140 characters.

COPY EDITING CHECKLIST (run mentally before outputting):
- Sweep 1 CLARITY: Can the reader understand instantly? No jargon, no compound sentences.
- Sweep 2 VOICE: Consistent tone throughout? No shifts from casual to corporate.
- Sweep 3 SO WHAT: Every claim answers "why should I care?" Features connect to benefits.
- Sweep 4 PROVE IT: No unearned superlatives. No "best" or "leading" without evidence.
- Sweep 5 SPECIFICITY: Replace vague with concrete. Numbers, timeframes, examples.
- Sweep 6 EMOTION: Does it make them feel something? Paint the before/after.
- Sweep 7 ZERO RISK: Remove every barrier to action. Make saying yes easy.

CTA FORMULAS:
- Weak: Submit, Sign Up, Learn More, Click Here, Get Started
- Strong: [Action Verb] + [What They Get] — "Book a 10-minute sync", "See your custom proposal", "Get the design samples"
`;

/** Marketing psychology principles for qualification + email persuasion */
export const PSYCHOLOGY_SKILLS = `
MARKETING PSYCHOLOGY (key principles for lead communication):

UNDERSTANDING BUYERS:
- Jobs to Be Done: They don't want your service — they want the outcome it creates.
- Curse of Knowledge: Your service is obvious to you but confusing to them. Explain simply.
- Mere Exposure Effect: Consistent follow-ups build familiarity and preference.
- Confirmation Bias: Align with what they already believe. Don't fight their worldview.

PERSUASION (use ethically):
- Reciprocity: Give value first (insight, stat, resource). They'll feel obligated to respond.
- Commitment & Consistency: The form submission was their first commitment. Build on it.
- Authority: Reference expertise naturally. Don't claim "best" — demonstrate knowledge.
- Social Proof: Mention relevant client work or numbers when genuine.
- Scarcity: Only when real. "We take on 3-4 new projects per month" if true.
- Pratfall Effect: A small honest admission ("We're not the cheapest") builds trust.

REDUCING FRICTION:
- Loss Aversion: Frame what they'll miss, not just what they'll gain.
- Status-Quo Bias: Make the next step feel safe and easy, not like a big commitment.
- Paradox of Choice: Don't offer multiple options. One clear next step.
- Activation Energy: Make the first action trivially easy. "Just reply to this email" or "Pick a 10-min slot."
- Peak-End Rule: End every email on a high note — warmth, value, easy CTA.
- Zero Risk: "No commitment, just a quick chat" removes all perceived risk.

PRICING PSYCHOLOGY (for proposals/follow-ups):
- Anchoring: Mention the value first, price second.
- Mental Accounting: "Less than your morning coffee" reframes cost.
- Framing: "90% of our clients see results in 30 days" beats "10% don't see immediate results."
`;

/** Full SEO skills for SearchLens agent (seo-audit + schema-markup + programmatic-seo) */
export const SEO_SKILLS = `
SEO AUDIT FRAMEWORK (from expert SEO audit skill):

AUDIT PRIORITY ORDER:
1. Crawlability & Indexation — can search engines find and index it?
2. Technical Foundations — is the site fast and functional?
3. On-Page Optimization — is content optimized?
4. Content Quality — does it deserve to rank?
5. Authority & Links — does it have credibility?

TECHNICAL SEO:
- Robots.txt: check for unintentional blocks, verify sitemap reference
- XML Sitemap: exists, submitted to Search Console, contains only canonical indexable URLs
- Site architecture: important pages within 3 clicks, logical hierarchy, no orphan pages
- Core Web Vitals: LCP < 2.5s, INP < 200ms, CLS < 0.1
- Mobile: responsive design, proper viewport, same content as desktop
- HTTPS: valid SSL, no mixed content, HTTP→HTTPS redirects
- URLs: readable, descriptive, lowercase, hyphen-separated

ON-PAGE SEO:
- Title tags: unique per page, primary keyword near beginning, 50-60 chars, compelling
- Meta descriptions: unique, 150-160 chars, includes keyword, has CTA
- Headings: one H1 per page with primary keyword, logical H1→H2→H3 hierarchy
- Content: keyword in first 100 words, related keywords natural, sufficient depth
- Images: descriptive filenames, alt text, compressed, WebP format, lazy loading
- Internal linking: important pages well-linked, descriptive anchor text, no broken links

CONTENT QUALITY (E-E-A-T):
- Experience: first-hand experience demonstrated, original insights/data
- Expertise: author credentials visible, accurate detailed information
- Authoritativeness: recognized in space, cited by others
- Trustworthiness: accurate info, transparent, contact info, privacy policy, HTTPS

KEYWORD TARGETING:
- Clear primary keyword per page
- Title, H1, URL aligned to same keyword
- Content satisfies search intent
- No keyword cannibalization between pages
- Topical clusters with hub-and-spoke linking

SCHEMA MARKUP:
- Use JSON-LD format (Google recommended)
- Organization schema on homepage: name, url, logo, sameAs
- Article/BlogPosting: headline, image, datePublished, author, dateModified
- FAQPage: mainEntity with Q&A array
- BreadcrumbList: itemListElement with position, name, item
- LocalBusiness: name, address, phone, geo coordinates
- Combine multiple types using @graph
- Validate with Google Rich Results Test before deploying

PROGRAMMATIC SEO (pages at scale):
- Every page MUST provide unique value — not just variable swaps
- Proprietary data wins: your data > user-generated > licensed > public
- Use subfolders not subdomains: site.com/templates/resume/ NOT templates.site.com
- 12 playbooks: Templates, Curation, Comparisons, Examples, Locations, Personas, Integrations, Glossary, Directory, Conversions, Translations, Profiles
- Hub-and-spoke internal linking: category hub → individual pages → cross-links
- Quality over quantity: 100 great pages beat 10,000 thin ones
- Pre-launch checks: unique titles/metas, heading structure, schema, page speed, internal links

COMMON ISSUES BY SITE TYPE:
- SaaS: product pages lack depth, blog not integrated, missing comparison pages
- Services: missing location pages, thin service pages, no case studies
- E-commerce: duplicate product descriptions, missing product schema, faceted nav issues

OUTPUT FORMAT FOR AUDIT:
1. Executive Summary: overall health, top 3-5 priorities, quick wins
2. Per issue: What's wrong → Impact (H/M/L) → Evidence → Fix → Priority
3. Action plan: Critical fixes → High-impact → Quick wins → Long-term
`;

/** Full content strategy for Signal Engine (content-strategy + social-content + competitor-alternatives) */
export const CONTENT_STRATEGY_SKILLS = `
CONTENT STRATEGY FRAMEWORK (from expert content strategy skill):

AUDIENCE-FIRST PLANNING:
- Start with audience pain points, not product features
- Map content to buyer journey: Awareness → Consideration → Decision
- Content types by intent: Blog (awareness), Case study (consideration), Landing page (decision)
- Distribution > creation: One great piece across 5 channels beats 5 mediocre pieces

COMPETITOR GAP ANALYSIS:
- Map competitor content: what topics do they cover, what do they rank for?
- Find gaps: what are they NOT covering? What questions aren't answered well?
- Position on unique strength: don't compete head-on, find angles they miss
- Alternative/comparison pages: "[Your Product] vs [Competitor]" pages convert well

SOCIAL CONTENT:
- Each platform has its own language and format — don't cross-post identical content
- Hooks in first 3 seconds for video, first line for text
- Engage don't broadcast: conversations > announcements
- Platform priority: focus on 2-3 where audience actually is, not all of them

CONTENT MEASUREMENT:
- Track: organic traffic, rankings, engagement, conversions
- Content that doesn't perform after 90 days: refresh or consolidate
- Double down on what works: find your 20% producing 80% of results
`;

/** Full paid ads for GTM Engine (paid-ads skill) */
export const PAID_ADS_SKILLS = `
PAID ADS FRAMEWORK (from expert paid ads skill):

CAMPAIGN STRATEGY:
- Match ad message to landing page message (scent trail) — break this and conversion dies
- One audience, one message, one CTA per ad group
- Test creative before scaling budget — never scale unproven creative
- Retargeting: most conversions happen on 2nd-7th touch, not first click
- Budget split: 80% proven channels, 20% experimental bets

AUDIENCE TARGETING:
- Start narrow, expand as you learn — broad targeting wastes budget
- Lookalike audiences from best customers, not all customers
- Exclude converters from acquisition campaigns
- Layer demographics + interests + behaviors for precision

AD COPY:
- Headline: specific benefit, not generic claim
- Description: address the objection, then CTA
- Use numbers: "47% faster" beats "much faster"
- Match search intent: informational queries get educational ads, commercial get offer ads

OPTIMIZATION:
- Conversion tracking MUST be verified before spending
- Optimize for the metric that matters: CPA for lead gen, ROAS for e-commerce
- Kill underperformers fast: no ad survives more than 2 weeks without positive signal
- Test one variable at a time: headline OR image OR audience, never all three
`;

// ═══════════════════════════════════════════════════════════════════════════
// SEARCHLENS SKILL SUITE — 6 verticals for AI visibility scanning
// ═══════════════════════════════════════════════════════════════════════════

/** GEO — Generative Engine Optimization (AI search visibility) */
export const GEO_SKILLS = `
GEO — GENERATIVE ENGINE OPTIMIZATION:

WHAT IT IS:
GEO optimizes a brand's visibility in AI-powered search engines — ChatGPT, Claude, Gemini, Perplexity, Copilot. Unlike traditional SEO (ranking on a page), GEO is about being CITED in AI-generated answers.

WHY IT MATTERS:
- AI search is replacing "10 blue links" — users get direct answers
- Brands not cited in AI responses lose 40-60% of search-assisted revenue
- AI models have training data cutoffs — they only know what's in their corpus
- Being cited in AI responses = being recommended to millions without any ad spend

AI CITATION SCORING (0-100):
- Does the AI mention this brand when asked about the category? (30 points)
- Is the mention positive, neutral, or negative? (20 points)
- Is the brand recommended as a top option? (20 points)
- Does the AI provide accurate information about the brand? (15 points)
- Is the brand mentioned across multiple AI platforms? (15 points)

HOW TO IMPROVE AI CITATIONS:
1. STRUCTURED DATA: Schema.org markup (Organization, Service, FAQ) helps AI models parse your site
2. ENTITY OPTIMIZATION: Consistent NAP, Wikipedia/Wikidata presence, knowledge panel
3. CONTENT DEPTH: Comprehensive, authoritative pages that answer questions fully
4. BRAND MENTIONS: Get mentioned on authoritative sites AI models train on
5. FAQ CONTENT: Direct Q&A format pages that AI models can easily extract
6. FRESHNESS: Regular content updates signal active, trustworthy source
7. CITATIONS: Cite sources, link to authoritative references — AI trusts well-cited content

PROMPT TESTING:
- Test 10-20 prompts across ChatGPT, Claude, Gemini, Perplexity
- Categories: commercial ("best X agency"), informational ("what is X"), navigational ("X services")
- Track: mentioned? position? sentiment? accuracy? recommendation?
- Compare against 3-5 competitors on same prompts

METRICS:
- AI Citation Score: % of prompts where brand is mentioned
- Share of Voice: % of category mentions vs competitors
- Sentiment: positive/neutral/negative across platforms
- Accuracy: is the AI saying correct things about you?
`;

/** LSO — Local Search Optimization */
export const LSO_SKILLS = `
LSO — LOCAL SEARCH OPTIMIZATION:

WHAT IT IS:
LSO optimizes visibility in location-based searches — Google Maps, "near me" queries, local pack results, and local AI search. Critical for agencies with physical offices.

GOOGLE BUSINESS PROFILE (GBP):
- Complete every field: name, address, phone, hours, categories, description, services
- Primary category MUST match core service (e.g., "Digital Marketing Agency")
- Add 5-10 secondary categories covering all services
- Photos: 10+ high-quality photos of office, team, work, logo
- Posts: Weekly updates (offers, events, blog links)
- Q&A: Pre-populate with common questions and answers
- Reviews: Actively request reviews from clients — respond to ALL reviews (positive and negative)

LOCAL SCHEMA MARKUP:
- LocalBusiness schema on every location page
- Required: name, address, telephone, geo (lat/lng), openingHours
- Add: areaServed, serviceArea, hasOfferCatalog
- Multiple locations: separate LocalBusiness schema per office

NAP CONSISTENCY (Name, Address, Phone):
- EXACT same format everywhere: website, GBP, directories, social profiles
- Common directories: Google, Bing Places, Justdial, Sulekha, IndiaMART, Yellow Pages India
- Inconsistency = trust penalty from search engines

LOCAL CONTENT:
- Location-specific landing pages: "/digital-marketing-agency-bengaluru"
- Local case studies: "How we helped [Bengaluru company] achieve X"
- Area-specific service pages: "[Service] in [City]"
- Local news/events content
- Embed Google Maps on contact/location pages

CITATION BUILDING:
- Industry directories: Clutch, GoodFirms, DesignRush, Agency Spotter
- Local directories: Justdial, Sulekha, TradeIndia
- Social profiles: LinkedIn Company, Facebook Business, Instagram Business
- All citations must have consistent NAP

METRICS:
- Local pack ranking for target keywords
- GBP impressions, clicks, calls, direction requests
- Review count and average rating
- Citation accuracy score across directories
`;

/** VSO — Video Search Optimization */
export const VSO_SKILLS = `
VSO — VIDEO SEARCH OPTIMIZATION:

WHAT IT IS:
VSO optimizes video content for discovery on YouTube, Google Video results, social video feeds, and AI video search. Video is the fastest-growing search channel.

YOUTUBE SEO:
- Title: primary keyword in first 60 chars, compelling hook
- Description: first 2 lines visible above fold — include keyword + CTA. Full description 200+ words with timestamps
- Tags: primary keyword + variations + related terms (15-20 tags)
- Thumbnail: custom, high-contrast, readable text, face if possible
- Chapters: use timestamps in description for key sections
- Cards + End screens: link to related videos and playlists
- Captions: upload accurate SRT file — helps indexing and accessibility

VIDEO SCHEMA:
- VideoObject schema on pages embedding video
- Required: name, description, thumbnailUrl, uploadDate, duration, contentUrl
- Recommended: transcript, interactionStatistic (views), publisher

CONTENT OPTIMIZATION:
- Hook in first 5 seconds — state the value proposition immediately
- Pattern interrupt every 30-60 seconds to maintain engagement
- Keywords spoken in audio — YouTube transcribes and indexes spoken words
- Playlists: group related videos for binge-watching sessions
- Consistent posting schedule: algorithm rewards regularity

GOOGLE VIDEO RESULTS:
- Pages with embedded video + VideoObject schema rank in video carousels
- Timestamp markup enables "key moments" in search results
- Video must be publicly accessible (not behind login)
- Host on YouTube OR self-host with proper sitemap

SOCIAL VIDEO:
- Instagram Reels: 30-90 seconds, vertical, caption-driven, trending audio
- LinkedIn Video: 1-3 minutes, professional, subtitle overlay mandatory
- Short-form: repurpose long videos into 15-60 second clips for TikTok/Reels/Shorts

METRICS:
- YouTube: impressions, CTR, average view duration, subscriber growth
- Google: video carousel appearances, clicks from video results
- Social: video views, completion rate, shares, saves
- AI: video citations in AI search responses (Perplexity, Gemini)
`;

/** ASO — App Search Optimization */
export const ASO_SKILLS = `
ASO — APP SEARCH OPTIMIZATION:

WHAT IT IS:
ASO optimizes mobile app visibility in app store search results — Google Play Store and Apple App Store. Relevant when the brand has a mobile app.

APP STORE LISTING:
- App name: primary keyword in first 30 chars (Apple) / 50 chars (Google)
- Subtitle (Apple) / Short description (Google): secondary keywords, value proposition
- Full description: keyword-rich, benefit-focused, 4000 chars max
- Keywords field (Apple only): 100 chars, comma-separated, no spaces after commas
- Screenshots: first 3 are most important — show key features with text overlay
- Preview video: 15-30 seconds showing core app experience

KEYWORD RESEARCH:
- Tools: App Annie, Sensor Tower, Mobile Action, AppTweak
- Target: mid-volume keywords where you can rank top 10
- Long-tail: "[category] app for [audience]" patterns
- Competitor keywords: what are competitors ranking for?
- Localize keywords per market

RATINGS & REVIEWS:
- Target 4.5+ star rating
- Prompt for reviews after positive in-app moments (not on first open)
- Respond to negative reviews — shows active developer
- Fix issues mentioned in reviews — stores track sentiment improvement

METRICS:
- Keyword rankings in app store search
- Impressions → page views → installs (conversion funnel)
- Install velocity and retention rate
- Rating and review volume/sentiment
`;

/** ISEO — International Search Engine Optimization */
export const ISEO_SKILLS = `
ISEO — INTERNATIONAL SEO:

WHAT IT IS:
ISEO optimizes visibility across multiple countries, languages, and regional search engines. Goes beyond translation — covers technical setup, local search behavior, and cultural adaptation.

HREFLANG IMPLEMENTATION:
- Add hreflang tags linking all language/region versions of each page
- Format: <link rel="alternate" hreflang="en-in" href="https://creativenexus.in/" />
- Include x-default for fallback: hreflang="x-default"
- Every page in the set must reference ALL other versions (including itself)
- Common errors: missing return tags, wrong language codes, inconsistent URLs

URL STRUCTURE:
- ccTLD: creativenexus.in (India), creativenexus.co.uk (UK) — strongest geo signal
- Subdirectory: creativenexus.com/in/, creativenexus.com/uk/ — easier to manage
- Subdomain: in.creativenexus.com — weaker signal, harder to maintain
- Recommendation: subdirectory for most businesses, ccTLD for primary market

CONTENT LOCALIZATION:
- Translation is minimum — localization is the goal
- Adapt: currency, date formats, phone formats, measurements
- Local references: case studies, testimonials, team from that market
- Local keywords: "digital marketing agency" vs "digital marketing company" — search volume differs by market
- Cultural tone: formal vs casual varies by market

REGIONAL SEARCH ENGINES:
- India: Google dominates (95%+), but optimize for Google India (google.co.in)
- China: Baidu (requires ICP license, separate strategy)
- Russia: Yandex
- South Korea: Naver
- Japan: Google + Yahoo Japan

TECHNICAL SETUP:
- Google Search Console: set geographic targeting per property
- Server location: use CDN with local PoPs for speed
- Local backlinks: get links from .in, .co.uk etc. domains for geo relevance
- Structured data: LocalBusiness schema per region with correct address

METRICS:
- Organic traffic by country/language
- Rankings in target country's Google (google.co.in vs google.com)
- Hreflang coverage and error rate in Search Console
- Local conversion rates vs global average
`;

/** Combined SearchLens skill — all 6 verticals for AI visibility scanning */
export const SEARCHLENS_SKILLS = `${SEO_SKILLS}

${GEO_SKILLS}

${LSO_SKILLS}

${VSO_SKILLS}

${ASO_SKILLS}

${ISEO_SKILLS}`;
