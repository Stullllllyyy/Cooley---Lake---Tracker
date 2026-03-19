Huginn Hunt Intelligence — Tasks & Session Log
How To Use This File
* Before a Claude Code session: Read CLAUDE.md + this file to orient
* During a session: Reference current tasks, stay in scope
* After a session: Update this file with what was completed and what's next
🔥 Current Priority (This Session)
Replace this section at the start of each session with what you're working on.
* [ ] Camera pin visual drift fix — pins offset from movement line endpoints
* [ ] Verify fix works at multiple zoom levels before committing
* [ ] Unknown Bucks root cause — trace AI hint → accept → save flow
🐛 Active Bugs
Bug Severity Notes Camera pin visual drift from movement lines Medium Last stable commit: be885d1. Failed fix attempts at fada88e and cab1934. Zero out marker pixel offset, anchor teardrop tip naturally at coordinate. No zoom-level math. Unknown Bucks — named bucks appearing in unknown bucket Medium Marsh Buck showing in Unknown Bucks even after AI match. buck_name likely staying null because confirmation never saved. Needs trace + bulk-resolve.
📋 Active Backlog
Tasks defined and ready to work on, in priority order:
Immediate
* [ ] Camera pin drift fix (see bugs above)
* [ ] Unknown Bucks root cause + bulk resolve
Near Term
* [ ] AI Training loop — Wrong Buck correction flow → ai_feedback table
* [ ] Buck Profiles view — activate Profiles button, full buck dossier
* [ ] Supabase Auth — email/password + magic link + invite code COOLEY2025
* [ ] Multi-property architecture — property_id on all tables (do before Auth)
* [ ] FAB marker system — Stand/Scrape/Rub/Bedding wired to GPS + property_markers table
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
Item Notes Log Event — Camera Sighting mode Confirm source='camera' saves to Supabase Log Event — Field Observation mode Confirm source='observation', obs_lat/obs_lng save correctly Field Observation — GPS blue dot Confirm permission request, coordinate lock, status display Field Observation — Drop pin Confirm sheet closes, map tap sets pin, sheet reopens with coordinates Field Observation — no location Confirm saves cleanly with nulls Buck tag suggestion dropdown Confirm focus stays in input while typing (focus bug fix) Movement lines search Confirm focus stays in input while typing (focus bug fix) Observation in Sightings feed Check card render with null camera_name
✅ Completed
Feature/Fix Notes Date GitHub + Claude Code integration Connected to Vercel + GitHub Mar 2026 Supabase backend Auth + DB + Storage configured 2025 Satellite base map Mapbox GL JS v3.3.0 2025 Vercel deployment Connected to GitHub repo 2025 FAB speed dial Log, Add Cam, Add Stand, Scrape, Bedding 2025 AI buck matching End to end working — 92% Marsh Buck 2025 /api/claude serverless proxy Key permanently server-side 2025 Filter bar Date pill, Movement Lines pill, Map Style dropdown 2025 All Buck Lines / No Movement Lines fix 'none' value handling 2025 Add Camera modal Rebuilt as centered overlay 2025 Weather auto-apply Silent on date/time entry 2025 Moon phase rendering Emoji rendering correctly 2025 All alert() replaced Using showToast() throughout 2025 SAT+ pin visibility fix Pins now visible on satellite-v9 style Mar 2026 Bulk Unknown Bucks flow Bulk ID resolution added Mar 2026 Log Event rebuild Camera Sighting + Field Observation modes, source field, obs_lat/obs_lng Mar 2026 Buck tag suggestion dropdown Focus-safe dropdown replaces datalist, fixes focus-loss bug Mar 2026 Movement lines search focus fix Rebuilt to preserve input element, only updates list Mar 2026
Session Log
Date What We Did What's Next Mar 2026 Set up GitHub + Claude Code integration, created context files Begin feature work Mar 2026 SAT+ pin visibility fix, Bulk Unknown Bucks flow Pin drift fix, Unknown Bucks root cause Mar 2026 Log Event rebuild (camera + observation modes), buck tag dropdown fix, movement search fix. Attempted pin drift fix — made worse, reverted to be885d1 Pin drift fix (careful approach), test Log Event features, Unknown Bucks root cause
