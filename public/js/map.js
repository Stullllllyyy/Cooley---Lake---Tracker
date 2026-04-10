// Huginn — map.js
// Mapbox map: init, GPS, heading cone, movement lines, heatmap, dot map,
// core area, filter FAB, compass, map style, map display panel, date filters
// Depends on: config.js (CLAT, CLNG, PROPERTY_ID, PROPERTY_CENTER, PROPERTY_BOUNDS,
//   PIN_COLOR_STROKES), utils.js (showToast), auth.js (sb), weather.js (updateMapWeather,
//   wxPopupSource, wxPopupOpen, wxMapMoved, updateWxToggleUI), sightings.js (sightings,
//   curFilter, curMapFilter, curYear, getNamedBucks, buckColor, refreshBucknameList,
//   renderLog, initForm), cameras.js (camLocations, addCamMarkers, loadCamLocations),
//   markers.js (renderPropertyMarkers, addObsMarkers as called from here), ui.js (openSheet),
//   intel.js (renderDash, loadHuntForecast)

// Sheet & Tab Management (openSheet, closeSheet, activateTab, SHEETS) loaded from /js/ui.js

// openEdit defined below

// showDet (sighting detail) loaded from /js/sightings.js
// --- GPS Blue Dot + Heading Cone (Mapbox fill layer) ---
var geolocateCtrl = null;
var headingWatchActive = false;
var lastUserLngLat = null;
var lastHeading = null;
var headingConeLayerAdded = false;

function dbg(msg) { console.log('[HEADING] ' + msg); }

function initGeolocate() {
  if(!mapInstance) return;
  dbg('initGeolocate called');
  geolocateCtrl = new mapboxgl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true,
    showUserHeading: false,
    showAccuracyCircle: true
  });
  geolocateCtrl.on('error', (err) => { dbg('geolocate error: ' + (err?.message || JSON.stringify(err))); });
  geolocateCtrl.on('geolocate', (e) => {
    const hadGPS = !!lastKnownGPS;
    lastUserLngLat = [e.coords.longitude, e.coords.latitude];
    lastKnownGPS = { lat: e.coords.latitude, lng: e.coords.longitude };
    dbg('GPS position: ' + e.coords.latitude.toFixed(5) + ', ' + e.coords.longitude.toFixed(5));
    if(compassConeActive && lastHeading !== null) updateHeadingConeGeoJSON();
    // Refresh weather pill with GPS coords on first fix
    if(!hadGPS) updateMapWeather();
  });
  geolocateCtrl.on('trackuserlocationend', () => {
    dbg('trackuserlocationend');
    removeHeadingCone();
    lastUserLngLat = null;
  });
  mapInstance.addControl(geolocateCtrl, 'bottom-right');

  // Auto-trigger geolocation after control is added to the map
  setTimeout(() => {
    try { geolocateCtrl.trigger(); dbg('auto-trigger fired'); } catch(e) { dbg('auto-trigger error: ' + e.message); }
  }, 500);
}

function startHeadingWatch() {
  if(headingWatchActive) { dbg('heading watch already active'); return; }
  headingWatchActive = true;
  dbg('startHeadingWatch — adding listeners');
  window.addEventListener('deviceorientationabsolute', onDeviceHeading, true);
  window.addEventListener('deviceorientation', onDeviceHeading);
}

var _orientCount = 0;
function onDeviceHeading(e) {
  _orientCount++;
  // Log first 5 events then every 50th to avoid spam
  if(_orientCount <= 5 || _orientCount % 50 === 0) {
    dbg('orientation #' + _orientCount + ': alpha=' + e.alpha + ' webkitCH=' + e.webkitCompassHeading + ' absolute=' + e.absolute + ' type=' + e.type);
  }
  let heading = null;
  if(typeof e.webkitCompassHeading === 'number') {
    heading = e.webkitCompassHeading;
  } else if(e.absolute && typeof e.alpha === 'number') {
    heading = 360 - e.alpha;
  } else if(typeof e.alpha === 'number') {
    heading = 360 - e.alpha;
  }
  if(heading === null || !lastUserLngLat) return;
  lastHeading = heading;
  if(compassConeActive) updateHeadingConeGeoJSON();
}

// Bearing math: given a point, bearing (degrees), and distance (meters), return [lng, lat]
function destPoint(lngLat, bearingDeg, distMeters) {
  const R = 6371000;
  const lat1 = lngLat[1] * Math.PI / 180;
  const lng1 = lngLat[0] * Math.PI / 180;
  const brng = bearingDeg * Math.PI / 180;
  const d = distMeters / R;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
  const lng2 = lng1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return [lng2 * 180 / Math.PI, lat2 * 180 / Math.PI];
}

function buildConePolygon(center, headingDeg, lengthMeters, halfAngleDeg) {
  // Build a triangle: tip at center, two base points at ±halfAngle at distance
  const steps = 12; // arc segments for smooth curved base
  const coords = [center];
  for(let i = 0; i <= steps; i++) {
    const a = headingDeg - halfAngleDeg + (2 * halfAngleDeg * i / steps);
    coords.push(destPoint(center, a, lengthMeters));
  }
  coords.push(center); // close the polygon
  return coords;
}

function updateHeadingConeGeoJSON() {
  if(!mapInstance || lastHeading === null || !lastUserLngLat) return;

  const coneLength = 80; // meters
  const halfAngle = 25;  // degrees (50 degree cone)
  const coords = buildConePolygon(lastUserLngLat, lastHeading, coneLength, halfAngle);

  const geojson = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [coords] },
      properties: {}
    }]
  };

  if(!headingConeLayerAdded) {
    // Add source + layer on first call
    dbg('Adding cone layer — heading=' + lastHeading.toFixed(1) + ' pos=' + lastUserLngLat[1].toFixed(5) + ',' + lastUserLngLat[0].toFixed(5));
    dbg('Cone coords[0]=' + JSON.stringify(coords[0]) + ' coords[1]=' + JSON.stringify(coords[1]));
    mapInstance.addSource('heading-cone', { type: 'geojson', data: geojson });
    mapInstance.addLayer({
      id: 'heading-cone-layer',
      type: 'fill',
      source: 'heading-cone',
      paint: {
        'fill-color': '#E63946',
        'fill-opacity': 0.4
      }
    });
    headingConeLayerAdded = true;
    dbg('Cone layer added successfully');
  } else {
    const src = mapInstance.getSource('heading-cone');
    if(src) src.setData(geojson);
  }
}

function removeHeadingCone() {
  if(mapInstance && headingConeLayerAdded) {
    if(mapInstance.getLayer('heading-cone-layer')) mapInstance.removeLayer('heading-cone-layer');
    if(mapInstance.getSource('heading-cone')) mapInstance.removeSource('heading-cone');
    headingConeLayerAdded = false;
  }
  lastHeading = null;
}

// Compatibility shim - old showView calls still work
async function showView(n) {
  if(n === 'log') openSheet('log');
  else if(n === 'sightings') openSheet('sightings');
  else if(n === 'dash' || n === 'intel') openSheet('intel');
  else if(n === 'det' || n === 'detail') openSheet('detail');
}

function filterGo(c) { curFilter = c; openSheet('sightings'); }

function getAvailableYears() {
  const years = [...new Set(sightings.map(s => s.date?.slice(0,4)).filter(Boolean))].sort();
  return years;
}

function yearFiltered(arr) {
  if(curYear === 'all') return arr;
  return arr.filter(s => s.date && s.date.startsWith(curYear));
}

// map style toggle — cycles through 4 styles
var MAP_STYLES = [
  { id: 'satellite-streets', label: 'SAT', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
  { id: 'satellite',         label: 'SAT+', url: 'mapbox://styles/mapbox/satellite-v9' },
  { id: 'outdoors',          label: 'TOPO', url: 'mapbox://styles/mapbox/outdoors-v12' },
  { id: 'dark',              label: 'DARK', url: 'mapbox://styles/mapbox/dark-v11' },
];
var mapStyleIdx = 0;

function toggleMapStyle() {
  cycleMapStyleFab();
}

function cycleMapStyleFab() {
  if(!mapInstance) return;
  mapStyleIdx = (mapStyleIdx + 1) % MAP_STYLES.length;
  const style = MAP_STYLES[mapStyleIdx];
  mapInstance.setStyle(style.url);
  updateMapStyleFabLabel();
  updateFilterFabDot();
  lineLayerAdded = false;
}

function updateMapStyleFabLabel() {
  const lbl = document.getElementById('mapStyleFabLbl');
  if(lbl) lbl.textContent = MAP_STYLES[mapStyleIdx].label;
}

// --- Map Display Panel ---
var mapDisplayPanelOpen = false;
var compassPermissionGranted = false;
var compassDenied = false;
var compassConeActive = false;

function toggleMapDisplayPanel() {
  if(mapDisplayPanelOpen) closeMapDisplayPanel();
  else openMapDisplayPanel();
}

function openMapDisplayPanel() {
  const panel = document.getElementById('mapDisplayPanel');
  panel.classList.add('open');
  mapDisplayPanelOpen = true;
  renderStyleGrid();
  initCompassSection();
  // Close on outside tap
  setTimeout(() => document.addEventListener('click', onMapDisplayOutsideClick), 10);
}

function closeMapDisplayPanel() {
  const panel = document.getElementById('mapDisplayPanel');
  panel.classList.remove('open');
  mapDisplayPanelOpen = false;
  document.removeEventListener('click', onMapDisplayOutsideClick);
}

function onMapDisplayOutsideClick(e) {
  const panel = document.getElementById('mapDisplayPanel');
  const fab = document.getElementById('mapStyleFab');
  if(!panel.contains(e.target) && !fab.contains(e.target)) {
    closeMapDisplayPanel();
  }
}

function renderStyleGrid() {
  const grid = document.getElementById('mdpStyleGrid');
  grid.innerHTML = MAP_STYLES.map((s, i) =>
    '<button class="mdp-style-btn' + (i === mapStyleIdx ? ' active' : '') + '" onclick="selectMapStyle(' + i + ')">' + s.label + '</button>'
  ).join('');
}

function selectMapStyle(idx) {
  if(!mapInstance) return;
  mapStyleIdx = idx;
  const style = MAP_STYLES[mapStyleIdx];
  mapInstance.setStyle(style.url);
  updateMapStyleFabLabel();
  updateFilterFabDot();
  lineLayerAdded = false;
  // Re-add heading cone layer after style change if active
  if(compassConeActive) {
    headingConeLayerAdded = false;
    mapInstance.once('style.load', () => {
      if(lastHeading !== null && lastUserLngLat) updateHeadingConeGeoJSON();
    });
  }
  renderStyleGrid();
}

function initCompassSection() {
  const section = document.getElementById('mdpCompassSection');
  // Only show on iOS devices where requestPermission is available
  const isIOS = /iPhone|iPad/i.test(navigator.userAgent);
  const hasPermissionAPI = typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';
  if(isIOS && hasPermissionAPI) {
    section.style.display = '';
  } else {
    section.style.display = 'none';
    return;
  }
  const toggle = document.getElementById('mdpCompassToggle');
  toggle.classList.toggle('on', compassConeActive);
}

function toggleCompassHeading() {
  dbg('compass btn tapped — coneActive=' + compassConeActive + ' permGranted=' + compassPermissionGranted + ' denied=' + compassDenied);
  const toggle = document.getElementById('mdpCompassToggle');
  const deniedMsg = document.getElementById('mdpCompassDenied');

  if(compassConeActive) {
    // Turn off
    compassConeActive = false;
    toggle.classList.remove('on');
    removeHeadingCone();
    dbg('compass cone disabled');
    return;
  }

  if(compassDenied) {
    deniedMsg.style.display = 'block';
    dbg('compass previously denied');
    return;
  }

  if(compassPermissionGranted) {
    // Already have permission — just enable
    compassConeActive = true;
    toggle.classList.add('on');
    if(!headingWatchActive) startHeadingWatch();
    dbg('compass cone enabled (permission already granted)');
    return;
  }

  // First time — request permission synchronously in this tap handler
  dbg('permission requested');
  DeviceOrientationEvent.requestPermission().then(state => {
    dbg('permission result: ' + state);
    if(state === 'granted') {
      compassPermissionGranted = true;
      compassConeActive = true;
      toggle.classList.add('on');
      startHeadingWatch();
      deniedMsg.style.display = 'none';
    } else {
      compassDenied = true;
      toggle.classList.remove('on');
      deniedMsg.style.display = 'block';
    }
  }).catch(err => {
    dbg('permission error: ' + err);
    compassDenied = true;
    toggle.classList.remove('on');
    deniedMsg.style.display = 'block';
  });
}

// cam popup helpers
function closePopup() {
  document.getElementById('camPopup').classList.remove('show');
}


// Supabase client (sb) and auth functions loaded from /js/auth.js

// Hamburger menu & avatar loaded from /js/ui.js

// Auth (sb, bootApp, showAuthGate, onboarding, login, signup, magic link, logout) loaded from /js/auth.js

// Config constants loaded from /js/config.js

// Sighting state, buck registry, AI profiles, data loading, edit modal loaded from /js/sightings.js
// --- map (Mapbox) -
// Mapbox token set after DOM ready (see init below)

// PROPERTY_CENTER and PROPERTY_BOUNDS loaded from /js/config.js

// camLocations loaded from /js/cameras.js
var mapInstance = null;
var mapMarkers = {};
var lineLayerAdded = false;
var editMode = false;

// loadCamLocations + saveCamLocation loaded from /js/cameras.js
function initMap() {
  if(mapInstance) return; // Map initialized exactly once per page load
  const container = document.getElementById('map');
  if(!container || container.offsetWidth === 0) {
    setTimeout(initMap, 100);
    return;
  }
  mapInstance = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/satellite-streets-v12',
    center: [-98.5, 39.5],
    zoom: 4,
    fadeDuration: 0,
    pitchWithRotate: true,
    touchPitch: true,
  });
  mapInstance.addControl(new mapboxgl.ScaleControl({ maxWidth: 80, unit: 'imperial' }), 'bottom-left');
  mapInstance.on('load', () => {
    mapInstance.resize();
    initGeolocate();
    // Fetch weather using map center now that mapInstance is ready
    updateMapWeather();
    // Fly to GPS if available, otherwise stay on continental US view
    if(navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          mapInstance.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 15, duration: 1500 });
        },
        () => { /* GPS denied/dismissed — stay on zoomed-out continental view */ },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
    // Add Mapbox Terrain DEM source
    addTerrainDEM();
    // Add contour line source and layers
    addContourLayers();
    // Add roads and trails layers
    addRoadLayers();
    // Add waterway layers
    addWaterwayLayers();
    // Add USGS public land raster layer
    addPublicLandLayer();
  });
  // Weather popup: track map pan for Map Center refresh button
  mapInstance.on('moveend', () => {
    if(wxPopupSource === 'map' && wxPopupOpen) { wxMapMoved = true; updateWxToggleUI(); }
  });
  mapInstance.on('style.load', () => {
    addLineLayer();
    lineLayerAdded = true;
    // Re-add terrain DEM source and hillshade after style change
    addTerrainDEM();
    // Re-add contour layers after style change
    addContourLayers();
    // Re-add roads and trails after style change
    addRoadLayers();
    // Re-add waterway layers after style change
    addWaterwayLayers();
    // Re-add public land raster layer after style change
    addPublicLandLayer();
    // Re-apply terrain if it was active before style switch
    if(terrainActive) {
      mapInstance.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
    }
    // Skip loading pins/markers during onboarding — map should be clean
    if(!onboardingMode) {
      addCamMarkers();
      addObsMarkers();
      renderPropertyMarkers();
      updateBuckLines();
      // Restore heatmap and core area if a buck filter is active
      if(heatmapOn) showHeatmap();
      if(curMapFilter && curMapFilter !== 'all') showCoreArea(curMapFilter);
    }
  });
  mapInstance.on('error', e => {
    console.error('Mapbox error:', e.error);
    const el = document.getElementById('mapLoadText');
    if(el) { el.style.display='block'; el.style.color='#e87a4a'; el.textContent = 'Map error: ' + (e.error?.message || JSON.stringify(e.error)); }
  });
  mapInstance.on('idle', () => { const el = document.getElementById('mapLoadText'); if(el) el.style.display='none'; });
  mapInstance.on('rotate', () => {
    const ni = document.getElementById('northIndicator');
    if(ni) ni.style.transform = 'rotate(' + (-mapInstance.getBearing()) + 'deg)';
  });
  [500, 1500].forEach(t => setTimeout(() => { if(mapInstance) mapInstance.resize(); }, t));
}

function addPropertyOutline() { /* removed */ }

function addLineLayer() {
  if(mapInstance.getSource('buck-lines')) return;
  mapInstance.addSource('buck-lines', {
    type: 'geojson',
    data: { type:'FeatureCollection', features:[] }
  });
  // Arrow/symbol layer for direction indicators
  mapInstance.addSource('buck-arrows', {
    type: 'geojson',
    data: { type:'FeatureCollection', features:[] }
  });
  // Solid daytime lines
  mapInstance.addLayer({
    id: 'buck-lines-day',
    type: 'line',
    source: 'buck-lines',
    filter: ['==',['get','daytime'],true],
    paint: {
      'line-color': ['get','color'],
      'line-width': ['get','width'],
      'line-opacity': 0.9
    }
  });
  // Dashed night lines
  mapInstance.addLayer({
    id: 'buck-lines-night',
    type: 'line',
    source: 'buck-lines',
    filter: ['==',['get','daytime'],false],
    paint: {
      'line-color': ['get','color'],
      'line-width': ['get','width'],
      'line-dasharray': [2,2],
      'line-opacity': 0.65
    }
  });
  // Direction arrows along lines
  mapInstance.addLayer({
    id: 'buck-arrows-layer',
    type: 'symbol',
    source: 'buck-arrows',
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 80,
      'icon-image': 'arrow',
      'icon-size': 0.8,
      'icon-rotate': 90,
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true
    }
  });
}


// addCamMarkers loaded from /js/cameras.js
var obsMarkers = [];
// Marker visibility state — false = hidden by default
var obsMarkersVisible = false;
var scrapeMarkersVisible = false;
var rubMarkersVisible = false;
var beddingMarkersVisible = false;
var dotMapActive = false;
var heatMapActive = false;
var terrainActive = false;
var contoursActive = false;
var roadsActive = false;
var waterwaysActive = false;
var publicLandActive = false;
var layersPanelOpen = false;

function addObsMarkers() {
  obsMarkers.forEach(m => m.remove());
  obsMarkers = [];
  if(!mapInstance || !obsMarkersVisible) return;
  sightings
    .filter(s => s.source === 'observation' && s.obs_lat && s.obs_lng)
    .forEach(s => {
      const pinColor  = s.pin_color || '#E5B53B';
      const pinStroke = PIN_COLOR_STROKES[pinColor] || '#c9973a';
      const el = document.createElement('div');
      // Sulfur teardrop — same SVG path as cam pins, distinct fill #E5B53B vs gold #8C7355
      // anchor:'bottom' so teardrop tip aligns to coordinate (matches cam pin architecture)
      // Use cam-marker/cam-pin classes for consistent 36×44px size across all pin types
      el.className = 'cam-marker';
      el.innerHTML =
        '<div class="cam-pin">' +
        '<svg class="pin-bg" viewBox="0 0 36 44" fill="none">' +
        '<path d="M18 2C10.268 2 4 8.268 4 16c0 10 14 28 14 28s14-18 14-28C32 8.268 25.732 2 18 2z" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="3"/>' +
        '<path d="M18 2C10.268 2 4 8.268 4 16c0 10 14 28 14 28s14-18 14-28C32 8.268 25.732 2 18 2z" fill="' + pinColor + '" stroke="' + pinStroke + '" stroke-width="1.5"/>' +
        '</svg>' +
        '<div class="cam-pin-content">' +
        '<div class="cam-pin-ico"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></div>' +
        '</div></div>';
      el.title = (s.deer_type || 'Observation') + (s.buck_name ? ' \u2014 ' + s.buck_name : '');
      el.addEventListener('click', e => { e.stopPropagation(); showObsPopup(s); });
      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom', offset: [0, 0] })
        .setLngLat([s.obs_lng, s.obs_lat])
        .addTo(mapInstance);
      obsMarkers.push(marker);
    });
}

function refreshMapPins() {
  if(!mapInstance) return;
  addCamMarkers();
  addObsMarkers();
  updateBuckLines();
  if(dotMapOn) showDotMap();
}

function updateBuckLines() {
  if(!mapInstance || !mapInstance.getSource('buck-lines')) return;

  const timeColor = t => {
    if(!t) return '#555';
    const h = parseInt(t);
    if(h >= 5 && h < 7)  return '#7a9275';
    if(h >= 7 && h < 10) return '#a08468';
    if(h >= 10 && h < 16) return '#888';
    if(h >= 16 && h < 20) return '#7a9275';
    return '#4a4a6a';
  };
  const isDaytime = t => { if(!t) return false; const h=parseInt(t); return h>=6&&h<20; };

  const allFeatures = [];
  const arrowFeatures = [];

  const bucksToShow = (curMapFilter === 'all' || curMapFilter === 'all-bucks')
    ? getNamedBucks()
    : curMapFilter === 'none' ? []
    : [curMapFilter];

  bucksToShow.forEach(bname => {
    const bs = sightings
      .filter(s => s.buck_name === bname && camLocations[s.camera_name])
      .sort((a,b) => new Date(a.date+'T'+(a.time||'00:00')) - new Date(b.date+'T'+(b.time||'00:00')));
    if(bs.length < 2) return;

    const color = buckColor(bname);

    // Count corridor frequency for line width
    const corridorCount = {};
    for(let i=0; i<bs.length-1; i++) {
      const key = [bs[i].camera_name, bs[i+1].camera_name].sort().join('|');
      corridorCount[key] = (corridorCount[key]||0) + 1;
    }
    const maxCount = Math.max(...Object.values(corridorCount), 1);

    for(let i=0; i<bs.length-1; i++) {
      const s1=bs[i], s2=bs[i+1];
      const p1=camLocations[s1.camera_name];
      const p2=camLocations[s2.camera_name];
      const segColor = curMapFilter === 'all' ? color : timeColor(s1.time);
      const daytime = isDaytime(s1.time);
      const key = [s1.camera_name, s2.camera_name].sort().join('|');
      const freq = corridorCount[key] || 1;
      // Width: 2-6px based on frequency
      const width = Math.round(2 + (freq/maxCount) * 4);

      allFeatures.push({
        type:'Feature',
        properties:{ color:segColor, daytime, width, buckName:bname,
          label:`${s1.camera_name} -> ${s2.camera_name}`,
          date:s1.date, time:s1.time||'', freq },
        geometry:{ type:'LineString', coordinates:[[p1.lng,p1.lat],[p2.lng,p2.lat]] }
      });

      // Midpoint arrow feature for direction
      const midLng = (p1.lng + p2.lng) / 2;
      const midLat = (p1.lat + p2.lat) / 2;
      arrowFeatures.push({
        type:'Feature',
        properties:{ color:segColor },
        geometry:{ type:'LineString', coordinates:[[p1.lng,p1.lat],[p2.lng,p2.lat]] }
      });
    }
  });

  mapInstance.getSource('buck-lines').setData({ type:'FeatureCollection', features:allFeatures });
  // Arrows source - using line direction
  if(mapInstance.getSource('buck-arrows')) {
    mapInstance.getSource('buck-arrows').setData({ type:'FeatureCollection', features:arrowFeatures });
  }

  // If filtering to one buck, fit map to their full corridor
  if(curMapFilter !== 'all' && bucksToShow.length === 1) {
    const bs = sightings.filter(s => s.buck_name===curMapFilter && camLocations[s.camera_name]);
    if(bs.length >= 2) {
      const lngs = bs.map(s => camLocations[s.camera_name].lng);
      const lats = bs.map(s => camLocations[s.camera_name].lat);
      mapInstance.fitBounds(
        [[Math.min(...lngs)-0.004,Math.min(...lats)-0.004],[Math.max(...lngs)+0.004,Math.max(...lats)+0.004]],
        {padding:80, duration:800}
      );
    }
  }
}


function buildMapFilters() {
  buildDateDropdown();
  buildMovementSelect();
  updateFilterFabDot();
  // Show/hide movement legend
  const leg = document.getElementById('movementLegend');
  if(leg) leg.classList.toggle('show', curMapFilter !== 'all' && curMapFilter !== 'none');
}

function buildMovementSelect() {
  const sel = document.getElementById('fpMovementSelect');
  if(!sel) return;
  const bucks = getNamedBucks();
  sel.innerHTML = [
    `<option value="none"${curMapFilter === 'none' ? ' selected' : ''}>No Movement Lines</option>`,
    `<option value="all-bucks"${curMapFilter === 'all-bucks' ? ' selected' : ''}>All Movement Lines</option>`,
    ...bucks.map(b => `<option value="${b}"${curMapFilter === b ? ' selected' : ''}>${b}</option>`)
  ].join('');
}


function toggleHeatmapFromMenu() {
  heatmapOn = !heatmapOn;
  if(heatmapOn) showHeatmap(); else hideHeatmap();
  buildMapFilters();
  // Rebuild dropdown and keep it open
  const dd = document.getElementById('buckDropdown');
  if(dd) {
    dd.style.display = 'block';
    dd.style.pointerEvents = 'auto';
  }
}


// --- Date Filter (Year + Month) ---
var curMapMonth = 'all';

function buildDateDropdown() {
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Build year <select>
  const yearSel = document.getElementById('fpYearSelect');
  if(yearSel) {
    const years = getAvailableYears();
    yearSel.innerHTML = ['all', ...years].map(y =>
      `<option value="${y}"${curYear === y ? ' selected' : ''}>${y === 'all' ? 'All Years' : y}</option>`
    ).join('');
  }

  // Build month <select>
  const monthSel = document.getElementById('fpMonthSelect');
  if(monthSel) {
    monthSel.innerHTML = ['all', ...monthNames.map((m, i) => String(i + 1).padStart(2, '0'))].map((val, i) =>
      `<option value="${val}"${curMapMonth === val ? ' selected' : ''}>${i === 0 ? 'All Months' : monthNames[i - 1]}</option>`
    ).join('');
  }
}


function setMapYear2(y) {
  curYear = y;
  buildDateDropdown();
  updateFilterFabDot();
  refreshMapPins();
  updateBuckLines();
  if(curMapFilter !== 'all') { showHeatmap(curMapFilter); showCoreArea(curMapFilter); }
}

function setMapMonth(m) {
  curMapMonth = m;
  buildDateDropdown();
  updateFilterFabDot();
  refreshMapPins();
  updateBuckLines();
}

// Override yearFiltered to also apply month filter on map
function yearFiltered(arr) {
  let base = arr;
  if(curYear !== 'all') base = base.filter(s => s.date && s.date.startsWith(curYear));
  if(curMapMonth !== 'all') base = base.filter(s => s.date && s.date.slice(5,7) === curMapMonth);
  return base;
}

// --- Map Style Dropdown ---

function setMapStyleFromDrop(idx) {
  if(!mapInstance) return;
  mapStyleIdx = idx;
  const style = MAP_STYLES[mapStyleIdx];
  mapInstance.setStyle(style.url);
  updateMapStyleFabLabel();
  updateFilterFabDot();
  lineLayerAdded = false;
}


// Marker visibility toggles (toggleObsMarkers, etc.) loaded from /js/markers.js
function toggleDotMap() {
  dotMapActive = !dotMapActive;
  const tog = document.getElementById('mfpDotMapToggle');
  tog.textContent = dotMapActive ? 'ON' : 'OFF';
  tog.classList.toggle('on', dotMapActive);
  if(dotMapActive) { showDotMap(); } else { hideDotMap(); }
  updateFilterFabDot();
}
function toggleHeatMap() {
  heatMapActive = !heatMapActive;
  const tog = document.getElementById('mfpHeatMapToggle');
  tog.textContent = heatMapActive ? 'ON' : 'OFF';
  tog.classList.toggle('on', heatMapActive);
  if(heatMapActive) { showHeatmap(); } else { hideHeatmap(); }
  updateFilterFabDot();
}
// updateMarkersPillState loaded from /js/markers.js


// --- Filter FAB + Panel ---
function toggleFilterPanel() {
  const panel = document.getElementById('filterPanel');
  if(panel.classList.contains('open')) closeFilterPanel();
  else openFilterPanel();
}

function openFilterPanel() {
  const panel = document.getElementById('filterPanel');
  const fab = document.getElementById('filterFab');
  // Compute max-height so panel stays within viewport (20px top margin)
  const fabRect = fab.getBoundingClientRect();
  const available = fabRect.top - 20 - 10; // 20px top margin, 10px gap above fab
  panel.style.maxHeight = Math.max(200, available) + 'px';
  panel.classList.add('open');
  fab.classList.add('active');
  buildDateDropdown();
  setTimeout(() => document.addEventListener('click', filterPanelOutsideClick), 50);
}

function closeFilterPanel() {
  const panel = document.getElementById('filterPanel');
  const fab = document.getElementById('filterFab');
  panel.classList.remove('open');
  fab.classList.remove('active');
  document.removeEventListener('click', filterPanelOutsideClick);
}

function filterPanelOutsideClick(e) {
  const panel = document.getElementById('filterPanel');
  const fab = document.getElementById('filterFab');
  if(panel && !panel.contains(e.target) && fab && !fab.contains(e.target)) {
    closeFilterPanel();
  }
}

function updateFilterFabDot() {
  const dot = document.getElementById('filterFabDot');
  if(!dot) return;
  const nonDefault = curYear !== 'all' || curMapMonth !== 'all' || (curMapFilter !== 'none') || obsMarkersVisible || scrapeMarkersVisible || rubMarkersVisible || beddingMarkersVisible || dotMapActive || heatMapActive;
  dot.style.display = nonDefault ? 'block' : 'none';
}

// --- 3D Terrain & Hillshade ---

function getFirstSymbolLayer() {
  if(!mapInstance) return undefined;
  var layers = mapInstance.getStyle().layers;
  for(var i = 0; i < layers.length; i++) {
    if(layers[i].type === 'symbol') return layers[i].id;
  }
  return undefined;
}

function addTerrainDEM() {
  if(!mapInstance) return;
  if(!mapInstance.getSource('mapbox-dem')) {
    mapInstance.addSource('mapbox-dem', {
      type: 'raster-dem',
      url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
      tileSize: 512,
      maxzoom: 14
    });
  }
  if(!mapInstance.getLayer('hillshade-layer')) {
    var beforeLayer = mapInstance.getLayer('waterway-label') ? 'waterway-label' : getFirstSymbolLayer();
    mapInstance.addLayer({
      id: 'hillshade-layer',
      type: 'hillshade',
      source: 'mapbox-dem',
      paint: {
        'hillshade-exaggeration': 0.5,
        'hillshade-illumination-anchor': 'map'
      }
    }, beforeLayer);
  }
}

function enableTerrain() {
  if(!mapInstance || !mapInstance.getSource('mapbox-dem')) return;
  mapInstance.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
  terrainActive = true;
  mapInstance.easeTo({
    pitch: 60,
    bearing: mapInstance.getBearing(),
    duration: 800
  });
  updateTerrainToggleUI();
}

function disableTerrain() {
  if(!mapInstance) return;
  mapInstance.setTerrain(null);
  terrainActive = false;
  mapInstance.easeTo({
    pitch: 0,
    bearing: 0,
    duration: 800
  });
  updateTerrainToggleUI();
}

function toggleTerrain() {
  terrainActive ? disableTerrain() : enableTerrain();
}

function updateTerrainToggleUI() {
  var btn = document.getElementById('terrainToggleBtn');
  if(!btn) return;
  btn.classList.toggle('active', terrainActive);
  updateLayersFabDot();
}

// --- Contour Lines ---

function addContourLayers() {
  if(!mapInstance) return;
  if(!mapInstance.getSource('mapbox-terrain')) {
    mapInstance.addSource('mapbox-terrain', {
      type: 'vector',
      url: 'mapbox://mapbox.mapbox-terrain-v2'
    });
  }
  if(!mapInstance.getLayer('contour-lines')) {
    mapInstance.addLayer({
      id: 'contour-lines',
      type: 'line',
      source: 'mapbox-terrain',
      'source-layer': 'contour',
      layout: {
        'visibility': contoursActive ? 'visible' : 'none',
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': [
          'match',
          ['%', ['get', 'index'], 5],
          0, '#a08060',
          '#c8a882'
        ],
        'line-width': [
          'match',
          ['%', ['get', 'index'], 5],
          0, 1.2,
          0.5
        ],
        'line-opacity': 0.75
      }
    }, getFirstSymbolLayer());
  }
  if(!mapInstance.getLayer('contour-labels')) {
    mapInstance.addLayer({
      id: 'contour-labels',
      type: 'symbol',
      source: 'mapbox-terrain',
      'source-layer': 'contour',
      filter: ['==', ['%', ['get', 'index'], 5], 0],
      layout: {
        'visibility': contoursActive ? 'visible' : 'none',
        'symbol-placement': 'line',
        'text-field': ['concat', ['to-string', ['get', 'ele']], 'm'],
        'text-size': 10,
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular']
      },
      paint: {
        'text-color': '#a08060',
        'text-halo-color': 'rgba(0,0,0,0.6)',
        'text-halo-width': 1.5
      }
    }, getFirstSymbolLayer());
  }
}

function enableContours() {
  if(!mapInstance) return;
  mapInstance.setLayoutProperty('contour-lines', 'visibility', 'visible');
  mapInstance.setLayoutProperty('contour-labels', 'visibility', 'visible');
  contoursActive = true;
  updateContourToggleUI();
}

function disableContours() {
  if(!mapInstance) return;
  mapInstance.setLayoutProperty('contour-lines', 'visibility', 'none');
  mapInstance.setLayoutProperty('contour-labels', 'visibility', 'none');
  contoursActive = false;
  updateContourToggleUI();
}

function toggleContours() {
  contoursActive ? disableContours() : enableContours();
}

function updateContourToggleUI() {
  var btn = document.getElementById('contourToggleBtn');
  if(!btn) return;
  btn.classList.toggle('active', contoursActive);
  updateLayersFabDot();
}

// --- Roads ---

var ROAD_LAYER_IDS = ['roads-paved', 'roads-unpaved'];

function ensureStreetsSource() {
  if(!mapInstance || mapInstance.getSource('mapbox-streets')) return;
  mapInstance.addSource('mapbox-streets', {
    type: 'vector',
    url: 'mapbox://mapbox.mapbox-streets-v8'
  });
}

function addRoadLayers() {
  if(!mapInstance) return;
  ensureStreetsSource();
  var vis = roadsActive ? 'visible' : 'none';
  if(!mapInstance.getLayer('roads-paved')) {
    mapInstance.addLayer({
      id: 'roads-paved',
      type: 'line',
      source: 'mapbox-streets',
      'source-layer': 'road',
      filter: ['in', 'class', 'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'street'],
      layout: { 'visibility': vis, 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#d4b483', 'line-width': 1.5, 'line-opacity': 0.8 }
    }, getFirstSymbolLayer());
  }
  if(!mapInstance.getLayer('roads-unpaved')) {
    mapInstance.addLayer({
      id: 'roads-unpaved',
      type: 'line',
      source: 'mapbox-streets',
      'source-layer': 'road',
      filter: ['in', 'class', 'track', 'service', 'link'],
      layout: { 'visibility': vis, 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#c8a464', 'line-width': 1.0, 'line-opacity': 0.85, 'line-dasharray': [2, 1] }
    }, getFirstSymbolLayer());
  }
}

function enableRoads() {
  if(!mapInstance) return;
  ensureStreetsSource();
  ROAD_LAYER_IDS.forEach(function(id) {
    if(mapInstance.getLayer(id)) mapInstance.setLayoutProperty(id, 'visibility', 'visible');
  });
  roadsActive = true;
  updateRoadsToggleUI();
}

function disableRoads() {
  if(!mapInstance) return;
  ROAD_LAYER_IDS.forEach(function(id) {
    if(mapInstance.getLayer(id)) mapInstance.setLayoutProperty(id, 'visibility', 'none');
  });
  roadsActive = false;
  updateRoadsToggleUI();
}

function toggleRoads() {
  roadsActive ? disableRoads() : enableRoads();
}

function updateRoadsToggleUI() {
  var btn = document.getElementById('roadsToggleBtn');
  if(!btn) return;
  btn.classList.toggle('active', roadsActive);
  updateLayersFabDot();
}

// --- Waterways ---

var WATERWAY_LAYER_IDS = ['waterways-river', 'waterways-stream', 'waterways-fill'];

function addWaterwayLayers() {
  if(!mapInstance) return;
  ensureStreetsSource();
  var vis = waterwaysActive ? 'visible' : 'none';
  if(!mapInstance.getLayer('waterways-river')) {
    mapInstance.addLayer({
      id: 'waterways-river',
      type: 'line',
      source: 'mapbox-streets',
      'source-layer': 'waterway',
      filter: ['in', 'class', 'river', 'canal'],
      layout: { 'visibility': vis, 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#4a90d9', 'line-width': 2.0, 'line-opacity': 0.85 }
    }, getFirstSymbolLayer());
  }
  if(!mapInstance.getLayer('waterways-stream')) {
    mapInstance.addLayer({
      id: 'waterways-stream',
      type: 'line',
      source: 'mapbox-streets',
      'source-layer': 'waterway',
      filter: ['in', 'class', 'stream', 'drain', 'ditch'],
      layout: { 'visibility': vis, 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#5ba3e0', 'line-width': 1.0, 'line-opacity': 0.75 }
    }, getFirstSymbolLayer());
  }
  if(!mapInstance.getLayer('waterways-fill')) {
    mapInstance.addLayer({
      id: 'waterways-fill',
      type: 'fill',
      source: 'mapbox-streets',
      'source-layer': 'water',
      layout: { 'visibility': vis },
      paint: { 'fill-color': '#4a90d9', 'fill-opacity': 0.35 }
    }, getFirstSymbolLayer());
  }
}

function enableWaterways() {
  if(!mapInstance) return;
  ensureStreetsSource();
  WATERWAY_LAYER_IDS.forEach(function(id) {
    if(mapInstance.getLayer(id)) mapInstance.setLayoutProperty(id, 'visibility', 'visible');
  });
  waterwaysActive = true;
  updateWaterwaysToggleUI();
}

function disableWaterways() {
  if(!mapInstance) return;
  WATERWAY_LAYER_IDS.forEach(function(id) {
    if(mapInstance.getLayer(id)) mapInstance.setLayoutProperty(id, 'visibility', 'none');
  });
  waterwaysActive = false;
  updateWaterwaysToggleUI();
}

function toggleWaterways() {
  waterwaysActive ? disableWaterways() : enableWaterways();
}

function updateWaterwaysToggleUI() {
  var btn = document.getElementById('waterwaysToggleBtn');
  if(!btn) return;
  btn.classList.toggle('active', waterwaysActive);
  updateLayersFabDot();
}

// --- Public Land (USGS PAD-US Federal Lands) ---

function addPublicLandLayer() {
  if(!mapInstance) return;
  // Add USGS PAD-US raster tile source (routed through Vercel proxy to bypass CORS)
  if(!mapInstance.getSource('public-land-source')) {
    mapInstance.addSource('public-land-source', {
      type: 'raster',
      tiles: [
        '/api/padus-tile?z={z}&y={y}&x={x}'
      ],
      tileSize: 256,
      minzoom: 4,
      maxzoom: 16,
      attribution: 'USGS PAD-US Federal Lands'
    });
  }
  // Add raster layer
  if(!mapInstance.getLayer('public-land-layer')) {
    mapInstance.addLayer({
      id: 'public-land-layer',
      type: 'raster',
      source: 'public-land-source',
      layout: { visibility: 'none' },
      paint: { 'raster-opacity': 0.5 }
    }, getFirstSymbolLayer());
  }
  // Restore visibility state after style reload
  if(mapInstance.getLayer('public-land-layer')) {
    mapInstance.setLayoutProperty(
      'public-land-layer',
      'visibility',
      publicLandActive ? 'visible' : 'none'
    );
    // Restore current opacity from slider if present
    var slider = document.getElementById('publicLandOpacity');
    if(slider) {
      mapInstance.setPaintProperty('public-land-layer', 'raster-opacity', (+slider.value) / 100);
    }
  }
}

function enablePublicLand() {
  if(!mapInstance) return;
  if(mapInstance.getLayer('public-land-layer')) {
    mapInstance.setLayoutProperty('public-land-layer', 'visibility', 'visible');
  }
  publicLandActive = true;
  updatePublicLandToggleUI();
  updateLayersFabDot();
  var opacityRow = document.getElementById('publicLandOpacityRow');
  if(opacityRow) opacityRow.style.display = 'flex';
}

function disablePublicLand() {
  if(!mapInstance) return;
  if(mapInstance.getLayer('public-land-layer')) {
    mapInstance.setLayoutProperty('public-land-layer', 'visibility', 'none');
  }
  publicLandActive = false;
  updatePublicLandToggleUI();
  updateLayersFabDot();
  var opacityRow = document.getElementById('publicLandOpacityRow');
  if(opacityRow) opacityRow.style.display = 'none';
}

function togglePublicLand() {
  publicLandActive ? disablePublicLand() : enablePublicLand();
}

function updatePublicLandToggleUI() {
  var btn = document.getElementById('publicLandToggleBtn');
  if(!btn) return;
  btn.classList.toggle('active', publicLandActive);
  btn.disabled = false;
}

function setPublicLandOpacity(val) {
  if(mapInstance && mapInstance.getLayer('public-land-layer')) {
    mapInstance.setPaintProperty('public-land-layer', 'raster-opacity', val / 100);
  }
  var valEl = document.getElementById('publicLandOpacityVal');
  if(valEl) valEl.textContent = val + '%';
}

// --- Layers Panel ---

function toggleLayersPanel() {
  layersPanelOpen ? closeLayersPanel() : openLayersPanel();
}

function openLayersPanel() {
  layersPanelOpen = true;
  openSheet('layers');
  updateLayersFabDot();
}

function closeLayersPanel() {
  layersPanelOpen = false;
  closeSheet('layers');
}

function updateLayersFabDot() {
  var dot = document.querySelector('.layers-fab-dot');
  if(!dot) return;
  var anyActive = terrainActive || contoursActive || roadsActive || waterwaysActive || publicLandActive;
  dot.classList.toggle('active', anyActive);
}


function buildMapLegend() {
  const btn = document.getElementById('mapLegendBtn');
  const content = document.getElementById('legendContent');
  if(!content) return;

  const buckSelected = curMapFilter && curMapFilter !== 'all' && curMapFilter !== 'none';

  // Show/hide legend button based on whether a buck is selected
  if(btn) btn.classList.toggle('visible', buckSelected);
  if(!buckSelected) {
    const panel = document.getElementById('mapLegendPanel');
    if(panel) panel.classList.remove('visible');
    return;
  }

  // Build legend content
  let h = '';

  // Movement lines section
  h += `<div class="leg-section-lbl">Movement lines</div>
    <div class="leg-row">
      <div class="leg-line" style="background:var(--blue)"></div>
      <div class="leg-row-text"><div class="leg-name">Daytime travel</div><div class="leg-desc">Solid · 6am–8pm</div></div>
    </div>
    <div class="leg-row">
      <div style="width:22px;height:0;border-top:3px dashed var(--blue);flex-shrink:0"></div>
      <div class="leg-row-text"><div class="leg-name">Night movement</div><div class="leg-desc">Dashed · 8pm–6am</div></div>
    </div>
    <div class="leg-row">
      <svg width="22" height="10" viewBox="0 0 22 10" style="flex-shrink:0"><line x1="2" y1="5" x2="17" y2="5" stroke="#8C7355" stroke-width="2"/><polyline points="13,2 17,5 13,8" fill="none" stroke="#8C7355" stroke-width="2" stroke-linejoin="round"/></svg>
      <div class="leg-row-text"><div class="leg-name">Direction</div><div class="leg-desc">Arrow = chronological</div></div>
    </div>`;

  h += `<div class="leg-divider"></div>`;

  // Time rings section
  h += `<div class="leg-section-lbl">Pin time rings</div>
    <div class="leg-row"><div class="leg-swatch" style="background:#2a2a3a;border:1px solid #444"></div><div class="leg-row-text"><div class="leg-name">Night <span style="color:var(--text3);font-size:10px">8pm–5am</span></div></div></div>
    <div class="leg-row"><div class="leg-swatch" style="background:#7a9275"></div><div class="leg-row-text"><div class="leg-name">Dawn <span style="color:var(--text3);font-size:10px">5–8am · entering</span></div></div></div>
    <div class="leg-row"><div class="leg-swatch" style="background:#e87a3a"></div><div class="leg-row-text"><div class="leg-name">Midday <span style="color:var(--text3);font-size:10px">10am–4pm · near bed</span></div></div></div>
    <div class="leg-row"><div class="leg-swatch" style="background:#c8a951"></div><div class="leg-row-text"><div class="leg-name">Dusk <span style="color:var(--text3);font-size:10px">5–8pm · exit route</span></div></div></div>`;

  h += `<div class="leg-divider"></div>`;

  // Core area section
  h += `<div class="leg-section-lbl">Core area</div>
    <div class="leg-row">
      <div style="width:18px;height:18px;border-radius:50%;background:rgba(74,127,193,0.12);border:1.5px solid rgba(74,127,193,0.45);flex-shrink:0"></div>
      <div class="leg-row-text"><div class="leg-name">Probability zone</div><div class="leg-desc">Weighted sighting density</div></div>
    </div>
    <div class="leg-row">
      <div style="width:10px;height:10px;border-radius:50%;background:var(--blue);border:2px solid #fff;flex-shrink:0;margin-left:4px"></div>
      <div class="leg-row-text"><div class="leg-name">Core centroid</div><div class="leg-desc">Midday-weighted center</div></div>
    </div>`;

  content.innerHTML = h;
}

function toggleLegendPanel() {
  const panel = document.getElementById('mapLegendPanel');
  if(panel) panel.classList.toggle('visible');
}

function setMapYear(y) {
  curYear = y;
  buildMapFilters();
  refreshMapPins();
  updateBuckLines();
  if(curMapFilter !== 'all') {
    showHeatmap(curMapFilter);
    showCoreArea(curMapFilter);
  }
}

function setMapFilter(name) {
  curMapFilter = name;
  buildMapFilters();
  buildMapLegend();
  refreshMapPins();
  updateBuckLines();
  // Auto-show heat + core area only for a specific named buck
  if(name !== 'all' && name !== 'all-bucks' && name !== 'none') {
    heatmapOn = true;
    showHeatmap(name);
    showCoreArea(name);
  } else {
    heatmapOn = false;
    hideHeatmap();
    hideCoreArea();
  }
}



function toggleEditMode() {
  editMode = !editMode;
  const btn = document.getElementById('editModeBtn');
  if(editMode) {
    btn.innerHTML = '&#10003;';
    btn.style.background = 'rgba(74,127,193,0.2)';
    btn.style.borderColor = 'var(--blue)';
    btn.style.color = 'var(--blue)';
  } else {
    btn.innerHTML = '&#9998;&#xFE0E;';
    btn.style.background = '';
    btn.style.borderColor = '';
    btn.style.color = '';
  }
  addCamMarkers();
}

// showPin (camera popup) loaded from /js/cameras.js

// Camera edit functions (setCameraFacing through confirmDeleteCamera) loaded from /js/cameras.js

// toggleBuckIntel + goToBuck loaded from /js/intel.js
// --- views -
// --- log -

// buildWindRoseSVG loaded from /js/intel.js
// --- 24-hour activity timeline -
// build24HrTimeline loaded from /js/intel.js
// --- Camera activity grid -

// buildMiniTimeline loaded from /js/intel.js
// --- Weather correlation analysis -
// buildWeatherCorrelation loaded from /js/intel.js
// --- Heatmap -
var heatmapOn = false;

function toggleHeatmap() {
  heatmapOn = !heatmapOn;
  const btn = document.getElementById('heatmapBtn');
  if(btn) btn.classList.toggle('active', heatmapOn);
  if(heatmapOn) showHeatmap(); else hideHeatmap();
}

function showHeatmap(buckName) {
  if(!mapInstance) return;
  const filterName = buckName || curMapFilter;
  // Build GeoJSON points — when buck filter active, weight by that buck's sightings per camera
  let sourceSightings = sightings.filter(s => camLocations[s.camera_name]);
  const isBuckName = filterName && filterName !== 'all' && filterName !== 'all-bucks' && filterName !== 'none';
  if(isBuckName) {
    sourceSightings = sourceSightings.filter(s => s.buck_name === filterName);
  }
  const features = sourceSightings.map(s => {
      const pos = camLocations[s.camera_name];
      const isBuck = s.deer_type && s.deer_type.includes('Buck');
      const isMature = s.deer_type && s.deer_type.includes('Mature');
      return {
        type: 'Feature',
        properties: { weight: isMature ? 3 : isBuck ? 2 : 1 },
        geometry: { type: 'Point', coordinates: [pos.lng, pos.lat] }
      };
    });

  if(mapInstance.getSource('heatmap-data')) {
    mapInstance.getSource('heatmap-data').setData({ type:'FeatureCollection', features });
  } else {
    mapInstance.addSource('heatmap-data', {
      type: 'geojson',
      data: { type:'FeatureCollection', features }
    });
    mapInstance.addLayer({
      id: 'heatmap-layer',
      type: 'heatmap',
      source: 'heatmap-data',
      paint: {
        'heatmap-weight': ['get','weight'],
        'heatmap-intensity': ['interpolate',['linear'],['zoom'],13,0.5,16,1.2],
        'heatmap-color': [
          'interpolate',['linear'],['heatmap-density'],
          0,   'rgba(0,0,0,0)',
          0.1, 'rgba(20,40,100,0)',
          0.3, 'rgba(30,60,160,0.4)',
          0.5, 'rgba(50,100,220,0.55)',
          0.7, 'rgba(80,140,255,0.65)',
          1.0, 'rgba(150,200,255,0.75)'
        ],
        'heatmap-radius': ['interpolate',['linear'],['zoom'],13,20,16,45],
        'heatmap-opacity': 0.7
      }
    }, 'buck-lines-day');
  }
  if(mapInstance.getLayer('heatmap-layer'))
    mapInstance.setLayoutProperty('heatmap-layer','visibility','visible');
}

function hideHeatmap() {
  if(!mapInstance) return;
  if(mapInstance.getLayer('heatmap-layer'))
    mapInstance.setLayoutProperty('heatmap-layer','visibility','none');
}

function showCoreArea(buckName) {
  if(!mapInstance) return;
  const bs = sightings.filter(s => s.buck_name === buckName && camLocations[s.camera_name]);
  if(bs.length < 3) { hideCoreArea(); return; }

  // Count sightings per camera and weight midday (10am-4pm) hits higher (proximity to bed)
  const camWeights = {};
  bs.forEach(s => {
    const cam = s.camera_name;
    const h = s.time ? parseInt(s.time) : -1;
    const isMidday = h >= 10 && h < 16;
    const w = isMidday ? 2 : 1; // midday = double weight (near bed)
    camWeights[cam] = (camWeights[cam] || 0) + w;
  });

  // Weighted centroid
  let totalW = 0, sumLng = 0, sumLat = 0;
  Object.entries(camWeights).forEach(([cam, w]) => {
    const pos = camLocations[cam];
    if(!pos) return;
    sumLng += pos.lng * w;
    sumLat += pos.lat * w;
    totalW += w;
  });
  if(totalW === 0) return;
  const centLng = sumLng / totalW;
  const centLat = sumLat / totalW;

  // Calculate spread radius from weighted variance
  let varLng = 0, varLat = 0;
  Object.entries(camWeights).forEach(([cam, w]) => {
    const pos = camLocations[cam];
    if(!pos) return;
    varLng += w * Math.pow(pos.lng - centLng, 2);
    varLat += w * Math.pow(pos.lat - centLat, 2);
  });
  const spreadLng = Math.sqrt(varLng / totalW);
  const spreadLat = Math.sqrt(varLat / totalW);
  // Radius in degrees — clamp between 0.003 (~300m) and 0.012 (~1.2km)
  const radiusDeg = Math.min(Math.max(Math.max(spreadLng, spreadLat) * 1.2, 0.003), 0.012);
  const radiusMeters = radiusDeg * 111000;

  const color = buckColor(buckName);
  const coreGeoJSON = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { buck: buckName, color },
      geometry: { type: 'Point', coordinates: [centLng, centLat] }
    }]
  };

  if(mapInstance.getSource('core-area')) {
    mapInstance.getSource('core-area').setData(coreGeoJSON);
    // Update radius on existing layers
    const r = ['interpolate',['exponential',2],['zoom'],
      12, radiusMeters / 111000 * Math.pow(2,12) * 256 / 360,
      16, radiusMeters / 111000 * Math.pow(2,16) * 256 / 360
    ];
    if(mapInstance.getLayer('core-fill')) mapInstance.setPaintProperty('core-fill','circle-radius', r);
    if(mapInstance.getLayer('core-stroke')) mapInstance.setPaintProperty('core-stroke','circle-radius', r);
    if(mapInstance.getLayer('core-fill')) mapInstance.setPaintProperty('core-fill','circle-color', color);
    if(mapInstance.getLayer('core-stroke')) mapInstance.setPaintProperty('core-stroke','circle-stroke-color', color);
    if(mapInstance.getLayer('core-dot')) mapInstance.setPaintProperty('core-dot','circle-color', color);
  } else {
    mapInstance.addSource('core-area', { type:'geojson', data: coreGeoJSON });
    const r = ['interpolate',['exponential',2],['zoom'],
      12, radiusMeters / 111000 * Math.pow(2,12) * 256 / 360,
      16, radiusMeters / 111000 * Math.pow(2,16) * 256 / 360
    ];
    // Insert below buck-lines so lines stay on top
    const beforeLayer = mapInstance.getLayer('buck-lines-day') ? 'buck-lines-day' : undefined;
    // Soft fill blob
    mapInstance.addLayer({
      id: 'core-fill',
      type: 'circle',
      source: 'core-area',
      paint: {
        'circle-radius': r,
        'circle-color': color,
        'circle-opacity': 0.12,
        'circle-blur': 0.6,
        'circle-pitch-alignment': 'map'
      }
    }, beforeLayer);
    // Stroke ring
    mapInstance.addLayer({
      id: 'core-stroke',
      type: 'circle',
      source: 'core-area',
      paint: {
        'circle-radius': r,
        'circle-color': 'transparent',
        'circle-stroke-color': color,
        'circle-stroke-width': 1.5,
        'circle-opacity': 0,
        'circle-stroke-opacity': 0.5,
        'circle-pitch-alignment': 'map'
      }
    }, beforeLayer);
    // Centroid dot — always on top of core layers
    mapInstance.addLayer({
      id: 'core-dot',
      type: 'circle',
      source: 'core-area',
      paint: {
        'circle-radius': 5,
        'circle-color': color,
        'circle-opacity': 0.85,
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 1.5
      }
    });
  }
  // Label
  if(mapInstance.getSource('core-label')) {
    mapInstance.getSource('core-label').setData({
      type:'FeatureCollection',
      features:[{ type:'Feature', properties:{ label: buckName + ' Core Area' }, geometry:{ type:'Point', coordinates:[centLng, centLat + radiusDeg * 0.6] } }]
    });
  } else {
    mapInstance.addSource('core-label', { type:'geojson', data:{
      type:'FeatureCollection',
      features:[{ type:'Feature', properties:{ label: buckName + ' Core Area' }, geometry:{ type:'Point', coordinates:[centLng, centLat + radiusDeg * 0.6] } }]
    }});
    mapInstance.addLayer({
      id: 'core-label',
      type: 'symbol',
      source: 'core-label',
      layout: {
        'text-field': ['get','label'],
        'text-size': 11,
        'text-anchor': 'bottom',
        'text-font': ['DIN Offc Pro Medium','Arial Unicode MS Regular']
      },
      paint: {
        'text-color': color,
        'text-halo-color': 'rgba(0,0,0,0.8)',
        'text-halo-width': 1.5
      }
    });
  }
  ['core-fill','core-stroke','core-dot','core-label'].forEach(id => {
    if(mapInstance.getLayer(id)) mapInstance.setLayoutProperty(id,'visibility','visible');
  });
}

function hideCoreArea() {
  if(!mapInstance) return;
  ['core-fill','core-stroke','core-dot','core-label'].forEach(id => {
    if(mapInstance.getLayer(id)) mapInstance.setLayoutProperty(id,'visibility','none');
  });
}

// buildCamGrid loaded from /js/intel.js
// Intel redesign (Buck Intelligence cards, charts, insights) loaded from /js/intel.js
// AI Insights (fetchAiInsights) loaded from /js/intel.js
// Buck Dossier sheet loaded from /js/intel.js
// Photo Lightbox loaded from /js/intel.js
// goToCamera loaded from /js/intel.js
// Conditions chart (renderConditionsChart) loaded from /js/intel.js
// --- Pin context menu -
// Pin context menu loaded from /js/cameras.js
// --- Conditions overlay -
function updateConditionsOverlay() {
  fetch("https://api.open-meteo.com/v1/forecast?latitude=" + CLAT + "&longitude=" + CLNG +
    "&hourly=temperature_2m,windspeed_10m,winddirection_10m&wind_speed_unit=mph" +
    "&temperature_unit=fahrenheit&timezone=America%2FChicago&forecast_days=1")
  .then(r => r.json()).then(j => {
    if(!j.hourly) return;
    const h = new Date().getHours();
    const temp = Math.round(j.hourly.temperature_2m[h]);
    const wind = Math.round(j.hourly.windspeed_10m[h]);
    const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
    const dir = dirs[Math.round(j.hourly.winddirection_10m[h]/22.5)%16];
    document.getElementById('condWind').textContent = 'Wind: ' + dir + ' ' + wind + 'mph';
    document.getElementById('condTemp').textContent = temp + 'F';
    document.getElementById('mapWeatherTemp').textContent = temp + 'F';
    document.getElementById('mapWeatherDetail').textContent = dir + ' ' + wind + 'mph';
    document.getElementById('mapConditions').style.display = 'flex';
  }).catch(() => {});
  // Update coords on map move
  if(mapInstance) {
    mapInstance.on('move', () => {
      const c = mapInstance.getCenter();
      document.getElementById('condCoords').textContent =
        c.lat.toFixed(4) + ', ' + c.lng.toFixed(4);
    });
  }
}


// ── Dot Map ───────────────────────────────────────────────────────────────────
var dotMapOn = false;
var dotMarkers = [];

// Month color coding
var monthColor = m => {
  const colors = {9:'#e8a040',10:'#e8c840',11:'#d94040',12:'#8C7355'};
  return colors[m] || '#888';
};
var monthLabel = m => ['','','','','','','','','','Sep','Oct','Nov','Dec'][m] || '';

function toggleDotMapFromMenu() {
  dotMapOn = !dotMapOn;
  if(dotMapOn) showDotMap(); else hideDotMap();
  buildMapFilters();
  const dd = document.getElementById('buckDropdown');
  if(dd) { dd.style.display='block'; dd.style.pointerEvents='auto'; }
}

function showDotMap() {
  hideDotMap(); // clear existing
  if(!mapInstance) return;

  const isBuckFilter = curMapFilter && curMapFilter !== 'all' && curMapFilter !== 'all-bucks' && curMapFilter !== 'none';
  const filtered = isBuckFilter
    ? sightings.filter(s => s.buck_name === curMapFilter)
    : sightings;

  filtered.forEach(s => {
    const pos = camLocations[s.camera_name];
    if(!pos) return;

    const d = new Date(s.date + 'T12:00:00');
    const month = d.getMonth() + 1;
    const color = monthColor(month);
    const isMature = s.deer_type && s.deer_type.includes('Mature');
    const isBuck = s.deer_type && s.deer_type.includes('Buck');

    // Random offset so stacked dots spread into a cluster
    const offsetLng = (Math.random() - 0.5) * 0.0008;
    const offsetLat = (Math.random() - 0.5) * 0.0008;
    const lngLat = [pos.lng + offsetLng, pos.lat + offsetLat];

    const size = isMature ? 10 : isBuck ? 7 : 5;
    const opacity = isMature ? 1 : isBuck ? 0.85 : 0.6;
    const border = isMature ? '2px solid rgba(255,255,255,0.8)' : '1px solid rgba(255,255,255,0.3)';

    const el = document.createElement('div');
    el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${color};opacity:${opacity};border:${border};cursor:default;pointer-events:none`;

    const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
      .setLngLat(lngLat)
      .addTo(mapInstance);

    dotMarkers.push(marker);
  });

  // Show legend
  showDotLegend();
}

function hideDotMap() {
  dotMarkers.forEach(m => m.remove());
  dotMarkers = [];
  const leg = document.getElementById('dotLegend');
  if(leg) leg.remove();
}

function showDotLegend() {
  let leg = document.getElementById('dotLegend');
  if(!leg) {
    leg = document.createElement('div');
    leg.id = 'dotLegend';
    leg.style.cssText = 'position:fixed;bottom:calc(var(--tab-h) + 80px);left:14px;z-index:50;background:rgba(18,20,21,0.9);border:1px solid var(--border2);border-radius:10px;padding:10px 12px;backdrop-filter:blur(10px)';
    document.body.appendChild(leg);
  }
  leg.innerHTML = `
    <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:7px">Dot Map</div>
    ${[9,10,11,12].map(m => `
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:4px">
        <div style="width:8px;height:8px;border-radius:50%;background:${monthColor(m)};flex-shrink:0"></div>
        <span style="font-size:10px;color:var(--text2)">${monthLabel(m)}</span>
      </div>`).join('')}
    <div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:3px">
        <div style="width:10px;height:10px;border-radius:50%;background:#888;border:2px solid rgba(255,255,255,0.8);flex-shrink:0"></div>
        <span style="font-size:10px;color:var(--text2)">Mature buck</span>
      </div>
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:3px">
        <div style="width:7px;height:7px;border-radius:50%;background:#888;flex-shrink:0"></div>
        <span style="font-size:10px;color:var(--text2)">Buck</span>
      </div>
      <div style="display:flex;align-items:center;gap:7px">
        <div style="width:5px;height:5px;border-radius:50%;background:#888;flex-shrink:0"></div>
        <span style="font-size:10px;color:var(--text2)">Doe / other</span>
      </div>
    </div>
  `;
}

// Intel filters (buildYearBar, setIntelYear, etc.) loaded from /js/intel.js
// --- Phase 2 Sightings Feed ---
// Sightings feed, filters, menu loaded from /js/sightings.js
// Buck Intelligence section in Intel tab replaces this. Scheduled for cleanup in index.html split phase.
// Buck profiles, unknown bucks, bulk resolve loaded from /js/sightings.js
// Who Is This AI matching loaded from /js/sightings.js
// Removed duplicate showDet (dead code) loaded from /js/sightings.js
// --- form -
// Tap-to-place flow loaded from /js/sightings.js
// TTP Add Camera modal loaded from /js/cameras.js
// --- Mark Feature modal state ---
// Feature marker constants (FEAT_TYPES, FEAT_COLORS, FEAT_STROKES, FEAT_LABELS, FEAT_ICONS, PIN_COLORS, PIN_COLOR_STROKES) loaded from /js/config.js
// Feature markers (openTtpFeatureModal, showFeaturePopup, etc.) loaded from /js/markers.js
// Move system (shared state + moveFeatMarker + moveCameraPin + onMoveDrag) loaded from /js/cameras.js
// deleteFeatMarker loaded from /js/cameras.js

// Color swatch, setFeatureColor, setObsColor loaded from /js/cameras.js
// --- Field observation popup ---
// Observation popup (showObsPopup, openObsEdit, etc.) loaded from /js/markers.js
// Field observation modal (obs*) loaded from /js/sightings.js
// Trail cam sighting form (tcam*) loaded from /js/sightings.js
// Log event mode, form, buck suggestions, AI hint loaded from /js/sightings.js
// Realtime sightings subscription loaded from /js/sightings.js
// renderDash (Intel tab orchestrator) loaded from /js/intel.js
// --- startup (gated by auth — bootApp() calls these)
