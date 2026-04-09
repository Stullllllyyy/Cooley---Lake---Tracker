// Huginn — markers.js
// Property markers (stands, scrapes, rubs, bedding) and observation pin popups
// Depends on: config.js (PROPERTY_ID, FEAT_TYPES, FEAT_COLORS, FEAT_STROKES, FEAT_LABELS, FEAT_ICONS,
//   PIN_COLORS, PIN_COLOR_STROKES), utils.js (showToast, compressImage, esc),
//   auth.js (sb), ui.js (closeSheet), sightings.js (sightings, tapToPlaceLngLat, tapToPlaceActive)
// References from inline: mapInstance, mapboxgl, mapMarkers, obsMarkersVisible, scrapeMarkersVisible,
//   rubMarkersVisible, beddingMarkersVisible, addObsMarkers, refreshMapPins, closePopup,
//   updateFilterFabDot, addCamMarkers

function toggleObsMarkers() {
  obsMarkersVisible = !obsMarkersVisible;
  const tog = document.getElementById('mfpObsToggle');
  tog.textContent = obsMarkersVisible ? 'ON' : 'OFF';
  tog.classList.toggle('on', obsMarkersVisible);
  addObsMarkers();
  updateMarkersPillState();
}
function toggleScrapeMarkers() {
  scrapeMarkersVisible = !scrapeMarkersVisible;
  const tog = document.getElementById('mfpScrapeToggle');
  tog.textContent = scrapeMarkersVisible ? 'ON' : 'OFF';
  tog.classList.toggle('on', scrapeMarkersVisible);
  renderPropertyMarkers();
  updateMarkersPillState();
}
function toggleRubMarkers() {
  rubMarkersVisible = !rubMarkersVisible;
  const tog = document.getElementById('mfpRubToggle');
  tog.textContent = rubMarkersVisible ? 'ON' : 'OFF';
  tog.classList.toggle('on', rubMarkersVisible);
  renderPropertyMarkers();
  updateMarkersPillState();
}
function toggleBeddingMarkers() {
  beddingMarkersVisible = !beddingMarkersVisible;
  const tog = document.getElementById('mfpBeddingToggle');
  tog.textContent = beddingMarkersVisible ? 'ON' : 'OFF';
  tog.classList.toggle('on', beddingMarkersVisible);
  renderPropertyMarkers();
  updateMarkersPillState();
}

function updateMarkersPillState() {
  updateFilterFabDot();
}


var featFormLngLat = null;
var featFormImgFile = null;
var propertyMarkers = [];
var propertyMarkerInstances = [];

function openTtpFeatureModal() {
  featFormLngLat = tapToPlaceLngLat ? { lat: tapToPlaceLngLat.lat, lng: tapToPlaceLngLat.lng } : null;
  tapToPlaceActive = false;
  // Reset form
  featFormImgFile = null;
  document.getElementById('ttpFeatName').value = '';
  document.getElementById('ttpFeatNotes').value = '';
  document.getElementById('ttpFeatDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('ttpFeatPhotoPreview').style.display = 'none';
  document.getElementById('ttpFeatPhotoPrompt').style.display = 'block';
  document.getElementById('ttpFeatInput').value = '';
  // Coords
  const ce = document.getElementById('ttpFeatCoords');
  if(ce && featFormLngLat) ce.textContent = featFormLngLat.lat.toFixed(6) + ', ' + featFormLngLat.lng.toFixed(6);
  // Build type chips
  const row = document.getElementById('ttpFeatTypeRow');
  row.innerHTML = '';
  FEAT_TYPES.forEach(t => {
    const c = document.createElement('div');
    c.className = 'chip';
    c.textContent = t;
    c.onclick = () => {
      row.querySelectorAll('.chip').forEach(x => x.classList.remove('on'));
      c.classList.add('on');
      featCheckSub();
    };
    row.appendChild(c);
  });
  featCheckSub();
  document.getElementById('ttpFeatureModal').classList.add('on');
}

function featCheckSub() {
  const btn = document.getElementById('ttpFeatSaveBtn');
  if(!btn) return;
  const sel = document.querySelector('#ttpFeatTypeRow .chip.on');
  if(sel) { btn.classList.remove('dis'); btn.style.opacity = ''; }
  else { btn.classList.add('dis'); btn.style.opacity = '0.5'; }
}

function featHandlePhoto(inp) {
  const f = inp.files[0]; if(!f) return;
  featFormImgFile = f;
  const r = new FileReader();
  r.onload = e => {
    document.getElementById('ttpFeatPhotoPrompt').style.display = 'none';
    const p = document.getElementById('ttpFeatPhotoPreview');
    p.src = e.target.result; p.style.display = 'block';
  };
  r.readAsDataURL(f);
}

function cancelTtpFeature() {
  document.getElementById('ttpFeatureModal').classList.remove('on');
  if(tapToPlacePreviewMarker) { tapToPlacePreviewMarker.remove(); tapToPlacePreviewMarker = null; }
  tapToPlaceLngLat = null;
  featFormLngLat = null;
  featFormImgFile = null;
}

async function submitFeatureMarker() {
  const typeChip = document.querySelector('#ttpFeatTypeRow .chip.on');
  if(!typeChip) return;
  const btn = document.getElementById('ttpFeatSaveBtn');
  btn.textContent = 'Saving...';
  const marker = {
    type: typeChip.textContent,
    name: document.getElementById('ttpFeatName').value.trim() || null,
    lat: featFormLngLat ? featFormLngLat.lat : null,
    lng: featFormLngLat ? featFormLngLat.lng : null,
    notes: document.getElementById('ttpFeatNotes').value.trim() || null,
    property_id: PROPERTY_ID,
  };
  syncDot(true);
  const {data, error} = await sb.from('property_markers').insert(marker).select().single();
  syncDot(false);
  if(error) {
    console.error('submitFeatureMarker Supabase error:', JSON.stringify(error));
    showToast('Save failed: ' + (error.message || error.code || 'unknown error'), 4000);
    btn.textContent = 'Save Marker'; featCheckSub();
    return;
  }
  // Upload photo if present
  if(featFormImgFile && data.id) {
    try {
      featFormImgFile = await compressImage(featFormImgFile);
      const path = 'markers/' + data.id + '.jpg';
      syncDot(true);
      const {error: upErr} = await sb.storage.from('trail-cam-photos').upload(path, featFormImgFile, {upsert:true, contentType: 'image/jpeg'});
      syncDot(false);
      if(!upErr) {
        const {data: urlData} = sb.storage.from('trail-cam-photos').getPublicUrl(path);
        if(urlData?.publicUrl) await sb.from('property_markers').update({photo_url: urlData.publicUrl}).eq('id', data.id);
      }
    } catch(e) { syncDot(false); console.error('Feature photo upload:', e); }
  }
  // Clean up tap-to-place state
  if(tapToPlacePreviewMarker) { tapToPlacePreviewMarker.remove(); tapToPlacePreviewMarker = null; }
  tapToPlaceLngLat = null; featFormLngLat = null; featFormImgFile = null;
  document.getElementById('ttpFeatureModal').classList.remove('on');
  // Add to local array and render on map
  propertyMarkers.push(data);
  addPropertyMarker(data);
  const label = marker.name ? `${marker.type}: ${marker.name}` : marker.type;
  showToast(`${label} marked`);
}

async function loadPropertyMarkers() {
  if(onboardingMode) return;
  try {
    const {data, error} = await sb.from('property_markers').select('*').eq('property_id', PROPERTY_ID).is('deleted_at', null);
    if(error || !data) return;
    propertyMarkers = data;
    if(mapInstance) renderPropertyMarkers();
  } catch(e) { /* property_markers table may not exist yet */ }
}

function renderPropertyMarkers() {
  propertyMarkerInstances.forEach(m => m.remove());
  propertyMarkerInstances = [];
  propertyMarkers.forEach(m => addPropertyMarker(m));
}

function addPropertyMarker(m) {
  if(!mapInstance || !m.lat || !m.lng) return;
  // Visibility: Stand always shown; Scrape, Rub, Bedding each have independent toggles
  const t = m.type;
  if(t === 'Scrape' && !scrapeMarkersVisible) return;
  if(t === 'Rub' && !rubMarkersVisible) return;
  if(t === 'Bedding' && !beddingMarkersVisible) return;
  const fill   = m.color || FEAT_COLORS[t]  || '#8C7355';
  const stroke = m.color ? (PIN_COLOR_STROKES[m.color] || '#a08468') : (FEAT_STROKES[t] || '#a08468');
  const icon   = FEAT_ICONS[t]   || '';
  const lbl    = m.name || t;
  const el = document.createElement('div');
  el.className = 'cam-marker';
  // .cam-lbl ABOVE .cam-pin so element bottom = teardrop tip = coordinate (anchor:'bottom')
  el.innerHTML =
    '<div class="cam-lbl">' + lbl + '</div>' +
    '<div class="cam-pin">' +
      '<svg class="pin-bg" viewBox="0 0 36 44" fill="none">' +
        '<path d="M18 2C10.268 2 4 8.268 4 16c0 10 14 28 14 28s14-18 14-28C32 8.268 25.732 2 18 2z"' +
        ' fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="3"/>' +
      '<path d="M18 2C10.268 2 4 8.268 4 16c0 10 14 28 14 28s14-18 14-28C32 8.268 25.732 2 18 2z"' +
        ' fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.5"/>' +
      '</svg>' +
      '<div class="cam-pin-content"><div class="cam-pin-ico">' + icon + '</div></div>' +
    '</div>';
  el.title = t + (m.name ? ': ' + m.name : '');
  el.addEventListener('click', () => showFeaturePopup(m));
  const inst = new mapboxgl.Marker({ element: el, anchor: 'bottom', offset: [0, 0] })
    .setLngLat([m.lng, m.lat])
    .addTo(mapInstance);
  propertyMarkerInstances.push(inst);
}

// --- Feature marker info card ---
var activeFeatureMarker = null;
var pendingCamColor = null;
var pendingFacing = null;
var pendingFeatColor = null;

// esc() loaded from /js/utils.js

function showFeaturePopup(m) {
  activeFeatureMarker = m;
  const popup  = document.getElementById('camPopup');
  const title  = document.getElementById('popupTitle');
  const stats  = document.getElementById('popupStats');
  const sights = document.getElementById('popupSightings');
  const actions = document.getElementById('popupActions');
  // Remove any camera-specific facing row left over from a previous camera popup
  const facingRow = document.getElementById('camFacingRow');
  if(facingRow) facingRow.remove();
  const existFeatCR = document.getElementById('camColorRow');
  if(existFeatCR) existFeatCR.remove();

  const color = FEAT_COLORS[m.type] || 'var(--gold)';
  const label = m.name ? m.type + ': ' + m.name : m.type;
  title.textContent = label;
  title.style.color = color;
  popup.className = 'cam-popup';

  // 2-col stat grid: type + date added
  const dateStr = m.created_at
    ? new Date(m.created_at).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})
    : '—';
  stats.style.gridTemplateColumns = '1fr 1fr';
  stats.innerHTML =
    '<div class="pstat"><div class="pstat-n" style="font-size:15px;color:' + color + '">' + esc(m.type) + '</div><div class="pstat-l">Type</div></div>' +
    '<div class="pstat"><div class="pstat-n" style="font-size:12px">' + dateStr + '</div><div class="pstat-l">Added</div></div>';

  // Body: notes (if any) + coordinates
  let bodyHtml = '';
  if(m.notes) {
    bodyHtml +=
      '<div style="padding:10px 16px;border-top:1px solid var(--border)">' +
      '<div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Notes</div>' +
      '<div style="font-size:12px;color:var(--text2);line-height:1.6">' + esc(m.notes) + '</div>' +
      '</div>';
  }
  const borderTop = m.notes ? '' : 'border-top:1px solid var(--border);';
  bodyHtml +=
    '<div style="padding:8px 16px 10px;' + borderTop + '">' +
    '<div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Coordinates</div>' +
    '<div style="font-size:11px;color:var(--text2);font-family:monospace">' + m.lat.toFixed(6) + ', ' + m.lng.toFixed(6) + '</div>' +
    '</div>';
  sights.innerHTML = bodyHtml;

  // Actions: Edit / Move / Delete (two-step confirm)
  actions.innerHTML =
    '<button class="popup-act-btn" onclick="openFeatEdit()">' +
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
    ' Edit</button>' +
    '<button class="popup-act-btn" onclick="moveFeatMarker()">' +
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/></svg>' +
    ' Move</button>' +
    '<button class="popup-act-btn danger" id="featDelBtn" onclick="deleteFeatMarker(this)">' +
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>' +
    ' Delete</button>';

  pendingFeatColor = null;
  ['camColorRow','camFacingRow','camSaveRow','featSaveRow'].forEach(id => { const el = document.getElementById(id); if(el) el.remove(); });
  popup.classList.add('show');
  // Color swatch row for feature marker
  const featColorRow = buildColorSwatchRow(
    m.color || FEAT_COLORS[m.type] || '#8C7355',
    c => { pendingFeatColor = c; }
  );
  featColorRow.id = 'camColorRow';
  actions.parentNode.appendChild(featColorRow);
  // Save button row
  const featSaveRow = document.createElement('div');
  featSaveRow.id = 'featSaveRow';
  featSaveRow.style.cssText = 'padding:8px 12px 12px;border-top:1px solid var(--border)';
  featSaveRow.innerHTML = `<button onclick="saveFeatPinSettings('${m.id}')" style="width:100%;padding:9px;border-radius:8px;border:1px solid var(--border2);background:var(--surface2);color:var(--text1);font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font)">Save Changes</button>`;
  actions.parentNode.appendChild(featSaveRow);
}

function openFeatEdit() {
  if(!activeFeatureMarker) return;
  const m = activeFeatureMarker;
  const color = FEAT_COLORS[m.type] || 'var(--gold)';
  const titleEl = document.getElementById('featEditTitle');
  titleEl.textContent = 'Edit ' + m.type;
  titleEl.style.color = color;
  document.getElementById('featEditName').value = m.name || '';
  document.getElementById('featEditNotes').value = m.notes || '';
  // Build type chips
  const row = document.getElementById('featEditTypeRow');
  row.innerHTML = '';
  FEAT_TYPES.forEach(t => {
    const c = document.createElement('div');
    c.className = 'chip' + (t === m.type ? ' on' : '');
    c.textContent = t;
    c.onclick = () => { row.querySelectorAll('.chip').forEach(x => x.classList.remove('on')); c.classList.add('on'); };
    row.appendChild(c);
  });
  closePopup();
  document.getElementById('featEditModal').classList.add('on');
}

async function submitFeatEdit() {
  if(!activeFeatureMarker) return;
  const typeChip = document.querySelector('#featEditTypeRow .chip.on');
  if(!typeChip) { showToast('Select a feature type'); return; }
  const updates = {
    type: typeChip.textContent,
    name: document.getElementById('featEditName').value.trim() || null,
    notes: document.getElementById('featEditNotes').value.trim() || null
  };
  const {error} = await sb.from('property_markers').update(updates).eq('id', activeFeatureMarker.id);
  if(error) { showToast('Save failed — try again'); return; }
  const idx = propertyMarkers.findIndex(x => x.id === activeFeatureMarker.id);
  if(idx >= 0) Object.assign(propertyMarkers[idx], updates);
  const savedLabel = updates.name || updates.type;
  activeFeatureMarker = null;
  document.getElementById('featEditModal').classList.remove('on');
  renderPropertyMarkers();
  showToast(savedLabel + ' updated');
}

function cancelFeatEdit() {
  document.getElementById('featEditModal').classList.remove('on');
}


var activeObsSighting = null;

function showObsPopup(s) {
  activeObsSighting = s;
  const popup  = document.getElementById('camPopup');
  const title  = document.getElementById('popupTitle');
  const stats  = document.getElementById('popupStats');
  const sights = document.getElementById('popupSightings');
  const actions = document.getElementById('popupActions');
  // Remove any stale extra rows from previous popup type
  const facingRow = document.getElementById('camFacingRow');
  if(facingRow) facingRow.remove();
  const existCR = document.getElementById('camColorRow');
  if(existCR) existCR.remove();

  title.textContent = s.buck_name || s.deer_type || 'Observation';
  title.style.color = '';
  popup.className = 'cam-popup';

  const dateStr = s.date
    ? new Date(s.date + 'T12:00:00').toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})
    : '\u2014';
  stats.style.gridTemplateColumns = '1fr 1fr';
  stats.innerHTML =
    '<div class="pstat"><div class="pstat-n" style="font-size:12px">' + esc(s.deer_type || 'Unknown') + '</div><div class="pstat-l">Type</div></div>' +
    '<div class="pstat"><div class="pstat-n" style="font-size:12px">' + dateStr + '</div><div class="pstat-l">Date</div></div>';

  let bodyHtml = '';
  if(s.behavior) {
    bodyHtml +=
      '<div style="padding:8px 16px 0">' +
      '<div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Behavior</div>' +
      '<div style="font-size:12px;color:var(--text2)">' + esc(s.behavior) + '</div></div>';
  }
  if(s.notes) {
    bodyHtml +=
      '<div style="padding:8px 16px 0">' +
      '<div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Notes</div>' +
      '<div style="font-size:12px;color:var(--text2);line-height:1.6">' + esc(s.notes) + '</div></div>';
  }
  const lat = s.obs_lat, lng = s.obs_lng;
  if(lat && lng) {
    bodyHtml +=
      '<div style="padding:8px 16px 10px">' +
      '<div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Coordinates</div>' +
      '<div style="font-size:11px;color:var(--text2);font-family:monospace">' + Number(lat).toFixed(6) + ', ' + Number(lng).toFixed(6) + '</div></div>';
  }
  sights.innerHTML = bodyHtml || '<div style="padding:12px 16px;font-size:12px;color:var(--text3)">No details recorded</div>';

  actions.innerHTML =
    '<button class="popup-act-btn" onclick="openObsEdit()">' +
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
    ' Edit</button>' +
    '<button class="popup-act-btn danger" id="obsDelBtn" onclick="deleteObsSighting(this)">' +
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>' +
    ' Delete</button>';

  popup.classList.add('show');
  const obsColorRow = buildColorSwatchRow(
    s.pin_color || '#E5B53B',
    c => setObsColor(s.id, c)
  );
  obsColorRow.id = 'camColorRow';
  actions.parentNode.appendChild(obsColorRow);
}

function openObsEdit() {
  if(!activeObsSighting) return;
  const s = activeObsSighting;
  const deerRow = document.getElementById('obsEditDeerRow');
  deerRow.innerHTML = '';
  DTYPES.forEach(d => {
    const c = document.createElement('div');
    c.className = 'chip' + (d === s.deer_type ? ' on' : '');
    c.textContent = d;
    c.onclick = () => {
      deerRow.querySelectorAll('.chip').forEach(x => x.classList.remove('on'));
      c.classList.add('on');
      const isBuck = d.startsWith('Buck');
      document.getElementById('obsEditBuckSection').style.display = isBuck ? '' : 'none';
    };
    deerRow.appendChild(c);
  });
  const behRow = document.getElementById('obsEditBehRow');
  behRow.innerHTML = '';
  BEHS.forEach(b => {
    const c = document.createElement('div');
    c.className = 'chip' + (b === s.behavior ? ' on' : '');
    c.textContent = b;
    c.onclick = () => { behRow.querySelectorAll('.chip').forEach(x => x.classList.remove('on')); c.classList.add('on'); };
    behRow.appendChild(c);
  });
  const isBuck = s.deer_type && s.deer_type.startsWith('Buck');
  document.getElementById('obsEditBuckSection').style.display = isBuck ? '' : 'none';
  document.getElementById('obsEditBuckName').value = s.buck_name || '';
  document.getElementById('obsEditNotes').value = s.notes || '';
  closePopup();
  document.getElementById('obsEditModal').classList.add('on');
}

async function submitObsEdit() {
  if(!activeObsSighting) return;
  const deerChip = document.querySelector('#obsEditDeerRow .chip.on');
  const behChip  = document.querySelector('#obsEditBehRow .chip.on');
  const isBuck = deerChip && deerChip.textContent.startsWith('Buck');
  const obsEditBuckName = isBuck ? (document.getElementById('obsEditBuckName').value.trim() || null) : null;
  const obsEditBuckId = obsEditBuckName ? await resolveBuckId(obsEditBuckName) : null;
  const updates = {
    deer_type: deerChip ? deerChip.textContent : activeObsSighting.deer_type,
    behavior:  behChip  ? behChip.textContent  : activeObsSighting.behavior,
    buck_name: obsEditBuckName,
    buck_id: obsEditBuckId,
    notes:     document.getElementById('obsEditNotes').value.trim() || null
  };
  const {error} = await sb.from('sightings').update(updates).eq('id', activeObsSighting.id);
  if(error) { showToast('Save failed'); return; }
  const idx = sightings.findIndex(x => x.id === activeObsSighting.id);
  if(idx >= 0) Object.assign(sightings[idx], updates);
  if(obsEditBuckId && activeObsSighting.date) updateBuckDates(obsEditBuckId, activeObsSighting.date);
  activeObsSighting = null;
  document.getElementById('obsEditModal').classList.remove('on');
  addObsMarkers();
  showToast('Observation updated');
}

function cancelObsEdit() {
  document.getElementById('obsEditModal').classList.remove('on');
}

function deleteObsSighting(btnEl) {
  if(!activeObsSighting) return;
  if(btnEl.dataset.pending === '1') {
    const s = activeObsSighting;
    closePopup();
    sb.from('sightings').delete().eq('id', s.id).then(({error}) => {
      if(error) { showToast('Delete failed'); return; }
      sightings = sightings.filter(x => x.id !== s.id);
      addObsMarkers();
      showToast('Observation removed');
    });
    activeObsSighting = null;
  } else {
    btnEl.dataset.pending = '1';
    btnEl.textContent = 'Confirm?';
    btnEl.style.background = 'rgba(224,85,85,0.15)';
    setTimeout(() => { if(btnEl.dataset.pending === '1') { btnEl.dataset.pending = ''; } }, 3000);
  }
}

