// Huginn — sightings.js
// Sighting log flow, feeds, detail, buck registry, AI identification, tap-to-place
// Depends on: config.js, utils.js (showToast, compressImage, fmtD, fmtT, moonPhase,
//   deg2dir, simpleDir, claudeFetch), auth.js (sb), weather.js, ui.js (openSheet, closeSheet)
// References from inline: mapInstance, camLocations, propertyMarkers, refreshMapPins,
//   addCamMarkers, loadCamLocations, loadPropertyMarkers, renderPropertyMarkers,
//   renderDash, loadHuntForecast

function showDet(id) {
  const s = sightings.find(x => x.id === id); if(!s) return;
  const m = moonPhase(s.date);
  const bc = s.buck_name ? buckColor(s.buck_name) : null;
  const wxHtml = s.wind_speed ? `
    <div class="wx-panel" style="margin-top:10px">
      <div class="wx-panel-title"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-1px;margin-right:5px"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> Conditions at Sighting</div>
      <div class="wx-grid">
        <div class="wx-cell"><div class="wx-val">${s.temp_f||'--'}</div><div class="wx-lbl">Temp F</div></div>
        <div class="wx-cell"><div class="wx-val">${s.wind_speed||'--'}</div><div class="wx-lbl">Wind mph</div></div>
        <div class="wx-cell"><div class="wx-val">${s.wind_gust||'--'}</div><div class="wx-lbl">Gust mph</div></div>
      </div>
      <div class="wx-row2">
        <div class="wx-cell"><div class="wx-val">${s.wind_dir||'--'}</div><div class="wx-lbl">Wind Dir</div></div>
        <div class="wx-cell"><div class="wx-val">${s.humidity?s.humidity+'%':'--'}</div><div class="wx-lbl">Humidity</div></div>
        <div class="wx-cell"><div class="wx-val">${s.precip?s.precip+'"':'--'}</div><div class="wx-lbl">Precip</div></div>
      </div>
      ${s.pressure?`<div style="margin-top:6px"><div class="wx-cell" style="text-align:left;padding:8px 10px"><div class="wx-lbl">Barometric Pressure</div><div style="font-size:13px;color:var(--text)">${s.pressure} hPa</div></div></div>`:''}
    </div>` : '';
  document.getElementById('detcontent').innerHTML = `
    ${s.image_url ? `<img class="detail-img" src="${s.image_url}" alt=""/>` : ''}
    <div class="card${s.deer_type&&s.deer_type.includes('Mature')?' gold':''}">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
        <div style="font-size:18px;font-weight:700;color:${s.deer_type&&s.deer_type.includes('Mature')?'var(--gold)':'var(--text)'}">${s.deer_type}</div>
        ${s.buck_name?`<div style="font-size:12px;padding:3px 10px;border-radius:12px;background:rgba(0,0,0,0.4);color:${bc};border:1px solid ${bc}">&#9679; ${s.buck_name}</div>`:''}
      </div>
      <div style="font-size:13px;color:var(--text3);margin-bottom:14px">${s.camera_name}</div>
      <div class="detail-grid">
        <div class="d-cell"><div class="d-cell-lbl">Date</div><div class="d-cell-val">${fmtD(s.date)}</div></div>
        <div class="d-cell"><div class="d-cell-lbl">Time</div><div class="d-cell-val">${fmtT(s.time)}</div></div>
        <div class="d-cell"><div class="d-cell-lbl">Moon</div><div class="d-cell-val">${m.i} ${m.l}</div></div>
        <div class="d-cell"><div class="d-cell-lbl">Behavior</div><div class="d-cell-val">${s.behavior||'--'}</div></div>
      </div>
      ${wxHtml}
      ${s.notes?`<div style="background:var(--bg);border-radius:10px;padding:10px;margin-top:10px"><div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Notes</div><div style="font-size:13px;color:var(--text2);line-height:1.6;font-style:italic">${s.notes}</div></div>`:''}
      <button class="edit-btn" style="margin-top:12px;width:100%;padding:10px" onclick="openEdit(${s.id})">&#9998; Edit Sighting</button>
    </div>`;
  openSheet('detail');
}

// Weather functions (updateMapWeather, weather popup card, sighting form wx) loaded from /js/weather.js

// FAB (toggleFabDial, closeFabDial) loaded from /js/ui.js

// Hunt AI (chat, conversations, Property Intel, wizard) loaded from /js/hunt-ai.js


var sightings = [], curFilter = "all", curMapFilter = "none", curYear = "all";
var intelYear = "all", intelBuck = "all";
// wxFetched, wxApplied loaded from /js/weather.js
var formImgFile = null;
var editId = null, editImgFile = null, editImgChanged = false;

// showToast loaded from /js/utils.js

// Confirm modal (showConfirmModal, confirmModalAction, closeConfirmModal) loaded from /js/ui.js

// Wrapper for /api/claude fetch — handles 429 rate limit with toast
// claudeFetch loaded from /js/utils.js
function getNamedBucks() {
  if(buckRegistry.length > 0) return buckRegistry.map(b => b.name);
  // Fallback: scan sightings if registry not yet loaded
  return [...new Set(sightings.filter(s=>s.buck_name&&s.buck_name.trim()).map(s=>s.buck_name.trim()))];
}
function buckColor(name) {
  const names = getNamedBucks();
  const idx = names.indexOf(name);
  return idx >= 0 ? BUCK_COLORS[idx % BUCK_COLORS.length] : "#c8a951";
}
function buckIdByName(name) {
  const b = buckRegistry.find(r => r.name === name);
  return b ? b.id : null;
}
function buckNameById(id) {
  const b = buckRegistry.find(r => r.id === id);
  return b ? b.name : null;
}

// --- AI Feedback Logging ---
async function writeAiFeedback({ photoUrl, cameraName, aiSuggestion, aiConfidence, aiReasoning, confirmedBuckId, confirmedBuckName, wasCorrect, correctionNotes }) {
  const payload = {
    property_id: PROPERTY_ID,
    user_id: null,
    photo_url: photoUrl || null,
    camera_name: cameraName || null,
    ai_suggestion: aiSuggestion || null,
    ai_confidence: aiConfidence != null ? aiConfidence : null,
    ai_reasoning: aiReasoning || null,
    hunter_confirmed_buck_id: confirmedBuckId || null,
    hunter_confirmed_buck_name: confirmedBuckName || null,
    was_correct: wasCorrect,
    correction_notes: correctionNotes || null
  };
  console.log('Writing ai_feedback:', payload);
  try {
    const { data, error } = await sb.from('ai_feedback').insert(payload).select();
    if(error) {
      console.error('ai_feedback insert failed:', error);
    } else {
      console.log('ai_feedback insert success:', data);
      // Invalidate reference photo cache when a confirmed photo is added
      if(photoUrl && confirmedBuckId) invalidateRefPhotoCache();
    }
  } catch(e) { console.error('writeAiFeedback exception:', e); }
}

function syncDot(on) {
  const d = document.getElementById("syncDot");
  if(d) d.className = "sync-dot" + (on ? " on" : "");
}

// --- Buck Registry ---
var buckRegistry = []; // Array of {id, property_id, name, first_seen, last_seen, notes, created_at}

async function loadBuckRegistry() {
  try {
    const { data, error } = await sb.from('bucks').select('*')
      .eq('property_id', PROPERTY_ID)
      .order('name');
    if(error) { console.error('loadBuckRegistry error:', error); return; }
    buckRegistry = data || [];
  } catch(e) { console.error('loadBuckRegistry:', e); }
}

async function createBuck(name) {
  if(!name || !name.trim()) return null;
  name = name.trim();
  // Check if already exists in registry
  const existing = buckRegistry.find(b => b.name.toLowerCase() === name.toLowerCase());
  if(existing) return existing;
  try {
    const { data, error } = await sb.from('bucks').insert({
      property_id: PROPERTY_ID,
      name: name
    }).select().single();
    if(error) { console.error('createBuck error:', error); return null; }
    buckRegistry.push(data);
    return data;
  } catch(e) { console.error('createBuck:', e); return null; }
}

async function resolveBuckId(buckName) {
  if(!buckName || !buckName.trim()) return null;
  buckName = buckName.trim();
  let buck = buckRegistry.find(b => b.name.toLowerCase() === buckName.toLowerCase());
  if(buck) return buck.id;
  // Auto-create if not found
  buck = await createBuck(buckName);
  return buck ? buck.id : null;
}

async function updateBuckDates(buckId, sightingDate) {
  if(!buckId || !sightingDate) return;
  const buck = buckRegistry.find(b => b.id === buckId);
  if(!buck) return;
  const updates = {};
  if(!buck.first_seen || sightingDate < buck.first_seen) updates.first_seen = sightingDate;
  if(!buck.last_seen || sightingDate > buck.last_seen) updates.last_seen = sightingDate;
  if(Object.keys(updates).length === 0) return;
  try {
    await sb.from('bucks').update(updates).eq('id', buckId);
    Object.assign(buck, updates);
  } catch(e) { console.error('updateBuckDates:', e); }
}

// Build enhanced buck profiles for AI identification
function buildAiBuckProfiles(cameraName) {
  const namedBucks = getNamedBucks();
  const profiles = [];
  const bucksWithPhotos = [];
  const bucksWithoutPhotos = [];

  namedBucks.forEach(name => {
    const regBuck = buckRegistry.find(b => b.name === name);
    const bs = sightings.filter(s => s.buck_name === name && s.deer_type && s.deer_type.includes('Buck'));
    const hasPhotos = bs.some(s => s.image_url);
    const antlerDesc = regBuck?.antler_description || '';
    const regNotes = regBuck?.notes || '';
    // Summarize notes — take first entry if append model
    const notesSummary = regNotes ? regNotes.split('\n---\n').slice(-3).map(e => e.replace(/^\[.+?\]\s*/, '')).join('; ') : '';
    const sightingNotes = bs.filter(s => s.notes).map(s => s.notes).slice(0, 3).join('; ');
    const cameras = [...new Set(bs.map(s => s.camera_name).filter(Boolean))];

    if(!hasPhotos) {
      bucksWithoutPhotos.push(name);
      return;
    }

    let profile = `${name}: ${bs.length} sightings, cameras: ${cameras.join(', ')}`;
    if(antlerDesc) profile += `\n  Antler description: ${antlerDesc}`;
    if(notesSummary) profile += `\n  Hunter notes: ${notesSummary}`;
    if(sightingNotes) profile += `\n  Field notes: ${sightingNotes}`;

    // Camera-specific history
    if(cameraName) {
      const camSightings = bs.filter(s => s.camera_name === cameraName);
      if(camSightings.length > 0) {
        profile += `\n  Confirmed at ${cameraName}: ${camSightings.length} sighting${camSightings.length > 1 ? 's' : ''}`;
      }
    }

    bucksWithPhotos.push(profile);
  });

  let result = bucksWithPhotos.join('\n\n');
  if(bucksWithoutPhotos.length) {
    result += `\n\nBucks excluded from matching (insufficient reference data — no confirmed photos): ${bucksWithoutPhotos.join(', ')}`;
  }

  // Camera context
  if(cameraName) {
    const confirmedAtCam = namedBucks.filter(name => {
      const bs = sightings.filter(s => s.buck_name === name && s.camera_name === cameraName);
      return bs.length > 0;
    });
    if(confirmedAtCam.length) {
      result = `This photo is from the ${cameraName} camera. Confirmed bucks at ${cameraName}: ${confirmedAtCam.map(n => {
        const cnt = sightings.filter(s => s.buck_name === n && s.camera_name === cameraName).length;
        return `${n} (${cnt} sighting${cnt > 1 ? 's' : ''})`;
      }).join(', ')}. Use this as a strong prior.\n\n` + result;
    } else {
      result = `This photo is from the ${cameraName} camera. No previously confirmed bucks at this camera.\n\n` + result;
    }
  }

  return { profiles: result, hasBucks: bucksWithPhotos.length > 0 };
}

var AI_VISUAL_REASONING_PROMPT = `Before naming a buck, describe what you observe:
- Approximate point count
- Tine length relative to ears
- Spread relative to body width
- Any distinctive features (drop tines, stickers, kickers)
- Body size and estimated age class
Then compare these observations against the reference photos and known buck descriptions.

Priority order for identification:
1. VISUAL MATCH against reference photos is the PRIMARY signal
2. Camera location history is a SECONDARY signal that can support or slightly adjust confidence
3. Never let camera history override a strong visual match

If the reference photos strongly suggest Buck A but camera history suggests Buck B, report Buck A with a note: "Strong visual match to Buck A — less common at this camera but antler configuration matches closely."

Do not weight your suggestion based on which buck has the most historical sightings. Base your identification purely on visual characteristics observed in the photos.`;

// --- Reference Photo Comparison for AI Identification ---
var refPhotoCache = null; // { buckId: [{url, base64, mediaType}], ... }

async function urlToBase64(url) {
  const response = await fetch(url);
  const blob = await response.blob();
  const mediaType = blob.type || 'image/jpeg';
  const base64 = await new Promise(resolve => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(blob);
  });
  return { base64, mediaType };
}

async function getBuckReferencePhotos() {
  // Return cached if available
  if(refPhotoCache) return refPhotoCache;

  const cache = {};
  try {
    // Priority 1: Photos confirmed via ai_feedback (was_correct = true)
    const { data: confirmed } = await sb.from('ai_feedback')
      .select('hunter_confirmed_buck_id, photo_url')
      .eq('property_id', PROPERTY_ID)
      .eq('was_correct', true)
      .not('photo_url', 'is', null)
      .not('hunter_confirmed_buck_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if(confirmed) {
      confirmed.forEach(row => {
        const bid = row.hunter_confirmed_buck_id;
        if(!cache[bid]) cache[bid] = [];
        if(cache[bid].length < 3 && !cache[bid].some(p => p.url === row.photo_url)) {
          cache[bid].push({ url: row.photo_url, base64: null, mediaType: null });
        }
      });
    }

    // Priority 2: Fallback from sightings for bucks with < 3 confirmed photos
    // Match by buck_id OR buck_name to catch older sightings before buck_id was added
    for(const buck of buckRegistry) {
      if(!cache[buck.id]) cache[buck.id] = [];
      if(cache[buck.id].length >= 3) continue;
      const needed = 3 - cache[buck.id].length;
      const existingUrls = new Set(cache[buck.id].map(p => p.url));
      const buckSightings = sightings
        .filter(s => (s.buck_id === buck.id || s.buck_name === buck.name) && s.image_url && !existingUrls.has(s.image_url))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .slice(0, needed);
      buckSightings.forEach(s => {
        cache[buck.id].push({ url: s.image_url, base64: null, mediaType: null });
      });
    }
  } catch(e) {
    console.error('getBuckReferencePhotos error:', e);
  }

  refPhotoCache = cache;
  console.log('Reference photos loaded:', Object.entries(refPhotoCache).map(([buckId, photos]) => ({
    buckName: buckRegistry.find(b => b.id === buckId)?.name,
    photoCount: photos.length,
    urls: photos.map(p => p.url)
  })));
  return cache;
}

function invalidateRefPhotoCache() {
  refPhotoCache = null;
}

// Build multi-image content array with reference photos for AI identification
// cameraName: prioritize bucks seen at this camera
// Returns { content: [...imageBlocks], refCount: number }
async function buildRefPhotoContent(cameraName) {
  const refPhotos = await getBuckReferencePhotos();
  const content = [];
  let refCount = 0;

  // Score bucks for prioritization: camera-relevant first, then by sighting count
  const scored = buckRegistry
    .filter(b => refPhotos[b.id] && refPhotos[b.id].length > 0)
    .map(buck => {
      const camSightings = cameraName
        ? sightings.filter(s => (s.buck_id === buck.id || s.buck_name === buck.name) && s.camera_name === cameraName).length
        : 0;
      const totalSightings = sightings.filter(s => s.buck_id === buck.id || s.buck_name === buck.name).length;
      return { buck, camRelevance: camSightings, total: totalSightings };
    })
    .sort((a, b) => b.camRelevance - a.camRelevance || b.total - a.total)
    .slice(0, 4); // Max 4 bucks with reference photos

  for(const { buck } of scored) {
    const photos = refPhotos[buck.id].slice(0, 2); // Max 2 photos per buck
    const desc = buck.antler_description || 'no description';

    // Pre-fetch base64 for photos that aren't cached yet
    const loaded = [];
    for(const photo of photos) {
      try {
        if(!photo.base64) {
          const result = await urlToBase64(photo.url);
          photo.base64 = result.base64;
          photo.mediaType = result.mediaType;
        }
        loaded.push(photo);
      } catch(e) {
        console.warn('Failed to fetch ref photo for', buck.name, e);
      }
    }
    if(loaded.length === 0) continue;

    content.push({ type: 'text', text: `Reference photos for ${buck.name} (${desc}):` });
    for(const photo of loaded) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: photo.mediaType, data: photo.base64 }
      });
      refCount++;
    }
  }

  return { content, refCount };
}

// --- data -
async function loadSightings() {
  if(onboardingMode) return;
  syncDot(true);
  const {data, error} = await sb.from('sightings').select('*')
    .eq('property_id', PROPERTY_ID)
    .order('date', {ascending:false})
    .order('time', {ascending:false});
  syncDot(false);
  if(error) {
    console.error('Load error:', error);
    document.getElementById('intelContent').innerHTML =
      `<div class="loading" style="color:#e87a4a">Could not load data.<br/><small>${error.message}</small></div>`;
    return;
  }
  sightings = data || [];
  window._sightingsLoaded = true;
  console.log('[loadSightings] complete — loaded', sightings.length, 'sightings, _sightingsLoaded:', window._sightingsLoaded);
  renderDash(); renderLog(); buildMapFilters(); buildMapLegend(); refreshBucknameList();
  refreshMapPins();
}

// compressImage loaded from /js/utils.js

async function uploadPhoto(file, sightingId) {
  if(!file) return null;
  try {
    file = await compressImage(file);
    const path = 'sightings/' + sightingId + '.jpg';
    const {error} = await sb.storage.from('trail-cam-photos').upload(path, file, {upsert:true, contentType: 'image/jpeg'});
    if(error) { console.error('Upload error:', error); return null; }
    const {data} = sb.storage.from('trail-cam-photos').getPublicUrl(path);
    return data.publicUrl;
  } catch(e) {
    console.error('uploadPhoto exception:', e);
    return null;
  }
}

async function submitSighting() {
  const btn = document.getElementById("sbtn");
  const d = document.querySelector(".chip[data-k='deer'].on");
  if(!d) return;

  if(logMode === 'camera') {
    const c = document.querySelector(".chip[data-k='cam'].on");
    if(!c) return;
  }

  btn.textContent = "Saving..."; btn.classList.remove("rdy"); btn.classList.add("dis");
  const beh = document.querySelector(".chip[data-k='beh'].on");
  const wx = wxApplied || {};
  const buckNameVal = document.getElementById("fbuckname").value.trim() || null;
  const buckId = buckNameVal ? await resolveBuckId(buckNameVal) : null;

  let newSighting;

  if(logMode === 'camera') {
    const c = document.querySelector(".chip[data-k='cam'].on");
    newSighting = {
      source: 'camera',
      date: document.getElementById("fd").value,
      time: document.getElementById("ft").value + ":00",
      camera_name: c.dataset.v,
      deer_type: d.dataset.v,
      behavior: beh ? beh.dataset.v : null,
      buck_name: buckNameVal,
      buck_id: buckId,
      wind_dir: document.getElementById("fwind").value || null,
      temp_f: parseFloat(document.getElementById("ftemp").value) || null,
      wind_speed: wx.windSpeed ? parseFloat(wx.windSpeed) : null,
      wind_gust: wx.windGust ? parseFloat(wx.windGust) : null,
      humidity: wx.humidity ? parseInt(wx.humidity) : null,
      precip: wx.precip ? parseFloat(wx.precip) : null,
      pressure: wx.pressure ? parseFloat(wx.pressure) : null,
      notes: document.getElementById("fnotes").value || null,
      travel_dir: (() => { const t = document.querySelector(".chip[data-k='tdir'].on"); return t ? t.dataset.v : null; })(),
      image_url: null,
      moon_phase: document.getElementById("mlbl").textContent,
      property_id: PROPERTY_ID,
    };
  } else {
    // Field observation
    newSighting = {
      source: 'observation',
      date: document.getElementById("fd").value,
      time: document.getElementById("ft").value + ":00",
      camera_name: null,
      deer_type: d.dataset.v,
      behavior: beh ? beh.dataset.v : null,
      buck_name: buckNameVal,
      buck_id: buckId,
      wind_dir: document.getElementById("fwind").value || null,
      temp_f: parseFloat(document.getElementById("ftemp").value) || null,
      wind_speed: wx.windSpeed ? parseFloat(wx.windSpeed) : null,
      wind_gust: wx.windGust ? parseFloat(wx.windGust) : null,
      humidity: wx.humidity ? parseInt(wx.humidity) : null,
      precip: wx.precip ? parseFloat(wx.precip) : null,
      pressure: wx.pressure ? parseFloat(wx.pressure) : null,
      notes: document.getElementById("fnotes").value || null,
      travel_dir: null,
      image_url: null,
      moon_phase: document.getElementById("mlbl").textContent,
      obs_lat: obsLatLng ? obsLatLng.lat : null,
      obs_lng: obsLatLng ? obsLatLng.lng : null,
      property_id: PROPERTY_ID,
    };
  }

  syncDot(true);
  const {data, error} = await sb.from('sightings').insert(newSighting).select().single();
  syncDot(false);
  if(error) {
    console.error('Insert error:', error);
    btn.textContent = "Error: " + error.message.slice(0,35);
    btn.classList.add("rdy"); btn.classList.remove("dis");
    const modeLabel = logMode === 'camera' ? 'Log Camera Sighting' : 'Log Field Observation';
    setTimeout(() => { btn.textContent = modeLabel; checkSub(); }, 3000);
    return;
  }
  // Upload photo (camera mode only)
  if(logMode === 'camera' && formImgFile) {
    try {
      syncDot(true);
      const url = await uploadPhoto(formImgFile, data.id);
      syncDot(false);
      if(url) {
        await sb.from('sightings').update({image_url: url}).eq('id', data.id);
        data.image_url = url;
      }
    } catch(photoErr) {
      syncDot(false);
      console.error('Photo upload failed (sighting saved):', photoErr);
    }
  }
  // Remove obs pin if it was placed
  if(obsPinDropMarker) { obsPinDropMarker.remove(); obsPinDropMarker = null; }
  obsLatLng = null;

  sightings.unshift(data);
  if(buckId && data.date) updateBuckDates(buckId, data.date);
  // Reset form
  formImgFile = null; wxApplied = null;
  document.getElementById("fnotes").value = "";
  document.getElementById("ftemp").value = "";
  document.getElementById("fwind").value = "";
  document.getElementById("finput").value = "";
  document.getElementById("fbuckname").value = "";
  document.getElementById("uprev").style.display = "none";
  document.getElementById("uph").style.display = "block";
  document.getElementById("aiHintBox").style.display = "none";
  document.querySelectorAll(".chip").forEach(c => c.classList.remove("on"));
  btn.textContent = "Saved!";
  const savedMode = logMode;
  setTimeout(() => {
    curFilter = "all";
    closeSheet('log');
    showToast(savedMode === 'camera' ? 'Camera sighting logged!' : 'Field observation logged!');
  }, 1200);
  refreshMapPins(); refreshBucknameList(); renderDash();
}

async function saveEdit() {
  const s = sightings.find(x => x.id === editId); if(!s) return;
  const editBuckName = document.getElementById("eBuckName").value.trim() || null;
  const editBuckId = editBuckName ? await resolveBuckId(editBuckName) : null;
  const updates = {
    buck_name: editBuckName,
    buck_id: editBuckId,
    deer_type: document.getElementById("eDeerType").value,
    camera_name: document.getElementById("eCamera").value,
    date: document.getElementById("eDate").value,
    time: document.getElementById("eTime").value + ":00",
    behavior: document.getElementById("eBehavior").value || null,
    notes: document.getElementById("eNotes").value || null,
  };
  if(editImgChanged && editImgFile) {
    try {
      const url = await uploadPhoto(editImgFile, editId);
      if(url) updates.image_url = url;
    } catch(e) { console.error('Edit photo failed:', e); }
  }
  syncDot(true);
  const {error} = await sb.from('sightings').update(updates).eq('id', editId);
  syncDot(false);
  if(error) { showToast('Save failed: ' + error.message); return; }
  Object.assign(s, updates);
  if(editBuckId && s.date) updateBuckDates(editBuckId, s.date);
  document.getElementById("editModal").style.display = "none";
  renderLog(); renderDash(); refreshMapPins(); buildMapFilters(); buildMapLegend();
}

async function deleteSighting() {
  const ok = await showConfirmModal('Delete this sighting? This cannot be undone.', 'Delete', 'danger');
  if(!ok) return;
  syncDot(true);
  await sb.from('sightings').delete().eq('id', editId);
  syncDot(false);
  sightings = sightings.filter(x => x.id !== editId);
  document.getElementById("editModal").style.display = "none";
  renderLog(); renderDash(); refreshMapPins(); buildMapFilters(); buildMapLegend();
}

// --- edit modal -
function openEdit(id) {
  const s = sightings.find(x => x.id === id); if(!s) return;
  editId = id; editImgChanged = false; editImgFile = null;
  document.getElementById("eBuckName").value = s.buck_name || "";
  document.getElementById("eDeerType").value = s.deer_type || "Unknown";
  document.getElementById("eCamera").value = s.camera_name || "Other";
  document.getElementById("eDate").value = s.date || "";
  document.getElementById("eTime").value = (s.time || "").slice(0,5);
  document.getElementById("eBehavior").value = s.behavior || "";
  document.getElementById("eNotes").value = s.notes || "";
  const pw = document.getElementById("ePhotoWrap");
  pw.innerHTML = s.image_url
    ? `<img src="${s.image_url}" style="width:100%;height:140px;object-fit:cover;border-radius:6px"/>`
    : `<div style="font-size:11px;color:#4A4D4E;font-style:italic">No photo attached</div>`;
  document.getElementById("editModal").style.display = "flex";
}
function closeModal(e) {
  if(e.target === document.getElementById("editModal"))
    document.getElementById("editModal").style.display = "none";
}
function handleEditPhoto(inp) {
  const f = inp.files[0]; if(!f) return;
  editImgFile = f; editImgChanged = true;
  const r = new FileReader();
  r.onload = e => { document.getElementById("ePhotoWrap").innerHTML = `<img src="${e.target.result}" style="width:100%;height:140px;object-fit:cover;border-radius:6px"/>`; };
  r.readAsDataURL(f);
}

// Sighting form weather (autoWx, fetchWx, applyWx) loaded from /js/weather.js


var curSightFeed = 'cams'; // 'cams' or 'notes'
var curSightView = 'feed'; // kept for backwards compat with setSightView calls
var sightPageSize = 20;
var sightShowCount = 20;
var sfFiltersVisible = false;
var sfDateMode = '30d'; // '30d' = last 30 days default, 'custom' = user changed filters

function setSightView(v) {
  // Backwards compat — called from viewAllBuckSightings
  curSightView = 'feed';
  sfDateMode = 'custom'; // coming from dossier = show all time
  renderLog();
}

function setSightFeed(feed) {
  curSightFeed = feed;
  sightShowCount = sightPageSize;
  document.getElementById('sfToggleCams')?.classList.toggle('on', feed === 'cams');
  document.getElementById('sfToggleNotes')?.classList.toggle('on', feed === 'notes');
  renderLog();
}

function toggleSightFilters() {
  sfFiltersVisible = !sfFiltersVisible;
  const el = document.getElementById('sightFilters');
  if(el) el.style.display = sfFiltersVisible ? 'flex' : 'none';
  if(sfFiltersVisible) sfDateMode = 'custom';
}

function getSightingsFiltered() {
  let base = sightings.slice();
  const yr = document.getElementById('sfYear')?.value || 'all';
  const mo = document.getElementById('sfMonth')?.value || 'all';
  const deer = document.getElementById('sfDeer')?.value || 'all';
  // Default 30-day filter when no custom filters set
  if(sfDateMode === '30d' && yr === 'all' && mo === 'all') {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutStr = cutoff.toISOString().slice(0,10);
    base = base.filter(s => s.date && s.date >= cutStr);
  } else {
    if(yr !== 'all') base = base.filter(s => s.date && s.date.startsWith(yr));
    if(mo !== 'all') base = base.filter(s => s.date && s.date.slice(5,7) === mo);
  }
  if(deer === 'does') base = base.filter(s => s.deer_type && (s.deer_type === 'Doe' || s.deer_type === 'Fawn'));
  else if(deer === 'bucks') base = base.filter(s => s.deer_type && s.deer_type.includes('Buck'));
  else if(deer === 'unnamed') base = base.filter(s => s.deer_type && s.deer_type.includes('Buck') && !s.buck_name);
  else if(deer !== 'all') base = base.filter(s => s.buck_name === deer);
  return base;
}

function buildSightFilters() {
  const yrSel = document.getElementById('sfYear');
  if(!yrSel) return;
  const years = [...new Set(sightings.map(s => s.date?.slice(0,4)).filter(Boolean))].sort();
  const curYrVal = yrSel.value;
  yrSel.innerHTML = '<option value="all">All Years</option>' + years.map(y => `<option value="${y}"${curYrVal===y?' selected':''}>${y}</option>`).join('');
  const deerSel = document.getElementById('sfDeer');
  if(!deerSel) return;
  const curDeerVal = deerSel.value;
  const bucks = getNamedBucks().sort();
  deerSel.innerHTML = `<option value="all">All Deer</option>
    <option value="does">Does &amp; Fawns</option>
    <option value="bucks">All Bucks</option>
    <option value="unnamed">Unknown Bucks</option>
    <option disabled>\u2500\u2500 Named Bucks \u2500\u2500</option>
    ${bucks.map(b => `<option value="${b}"${curDeerVal===b?' selected':''}>${b}</option>`).join('')}`;
  if(curDeerVal) deerSel.value = curDeerVal;
}

function updateFilterPill() {
  const lbl = document.getElementById('sfFilterLabel');
  if(!lbl) return;
  const yr = document.getElementById('sfYear')?.value || 'all';
  const mo = document.getElementById('sfMonth')?.value || 'all';
  const deer = document.getElementById('sfDeer')?.value || 'all';
  const parts = [];
  if(sfDateMode === '30d' && yr === 'all' && mo === 'all') {
    parts.push('Last 30 days');
  } else if(yr !== 'all' || mo !== 'all') {
    const MNAMES = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    if(mo !== 'all' && yr !== 'all') parts.push(MNAMES[parseInt(mo)] + ' ' + yr);
    else if(yr !== 'all') parts.push(yr);
    else if(mo !== 'all') parts.push(MNAMES[parseInt(mo)]);
  } else {
    parts.push('All time');
  }
  if(deer !== 'all') {
    if(deer === 'does') parts.push('Does & Fawns');
    else if(deer === 'bucks') parts.push('All Bucks');
    else if(deer === 'unnamed') parts.push('Unknown Bucks');
    else parts.push(deer);
  }
  lbl.textContent = parts.join(' \u00B7 ') + (sfDateMode === '30d' && yr === 'all' && mo === 'all' && deer === 'all' ? ' \u00B7 tap to change' : '');
}

function sightBuckTap(buckName, e) {
  e.stopPropagation();
  if(!buckName) return;
  const bId = buckIdByName(buckName);
  closeSheet('sightings');
  setTimeout(() => {
    openSheet('intel');
    if(bId) setTimeout(() => openBuckDossier(bId), 300);
  }, 200);
}

function toggleFieldNote(el) {
  const notes = el.closest('.fn-card')?.querySelector('.fn-notes');
  if(!notes) return;
  notes.classList.toggle('expanded');
  el.textContent = notes.classList.contains('expanded') ? 'Show less' : 'Tap to expand';
}

function loadMoreSightings() {
  sightShowCount += sightPageSize;
  renderLog();
}

function renderLog() {
  const sl = document.getElementById("slist");
  if(!sl) return;
  // Guard: never render until loadSightings() has completed
  if(!window._sightingsLoaded) {
    console.log('[renderLog] BLOCKED — sightings not loaded yet');
    sl.innerHTML = '<div class="loading"><div class="spinner"></div><br/>Loading...</div>';
    return;
  }
  console.log('[renderLog] rendering — sightings:', sightings.length, 'feed:', curSightFeed, 'dateMode:', sfDateMode);
  buildSightFilters();
  updateFilterPill();
  const allFiltered = getSightingsFiltered();

  if(curSightFeed === 'cams') {
    renderTrailCamFeed(allFiltered, sl);
  } else {
    renderFieldNotesFeed(allFiltered, sl);
  }
}

function renderTrailCamFeed(allFiltered, sl) {
  console.log('[renderTrailCamFeed] called, sightings:', sightings.length, '_sightingsLoaded:', !!window._sightingsLoaded);
  if(!window._sightingsLoaded) {
    console.log('[renderTrailCamFeed] BLOCKED — data not ready');
    sl.innerHTML = '<div class="loading"><div class="spinner"></div><br/>Loading...</div>';
    return;
  }
  // All camera sightings (with or without photos)
  const camSightings = allFiltered
    .filter(s => s.source === 'camera' || !s.source)
    .sort((a,b) => ((b.date||'')+(b.time||'00:00')).localeCompare((a.date||'')+(a.time||'00:00')));
  const totalCam = sightings.filter(s => s.source === 'camera' || !s.source).length;
  console.log('[renderTrailCamFeed] rendering:', { total: sightings.length, filtered: allFiltered.length, camSightings: camSightings.length, showing: Math.min(camSightings.length, sightShowCount) });

  if(!camSightings.length) {
    sl.innerHTML = `<div class="sf-empty">${totalCam === 0
      ? 'No trail cam sightings yet \u2014 tap + to log your first sighting'
      : 'No trail cam sightings in the last 30 days \u2014 log a sighting or adjust your date filter'}</div>`;
    return;
  }

  const camPlaceholder = '<div class="tc-thumb-placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="4"/><path d="M17 8h.01"/></svg></div>';

  const visible = camSightings.slice(0, sightShowCount);
  const cards = visible.map(s => {
    const eName = s.buck_name ? s.buck_name.replace(/'/g, "\\'") : '';
    const buckHtml = s.buck_name
      ? `<span class="tc-buck" style="color:#8C7355" onclick="sightBuckTap('${eName}',event)">${s.buck_name}</span>`
      : `<span style="color:var(--text3);font-size:12px">Untagged</span>`;
    const thumbHtml = s.image_url
      ? `<img class="tc-thumb" src="${s.image_url}" alt="" loading="lazy"/>`
      : camPlaceholder;
    return `<div class="tc-card" onclick="showDet(${s.id})">
      ${thumbHtml}
      <div class="tc-info">
        <div class="tc-top">
          <div style="min-width:0">${buckHtml}</div>
          <div class="tc-cam">${s.camera_name || ''}</div>
        </div>
        <div class="tc-date">${fmtD(s.date)}${s.time ? ' \u00B7 '+fmtT(s.time) : ''}</div>
        <div class="tc-pills">
          ${s.behavior ? `<span class="tc-pill tc-pill-beh">${s.behavior}</span>` : ''}
          ${(s.temp_f || s.wind_dir) ? `<span class="tc-pill tc-pill-wx">${s.temp_f ? s.temp_f+'\u00B0F' : ''}${s.temp_f && s.wind_dir ? ' ' : ''}${s.wind_dir || ''}</span>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');

  let html = `<div class="tc-feed-grid">${cards}</div>`;
  if(camSightings.length > sightShowCount) {
    html += `<div style="padding:0 14px"><button class="sf-load-more" onclick="loadMoreSightings()">Load more (${camSightings.length - sightShowCount} remaining)</button></div>`;
  }
  sl.innerHTML = html;
}

function renderFieldNotesFeed(allFiltered, sl) {
  if(!window._sightingsLoaded) {
    sl.innerHTML = '<div class="loading"><div class="spinner"></div><br/>Loading...</div>';
    return;
  }
  const fieldSightings = allFiltered
    .filter(s => s.source === 'observation')
    .sort((a,b) => ((b.date||'')+(b.time||'00:00')).localeCompare((a.date||'')+(a.time||'00:00')));
  const totalField = sightings.filter(s => s.source === 'observation').length;

  if(!fieldSightings.length) {
    sl.innerHTML = `<div class="sf-empty">${totalField === 0
      ? 'No field observations yet \u2014 tap + to log your first field note'
      : 'No field observations in this date range \u2014 adjust your date filter'}</div>`;
    return;
  }

  const visible = fieldSightings.slice(0, sightShowCount);
  const deerSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="1.3" stroke-linecap="round"><path d="M12 20 L12 14"/><path d="M12 14 L9 10 L7 7 L5 5"/><path d="M9 10 L7 12"/><path d="M7 7 L5 9"/><path d="M12 14 L15 10 L17 7 L19 5"/><path d="M15 10 L17 12"/><path d="M17 7 L19 9"/></svg>';

  let html = visible.map(s => {
    const bc = s.buck_name ? buckColor(s.buck_name) : null;
    const eName = s.buck_name ? s.buck_name.replace(/'/g, "\\'") : '';
    const buckHtml = s.buck_name
      ? `<span class="fn-buck" style="color:#8C7355" onclick="sightBuckTap('${eName}',event)">${s.buck_name}</span>`
      : `<span style="color:var(--text3);font-size:12px">${s.deer_type || 'Observation'}</span>`;
    const hasNotes = s.notes && s.notes.length > 0;
    return `<div class="fn-card" onclick="showDet(${s.id})">
      <div class="fn-icon">${deerSvg}</div>
      <div class="fn-body">
        ${buckHtml}
        <div class="fn-meta">${fmtD(s.date)}${s.time ? ' \u00B7 '+fmtT(s.time) : ''}${s.obs_lat ? ' \u00B7 GPS' : ''}</div>
        <div class="tc-pills" style="margin-top:4px">
          ${s.behavior ? `<span class="tc-pill tc-pill-beh">${s.behavior}</span>` : ''}
          ${(s.temp_f || s.wind_dir) ? `<span class="tc-pill tc-pill-wx">${s.temp_f ? s.temp_f+'\u00B0F' : ''}${s.temp_f && s.wind_dir ? ' ' : ''}${s.wind_dir || ''}</span>` : ''}
        </div>
        ${hasNotes ? `<div class="fn-notes">${s.notes}</div><span class="fn-expand" onclick="event.stopPropagation();toggleFieldNote(this)">Tap to expand</span>` : ''}
      </div>
    </div>`;
  }).join('');

  if(fieldSightings.length > sightShowCount) {
    html += `<button class="sf-load-more" onclick="loadMoreSightings()">Load more (${fieldSightings.length - sightShowCount} remaining)</button>`;
  }
  sl.innerHTML = html;
}

function setFilt(f) { curFilter = f; sfDateMode = 'custom'; renderLog(); }

function showSightMenu(sightingId, btnEl) {
  // Remove any existing menu
  const existing = document.getElementById('scActionMenu');
  if(existing) { existing.remove(); return; }
  const s = sightings.find(x => x.id === sightingId);
  if(!s) return;
  const menu = document.createElement('div');
  menu.id = 'scActionMenu';
  menu.className = 'sc-action-menu';
  // Use the button element directly for reliable positioning
  const btn = (typeof btnEl === 'object' && btnEl.getBoundingClientRect) ? btnEl : null;
  const rect = btn ? btn.getBoundingClientRect() : {bottom: 100, right: 100};
  const menuTop = Math.min(rect.bottom + 4, window.innerHeight - 120);
  const menuRight = window.innerWidth - rect.right - 4;
  menu.style.cssText = `position:fixed;top:${menuTop}px;right:${menuRight}px;z-index:600;`;
  // Build menu items
  const items = [
    {
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
      label: 'Edit sighting',
      action: `openEdit(${sightingId})`
    },
  ];
  // View Activity only for named bucks
  if(s.buck_name) {
    items.push({
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="14" width="4" height="8" rx="1"/><rect x="9" y="9" width="4" height="13" rx="1"/><rect x="16" y="4" width="4" height="18" rx="1"/></svg>',
      label: `${s.buck_name} intel`,
      action: `viewBuckActivity('${buckIdByName(s.buck_name) || ''}')`
    });
  }
  menu.innerHTML = items.map(item =>
    `<div class="sc-action-item" onclick="event.stopPropagation();document.getElementById('scActionMenu')?.remove();setTimeout(()=>{${item.action}},10)">
      ${item.icon}
      <span>${item.label}</span>
    </div>`
  ).join('');
  document.body.appendChild(menu);
  // Close on outside tap — must check target is outside the menu
  setTimeout(() => {
    document.addEventListener('click', function closeMenu(e) {
      if(!document.getElementById('scActionMenu')?.contains(e.target)) {
        document.getElementById('scActionMenu')?.remove();
        document.removeEventListener('click', closeMenu);
      }
    });
  }, 50);
}

function viewBuckActivity(buckId) {
  const buckName = buckNameById(buckId) || buckId;
  intelBuck = buckName;
  closeSheet('sightings');
  setTimeout(() => {
    openSheet('intel');
    setTimeout(() => {
      const cards = document.querySelectorAll('.bi-hdr');
      cards.forEach(card => {
        const nameEl = card.querySelector('div[style*="font-size:15px"]');
        if(nameEl && nameEl.textContent.trim() === buckName) {
          const body = card.nextElementSibling;
          if(body && !body.classList.contains('open')) card.click();
          card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }, 400);
  }, 300);
}

// ORPHANED — Profiles button removed from Sightings tab (Phase 1 Buck Intelligence, Apr 2026).

function renderProfiles(fil, sl) {
  const bucks = getNamedBucks().sort();
  let html = '';

  // Named buck cards
  if(bucks.length) {
    const deerFilter = document.getElementById('sfDeer')?.value || 'all';
    const showBucks = ['all','bucks','unnamed'].includes(deerFilter) || bucks.includes(deerFilter);
    if(showBucks) {
      const filteredBucks = deerFilter !== 'all' && bucks.includes(deerFilter)
        ? [deerFilter]
        : bucks;
      const buckSights = filteredBucks.filter(b => fil.some(s => s.buck_name === b));
      if(buckSights.length) {
        html += `<div class="group-hdr">Named Bucks</div>`;
        buckSights.forEach(bname => {
          const bs = fil.filter(s => s.buck_name === bname);
          if(!bs.length) return;
          const recent = bs.sort((a,b_) => b_.date?.localeCompare(a.date) || 0)[0];
          const recentImg = bs.find(s => s.image_url)?.image_url;
          const bc = buckColor(bname);
          const bId = buckIdByName(bname);
          const lastCam = recent.camera_name || '--';
          const lastDate = recent.date ? fmtD(recent.date) : '--';
          const lastTime = recent.time ? fmtT(recent.time) : '';
          html += `<div class="profile-card" data-buck-id="${bId || ''}" onclick="openBuckProfile('${bId}')" style="border-left:3px solid ${bc}">
            ${recentImg
              ? `<img class="profile-thumb" src="${recentImg}" alt="${bname}"/>`
              : `<div class="profile-thumb-placeholder"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${bc}" stroke-width="1.5" stroke-linecap="round"><path d="M12 20 L12 14"/><path d="M12 14 L9 10 L7 7 L5 5"/><path d="M9 10 L7 12"/><path d="M7 7 L5 9"/><path d="M12 14 L15 10 L17 7 L19 5"/><path d="M15 10 L17 12"/><path d="M17 7 L19 9"/></svg></div>`}
            <div class="profile-info">
              <div class="profile-name" style="color:${bc}">${bname}</div>
              <div class="profile-sub">${recent.deer_type || 'Buck'}</div>
              <div class="profile-last">Last seen: ${lastCam} &middot; ${lastDate}${lastTime ? ' ' + lastTime : ''}</div>
            </div>
            <div>
              <div class="profile-count">${bs.length}</div>
              <div class="profile-count-lbl">sightings</div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2" stroke-linecap="round" style="margin-top:6px"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>`;
        });
      }
    }
  }

  // Unknown bucks group
  const deerFilter2 = document.getElementById('sfDeer')?.value || 'all';
  const unknownBucks = fil.filter(s => s.deer_type && s.deer_type.includes('Buck') && !s.buck_name);
  if(unknownBucks.length && ['all','bucks','unnamed'].includes(deerFilter2)) {
    const recentUnk = unknownBucks.sort((a,b_) => b_.date?.localeCompare(a.date) || 0)[0];
    const unkImg = unknownBucks.find(s => s.image_url)?.image_url;
    html += `<div class="group-hdr">Unknown Bucks</div>`;
    html += `<div class="profile-card" onclick="openUnknownBucks()">
      ${unkImg
        ? `<img class="profile-thumb" src="${unkImg}" alt="Unknown Buck"/>`
        : `<div class="profile-thumb-placeholder"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="1.5" stroke-linecap="round"><path d="M12 20 L12 14"/><path d="M12 14 L9 10 L7 7 L5 5"/><path d="M9 10 L7 12"/><path d="M7 7 L5 9"/><path d="M12 14 L15 10 L17 7 L19 5"/><path d="M15 10 L17 12"/><path d="M17 7 L19 9"/></svg></div>`}
      <div class="profile-info">
        <div class="profile-name">Unknown Bucks</div>
        <div class="profile-sub">Unidentified · ${[...new Set(unknownBucks.map(s=>s.camera_name))].length} cameras</div>
        <div class="profile-last">Last seen: ${recentUnk.camera_name} &middot; ${fmtD(recentUnk.date)}</div>
      </div>
      <div>
        <div class="profile-count">${unknownBucks.length}</div>
        <div class="profile-count-lbl">sightings</div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2" stroke-linecap="round" style="margin-top:6px"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </div>`;
  }

  // Does & Fawns group
  const doesFawns = fil.filter(s => s.deer_type === 'Doe' || s.deer_type === 'Fawn');
  if(doesFawns.length && ['all','does'].includes(deerFilter2)) {
    const recentDoe = doesFawns.sort((a,b_) => b_.date?.localeCompare(a.date) || 0)[0];
    const doeImg = doesFawns.find(s => s.image_url)?.image_url;
    // Daytime % (10am-4pm) - bedding indicator
    const daytime = doesFawns.filter(s => { const h = parseInt(s.time||'0'); return h>=10&&h<16; }).length;
    const daytimePct = doesFawns.length ? Math.round(daytime/doesFawns.length*100) : 0;
    html += `<div class="group-hdr">Does &amp; Fawns</div>`;
    html += `<div class="profile-card" onclick="openDoeGroup()">
      ${doeImg
        ? `<img class="profile-thumb" src="${doeImg}" alt="Doe"/>`
        : `<div class="profile-thumb-placeholder"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="1.5" stroke-linecap="round"><ellipse cx="12" cy="14" rx="6" ry="5"/><path d="M9 9 L7 6 M15 9 L17 6"/></svg></div>`}
      <div class="profile-info">
        <div class="profile-name">Does &amp; Fawns</div>
        <div class="profile-sub">${[...new Set(doesFawns.map(s=>s.camera_name))].length} cameras &middot; <span style="color:${daytimePct>40?'var(--sulfur)':'var(--text3)'};">${daytimePct}% daytime</span>${daytimePct>40?' &#9888;':''}</div>
        <div class="profile-last">Last seen: ${recentDoe.camera_name} &middot; ${fmtD(recentDoe.date)}</div>
      </div>
      <div>
        <div class="profile-count">${doesFawns.length}</div>
        <div class="profile-count-lbl">sightings</div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2" stroke-linecap="round" style="margin-top:6px"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </div>`;
  }

  if(!html) html = `<div style="text-align:center;color:#4A4D4E;padding:40px;font-size:13px">No sightings found</div>`;
  sl.innerHTML = html;
}

// ORPHANED — Only called from renderProfiles() which is no longer reachable (Profiles button removed).
// Buck dossier sheet (openBuckDossier) replaces this. Scheduled for cleanup in index.html split phase.
function openBuckProfile(buckId) {
  const regBuck = buckRegistry.find(b => b.id === buckId);
  const bname = regBuck ? regBuck.name : null;
  if(!bname) return;
  const bc = buckColor(bname);
  const bs = sightings.filter(s => s.buck_name === bname).sort((a,b) => (b.date||'').localeCompare(a.date||''));
  if(!bs.length) return;

  document.getElementById('bpName').textContent = bname;
  document.getElementById('bpName').style.color = bc;

  // Store current buck ID on the overlay for internal use
  document.getElementById('bpOverlay').dataset.buckId = buckId;

  // --- Antler Description (below name) ---
  let html = `<div class="bp-section">
    <div class="bp-section-title"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><path d="M12 20 L12 14"/><path d="M12 14 L9 10 L7 7 L5 5"/><path d="M9 10 L7 12"/><path d="M7 7 L5 9"/><path d="M12 14 L15 10 L17 7 L19 5"/><path d="M15 10 L17 12"/><path d="M17 7 L19 9"/></svg> Antler Description</div>
    <div class="bp-antler-wrap">
      <input type="text" class="bp-antler-input" id="bpAntlerDesc" placeholder="e.g. Drop tine left G2, sticker right beam, wide spread, dark tarsal glands" onblur="saveAntlerDescFromProfile()"/>
      <svg class="bp-antler-pencil" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2" stroke-linecap="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
    </div>
  </div>`;

  // --- Hunter's Notes (append model) ---
  html += `<div class="bp-section">
    <div class="bp-section-title"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Hunter's Notes</div>
    <textarea class="bp-notes-entry-input" id="bpNewNote" placeholder="Add a new observation..."></textarea>
    <button class="bp-save-btn" onclick="appendBuckNoteFromProfile()">Add Note</button>
    <div class="bp-notes-history" id="bpNotesHistory"></div>
  </div>`;

  // --- Stats ---
  const firstSeen = bs[bs.length - 1]?.date;
  const lastSeen = bs[0]?.date;
  const camCount = bs.filter(s => s.source === 'camera' || !s.source).length;
  const obsCount = bs.filter(s => s.source === 'observation').length;
  const ageClass = bs[0]?.deer_type || 'Buck';

  html += `<div class="bp-section">
    <div class="bp-section-title"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><path d="M12 20 L12 14"/><path d="M12 14 L9 10 L7 7"/><path d="M12 14 L15 10 L17 7"/></svg> Overview</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:10px">${ageClass}</div>
    <div class="bp-stat-grid">
      <div class="bp-stat"><div class="bp-stat-val">${bs.length}</div><div class="bp-stat-lbl">Total</div></div>
      <div class="bp-stat"><div class="bp-stat-val">${camCount}</div><div class="bp-stat-lbl">Camera</div></div>
      <div class="bp-stat"><div class="bp-stat-val">${obsCount}</div><div class="bp-stat-lbl">Field Obs</div></div>
    </div>
    <div style="display:flex;gap:16px;margin-top:10px;font-size:11px;color:var(--text3)">
      <span>First: ${fmtD(firstSeen)}</span><span>Last: ${fmtD(lastSeen)}</span>
    </div>
  </div>`;

  // --- Top Cameras ---
  const camCounts = {};
  bs.forEach(s => { if(s.camera_name) camCounts[s.camera_name] = (camCounts[s.camera_name]||0) + 1; });
  const topCams = Object.entries(camCounts).sort((a,b) => b[1] - a[1]).slice(0, 5);
  const maxCam = topCams[0]?.[1] || 1;
  if(topCams.length) {
    html += `<div class="bp-section">
      <div class="bp-section-title"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg> Top Cameras</div>
      ${topCams.map(([cam, cnt]) => `<div class="bp-bar-row">
        <div class="bp-bar-lbl">${cam}</div>
        <div class="bp-bar-track"><div class="bp-bar-fill" style="width:${Math.round(cnt/maxCam*100)}%;background:${bc}"></div></div>
        <div class="bp-bar-cnt">${cnt}</div>
      </div>`).join('')}
    </div>`;
  }

  // --- Activity by Hour (mini timeline) ---
  html += `<div class="bp-section">
    <div class="bp-section-title"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Activity by Hour</div>
    ${build24HrTimeline(bs, true)}
  </div>`;

  // --- Wind Rose ---
  const windCounts = {};
  bs.forEach(s => { if(s.wind_dir) windCounts[s.wind_dir] = (windCounts[s.wind_dir]||0) + 1; });
  const maxWind = Math.max(...Object.values(windCounts), 1);
  const topWinds = Object.entries(windCounts).sort((a,b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
  if(Object.keys(windCounts).length) {
    html += `<div class="bp-section">
      <div class="bp-section-title"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg> Wind Rose</div>
      ${buildWindRoseSVG(windCounts, maxWind, topWinds, 80)}
    </div>`;
  }

  // --- Behavior Breakdown ---
  const behCounts = {};
  bs.forEach(s => { if(s.behavior) behCounts[s.behavior] = (behCounts[s.behavior]||0) + 1; });
  const behEntries = Object.entries(behCounts).sort((a,b) => b[1] - a[1]);
  const maxBeh = behEntries[0]?.[1] || 1;
  if(behEntries.length) {
    html += `<div class="bp-section">
      <div class="bp-section-title"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> Behavior</div>
      ${behEntries.map(([beh, cnt]) => `<div class="bp-bar-row">
        <div class="bp-bar-lbl">${beh}</div>
        <div class="bp-bar-track"><div class="bp-bar-fill" style="width:${Math.round(cnt/maxBeh*100)}%;background:${bc}"></div></div>
        <div class="bp-bar-cnt">${cnt}</div>
      </div>`).join('')}
    </div>`;
  }

  // --- Seasonal Activity (monthly) ---
  const monthCounts = new Array(12).fill(0);
  bs.forEach(s => { if(s.date) { const m = parseInt(s.date.slice(5,7)) - 1; if(m >= 0 && m < 12) monthCounts[m]++; } });
  const maxMonth = Math.max(...monthCounts, 1);
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  html += `<div class="bp-section">
    <div class="bp-section-title"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Seasonal Activity</div>
    <div style="display:flex;gap:2px;align-items:flex-end;height:50px">
      ${monthCounts.map((cnt, i) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
        <div style="width:100%;background:${cnt ? bc : 'var(--border)'};height:${Math.max(2, Math.round(cnt/maxMonth*40))}px;border-radius:2px;opacity:${cnt ? 1 : 0.3}"></div>
        <div style="font-size:7px;color:var(--text3)">${MONTHS[i]}</div>
      </div>`).join('')}
    </div>
  </div>`;

  // --- Photos ---
  const photos = bs.filter(s => s.image_url).map(s => s.image_url);
  if(photos.length) {
    html += `<div class="bp-section">
      <div class="bp-section-title"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Photos (${photos.length})</div>
      <div class="bp-photo-grid">
        ${photos.slice(0, 12).map(url => `<img src="${url}" loading="lazy" onclick="window.open('${url}','_blank')"/>`).join('')}
      </div>
      ${photos.length > 12 ? `<div style="font-size:10px;color:var(--text3);margin-top:6px;text-align:center">+ ${photos.length - 12} more</div>` : ''}
    </div>`;
  }

  // --- Notes removed (now Hunter's Notes with append model above Overview) ---

  // --- Recent Sightings Feed ---
  const recent10 = bs.slice(0, 10);
  html += `<div class="bp-section">
    <div class="bp-section-title"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> Recent Sightings</div>
    ${recent10.map(s => `<div class="bp-feed-item">
      <div class="bp-feed-date">${fmtD(s.date)}</div>
      <div style="flex:1">${s.camera_name || 'Field Obs'} ${s.time ? '· ' + fmtT(s.time) : ''} ${s.behavior ? '· ' + s.behavior : ''}</div>
    </div>`).join('')}
  </div>`;

  document.getElementById('bpContent').innerHTML = html;

  // Load buck data (antler desc + notes) from bucks table by ID
  loadBuckData(buckId);

  document.getElementById('bpOverlay').classList.add('on');
}

function closeBuckProfile() {
  document.getElementById('bpOverlay').classList.remove('on');
}

async function loadBuckData(buckId) {
  try {
    const { data } = await sb.from('bucks').select('notes, antler_description').eq('id', buckId).maybeSingle();
    // Load antler description
    const ad = document.getElementById('bpAntlerDesc');
    if(ad && data?.antler_description) ad.value = data.antler_description;
    // Load notes history (append model — newline-separated timestamped entries)
    const hist = document.getElementById('bpNotesHistory');
    if(hist && data?.notes) {
      const entries = data.notes.split('\n---\n').filter(Boolean).reverse();
      hist.innerHTML = entries.map(e => {
        const tsMatch = e.match(/^\[(.+?)\]\s*/);
        const ts = tsMatch ? tsMatch[1] : '';
        const body = tsMatch ? e.slice(tsMatch[0].length) : e;
        return `<div class="bp-notes-entry">${ts ? `<div class="bp-notes-entry-ts">${ts}</div>` : ''}${body}</div>`;
      }).join('');
    }
  } catch(e) { /* silent */ }
}

// Wrapper called from onblur — reads buck ID from profile overlay
function saveAntlerDescFromProfile() {
  const buckId = document.getElementById('bpOverlay')?.dataset?.buckId;
  if(buckId) saveAntlerDesc(buckId);
}

async function saveAntlerDesc(buckId) {
  const val = document.getElementById('bpAntlerDesc')?.value || '';
  try {
    await sb.from('bucks').update({ antler_description: val }).eq('id', buckId);
    // Also update local registry cache
    const reg = buckRegistry.find(b => b.id === buckId);
    if(reg) reg.antler_description = val;
    showToast('Antler description saved');
  } catch(e) {
    showToast('Failed to save');
  }
}

// Wrapper called from onclick — reads buck ID from profile overlay
function appendBuckNoteFromProfile() {
  const buckId = document.getElementById('bpOverlay')?.dataset?.buckId;
  if(buckId) appendBuckNote(buckId);
}

async function appendBuckNote(buckId) {
  const input = document.getElementById('bpNewNote');
  const text = input?.value?.trim();
  if(!text) return;
  try {
    const { data } = await sb.from('bucks').select('notes').eq('id', buckId).maybeSingle();
    const ts = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const entry = `[${ts}] ${text}`;
    const updated = data?.notes ? data.notes + '\n---\n' + entry : entry;
    await sb.from('bucks').update({ notes: updated }).eq('id', buckId);
    // Update local cache
    const reg = buckRegistry.find(b => b.id === buckId);
    if(reg) reg.notes = updated;
    input.value = '';
    showToast('Note added');
    // Refresh notes display
    loadBuckData(buckId);
  } catch(e) {
    showToast('Failed to add note');
  }
}

function openUnknownBucks() {
  const deerSel = document.getElementById('sfDeer');
  if(deerSel) deerSel.value = 'unnamed';
  setSightView('feed');
  showSightBack('Unknown Bucks');
}

// ── Bulk Resolve Unknown Bucks ────────────────────────────────────────────────
var bulkQueue = [];
var bulkIdx = 0;
var bulkMatchResult = null;
var bulkAiFullResult = null;

function startBulkResolve() {
  bulkQueue = sightings.filter(s => s.deer_type && s.deer_type.includes('Buck') && !s.buck_name && s.image_url);
  if(bulkQueue.length === 0) { showToast('No unknown bucks with photos'); return; }
  bulkIdx = 0;
  bulkMatchResult = null;
  showBulkResolveModal();
}

function showBulkResolveModal() {
  let modal = document.getElementById('bulkResolveModal');
  if(!modal) {
    modal = document.createElement('div');
    modal.id = 'bulkResolveModal';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'z-index:500';
    modal.onclick = function(e) { if(e.target === modal) closeBulkResolve(); };
    modal.innerHTML = `<div class="modal-sheet" onclick="event.stopPropagation()" style="max-height:88vh;overflow-y:auto">
      <div style="width:36px;height:4px;background:var(--border2);border-radius:2px;margin:0 auto 16px"></div>
      <div class="modal-hdr">
        <div style="font-size:15px;font-weight:600;color:var(--text);display:flex;align-items:center;gap:8px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          Bulk ID
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <span id="bulkProgress" style="font-size:11px;color:var(--text3)"></span>
          <button class="modal-x" onclick="closeBulkResolve()">&#215;</button>
        </div>
      </div>
      <img id="bulkImg" style="width:100%;max-height:220px;object-fit:cover;border-radius:10px;margin-bottom:10px" alt=""/>
      <div id="bulkInfo" style="font-size:11px;color:var(--text3);margin-bottom:10px"></div>
      <div id="bulkAiResult" style="min-height:64px;padding:10px 12px;background:rgba(74,127,193,0.08);border:1px solid rgba(74,127,193,0.2);border-radius:10px;margin-bottom:12px;font-size:12px;color:var(--text)">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px">AI Buck ID</div>
        <span id="bulkAiText">Analyzing photo...</span>
        <div id="bulkAiReason" style="font-size:10px;color:var(--text3);margin-top:4px;font-style:italic"></div>
      </div>
      <div id="bulkAcceptRow" style="display:none;margin-bottom:8px">
        <button id="bulkAcceptBtn" onclick="bulkAcceptMatch()" style="width:100%;padding:11px;border:none;border-radius:10px;background:var(--gold);color:var(--bg);font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font)">Accept Match</button>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <input id="bulkNameInput" type="text" placeholder="Enter buck name..." list="bucknamelist"
          style="flex:1;padding:9px 12px;border-radius:10px;border:1px solid var(--border2);background:var(--bg);color:var(--text);font-size:13px;font-family:var(--font);outline:none"/>
        <button onclick="bulkSaveName()" style="padding:9px 16px;border-radius:10px;border:1px solid var(--bronze);background:transparent;color:var(--bronze);font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font)">Save</button>
      </div>
      <button onclick="bulkSkip()" style="width:100%;padding:9px;border-radius:10px;border:1px solid var(--border2);background:transparent;color:var(--text3);font-size:12px;cursor:pointer;font-family:var(--font)">Skip</button>
    </div>`;
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';

  const s = bulkQueue[bulkIdx];
  bulkMatchResult = null;
  document.getElementById('bulkProgress').textContent = `${bulkIdx + 1} of ${bulkQueue.length}`;
  document.getElementById('bulkImg').src = s.image_url;
  document.getElementById('bulkInfo').textContent = `${s.camera_name || 'Unknown camera'} · ${fmtD(s.date)} · ${s.deer_type}`;
  document.getElementById('bulkAiText').textContent = 'Analyzing photo...';
  document.getElementById('bulkAiReason').textContent = '';
  document.getElementById('bulkAcceptRow').style.display = 'none';
  document.getElementById('bulkNameInput').value = '';

  runBulkAi(s);
}

async function runBulkAi(s) {
  const namedBucks = getNamedBucks();
  if(namedBucks.length === 0) {
    document.getElementById('bulkAiText').textContent = 'No named bucks yet — enter a name below.';
    return;
  }
  try {
    const camContext = s.camera_name || null;
    const { profiles: buckProfiles, hasBucks } = buildAiBuckProfiles(camContext);
    if(!hasBucks) {
      const aiTextEl = document.getElementById('bulkAiText');
      if(aiTextEl) aiTextEl.textContent = 'No named bucks with reference photos — enter a name below.';
      return;
    }

    const aiTextEl0 = document.getElementById('bulkAiText');
    if(aiTextEl0) aiTextEl0.textContent = 'Loading reference images...';

    const imgResp = await fetch(s.image_url);
    const imgBlob = await imgResp.blob();
    const base64 = await new Promise(res => {
      const reader = new FileReader();
      reader.onloadend = () => res(reader.result);
      reader.readAsDataURL(imgBlob);
    });
    const b64data = base64.split(',')[1];
    const mediaType = base64.split(';')[0].split(':')[1];

    // Build content with reference photos
    let refContent = [];
    try { const r = await buildRefPhotoContent(camContext); refContent = r.content; } catch(e) { /* fallback to text-only */ }

    if(aiTextEl0) aiTextEl0.textContent = 'Comparing against known bucks...';

    const content = [];
    if(refContent.length > 0) {
      content.push({ type: 'text', text: 'Reference photos of known bucks:' });
      content.push(...refContent);
      content.push({ type: 'text', text: `Now identify this photo. Compare antlers against the reference photos above.\n\n${AI_VISUAL_REASONING_PROMPT}\n\nAdditional context:\n\n${buckProfiles}\n\nRespond in JSON only, no other text:\n{"match": "buck name or null if no match", "confidence": 0-100, "reasoning": "one sentence about antler characteristics that match or don't match"}` });
      content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: b64data } });
    } else {
      content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: b64data } });
      content.push({ type: 'text', text: `You are analyzing a trail camera photo for a deer hunting app.\n\n${AI_VISUAL_REASONING_PROMPT}\n\nKnown bucks on this property:\n\n${buckProfiles}\n\nRespond in JSON only, no other text:\n{"match": "buck name or null if no match", "confidence": 0-100, "reasoning": "one sentence about antler characteristics that match or don't match"}` });
    }

    const response = await claudeFetch({
        model: 'claude-sonnet-4-5',
        max_tokens: 500,
        messages: [{ role: 'user', content }]
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const cleaned = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleaned);

    const aiTextEl = document.getElementById('bulkAiText');
    const aiReasonEl = document.getElementById('bulkAiReason');
    const acceptRow = document.getElementById('bulkAcceptRow');
    const acceptBtn = document.getElementById('bulkAcceptBtn');

    if(!aiTextEl) return; // modal closed
    bulkAiFullResult = result;

    const bulkConfColor = result.confidence > 80 ? '#4caf50' : result.confidence >= 50 ? '#f5a623' : '#e53935';
    if(result.confidence < 40) {
      bulkMatchResult = null;
      aiTextEl.innerHTML = `<span style="color:#e53935">Unable to confidently identify</span>`;
      aiReasonEl.textContent = result.reasoning || 'Please tag manually.';
      acceptRow.style.display = 'none';
    } else if(result.match && result.confidence >= 40) {
      bulkMatchResult = result.match;
      aiTextEl.innerHTML = `${result.match} — <span style="color:${bulkConfColor}">${result.confidence}%</span>`;
      aiReasonEl.textContent = result.reasoning || '';
      if(result.confidence < 50) aiReasonEl.textContent += ' (Low confidence — verify carefully)';
      acceptBtn.textContent = `Accept: ${result.match}`;
      acceptRow.style.display = 'block';
      document.getElementById('bulkNameInput').value = result.match;
    } else {
      bulkMatchResult = null;
      aiTextEl.textContent = 'No confident match found';
      aiReasonEl.textContent = result.reasoning || 'Could not identify from known bucks.';
      acceptRow.style.display = 'none';
    }
  } catch(e) {
    console.error('Bulk AI failed:', e);
    const aiTextEl = document.getElementById('bulkAiText');
    if(aiTextEl) aiTextEl.textContent = 'AI unavailable — enter name manually.';
  }
}

async function bulkAcceptMatch() {
  if(!bulkMatchResult) return;
  await bulkSaveNameValue(bulkMatchResult);
}

async function bulkSaveName() {
  const name = document.getElementById('bulkNameInput')?.value.trim();
  if(!name) { showToast('Enter a buck name'); return; }
  await bulkSaveNameValue(name);
}

async function bulkSaveNameValue(name) {
  const s = bulkQueue[bulkIdx];
  if(!s) return;
  const bulkBuckId = name ? await resolveBuckId(name) : null;
  const { error } = await sb.from('sightings').update({ buck_name: name, buck_id: bulkBuckId }).eq('id', s.id);
  if(error) { showToast('Save failed: ' + error.message); return; }
  const local = sightings.find(x => x.id === s.id);
  if(local) { local.buck_name = name; local.buck_id = bulkBuckId; }
  if(bulkBuckId && local && local.date) updateBuckDates(bulkBuckId, local.date);
  // Log AI feedback
  if(bulkAiFullResult || name) {
    const aiSugg = bulkAiFullResult?.match || null;
    const wasCorrect = aiSugg && aiSugg === name;
    await writeAiFeedback({
      photoUrl: s.image_url, cameraName: s.camera_name,
      aiSuggestion: aiSugg, aiConfidence: bulkAiFullResult?.confidence,
      aiReasoning: bulkAiFullResult?.reasoning,
      confirmedBuckId: bulkBuckId, confirmedBuckName: name, wasCorrect
    });
    bulkAiFullResult = null;
  }
  showToast(`Saved: ${name}`);
  refreshBucknameList();
  buildMapFilters();
  buildMapLegend();
  bulkIdx++;
  if(bulkIdx >= bulkQueue.length) {
    closeBulkResolve();
    renderLog();
    showToast('Bulk ID complete');
    return;
  }
  showBulkResolveModal();
}

function bulkSkip() {
  bulkIdx++;
  if(bulkIdx >= bulkQueue.length) {
    closeBulkResolve();
    renderLog();
    showToast('Bulk ID complete');
    return;
  }
  showBulkResolveModal();
}

function closeBulkResolve() {
  const modal = document.getElementById('bulkResolveModal');
  if(modal) modal.style.display = 'none';
  bulkQueue = [];
  bulkIdx = 0;
  bulkMatchResult = null;
}

function openDoeGroup() {
  const deerSel = document.getElementById('sfDeer');
  if(deerSel) deerSel.value = 'does';
  setSightView('feed');
  showSightBack('Does & Fawns');
}

function showSightBack(label) {
  // Add back button to sheet header
  const hdr = document.querySelector('#sheet-sightings .sheet-hdr');
  if(!hdr) return;
  let back = document.getElementById('sightBackBtn');
  if(!back) {
    back = document.createElement('button');
    back.id = 'sightBackBtn';
    back.style.cssText = 'background:none;border:none;color:var(--bronze);font-size:12px;cursor:pointer;display:flex;align-items:center;gap:4px;padding:0;font-family:var(--font);flex-shrink:0';
    back.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>`;
    back.onclick = () => {
      const deerSel = document.getElementById('sfDeer');
      if(deerSel) deerSel.value = 'all';
      setSightView('profiles');
      back.remove();
    };
    // Insert before the title
    hdr.insertBefore(back, hdr.firstChild);
  }
  back.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>`;
}

// ── AI Buck Matching ──────────────────────────────────────────────────────────


function whoIsThis(sightingId) {
  const s = sightings.find(x => x.id === sightingId);
  if(!s || !s.image_url) return;
  showWhoIsThisModal(sightingId, s.image_url);
}

function showWhoIsThisModal(sightingId, imageUrl) {
  let modal = document.getElementById("whoModal");
  if(!modal) {
    modal = document.createElement("div");
    modal.id = "whoModal";
    modal.className = "modal-overlay";
    modal.style.display = "flex";
    modal.innerHTML = `<div class="modal-sheet" onclick="event.stopPropagation()" style="max-height:88vh;overflow-y:auto">
      <div style="width:36px;height:4px;background:var(--border2);border-radius:2px;margin:0 auto 16px"></div>
      <div class="modal-hdr"><div style="font-size:15px;font-weight:600;color:var(--text)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-1px;margin-right:6px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        Who is this buck?</div>
        <button class="modal-x" onclick="document.getElementById('whoModal').style.display='none'">&#215;</button>
      </div>
      <img id="whoImg" style="width:100%;max-height:200px;object-fit:cover;border-radius:10px;margin-bottom:12px"/>
      <div id="whoResult" style="min-height:80px"></div>
      <div id="whoActions" style="display:none;margin-top:10px"></div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", e => { if(e.target===modal) modal.style.display="none"; });
  }
  modal.style.display = "flex";
  document.getElementById("whoImg").src = imageUrl;
  document.getElementById("whoResult").innerHTML = `<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px">
    <div style="font-size:20px;margin-bottom:8px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="1.5" stroke-linecap="round" style="margin-bottom:8px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>Analyzing photo...</div>`;
  document.getElementById("whoActions").style.display = "none";
  document.getElementById("whoActions").innerHTML = "";
  modal.dataset.sightingId = sightingId;
  modal.dataset.imageUrl = imageUrl;
  runFullAiMatch(sightingId, imageUrl);
}

var whoMatchResult = null;

async function runFullAiMatch(sightingId, imageUrl) {
  const namedBucks = getNamedBucks();
  const result = document.getElementById("whoResult");
  const actions = document.getElementById("whoActions");
  whoMatchResult = null;

  if(namedBucks.length === 0) {
    result.innerHTML = `<div style="font-size:12px;color:var(--text3);padding:12px;font-style:italic">No named bucks to compare against yet. Log some sightings with buck names first.</div>`;
    return;
  }

  // Build enhanced buck profiles with antler descriptions, notes, camera context
  // Determine camera context from the sighting
  const thisSighting = sightings.find(s => s.id === sightingId);
  const camContext = thisSighting?.camera_name || null;
  const { profiles: buckProfiles, hasBucks } = buildAiBuckProfiles(camContext);

  if(!hasBucks) {
    result.innerHTML = `<div style="font-size:12px;color:var(--text3);padding:12px;font-style:italic">No named bucks with reference photos to compare against. Add photos to your named bucks first.</div>`;
    return;
  }

  try {
    // Fetch the new photo as base64
    result.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text3);font-size:12px">Loading reference images...</div>`;
    const imgResp = await fetch(imageUrl);
    const blob = await imgResp.blob();
    const base64 = await new Promise(res => {
      const r = new FileReader();
      r.onload = e => res(e.target.result.split(",")[1]);
      r.readAsDataURL(blob);
    });
    const mediaType = blob.type || "image/jpeg";

    // Build multi-image content with reference photos
    let refContent = [];
    let refCount = 0;
    try {
      const refResult = await buildRefPhotoContent(camContext);
      refContent = refResult.content;
      refCount = refResult.refCount;
    } catch(e) {
      console.warn('Reference photo fetch failed, falling back to text-only:', e);
    }

    result.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text3);font-size:12px">Comparing against known bucks${refCount > 0 ? ` (${refCount} reference photo${refCount > 1 ? 's' : ''})` : ''}...</div>`;

    // Build content array: reference photos first, then the new photo
    const content = [];
    if(refContent.length > 0) {
      content.push({ type: 'text', text: 'Here are confirmed reference photos of known bucks on this property. Study each buck\'s antler configuration carefully.' });
      content.push(...refContent);
      content.push({ type: 'text', text: `Now identify this new trail cam photo. Compare the antler configuration, tine count, brow tines, spread, and body profile against the reference photos above.

${AI_VISUAL_REASONING_PROMPT}

Additional context about known bucks:

${buckProfiles}

Respond in JSON only:
{"visual_observations": "2-3 sentences describing what you see — point count, tine length, spread, distinctive features, body size", "match": "exact buck name or null", "confidence": 0-100, "reasoning": "2-3 sentences comparing your visual observations to the reference photos and known buck descriptions", "antler_desc": "one sentence describing this buck's rack"}` });
      content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } });
    } else {
      // Fallback: text-only identification (no reference photos available)
      content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } });
      content.push({ type: 'text', text: `You are a deer hunting expert analyzing a trail camera photo.

${AI_VISUAL_REASONING_PROMPT}

Known bucks on this property:

${buckProfiles}

Respond in JSON only:
{"visual_observations": "2-3 sentences describing what you see — point count, tine length, spread, distinctive features, body size", "match": "exact buck name or null", "confidence": 0-100, "reasoning": "2-3 sentences comparing your visual observations to the known buck descriptions", "antler_desc": "one sentence describing this buck's rack"}` });
    }

    const response = await claudeFetch({
        model: "claude-sonnet-4-5",
        max_tokens: 700,
        messages: [{ role: "user", content }]
    });

    if(!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(`API ${response.status}: ${errData.error?.message || errData.error || response.statusText}`);
    }

    const data = await response.json();
    if(data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    const text = data.content?.[0]?.text || "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const res = JSON.parse(cleaned);
    whoMatchResult = res;

    const confColor = res.confidence > 80 ? "#4caf50" : res.confidence >= 50 ? "#f5a623" : "#e53935";
    const confLabel = res.confidence > 80 ? "High confidence" : res.confidence >= 50 ? "Moderate confidence" : "Low confidence";
    const confDot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${confColor};margin-right:4px;vertical-align:middle"></span>`;

    // Visual observations section
    const obsHtml = res.visual_observations ? `<div style="font-size:11px;color:var(--text2);line-height:1.5;margin-bottom:10px;padding:8px;background:rgba(140,115,85,0.08);border-radius:8px;border-left:3px solid var(--gold)"><strong style="color:var(--text)">AI observed:</strong> ${res.visual_observations}</div>` : "";

    if(res.confidence < 50 || !res.match) {
      // LOW confidence or no match — Tag New / Select Existing
      result.innerHTML = `${obsHtml}
        <div style="display:flex;align-items:center;gap:8px;padding:10px;background:rgba(229,57,53,0.08);border-radius:10px;border:1px solid rgba(229,57,53,0.2);margin-bottom:8px">
          ${confDot}<span style="font-size:13px;color:#e53935;font-weight:600">Unable to confidently identify</span>
        </div>
        <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:8px">${res.reasoning}</div>
        ${res.antler_desc ? `<div style="font-size:11px;color:var(--text3);font-style:italic;padding:8px;background:var(--bg);border-radius:8px;margin-bottom:8px">${res.antler_desc}</div>` : ""}`;
      actions.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px">
        <button class="aif-btn aif-btn-new" onclick="whoShowNewBuckForm()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Tag as New Buck
        </button>
        <button class="aif-btn aif-btn-wrong" onclick="whoShowBuckSelector()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          Select Existing Buck
        </button>
      </div>
      <div id="whoBuckSelector" style="display:none"></div>
      <div id="whoNewBuckForm" style="display:none"></div>`;
      actions.style.display = "block";
    } else {
      // MEDIUM or HIGH confidence — Confirm / Wrong / New
      const bc = buckColor(res.match);
      const lowConfWarn = res.confidence < 80 ? "" : "";
      result.innerHTML = `${obsHtml}
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding:10px;background:rgba(74,127,193,0.08);border-radius:10px;border:1px solid rgba(74,127,193,0.2)">
          <div style="width:36px;height:36px;border-radius:50%;background:#1a1a1a;border:2px solid ${bc};display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${bc}" stroke-width="1.5" stroke-linecap="round"><path d="M12 20 L12 14"/><path d="M12 14 L9 10 L7 7 L5 5"/><path d="M9 10 L7 12"/><path d="M7 7 L5 9"/><path d="M12 14 L15 10 L17 7 L19 5"/><path d="M15 10 L17 12"/><path d="M17 7 L19 9"/></svg>
          </div>
          <div>
            <div style="font-size:14px;font-weight:700;color:${bc}">${res.match}</div>
            <div style="font-size:11px;color:${confColor}">${confDot}${res.confidence}% — ${confLabel}</div>
          </div>
        </div>
        <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:8px">${res.reasoning}</div>
        ${res.antler_desc ? `<div style="font-size:11px;color:var(--text3);font-style:italic;padding:8px;background:var(--bg);border-radius:8px;margin-bottom:8px">${res.antler_desc}</div>` : ""}`;
      actions.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px">
        <button class="aif-btn aif-btn-confirm" id="whoConfirmBtn" onclick="whoConfirmMatch()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          Confirm — This is ${res.match}
        </button>
        <button class="aif-btn aif-btn-wrong" onclick="whoShowBuckSelector()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Wrong Buck
        </button>
        <button class="aif-btn aif-btn-new" onclick="whoShowNewBuckForm()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Buck
        </button>
      </div>
      <div id="whoBuckSelector" style="display:none"></div>
      <div id="whoNewBuckForm" style="display:none"></div>`;
      actions.style.display = "block";
    }
  } catch(e) {
    console.error("Full AI match failed:", e);
    result.innerHTML = `<div style="font-size:12px;color:var(--red);padding:12px">Analysis failed: ${e.message}<br/><span style="font-size:10px;color:var(--text3)">Check Vercel function logs for details.</span></div>`;
  }
}

// --- Who Is This: three-button actions ---
function whoGetContext() {
  const modal = document.getElementById("whoModal");
  const sightingId = parseInt(modal.dataset.sightingId);
  const imageUrl = modal.dataset.imageUrl || null;
  const s = sightings.find(x => x.id === sightingId);
  return { modal, sightingId, imageUrl, s };
}

function whoRefreshUI() {
  renderLog(); renderDash(); buildMapFilters(); buildMapLegend(); refreshBucknameList(); refreshMapPins();
}

// ✅ Confirm — AI was correct
async function whoConfirmMatch() {
  if(!whoMatchResult?.match) return;
  const { modal, sightingId, imageUrl, s } = whoGetContext();
  const btn = document.getElementById("whoConfirmBtn");
  if(btn) { btn.textContent = "Saving..."; btn.disabled = true; }
  const buckId = await resolveBuckId(whoMatchResult.match);
  const { error } = await sb.from("sightings").update({ buck_name: whoMatchResult.match, buck_id: buckId }).eq("id", sightingId);
  if(error) { showToast("Save failed: " + error.message); if(btn) { btn.textContent = "Confirm"; btn.disabled = false; } return; }
  if(s) { s.buck_name = whoMatchResult.match; s.buck_id = buckId; }
  if(buckId && s?.date) updateBuckDates(buckId, s.date);
  await writeAiFeedback({
    photoUrl: imageUrl, cameraName: s?.camera_name,
    aiSuggestion: whoMatchResult.match, aiConfidence: whoMatchResult.confidence,
    aiReasoning: whoMatchResult.visual_observations || whoMatchResult.reasoning,
    confirmedBuckId: buckId, confirmedBuckName: whoMatchResult.match, wasCorrect: true
  });
  modal.style.display = "none";
  whoRefreshUI();
  showToast("Sighting tagged as " + whoMatchResult.match);
}

// ✗ Wrong Buck — show selector
function whoShowBuckSelector() {
  const sel = document.getElementById("whoBuckSelector");
  const newForm = document.getElementById("whoNewBuckForm");
  if(newForm) newForm.style.display = "none";
  if(!sel) return;
  const namedBucks = getNamedBucks();
  let html = `<div style="font-size:12px;font-weight:600;color:var(--text);margin:10px 0 6px">Select the correct buck:</div><div class="aif-buck-list">`;
  namedBucks.forEach(name => {
    const regBuck = buckRegistry.find(b => b.name === name);
    const bId = regBuck ? regBuck.id : "";
    const bs = sightings.filter(x => x.buck_name === name);
    const photo = bs.find(x => x.image_url)?.image_url;
    const ageClass = bs[0]?.deer_type || "Buck";
    html += `<div class="aif-buck-item" onclick="whoSelectCorrectBuck('${bId}')">
      ${photo ? `<img class="aif-buck-thumb" src="${photo}" alt="${name}"/>` : `<div class="aif-buck-thumb-ph"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="1.5"><path d="M12 20 L12 14"/><path d="M12 14 L9 10 L7 7"/><path d="M12 14 L15 10 L17 7"/></svg></div>`}
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:${buckColor(name)}">${name}</div>
        <div style="font-size:10px;color:var(--text3)">${ageClass} &middot; ${bs.length} sighting${bs.length !== 1 ? 's' : ''}</div>
      </div>
    </div>`;
  });
  html += `</div>`;
  sel.innerHTML = html;
  sel.style.display = "block";
}

async function whoSelectCorrectBuck(buckId) {
  const { modal, sightingId, imageUrl, s } = whoGetContext();
  const regBuck = buckRegistry.find(b => b.id === buckId);
  if(!regBuck) return;
  const name = regBuck.name;
  const { error } = await sb.from("sightings").update({ buck_name: name, buck_id: buckId }).eq("id", sightingId);
  if(error) { showToast("Save failed: " + error.message); return; }
  if(s) { s.buck_name = name; s.buck_id = buckId; }
  if(s?.date) updateBuckDates(buckId, s.date);
  await writeAiFeedback({
    photoUrl: imageUrl, cameraName: s?.camera_name,
    aiSuggestion: whoMatchResult?.match || null, aiConfidence: whoMatchResult?.confidence,
    aiReasoning: whoMatchResult?.visual_observations || whoMatchResult?.reasoning,
    confirmedBuckId: buckId, confirmedBuckName: name, wasCorrect: false
  });
  modal.style.display = "none";
  whoRefreshUI();
  showToast("Correction saved — " + name);
}

// ➕ New Buck — show form
function whoShowNewBuckForm() {
  const form = document.getElementById("whoNewBuckForm");
  const sel = document.getElementById("whoBuckSelector");
  if(sel) sel.style.display = "none";
  if(!form) return;
  form.innerHTML = `<div class="aif-new-form">
    <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:8px">Add New Buck</div>
    <input type="text" class="aif-new-input" id="whoNewBuckName" placeholder="Buck name (required)"/>
    <select class="aif-new-input" id="whoNewBuckAge" style="padding:10px 12px">
      <option value="">Age class (optional)</option>
      <option value="Buck - Mature (4.5+)">Mature (4.5+)</option>
      <option value="Buck - 3.5">3.5 yr</option>
      <option value="Buck - 2.5">2.5 yr</option>
      <option value="Buck - 1.5">1.5 yr</option>
    </select>
    <button class="aif-btn aif-btn-confirm" onclick="whoSaveNewBuck()" style="margin-top:4px">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
      Save New Buck
    </button>
  </div>`;
  form.style.display = "block";
  setTimeout(() => document.getElementById("whoNewBuckName")?.focus(), 100);
}

async function whoSaveNewBuck() {
  const nameInput = document.getElementById("whoNewBuckName");
  const ageSelect = document.getElementById("whoNewBuckAge");
  const name = nameInput?.value?.trim();
  if(!name) { showToast("Name is required"); return; }
  const { modal, sightingId, imageUrl, s } = whoGetContext();
  const ageClass = ageSelect?.value || null;
  const newBuck = await createBuck(name);
  if(!newBuck) { showToast("Failed to create buck"); return; }
  const buckId = newBuck.id;
  const updateData = { buck_name: name, buck_id: buckId };
  if(ageClass) updateData.deer_type = ageClass;
  const { error } = await sb.from("sightings").update(updateData).eq("id", sightingId);
  if(error) { showToast("Save failed: " + error.message); return; }
  if(s) { s.buck_name = name; s.buck_id = buckId; if(ageClass) s.deer_type = ageClass; }
  if(s?.date) updateBuckDates(buckId, s.date);
  await writeAiFeedback({
    photoUrl: imageUrl, cameraName: s?.camera_name,
    aiSuggestion: whoMatchResult?.match || null, aiConfidence: whoMatchResult?.confidence,
    aiReasoning: whoMatchResult?.visual_observations || whoMatchResult?.reasoning,
    confirmedBuckId: buckId, confirmedBuckName: name, wasCorrect: false
  });
  modal.style.display = "none";
  whoRefreshUI();
  showToast("New buck " + name + " added");
}


// (Old showDet with hardcoded colors removed — using CSS variable version from line 9)


// --- Tap-to-place state ---
var tapToPlaceActive = false;
var tapToPlaceLngLat = null;
var tapToPlacePreviewMarker = null;
var ttpAfterConfirm = null; // optional callback after confirmTapToPlace — bypasses event type modal

function enterTapToPlaceModeAt(lng, lat) {
  tapToPlaceActive = true;
  if(!mapInstance) return;
  tapToPlaceLngLat = { lat: lat, lng: lng };
  if(tapToPlacePreviewMarker) { tapToPlacePreviewMarker.remove(); tapToPlacePreviewMarker = null; }
  const el = document.createElement('div');
  el.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:grab';
  el.innerHTML =
    '<div style="width:36px;height:44px;position:relative;display:flex;align-items:center;justify-content:center;animation:ttpGlow 1.4s ease-in-out infinite" id="ttpPinInner">' +
    '<svg style="position:absolute;top:0;left:0;width:100%;height:100%;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.8))" viewBox="0 0 36 44" fill="none">' +
    '<path d="M18 2C10.268 2 4 8.268 4 16c0 10 14 28 14 28s14-18 14-28C32 8.268 25.732 2 18 2z" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="3"/>' +
    '<path d="M18 2C10.268 2 4 8.268 4 16c0 10 14 28 14 28s14-18 14-28C32 8.268 25.732 2 18 2z" fill="#E5B53B" stroke="#f0c75a" stroke-width="1.5"/>' +
    '</svg>' +
    '<div style="position:relative;z-index:1;padding-bottom:10px">' +
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
    '</div></div>';
  tapToPlacePreviewMarker = new mapboxgl.Marker({ element: el, anchor: 'bottom', draggable: true })
    .setLngLat([lng, lat])
    .addTo(mapInstance);
  tapToPlacePreviewMarker.on('drag', () => {
    const pos = tapToPlacePreviewMarker.getLngLat();
    tapToPlaceLngLat = { lat: pos.lat, lng: pos.lng };
    const coordEl = document.getElementById('ttpLocCoords');
    if(coordEl) coordEl.textContent = pos.lat.toFixed(5) + ', ' + pos.lng.toFixed(5);
  });
  tapToPlacePreviewMarker.on('dragend', () => {
    const pos = tapToPlacePreviewMarker.getLngLat();
    tapToPlaceLngLat = { lat: pos.lat, lng: pos.lng };
    const coordEl = document.getElementById('ttpLocCoords');
    if(coordEl) coordEl.textContent = pos.lat.toFixed(5) + ', ' + pos.lng.toFixed(5);
  });
  // Show location confirm card
  const coordEl = document.getElementById('ttpLocCoords');
  if(coordEl) coordEl.textContent = lat.toFixed(5) + ', ' + lng.toFixed(5);
  document.getElementById('ttpLocModal').classList.add('on');
  // Pan map to the pin location
  mapInstance.panTo([lng, lat]);
}

function enterTapToPlaceMode() {
  tapToPlaceActive = true;
  if(!mapInstance) return;
  // Drop pulsating draggable pin immediately at map center — no tap needed
  const center = mapInstance.getCenter();
  tapToPlaceLngLat = { lat: center.lat, lng: center.lng };
  if(tapToPlacePreviewMarker) { tapToPlacePreviewMarker.remove(); tapToPlacePreviewMarker = null; }
  const el = document.createElement('div');
  el.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:grab';
  el.innerHTML =
    '<div style="width:36px;height:44px;position:relative;display:flex;align-items:center;justify-content:center;animation:ttpGlow 1.4s ease-in-out infinite" id="ttpPinInner">' +
    '<svg style="position:absolute;top:0;left:0;width:100%;height:100%;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.8))" viewBox="0 0 36 44" fill="none">' +
    '<path d="M18 2C10.268 2 4 8.268 4 16c0 10 14 28 14 28s14-18 14-28C32 8.268 25.732 2 18 2z" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="3"/>' +
    '<path d="M18 2C10.268 2 4 8.268 4 16c0 10 14 28 14 28s14-18 14-28C32 8.268 25.732 2 18 2z" fill="#E5B53B" stroke="#f0c75a" stroke-width="1.5"/>' +
    '</svg>' +
    '<div style="position:relative;z-index:1;padding-bottom:10px">' +
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
    '</div></div>';
  tapToPlacePreviewMarker = new mapboxgl.Marker({ element: el, anchor: 'bottom', draggable: true })
    .setLngLat([center.lng, center.lat])
    .addTo(mapInstance);
  // drag: live coord display update while user is dragging
  tapToPlacePreviewMarker.on('drag', () => {
    const pos = tapToPlacePreviewMarker.getLngLat();
    tapToPlaceLngLat = { lat: pos.lat, lng: pos.lng };
    const coordEl = document.getElementById('ttpLocCoords');
    if(coordEl) coordEl.textContent = pos.lat.toFixed(5) + ', ' + pos.lng.toFixed(5);
  });
  // dragend: authoritative final coord lock after release
  tapToPlacePreviewMarker.on('dragend', () => {
    const pos = tapToPlacePreviewMarker.getLngLat();
    tapToPlaceLngLat = { lat: pos.lat, lng: pos.lng };
    const coordEl = document.getElementById('ttpLocCoords');
    if(coordEl) coordEl.textContent = pos.lat.toFixed(5) + ', ' + pos.lng.toFixed(5);
  });
  // Show location confirm modal with initial center coordinates
  document.getElementById('ttpLocCoords').textContent =
    center.lat.toFixed(5) + ', ' + center.lng.toFixed(5);
  document.getElementById('ttpLocModal').classList.add('on');
}

function confirmTapToPlace() {
  // Lock in final coords and stop pulse — pin is now confirmed
  if(tapToPlacePreviewMarker) {
    const pos = tapToPlacePreviewMarker.getLngLat();
    tapToPlaceLngLat = { lat: pos.lat, lng: pos.lng };
    tapToPlacePreviewMarker.setDraggable(false);
    const inner = tapToPlacePreviewMarker.getElement().querySelector('#ttpPinInner');
    if(inner) { inner.style.animation = 'none'; inner.style.cursor = 'default'; }
  }
  document.getElementById('ttpLocModal').classList.remove('on');
  if(ttpAfterConfirm) {
    const cb = ttpAfterConfirm; ttpAfterConfirm = null; cb();
  } else {
    showEventTypeModal();
  }
}

function cancelTapToPlace() {
  tapToPlaceActive = false;
  tapToPlaceLngLat = null;
  ttpAfterConfirm = null;
  if(tapToPlacePreviewMarker) { tapToPlacePreviewMarker.remove(); tapToPlacePreviewMarker = null; }
  document.getElementById('ttpLocModal').classList.remove('on');
  document.getElementById('ttpTypeModal').classList.remove('on');
  if(ttpOnCancel) { const cb = ttpOnCancel; ttpOnCancel = null; cb(); }
}

function showEventTypeModal() {
  // Reset any previous card selection
  ['ttpOptCam','ttpOptObs','ttpOptMark'].forEach(id => {
    document.getElementById(id)?.classList.remove('sel');
  });
  document.getElementById('ttpTypeModal').classList.add('on');
}

function selectEventType(type) {
  document.getElementById('ttpTypeModal').classList.remove('on');
  if(type === 'camera') {
    openTtpAddCamModal();
  } else if(type === 'observation') {
    openTtpObsModal();
  } else {
    openTtpFeatureModal();
  }
}


// --- Field Observation modal state ---
var obsFormImgFile = null;
var obsFormLngLat = null;
var obsFormWxFetched = null;
var obsFormWxApplied = null;
var obsAiHintSugg = null;
var obsWxTimer = null;

function openTtpObsModal() {
  // Capture confirmed coords
  obsFormLngLat = tapToPlaceLngLat ? { lat: tapToPlaceLngLat.lat, lng: tapToPlaceLngLat.lng } : null;
  tapToPlaceActive = false;
  // Reset form state
  obsFormImgFile = null; obsFormWxFetched = null; obsFormWxApplied = null; obsAiHintSugg = null;
  document.getElementById('ttpObsPhotoPreview').style.display = 'none';
  document.getElementById('ttpObsPhotoPrompt').style.display = 'block';
  document.getElementById('ttpObsInput').value = '';
  document.getElementById('ttpObsAiHint').style.display = 'none';
  document.getElementById('ttpObsNotes').value = '';
  document.getElementById('ttpObsTemp').value = '';
  document.getElementById('ttpObsWind').value = '';
  document.getElementById('ttpObsBuckName').value = '';
  document.getElementById('ttpObsBuckDrop').style.display = 'none';
  document.getElementById('ttpObsBuckSection').style.display = 'none';
  // Pre-fill date/time
  const now = new Date();
  document.getElementById('ttpObsDate').value = now.toISOString().split('T')[0];
  document.getElementById('ttpObsTime').value = now.toTimeString().slice(0,5);
  // Coords display
  const ce = document.getElementById('ttpObsCoords');
  if(ce && obsFormLngLat) ce.textContent = obsFormLngLat.lat.toFixed(5) + ', ' + obsFormLngLat.lng.toFixed(5);
  // Wx display reset
  document.getElementById('obsWxLoad').style.display = 'block';
  document.getElementById('obsWxLoad').textContent = 'Fetching conditions...';
  document.getElementById('obsWxData').style.display = 'none';
  document.getElementById('obsWxStat').textContent = 'fetching...';
  document.getElementById('obsWxStat').style.color = '#4A4D4E';
  // Build chips
  obsInitChips();
  obsUpdateMoon();
  obsCheckSub();
  document.getElementById('ttpObsModal').classList.add('on');
  // Trigger weather after modal is visible
  setTimeout(() => obsAutoWx(), 50);
}

function obsInitChips() {
  const dRow = document.getElementById('ttpObsDeerRow');
  dRow.innerHTML = DTYPES.map(o =>
    `<button class="chip" data-v="${o}" onclick="obsPickDeer(this)">${o}</button>`
  ).join('');
  const bRow = document.getElementById('ttpObsBehRow');
  bRow.innerHTML = BEHS.map(o =>
    `<button class="chip" data-v="${o}" onclick="obsPickBeh(this)">${o}</button>`
  ).join('');
}

function obsPickDeer(btn) {
  document.querySelectorAll('#ttpObsDeerRow .chip').forEach(c => c.classList.remove('on'));
  btn.classList.add('on');
  const isBuck = btn.dataset.v && btn.dataset.v.includes('Buck');
  document.getElementById('ttpObsBuckSection').style.display = isBuck ? 'block' : 'none';
  // If switching away from buck, hide AI hint
  if(!isBuck) document.getElementById('ttpObsAiHint').style.display = 'none';
  // If switching to buck and a photo is already loaded, run AI hint
  if(isBuck && obsFormImgFile) {
    const prev = document.getElementById('ttpObsPhotoPreview');
    if(prev.src) obsRunAiHint(prev.src);
  }
  obsCheckSub();
}

function obsPickBeh(btn) {
  document.querySelectorAll('#ttpObsBehRow .chip').forEach(c => c.classList.remove('on'));
  btn.classList.add('on');
}

function obsCheckSub() {
  const btn = document.getElementById('ttpObsSaveBtn');
  if(!btn) return;
  const d = document.querySelector('#ttpObsDeerRow .chip.on');
  if(d) { btn.classList.remove('dis'); btn.classList.add('rdy'); }
  else { btn.classList.remove('rdy'); btn.classList.add('dis'); }
}

function obsAutoWx() {
  const d = document.getElementById('ttpObsDate').value;
  const t = document.getElementById('ttpObsTime').value;
  if(!d || !t) return;
  clearTimeout(obsWxTimer);
  obsWxTimer = setTimeout(() => obsFetchWx(d, t), 600);
}

async function obsFetchWx(date, time) {
  const load = document.getElementById('obsWxLoad');
  const wxd  = document.getElementById('obsWxData');
  const stat = document.getElementById('obsWxStat');
  load.style.display = 'block'; wxd.style.display = 'none';
  load.textContent = 'Fetching conditions...';
  stat.textContent = 'fetching...'; stat.style.color = '#4A4D4E';
  try {
    const h = parseInt(time.split(':')[0]);
    // Weather fix: date string comparison avoids midnight/timezone errors
    const todayStr = new Date().toISOString().split('T')[0];
    if(date > todayStr) { load.textContent = 'Future date -- no weather yet.'; return; }
    const diffDays = Math.floor((new Date(todayStr) - new Date(date)) / 86400000);
    let url, isArchive = (diffDays >= 5);
    if(isArchive) {
      url = 'https://archive-api.open-meteo.com/v1/archive?latitude=' + CLAT
          + '&longitude=' + CLNG + '&start_date=' + date + '&end_date=' + date
          + '&hourly=temperature_2m,relativehumidity_2m,precipitation,windspeed_10m,windgusts_10m,winddirection_10m,surface_pressure'
          + '&wind_speed_unit=mph&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=America%2FChicago';
    } else {
      url = 'https://api.open-meteo.com/v1/forecast?latitude=' + CLAT
          + '&longitude=' + CLNG
          + '&hourly=temperature_2m,relativehumidity_2m,precipitation,windspeed_10m,windgusts_10m,winddirection_10m,surface_pressure'
          + '&wind_speed_unit=mph&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=America%2FChicago'
          + '&past_days=5&forecast_days=1';
    }
    const r = await fetch(url); const j = await r.json();
    if(!j.hourly) throw new Error('no data');
    let hi = h;
    if(!isArchive) {
      const target = date + 'T' + String(h).padStart(2,'0') + ':00';
      hi = j.hourly.time.findIndex(t => t === target);
      if(hi === -1) throw new Error('hour not found');
    }
    obsFormWxFetched = {
      temp:     Math.round(j.hourly.temperature_2m[hi]),
      windSpd:  Math.round(j.hourly.windspeed_10m[hi]),
      windGst:  Math.round(j.hourly.windgusts_10m[hi]),
      windDir:  deg2dir(j.hourly.winddirection_10m[hi]),
      humid:    Math.round(j.hourly.relativehumidity_2m[hi]),
      precip:   j.hourly.precipitation[hi].toFixed(2),
      press:    Math.round(j.hourly.surface_pressure[hi]),
    };
    document.getElementById('obsWxT').textContent = obsFormWxFetched.temp + '\u00b0';
    document.getElementById('obsWxW').textContent = obsFormWxFetched.windSpd;
    document.getElementById('obsWxG').textContent = obsFormWxFetched.windGst;
    document.getElementById('obsWxD').textContent = obsFormWxFetched.windDir;
    document.getElementById('obsWxH').textContent = obsFormWxFetched.humid + '%';
    document.getElementById('obsWxP').textContent = obsFormWxFetched.precip + '"';
    document.getElementById('obsWxBp').textContent = obsFormWxFetched.press;
    document.getElementById('obsWxBpt').textContent =
      obsFormWxFetched.press > 1013 ? 'Rising' : obsFormWxFetched.press < 1005 ? 'Low' : 'Stable';
    stat.textContent = isArchive ? '(historical)' : '(recent data)';
    stat.style.color = '#7aaa6a';
    load.style.display = 'none'; wxd.style.display = 'block';
    // Auto-apply wind + temp
    document.getElementById('ttpObsTemp').value = obsFormWxFetched.temp;
    document.getElementById('ttpObsWind').value = obsFormWxFetched.windDir;
    obsFormWxApplied = obsFormWxFetched;
  } catch(e) {
    load.textContent = 'Weather unavailable -- enter manually below.';
    stat.textContent = 'unavailable'; stat.style.color = '#e87a4a';
    console.error('obsFetchWx:', e);
  }
}

function obsUpdateMoon() {
  const d = document.getElementById('ttpObsDate').value;
  if(!d) return;
  const m = moonPhase(d);
  const moonEmoji = {
    'New Moon':'🌑','Waxing Crescent':'🌒','First Quarter':'🌓',
    'Waxing Gibbous':'🌔','Full Moon':'🌕','Waning Gibbous':'🌖',
    'Last Quarter':'🌗','Waning Crescent':'🌘'
  };
  document.getElementById('ttpObsMoonIcon').innerHTML =
    `<span style="font-size:22px;line-height:1">${moonEmoji[m.l] || '🌙'}</span>`;
  document.getElementById('ttpObsMoonLbl').textContent = m.l;
}

function obsHandlePhoto(inp) {
  const f = inp.files[0]; if(!f) return;
  obsFormImgFile = f;
  const r = new FileReader();
  r.onload = e => {
    document.getElementById('ttpObsPhotoPrompt').style.display = 'none';
    const p = document.getElementById('ttpObsPhotoPreview');
    p.src = e.target.result; p.style.display = 'block';
    // AI hint only for buck variants
    const deerChip = document.querySelector('#ttpObsDeerRow .chip.on');
    const isBuck = deerChip && deerChip.dataset.v && deerChip.dataset.v.includes('Buck');
    if(isBuck) obsRunAiHint(e.target.result);
  };
  r.readAsDataURL(f);
}

var obsAiResult = null;
async function obsRunAiHint(base64DataUrl) {
  const namedBucks = getNamedBucks();
  if(namedBucks.length === 0) return;
  const hintBox = document.getElementById('ttpObsAiHint');
  const hintText = document.getElementById('ttpObsAiText');
  const hintReason = document.getElementById('ttpObsAiReason');
  const hintActions = document.getElementById('ttpObsAiActions');
  hintBox.style.display = 'block';
  hintText.textContent = 'Analyzing photo...';
  hintReason.textContent = '';
  hintActions.innerHTML = '';
  obsAiHintSugg = null;
  obsAiResult = null;
  try {
    const { profiles: buckProfiles, hasBucks } = buildAiBuckProfiles(null);
    if(!hasBucks) { hintText.textContent = 'No named bucks with photos to compare'; return; }
    const base64 = base64DataUrl.split(',')[1];
    const mediaType = base64DataUrl.split(';')[0].split(':')[1];

    // Fetch reference photos
    hintText.textContent = 'Loading reference images...';
    let refContent = [];
    try { const r = await buildRefPhotoContent(null); refContent = r.content; } catch(e) { /* fallback */ }
    hintText.textContent = 'Comparing against known bucks...';

    const content = [];
    if(refContent.length > 0) {
      content.push({ type: 'text', text: 'Reference photos of known bucks:' });
      content.push(...refContent);
      content.push({ type: 'text', text: `Now identify this photo. Compare antlers against the reference photos.\n\n${AI_VISUAL_REASONING_PROMPT}\n\nAdditional context:\n\n${buckProfiles}\n\nRespond in JSON only:\n{"match": "buck name or null", "confidence": 0-100, "reasoning": "one sentence about antler characteristics"}` });
      content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } });
    } else {
      content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } });
      content.push({ type: 'text', text: `You are analyzing a photo for a deer hunting app.\n\n${AI_VISUAL_REASONING_PROMPT}\n\nKnown bucks:\n\n${buckProfiles}\n\nRespond in JSON only:\n{"match": "buck name or null", "confidence": 0-100, "reasoning": "one sentence about antler characteristics"}` });
    }

    const response = await claudeFetch({
        model: 'claude-sonnet-4-5',
        max_tokens: 500,
        messages: [{ role: 'user', content }]
    });
    const data = await response.json();
    const cleaned = (data.content?.[0]?.text || '').replace(/```json|```/g,'').trim();
    const result = JSON.parse(cleaned);
    obsAiResult = result;
    const obsConfColor = result.confidence > 80 ? '#4caf50' : result.confidence >= 50 ? '#f5a623' : '#e53935';
    if(result.match && result.confidence >= 50) {
      obsAiHintSugg = result.match;
      hintText.innerHTML = `${result.match} — <span style="color:${obsConfColor}">${result.confidence}%</span>`;
      hintReason.textContent = result.reasoning;
      hintActions.innerHTML = `<button onclick="obsConfirmAiHint()" style="padding:8px 14px;border-radius:8px;border:none;background:#8C7355;color:#121415;font-size:11px;font-weight:600;cursor:pointer;font-family:var(--font)">&#10003; Confirm</button>
        <button onclick="obsWrongAiHint()" style="padding:8px 14px;border-radius:8px;border:none;background:#4A4D4E;color:#BCC6CC;font-size:11px;cursor:pointer;font-family:var(--font)">&#10007; Wrong</button>
        <button onclick="obsDismissAiHint()" style="padding:8px 14px;border-radius:8px;border:1px solid var(--border2);background:transparent;color:var(--text3);font-size:11px;cursor:pointer;font-family:var(--font)">Dismiss</button>`;
    } else {
      hintText.innerHTML = result.confidence < 40 ? '<span style="color:#e53935">Unable to confidently identify</span>' : 'No confident match';
      hintReason.textContent = result.reasoning || '';
      hintActions.innerHTML = `<button onclick="obsDismissAiHint()" style="padding:8px 14px;border-radius:8px;border:1px solid var(--border2);background:transparent;color:var(--text3);font-size:11px;cursor:pointer;font-family:var(--font)">Dismiss</button>`;
    }
  } catch(e) {
    hintText.textContent = 'AI analysis failed';
    console.error('obsRunAiHint:', e);
  }
}
function obsConfirmAiHint() {
  if(obsAiHintSugg) document.getElementById('ttpObsBuckName').value = obsAiHintSugg;
  document.getElementById('ttpObsAiHint').style.display = 'none';
}
function obsWrongAiHint() {
  obsAiHintSugg = null;
  document.getElementById('ttpObsAiHint').style.display = 'none';
  document.getElementById('ttpObsBuckName')?.focus();
}
function obsDismissAiHint() {
  document.getElementById('ttpObsAiHint').style.display = 'none';
  obsAiHintSugg = null;
  obsAiResult = null;
}

function filterObsBuckSugg(val) {
  const drop = document.getElementById('ttpObsBuckDrop');
  if(!drop) return;
  const bucks = getNamedBucks();
  const matches = val ? bucks.filter(b => b.toLowerCase().includes(val.toLowerCase())) : bucks;
  if(!val) { drop.style.display = 'none'; return; }
  let html = matches.map(b =>
    `<div onclick="selectObsBuckSugg('${b.replace(/'/g,"\\'")}');event.preventDefault()"
      style="padding:9px 14px;font-size:13px;color:var(--text2);cursor:pointer;border-bottom:1px solid var(--border);font-family:var(--font)"
      onmousedown="event.preventDefault()">${b}</div>`
  ).join('');
  const exactMatch = bucks.some(b => b.toLowerCase() === val.toLowerCase());
  if(val.trim() && !exactMatch) {
    html += `<div onclick="addNewBuckFromDropdown('${val.trim().replace(/'/g,"\\'")}','ttpObsBuckName');event.preventDefault()"
      style="padding:9px 14px;font-size:13px;color:var(--sulfur);cursor:pointer;font-family:var(--font);font-weight:600"
      onmousedown="event.preventDefault()">+ Add "${val.trim()}"</div>`;
  }
  if(!html) { drop.style.display = 'none'; return; }
  drop.innerHTML = html;
  drop.style.display = 'block';
}
function showObsBuckSugg() {
  const val = document.getElementById('ttpObsBuckName').value;
  if(!val) filterObsBuckSugg('');
}
function hideObsBuckSugg() {
  const drop = document.getElementById('ttpObsBuckDrop');
  if(drop) drop.style.display = 'none';
}
function selectObsBuckSugg(name) {
  document.getElementById('ttpObsBuckName').value = name;
  hideObsBuckSugg();
}

function obsMovePinClick() {
  document.getElementById('ttpObsModal').classList.remove('on');
  // cancelTapToPlace() cleans up the preview marker and restores overlays/cursor
  cancelTapToPlace();
  // After new pin confirmed, update coords and reopen modal (preserving form state)
  ttpAfterConfirm = () => {
    const newLoc = tapToPlaceLngLat ? { lat: tapToPlaceLngLat.lat, lng: tapToPlaceLngLat.lng } : obsFormLngLat;
    cancelTapToPlace(); // clean up new preview marker + state
    obsFormLngLat = newLoc;
    const ce = document.getElementById('ttpObsCoords');
    if(ce && obsFormLngLat) ce.textContent = obsFormLngLat.lat.toFixed(5) + ', ' + obsFormLngLat.lng.toFixed(5);
    document.getElementById('ttpObsModal').classList.add('on');
  };
  enterTapToPlaceMode();
}

function cancelTtpObs() {
  document.getElementById('ttpObsModal').classList.remove('on');
  if(tapToPlacePreviewMarker) { tapToPlacePreviewMarker.remove(); tapToPlacePreviewMarker = null; }
  tapToPlaceLngLat = null;
  obsFormLngLat = null;
  obsFormImgFile = null;
}

async function submitObsSighting() {
  const deer = document.querySelector('#ttpObsDeerRow .chip.on');
  if(!deer) return;
  const btn = document.getElementById('ttpObsSaveBtn');
  btn.textContent = 'Saving...'; btn.classList.remove('rdy'); btn.classList.add('dis');
  const beh = document.querySelector('#ttpObsBehRow .chip.on');
  const wx = obsFormWxApplied || {};
  const obsBuckName = document.getElementById('ttpObsBuckName').value.trim() || null;
  const obsBuckId = obsBuckName ? await resolveBuckId(obsBuckName) : null;
  const newSighting = {
    source: 'observation',
    date: document.getElementById('ttpObsDate').value,
    time: document.getElementById('ttpObsTime').value + ':00',
    camera_name: null,
    deer_type: deer.dataset.v,
    behavior: beh ? beh.dataset.v : null,
    buck_name: obsBuckName,
    buck_id: obsBuckId,
    wind_dir: document.getElementById('ttpObsWind').value || null,
    temp_f: parseFloat(document.getElementById('ttpObsTemp').value) || null,
    wind_speed: wx.windSpd != null ? wx.windSpd : null,
    wind_gust:  wx.windGst != null ? wx.windGst  : null,
    humidity:   wx.humid   != null ? wx.humid    : null,
    precip:     wx.precip  != null ? parseFloat(wx.precip) : null,
    pressure:   wx.press   != null ? wx.press    : null,
    notes: document.getElementById('ttpObsNotes').value || null,
    moon_phase: document.getElementById('ttpObsMoonLbl').textContent,
    obs_lat: obsFormLngLat ? obsFormLngLat.lat : null,
    obs_lng: obsFormLngLat ? obsFormLngLat.lng : null,
    image_url: null,
    property_id: PROPERTY_ID,
  };
  syncDot(true);
  const {data, error} = await sb.from('sightings').insert(newSighting).select().single();
  syncDot(false);
  if(error) {
    console.error('submitObsSighting error:', error);
    btn.textContent = 'Error: ' + error.message.slice(0,30);
    btn.classList.add('rdy'); btn.classList.remove('dis');
    setTimeout(() => { btn.textContent = 'Log Field Observation'; obsCheckSub(); }, 3000);
    return;
  }
  // Upload photo if present
  if(obsFormImgFile) {
    try {
      syncDot(true);
      const url = await uploadPhoto(obsFormImgFile, data.id);
      syncDot(false);
      if(url) { await sb.from('sightings').update({image_url: url}).eq('id', data.id); data.image_url = url; }
    } catch(e) { syncDot(false); console.error('Obs photo upload failed:', e); }
  }
  // Clean up
  if(tapToPlacePreviewMarker) { tapToPlacePreviewMarker.remove(); tapToPlacePreviewMarker = null; }
  tapToPlaceLngLat = null; obsFormLngLat = null; obsFormImgFile = null;
  document.getElementById('ttpObsModal').classList.remove('on');
  sightings.unshift(data);
  if(obsBuckId && data.date) updateBuckDates(obsBuckId, data.date);
  // Log AI feedback if AI was used
  if(obsAiResult && obsBuckName) {
    const wasCorrect = obsAiResult.match && obsAiResult.match === obsBuckName;
    await writeAiFeedback({
      photoUrl: data.image_url, cameraName: null,
      aiSuggestion: obsAiResult.match, aiConfidence: obsAiResult.confidence,
      aiReasoning: obsAiResult.reasoning,
      confirmedBuckId: obsBuckId, confirmedBuckName: obsBuckName, wasCorrect
    });
  }
  obsAiResult = null;
  btn.textContent = 'Log Field Observation'; obsCheckSub();
  refreshMapPins(); refreshBucknameList(); renderDash();
  showToast('Field observation logged!');
}


// --- Trail Cam Sighting Sheet ---
var tcamFormImgFile = null;
var tcamFormWxFetched = null;
var tcamFormWxApplied = null;
var tcamAiHintSugg = null;
var tcamSelectedCam = null;
var tcamCamDropOpen = false;
var tcamWxTimer = null;

function openTrailCamSheet() {
  openSheet('trail-cam');
}

function initTrailCamForm() {
  // Reset state
  tcamFormImgFile = null; tcamFormWxFetched = null; tcamFormWxApplied = null; tcamAiHintSugg = null;
  tcamSelectedCam = null; tcamCamDropOpen = false;
  // Reset UI
  document.getElementById('tcamPhotoPreview').style.display = 'none';
  document.getElementById('tcamPhotoPrompt').style.display = 'block';
  document.getElementById('tcamInput').value = '';
  document.getElementById('tcamAiHint').style.display = 'none';
  document.getElementById('tcamNotes').value = '';
  document.getElementById('tcamTemp').value = '';
  document.getElementById('tcamWind').value = '';
  document.getElementById('tcamBuckName').value = '';
  document.getElementById('tcamBuckDrop').style.display = 'none';
  document.getElementById('tcamBuckSection').style.display = 'none';
  document.getElementById('tcamCamDrop').style.display = 'none';
  document.getElementById('tcamAddNewSection').style.display = 'none';
  document.getElementById('tcamNewCamName').value = '';
  // Reset camera selector
  document.getElementById('tcamCamLabel').textContent = 'Select camera...';
  document.getElementById('tcamCamSel').classList.remove('has-val');
  // Pre-fill date/time
  const now = new Date();
  document.getElementById('tcamDate').value = now.toISOString().split('T')[0];
  document.getElementById('tcamTime').value = now.toTimeString().slice(0,5);
  // Weather display reset
  document.getElementById('tcamWxLoad').style.display = 'block';
  document.getElementById('tcamWxLoad').textContent = 'Fetching conditions...';
  document.getElementById('tcamWxData').style.display = 'none';
  document.getElementById('tcamWxStat').textContent = 'fetching...';
  document.getElementById('tcamWxStat').style.color = '#4A4D4E';
  // Build chips
  document.getElementById('tcamDeerRow').innerHTML = DTYPES.map(o =>
    `<button class="chip" data-v="${o}" onclick="tcamPickDeer(this)">${o}</button>`
  ).join('');
  document.getElementById('tcamBehRow').innerHTML = BEHS.map(o =>
    `<button class="chip" data-v="${o}" onclick="tcamPickBeh(this)">${o}</button>`
  ).join('');
  document.getElementById('tcamTravelRow').innerHTML = TRAVEL_DIRS.map(o =>
    `<button class="chip" data-v="${o}" onclick="tcamPickTravel(this)">${o}</button>`
  ).join('');
  tcamCheckSub();
  tcamUpdateMoon();
  setTimeout(() => tcamAutoWx(), 50);
}

function tcamPickDeer(btn) {
  document.querySelectorAll('#tcamDeerRow .chip').forEach(c => c.classList.remove('on'));
  btn.classList.add('on');
  const isBuck = btn.dataset.v && btn.dataset.v.includes('Buck');
  document.getElementById('tcamBuckSection').style.display = isBuck ? 'block' : 'none';
  if(!isBuck) document.getElementById('tcamAiHint').style.display = 'none';
  if(isBuck && tcamFormImgFile) {
    const prev = document.getElementById('tcamPhotoPreview');
    if(prev.src) tcamRunAiHint(prev.src);
  }
  tcamCheckSub();
}
function tcamPickBeh(btn) {
  document.querySelectorAll('#tcamBehRow .chip').forEach(c => c.classList.remove('on'));
  btn.classList.add('on');
}
function tcamPickTravel(btn) {
  document.querySelectorAll('#tcamTravelRow .chip').forEach(c => c.classList.remove('on'));
  btn.classList.add('on');
}

function tcamCheckSub() {
  const btn = document.getElementById('tcamSaveBtn');
  if(!btn) return;
  const hasCam = tcamSelectedCam !== null;
  const hasDeer = !!document.querySelector('#tcamDeerRow .chip.on');
  if(hasCam && hasDeer) { btn.classList.remove('dis'); btn.classList.add('rdy'); }
  else { btn.classList.remove('rdy'); btn.classList.add('dis'); }
}

// Camera dropdown
function toggleTcamCamDrop() {
  if(tcamCamDropOpen) { closeTcamCamDrop(); return; }
  tcamCamDropOpen = true;
  document.getElementById('tcamCamSearch').value = '';
  renderTcamCamList('');
  document.getElementById('tcamCamDrop').style.display = 'block';
  setTimeout(() => document.getElementById('tcamCamSearch').focus(), 60);
}
function closeTcamCamDrop() {
  tcamCamDropOpen = false;
  document.getElementById('tcamCamDrop').style.display = 'none';
}
function renderTcamCamList(filter) {
  const names = Object.keys(camLocations).filter(n => n !== 'Other');
  const filtered = filter ? names.filter(n => n.toLowerCase().includes(filter.toLowerCase())) : names;
  const list = document.getElementById('tcamCamList');
  if(filtered.length === 0) {
    list.innerHTML = '<div style="padding:10px 14px;font-size:12px;color:var(--text3)">No cameras found</div>';
  } else {
    list.innerHTML = filtered.map(name =>
      `<div class="tcam-cam-item${tcamSelectedCam === name ? ' sel' : ''}" onclick="selectTcamCam('${name.replace(/'/g,"\\'")}')">
        ${tcamSelectedCam === name ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" style="margin-right:6px;vertical-align:-1px"><polyline points="20 6 9 17 4 12"/></svg>' : ''}${name}
      </div>`
    ).join('');
  }
}
function tcamFilterCams(val) { renderTcamCamList(val); }
function selectTcamCam(name) {
  tcamSelectedCam = name;
  document.getElementById('tcamCamLabel').textContent = name;
  document.getElementById('tcamCamSel').classList.add('has-val');
  closeTcamCamDrop();
  tcamCheckSub();
}
function tcamShowAddNew() {
  document.getElementById('tcamAddNewSection').style.display = 'block';
  document.getElementById('tcamNewCamName').value = '';
  setTimeout(() => document.getElementById('tcamNewCamName').focus(), 60);
}
function tcamHideAddNew() {
  document.getElementById('tcamAddNewSection').style.display = 'none';
}
async function tcamSaveNewCam() {
  const name = document.getElementById('tcamNewCamName').value.trim();
  if(!name) { showToast('Camera name is required', 2000); return; }
  try {
    await sb.from('cameras').insert({ name, lat: CLAT, lng: CLNG, active: true, property_id: PROPERTY_ID });
  } catch(e) { console.error('tcamSaveNewCam:', e); }
  camLocations[name] = { lng: CLNG, lat: CLAT };
  if(!CAMNAMES.includes(name)) CAMNAMES.splice(CAMNAMES.length - 1, 0, name);
  addCamMarkers();
  buildMapFilters();
  selectTcamCam(name);
  tcamHideAddNew();
  showToast(`Camera "${name}" added — drag pin on map to set location`);
}

// Weather (with date string fix)
function tcamAutoWx() {
  const d = document.getElementById('tcamDate').value;
  const t = document.getElementById('tcamTime').value;
  if(!d || !t) return;
  clearTimeout(tcamWxTimer);
  tcamWxTimer = setTimeout(() => tcamFetchWx(d, t), 600);
}
async function tcamFetchWx(date, time) {
  const load = document.getElementById('tcamWxLoad');
  const wxd  = document.getElementById('tcamWxData');
  const stat = document.getElementById('tcamWxStat');
  load.style.display = 'block'; wxd.style.display = 'none';
  load.textContent = 'Fetching conditions...';
  stat.textContent = 'fetching...'; stat.style.color = '#4A4D4E';
  try {
    const h = parseInt(time.split(':')[0]);
    // Date string comparison — avoids midnight/timezone false "future date" error
    const todayStr = new Date().toISOString().split('T')[0];
    if(date > todayStr) { load.textContent = 'Future date -- no weather yet.'; return; }
    const diffDays = Math.floor((new Date(todayStr) - new Date(date)) / 86400000);
    let url, isArchive = (diffDays >= 5);
    if(isArchive) {
      url = 'https://archive-api.open-meteo.com/v1/archive?latitude=' + CLAT
          + '&longitude=' + CLNG + '&start_date=' + date + '&end_date=' + date
          + '&hourly=temperature_2m,relativehumidity_2m,precipitation,windspeed_10m,windgusts_10m,winddirection_10m,surface_pressure'
          + '&wind_speed_unit=mph&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=America%2FChicago';
    } else {
      url = 'https://api.open-meteo.com/v1/forecast?latitude=' + CLAT
          + '&longitude=' + CLNG
          + '&hourly=temperature_2m,relativehumidity_2m,precipitation,windspeed_10m,windgusts_10m,winddirection_10m,surface_pressure'
          + '&wind_speed_unit=mph&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=America%2FChicago'
          + '&past_days=5&forecast_days=1';
    }
    const r = await fetch(url); const j = await r.json();
    if(!j.hourly) throw new Error('no data');
    let hi = h;
    if(!isArchive) {
      const target = date + 'T' + String(h).padStart(2,'0') + ':00';
      hi = j.hourly.time.findIndex(t => t === target);
      if(hi === -1) throw new Error('hour not found');
    }
    tcamFormWxFetched = {
      temp:    Math.round(j.hourly.temperature_2m[hi]),
      windSpd: Math.round(j.hourly.windspeed_10m[hi]),
      windGst: Math.round(j.hourly.windgusts_10m[hi]),
      windDir: deg2dir(j.hourly.winddirection_10m[hi]),
      humid:   Math.round(j.hourly.relativehumidity_2m[hi]),
      precip:  j.hourly.precipitation[hi].toFixed(2),
      press:   Math.round(j.hourly.surface_pressure[hi]),
    };
    document.getElementById('tcamWxT').textContent = tcamFormWxFetched.temp + '\u00b0';
    document.getElementById('tcamWxW').textContent = tcamFormWxFetched.windSpd;
    document.getElementById('tcamWxG').textContent = tcamFormWxFetched.windGst;
    document.getElementById('tcamWxD').textContent = tcamFormWxFetched.windDir;
    document.getElementById('tcamWxH').textContent = tcamFormWxFetched.humid + '%';
    document.getElementById('tcamWxP').textContent = tcamFormWxFetched.precip + '"';
    document.getElementById('tcamWxBp').textContent = tcamFormWxFetched.press;
    document.getElementById('tcamWxBpt').textContent =
      tcamFormWxFetched.press > 1013 ? 'Rising' : tcamFormWxFetched.press < 1005 ? 'Low' : 'Stable';
    stat.textContent = isArchive ? '(historical)' : '(recent data)';
    stat.style.color = '#7aaa6a';
    load.style.display = 'none'; wxd.style.display = 'block';
    document.getElementById('tcamTemp').value = tcamFormWxFetched.temp;
    document.getElementById('tcamWind').value = tcamFormWxFetched.windDir;
    tcamFormWxApplied = tcamFormWxFetched;
  } catch(e) {
    load.textContent = 'Weather unavailable -- enter manually below.';
    stat.textContent = 'unavailable'; stat.style.color = '#e87a4a';
    console.error('tcamFetchWx:', e);
  }
}

function tcamUpdateMoon() {
  const d = document.getElementById('tcamDate').value;
  if(!d) return;
  const m = moonPhase(d);
  const moonEmoji = {
    'New Moon':'🌑','Waxing Crescent':'🌒','First Quarter':'🌓',
    'Waxing Gibbous':'🌔','Full Moon':'🌕','Waning Gibbous':'🌖',
    'Last Quarter':'🌗','Waning Crescent':'🌘'
  };
  document.getElementById('tcamMoonIcon').innerHTML =
    `<span style="font-size:22px;line-height:1">${moonEmoji[m.l] || '🌙'}</span>`;
  document.getElementById('tcamMoonLbl').textContent = m.l;
}

// Photo + AI hint (buck-only)
function tcamHandlePhoto(inp) {
  const f = inp.files[0]; if(!f) return;
  tcamFormImgFile = f;
  const r = new FileReader();
  r.onload = e => {
    document.getElementById('tcamPhotoPrompt').style.display = 'none';
    const p = document.getElementById('tcamPhotoPreview');
    p.src = e.target.result; p.style.display = 'block';
    const deerChip = document.querySelector('#tcamDeerRow .chip.on');
    const isBuck = deerChip && deerChip.dataset.v && deerChip.dataset.v.includes('Buck');
    if(isBuck) tcamRunAiHint(e.target.result);
  };
  r.readAsDataURL(f);
}
// Top-3 AI buck identification result.
// Shape: { candidates: [{name,confidence,reasoning}, ...], visualObservations, photoUrl, cameraName, selectedRank }
// selectedRank is 1-based when set: 1/2/3 from a candidate card, or 0 when "None of These".
var tcamAiResult = null;

async function tcamRunAiHint(base64DataUrl) {
  const namedBucks = getNamedBucks();
  if(namedBucks.length === 0) return;
  const hintBox = document.getElementById('tcamAiHint');
  const statusEl = document.getElementById('tcamAiText');
  const obsEl = document.getElementById('tcamAiObservations');
  const candidatesEl = document.getElementById('tcamAiCandidates');
  const noneBtn = document.getElementById('tcamAiNoneBtn');
  const nonePanel = document.getElementById('tcamAiNonePanel');
  hintBox.style.display = 'block';
  statusEl.textContent = 'Analyzing photo...';
  obsEl.style.display = 'none';
  obsEl.textContent = '';
  candidatesEl.innerHTML = '';
  noneBtn.style.display = 'none';
  nonePanel.style.display = 'none';
  tcamAiHintSugg = null;
  tcamAiResult = null;
  try {
    const camContext = tcamSelectedCam || null;
    const { profiles: buckProfiles, hasBucks } = buildAiBuckProfiles(camContext);
    if(!hasBucks) { statusEl.textContent = 'No buck profiles available'; return; }
    const base64 = base64DataUrl.split(',')[1];
    const mediaType = base64DataUrl.split(';')[0].split(':')[1];

    // Fetch reference photos
    statusEl.textContent = 'Loading reference images...';
    let refContent = [];
    try { const r = await buildRefPhotoContent(camContext); refContent = r.content; } catch(e) { /* fallback */ }
    statusEl.textContent = 'Comparing against known bucks...';

    const promptText = `Look at the buck in this photo and compare against these known bucks from this property:

${buckProfiles}

${AI_VISUAL_REASONING_PROMPT}

Return your top 3 most likely matches ranked by confidence. If fewer than 3 bucks are plausible matches, return fewer. If no buck matches, return an empty candidates array.

Respond in JSON only, no preamble, no markdown:
{
  "visual_observations": "one sentence describing key antler characteristics visible",
  "candidates": [
    { "name": "exact buck name from list", "confidence": 0-100, "reasoning": "one sentence" },
    { "name": "exact buck name from list", "confidence": 0-100, "reasoning": "one sentence" },
    { "name": "exact buck name from list", "confidence": 0-100, "reasoning": "one sentence" }
  ]
}`;

    const content = [];
    if(refContent.length > 0) {
      content.push({ type: 'text', text: 'Reference photos of known bucks:' });
      content.push(...refContent);
      content.push({ type: 'text', text: 'Now identify this new trail cam photo.\n\n' + promptText });
      content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } });
    } else {
      content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } });
      content.push({ type: 'text', text: 'You are analyzing a trail camera photo for a deer hunting app.\n\n' + promptText });
    }

    const response = await claudeFetch({
        model: 'claude-sonnet-4-5',
        max_tokens: 600,
        messages: [{ role: 'user', content }]
    });
    const data = await response.json();
    const cleaned = (data.content?.[0]?.text || '').replace(/```json|```/g,'').trim();
    const parsed = JSON.parse(cleaned);
    const candidates = Array.isArray(parsed.candidates) ? parsed.candidates.slice(0, 3) : [];
    tcamAiResult = {
      candidates,
      visualObservations: parsed.visual_observations || '',
      cameraName: camContext,
      photoUrl: null,        // populated at submit-time from uploaded image_url
      selectedRank: null     // populated when user picks a candidate or "None of These"
    };
    renderTcamAiCandidates(tcamAiResult);
  } catch(e) {
    statusEl.textContent = 'AI analysis failed';
    console.error('tcamRunAiHint:', e);
  }
}

function renderTcamAiCandidates(result) {
  const statusEl = document.getElementById('tcamAiText');
  const obsEl = document.getElementById('tcamAiObservations');
  const candidatesEl = document.getElementById('tcamAiCandidates');
  const noneBtn = document.getElementById('tcamAiNoneBtn');
  if(!candidatesEl) return;
  const candidates = result.candidates || [];

  if(result.visualObservations) {
    obsEl.textContent = result.visualObservations;
    obsEl.style.display = 'block';
  }

  if(candidates.length === 0) {
    statusEl.textContent = 'No confident match';
    candidatesEl.innerHTML = '';
    noneBtn.style.display = 'block';
    return;
  }

  statusEl.textContent = 'Tap the correct buck';
  candidatesEl.innerHTML = candidates.map(function(c, idx) {
    const pct = Math.round(Number(c.confidence) || 0);
    const barColor = pct >= 75 ? '#E5B53B' : pct >= 50 ? '#8C7355' : '#4A4D4E';
    return '<div class="ai-hint-card" onclick="tcamSelectCandidate(' + idx + ')">' +
      '<div class="ai-hint-card-name">' + esc(c.name || '') + '</div>' +
      '<div class="ai-hint-card-confidence">' +
        '<div class="ai-hint-conf-bar-wrap"><div class="ai-hint-conf-bar" style="width:' + pct + '%;background:' + barColor + '"></div></div>' +
        '<span class="ai-hint-conf-pct">' + pct + '%</span>' +
      '</div>' +
      '<div class="ai-hint-card-reason">' + esc(c.reasoning || '') + '</div>' +
    '</div>';
  }).join('');
  noneBtn.style.display = 'block';
}

function tcamFillBuckName(name) {
  const buckInput = document.getElementById('tcamBuckName');
  if(!buckInput) return;
  buckInput.value = name;
  buckInput.dispatchEvent(new Event('input', { bubbles: true }));
}

function tcamSelectCandidate(idx) {
  if(!tcamAiResult || !tcamAiResult.candidates) return;
  const candidate = tcamAiResult.candidates[idx];
  if(!candidate) return;
  tcamFillBuckName(candidate.name);
  tcamAiResult.selectedRank = idx + 1;
  // Visual feedback — highlight selected card
  document.querySelectorAll('#tcamAiCandidates .ai-hint-card').forEach(function(c, i) {
    c.classList.toggle('ai-hint-card--selected', i === idx);
  });
  // Hide none panel if open
  const nonePanel = document.getElementById('tcamAiNonePanel');
  if(nonePanel) nonePanel.style.display = 'none';
}

function tcamShowNonePanel() {
  const panel = document.getElementById('tcamAiNonePanel');
  const buckList = document.getElementById('tcamAiBuckList');
  const newForm = document.getElementById('tcamAiNewBuckForm');
  if(!panel || !buckList) return;
  if(newForm) newForm.style.display = 'none';

  const topNames = (tcamAiResult && tcamAiResult.candidates)
    ? tcamAiResult.candidates.map(function(c) { return (c.name || '').toLowerCase(); })
    : [];
  const remaining = (buckRegistry || []).filter(function(b) {
    return topNames.indexOf((b.name || '').toLowerCase()) === -1;
  });

  buckList.innerHTML = remaining.length === 0
    ? '<div class="ai-hint-no-bucks">All registered bucks shown above</div>'
    : remaining.map(function(b) {
        return '<div class="ai-hint-buck-row" onclick="tcamSelectFromList(\'' + b.id + '\',\'' + esc(b.name).replace(/'/g, "\\'") + '\')">' + esc(b.name) + '</div>';
      }).join('');
  panel.style.display = 'block';
}

function tcamSelectFromList(buckId, buckName) {
  tcamFillBuckName(buckName);
  if(tcamAiResult) tcamAiResult.selectedRank = 0;
  document.querySelectorAll('#tcamAiCandidates .ai-hint-card').forEach(function(c) {
    c.classList.remove('ai-hint-card--selected');
  });
  const panel = document.getElementById('tcamAiNonePanel');
  if(panel) panel.style.display = 'none';
}

function tcamShowNewBuckForm() {
  const newForm = document.getElementById('tcamAiNewBuckForm');
  if(!newForm) return;
  newForm.style.display = 'flex';
  const input = document.getElementById('tcamAiNewBuckName');
  if(input) { input.value = ''; setTimeout(function() { input.focus(); }, 60); }
}

function tcamSaveNewBuckFromAi() {
  const input = document.getElementById('tcamAiNewBuckName');
  const name = input && input.value ? input.value.trim() : '';
  if(!name) { showToast('Name is required'); return; }
  tcamFillBuckName(name);
  if(tcamAiResult) tcamAiResult.selectedRank = 0;
  document.querySelectorAll('#tcamAiCandidates .ai-hint-card').forEach(function(c) {
    c.classList.remove('ai-hint-card--selected');
  });
  const newForm = document.getElementById('tcamAiNewBuckForm');
  if(newForm) newForm.style.display = 'none';
  const panel = document.getElementById('tcamAiNonePanel');
  if(panel) panel.style.display = 'none';
}

// Buck tag suggestion dropdown
function filterTcamBuckSugg(val) {
  const drop = document.getElementById('tcamBuckDrop');
  if(!drop) return;
  const bucks = getNamedBucks();
  const matches = val ? bucks.filter(b => b.toLowerCase().includes(val.toLowerCase())) : bucks;
  if(!val) { drop.style.display = 'none'; return; }
  let html = matches.map(b =>
    `<div onclick="selectTcamBuckSugg('${b.replace(/'/g,"\\'")}');event.preventDefault()"
      style="padding:9px 14px;font-size:13px;color:var(--text2);cursor:pointer;border-bottom:1px solid var(--border);font-family:var(--font)"
      onmousedown="event.preventDefault()">${b}</div>`
  ).join('');
  const exactMatch = bucks.some(b => b.toLowerCase() === val.toLowerCase());
  if(val.trim() && !exactMatch) {
    html += `<div onclick="addNewBuckFromDropdown('${val.trim().replace(/'/g,"\\'")}','tcamBuckName');event.preventDefault()"
      style="padding:9px 14px;font-size:13px;color:var(--sulfur);cursor:pointer;font-family:var(--font);font-weight:600"
      onmousedown="event.preventDefault()">+ Add "${val.trim()}"</div>`;
  }
  if(!html) { drop.style.display = 'none'; return; }
  drop.innerHTML = html;
  drop.style.display = 'block';
}
function showTcamBuckSugg() { const val = document.getElementById('tcamBuckName').value; if(!val) filterTcamBuckSugg(''); }
function hideTcamBuckSugg() { const drop = document.getElementById('tcamBuckDrop'); if(drop) drop.style.display = 'none'; }
function selectTcamBuckSugg(name) { document.getElementById('tcamBuckName').value = name; hideTcamBuckSugg(); }

// Save
async function submitTrailCamSighting() {
  if(!tcamSelectedCam) return;
  const deer = document.querySelector('#tcamDeerRow .chip.on');
  if(!deer) return;
  const btn = document.getElementById('tcamSaveBtn');
  btn.textContent = 'Saving...'; btn.classList.remove('rdy'); btn.classList.add('dis');
  const beh   = document.querySelector('#tcamBehRow .chip.on');
  const tdir  = document.querySelector('#tcamTravelRow .chip.on');
  const wx = tcamFormWxApplied || {};
  const tcamBuckNameVal = document.getElementById('tcamBuckName').value.trim() || null;
  const tcamBuckId = tcamBuckNameVal ? await resolveBuckId(tcamBuckNameVal) : null;
  const newSighting = {
    source: 'camera',
    date: document.getElementById('tcamDate').value,
    time: document.getElementById('tcamTime').value + ':00',
    camera_name: tcamSelectedCam,
    deer_type: deer.dataset.v,
    behavior: beh ? beh.dataset.v : null,
    buck_name: tcamBuckNameVal,
    buck_id: tcamBuckId,
    wind_dir: document.getElementById('tcamWind').value || null,
    temp_f: parseFloat(document.getElementById('tcamTemp').value) || null,
    wind_speed: wx.windSpd != null ? wx.windSpd : null,
    wind_gust:  wx.windGst != null ? wx.windGst  : null,
    humidity:   wx.humid   != null ? wx.humid    : null,
    precip:     wx.precip  != null ? parseFloat(wx.precip) : null,
    pressure:   wx.press   != null ? wx.press    : null,
    notes: document.getElementById('tcamNotes').value || null,
    travel_dir: tdir ? tdir.dataset.v : null,
    moon_phase: document.getElementById('tcamMoonLbl').textContent,
    image_url: null,
    property_id: PROPERTY_ID,
  };
  syncDot(true);
  const {data, error} = await sb.from('sightings').insert(newSighting).select().single();
  syncDot(false);
  if(error) {
    console.error('submitTrailCamSighting error:', error);
    btn.textContent = 'Error: ' + error.message.slice(0,30);
    btn.classList.add('rdy'); btn.classList.remove('dis');
    setTimeout(() => { btn.textContent = 'Log Camera Sighting'; tcamCheckSub(); }, 3000);
    return;
  }
  if(tcamFormImgFile) {
    try {
      syncDot(true);
      const url = await uploadPhoto(tcamFormImgFile, data.id);
      syncDot(false);
      if(url) { await sb.from('sightings').update({image_url: url}).eq('id', data.id); data.image_url = url; }
    } catch(e) { syncDot(false); console.error('Tcam photo upload:', e); }
  }
  sightings.unshift(data);
  if(tcamBuckId && data.date) updateBuckDates(tcamBuckId, data.date);
  // Log AI feedback if AI was used (top-3 candidate model)
  if(tcamAiResult && tcamBuckNameVal && Array.isArray(tcamAiResult.candidates)) {
    const top1 = tcamAiResult.candidates[0] || null;
    // Compute selected rank if not already captured at click time (e.g. user typed buck manually)
    let selectedRank = tcamAiResult.selectedRank;
    if(selectedRank == null) {
      const idx = tcamAiResult.candidates.findIndex(function(c) {
        return c && c.name && c.name.toLowerCase() === tcamBuckNameVal.toLowerCase();
      });
      selectedRank = idx >= 0 ? idx + 1 : 0; // 0 = not in top-3
    }
    const wasCorrect = selectedRank === 1; // true only if user kept the AI's #1 pick
    let correctionNotes = null;
    if(selectedRank === 0) {
      correctionNotes = 'User selected from full buck list — not in top 3 candidates';
    } else if(selectedRank > 1) {
      correctionNotes = 'User selected rank ' + selectedRank + ' candidate over rank 1';
    }
    await writeAiFeedback({
      photoUrl: data.image_url,
      cameraName: tcamSelectedCam,
      aiSuggestion: top1 ? top1.name : null,
      aiConfidence: top1 ? top1.confidence : null,
      aiReasoning: tcamAiResult.visualObservations || (top1 ? top1.reasoning : null),
      confirmedBuckId: tcamBuckId,
      confirmedBuckName: tcamBuckNameVal,
      wasCorrect,
      correctionNotes
    });
  }
  tcamAiResult = null;
  closeSheet('trail-cam');
  refreshMapPins(); refreshBucknameList(); renderDash();
  showToast('Camera sighting logged!');
}

// --- Log Event mode state ---

var logMode = 'camera'; // 'camera' | 'observation'
var obsLocationMode = 'gps'; // 'gps' | 'pin'
var obsLatLng = null; // {lat, lng} set when user drops pin or GPS resolves

function setLogMode(mode) {
  logMode = mode;
  const tabCam = document.getElementById('modeTabCam');
  const tabObs = document.getElementById('modeTabObs');
  const camFields = document.getElementById('camFields');
  const camOnlyFields = document.getElementById('camOnlyFields');
  const obsLocationFields = document.getElementById('obsLocationFields');
  const camTravelFields = document.getElementById('camTravelFields');
  const notesPlaceholder = document.getElementById('fnotes');
  const notesLbl = document.getElementById('notesLbl');
  const btn = document.getElementById('sbtn');

  if(mode === 'camera') {
    // Tab styles
    tabCam.style.background = 'var(--gold)'; tabCam.style.color = 'var(--bg)';
    tabObs.style.background = 'transparent'; tabObs.style.color = 'var(--text3)';
    // Field visibility
    if(camFields) camFields.style.display = 'block';
    if(camOnlyFields) camOnlyFields.style.display = 'block';
    if(obsLocationFields) obsLocationFields.style.display = 'none';
    if(camTravelFields) camTravelFields.style.display = 'block';
    // Labels
    if(notesPlaceholder) notesPlaceholder.placeholder = 'Antler details, travel direction, buck ID notes...';
    if(notesLbl) notesLbl.textContent = 'Notes';
    if(btn) btn.textContent = 'Log Camera Sighting';
  } else {
    // Tab styles
    tabObs.style.background = 'var(--gold)'; tabObs.style.color = 'var(--bg)';
    tabCam.style.background = 'transparent'; tabCam.style.color = 'var(--text3)';
    // Field visibility
    if(camFields) camFields.style.display = 'none';
    if(camOnlyFields) camOnlyFields.style.display = 'none';
    if(obsLocationFields) obsLocationFields.style.display = 'block';
    if(camTravelFields) camTravelFields.style.display = 'none';
    // Labels
    if(notesPlaceholder) notesPlaceholder.placeholder = 'What did you see? Describe the deer, direction of travel, terrain, any sign nearby...';
    if(notesLbl) notesLbl.textContent = 'Observation Notes';
    if(btn) btn.textContent = 'Log Field Observation';
    // Clear AI hint
    document.getElementById('aiHintBox').style.display = 'none';
    // On desktop (no touch), GPS blue dot is unavailable — show disabled state and auto-select Drop Pin
    const isMobile = navigator.maxTouchPoints > 0;
    const btnGPS = document.getElementById('locBtnGPS');
    if(!isMobile && btnGPS) {
      btnGPS.disabled = true;
      btnGPS.style.opacity = '0.4';
      btnGPS.style.cursor = 'not-allowed';
      btnGPS.style.pointerEvents = 'none';
      btnGPS.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1"/></svg> GPS — mobile only';
      // Auto-select pin mode on desktop
      setObsLocation('pin');
    } else if(btnGPS) {
      btnGPS.disabled = false;
      btnGPS.style.opacity = '';
      btnGPS.style.cursor = '';
      btnGPS.style.pointerEvents = '';
      btnGPS.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg> GPS Blue Dot';
    }
  }
  checkSub();
}

function setObsLocation(mode) {
  obsLocationMode = mode;
  const btnGPS = document.getElementById('locBtnGPS');
  const btnPin = document.getElementById('locBtnPin');
  const status = document.getElementById('obsLocStatus');

  if(mode === 'gps') {
    btnGPS.style.borderColor = 'var(--gold)'; btnGPS.style.background = 'rgba(140,115,85,0.15)'; btnGPS.style.color = 'var(--gold)';
    btnPin.style.borderColor = 'var(--border2)'; btnPin.style.background = 'transparent'; btnPin.style.color = 'var(--text3)';
    // Try to get GPS position
    if(navigator.geolocation) {
      status.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg> Getting GPS location...';
      navigator.geolocation.getCurrentPosition(
        pos => {
          obsLatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          status.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#7aaa6a" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> <span style="color:#7aaa6a">GPS locked: ' + obsLatLng.lat.toFixed(5) + ', ' + obsLatLng.lng.toFixed(5) + '</span>';
          checkSub();
        },
        err => {
          status.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> <span style="color:var(--red)">GPS unavailable — try Drop Pin</span>';
          obsLatLng = null;
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      status.innerHTML = '<span style="color:var(--red)">GPS not supported on this device</span>';
      obsLatLng = null;
    }
  } else {
    // Pin drop mode — close sheet, let user tap map
    btnPin.style.borderColor = 'var(--gold)'; btnPin.style.background = 'rgba(140,115,85,0.15)'; btnPin.style.color = 'var(--gold)';
    btnGPS.style.borderColor = 'var(--border2)'; btnGPS.style.background = 'transparent'; btnGPS.style.color = 'var(--text3)';
    status.innerHTML = '<span style="color:var(--gold)">Tap map to drop observation pin...</span>';
    obsLatLng = null;
    // Minimize sheet and enter pin-drop mode
    enterObsPinDropMode();
  }
}

var obsPinDropActive = false;
var obsPinDropMarker = null;

function enterObsPinDropMode() {
  obsPinDropActive = true;
  closeSheet('log');
  showToast('Tap anywhere on the map to set observation location', 4000);
  // Listen for next map click
  if(mapInstance) {
    mapInstance.once('click', function(e) {
      obsPinDropActive = false;
      obsLatLng = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      // Place a temporary marker
      if(obsPinDropMarker) obsPinDropMarker.remove();
      const el = document.createElement('div');
      // Use hex literal — CSS vars (var(--gold)) don't resolve on off-DOM elements
      el.style.cssText = 'width:28px;height:28px;border-radius:50%;background:#8C7355;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;flex-shrink:0';
      el.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
      obsPinDropMarker = new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([obsLatLng.lng, obsLatLng.lat]).addTo(mapInstance);
      // Re-open sheet
      openSheet('log');
      // Update status
      setTimeout(() => {
        const status = document.getElementById('obsLocStatus');
        if(status) status.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#7aaa6a" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> <span style="color:#7aaa6a">Pin set: ' + obsLatLng.lat.toFixed(5) + ', ' + obsLatLng.lng.toFixed(5) + '</span>';
        checkSub();
      }, 300);
    });
  }
}

function initForm() {
  const now = new Date();
  document.getElementById("fd").value = now.toISOString().split("T")[0];
  document.getElementById("ft").value = now.toTimeString().slice(0,5);
  document.getElementById("fbuckname").value = "";
  document.getElementById("fnotes").value = "";
  document.getElementById("ftemp").value = "";
  document.getElementById("fwind").value = "";
  wxFetched = null; wxApplied = null; formImgFile = null;
  obsLatLng = null; obsLocationMode = 'gps';
  document.getElementById("wxload").style.display = "block";
  document.getElementById("wxload").textContent = "Fetching conditions...";
  document.getElementById("wxdata").style.display = "none";
  document.getElementById("wxstat").textContent = "fetching...";
  document.getElementById("wxstat").style.color = "#4A4D4E";
  document.getElementById("uprev").style.display = "none";
  document.getElementById("uph").style.display = "block";
  document.getElementById("aiHintBox").style.display = "none";
  // Reset obs location status
  const obsLocStatus = document.getElementById('obsLocStatus');
  if(obsLocStatus) obsLocStatus.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Choose GPS location or drop a pin on the map';
  // Remove any lingering obs pin
  if(obsPinDropMarker) { obsPinDropMarker.remove(); obsPinDropMarker = null; }
  // Default to camera mode
  logMode = 'camera';
  setLogMode('camera');
  refreshBucknameList(); updateMoon(); autoWx();
  // Build camera chips from camLocations (already fetched from Supabase) — fall back to CAMNAMES
  const liveCamNames = Object.keys(camLocations).length
    ? [...Object.keys(camLocations), 'Other']
    : CAMNAMES;
  mkChips("cch", liveCamNames, "cam");
  mkChips("dch", DTYPES, "deer");
  mkChips("bch", BEHS, "beh");
  mkChips("tch", TRAVEL_DIRS, "tdir");
  checkSub();
}

function refreshBucknameList() {
  const dl = document.getElementById("bucknamelist");
  if(dl) dl.innerHTML = getNamedBucks().map(b => `<option value="${b}">`).join("");
}

// Buck suggestion dropdown (fixes focus-loss bug — never rebuilds the input itself)
function filterBuckSuggestions(val) {
  const drop = document.getElementById('buckSuggestDrop');
  if(!drop) return;
  const bucks = getNamedBucks();
  const matches = val ? bucks.filter(b => b.toLowerCase().includes(val.toLowerCase())) : bucks;
  if(!val) { drop.style.display = 'none'; return; }
  let html = matches.map(b =>
    `<div onclick="selectBuckSuggestion('${b.replace(/'/g,"\\'")}');event.preventDefault()"
      style="padding:9px 14px;font-size:13px;color:var(--text2);cursor:pointer;border-bottom:1px solid var(--border);font-family:var(--font)"
      onmousedown="event.preventDefault()">${b}</div>`
  ).join('');
  const exactMatch = bucks.some(b => b.toLowerCase() === val.toLowerCase());
  if(val.trim() && !exactMatch) {
    html += `<div onclick="addNewBuckFromDropdown('${val.trim().replace(/'/g,"\\'")}','fbuckname');event.preventDefault()"
      style="padding:9px 14px;font-size:13px;color:var(--sulfur);cursor:pointer;font-family:var(--font);font-weight:600"
      onmousedown="event.preventDefault()">+ Add "${val.trim()}"</div>`;
  }
  if(!html) { drop.style.display = 'none'; return; }
  drop.innerHTML = html;
  drop.style.display = 'block';
}

function showBuckSuggestions() {
  const val = document.getElementById('fbuckname').value;
  if(!val) filterBuckSuggestions('');
}

function hideBuckSuggestions() {
  const drop = document.getElementById('buckSuggestDrop');
  if(drop) drop.style.display = 'none';
}

function selectBuckSuggestion(name) {
  document.getElementById('fbuckname').value = name;
  hideBuckSuggestions();
  checkSub();
}
async function addNewBuckFromDropdown(name, inputId) {
  const buck = await createBuck(name);
  if(buck) {
    document.getElementById(inputId).value = buck.name;
    showToast(`"${buck.name}" added to buck registry`);
  }
  // Hide all suggestion dropdowns
  hideBuckSuggestions();
  hideObsBuckSugg();
  hideTcamBuckSugg();
}
function mkChips(id, opts, key) {
  document.getElementById(id).innerHTML = opts.map(o =>
    `<button class="chip" data-k="${key}" data-v="${o}" onclick="pickChip(this,'${key}')">${o}</button>`
  ).join("");
}
function pickChip(btn, key) {
  document.querySelectorAll(`.chip[data-k="${key}"]`).forEach(b => b.classList.remove("on"));
  btn.classList.add("on"); checkSub();
}
function checkSub() {
  const btn = document.getElementById("sbtn");
  if(!btn) return;
  if(logMode === 'camera') {
    const c = document.querySelector(".chip[data-k='cam'].on");
    const d = document.querySelector(".chip[data-k='deer'].on");
    if(c && d) { btn.classList.remove("dis"); btn.classList.add("rdy"); }
    else { btn.classList.remove("rdy"); btn.classList.add("dis"); }
  } else {
    // Observation mode: deer type required; location recommended but not blocking
    const d = document.querySelector(".chip[data-k='deer'].on");
    if(d) { btn.classList.remove("dis"); btn.classList.add("rdy"); }
    else { btn.classList.remove("rdy"); btn.classList.add("dis"); }
  }
}
function updateMoon() {
  const d = document.getElementById("fd").value;
  if(!d) return;
  const m = moonPhase(d);
  const moonEmoji = {
    'New Moon':'🌑', 'Waxing Crescent':'🌒', 'First Quarter':'🌓',
    'Waxing Gibbous':'🌔', 'Full Moon':'🌕', 'Waning Gibbous':'🌖',
    'Last Quarter':'🌗', 'Waning Crescent':'🌘'
  };
  const icon = document.getElementById("micon");
  if(icon) icon.innerHTML = `<span style="font-size:22px;line-height:1">${moonEmoji[m.l] || '🌙'}</span>`;
  document.getElementById("mlbl").textContent = m.l;
  document.getElementById("msub").textContent = "Auto-calculated for " + fmtD(d);
  document.getElementById("tlbl").textContent = "Time";
}
function handlePhoto(inp) {
  const f = inp.files[0]; if(!f) return;
  formImgFile = f;
  const r = new FileReader();
  r.onload = e => {
    document.getElementById("uph").style.display = "none";
    const p = document.getElementById("uprev");
    p.src = e.target.result; p.style.display = "block";
    // Check if this looks like a buck — run light AI hint
    const deerChip = document.querySelector(".chip[data-k='deer'].on");
    const isBuck = deerChip && deerChip.dataset.v && deerChip.dataset.v.includes("Buck");
    if(isBuck || !deerChip) {
      runAiHint(e.target.result);
    }
  };
  r.readAsDataURL(f);
}

var aiHintSuggestion = null;

async function runAiHint(base64DataUrl) {
  const namedBucks = getNamedBucks();
  if(namedBucks.length === 0) return; // No named bucks to match against
  const hintBox = document.getElementById("aiHintBox");
  const hintText = document.getElementById("aiHintText");
  const hintReason = document.getElementById("aiHintReason");
  hintBox.style.display = "block";
  hintText.textContent = "Analyzing photo...";
  hintReason.textContent = "";
  aiHintSuggestion = null;

  try {
    // Build buck profiles from registry notes + sightings data
    const buckProfiles = namedBucks.map(name => {
      const regBuck = buckRegistry.find(b => b.name === name);
      const bs = sightings.filter(s => s.buck_name === name && s.deer_type && s.deer_type.includes("Buck"));
      const sightingNotes = bs.filter(s => s.notes).map(s => s.notes).slice(0, 3).join("; ");
      const regNotes = regBuck && regBuck.notes ? regBuck.notes : "";
      const allNotes = [regNotes, sightingNotes].filter(Boolean).join("; ");
      return `${name}: ${bs.length} sightings, cameras: ${[...new Set(bs.map(s=>s.camera_name))].join(", ")}${allNotes ? ", notes: " + allNotes : ""}`;
    }).join("\n");

    const base64 = base64DataUrl.split(",")[1];
    const mediaType = base64DataUrl.split(";")[0].split(":")[1];

    const response = await claudeFetch({
        model: "claude-sonnet-4-5",
        max_tokens: 300,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 }
            },
            {
              type: "text",
              text: `You are analyzing a trail camera photo for a deer hunting app. Look at the buck in this photo and compare it to these known bucks from this property:

${buckProfiles}

Respond in JSON only, no other text:
{"match": "buck name or null if no match", "confidence": 0-100, "reasoning": "one sentence about antler characteristics that match or don't match"}`
            }
          ]
        }]
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const result = JSON.parse(cleaned);

    if(result.match && result.confidence >= 50) {
      aiHintSuggestion = result.match;
      hintText.textContent = `${result.match} — ${result.confidence}% confidence`;
      hintReason.textContent = result.reasoning;
    } else {
      hintText.textContent = "No confident match found";
      hintReason.textContent = result.reasoning || "Could not identify this buck from your named bucks.";
      aiHintSuggestion = null;
    }
  } catch(e) {
    console.error("AI hint failed:", e);
    hintBox.style.display = "none";
  }
}

function acceptAiHint() {
  if(aiHintSuggestion) {
    document.getElementById("fbuckname").value = aiHintSuggestion;
  }
  document.getElementById("aiHintBox").style.display = "none";
}

function dismissAiHint() {
  document.getElementById("aiHintBox").style.display = "none";
  aiHintSuggestion = null;
}



// --- Realtime subscription ---
// Refresh sightings when another session inserts a record
var sightingsChannel = sb.channel('sightings-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'sightings' }, function(payload) {
    if(payload.eventType === 'INSERT') {
      var exists = sightings.find(function(s) { return s.id === payload.new.id; });
      if(!exists) {
        sightings.unshift(payload.new);
        var activeDash = document.getElementById("sheet-intel");
        if(activeDash && activeDash.classList.contains("open")) renderDash();
        buildMapFilters(); buildMapLegend(); refreshBucknameList();
      }
    }
  })
  .subscribe();

