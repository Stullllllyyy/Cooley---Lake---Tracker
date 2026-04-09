Huginn Hunt Intelligence — Tasks & Session Log
How To Use This File
* Before a Claude Code session: Read CLAUDE.md + this file to orient
* During a session: Reference current tasks, stay in scope
* After a session: Update this file with what was completed and what's next

🔥 Current Priority (Next Session)
* index.html split Phase 1 — CSS extraction to /public/css/
* index.html pre-split line count: 10939 lines

📐 index.html Split Progress
* Phase 0: Setup complete (Apr 2026) — directories, placeholders, Vercel test, safety tag
* Phase 1: Pending — CSS extraction
* Safety checkpoint: git tag pre-split-checkpoint

🐛 Active Bugs
Bug | Severity | Notes
Field observation pins on map | Low | Pins save with obs_lat/obs_lng and appear after save — needs production verification that pins persist correctly after full page reload.

📋 Active Backlog
Tasks defined and ready to work on, in priority order:

Immediate
* [ ] Update Scrape/Rub/Bedding/Stand map pins — replace filled-circle style with Feather-style SVG teardrop icons matching camera pin shape. Brand colors: Stand #8C7355, Scrape #E5B53B, Rub #c07b4c, Bedding #4a7a4e. anchor:bottom, same architecture as camera pins.
* [ ] GitHub CI/CD — create .github/workflows/ci.yml (content provided separately — paste ci.yml)
* [ ] Set up branch protection rule on main — require CI to pass before merge
* [ ] Test CI gate — test branch + alert() → confirm red ❌ → revert → confirm green ✅

Near Term
* [ ] Multi-buck suggestion UI — top 2-3 AI candidates with confidence scores
* [ ] Knowledge Graph Phase 1 — knowledge_nodes, knowledge_edges, memory_cards schema
* [ ] Trail Cam Intelligence Bundle — bulk upload, EXIF extraction, AI matching, weather backfill
* [ ] Map Layers — PAD-US public land, WI DNR parcels, trails, waterways
* [ ] Platform model opt-in — anonymous training data toggle, anonymized crop storage
* [ ] Roboflow labeling — label Cooley Lake library as seed dataset, 50 diverse photos per buck
* [ ] Tighten bucks table RLS policies when Auth ships — currently open anon bridge same as other tables.
* [ ] Replace confirm() calls with custom modals — 3 remaining: camera archive from popup, camera archive from pin menu, feature marker archive confirmation. CLAUDE.md prohibits confirm(). Flagged during soft delete implementation (Mar 24 2026).
* [ ] Archived Pins UI — Settings section showing soft-deleted cameras and property_markers with restore option. Prerequisite: Settings tab must exist.
* [ ] Trail cam photo AI 'Accept/Train' workflow — after AI identifies a buck in a trail cam photo, provide Accept (confirm ID) and Train (correct ID) buttons to feed ai_feedback table for learning loop.
* [ ] Wind/temp auto-fill on desktop — weather auto-apply currently optimized for mobile; verify and fix for desktop browser usage.
* [ ] Buck identity registry — centralized named buck registry with profile photo, antler description, age class, first/last seen dates. Foundation for Buck Profiles view.
* [ ] Pin color editor — when user taps a feature marker pin, the info card should include preset color swatches (and optionally a color picker) so the user can customize pin color. Saved to property_markers.color column (needs migration).
* [ ] Stand info card — tap stand pin on map to expand an info card showing name, notes, date placed, with Edit / Move / Delete options
* [ ] Old addCamModal cleanup — the original #addCamModal (pre-Log Event rework) is orphaned in the HTML. Remove the modal HTML, its CSS, and any remaining JS that references it. Confirm addCamBtn and toggleAddCamMode() are also cleaned up or intentionally kept.
* [ ] Orphaned code cleanup — renderProfiles(), openBuckProfile(), closeBuckProfile(), #bpOverlay HTML, and associated .bp-* CSS are orphaned after Profiles button removal (Apr 2026 Buck Intelligence Phase 1). Scheduled for cleanup in index.html split phase.
* [ ] Responsive design audit — test on multiple mobile screen sizes and on desktop/tablet. Identify layout breaks, oversized elements, and tap-target issues.
* [ ] AI Training loop — Wrong Buck correction flow → ai_feedback table
* [x] Buck Profiles view — replaced by Buck Intelligence section in Intel tab + full dossier sheet (Apr 2026)
* [ ] Supabase Auth — email/password + magic link + invite code COOLEY2025
* [ ] Multi-property architecture — property_id on all tables (do before Auth)
* [ ] Stand Intel AI card — nearby cameras (PostGIS radius), movement patterns, peak times, best wind, AI "Hunt this stand when..." recommendation. Prerequisite: property_markers live with precise lat/lng (done) + PostGIS enabled.

Map Layers — Remaining
* [ ] Wilderness trails layer — OSM trail data via a hosted tileset. Mapbox Streets v8 does not include wilderness/forest trails. Requires processing OSM data or using a free public OSM vector tile endpoint. Evaluate alongside PAD-US build.
* [ ] Public land boundaries (PAD-US) — Free USGS dataset. Shows public vs private land boundaries. High value for hunters. Requires hosting tileset or finding a free public endpoint. Most impactful remaining map layer.
* [ ] Waterways layer — Rivers, streams, creeks overlaid on satellite map. Available from Mapbox Streets composite source. Low complexity, free.
* [ ] 3D buildings — Available free from Mapbox. Low hunting value but easy to add.
* [ ] Lidar terrain layer — High resolution elevation data. Paid data source. Defer until app has paying users.
* [ ] Historical satellite imagery — Google Earth Engine or similar. Paid API. Defer until app has paying users.

Medium Term
* [x] Hunt Planner AI Chat tab — DONE Mar 24 2026
* [ ] Historical harvest log
* [ ] Season Planner / Vacation Day Optimizer
* [ ] Personal rut calendar
* [ ] Seed Your Property onboarding
* [ ] Weather enhancements (pressure trend, sunrise/sunset, dew point, hourly scroll)
* [ ] Map Layers system (public land, WI DNR/parcel, waterways, contour, slope)
* [ ] Field navigation tools (distance ring, heading cone, compass bar)
* [ ] GPS track logging
* [ ] Map annotation / draw layer
* [ ] PostGIS enablement (time it with Stand Intel build)
* [ ] Offline / PWA mode
* [ ] Multi-species — Elk GMU 231 Colorado September 2026

JS Phase 2 — index.html split (in order)
* [ ] config.js — constants, PROPERTY_ID, color maps
* [ ] utils.js — showToast, compressImage, formatDate, moonPhase
* [ ] auth.js — login, signup, invite, onboarding, signOut
* [ ] weather.js — weather fetch, card, pill, GPS/map toggle
* [ ] hunt-ai.js — chat, conversations, property intel
* [ ] intel.js — wind rose, charts, insights, dossier
* [ ] sightings.js — log event, feeds, detail sheet
* [ ] cameras.js — camera management, move flow
* [ ] ui.js — hamburger, filter FAB, map display panel
* [ ] map.js — Mapbox init, pins, layers (last — most complex)

🧪 Needs Testing
Item | Notes
Log Event — Camera Sighting mode | Confirm source='camera' saves to Supabase
Log Event — Field Observation mode | Confirm source='observation', obs_lat/obs_lng save correctly
Field Observation — GPS blue dot | Confirm permission request, coordinate lock, status display
Mark Feature — full save flow | Column fix shipped Mar 21 — confirm saves and pin renders on map
Mark Feature — photo upload | Confirm photo uploads to trail-cam-photos/markers/ and photo_url updates
Tap-to-place draggable pin | Confirm sulfur teardrop appears at map center, drags freely, Location Set card at bottom
Field observation pins on map | Confirm pins persist after page reload (obs_lat/obs_lng saved correctly)
Camera pin colors on initial load | Confirm pins render correct mature/non-mature colors before any interaction

✅ Completed
Feature/Fix | Notes | Date
Feather-style SVG teardrop icons for feature pins | Replaced filled circles with teardrop SVG icons matching camera pin architecture. Brand colors: Stand #8C7355, Scrape #E5B53B, Rub #c07b4c, Bedding #4a7a4e | Mar 23 2026
Unknown Bucks root cause + Marsh Buck bulk resolve | Fixed buck_name drop in AI hint → accept → save flow; bulk resolved Marsh Buck null records | Mar 23 2026
GitHub + Claude Code integration | Connected to Vercel + GitHub | Mar 2026
Supabase backend | Auth + DB + Storage configured | 2025
Satellite base map | Mapbox GL JS v3.3.0 | 2025
Vercel deployment | Connected to GitHub repo | 2025
FAB speed dial | Original Log/Cam/Stand/Scrape/Bedding speed dial | 2025
AI buck matching | End to end working — 92% Marsh Buck | 2025
/api/claude serverless proxy | Key permanently server-side | 2025
Filter bar | Date pill, Movement Lines pill, Map Style dropdown | 2025
All Buck Lines / No Movement Lines fix | 'none' value handling | 2025
Add Camera modal | Rebuilt as centered overlay | 2025
Weather auto-apply | Silent on date/time entry | 2025
Moon phase rendering | Emoji rendering correctly | 2025
All alert() replaced | Using showToast() throughout | 2025
SAT+ pin visibility fix | Pins now visible on satellite-v9 style | Mar 2026
Bulk Unknown Bucks flow | Bulk ID resolution added | Mar 2026
Log Event rebuild | Camera Sighting + Field Observation modes, source field, obs_lat/obs_lng | Mar 2026
Buck tag suggestion dropdown | Focus-safe dropdown replaces datalist, fixes focus-loss bug | Mar 2026
Movement lines search focus fix | Rebuilt to preserve input element, only updates list | Mar 2026
Camera pins black on initial load fix | Added refreshMapPins() at end of loadSightings() | Mar 2026
Camera pin alignment fix | .cam-lbl above .cam-pin, SVG tip at y=44, offset:[0,0] — no zoom math | Mar 2026
INP touch handler performance fix | touchend/touchmove now passive; showPin() opens popup before Supabase fetch | Mar 2026
New camera pins drop as gold (not black) | Fixed fallback fill color in addCamMarkers() | Mar 20 2026
Field observation pins appear on map after save | Replaced undefined updatePins() with refreshMapPins() | Mar 20 2026
Faded camera pin opacity fixed | Raised .cam-marker.faded opacity to 0.9 across all 4 map styles | Mar 20 2026
Heatmap + dot map broken on global filter states | Fixed isBuckName/isBuckFilter guard in showHeatmap() and showDotMap() | Mar 20 2026
Log Event UX Rework — full 7-step flow | + FAB → tap-to-place → event type modal → three focused forms (Camera Sighting, Field Observation, Mark Feature). All wired end to end. | Mar 21 2026
Tap-to-place draggable pin | Replaced crosshair+click approach with mapboxgl.Marker draggable:true. Sulfur teardrop at map center, Location Set card at bottom of screen, live coord update on drag + dragend. | Mar 21 2026
Placement pin color (sulfur) | Changed preview pin from #8C7355 bronze to #E5B53B sulfur so it stands out from camera pins while in placement mode | Mar 21 2026
Markers filter pill | Added Scrape/Rub and Bedding visibility toggle pills to filter bar. Default: Stands always visible, Scrape/Rub and Bedding hidden until toggled on. | Mar 21 2026
property_markers schema fix | Fixed column mismatch: feature_type→type, removed non-existent date+active columns from insert. Fixed loadPropertyMarkers() and addPropertyMarker() references. Error now shows via showToast(). | Mar 21 2026
Field obs pin shape fix | Field observation pins use distinct shape (circle with crosshair) instead of camera teardrop | Mar 21 2026
Movement lines hidden on load fix | Movement lines no longer visible on initial map load — respect default filter state | Mar 21 2026
TTP_OVERLAY_SEL dead code removed | Removed pointer-events disable/restore approach entirely — draggable marker replaces it | Mar 21 2026
Hunt AI Chat — full rebuild | Chat UI with message bubbles, typing indicator, auto-grow input, Enter-to-send. buildChatSystemPrompt() pulls sightings (capped 150), cameras, markers, named bucks, property context. Messages persisted to chat_messages table with conversation_id. Conversations drawer with first-user-message previews. | Mar 24 2026
Hunt AI response parser fix | Root cause: model ID 'claude-sonnet-4-5-20250514' invalid with proxy's anthropic-version 2023-06-01. Changed to 'claude-sonnet-4-5' matching all 5 working callers. | Mar 24 2026
Key Insights fix | Same root cause as chat — wrong model ID. Changed to 'claude-sonnet-4-5'. Cleaned up verbose debug logging. | Mar 24 2026
Hunt AI chat sheet dvh fix | Added #sheet-chat override using dvh (dynamic viewport height) units so chat sheet top isn't clipped by mobile browser URL bar. @supports fallback to vh. | Mar 24 2026
Property Intel toggle and cards | Two-tab pill row (Hunt Assistant / Property Intel) below chat header. Property Intel shows 7 category cards with SVG icons, editable via centered modal. Saves to property_context table (category/content columns). Wizard flow retained as secondary path. | Mar 24 2026
Property Intel emoji → SVG icons | Replaced 7 HTML entity emoji icons with inline Feather-style SVGs matching app icon architecture. | Mar 24 2026
Property Intel editor — centered modal | Changed from bottom-sheet (clipped on mobile) to centered modal overlay with scale+opacity animation and full border-radius. | Mar 24 2026
Sightings feed fix | Sighting cards in feed link to detail sheet correctly | Mar 24 2026
Property Intel append model | Switched from overwrite to append with timestamped entries so hunters can add notes over time without losing previous observations | Mar 24 2026
Supabase RLS policies | Row Level Security enabled on all tables (sightings, cameras, property_markers, chat_messages, property_context) | Mar 24 2026
property_id migration | Added property_id column to all tables; all queries scoped by property_id | Mar 24 2026
/api/claude rate limiting | IP-based rate limiting on Vercel serverless proxy to prevent abuse | Mar 24 2026
Image compression | Client-side image resize before Supabase Storage upload to reduce bandwidth and storage | Mar 24 2026
Soft deletes on cameras and property_markers | DELETE→UPDATE deleted_at; all SELECTs filter .is('deleted_at', null); archive messaging replaces delete messaging; sightings preserved | Mar 24 2026

Session Log
Date | What We Did | What's Next
Mar 2026 | Set up GitHub + Claude Code integration, created context files | Begin feature work
Mar 2026 | SAT+ pin visibility fix, Bulk Unknown Bucks flow | Pin drift fix, Unknown Bucks root cause
Mar 2026 | Log Event rebuild (camera + observation modes), buck tag dropdown fix, movement search fix. Attempted pin drift fix — made worse, reverted to be885d1 | Pin drift fix (careful approach), test Log Event features, Unknown Bucks root cause
Mar 2026 | Fixed all three camera pin bugs: black-on-load timing (refreshMapPins in loadSightings), alignment drift (label above pin, SVG tip at y=44, offset:[0,0]), INP touch performance (passive listeners, popup shows before Supabase fetch). Commit: 97b3bbf | Unknown Bucks root cause trace + fix, verify Log Event features in production
Mar 20 2026 | Fixed new cam pins dropping black (fallback gold), field obs pins not appearing after save (updatePins→refreshMapPins), faded pin opacity (0.3→0.9 consistent across all styles). Added Log Event UX Rework and Unified Pin Management System to roadmap. | Unknown Bucks root cause trace + fix; verify Log Event in production; full planning session for Log Event UX Rework before building
Mar 21 2026 | Completed full Log Event UX Rework (7 steps): + FAB → draggable sulfur teardrop pin at map center → Location Set card (bottom-anchored so pin visible) → event type modal → Camera Sighting form / Field Observation form / Mark Feature form, all wired to Supabase. Fixed tap-to-place crosshair→draggable marker migration (pin color, card position, drag+dragend events, dead code removal). Fixed property_markers insert (feature_type→type column, removed non-existent date+active). Added Markers filter pill. | Feather-style SVG teardrop icons for feature pins; Unknown Bucks root cause + Marsh Buck bulk resolve
Mar 24 2026 | Hunt AI Chat full build: chat UI, system prompt with sighting data, conversations with drawer, Property Intel toggle with 7 editable category cards, iOS keyboard handling. Fixed response parser and Key Insights (root cause: wrong model ID 'claude-sonnet-4-5-20250514' → 'claude-sonnet-4-5'). Fixed chat sheet dvh for mobile. Fixed emoji icons → SVGs. Fixed editor from bottom-sheet to centered modal. | Property Intel append model with timestamps; verify chat and insights working in production
Mar 24 2026 | Pre-beta blockers completed: sightings feed fix (card links open detail sheet), Property Intel append model with timestamped entries, Supabase RLS policies on all tables, property_id migration (all tables + queries scoped), /api/claude rate limiting (IP-based), image compression (client-side resize before upload), soft deletes on cameras and property_markers (deleted_at column, UPDATE instead of DELETE, SELECT filters). | Production verification; deploy and test end to end
Apr 8 2026 | Phase 1 Buck Intelligence: Added Buck Intelligence section to Intel tab (horizontal scroll cards between Overview and Analytics). Full buck dossier sheet (hero photo, stats, antler desc, hunter's notes, field obs, wind rose, activity chart, behavior, seasonal, top cameras, photo gallery with lightbox, recent sightings, "View All Sightings" cross-tab link). Removed Profiles button from Sightings tab. Marked openBuckProfile/renderProfiles as orphaned. Shared functions: buildWindRoseSVG, build24HrTimeline reused without duplication. Desktop: 3-column grid cards, 640px centered dossier, 2-column layout. | Phase 2 Sightings tab rebuild; orphaned code cleanup in index.html split phase
