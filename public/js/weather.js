// Huginn — weather.js
// Weather infrastructure: map pill, floating card, sighting form auto-fill, 7-day forecast
// Depends on: config.js (CLAT, CLNG, DIR_LABELS), utils.js (deg2dir, simpleDir, showToast)
// References from inline: mapInstance, geolocateCtrl, sightings (for forecast scoring)

// --- Weather state ---
var wxFetched = null;
var wxApplied = null;
var wxTimer = null;
var lastKnownGPS = null; // persists across tracking state changes — never cleared

// --- Weather popup card state ---
var wxPopupOpen = false;
var wxPopupSource = 'gps'; // 'gps' or 'map'
var wxMapMoved = false; // track if map panned since last Map Center fetch
var wxDismissHandler = null;

// --- Map weather pill updater ---
// Uses GPS if available, then map center. Never uses CLAT/CLNG.
function updateMapWeather() {
  var lat, lng;
  if(lastKnownGPS) { lat = lastKnownGPS.lat; lng = lastKnownGPS.lng; }
  else if(mapInstance) { var c = mapInstance.getCenter(); lat = c.lat; lng = c.lng; }
  else return; // No coordinates available yet — wait for map load or GPS
  var hour = new Date().getHours();
  var url = "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lng + "&hourly=temperature_2m,windspeed_10m,winddirection_10m&wind_speed_unit=mph&temperature_unit=fahrenheit&timezone=America%2FChicago&forecast_days=1";
  fetch(url).then(function(r) { return r.json(); }).then(function(j) {
    if(!j.hourly) return;
    var temp = Math.round(j.hourly.temperature_2m[hour]);
    var wind = Math.round(j.hourly.windspeed_10m[hour]);
    var dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
    var dir = dirs[Math.round(j.hourly.winddirection_10m[hour]/22.5)%16];
    document.getElementById('mapWeatherTemp').textContent = temp+'F';
    document.getElementById('mapWeatherDetail').textContent = dir + ' ' + wind + 'mph';
  }).catch(function() {});
}

// --- Weather popup card ---
function toggleWxPopup() {
  var card = document.getElementById('wxPopupCard');
  if(wxPopupOpen) { closeWxPopup(); return; }
  wxPopupOpen = true;
  card.classList.remove('closing');
  card.style.display = 'block';
  // Default to GPS if available, Map Center otherwise
  if(lastKnownGPS) { wxPopupSource = 'gps'; }
  else { wxPopupSource = 'map'; }
  updateWxToggleUI();
  loadWxPopupData();
  // Dismiss on outside tap (delay to avoid same-tap close)
  setTimeout(function() {
    wxDismissHandler = function(e) {
      if(!document.getElementById('wxPopupCard').contains(e.target) &&
         !e.target.closest('.wx-pill')) {
        closeWxPopup();
      }
    };
    document.addEventListener('click', wxDismissHandler);
  }, 50);
}

function closeWxPopup() {
  if(!wxPopupOpen) return;
  var card = document.getElementById('wxPopupCard');
  card.classList.add('closing');
  setTimeout(function() { card.style.display = 'none'; card.classList.remove('closing'); }, 140);
  wxPopupOpen = false;
  if(wxDismissHandler) { document.removeEventListener('click', wxDismissHandler); wxDismissHandler = null; }
}

function setWxSource(src) {
  if(src === 'gps' && !lastKnownGPS) {
    // Try to trigger a fresh GPS request
    if(geolocateCtrl) {
      try { geolocateCtrl.trigger(); } catch(_) {}
      showToast('Requesting GPS position...');
    } else {
      showToast('GPS not available — enable location');
    }
    return;
  }
  wxPopupSource = src;
  updateWxToggleUI();
  wxMapMoved = false;
  loadWxPopupData();
}

function updateWxToggleUI() {
  document.getElementById('wxToggleGps').classList.toggle('on', wxPopupSource === 'gps');
  document.getElementById('wxToggleMap').classList.toggle('on', wxPopupSource === 'map');
  document.getElementById('wxRefreshBtn').classList.toggle('show', wxPopupSource === 'map' && wxMapMoved);
}

function refreshWxForMapCenter() {
  wxMapMoved = false;
  updateWxToggleUI();
  loadWxPopupData();
}

function getWxCoords() {
  if(wxPopupSource === 'gps' && lastKnownGPS) {
    return { lat: lastKnownGPS.lat, lng: lastKnownGPS.lng };
  }
  if(mapInstance) {
    var c = mapInstance.getCenter();
    return { lat: c.lat, lng: c.lng };
  }
  return null;
}

function loadWxPopupData() {
  var body = document.getElementById('wxPopupBody');
  body.innerHTML = '<div style="text-align:center;padding:20px 0;color:var(--text3);font-size:12px">Loading...</div>';
  var coords = getWxCoords();
  if(!coords) { body.innerHTML = '<div style="text-align:center;padding:20px 0;color:var(--text3);font-size:12px">Waiting for location...</div>'; return; }
  var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + coords.lat +
    '&longitude=' + coords.lng +
    '&hourly=temperature_2m,relativehumidity_2m,precipitation,windspeed_10m,windgusts_10m,winddirection_10m,surface_pressure' +
    '&daily=sunrise,sunset' +
    '&wind_speed_unit=mph&temperature_unit=fahrenheit&precipitation_unit=inch' +
    '&timezone=America%2FChicago&forecast_days=2';
  fetch(url).then(function(r) { return r.json(); }).then(function(j) {
    if(!j.hourly || !j.daily) { body.innerHTML = '<div style="text-align:center;padding:20px 0;color:var(--text3);font-size:12px">Weather data unavailable</div>'; return; }
    var h = new Date().getHours();
    var temp = Math.round(j.hourly.temperature_2m[h]);
    var wind = Math.round(j.hourly.windspeed_10m[h]);
    var gust = Math.round(j.hourly.windgusts_10m[h]);
    var humid = Math.round(j.hourly.relativehumidity_2m[h]);
    var pressHpa = j.hourly.surface_pressure[h];
    var pressInHg = (pressHpa / 33.8639).toFixed(2);
    var precip = j.hourly.precipitation[h].toFixed(2);
    var windDeg = j.hourly.winddirection_10m[h];
    var windDir = DIR_LABELS[Math.round(windDeg / 22.5) % 16];

    // Pressure trend — compare current hour to 3 hours ago
    var pTrend = 'Steady';
    var pArrow = '&#8594;';
    var pColor = 'var(--text3)';
    if(h >= 3) {
      var diff = j.hourly.surface_pressure[h] - j.hourly.surface_pressure[h - 3];
      if(diff > 0.5) { pTrend = 'Rising'; pArrow = '&#8599;'; pColor = 'var(--blue)'; }
      else if(diff < -0.5) { pTrend = 'Falling'; pArrow = '&#8600;'; pColor = '#e87a3a'; }
    }

    // Sunrise / sunset
    var sunrise = j.daily.sunrise[0];
    var sunset = j.daily.sunset[0];
    var fmtSun = function(iso) {
      if(!iso) return '--';
      var d = new Date(iso);
      var hh = d.getHours(), mm = d.getMinutes();
      var ampm = hh >= 12 ? 'PM' : 'AM';
      hh = hh % 12 || 12;
      return hh + ':' + String(mm).padStart(2, '0') + ' ' + ampm;
    };

    // 24h forecast — start at current hour, show next 24
    var forecastHtml = '';
    for(var i = h; i < h + 24 && i < j.hourly.time.length; i++) {
      var hTime = new Date(j.hourly.time[i]);
      var hh = hTime.getHours();
      var ampm = hh >= 12 ? 'p' : 'a';
      hh = hh % 12 || 12;
      var hTemp = Math.round(j.hourly.temperature_2m[i]);
      var hWind = Math.round(j.hourly.windspeed_10m[i]);
      var hDir = DIR_LABELS[Math.round(j.hourly.winddirection_10m[i] / 22.5) % 16];
      var isNow = i === h;
      forecastHtml += '<div class="wx-hour-cell"' + (isNow ? ' style="border-color:var(--gold)"' : '') + '>' +
        '<div class="wx-hour-time">' + (isNow ? 'Now' : hh + ampm) + '</div>' +
        '<div class="wx-hour-temp">' + hTemp + '\u00b0</div>' +
        '<div class="wx-hour-wind">' + hDir + ' ' + hWind + '</div>' +
        '</div>';
    }

    body.innerHTML =
      '<div class="wx-grid">' +
        '<div class="wx-cell"><div class="wx-cell-val">' + temp + '\u00b0F</div><div class="wx-cell-lbl">Temp</div></div>' +
        '<div class="wx-cell"><div class="wx-cell-val">' + windDir + ' ' + wind + '</div><div class="wx-cell-lbl">Wind mph</div></div>' +
        '<div class="wx-cell"><div class="wx-cell-val">' + gust + '</div><div class="wx-cell-lbl">Gust mph</div></div>' +
        '<div class="wx-cell"><div class="wx-cell-val">' + humid + '%</div><div class="wx-cell-lbl">Humidity</div></div>' +
        '<div class="wx-cell"><div class="wx-cell-val">' + pressInHg + '</div><div class="wx-cell-lbl">Pressure inHg</div></div>' +
        '<div class="wx-cell"><div class="wx-cell-val">' + precip + '"</div><div class="wx-cell-lbl">Precip</div></div>' +
      '</div>' +
      '<div class="wx-pressure-row"><span style="color:' + pColor + '">' + pArrow + '</span> Pressure ' + pTrend + '</div>' +
      '<div class="wx-sun-row">' +
        '<div class="wx-sun-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>' + fmtSun(sunrise) + '</div>' +
        '<div class="wx-sun-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e87a3a" stroke-width="2" stroke-linecap="round"><path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="9" x2="12" y2="2"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/></svg>' + fmtSun(sunset) + '</div>' +
      '</div>' +
      '<div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">24-Hour Forecast</div>' +
      '<div class="wx-forecast-scroll">' + forecastHtml + '</div>';
  }).catch(function() {
    body.innerHTML = '<div style="text-align:center;padding:20px 0;color:var(--text3);font-size:12px">Failed to load weather</div>';
  });
}

// --- Sighting form weather auto-fill ---
function autoWx() {
  var d = document.getElementById("fd").value;
  var t = document.getElementById("ft").value;
  if(!d || !t) return;
  clearTimeout(wxTimer);
  wxTimer = setTimeout(function() { fetchWx(d, t); }, 600);
}

async function fetchWx(date, time) {
  var load = document.getElementById("wxload");
  var wxd  = document.getElementById("wxdata");
  var stat = document.getElementById("wxstat");
  load.style.display = "block"; wxd.style.display = "none";
  load.textContent = "Fetching conditions...";
  stat.textContent = "fetching..."; stat.style.color = "#4A4D4E";
  try {
    var h = parseInt(time.split(":")[0]);
    var todayStr = new Date().toISOString().split('T')[0];
    if(date > todayStr) { load.textContent = "Future date -- no weather yet."; return; }
    var diffDays = Math.floor((new Date(todayStr) - new Date(date)) / 86400000);
    var url, isArchive = (diffDays >= 5);
    if(isArchive) {
      url = "https://archive-api.open-meteo.com/v1/archive?latitude=" + CLAT
          + "&longitude=" + CLNG + "&start_date=" + date + "&end_date=" + date
          + "&hourly=temperature_2m,relativehumidity_2m,precipitation,windspeed_10m,windgusts_10m,winddirection_10m,surface_pressure"
          + "&wind_speed_unit=mph&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=America%2FChicago";
    } else {
      url = "https://api.open-meteo.com/v1/forecast?latitude=" + CLAT
          + "&longitude=" + CLNG
          + "&hourly=temperature_2m,relativehumidity_2m,precipitation,windspeed_10m,windgusts_10m,winddirection_10m,surface_pressure"
          + "&wind_speed_unit=mph&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=America%2FChicago"
          + "&past_days=5&forecast_days=1";
    }
    var r = await fetch(url); var j = await r.json();
    if(!j.hourly) throw new Error("no data");
    var hi = h;
    if(!isArchive) {
      var target = date + "T" + String(h).padStart(2,"0") + ":00";
      hi = j.hourly.time.findIndex(function(t) { return t === target; });
      if(hi === -1) throw new Error("hour not found");
    }
    wxFetched = {
      temp:     Math.round(j.hourly.temperature_2m[hi]),
      windSpd:  Math.round(j.hourly.windspeed_10m[hi]),
      windGst:  Math.round(j.hourly.windgusts_10m[hi]),
      windDir:  deg2dir(j.hourly.winddirection_10m[hi]),
      humid:    Math.round(j.hourly.relativehumidity_2m[hi]),
      precip:   j.hourly.precipitation[hi].toFixed(2),
      press:    Math.round(j.hourly.surface_pressure[hi]),
    };
    // Populate display
    document.getElementById("wx-t").textContent = wxFetched.temp + "\u00b0";
    document.getElementById("wx-w").textContent = wxFetched.windSpd;
    document.getElementById("wx-g").textContent = wxFetched.windGst;
    document.getElementById("wx-d").textContent = wxFetched.windDir;
    document.getElementById("wx-h").textContent = wxFetched.humid + "%";
    document.getElementById("wx-p").textContent = wxFetched.precip + '"';
    document.getElementById("wx-bp").textContent = wxFetched.press;
    document.getElementById("wx-bpt").textContent =
      wxFetched.press > 1013 ? "Rising" : wxFetched.press < 1005 ? "Low" : "Stable";
    stat.textContent = isArchive ? "(historical)" : "(recent data)";
    stat.style.color = "#7aaa6a";
    load.style.display = "none"; wxd.style.display = "block";
    // Auto-apply wind dir and temp immediately
    applyWx();
  } catch(e) {
    load.textContent = "Weather unavailable -- enter manually below.";
    stat.textContent = "unavailable"; stat.style.color = "#e87a4a";
    console.error("fetchWx:", e);
  }
}

function applyWx() {
  if(!wxFetched) return;
  // Auto-fill temp
  document.getElementById("ftemp").value = wxFetched.temp;
  // Auto-fill wind direction dropdown
  var wd = document.getElementById("fwind");
  var match = simpleDir(wxFetched.windDir);
  for(var i = 0; i < wd.options.length; i++) {
    if(wd.options[i].value === match) { wd.selectedIndex = i; break; }
  }
  wxApplied = {
    windSpeed: wxFetched.windSpd,
    windGust:  wxFetched.windGst,
    humidity:  wxFetched.humid,
    precip:    wxFetched.precip,
    pressure:  wxFetched.press,
  };
}

// --- 7-day hunt forecast (Intel tab) ---
async function loadHuntForecast() {
  var el = document.getElementById('forecastContent');
  if(!el) return;
  try {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + CLAT + '&longitude=' + CLNG +
      '&daily=temperature_2m_max,temperature_2m_min,windspeed_10m_max,winddirection_10m_dominant,precipitation_sum,weathercode' +
      '&hourly=surface_pressure' +
      '&wind_speed_unit=mph&temperature_unit=fahrenheit&precipitation_unit=inch' +
      '&timezone=America%2FChicago&forecast_days=7';
    var r = await fetch(url);
    var j = await r.json();
    if(!j.daily) { el.textContent = 'Forecast unavailable'; return; }

    // Get historical best conditions from sightings
    var withData = sightings.filter(function(s) { return s.pressure || s.temp_f || s.wind_dir; });
    var bestWinds = (function() {
      var wc = {};
      withData.filter(function(s) { return s.deer_type && s.deer_type.includes('Buck'); }).forEach(function(s) {
        if(s.wind_dir) wc[s.wind_dir] = (wc[s.wind_dir]||0)+1;
      });
      return Object.entries(wc).sort(function(a,b) { return b[1]-a[1]; }).slice(0,3).map(function(e) { return e[0]; });
    })();
    var buckTemps = withData.filter(function(s) { return s.deer_type && s.deer_type.includes('Buck') && s.temp_f; }).map(function(s) { return parseFloat(s.temp_f); });
    var idealTempMin = buckTemps.length ? Math.min.apply(null, buckTemps) - 5 : 25;
    var idealTempMax = buckTemps.length ? Math.max.apply(null, buckTemps) + 10 : 60;

    var days = j.daily.time;
    var dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];

    // WMO weather code descriptions
    var weatherDesc = function(code) {
      if(code === 0) return {label:'Clear', icon:'&#9728;'};
      if(code <= 3) return {label:'Cloudy', icon:'P.Cloudy'};
      if(code <= 49) return {label:'Fog', icon:'Fog'};
      if(code <= 67) return {label:'Rain', icon:'Rain'};
      if(code <= 77) return {label:'Snow', icon:'Snow'};
      if(code <= 82) return {label:'Showers', icon:'Showers'};
      if(code <= 99) return {label:'Storms', icon:'Storms'};
      return {label:'Mixed', icon:'Mixed'};
    };

    // Score each day based on historical patterns
    var scoreDay = function(i) {
      var score = 50; // base
      var flags = [];
      var tmax = j.daily.temperature_2m_max[i];
      var tmin = j.daily.temperature_2m_min[i];
      var tavg = (tmax + tmin) / 2;
      var wind = j.daily.windspeed_10m_max[i];
      var precip = j.daily.precipitation_sum[i];
      var wdir = dirs[Math.round(j.daily.winddirection_10m_dominant[i]/22.5)%16];
      var code = j.daily.weathercode[i];

      // Temp scoring
      if(tavg >= idealTempMin && tavg <= idealTempMax) { score += 15; flags.push({text:'Good temp', good:true}); }
      else if(tavg < idealTempMin - 10 || tavg > idealTempMax + 10) score -= 15;

      // Wind direction
      var sd = wdir.length > 2 ? wdir.slice(0,2) : wdir;
      if(bestWinds.some(function(w) { return w.startsWith(sd) || sd.startsWith(w); })) {
        score += 20; flags.push({text:wdir+' wind &#x2713;', good:true});
      }

      // Wind speed
      if(wind < 8) { score += 10; flags.push({text:'Light wind', good:true}); }
      else if(wind > 20) { score -= 15; flags.push({text:'Too windy', good:false}); }

      // Precip
      if(precip > 0.5) { score -= 20; flags.push({text:'Heavy rain', good:false}); }
      else if(precip > 0 && precip < 0.1) { score += 5; flags.push({text:'Light precip', good:true}); }
      else if(precip === 0 && i > 0 && j.daily.precipitation_sum[i-1] > 0.3) {
        score += 25; flags.push({text:'Post-rain! &#x1F525;', good:true});
      }

      // Cold front aftermath (pressure rising implied by clear after rain)
      if(code === 0 && i > 0 && j.daily.weathercode[i-1] >= 51) {
        score += 20; flags.push({text:'Post-front clear', good:true});
      }

      // Cap score
      score = Math.max(0, Math.min(100, score));
      return {score:score, flags:flags};
    };

    var dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    var html = '<div style="display:flex;flex-direction:column;gap:8px">';
    for(var di = 0; di < 7 && di < days.length; di++) {
      var d = new Date(days[di]+'T12:00:00');
      var dayName = di === 0 ? 'Today' : dayNames[d.getDay()];
      var result = scoreDay(di);
      var score = result.score;
      var flags = result.flags;
      var tmax = Math.round(j.daily.temperature_2m_max[di]);
      var tmin = Math.round(j.daily.temperature_2m_min[di]);
      var wind = Math.round(j.daily.windspeed_10m_max[di]);
      var wdir = dirs[Math.round(j.daily.winddirection_10m_dominant[di]/22.5)%16];
      var precip = j.daily.precipitation_sum[di];
      var wd = weatherDesc(j.daily.weathercode[di]);
      var scoreColor = score >= 75 ? 'var(--blue)' : score >= 55 ? '#a08468' : score >= 40 ? '#888' : '#555';
      var scoreLabel = score >= 75 ? 'Hunt it' : score >= 55 ? 'Good' : score >= 40 ? 'Average' : 'Skip';
      var borderColor = score >= 75 ? 'rgba(74,127,193,0.4)' : 'var(--border)';
      var flagsHtml = '';
      for(var fi = 0; fi < flags.length; fi++) {
        var f = flags[fi];
        flagsHtml += '<span style="font-size:9px;padding:1px 6px;border-radius:6px;background:' + (f.good ? 'rgba(74,127,193,0.15)' : 'rgba(80,80,80,0.3)') + ';color:' + (f.good ? 'var(--blue)' : 'var(--text3)') + '">' + f.text + '</span>';
      }
      html += '<div style="background:var(--bg);border-radius:10px;padding:10px 12px;border:1px solid ' + borderColor + '">' +
        '<div style="display:flex;align-items:center;gap:8px">' +
        '<div style="min-width:40px">' +
        '<div style="font-size:12px;font-weight:600;color:var(--text)">' + dayName + '</div>' +
        '<div style="font-size:9px;color:var(--text3)">' + d.toLocaleDateString('en-US',{month:'short',day:'numeric'}) + '</div>' +
        '</div>' +
        '<div style="font-size:20px">' + wd.icon + '</div>' +
        '<div style="flex:1">' +
        '<div style="font-size:11px;color:var(--text2)">' + tmax + 'F/' + tmin + 'F &middot; ' + wdir + ' ' + wind + 'mph' + (precip > 0 ? ' &middot; ' + precip.toFixed(2) + '"' : '') + '</div>' +
        '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:3px">' + flagsHtml + '</div>' +
        '</div>' +
        '<div style="text-align:right;min-width:52px">' +
        '<div style="font-size:18px;font-weight:700;color:' + scoreColor + '">' + score + '</div>' +
        '<div style="font-size:9px;color:' + scoreColor + ';font-weight:600">' + scoreLabel + '</div>' +
        '</div></div></div>';
    }
    html += '<div style="font-size:9px;color:var(--text3);padding:4px 0;line-height:1.6">Score based on your historical deer movement patterns: preferred wind directions, temperature ranges, and barometric conditions. ' + (bestWinds.length ? 'Your best winds: ' + bestWinds.join(', ') + '. ' : '') + 'Post-front clear days get a bonus.</div></div>';
    el.innerHTML = html;
  } catch(e) {
    var el2 = document.getElementById('forecastContent');
    if(el2) el2.textContent = 'Forecast unavailable';
    console.error('Forecast error:', e);
  }
}
