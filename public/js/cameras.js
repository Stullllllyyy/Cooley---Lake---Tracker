// Huginn — cameras.js
// Camera pins: rendering, popup, add/edit/move/archive, pin context menu
// Also includes: shared move system, color swatch, feature marker delete
// Depends on: config.js (PROPERTY_ID, CAMNAMES, FEAT_COLORS, PIN_COLORS, PIN_COLOR_STROKES),
//   utils.js (showToast, compressImage), auth.js (sb), ui.js (showConfirmModal)
// References from inline: mapInstance, mapboxgl, mapMarkers, sightings, buckColor,
//   getNamedBucks, refreshMapPins, addObsMarkers, propertyMarkers, propertyMarkerInstances,
//   renderPropertyMarkers, addPropertyMarker, activeFeatureMarker,
//   tapToPlaceLngLat, tapToPlaceActive, cancelTapToPlace, yearFiltered, closePopup

// Camera locations - stored in Supabase, editable via drag
var camLocations = {
  'Dan':         { lng: -88.2738, lat: 45.0195 },
  'Colin':       { lng: -88.2768, lat: 45.0185 },
  'Ridge':       { lng: -88.2710, lat: 45.0175 },
  'Behind Rons': { lng: -88.2712, lat: 45.0162 },
  'By Eric':     { lng: -88.2695, lat: 45.0158 },
};


async function loadCamLocations() {
  if(onboardingMode) return;
  const { data, error } = await sb.from('cameras').select('name, lng, lat, color').eq('property_id', PROPERTY_ID).is('deleted_at', null).order('id');
  if(error) { console.error('loadCamLocations error:', error); return; }
  if(data && data.length) {
    data.forEach(c => {
      if(c.lng && c.lat) camLocations[c.name] = { lng: c.lng, lat: c.lat, color: c.color || null };
    });
  }
  // Refresh pins once locations loaded
  if(mapInstance) addCamMarkers();
}

async function saveCamLocation(name, lng, lat) {
  try {
    await sb.from('cameras').update({ lng, lat }).eq('name', name);
    camLocations[name] = { lng, lat };
  } catch(e) { console.error('Save cam location failed:', e); }
}


async function addCamMarkers() {
  Object.values(mapMarkers).forEach(m => m.remove());
  mapMarkers = {};

  Object.entries(camLocations).forEach(([name, pos]) => {
    const cs = yearFiltered(sightings).filter(s => s.camera_name === name);
    const cnt = cs.length;
    const mature = cs.some(s => s.deer_type && s.deer_type.includes('Mature'));
    // isBuckFilter is true only when a specific named buck is selected — NOT for 'all', 'all-bucks', or 'none'
    const isBuckFilter = curMapFilter !== 'all' && curMapFilter !== 'all-bucks' && curMapFilter !== 'none';
    const buckFiltered = isBuckFilter ? cs.filter(s => s.buck_name === curMapFilter) : cs;
    const hasBuck = buckFiltered.length > 0;

    // Colors — use saved pin color as base; buckColor overrides only when a named buck IS active
    const baseColor = pos.color || '#8C7355';
    const baseStroke = PIN_COLOR_STROKES[baseColor] || '#a08468';
    let fill, stroke;
    if(isBuckFilter) {
      fill = hasBuck ? buckColor(curMapFilter) : baseColor;
      stroke = hasBuck ? buckColor(curMapFilter) : baseStroke;
    } else {
      fill = baseColor; stroke = baseStroke;
    }

    const el = document.createElement('div');
    // Only fade pins when a specific named buck IS selected and this camera has no sightings of that buck
    el.className = 'cam-marker' + (isBuckFilter && !hasBuck ? ' faded' : '');

    // Time ring — only when a specific named buck is selected
    let ringHTML = '';
    if(isBuckFilter && hasBuck) {
      const buckSights = cs.filter(s => s.buck_name === curMapFilter && s.time);
      const total = buckSights.length || 1;
      // Count per period
      let night = 0, dawn = 0, midday = 0, dusk = 0;
      buckSights.forEach(s => {
        const h = parseInt(s.time);
        if(h >= 5 && h < 10) dawn++;
        else if(h >= 10 && h < 16) midday++;
        else if(h >= 16 && h < 20) dusk++;
        else night++;
      });
      // Build arc segments on a 52px circle (cx=26,cy=26,r=22)
      const cx = 26, cy = 26, r = 22;
      const circ = 2 * Math.PI * r;
      const periods = [
        { pct: night/total,  color: '#2a2a3a', stroke: '#444' },
        { pct: dawn/total,   color: '#7a9275', stroke: '#7a9275' },
        { pct: midday/total, color: '#e87a3a', stroke: '#e87a3a' },
        { pct: dusk/total,   color: '#c8a951', stroke: '#c8a951' },
      ];
      // Draw arcs clockwise starting from top
      let offset = circ / 4; // start at top
      let arcs = '';
      periods.forEach(p => {
        if(p.pct <= 0) { return; }
        const dash = p.pct * circ;
        const gap = circ - dash;
        const w = p.pct > 0.25 ? 5 : 4; // thicker for dominant period
        arcs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
          stroke="${p.stroke}" stroke-width="${w}" stroke-opacity="0.9"
          stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
          stroke-dashoffset="${offset.toFixed(2)}"
          stroke-linecap="round"/>`;
        offset -= dash; // move clockwise
      });
      ringHTML = `<svg width="52" height="52" viewBox="0 0 52 52" style="position:absolute;top:-8px;left:-8px;pointer-events:none;z-index:0">${arcs}</svg>`;
    }

    // Teardrop SVG pin — label above so tip is at exact element bottom (anchor:'bottom' offset:[0,0])
    el.innerHTML = `
      <div class="cam-lbl">${name}</div>
      <div class="cam-pin" style="position:relative">
        ${ringHTML}
        <svg class="pin-bg" viewBox="0 0 36 44" fill="none">
          <path d="M18 2C10.268 2 4 8.268 4 16c0 10 14 28 14 28s14-18 14-28C32 8.268 25.732 2 18 2z"
            fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="3"/>
          <path d="M18 2C10.268 2 4 8.268 4 16c0 10 14 28 14 28s14-18 14-28C32 8.268 25.732 2 18 2z"
            fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
        </svg>
        <div class="cam-pin-content" style="position:relative;z-index:1">
          <div class="cam-pin-ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></div>
          <div class="cam-pin-cnt">${cnt > 0 ? cnt : ''}</div>
        </div>
      </div>
    `;

    // Single tap - show popup
    let pressTimer;
    el.addEventListener('touchstart', e => {
      pressTimer = setTimeout(() => {
        e.preventDefault();
        showPinMenu(name, e.touches[0].clientX, e.touches[0].clientY);
      }, 600);
    }, {passive:true});
    el.addEventListener('touchend', () => clearTimeout(pressTimer), {passive: true});
    el.addEventListener('touchmove', () => clearTimeout(pressTimer), {passive: true});

    el.addEventListener('click', e => {
      if(editMode) return;
      e.stopPropagation();
      showPin(name);
    });

    // Right click on desktop
    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      showPinMenu(name, e.clientX, e.clientY);
    });

    const marker = new mapboxgl.Marker({ element: el, draggable: editMode, anchor: 'bottom', offset: [0, 0] })
      .setLngLat([pos.lng, pos.lat])
      .addTo(mapInstance);

    marker.on('dragend', async () => {
      const ll = marker.getLngLat();
      await saveCamLocation(name, ll.lng, ll.lat);
    });

    mapMarkers[name] = marker;
  });
}


async function showPin(camName) {
  pendingCamColor = null;
  pendingFacing = null;
  const cs = yearFiltered(sightings).filter(s => s.camera_name === camName);
  const bucks = cs.filter(s => s.deer_type && s.deer_type.includes('Buck')).length;
  const mature = cs.filter(s => s.deer_type && s.deer_type.includes('Mature')).length;
  const bc_color = mature > 0;
  const popup = document.getElementById('camPopup');
  const title = document.getElementById('popupTitle');
  const stats = document.getElementById('popupStats');
  const sights = document.getElementById('popupSightings');
  title.textContent = camName;
  title.style.color = '';
  stats.style.gridTemplateColumns = '';
  popup.className = 'cam-popup' + (bc_color ? ' gold' : '');
  stats.innerHTML = `
    <div class="pstat"><div class="pstat-n">${cs.length}</div><div class="pstat-l">Total</div></div>
    <div class="pstat"><div class="pstat-n">${bucks}</div><div class="pstat-l">Bucks</div></div>
    <div class="pstat"><div class="pstat-n">${mature}</div><div class="pstat-l">Mature</div></div>`;
  if(cs.length === 0) {
    sights.innerHTML = '<div class="pp-empty">No sightings logged yet.</div>';
  } else {
    const bc2 = s => s.buck_name ? buckColor(s.buck_name) : null;
    sights.innerHTML = cs.slice(0,2).map(s => `<div class="popup-s" onclick="showDet(${s.id})">
      ${s.image_url ? `<img class="popup-sight-img" src="${s.image_url}" alt=""/>` : ''}
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <span style="font-size:13px;font-weight:${s.deer_type&&s.deer_type.includes('Mature')?700:400};color:${s.deer_type&&s.deer_type.includes('Mature')?'var(--gold)':'var(--text)'}">${s.deer_type}</span>
          ${s.buck_name?`<span style="font-size:10px;margin-left:5px;padding:1px 6px;border-radius:8px;background:rgba(0,0,0,0.4);color:${bc2(s)};border:1px solid ${bc2(s)}">&#9679; ${s.buck_name}</span>`:''}
        </div>
        <span style="font-size:11px;color:var(--text2)">${fmtT(s.time)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:3px">
        <span style="font-size:11px;color:var(--text3)">${s.behavior||''}</span>
        <span style="font-size:11px;color:var(--text3)">${fmtD(s.date)}</span>
      </div>
    </div>`).join('');
    if(cs.length > 2) {
      sights.innerHTML += `<button class="popup-more" onclick="filterGo('${camName}')">View all ${cs.length} sightings &rarr;</button>`;
    }
  }
  // Actions footer — render immediately so popup opens without waiting on Supabase
  const actions = document.getElementById('popupActions');
  actions.innerHTML = `
    <button class="popup-act-btn" onclick="renameCamera('${camName}')">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      Rename
    </button>
    <button class="popup-act-btn" onclick="moveCameraPin('${camName}')">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/></svg>
      Move Pin
    </button>
    <button class="popup-act-btn danger" onclick="confirmDeleteCamera('${camName}')">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
      Delete
    </button>`;
  // Remove any extra rows left from a previous popup type
  ['camColorRow','camFacingRow','camSaveRow','featSaveRow'].forEach(id => { const el = document.getElementById(id); if(el) el.remove(); });
  // Show popup immediately
  popup.classList.add('show');
  // Color row — synchronous (camLocations already loaded), visible right away
  const camColorRow = buildColorSwatchRow(
    (camLocations[camName] && camLocations[camName].color) || '#8C7355',
    c => { pendingCamColor = c; }
  );
  camColorRow.id = 'camColorRow';
  actions.parentNode.appendChild(camColorRow);
  // Fetch facing direction async — insert above color row when ready
  const camData = await sb.from('cameras').select('facing').eq('name', camName).is('deleted_at', null).single();
  const currentFacing = camData?.data?.facing || '';
  const facingHtml = document.createElement('div');
  facingHtml.id = 'camFacingRow';
  facingHtml.style.cssText = 'padding:8px 12px 4px;border-top:1px solid var(--border)';
  facingHtml.innerHTML = `<div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Camera Facing Direction</div>
    <div style="display:flex;flex-wrap:wrap;gap:5px">
      ${FACING_DIRS.map(d => `<button onclick="stageFacing('${d}',this)"
        style="padding:4px 8px;border-radius:6px;border:1px solid ${currentFacing===d?'var(--blue)':'var(--border2)'};background:${currentFacing===d?'rgba(74,127,193,0.15)':'transparent'};color:${currentFacing===d?'var(--blue)':'var(--text3)'};font-size:11px;cursor:pointer;font-family:var(--font)">${d}</button>`).join('')}
    </div>`;
  // Insert facing row above the color row so color row stays at bottom
  const colorEl = document.getElementById('camColorRow');
  if(colorEl) actions.parentNode.insertBefore(facingHtml, colorEl);
  else actions.parentNode.appendChild(facingHtml);
  // Save button row
  const camSaveRow = document.createElement('div');
  camSaveRow.id = 'camSaveRow';
  camSaveRow.style.cssText = 'padding:8px 12px 12px;border-top:1px solid var(--border)';
  camSaveRow.innerHTML = `<button onclick="saveCamPinSettings('${camName}')" style="width:100%;padding:9px;border-radius:8px;border:1px solid var(--border2);background:var(--surface2);color:var(--text1);font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font)">Save Changes</button>`;
  actions.parentNode.appendChild(camSaveRow);
}



async function setCameraFacing(camName, dir, btn) {
  await sb.from('cameras').update({ facing: dir }).eq('name', camName);
  // Update button styles in-place
  btn.closest('div').querySelectorAll('button').forEach(b => {
    const isThis = b.textContent.trim() === dir;
    b.style.borderColor = isThis ? 'var(--blue)' : 'var(--border2)';
    b.style.background = isThis ? 'rgba(74,127,193,0.15)' : 'transparent';
    b.style.color = isThis ? 'var(--blue)' : 'var(--text3)';
  });
}

function stageFacing(dir, btn) {
  pendingFacing = dir;
  btn.closest('div').querySelectorAll('button').forEach(b => {
    const isThis = b.textContent.trim() === dir;
    b.style.borderColor = isThis ? 'var(--blue)' : 'var(--border2)';
    b.style.background = isThis ? 'rgba(74,127,193,0.15)' : 'transparent';
    b.style.color = isThis ? 'var(--blue)' : 'var(--text3)';
  });
}

async function saveCamPinSettings(camName) {
  const updates = {};
  if(pendingCamColor !== null) updates.color = pendingCamColor;
  if(pendingFacing !== null) updates.facing = pendingFacing;
  if(!Object.keys(updates).length) { showToast('Nothing to save'); return; }
  const {error} = await sb.from('cameras').update(updates).eq('name', camName);
  if(error) { showToast('Save failed'); return; }
  if(updates.color) {
    if(camLocations[camName]) camLocations[camName].color = updates.color;
    addCamMarkers();
  }
  pendingCamColor = null;
  pendingFacing = null;
  showToast('\u2713 Saved');
}

async function saveFeatPinSettings(markerId) {
  if(pendingFeatColor === null) { showToast('Nothing to save'); return; }
  const {error} = await sb.from('property_markers').update({ color: pendingFeatColor }).eq('id', markerId);
  if(error) { showToast('Save failed'); return; }
  const idx = propertyMarkers.findIndex(x => x.id === markerId);
  if(idx >= 0) propertyMarkers[idx].color = pendingFeatColor;
  renderPropertyMarkers();
  pendingFeatColor = null;
  showToast('\u2713 Saved');
}

async function setCameraColor(camName, color) {
  await sb.from('cameras').update({ color }).eq('name', camName);
  if(camLocations[camName]) camLocations[camName].color = color;
  addCamMarkers();
}

async function renameCamera(oldName) {
  // Show inline rename modal instead of browser prompt
  let modal = document.getElementById('renameCamModal');
  if(!modal) {
    modal = document.createElement('div');
    modal.id = 'renameCamModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:600;display:flex;align-items:center;justify-content:center;padding:24px';
    modal.innerHTML = `<div style="background:var(--surface);border:1px solid var(--border2);border-radius:16px;padding:20px;width:100%;max-width:340px;box-shadow:0 8px 40px rgba(0,0,0,0.8)">
      <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px">Rename Camera</div>
      <div id="renameCamSub" style="font-size:11px;color:var(--text3);margin-bottom:14px"></div>
      <input id="renameCamInput" style="width:100%;background:var(--bg);border:1px solid var(--border2);border-radius:10px;padding:10px 12px;color:var(--text);font-size:14px;font-family:var(--font);outline:none;margin-bottom:14px"/>
      <div style="display:flex;gap:8px">
        <button onclick="document.getElementById('renameCamModal').style.display='none'" style="flex:1;padding:10px;border:1px solid var(--border2);border-radius:10px;background:transparent;color:var(--text2);font-size:13px;cursor:pointer;font-family:var(--font)">Cancel</button>
        <button id="renameCamConfirm" style="flex:1;padding:10px;border:none;border-radius:10px;background:var(--gold);color:var(--bg);font-size:13px;font-weight:700;cursor:pointer;font-family:var(--font)">Rename</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if(e.target === modal) modal.style.display = 'none'; });
  }
  document.getElementById('renameCamSub').textContent = `Currently: "${oldName}"`;
  const input = document.getElementById('renameCamInput');
  input.value = oldName;
  modal.style.display = 'flex';
  setTimeout(() => { input.focus(); input.select(); }, 100);
  // Wire confirm button
  const confirmBtn = document.getElementById('renameCamConfirm');
  confirmBtn.onclick = async () => {
    const trimmed = input.value.trim();
    if(!trimmed || trimmed === oldName) { modal.style.display = 'none'; return; }
    modal.style.display = 'none';
    await sb.from('cameras').update({ name: trimmed }).eq('name', oldName);
    await sb.from('sightings').update({ camera_name: trimmed }).eq('camera_name', oldName);
    // Update local camLocations
    if(camLocations[oldName]) { camLocations[trimmed] = camLocations[oldName]; delete camLocations[oldName]; }
    closePopup();
    await loadCamLocations();
    refreshMapPins();
    showToast(`Camera renamed to "${trimmed}"`);
  };
}

function enableDragForCamera(camName) {
  // Legacy — replaced by moveCameraPin(). Redirect for safety.
  moveCameraPin(camName);
}

async function confirmDeleteCamera(camName) {
  const cs = sightings.filter(s => s.camera_name === camName).length;
  const msg = cs > 0
    ? 'Archive camera "' + camName + '"? It has ' + cs + ' sightings. Your sighting history will be preserved.'
    : 'Archive camera "' + camName + '"? You can restore it later.';
  const ok = await showConfirmModal(msg, 'Archive', 'archive');
  if(!ok) return;
  await sb.from('cameras').update({ deleted_at: new Date().toISOString() }).eq('name', camName);
  delete camLocations[camName];
  closePopup();
  await loadCamLocations();
  refreshMapPins();
}


var menuTargetCam = null;

function showPinMenu(name, x, y) {
  menuTargetCam = name;
  const menu = document.getElementById('pinMenu');
  menu.style.display = 'block';
  // Position near tap point
  const menuW = 180;
  const left = Math.min(x, window.innerWidth - menuW - 10);
  const top = Math.min(y + 8, window.innerHeight - 150);
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
  // Close on outside tap
  setTimeout(() => document.addEventListener('click', closePinMenu, {once:true}), 50);
}

function closePinMenu() {
  document.getElementById('pinMenu').style.display = 'none';
  menuTargetCam = null;
}

async function renameCameraFromMenu() {
  if(!menuTargetCam) return;
  closePinMenu();
  renameCamera(menuTargetCam);
}

async function deleteCameraFromMenu() {
  if(!menuTargetCam) return;
  closePinMenu();
  const ok = await showConfirmModal('Archive camera "' + menuTargetCam + '"? Your sighting history will be preserved.', 'Archive', 'archive');
  if(!ok) return;
  try {
    await sb.from('cameras').update({ deleted_at: new Date().toISOString() }).eq('name', menuTargetCam);
  } catch(e) { console.error(e); }
  delete camLocations[menuTargetCam];
  const idx = CAMNAMES.indexOf(menuTargetCam);
  if(idx > -1) CAMNAMES.splice(idx, 1);
  if(mapMarkers[menuTargetCam]) { mapMarkers[menuTargetCam].remove(); delete mapMarkers[menuTargetCam]; }
  buildMapFilters();
}


function openTtpAddCamModal() {
  const coordEl = document.getElementById('ttpAddCamCoords');
  if(coordEl && tapToPlaceLngLat) {
    coordEl.textContent = tapToPlaceLngLat.lat.toFixed(5) + ', ' + tapToPlaceLngLat.lng.toFixed(5);
  }
  document.getElementById('ttpAddCamName').value = '';
  // Build facing chips
  const row = document.getElementById('ttpAddCamFacingRow');
  row.innerHTML = '';
  ['N','NE','E','SE','S','SW','W','NW'].forEach(dir => {
    const c = document.createElement('div');
    c.className = 'chip';
    c.textContent = dir;
    c.onclick = () => {
      row.querySelectorAll('.chip').forEach(x => x.classList.remove('on'));
      c.classList.add('on');
    };
    row.appendChild(c);
  });
  document.getElementById('ttpAddCamModal').classList.add('on');
  setTimeout(() => document.getElementById('ttpAddCamName').focus(), 120);
}

function cancelTtpAddCam() {
  document.getElementById('ttpAddCamModal').classList.remove('on');
  cancelTapToPlace();
}

async function confirmTtpAddCam() {
  const name = document.getElementById('ttpAddCamName').value.trim();
  if(!name) { showToast('Camera name is required', 2000); return; }
  const facingChip = document.getElementById('ttpAddCamFacingRow').querySelector('.chip.on');
  const facing = facingChip ? facingChip.textContent : null;
  // Capture loc before cancelTapToPlace() nulls it
  const loc = tapToPlaceLngLat ? { lat: tapToPlaceLngLat.lat, lng: tapToPlaceLngLat.lng } : null;
  if(!loc) { showToast('No location set', 2000); return; }
  document.getElementById('ttpAddCamModal').classList.remove('on');
  cancelTapToPlace();
  try {
    await sb.from('cameras').insert({ name, lat: loc.lat, lng: loc.lng, facing, active: true, property_id: PROPERTY_ID });
  } catch(e) { console.error('Add camera error:', e); }
  camLocations[name] = { lng: loc.lng, lat: loc.lat };
  if(!CAMNAMES.includes(name)) CAMNAMES.splice(CAMNAMES.length - 1, 0, name);
  addCamMarkers();
  buildMapFilters();
  showToast(`Camera "${name}" added`);
}


var ttpOnCancel = null; // optional callback when tap-to-place is cancelled
var ttpMoveMarkerId = null; // ID of marker being moved (property_markers id or camera name)
var ttpMoveMarkerType = null; // 'camera' or 'marker'
var ttpMoveMarkerInst = null; // existing marker instance (hidden during move)
var ttpMoveTempMarker = null; // temporary draggable marker
var ttpMoveOldLat = null;
var ttpMoveOldLng = null;

function moveFeatMarker() {
  if(!activeFeatureMarker) return;
  if(ttpMoveMarkerId) { console.log('Move already in progress, ignoring duplicate call'); return; }
  const m = activeFeatureMarker;
  ttpMoveMarkerId = m.id;
  ttpMoveMarkerType = 'marker';
  ttpMoveOldLat = m.lat;
  ttpMoveOldLng = m.lng;
  closePopup();

  // Find the rendered Mapbox marker instance for this pin
  let targetInst = null;
  for(const inst of propertyMarkerInstances) {
    const ll = inst.getLngLat();
    if(Math.abs(ll.lat - m.lat) < 0.00001 && Math.abs(ll.lng - m.lng) < 0.00001) {
      targetInst = inst;
      break;
    }
  }
  if(!targetInst) { showToast('Could not find pin on map'); ttpMoveMarkerId = null; ttpMoveMarkerType = null; return; }
  ttpMoveMarkerInst = targetInst;

  // Hide the existing marker — do not remove
  const existingEl = targetInst.getElement();
  if(existingEl) existingEl.style.visibility = 'hidden';

  // Build temporary draggable marker with SAME SVG/color as existing pin
  // ttpGlow animation on INNER .cam-pin div — NOT outer element (Mapbox controls outer transform)
  const t = m.type;
  const fill = m.color || FEAT_COLORS[t] || '#8C7355';
  const stroke = m.color ? (PIN_COLOR_STROKES[m.color] || '#a08468') : (FEAT_STROKES[t] || '#a08468');
  const icon = FEAT_ICONS[t] || '';
  const lbl = m.name || t;

  const tempEl = document.createElement('div');
  tempEl.className = 'cam-marker';
  tempEl.innerHTML =
    '<div class="cam-lbl">' + lbl + '</div>' +
    '<div class="cam-pin" style="animation:ttpGlow 1.4s ease-in-out infinite">' +
      '<svg class="pin-bg" viewBox="0 0 36 44" fill="none">' +
        '<path d="M18 2C10.268 2 4 8.268 4 16c0 10 14 28 14 28s14-18 14-28C32 8.268 25.732 2 18 2z"' +
        ' fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="3"/>' +
      '<path d="M18 2C10.268 2 4 8.268 4 16c0 10 14 28 14 28s14-18 14-28C32 8.268 25.732 2 18 2z"' +
        ' fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.5"/>' +
      '</svg>' +
      '<div class="cam-pin-content"><div class="cam-pin-ico">' + icon + '</div></div>' +
    '</div>';

  ttpMoveTempMarker = new mapboxgl.Marker({ element: tempEl, anchor: 'bottom', offset: [0, 0], draggable: true })
    .setLngLat([m.lng, m.lat])
    .addTo(mapInstance);

  // Track drag position
  ttpMoveTempMarker.on('drag', onMoveDrag);
  ttpMoveTempMarker.on('dragend', onMoveDrag);

  // Show location confirm card
  tapToPlaceActive = true;
  tapToPlaceLngLat = { lat: m.lat, lng: m.lng };
  const coordEl = document.getElementById('ttpLocCoords');
  if(coordEl) coordEl.textContent = m.lat.toFixed(5) + ', ' + m.lng.toFixed(5);
  document.getElementById('ttpLocModal').classList.add('on');

  // Confirm callback
  ttpAfterConfirm = () => {
    const ll = ttpMoveTempMarker.getLngLat();
    const newLat = ll.lat;
    const newLng = ll.lng;

    // Clean up TTP state (do not call cancelTapToPlace)
    tapToPlaceActive = false;
    tapToPlaceLngLat = null;
    ttpAfterConfirm = null;
    document.getElementById('ttpLocModal').classList.remove('on');

    // Remove temp marker
    ttpMoveTempMarker.remove();
    ttpMoveTempMarker = null;

    sb.from('property_markers').update({ lat: newLat, lng: newLng }).eq('id', ttpMoveMarkerId).then(({error}) => {
      if(error) {
        console.error('Move save error:', error);
        showToast('Move failed — try again');
        if(existingEl) existingEl.style.visibility = 'visible';
      } else {
        const idx = propertyMarkers.findIndex(x => x.id === ttpMoveMarkerId);
        if(idx >= 0) {
          propertyMarkers[idx].lat = newLat;
          propertyMarkers[idx].lng = newLng;
        }
        renderPropertyMarkers();
        showToast('Location updated');
      }
      ttpMoveMarkerId = null;
      ttpMoveMarkerType = null;
      ttpMoveMarkerInst = null;
      ttpMoveTempMarker = null;
      ttpMoveOldLat = null;
      ttpMoveOldLng = null;
      activeFeatureMarker = null;
    });
  };

  // Cancel callback
  ttpOnCancel = () => {
    if(ttpMoveTempMarker) { ttpMoveTempMarker.remove(); ttpMoveTempMarker = null; }
    if(ttpMoveMarkerInst) {
      const el = ttpMoveMarkerInst.getElement();
      if(el) el.style.visibility = 'visible';
    }
    ttpMoveMarkerId = null;
    ttpMoveMarkerType = null;
    ttpMoveMarkerInst = null;
    ttpMoveOldLat = null;
    ttpMoveOldLng = null;
  };
}

function moveCameraPin(camName) {
  if(ttpMoveMarkerId) { console.log('Move already in progress'); return; }
  const pos = camLocations[camName];
  if(!pos) { showToast('Camera location not found'); return; }

  ttpMoveMarkerId = camName;
  ttpMoveMarkerType = 'camera';
  ttpMoveOldLat = pos.lat;
  ttpMoveOldLng = pos.lng;
  closePopup();

  // Find existing marker instance
  const targetInst = mapMarkers[camName];
  if(!targetInst) { showToast('Could not find pin on map'); ttpMoveMarkerId = null; ttpMoveMarkerType = null; return; }
  ttpMoveMarkerInst = targetInst;

  // Hide existing marker — do not remove
  const existingEl = targetInst.getElement();
  if(existingEl) existingEl.style.visibility = 'hidden';

  // Build temp draggable marker matching camera pin SVG/color
  // ttpGlow animation on INNER .cam-pin div — NOT outer element (Mapbox controls outer transform)
  const baseColor = pos.color || '#8C7355';
  const baseStroke = PIN_COLOR_STROKES[baseColor] || '#a08468';

  const tempEl = document.createElement('div');
  tempEl.className = 'cam-marker';
  tempEl.innerHTML =
    '<div class="cam-lbl">' + camName + '</div>' +
    '<div class="cam-pin" style="animation:ttpGlow 1.4s ease-in-out infinite">' +
      '<svg class="pin-bg" viewBox="0 0 36 44" fill="none">' +
        '<path d="M18 2C10.268 2 4 8.268 4 16c0 10 14 28 14 28s14-18 14-28C32 8.268 25.732 2 18 2z"' +
        ' fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="3"/>' +
      '<path d="M18 2C10.268 2 4 8.268 4 16c0 10 14 28 14 28s14-18 14-28C32 8.268 25.732 2 18 2z"' +
        ' fill="' + baseColor + '" stroke="' + baseStroke + '" stroke-width="1.5"/>' +
      '</svg>' +
      '<div class="cam-pin-content"><div class="cam-pin-ico">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
        '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' +
      '</div></div>' +
    '</div>';

  ttpMoveTempMarker = new mapboxgl.Marker({ element: tempEl, anchor: 'bottom', offset: [0, 0], draggable: true })
    .setLngLat([pos.lng, pos.lat])
    .addTo(mapInstance);

  ttpMoveTempMarker.on('drag', onMoveDrag);
  ttpMoveTempMarker.on('dragend', onMoveDrag);

  // Show location confirm card
  tapToPlaceActive = true;
  tapToPlaceLngLat = { lat: pos.lat, lng: pos.lng };
  const coordEl = document.getElementById('ttpLocCoords');
  if(coordEl) coordEl.textContent = pos.lat.toFixed(5) + ', ' + pos.lng.toFixed(5);
  document.getElementById('ttpLocModal').classList.add('on');

  // Confirm callback
  ttpAfterConfirm = async () => {
    const ll = ttpMoveTempMarker.getLngLat();
    const newLat = ll.lat;
    const newLng = ll.lng;

    tapToPlaceActive = false;
    tapToPlaceLngLat = null;
    ttpAfterConfirm = null;
    document.getElementById('ttpLocModal').classList.remove('on');

    ttpMoveTempMarker.remove();
    ttpMoveTempMarker = null;

    const { error } = await sb.from('cameras').update({ lat: newLat, lng: newLng }).eq('name', camName);
    if(error) {
      console.error('Camera move save error:', error);
      showToast('Move failed — try again');
      if(existingEl) existingEl.style.visibility = 'visible';
    } else {
      camLocations[camName] = { ...camLocations[camName], lng: newLng, lat: newLat };
      addCamMarkers();
      showToast('Location updated');
    }
    ttpMoveMarkerId = null;
    ttpMoveMarkerType = null;
    ttpMoveMarkerInst = null;
    ttpMoveTempMarker = null;
    ttpMoveOldLat = null;
    ttpMoveOldLng = null;
  };

  // Cancel callback
  ttpOnCancel = () => {
    if(ttpMoveTempMarker) { ttpMoveTempMarker.remove(); ttpMoveTempMarker = null; }
    if(ttpMoveMarkerInst) {
      const el = ttpMoveMarkerInst.getElement();
      if(el) el.style.visibility = 'visible';
    }
    ttpMoveMarkerId = null;
    ttpMoveMarkerType = null;
    ttpMoveMarkerInst = null;
    ttpMoveOldLat = null;
    ttpMoveOldLng = null;
  };
}

function onMoveDrag() {
  if(!ttpMoveTempMarker) return;
  const pos = ttpMoveTempMarker.getLngLat();
  tapToPlaceLngLat = { lat: pos.lat, lng: pos.lng };
  const coordEl = document.getElementById('ttpLocCoords');
  if(coordEl) coordEl.textContent = pos.lat.toFixed(5) + ', ' + pos.lng.toFixed(5);
}


function deleteFeatMarker(btnEl) {
  if(!activeFeatureMarker) return;
  if(btnEl.dataset.pending === '1') {
    const m = activeFeatureMarker;
    closePopup();
    sb.from('property_markers').update({ deleted_at: new Date().toISOString() }).eq('id', m.id).then(({error}) => {
      if(error) { showToast('Archive failed — try again'); return; }
      propertyMarkers = propertyMarkers.filter(x => x.id !== m.id);
      renderPropertyMarkers();
      showToast((m.name || m.type) + ' archived');
    });
    activeFeatureMarker = null;
  } else {
    btnEl.dataset.pending = '1';
    btnEl.textContent = 'Confirm?';
    btnEl.style.background = 'rgba(224,85,85,0.15)';
    setTimeout(() => {
      if(btnEl.dataset.pending === '1') { btnEl.dataset.pending = ''; }
    }, 3000);
  }
}


// --- Universal pin color swatch component ---
function buildColorSwatchRow(currentColor, onColorSelect) {
  const row = document.createElement('div');
  row.style.cssText = 'padding:8px 12px 10px;border-top:1px solid var(--border)';
  const lbl = document.createElement('div');
  lbl.style.cssText = 'font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:7px';
  lbl.textContent = 'Pin Color';
  row.appendChild(lbl);
  const swatchRow = document.createElement('div');
  swatchRow.style.cssText = 'display:flex;gap:7px;flex-wrap:wrap';
  PIN_COLORS.forEach(c => {
    const sw = document.createElement('div');
    const isActive = c.toLowerCase() === (currentColor || '').toLowerCase();
    sw.style.cssText =
      'width:22px;height:22px;border-radius:50%;background:' + c +
      ';cursor:pointer;border:2px solid ' + (isActive ? '#fff' : 'transparent') +
      ';box-shadow:' + (isActive ? '0 0 0 1.5px ' + c : '0 1px 4px rgba(0,0,0,0.4)') +
      ';transition:transform 0.1s';
    sw.title = c;
    sw.addEventListener('click', () => {
      swatchRow.querySelectorAll('div').forEach(s => {
        s.style.border = '2px solid transparent';
        s.style.boxShadow = '0 1px 4px rgba(0,0,0,0.4)';
      });
      sw.style.border = '2px solid #fff';
      sw.style.boxShadow = '0 0 0 1.5px ' + c;
      onColorSelect(c);
    });
    swatchRow.appendChild(sw);
  });
  row.appendChild(swatchRow);
  return row;
}

async function setFeatureColor(markerId, color) {
  const {error} = await sb.from('property_markers').update({ color }).eq('id', markerId);
  if(error) { showToast('Color save failed'); return; }
  const idx = propertyMarkers.findIndex(x => x.id === markerId);
  if(idx >= 0) propertyMarkers[idx].color = color;
  renderPropertyMarkers();
}

async function setObsColor(sightingId, color) {
  const {error} = await sb.from('sightings').update({ pin_color: color }).eq('id', sightingId);
  if(error) { showToast('Color save failed'); return; }
  const idx = sightings.findIndex(x => x.id === sightingId);
  if(idx >= 0) sightings[idx].pin_color = color;
  addObsMarkers();
}


