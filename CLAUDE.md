Huginn Hunt Intelligence — Claude Code Session Guide
What Is Huginn?
Huginn is a whitetail deer hunting intelligence web app. It enables hunters to log trail camera sightings and field observations across their hunting properties — tracking named individual bucks, analyzing movement patterns, and getting AI-powered hunt recommendations. Built as a single-file vanilla HTML/JS/CSS app with a Supabase backend.
The long-term vision is a multi-property, multi-user SaaS platform under the Huginn Advisory Group brand — "Know More. Hunt Smarter." Cooley Lake (Suring, Wisconsin) is Property #1 and the personal dogfood instance for all feature development. All features are built property-agnostic from day one.
Tech Stack
* Frontend: Vanilla HTML / CSS / JavaScript — single file (/public/index.html)
* Map: Mapbox GL JS v3.3.0 — satellite base map with camera pins, movement lines, heatmap, core area overlays
* Backend/Database: Supabase (PostgreSQL + Storage) — https://drzmfoaspnahzbrrmnrv.supabase.co
* AI: Anthropic Claude (claude-sonnet-4-5) — routed through /api/claude.js Vercel serverless proxy. API key stored in Vercel env var ANTHROPIC_KEY. Never in HTML.
* Image Storage: Supabase cloud storage bucket trail-cam-photos
* Deployment: Vercel — cooley-lake-tracker.vercel.app
* Version Control: GitHub — github.com/Stullllllyyy/Cooley---Lake---Tracker
Repository Structure
/ (root)   /api     claude.js         ← Vercel serverless proxy for Anthropic API   /public     index.html        ← Entire application (HTML + CSS + JS)     HuginnLogo.svg     HuginnFavicon.svg     HuginnRaven.png     map.jpg   CLAUDE.md           ← This file   PLANNING.md         ← Roadmap and product decisions   TASKS.md            ← Session tasks and backlog   DECISIONS.md        ← Architectural and product decision log
Brand
* Colors: Obsidian #121415, Bronze/Gold #8C7355, Tungsten #4A4D4E, Silver #BCC6CC, Sulfur #E5B53B
* Tagline: "Know More. Hunt Smarter."
* Header: Raven PNG (54px) + "HUGINN" wordmark + tagline
Z-Index Hierarchy
Always check this before adding any positioned element:
50    Map overlays (header, filter bar, FABs) 80    Camera popup 120   Buck dropdown 350   Sheet overlay / dim 400   Sheets (sightings, intel, log, detail) 500   Modals (edit, whoIs, add-cam, pin menu) 600   Action menus (··· dropdowns) 9999  Tab bar (always on top)
Key Constants (in index.html)
// ⚠️ These are Cooley Lake (Property #1) specific — will move to database when multi-property ships const CLAT = 45.0200, CLNG = -88.2756;  // Property center — do not hardcode in new features const CAMNAMES = ["Dan","Colin","Ridge","Behind Rons","By Eric","Andy Cam","Creek Crossing","Jake Cam","Other"]; const DTYPES = ["Buck - Mature (4.5+)","Buck - 3.5","Buck - 2.5","Buck - 1.5","Doe","Fawn","Unknown"]; const BEHS = ["Feeding","Traveling","Scraping/Rubbing","Bedding","Chasing","Breeding","Alert/Spooked","Other"];
Supabase Tables
* sightings — core data table. Key fields: id, date, time, camera_name, deer_type, behavior, buck_name, wind_dir, temp_f, wind_speed, wind_gust, humidity, precip, pressure, notes, travel_dir, image_url, moon_phase, source ('camera'|'observation'), obs_lat, obs_lng
* cameras — camera locations. Fields: id, name, lat, lng, facing
* property_markers — stands, scrapes, rubs, bedding (planned, not yet built)
* ai_feedback — AI correction logging (planned, not yet built)
Architecture Principles
1. Multi-property from day one — property_id on all tables (planned). One codebase, multiple properties.
2. Cooley Lake = Property #1 — personal dogfood instance for all feature development
3. AI calls always server-side — Vercel serverless only, never client-side API keys
4. source field on sightings — 'camera' vs 'observation' on every record
5. logged_by attribution — added when Auth goes live
6. data_source flag — 'seeded' for synthetic baseline sightings
Development Rules — ALWAYS FOLLOW THESE
* Read code before writing — never assume file state, always read first
* Syntax check before every delivery — run Node.js syntax check on extracted JS
* No alert() / confirm() / prompt() — use showToast() or custom modals
* Bottom-anchored elements use bottom: var(--tab-h) not bottom: 0
* Slide-up animations use translateY(calc(100% + var(--tab-h))) as hidden state
* Check z-index hierarchy before adding any positioned element
* Template literals only in <script> tags, never in HTML attributes
* Batch updates — compile full fix list → one build → one deploy
* Never put API keys in HTML or in chat
* After Vercel env var change → must redeploy
* Start session by agreeing on scope before touching code
What Claude Code Should Never Do
* Put the Anthropic API key anywhere in HTML or client-side JS
* Remove or bypass Supabase RLS policies (when implemented)
* Make database schema changes without flagging them clearly
* Hardcode property IDs, user IDs, or location-specific coordinates
* Use alert(), confirm(), or prompt()
* Deploy without running a syntax check first
Current Build Status — What's Working ✅
* FAB speed dial (Log Event, Add Cam, Add Stand, Scrape, Bedding)
* Log Event sheet with Camera Sighting / Field Observation mode toggle
* Field Observation mode — GPS blue dot + drop pin location picker, source field, obs_lat/obs_lng saved
* Buck tag suggestion dropdown (focus-safe, no rebuild on keystroke)
* Hunt AI tab with placeholder
* GPS blue dot (GeolocateControl)
* AI buck matching — fully working end to end (92% Marsh Buck!)
* /api/claude serverless proxy — key permanently server-side
* Filter bar — Date pill (year + month), Movement Lines pill, Map Style dropdown
* Buck search focus bug fixed in movement dropdown
* All Buck Lines / No Movement Lines working
* Add Camera as centered overlay modal
* View movement map + core area button working
* Post-save closes sheet and returns to map
* Weather auto-applies silently on date/time entry
* Moon phase emoji rendering correctly
* SAT+ map style pin visibility fixed
* Bulk ID flow for Unknown Bucks resolution
* All alert() replaced with showToast()
Known Bugs / In Progress 🐛
Bug Notes Camera pins render black on initial load Color depends on sighting data but addCamMarkers() fires before loadSightings() completes. Timing issue. Camera pin visual drift from movement lines Zoom-dependent offset. Last stable commit: be885d1. Fix: zero out marker pixel offset, anchor teardrop SVG tip naturally at coordinate. No zoom-level math. Two failed attempts already — approach carefully. INP performance warning on cam-marker Touch event handlers blocking UI for 400-450ms. Need passive listeners. Unknown Bucks — named bucks in unknown bucket buck_name staying null after AI suggestion not confirmed/saved. Needs trace + bulk resolve.
Session Handoff
See TASKS.md for current priorities. See PLANNING.md for roadmap and product decisions.
