Huginn Hunt Intelligence — Decision Log
What This File Is
A running log of meaningful technical and product decisions — what was decided, why, and what was ruled out. Prevents re-litigating the same decisions in future sessions and gives context when something looks unusual.
Technical Decisions
Single-file architecture (index.html)
Decision: Keep entire app in one /public/index.html file Reason: Fast iteration, no build step, easy to upload/download/deploy as a single unit during early development. Claude Code sessions are more efficient with one file to read. Trade-off: Will eventually need to split into components as complexity grows. Revisit when file exceeds ~6000 lines or when Auth/multi-property work begins. Date: Mar 2026
Vanilla JS over React/Vue/etc
Decision: No frontend framework — vanilla HTML/CSS/JS only Reason: Owner is not a professional developer. Vanilla is easier to read, debug, and modify without framework knowledge. No build toolchain to maintain. Trade-off: No component reuse, more verbose DOM manipulation. Acceptable at current scale. Date: Mar 2026
Anthropic API — Vercel serverless proxy
Decision: All AI calls go through /api/claude.js Vercel serverless function. Key stored in ANTHROPIC_KEY Vercel env var. Reason: Never expose API key client-side. Serverless function acts as secure middleman. Rule: After any Vercel env var change, must redeploy for it to take effect. Date: Mar 2026
Mapbox GL JS v3.3.0
Decision: Pinned to v3.3.0 Reason: Tested and stable for this use case. Do not upgrade without testing all map features — marker behavior, layer rendering, and style switching can change between versions. Date: Mar 2026
Camera pin anchor + offset
Decision: TBD — currently being debugged Context: Original implementation used anchor: 'bottom' with offset: [0, -18] on Mapbox markers. This caused visual drift between pin icons and movement line endpoints at varying zoom levels. Two fix attempts (commits fada88e, cab1934) made things worse. Reverted to be885d1. Correct fix: zero out offset, anchor teardrop SVG tip naturally at coordinate bottom. Date: Mar 2026
Supabase over Firebase / PlanetScale / etc
Decision: Supabase for all backend needs Reason: PostgreSQL (real SQL), Auth, Storage, and REST API in one platform. Generous free tier. PostGIS extension available when needed. RLS for row-level security when multi-user ships. Date: Mar 2026
Multi-property architecture — property_id first
Decision: Add property_id to all tables before Auth goes live Reason: Retrofitting multi-tenancy after Auth is painful. Build the data model right from the start even if only one property exists. Rule: Never hardcode Cooley Lake property ID. Always filter by property_id. Date: Planned
PostGIS — defer until FAB markers
Decision: Enable Supabase PostGIS extension when FAB marker system is built Reason: Current float8 lat/lng pairs work fine at current scale. PostGIS pays off when accumulating stand markers, scrape/rub markers, observation points, and draw layer polygons. Time the migration to coincide with FAB marker build so it's one schema update. Note: PostGIS will NOT fix the current pin/line visual alignment bug — that is a front-end rendering issue, not a data issue. Date: Planned
Auth — after multi-property architecture
Decision: Supabase Auth (email/password + magic link) with invite code gate (COOLEY2025) Reason: Auth without multi-property creates a mess to unpick. Property_id schema must be in place first. Date: Planned
Product Decisions
Source field on sightings
Decision: Every sighting record has source: 'camera' | 'observation' Reason: Camera sightings and field observations are fundamentally different data types. Source field enables filtering, analytics, and Hunt AI to weight them differently. Date: Mar 2026
Buck tag optional on field observations
Decision: Buck name field is always optional — never required Reason: Most field observations won't involve a named buck. Forcing a tag creates friction and junk data. Date: Mar 2026
Observation location — GPS or pin drop (user picks)
Decision: Field observations offer GPS blue dot OR manual pin drop. Neither is required to submit. Reason: GPS may not be available in the field. Some observations (e.g. rub found on a scouting walk) need precise placement. Null location is better than wrong location. Date: Mar 2026
Cooley Lake = Property #1 / personal dogfood
Decision: All features are built against the real Cooley Lake data first Reason: Real data surfaces real bugs. Justin is the primary user and tester. Dan and Andy will be first additional users when Auth ships. Date: Mar 2026
AI calls always server-side
Decision: No Anthropic API calls from client JavaScript. Ever. Reason: Security. API key exposure in a public web app is unacceptable. Date: Mar 2026
