# HUGINN — Architectural & Product Specification
**AI-Powered Whitetail Deer Hunting Intelligence Platform**
Version 1.0 | March 2026

---

## Quick Reference

| | |
|---|---|
| **App** | cooley-lake-tracker.vercel.app |
| **Marketing Site** | huginnhunt.com |
| **Repo** | github.com/Stullllllyyy/Cooley---Lake---Tracker |
| **Stack** | Vanilla HTML/JS/CSS (single index.html), Supabase, Mapbox GL JS v3.3.0, Vercel, Anthropic API via /api/claude.js |
| **Property ID** | 403a9c61-4b6a-4bd1-81a3-a82054a4ce5e (Cooley Lake, Suring WI) |
| **Brand Colors** | Obsidian `#121415`, Bronze `#8C7355`, Tungsten `#4A4D4E`, Silver `#BCC6CC`, Sulfur `#E5B53B` |

---

## 1. Product Vision

Huginn is an AI-powered whitetail deer hunting intelligence platform built for serious hunters who practice Quality Deer Management. The platform aggregates property-level data — sightings, trail camera observations, terrain features, and environmental conditions — and uses AI to deliver actionable hunting intelligence.

The long-term vision is onX-level scale: a platform where thousands of hunters contribute anonymized behavioral data, creating a collective intelligence layer that makes every user a smarter hunter. The moat is not the map — it is the buck behavioral data and the AI that interprets it.

> **North Star:** Build for scale from day one. Every architectural decision should be evaluated against: "Does this work for 10,000 users on 10,000 properties?" If the answer is no, redesign it now.

---

## 2. Data Architecture

### 2.1 Core Principles

- Every record carries `property_id` AND `user_id` — no orphaned data
- Soft deletes only — `deleted_at` timestamp, never hard delete
- Pin location history preserved on every move
- All sighting data retained even when pins are deleted or moved
- Images compressed client-side before upload (max 800px, ~200KB)

### 2.2 Supabase Tables

| Table | Purpose & Key Columns |
|---|---|
| `sightings` | All deer sightings. Columns: id, property_id, user_id, date, time, deer_type, behavior, buck_tag, wind_dir, temp_f, moon_phase, notes, image_url, obs_lat, obs_lng, source, deleted_at |
| `cameras` | Trail cam locations. Columns: id, property_id, user_id, name, lat, lng, color, facing, notes, deleted_at, location_history (jsonb) |
| `property_markers` | Stands, scrapes, rubs, bedding. Columns: id, property_id, user_id, type, name, lat, lng, color, notes, deleted_at, location_history (jsonb) |
| `properties` | Property records. Columns: id, name, center_lat, center_lng, owner_id, created_at |
| `property_context` | AI intel by category. Columns: id, property_id, category, content, created_at, updated_at |
| `chat_messages` | Hunt AI history. Columns: id, property_id, conversation_id (uuid), role, content, created_at |
| `bucks` | Buck registry (planned). Columns: id, property_id, name, first_seen, last_seen, notes, created_at |
| `property_members` | Multi-user access (planned). Columns: id, property_id, user_id, role (owner/guest), invited_at, accepted_at |

### 2.3 Soft Delete Model

All pin tables (cameras, property_markers) use soft deletes. Hard delete is never performed automatically.

**Delete flow:**
1. User taps delete on a pin
2. Prompt: "Archive this pin? Your sighting history will be preserved for 30 days, then permanently removed. You can restore it anytime before then."
3. Two options: **Archive** | **Cancel** — no instant permanent delete
4. On archive: `deleted_at = now()`, pin disappears from map
5. Archived pins visible in Archived Pins section (Settings) for 30 days
6. After 30 days: auto-purge removes record and associated images
7. On paid tiers: archived data retained indefinitely (counts against storage quota)

> **Data Preservation Rule:** Sightings linked to a deleted pin are NEVER deleted with the pin. They remain in the sightings table with the pin's last known location preserved. The AI uses these for historical pattern analysis even after the pin is gone.

### 2.4 Pin Move / Location History

When any pin (camera or marker) is moved, the old GPS coordinates are logged before the update.

- `location_history` column (jsonb array) on `cameras` and `property_markers`
- Each move appends: `{ lat, lng, moved_at, moved_by (user_id) }`
- Current lat/lng always reflects current position
- AI context includes move history: "This camera was relocated in October 2024"
- Spatial intel uses current location for future analysis, historical coords for past pattern analysis

---

## 3. Spatial Intelligence Layer

### 3.1 Vision

Every scrape, rub, and bedding pin is not just a marker — it is a data point in a behavioral model. The spatial intelligence layer connects pin data, sighting data, camera coverage, and stand locations into movement pattern analysis delivered through the AI and visualized on the map.

### 3.2 Data Relationships

| Signal | Intelligence |
|---|---|
| Rub lines | Two or more rubs in sequence suggest a travel corridor. Direction derived from sequential GPS points. AI identifies and names corridors. |
| Scrape clusters | Scrapes within proximity threshold grouped into clusters. Density and timing fed to AI for rut phase analysis. |
| Bedding to stand | Distance and wind direction between bedding areas and stand locations determines approach route recommendations. |
| Camera coverage gaps | Camera locations mapped against active scrape/rub clusters. AI flags areas with activity but no coverage. |
| Movement corridors | Derived from rub lines, scrape sequences, sighting travel directions, and terrain features combined. |

### 3.3 Map Visualization (Planned)

- Toggleable spatial intel layer — off by default
- Rub lines rendered as directional arrows connecting sequential rubs
- Scrape clusters shown as heat zones with intensity based on density
- Movement corridor overlays derived from combined pin and sighting data
- Stand coverage rings showing effective observation radius vs. activity concentration
- Camera coverage gap indicators — zones where activity exists but no camera coverage

### 3.4 Spatial Pin Tagging

When dropping any pin (scrape, rub, bedding, stand, camera), the user can tag it to a Property Intel category. GPS location is fed into AI context automatically, building passive spatial intelligence over time.

- Scrape pin → auto-tags to Buck Bedding or Pressure category
- Rub pin → auto-tags to Terrain or Observation Notes category
- Bedding pin → tags to Buck Bedding or Doe Bedding category
- Over time, tagged pins build a spatial knowledge graph the AI uses for recommendations

---

## 4. Multi-User & Multi-Property

### 4.1 Row-Level Security (RLS) — Pre-Beta Critical

> ⚠️ **BLOCKER:** Supabase RLS policies must be defined before any multi-user beta. Without RLS, any authenticated user can query any other user's data. This must be resolved before Dan and Andy are invited.

Required RLS policies on every table:
- **SELECT:** user can only read records where property_id is in their property_members
- **INSERT:** user can only insert records for properties they own or are a member of
- **UPDATE/DELETE:** user can only modify their own records (user_id match)

### 4.2 Role-Based Access

| Role | Permissions |
|---|---|
| Owner | Full read/write on all property data. Can invite members. Can delete property. |
| Co-Hunter | Full read/write on sightings, cameras, markers. Cannot delete property or manage members. |
| Guest Viewer | Read-only access to sightings and map. Cannot add or edit. (Planned — paid tier) |

### 4.3 Buck Identity Model

Free text buck naming causes data integrity issues across multiple observers. Before multi-user beta, a buck registry is required.

- `bucks` table: canonical buck names per property
- Sightings reference `bucks.id`, not free-text `buck_tag` strings
- When adding a sighting, user selects from property's buck list or creates a new buck
- AI buck matching assists in suggesting which registered buck a new sighting matches
- Eliminates "Creek 10" vs "Creek10" phantom duplicate problem

### 4.4 Multi-Property UX

- Property switcher in nav — tap to switch active property
- All map, intel, and AI context reloads for the selected property
- Cross-property aggregate dashboard (planned)
- Properties do not share data — each is a fully isolated data context

---

## 5. First-Time Onboarding Flow

Triggered on first login. A series of dismissable modal cards walks the user through property setup. Each card can be completed now or skipped and accessed later via Settings.

- **Card 1 — Property Location:** Name your property, GPS defaults to current location, drop a pin for property center
- **Card 2 — Terrain Intel:** Pre-built questions with selectable chip answers about terrain features
- **Card 3 — Food Sources:** Current and seasonal food sources on the property
- **Card 4 — Buck Bedding:** Known bedding areas, terrain considerations
- **Card 5 — Doe Bedding:** Doe family group areas relative to buck bedding
- **Card 6 — Pressure:** Neighboring property and public land pressure points
- **Card 7 — Drop Pins (Optional):** Guided prompt to drop initial stand, camera, scrape, and bedding pins

> **Onboarding Goal:** A new user who completes all seven cards has given the AI enough context to provide meaningful hunting recommendations from day one — before logging a single sighting.

---

## 6. Hunt AI Architecture

### 6.1 Context Window Strategy

| Source | What's Included | Token Budget |
|---|---|---|
| Cameras + Markers + Bucks | Always in full | ~200 tokens |
| Property Intel (property_context) | Always in full | ~300 tokens |
| Recent Sightings | Capped at 150 most recent, slimmed fields | ~2,000 tokens |
| Named Buck Summaries | Total sightings, top cameras, date range, behaviors | ~500 tokens |
| Conversation History | Last 20 messages from current conversation | ~400 tokens |
| Weather / Moon | Fresh fetch on chat open, current conditions | ~100 tokens |
| **Total Estimated** | | **~3,500 tokens** |

### 6.2 AI Response Standards

System prompt must instruct the model to:
- Respond in conversational prose — no bullet-heavy lists as primary format
- Lead with the direct answer, then provide context and reasoning
- Reference specific named locations: "your East Ridge stand" not "a stand on the east side"
- Include current date and season context in every system prompt
- Acknowledge data gaps honestly — if wind forecast is unavailable, say so
- Keep responses field-practical — a hunter in a tree stand should absorb it in 30 seconds

### 6.3 Conversations Model

- Every conversation has a unique `conversation_id` (uuid) generated at start
- New conversations started manually by user only — no auto-start on inactivity
- Conversation preview in drawer shows first USER message, not first AI response
- Delete conversation requires confirmation prompt before removal
- `chat_messages` table retains all history — drawer is a filtered view

---

## 7. Tiered Product Model

### 7.1 Approach

Architecture is designed to support tiers from day one — every user record has a `tier` field, every data-heavy operation checks against limits — but no features are gated during beta. Learn from real usage data before setting pricing.

### 7.2 Proposed Tiers

| Feature | Free | Pro (~$9.99/mo) |
|---|---|---|
| Properties | 1 | Up to 3 |
| Sighting History | Current season | Unlimited |
| Hunt AI | Starter questions only | Full conversational AI |
| Spatial Intel Layer | Not included | Full movement analysis |
| Trail Cam Photo Storage | Not included | 5GB included |
| Multi-User Access | Owner only | Owner + Co-Hunters |
| Data Export | Not included | Full export |
| Archived Pin Retention | 30 days | Indefinite |

### 7.3 Storage / Data Plans

Trail cam photo storage follows a model hunters already understand — like Google Drive or iCloud.

- Storage usage shown in Settings: "4.2GB of 5GB used"
- Warning at 80% capacity with upgrade prompt
- At 100%: new photo uploads blocked, existing data unaffected
- Add-on storage packs: +10GB, +50GB, +100GB at incremental pricing

---

## 8. Infrastructure & Risk Checklist

### 8.1 Pre-Beta Blockers (Must complete before Dan & Andy)

- [ ] RLS policies on all Supabase tables
- [ ] Buck identity registry — `bucks` table, replace free-text `buck_tag` with `bucks.id` foreign key
- [ ] Rate limiting on `/api/claude.js` serverless function (per-user or per-IP)
- [ ] Image compression on upload — client-side resize to max 800px / ~200KB before Supabase storage
- [ ] Soft delete model implemented on `cameras` and `property_markers` tables

### 8.2 Pre-Public Launch

- [ ] Privacy Policy and Terms of Service published on huginnhunt.com
- [ ] Cost model validated — cost-per-user projection for API + Mapbox + Supabase at scale
- [ ] Staging environment defined in Vercel
- [ ] Analytics / telemetry — event logging table in Supabase for feature usage tracking
- [ ] Offline failure handling — graceful degradation when Supabase or API is unreachable

### 8.3 Technical Debt — Medium Term

- [ ] Single file architecture (index.html) — plan refactor before file exceeds maintainable threshold
- [ ] Mapbox cost monitoring — set up usage alerts before scale
- [ ] Anthropic API cost monitoring — track tokens per user per session
- [ ] PWA / offline mode — sighting queue for upload when connection returns

---

## 9. Pre-Beta Launch Checklist

| Item | Status | Priority |
|---|---|---|
| RLS Policies | Pending | BLOCKER |
| Buck Registry | Pending | BLOCKER |
| Rate Limiting on API | Pending | BLOCKER |
| Image Compression on Upload | Pending | BLOCKER |
| Soft Deletes on Pin Tables | Pending | BLOCKER |
| Invite System (account-based) | Pending | High |
| Hunt AI Chat — Full Part 3 | In Progress | High |
| Key Insights Fix | Pending | High |
| Marketing Site Login → App | Pending | Medium |
| App Screenshots for Marketing Site | Pending | Medium |

---

## 10. Development Protocols

### 10.1 Every Code Session

1. Run `git checkout main` and confirm branch before any work
2. Read `CLAUDE.md`, `PLANNING.md`, `TASKS.md`, and `ARCHITECTURE.md` before any changes
3. Diagnose before fixing — identify exact root cause before writing code
4. One task at a time — confirm working before moving to next
5. Syntax check before every commit
6. Merge to main after each confirmed task — never batch multiple tasks into one merge

### 10.2 Ground Rules

- This app is live and in use — surgical changes only
- Do not refactor, rename, or reorganize code outside task scope
- After each change: confirm what was changed AND what was not touched
- Do not touch huginnhunt.com files during app sessions
- Do not modify Supabase schema without explicit instruction and migration SQL reviewed first

### 10.3 Branch & Deploy Workflow

- Code works on feature branch `claude/xxx`
- GitHub → Compare & pull request → Merge to main
- Vercel auto-deploys from main to production
- Safety checkpoint commit: `216498b` — last known fully working state before Intel redesign

---

*Huginn Architectural Spec | Confidential | March 2026*
