Huginn Hunt Intelligence — Product Planning
Vision
A collaborative whitetail deer and big game hunting intelligence platform. Hunters log trail camera sightings and field observations across their properties — building a living map of wildlife patterns, named buck profiles, and AI-powered hunt recommendations over time. Built for any property, any game species, any hunter skill level.
Brand: Huginn Advisory Group — "Know More. Hunt Smarter." Live URL: cooley-lake-tracker.vercel.app Property #1: Cooley Lake, Suring Wisconsin (~100 acres)
Current MVP Status — What's Live ✅
* Trail camera sighting logging with photo upload
* Field observation logging (GPS or pin drop location)
* Named buck tracking with AI photo identification
* Movement lines on satellite map (per-buck corridors)
* Heatmap and core area overlays
* Intelligence tab — 24-hour activity chart, buck profile cards, month/year/buck filters, AI key insights
* Sightings feed with thumbnails and read-only detail modal
* Weather auto-fetch on sighting entry (historical + forecast)
* Moon phase auto-calculation
* Filter bar — date, movement lines, map style, marker type toggles
* Camera pin management (add, move, rename, delete, color)
* Universal pin color editor (cameras + property markers)
* Bulk Unknown Buck resolution flow
* 4 map styles (SAT, SAT+, TOPO, DARK)
* Supabase Auth gate — email/password + magic link login
* Hunt AI Chat — Hunt Assistant mode (multi-turn, property-aware AI with per-buck and per-stand context)
* Hunt AI Chat — Property Intel mode (6 category cards, edit/save/delete, feeds AI context)
* Seed property intelligence prompt (first-login overlay)
* Multi-property schema (property_id on all tables)
🔴 Immediate — Next Build Session
Feature/Fix | Notes
Hunt AI Part 3 | Conversations drawer (save/load named conversations), guided property seeding workflow (step-by-step prompts for each category), AI response standardization (consistent formatting, bullet style, length)
Trail cam photo AI auto-fill | Send uploaded photo to Claude Vision → auto-detect deer type, buck/doe, antler characteristics, behavior → pre-fill sighting form fields
Stand info cards | Tap stand pin → info card with name, notes, nearby camera data, wind history, Edit/Move/Delete options
Filter FAB | Floating action button for quick map filter access — deer type, date range, buck name, camera
🟡 Near Term
Feature | Notes
Property Intel spatial pin tagging | Link Property Intel categories to specific map locations (e.g. "bedding area near ridge" tied to a pin). Show on map as intel overlay layer. Bridges the gap between text knowledge and spatial awareness.
Passive spatial intelligence loop | When users place/edit pins, automatically update relevant Property Intel categories with location context. New stand → feeds Stand Notes. New bedding marker → feeds Bedding Areas. Makes Property Intel self-populating from normal usage.
Feather-style SVG teardrop pin icons | Replace filled-circle markers for Stand/Scrape/Rub/Bedding with SVG teardrops matching camera pin architecture. Brand colors per type.
AI Training loop | "Wrong Buck" correction flow. Saves ai_suggestion, ai_confidence, ai_confirmed, ai_correction_notes to ai_feedback table. Confirmed / Wrong Buck buttons replace Accept/Edit ID.
Buck Profiles view | Activate Profiles button in Sightings header. Full dossier: confirmed photos, antler description, camera intel, field observations, AI training notes, movement summary, concentration dates.
Stand Intel AI card | When a stand marker is tapped, popup includes AI-generated intel: nearby cameras within ~300 yards (PostGIS), movement patterns, peak activity times, best wind directions, AI "Hunt this stand when..." recommendation. Prerequisite: PostGIS enabled.
Unknown Bucks root cause fix | Marsh Buck appearing in unknown bucket. Trace AI hint → accept → save flow. Find where buck_name is dropped. Bulk resolve null records.
Old addCamModal cleanup | Remove orphaned #addCamModal HTML, CSS, and JS references.
Responsive design audit | Test on multiple mobile screen sizes and desktop/tablet. Fix layout breaks, tap-target issues.
🟢 Medium Term
Feature | Notes
Historical harvest log | Date, location, conditions, buck description. Feeds personal success pattern analysis and season planner.
Season Planner / Vacation Day Optimizer | AI top hunt days for upcoming season. "If you can only hunt 5 days this November, these are the 5 days."
Personal rut calendar | Property-specific rut phases with confidence intervals that tighten every season.
Weather enhancements | Pressure trend description, sunrise/sunset + daylight hours, dew point, hourly forecast scroll.
Map Layers system | Public land, WI DNR/parcel, waterways, contour selector, slope angle, timber cuts.
Field navigation tools | Distance ring, heading cone, compass bar (mobile only).
GPS track logging | Opt-in path recording, named tracks, intrusion history feeds AI.
Map annotation / draw layer | Polygon/line/circle. GeoJSON in Supabase. Feeds AI.
PostGIS enablement | Enable Supabase PostGIS extension. Migrate to geometry columns. Unlocks spatial queries for core area, proximity, map draw layer.
Offline / PWA mode | Service Worker, local queue, auto-sync.
Multi-species | Elk GMU 231 Colorado, September 2026.
💼 Product & Business
Item | Notes
Business & legal | Trademarks, ToS, privacy policy, LLC under Huginn Advisory Group
Pricing & monetization | Tier structure, AI chat value, B2C vs B2B (hunting clubs, outfitters)
Beta launch plan | Invite codes, first 10–20 non-you users, feedback loop
Cooley Lake as Property #1 | Dan and Andy as first real multi-user test
Social media | Instagram launch, content strategy, handle secured
💡 Ideas Parking Lot
Idea | Notes
Anonymous behavioral signal aggregation | Weather/pressure/moon correlated with movement activity. Opt-in, no PII. Builds proprietary Huginn movement dataset over time.
Regional intelligence layer | Aggregate anonymous movement trends by region.
Outfitter version | Season Planner applied across multiple clients and properties. Helps outfitters schedule hunts for max client success.
Proprietary movement prediction model | Trained on real structured hunter observation data. Gets better with every opt-in user.
SuperClaude framework | Revisit after MVP stabilizes.
Key Architectural Decisions
Decision | Choice | Reason | Date
Frontend | Vanilla HTML/JS/CSS single file | Simplicity, fast iteration, no build step | Mar 2026
Backend | Supabase | Auth + DB + Storage in one, generous free tier | Mar 2026
Map | Mapbox GL JS v3.3.0 | Satellite imagery, vector layers, marker control | Mar 2026
Deployment | Vercel | Simple GitHub integration, serverless functions | Mar 2026
AI proxy | Vercel serverless /api/claude.js | Never expose Anthropic key client-side | Mar 2026
AI model | claude-sonnet-4-5 | Best balance of speed + quality for chat and analysis | Mar 2026
Multi-property | property_id on all tables | Scalability — don't retrofit later | Mar 2026
Auth | Supabase Auth + invite codes | Built-in with backend, magic link support | Mar 2026
Property context | property_context table + Hunt AI integration | Hunter knowledge feeds AI recommendations | Mar 2026
Spatial data | PostGIS via Supabase extension | When Stand Intel ships — geometry > float pairs | Planned
Out of Scope (Current MVP)
* Native mobile app — web-first and PWA first. Native iOS/Android or Electron desktop is a future phase once PWA is solid and there are paying users. Not never, just not now.
* Public / social feed (private properties only for now)
* E-commerce or gear recommendations
* Any hardcoded single-property assumptions
