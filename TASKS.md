Huginn Hunt Intelligence — Tasks & Session Log
How To Use This File
* Before a Claude Code session: Read CLAUDE.md + this file to orient
* During a session: Reference current tasks, stay in scope
* After a session: Update this file with what was completed and what's next
🔥 Current Priority (Next Session)
* [ ] Unknown Bucks root cause — trace AI hint → accept → save flow, find where buck_name is dropped and not persisted
* [ ] Bulk resolve any named bucks still sitting in Unknown bucket after the root cause fix
* [ ] Verify all Log Event features in production (see Needs Testing section)

🐛 Active Bugs
Bug Severity Notes Unknown Bucks — named bucks appearing in unknown bucket Medium Marsh Buck showing in Unknown Bucks even after AI match. buck_name likely staying null because confirmation never saved. Needs trace + bulk-resolve.

📋 Active Backlog
Tasks defined and ready to work on, in priority order:
Immediate
* [ ] Unknown Bucks root cause + bulk resolve

Near Term
* [ ] AI Training loop — Wrong Buck correction flow → ai_feedback table
* [ ] Buck Profiles view — activate Profiles button, full buck dossier
* [ ] Supabase Auth — email/password + magic link + invite code COOLEY2025
* [ ] Multi-property architecture — property_id on all tables (do before Auth)
* [ ] FAB marker system — Stand/Scrape/Rub/Bedding wired to GPS + property_markers table
* [ ] Unified Pin Management System — Phase 1: single "Add Pin" FAB flow with type selector (Camera / Stand / Scrape / Rub / Bedding / Observation), preset colors per type, distinct icon per type, edit/move/delete. Phase 2: pin filtering, pin history, Auth attribution, Hunt AI context feed. Ref: Spartan / Moultrie / OnX waypoint systems.
* [ ] Log Event UX Rework — Tap to Place Flow: Location-first logging flow replacing current form-first approach. Tap + FAB → tap map to place pin → sheet slides up with event type selector (Camera Sighting / Field Observation / Mark Feature) → form opens with location pre-filled. Camera location becomes searchable dropdown from cameras table with inline Add New Camera option. Full spec needed before building — do not attempt without complete prompt from planning session.

Medium Term
* [ ] Hunt Planner AI Chat tab
* [ ] Historical harvest log
* [ ] Season Planner / Vacation Day Optimizer
* [ ] Personal rut calendar
* [ ] Seed Your Property onboarding
* [ ] Weather enhancements (pressure trend, sunrise/sunset, dew point, hourly scroll)
* [ ] Map Layers system (public land, WI DNR/parcel, waterways, contour, slope)
* [ ] Field navigation tools (distance ring, heading cone, compass bar)
* [ ] GPS track logging
* [ ] Map annotation / draw layer
* [ ] PostGIS enablement (time it with FAB marker system build)
* [ ] Offline / PWA mode
* [ ] Multi-species — Elk GMU 231 Colorado September 2026

🧪 Needs Testing
Item Notes Log Event — Camera Sighting mode Confirm source='camera' saves to Supabase Log Event — Field Observation mode Confirm source='observation', obs_lat/obs_lng save correctly Field Observation — GPS blue dot Confirm permission request, coordinate lock, status display Field Observation — Drop pin Confirm sheet closes, map tap sets pin, sheet reopens with coordinates Field Observation — no location Confirm saves cleanly with nulls Buck tag suggestion dropdown Confirm focus stays in input while typing (focus bug fix) Movement lines search Confirm focus stays in input while typing (focus bug fix) Observation in Sightings feed Check card render with null camera_name Camera pin colors on initial load Confirm pins render with correct mature/non-mature colors before any interaction Camera pin alignment Confirm teardrop tip sits exactly on movement line endpoints at all zoom levels

✅ Completed
Feature/Fix Notes Date GitHub + Claude Code integration Connected to Vercel + GitHub Mar 2026 Supabase backend Auth + DB + Storage configured 2025 Satellite base map Mapbox GL JS v3.3.0 2025 Vercel deployment Connected to GitHub repo 2025 FAB speed dial Log, Add Cam, Add Stand, Scrape, Bedding 2025 AI buck matching End to end working — 92% Marsh Buck 2025 /api/claude serverless proxy Key permanently server-side 2025 Filter bar Date pill, Movement Lines pill, Map Style dropdown 2025 All Buck Lines / No Movement Lines fix 'none' value handling 2025 Add Camera modal Rebuilt as centered overlay 2025 Weather auto-apply Silent on date/time entry 2025 Moon phase rendering Emoji rendering correctly 2025 All alert() replaced Using showToast() throughout 2025 SAT+ pin visibility fix Pins now visible on satellite-v9 style Mar 2026 Bulk Unknown Bucks flow Bulk ID resolution added Mar 2026 Log Event rebuild Camera Sighting + Field Observation modes, source field, obs_lat/obs_lng Mar 2026 Buck tag suggestion dropdown Focus-safe dropdown replaces datalist, fixes focus-loss bug Mar 2026 Movement lines search focus fix Rebuilt to preserve input element, only updates list Mar 2026 Camera pins black on initial load fix Added refreshMapPins() at end of loadSightings() so colors are always correct Mar 2026 Camera pin alignment fix Moved .cam-lbl above .cam-pin, extended SVG tip to y=44, zeroed offset to [0,0] — no zoom math Mar 2026 INP touch handler performance fix touchend/touchmove now passive; showPin() opens popup before Supabase fetch Mar 2026 New camera pins drop as gold (not black) Fixed fallback fill color in addCamMarkers() from #252525 to #8C7355 Mar 20 2026 Field observation pins appear on map after save Replaced undefined updatePins() with refreshMapPins() in saveSighting(), saveEdit(), deleteSighting() Mar 20 2026 Faded camera pin opacity fixed Raised .cam-marker.faded opacity to 0.9 — de-emphasized but clearly visible across all 4 map styles Mar 20 2026 Buck search focus bug confirmed working Verified in production — focus stays in input while typing Mar 20 2026 Log Event mode toggle confirmed working Camera Sighting and Field Observation modes save correctly with correct source field Mar 20 2026 Heatmap + dot map broken on global filter states Fixed isBuckName/isBuckFilter guard in showHeatmap() and showDotMap() — both now work correctly on 'all', 'all-bucks', 'none', and specific buck filters Mar 20 2026

Session Log
Date What We Did What's Next Mar 2026 Set up GitHub + Claude Code integration, created context files Begin feature work Mar 2026 SAT+ pin visibility fix, Bulk Unknown Bucks flow Pin drift fix, Unknown Bucks root cause Mar 2026 Log Event rebuild (camera + observation modes), buck tag dropdown fix, movement search fix. Attempted pin drift fix — made worse, reverted to be885d1 Pin drift fix (careful approach), test Log Event features, Unknown Bucks root cause Mar 2026 Fixed all three camera pin bugs: black-on-load timing (refreshMapPins in loadSightings), alignment drift (label above pin, SVG tip at y=44, offset:[0,0]), INP touch performance (passive listeners, popup shows before Supabase fetch). Commit: 97b3bbf Unknown Bucks root cause trace + fix, verify Log Event features in production Mar 20 2026 Fixed new cam pins dropping black (fallback gold), field obs pins not appearing after save (updatePins→refreshMapPins), faded pin opacity (0.3→0.9 consistent across all styles). Added Log Event UX Rework and Unified Pin Management System to roadmap. Unknown Bucks root cause trace + fix; verify Log Event in production; full planning session for Log Event UX Rework before building
