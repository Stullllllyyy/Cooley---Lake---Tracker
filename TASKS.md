Huginn Hunt Intelligence — Tasks & Session Log
How To Use This File
* Before a Claude Code session: Read CLAUDE.md + this file to orient
* During a session: Reference current tasks, stay in scope
* After a session: Update this file with what was completed and what's next

🔥 Current Priority (Next Session)
* [ ] Hunt AI Part 3 — conversations drawer (save/load named conversations), guided property seeding workflow (step-by-step prompts for each Property Intel category), AI response standardization (consistent formatting, bullet style, length)
* [ ] Trail cam photo AI auto-fill — when a photo is uploaded to a sighting, send it to Claude Vision to auto-detect deer type, buck/doe, antler characteristics, behavior, and pre-fill form fields
* [ ] Stand info cards — tap stand pin on map to expand an info card showing name, notes, nearby camera data, wind history, with Edit / Move / Delete options

🐛 Active Bugs
Bug | Severity | Notes
Unknown Bucks — named bucks appearing in unknown bucket | Medium | Marsh Buck showing in Unknown Bucks even after AI match. buck_name likely staying null because confirmation never saved. Needs trace + bulk-resolve.
Field observation pins on map | Low | Pins save with obs_lat/obs_lng and appear after save — needs production verification that pins persist correctly after full page reload.

📋 Active Backlog
Tasks defined and ready to work on, in priority order:

Immediate
* [ ] Hunt AI Part 3 — conversations drawer, guided property seeding workflow, AI response standardization
* [ ] Trail cam photo AI auto-fill — Claude Vision auto-detect deer type, behavior, antler traits from uploaded photos
* [ ] Stand info cards — tap stand pin, info card with name/notes/wind/camera data, Edit/Move/Delete
* [ ] Filter FAB — floating action button for quick map filter access (deer type, date range, buck name, camera)
* [ ] Unknown Bucks root cause + bulk resolve Marsh Buck null records

Near Term
* [ ] Property Intel spatial pin tagging — link Property Intel categories to specific map locations (e.g. "bedding area near ridge" tied to a pin), show on map as intel overlay
* [ ] Passive spatial intelligence loop — when users place/edit pins, automatically update relevant Property Intel categories with location context (e.g. new stand placement feeds Stand Notes)
* [ ] Update Scrape/Rub/Bedding/Stand map pins — replace filled-circle style with Feather-style SVG teardrop icons matching camera pin shape
* [ ] Old addCamModal cleanup — remove orphaned #addCamModal HTML, CSS, and JS
* [ ] Responsive design audit — test on multiple mobile screen sizes and on desktop/tablet
* [ ] AI Training loop — Wrong Buck correction flow → ai_feedback table
* [ ] Buck Profiles view — activate Profiles button, full buck dossier
* [ ] Stand Intel AI card — nearby cameras (PostGIS radius), movement patterns, peak times, best wind, AI recommendation

Medium Term
* [ ] Historical harvest log
* [ ] Season Planner / Vacation Day Optimizer
* [ ] Personal rut calendar
* [ ] Weather enhancements (pressure trend, sunrise/sunset, dew point, hourly scroll)
* [ ] Map Layers system (public land, WI DNR/parcel, waterways, contour, slope)
* [ ] Field navigation tools (distance ring, heading cone, compass bar)
* [ ] GPS track logging
* [ ] Map annotation / draw layer
* [ ] PostGIS enablement (time it with Stand Intel build)
* [ ] Offline / PWA mode
* [ ] Multi-species — Elk GMU 231 Colorado September 2026

🧪 Needs Testing
Item | Notes
Hunt AI Chat — Hunt Assistant mode | Confirm messages send to /api/claude, responses render, conversation persists in chat_messages table
Hunt AI Chat — Property Intel mode | Confirm property_context saves/loads/deletes correctly for all 6 categories
Seed prompt overlay | Confirm shows on first login with empty property_context, dismisses correctly, never shows again
Sightings feed thumbnails | Confirm 48x48 thumbnails render with lazy loading, deer silhouette fallback works
Sightings detail modal | Confirm tap opens read-only modal, all fields display, scroll position preserved on close
Intel tab month filter | Confirm month dropdown filters sightings correctly within selected year
Log Event — Camera Sighting mode | Confirm source='camera' saves to Supabase
Log Event — Field Observation mode | Confirm source='observation', obs_lat/obs_lng save correctly
Field observation pins on map | Confirm pins persist after page reload

✅ Completed
Feature/Fix | Notes | Date
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
Log Event UX Rework — full 7-step flow | + FAB → tap-to-place → event type modal → three focused forms. All wired end to end. | Mar 21 2026
Tap-to-place draggable pin | Replaced crosshair+click with mapboxgl.Marker draggable:true. Sulfur teardrop, Location Set card, live coord update. | Mar 21 2026
Placement pin color (sulfur) | Changed preview pin to #E5B53B sulfur to stand out from camera pins | Mar 21 2026
Markers filter pill | Added Scrape/Rub and Bedding visibility toggle pills to filter bar | Mar 21 2026
property_markers schema fix | Fixed column mismatch: feature_type→type, removed non-existent columns | Mar 21 2026
Field obs pin shape fix | Field observation pins use distinct shape (circle with crosshair) | Mar 21 2026
Movement lines hidden on load fix | Movement lines no longer visible on initial map load | Mar 21 2026
TTP_OVERLAY_SEL dead code removed | Removed pointer-events disable/restore approach entirely | Mar 21 2026
Supabase Auth gate with login screen | Email/password + magic link login, invite code gate, auth state persistence, sign out flow | Mar 22 2026
Universal pin color editor | Tap any pin → color swatches in info card → saves to cameras.color or property_markers.color | Mar 22 2026
Save Changes system | Unified save flow for pin edits (name, color, facing, notes) with confirmation | Mar 22 2026
Intelligence tab full redesign | 24-hour activity chart, month filter, static Recent Activity rows, buck profile cards | Mar 22 2026
Sightings feed thumbnails + detail modal | 48x48 lazy-loaded thumbnails with deer silhouette fallback, read-only detail modal on tap | Mar 22 2026
Hunt AI Chat — Hunt Assistant mode | Full chat UI with starter pills, typing indicator, multi-turn conversation, per-buck/stand context, chat_messages persistence | Mar 22 2026
Hunt AI Chat — Property Intel mode | 6 category cards (Terrain, Neighbors, Bedding, Food, History, Stands), edit modal, property_context table, AI context integration | Mar 22 2026
Seed property intelligence prompt | First-login overlay checks property_context, prompts setup or dismiss, localStorage gate | Mar 22 2026
Multi-property schema migrations | property_id on sightings, cameras, property_markers, chat_messages, property_context tables | Mar 22 2026

Session Log
Date | What We Did | What's Next
Mar 2026 | Set up GitHub + Claude Code integration, created context files | Begin feature work
Mar 2026 | SAT+ pin visibility fix, Bulk Unknown Bucks flow | Pin drift fix, Unknown Bucks root cause
Mar 2026 | Log Event rebuild (camera + observation modes), buck tag dropdown fix, movement search fix. Attempted pin drift fix — made worse, reverted to be885d1 | Pin drift fix (careful approach), test Log Event features, Unknown Bucks root cause
Mar 2026 | Fixed all three camera pin bugs: black-on-load timing, alignment drift, INP touch performance. Commit: 97b3bbf | Unknown Bucks root cause trace + fix
Mar 20 2026 | Fixed new cam pins dropping black, field obs pins not appearing, faded pin opacity. Added Log Event UX Rework and Unified Pin Management System to roadmap. | Unknown Bucks root cause; verify Log Event in production
Mar 21 2026 | Completed full Log Event UX Rework (7 steps). Fixed tap-to-place migration, property_markers insert, Markers filter pill. | Feather-style SVG teardrop icons; Unknown Bucks root cause + Marsh Buck bulk resolve
Mar 22 2026 | Major feature session: Supabase Auth gate, universal pin color editor, Intelligence tab redesign (24h chart, month filter), Sightings feed thumbnails + detail modal, Hunt AI Chat (Hunt Assistant + Property Intel modes), seed property prompt, multi-property schema migrations, enriched AI context with per-buck wind/camera/time breakdowns and per-stand wind data | Hunt AI Part 3 (conversations drawer, guided seeding, response standardization); trail cam photo AI auto-fill; stand info cards; filter FAB
