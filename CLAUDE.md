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
/ (root)   /api     claude.js         ← Vercel serverless proxy for Anthropic API   /public     index.html        ← Entire application (HTML + CSS + JS)     HuginnLogo.svg     HuginnFavicon.svg     HuginnRaven.png     map.jpg   CLAUDE.md           ← This file   PLANNING.md         ← Roadmap and product decisions   TASKS.md            ← Session tasks and backlog   DECISIONS.md        ← Architectural and product decision log   ARCHITECTURE.md     ← Architectural & product specification — read every session
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
* property_markers — stands, scrapes, rubs, bedding areas. Fields: id, type ('Stand'|'Scrape'|'Rub'|'Bedding'), name, notes, lat, lng, photo_url, created_at. NOTE: column is "type" not "feature_type" — no date or active columns in deployed schema. lat/lng are float8 for full decimal precision (PostGIS-ready).
* ai_feedback — AI correction logging (planned, not yet built)
Log Event UX Architecture — Tap-to-Place Flow (current as of Mar 21 2026)
The + FAB triggers a location-first logging flow. No crosshair cursor or map-click handler — replaced entirely by a draggable Mapbox marker.

Step-by-step:
1. User taps + FAB → enterTapToPlaceMode() fires
2. mapboxgl.Marker({ draggable: true }) created with sulfur (#E5B53B) teardrop SVG + pulsing ttpGlow animation, placed at mapInstance.getCenter()
3. Location Set card appears at BOTTOM of screen (transparent overlay so pin at map center is visible above it). Live coords update via marker.on('drag') and marker.on('dragend').
4. User drags pin to desired location, taps Confirm → confirmTapToPlace() stops pulse, locks pin
5. Event Type modal appears (centered) — three cards: Camera Sighting / Field Observation / Mark Feature
6. User selects type → focused form modal opens with location pre-filled:
   - Camera Sighting (#ttpCamModal) → submitCamSighting() → inserts to sightings with source='camera'
   - Field Observation (#ttpObsModal) → submitObsSighting() → inserts to sightings with source='observation', obs_lat/obs_lng
   - Mark Feature (#ttpFeatureModal) → submitFeatureMarker() → inserts to property_markers
7. On successful save: preview marker removed, tapToPlaceLngLat cleared, form closed, map pins refreshed

Key state variables: tapToPlaceActive (bool), tapToPlaceLngLat ({lat,lng}), tapToPlacePreviewMarker (Marker instance), ttpAfterConfirm (optional callback to bypass event type modal)
cancelTapToPlace() removes the marker and clears all state. TTP_OVERLAY_SEL and the pointer-events disable/restore pattern were removed entirely — the draggable marker approach makes them unnecessary.

Markers Filter Pill (Map Filter Bar)
Three toggle pills added to filter bar for property marker visibility:
* Stands — always visible by default (scrapeMarkersVisible / beddingMarkersVisible flags not checked for Stand type)
* Scrape/Rub — hidden by default, toggled by scrapeMarkersVisible flag
* Bedding — hidden by default, toggled by beddingMarkersVisible flag
renderPropertyMarkers() and addPropertyMarker() both respect these flags. Toggling a pill calls renderPropertyMarkers() to re-render.

Feature Marker Colors & Labels (FEAT_COLORS / FEAT_LABELS constants)
Stand: #8C7355 bronze, label "S" | Scrape: #E5B53B sulfur, label "Sc" | Rub: #c07b4c copper, label "R" | Bedding: #4a7a4e green, label "Bd"
Currently rendered as filled circles. Planned upgrade: Feather-style SVG teardrop icons matching camera pin architecture.

Orphaned Code — Pending Cleanup
#addCamModal — the original Add Camera modal (pre-Log Event rework) remains in the HTML. It is no longer reachable via any FAB or UI trigger. The new Add Camera flow goes through #ttpAddCamModal (Step 4 of the tap-to-place flow). Do not add features to #addCamModal. Schedule cleanup: remove modal HTML, associated CSS, and toggleAddCamMode() / addCamBtn references if confirmed unused.
Architecture Principles
1. Multi-property from day one — property_id on all tables (planned). One codebase, multiple properties.
2. Cooley Lake = Property #1 — personal dogfood instance for all feature development
3. AI calls always server-side — Vercel serverless only, never client-side API keys
4. source field on sightings — 'camera' vs 'observation' on every record
5. logged_by attribution — added when Auth goes live
6. data_source flag — 'seeded' for synthetic baseline sightings
Development Rules — ALWAYS FOLLOW THESE
* Read CLAUDE.md, PLANNING.md, TASKS.md, and ARCHITECTURE.md at the start of every session before touching any code
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

## Known Bug Pattern Registry — Check Every Change Against These

Before committing any change, scan for these exact patterns. Each one is a bug already found in production.

| ❌ Wrong | ✅ Correct | Why |
|---|---|---|
| `updatePins()` | `refreshMapPins()` | Function renamed — wrong name silently fails |
| `'claude-sonnet-4-5-20250514'` | `'claude-sonnet-4-5'` | Invalid model ID breaks all AI responses |
| `.insert({})` without `property_id` | Always include `property_id: PROPERTY_ID` | Missing scoping leaks data across properties |
| `feature_type` column | `type` column | Actual column name in property_markers |
| `setDraggable(true)` on existing Mapbox marker | Create new `mapboxgl.Marker({ draggable: true })` | Causes marker jump bug |
| Upsert without conflict target | `.upsert(data, { onConflict: 'column_name' })` | Silent overwrite failures |
| `bottom: 0` on bottom-anchored elements | `bottom: var(--tab-h)` | Tab bar overlaps content |
| `translateY(100%)` as sheet hidden state | `translateY(calc(100% + var(--tab-h)))` | Sheet peeks above tab bar |
| Marker `offset: [0, -18]` | `anchor: 'bottom', offset: [0, 0]` | Pin drift from movement line endpoints |
| `alert()` / `confirm()` / `prompt()` | `showToast()` or custom modal | Prohibited — breaks mobile UX |
| Hardcoding `403a9c61-...` outside PROPERTY_ID | Use `PROPERTY_ID` constant everywhere | Defeats multi-property architecture |
| Any Anthropic key in HTML or client JS | Key in Vercel env var `ANTHROPIC_KEY` only | Security violation |

## Post-Change Verification Protocol — Run Before Every Commit

### Step 1 — Syntax Check
```bash
node -e "
  const fs = require('fs');
  const html = fs.readFileSync('public/index.html', 'utf8');
  const regex = /<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/gi;
  let match, blocks = [];
  while ((match = regex.exec(html)) !== null) blocks.push(match[1]);
  fs.writeFileSync('/tmp/check.js', blocks.join('\n'));
"
node --check /tmp/check.js && echo "SYNTAX OK" || echo "SYNTAX ERROR — DO NOT COMMIT"
```

### Step 2 — Anti-Pattern Scan
```bash
grep -n "alert("          public/index.html
grep -n "confirm("        public/index.html
grep -n "prompt("         public/index.html
grep -n "updatePins()"    public/index.html
grep -n "feature_type"    public/index.html
grep -n "sk-ant-"         public/index.html
grep -n "claude-sonnet-4-5-20250514" public/index.html api/claude.js
```

### Step 3 — Scope Check on New Supabase Inserts
- [ ] `property_id: PROPERTY_ID` present on every new insert
- [ ] Conflict target specified on every new upsert
- [ ] `.is('deleted_at', null)` on every SELECT from cameras or property_markers

### Step 4 — Z-Index Check
- [ ] New z-index values are in hierarchy: 50 / 80 / 120 / 350 / 400 / 450 / 475 / 500 / 600 / 9999

### Step 5 — Smoke Test
Open SMOKE_TEST.md and run every section relevant to what changed.

### Step 6 — Merge Hygiene
- [ ] Work on feature branch not main
- [ ] Branch follows claude/description convention
- [ ] Descriptive commit message
- [ ] Merge to main only after smoke test passes
- [ ] No other unmerged branches remain after merge

## Branch & Merge Rules — ALWAYS FOLLOW
* Every session ends with merging the feature branch to main via pull request — no exceptions
* Never leave working code on an unmerged feature branch
* At the start of every session: run `git status` and `git log` to confirm the previous session's branch was merged to main before starting new work
* If unmerged branches are found at session start — merge them before writing any new code
* Vercel deploys from main only — code on feature branches is not reliably deployed
What Claude Code Should Never Do
* Put the Anthropic API key anywhere in HTML or client-side JS
* Remove or bypass Supabase RLS policies (when implemented)
* Make database schema changes without flagging them clearly
* Hardcode property IDs, user IDs, or location-specific coordinates
* Use alert(), confirm(), or prompt()
* Deploy without running a syntax check first
Current Build Status — What's Working ✅
* + FAB tap-to-place draggable pin flow — sulfur teardrop at map center, drag to position, Location Set card at bottom, live coord updates
* Event Type modal — Camera Sighting / Field Observation / Mark Feature selector
* Camera Sighting form — full sighting log with camera dropdown, deer type, behavior, buck tag, weather auto-fill, photo upload
* Field Observation form — GPS or pin-drop location, source='observation', obs_lat/obs_lng saved
* Mark Feature form — Stand / Scrape / Rub / Bedding, saves to property_markers table (type, name, notes, lat, lng, photo_url)
* Property markers render on map as colored circle pins; visibility controlled by Markers filter pills
* Markers filter pills — Stands always on; Scrape/Rub and Bedding toggle independently
* Buck tag suggestion dropdown (focus-safe, no rebuild on keystroke)
* Hunt AI tab — full chat with Hunt Assistant and Property Intel modes, conversations drawer, conversation history persisted in Supabase
* GPS blue dot (GeolocateControl)
* AI buck matching — fully working end to end (92% Marsh Buck!)
* /api/claude serverless proxy — key permanently server-side
* Filter bar — Date pill, Movement Lines pill, Map Style dropdown, Markers pills
* All Buck Lines / No Movement Lines working; movement lines hidden on initial load
* Add Camera via tap-to-place flow (#ttpAddCamModal)
* View movement map + core area button working
* Post-save closes sheet and returns to map
* Weather auto-applies silently on date/time entry
* Moon phase emoji rendering correctly
* SAT+ map style pin visibility fixed
* Bulk ID flow for Unknown Bucks resolution
* All alert() replaced with showToast()
* Camera pins always render correct color on initial load (fixed Mar 2026)
* Camera pin tips align exactly with movement line endpoints (fixed Mar 2026)
* Camera popup opens instantly on tap — no INP block (fixed Mar 2026)
* New camera pins drop as gold, not black (fixed Mar 20 2026)
* Field observation pins appear on map after save (fixed Mar 20 2026)
* Faded camera pins consistent at 0.9 opacity across all 4 map styles (fixed Mar 20 2026)
* Heatmap and dot map now work on All Lines / All Deer / No Lines filter states (fixed Mar 20 2026)
* Mobile safe area insets fixed across all sheets and FABs (fixed Mar 23 2026)
* Touch targets raised to 44px standard across all interactive elements (fixed Mar 23 2026)
* Sightings header, filter bar, and event type modal reflowed for mobile (fixed Mar 23 2026)
* Sightings feed card links open detail sheet correctly (fixed Mar 24 2026)
* Property Intel append model — timestamped entries preserve previous notes (fixed Mar 24 2026)
* Supabase RLS policies enabled on all tables (Mar 24 2026)
* property_id scoping on all tables and queries (Mar 24 2026)
* /api/claude rate limiting — IP-based abuse prevention (Mar 24 2026)
* Client-side image compression before upload (Mar 24 2026)
* Soft deletes on cameras and property_markers — archive instead of destroy, sightings preserved (Mar 24 2026)
Known Bugs / In Progress 🐛
Bug | Notes
Field observation pins on map | Pins save with obs_lat/obs_lng and appear after save — needs production verification that pins persist after page reload.
Pin color customization | Not yet implemented. Planned: color swatches on feature marker tap info card, saved to property_markers.color (needs schema migration).

Camera Pin Architecture Notes (for future sessions)
* anchor: 'bottom', offset: [0, 0] — do NOT add pixel offset compensation
* .cam-lbl sits ABOVE .cam-pin in the DOM so element bottom = teardrop tip = coordinate
* SVG path tip is at y=44 (bottom of 36×44 viewBox) — path: M18 2C10.268 2 4 8.268 4 16c0 10 14 28 14 28s14-18 14-28C32 8.268 25.732 2 18 2z
* Do NOT attempt zoom-level math or coordinate compensation — two failed attempts (fada88e, cab1934)
* Same teardrop SVG used for tap-to-place preview pin — color #E5B53B (sulfur) while in placement mode
## index.html Split — Rules
* Split is in progress — do not move code outside of designated split sessions
* Current phase: Phase 0 complete, Phase 1 pending
* Phase 1 target: CSS extraction to /public/css/
* One file per session — never split two files in the same session
* Full smoke test after every file move before merging
* If anything breaks — revert immediately, do not fix forward
* Safety checkpoint tag: pre-split-checkpoint
Session Handoff
See TASKS.md for current priorities. See PLANNING.md for roadmap and product decisions. See ARCHITECTURE.md for full architectural specification and pre-beta checklist.
