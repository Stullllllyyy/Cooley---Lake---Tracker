// Huginn — ui.js
// Tab bar, sheet management, hamburger menu, confirm modal, FAB
// Depends on: config.js (PROPERTY_ID), utils.js (showToast, compressImage)
// References from inline: sb, mapInstance, sightings, renderDash, loadHuntForecast,
//   renderLog, initTrailCamForm, refreshMapPins, tapToPlaceActive, cancelTapToPlace,
//   enterTapToPlaceMode, closeFabDial (self-ref), sfFiltersVisible, sightShowCount,
//   curSightFeed

var SHEETS = ['intel','sightings','trail-cam','detail','chat','dossier'];

function openSheet(name) {
  closeFabDial();
  // Close others first
  SHEETS.forEach(s => {
    if(s !== name) {
      document.getElementById('sheet-'+s)?.classList.remove('open');
      document.getElementById('overlay-'+s)?.classList.remove('on');
    }
  });
  const sheet = document.getElementById('sheet-'+name);
  const overlay = document.getElementById('overlay-'+name);
  if(!sheet) return;
  sheet.classList.add('open');
  if(overlay) overlay.classList.add('on');
  // Set active tab state
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('on'));
  const tabBtn = document.getElementById('tab-'+name);
  if(tabBtn) tabBtn.classList.add('on');
  // Trigger renders
  if(name === 'intel') {
    document.getElementById('intelContent').innerHTML = '<div class="loading"><div class="spinner"></div><br/>Building intelligence...</div>';
    setTimeout(() => { renderDash(); setTimeout(loadHuntForecast, 300); }, 10);
  }
  if(name === 'sightings') {
    console.log('[openSheet sightings] sightings:', sightings.length, '_sightingsLoaded:', !!window._sightingsLoaded);
    sfFiltersVisible = false;
    sightShowCount = 20;
    const sfEl = document.getElementById('sightFilters');
    if(sfEl) sfEl.style.display = 'none';
    // Reset toggle state
    document.getElementById('sfToggleCams')?.classList.toggle('on', curSightFeed === 'cams');
    document.getElementById('sfToggleNotes')?.classList.toggle('on', curSightFeed === 'notes');
    renderLog();
  }
  if(name === 'trail-cam') initTrailCamForm();
}

function closeSheet(name) {
  document.getElementById('sheet-'+name)?.classList.remove('open');
  document.getElementById('overlay-'+name)?.classList.remove('on');
  // Return map tab to active
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('on'));
  document.getElementById('tab-map')?.classList.add('on');
}

function activateTab(name) {
  closeFabDial();
  SHEETS.forEach(s => {
    document.getElementById('sheet-'+s)?.classList.remove('open');
    document.getElementById('overlay-'+s)?.classList.remove('on');
  });
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('on'));
  document.getElementById('tab-'+name)?.classList.add('on');
  if(name === 'map') {
    setTimeout(() => {
      if(!mapInstance) initMap();
      else { mapInstance.resize(); refreshMapPins(); }
    }, 80);
  }
}

// openEdit defined below

function toggleFabDial() {
  if(tapToPlaceActive) { cancelTapToPlace(); return; }
  enterTapToPlaceMode();
}
function closeFabDial() { /* speed dial removed — kept for call-site compatibility */ }

var hamMenuOpen = false;

function openHamMenu() {
  if(hamMenuOpen) return;
  hamMenuOpen = true;
  document.getElementById('hamOverlay').classList.add('on');
  document.getElementById('hamMenu').classList.add('on');
  populateHamMenu();
}

function closeHamMenu() {
  if(!hamMenuOpen) return;
  hamMenuOpen = false;
  document.getElementById('hamOverlay').classList.remove('on');
  document.getElementById('hamMenu').classList.remove('on');
}

async function populateHamMenu() {
  try {
    const { data: { user } } = await sb.auth.getUser();
    if(!user) return;
    // Email
    document.getElementById('hamEmail').textContent = user.email || '--';
    // Avatar — check for profile photo, else show initial
    const avatarEl = document.getElementById('hamAvatar');
    const innerEl = document.getElementById('hamAvatarInner');
    const photoPath = 'profile-photos/' + user.id + '.jpg';
    const { data: urlData } = sb.storage.from('trail-cam-photos').getPublicUrl(photoPath);
    if(urlData && urlData.publicUrl) {
      // Try loading the image — if it 404s, fall back to initial
      const testImg = new Image();
      testImg.onload = () => {
        innerEl.innerHTML = '<img src="' + urlData.publicUrl + '?t=' + Date.now() + '" alt=""/>';
      };
      testImg.onerror = () => {
        const initial = (user.email || '?')[0].toUpperCase();
        innerEl.textContent = initial;
      };
      testImg.src = urlData.publicUrl + '?t=' + Date.now();
    } else {
      const initial = (user.email || '?')[0].toUpperCase();
      innerEl.textContent = initial;
    }
    // Property name
    if(PROPERTY_ID) {
      const { data: propData } = await sb.from('properties').select('name').eq('id', PROPERTY_ID).maybeSingle();
      document.getElementById('hamProp').textContent = propData?.name || 'No property';
    }
  } catch(e) { console.error('populateHamMenu:', e); }
}

function triggerAvatarUpload() {
  document.getElementById('hamAvatarInput').click();
}

async function handleAvatarUpload(input) {
  const file = input.files && input.files[0];
  if(!file) return;
  try {
    const { data: { user } } = await sb.auth.getUser();
    if(!user) { showToast('Not signed in'); return; }
    const compressed = await compressImage(file);
    const path = 'profile-photos/' + user.id + '.jpg';
    const { error } = await sb.storage.from('trail-cam-photos').upload(path, compressed, { upsert: true, contentType: 'image/jpeg' });
    if(error) { showToast('Upload failed — try again'); console.error('Avatar upload:', error); return; }
    // Update display immediately
    const { data: urlData } = sb.storage.from('trail-cam-photos').getPublicUrl(path);
    if(urlData?.publicUrl) {
      document.getElementById('hamAvatarInner').innerHTML = '<img src="' + urlData.publicUrl + '?t=' + Date.now() + '" alt=""/>';
    }
    showToast('Profile photo updated');
  } catch(e) { showToast('Upload failed'); console.error('Avatar upload:', e); }
  input.value = '';
}

var _confirmResolve = null;

function showConfirmModal(msg, actionLabel, actionClass) {
  document.getElementById('confirmMsg').textContent = msg;
  const btn = document.getElementById('confirmActionBtn');
  btn.textContent = actionLabel || 'Archive';
  btn.className = 'confirm-btn ' + (actionClass || 'archive');
  document.getElementById('confirmOverlay').classList.add('on');
  return new Promise(resolve => { _confirmResolve = resolve; });
}

function confirmModalAction() {
  document.getElementById('confirmOverlay').classList.remove('on');
  if(_confirmResolve) { _confirmResolve(true); _confirmResolve = null; }
}

function closeConfirmModal() {
  document.getElementById('confirmOverlay').classList.remove('on');
  if(_confirmResolve) { _confirmResolve(false); _confirmResolve = null; }
}
