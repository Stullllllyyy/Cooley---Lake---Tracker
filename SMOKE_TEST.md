# SMOKE TEST — Huginn Hunt Intelligence
Run this before every merge to main. Do not merge if any item fails.

## How to Use
- Work through every section relevant to the change being merged
- If a section was not touched, mark it ✅ SKIPPED — but when in doubt, run it
- Any failure = fix before merge. No exceptions.
- After a full session touching many features, run the entire checklist

## 1. App Load & Auth
- [ ] App loads at app.huginnhunt.com without console errors
- [ ] Login page appears for unauthenticated users
- [ ] Magic link flow completes and routes to map
- [ ] Invite code gate blocks invalid codes
- [ ] Valid invite code routes to correct property
- [ ] Property loads correctly after login

## 2. Map & Pins
- [ ] Map loads, satellite base style renders
- [ ] All 4 map styles switch correctly (SAT / SAT+ / TOPO / DARK)
- [ ] Camera pins render correct color on initial load — no black pins
- [ ] Camera pin tips align with movement line endpoints
- [ ] Tap camera pin — popup opens immediately
- [ ] Stand markers visible by default
- [ ] Scrape/Rub hidden by default, appear after filter toggle
- [ ] Bedding hidden by default, appear after filter toggle
- [ ] Movement lines hidden on initial load
- [ ] GPS blue dot appears and tracks location
- [ ] North indicator visible upper right
- [ ] Filter FAB opens — all toggles work
- [ ] Map Display panel opens — SAT/SAT+/TOPO/DARK + compass toggle

## 3. Log Event — Full Flow
- [ ] Tap + FAB → tap-to-place activates
- [ ] Sulfur teardrop at map center, drags freely
- [ ] Location Set card appears at bottom
- [ ] Confirm locks pin, opens Event Type modal
- [ ] Cancel removes pin cleanly

Camera Sighting:
- [ ] Form opens with location pre-filled
- [ ] Camera dropdown loads
- [ ] Weather auto-fills on date/time entry
- [ ] Photo upload works
- [ ] AI buck suggestion returns
- [ ] Accept/Wrong Buck/New Buck buttons work
- [ ] ai_feedback row created in Supabase
- [ ] Save inserts to sightings with source='camera' and property_id

Field Observation:
- [ ] Save inserts with source='observation', obs_lat/obs_lng populated
- [ ] Pin appears on map after save
- [ ] Pin persists after page reload

Mark Feature:
- [ ] Stand/Scrape/Rub/Bedding options available
- [ ] Save inserts to property_markers with type column (not feature_type)
- [ ] Pin appears on map correct color
- [ ] property_id present on saved record

## 4. Sightings Tab
- [ ] Trail Cams feed loads — cards display with thumbnails
- [ ] Field Notes feed loads — text cards display correctly
- [ ] Toggle between Trail Cams and Field Notes works
- [ ] 30 day filter active by default
- [ ] Tap buck name → Intel tab opens → correct dossier opens
- [ ] Tap sighting card → detail sheet opens
- [ ] Filters narrow results correctly

## 5. Intel Tab
- [ ] Intel tab loads without errors
- [ ] Buck Intelligence cards display — photos and initials
- [ ] Tap buck card → dossier opens in front of Intel
- [ ] Dossier — hero photo, stats, AI key insights, weather impact
- [ ] Dossier — wind rose renders, activity chart renders
- [ ] Dossier — behavior breakdown, seasonal activity, top cameras
- [ ] Dossier — photo gallery, tap photo opens lightbox
- [ ] Dossier — recent sightings, tap opens detail on top of dossier
- [ ] View All Sightings → Sightings tab filtered to that buck
- [ ] Wind rose renders correctly — no segment gaps
- [ ] Activity chart loads hourly data
- [ ] Key Insights returns AI insights
- [ ] 7-day forecast scores display
- [ ] Conditions graph renders

## 6. Hunt AI Tab
- [ ] Chat sends and receives response
- [ ] Response references property-specific data
- [ ] Conversations drawer opens, shows history
- [ ] Property Intel cards load
- [ ] Add note to Property Intel — saves with timestamp
- [ ] Previous notes preserved

## 7. Hamburger Menu
- [ ] Tap H logo → menu slides in from left
- [ ] Email, property name, tier badge display
- [ ] Avatar shows photo or initial
- [ ] Profile photo upload works
- [ ] Sign Out returns to login screen
- [ ] Tap outside closes menu

## 8. Weather
- [ ] Weather pill shows current conditions — not Cooley Lake default
- [ ] Tap pill → floating card opens
- [ ] My Location toggle shows GPS weather
- [ ] Map Center toggle shows map center weather
- [ ] Toggle between both works correctly
- [ ] 24hr forecast scroll works

## 9. Camera Management
- [ ] Add camera via tap-to-place — saves with correct lat/lng
- [ ] Tap pin → popup shows options
- [ ] Move camera — temporary marker appears, save updates location
- [ ] Archive camera — pin disappears, sightings preserved

## 10. Data Integrity (Spot Check)
In Supabase after any DB-touching change:
- [ ] property_id present on sightings insert
- [ ] property_id present on cameras, property_markers, chat_messages
- [ ] source field present on sightings
- [ ] Soft deleted records have deleted_at set
- [ ] No API key visible in network requests

## 11. Mobile Specific
- [ ] Tab bar not overlapping content
- [ ] Sheets not clipped by URL bar (dvh units)
- [ ] All touch targets comfortably tappable
- [ ] Keyboard doesn't overlap chat input
- [ ] Log Event modals visible above keyboard
- [ ] Hamburger menu X button tappable

## Post-Merge
- [ ] Vercel deployment completes without errors
- [ ] Spot-check one full flow on production URL
- [ ] Update TASKS.md — move completed items with date
- [ ] Verify no unmerged feature branches remain

*Last updated: April 2026 — add new test cases when new bug classes discovered*
