// Huginn — intel.js
// Intel tab: buck intelligence, dossier, wind rose, activity charts,
// Key Insights AI, conditions graph, weather correlation, photo lightbox
// Depends on: config.js (CLAT, CLNG, PROPERTY_ID, BUCK_COLORS, DIR_LABELS),
//   utils.js (showToast, fmtD, fmtT, moonPhase, claudeFetch),
//   auth.js (sb), sightings.js (sightings, buckColor, getNamedBucks, buckRegistry,
//   buckIdByName, buckNameById, loadBuckRegistry)
// References from inline: mapInstance, camLocations, curMapFilter, heatmapOn,
//   showHeatmap, showCoreArea, refreshMapPins, updateBuckLines, buildMapFilters,
//   buildMapLegend, openSheet, closeSheet, activateTab

function toggleBuckIntel(btn) {
  const body = btn.nextElementSibling;
  const arrow = btn.querySelector(".bi-arrow");
  body.classList.toggle("open");
  if(arrow) arrow.style.transform = body.classList.contains("open") ? "rotate(180deg)" : "";
}

function goToBuck(name) {
  curMapFilter = name;
  closeSheet('intel');
  activateTab('map');
  setTimeout(() => {
    buildMapFilters(); buildMapLegend(); refreshMapPins(); updateBuckLines();
    heatmapOn = true;
    showHeatmap(name);
    showCoreArea(name);
  }, 400);
}


function buildWindRoseSVG(windCounts, maxWind, topWinds, size) {
  if(!size) size = 110;
  const WINDS = ["N","NE","E","SE","S","SW","W","NW"];
  const cx = size, cy = size, maxR = size * 0.77;
  const angleStep = (Math.PI * 2) / 8;
  const startAngle = -Math.PI / 2; // N at top

  let slices = '';
  let labels = '';
  let rings = '';

  // Draw subtle ring guides
  [0.25, 0.5, 0.75, 1.0].forEach(pct => {
    const r = maxR * pct;
    rings += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#2a2a2a" stroke-width="0.5"/>`;
  });

  // Draw axis lines
  WINDS.forEach((w, i) => {
    const angle = startAngle + i * angleStep;
    const x2 = cx + Math.cos(angle) * maxR;
    const y2 = cy + Math.sin(angle) * maxR;
    slices += `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="#2a2a2a" stroke-width="0.5"/>`;
  });

  // Draw filled wedges — exact half-step angles, zero overdraw
  WINDS.forEach((w, i) => {
    const cnt = windCounts[w] || 0;
    if(cnt === 0) return;
    const pct = cnt / maxWind;
    const r = Math.max(6, maxR * pct);
    const isTop = topWinds[0] === w;
    const isHigh = topWinds.includes(w);

    // Exact midpoints between adjacent directions — no overdraw, no gaps
    const angle1 = startAngle + i * angleStep - angleStep / 2;
    const angle2 = startAngle + i * angleStep + angleStep / 2;
    const x1 = cx + Math.cos(angle1) * r;
    const y1 = cy + Math.sin(angle1) * r;
    const x2 = cx + Math.cos(angle2) * r;
    const y2 = cy + Math.sin(angle2) * r;

    const fill = isTop ? '#c8a951' : isHigh ? '#6e6e6e' : '#333333';

    slices += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z"
      fill="${fill}" stroke="${fill}" stroke-width="1" stroke-linejoin="round"/>`;
  });

  // Center dot — covers convergence point of all wedge tips
  slices += `<circle cx="${cx}" cy="${cy}" r="4" fill="#1a1b1c"/>`;

  // Direction labels
  WINDS.forEach((w, i) => {
    const angle = startAngle + i * angleStep;
    const labelR = maxR + 14;
    const lx = cx + Math.cos(angle) * labelR;
    const ly = cy + Math.sin(angle) * labelR + 4;
    const isTop = topWinds[0] === w;
    const color = isTop ? '#c8a951' : '#666666';
    const weight = isTop ? 'bold' : 'normal';
    labels += `<text x="${lx}" y="${ly}" text-anchor="middle" font-size="10"
      font-family="'Roboto',sans-serif" fill="${color}" font-weight="${weight}">${w}</text>`;

    // Count label inside wedge for non-zero
    const cnt = windCounts[w] || 0;
    if(cnt > 0) {
      const pct = cnt / maxWind;
      const r2 = Math.max(16, maxR * pct * 0.65);
      const nx = cx + Math.cos(angle) * r2;
      const ny = cy + Math.sin(angle) * r2 + 4;
      const txtColor = isTop ? '#0a0a0a' : '#ffffff';
      labels += `<text x="${nx}" y="${ny}" text-anchor="middle" font-size="9"
        font-family="'Roboto',sans-serif" fill="${txtColor}" font-weight="bold">${cnt}</text>`;
    }
  });

  // Legend
  const legendY = size * 2 + 4;
  const legend = `
    <rect x="20" y="${legendY}" width="10" height="10" rx="2" fill="#c8a951"/>
    <text x="34" y="${legendY+9}" font-size="9" font-family="'Roboto',sans-serif" fill="#a0a0a0">Most active</text>
    <rect x="110" y="${legendY}" width="10" height="10" rx="2" fill="#888888"/>
    <text x="124" y="${legendY+9}" font-size="9" font-family="'Roboto',sans-serif" fill="#a0a0a0">Active</text>
    <rect x="175" y="${legendY}" width="10" height="10" rx="2" fill="#444444"/>
    <text x="189" y="${legendY+9}" font-size="9" font-family="'Roboto',sans-serif" fill="#a0a0a0">Low</text>
  `;

  const svgW = size * 2;
  const svgH = size * 2 + 24;
  return `<div style="display:flex;justify-content:center">
    <svg width="100%" viewBox="0 0 ${svgW} ${svgH}" style="overflow:visible;max-width:${svgW}px">
      ${rings}${slices}${labels}${legend}
    </svg>
  </div>`;
}



function build24HrTimeline(sightings, mini) {
  // Build hourly buckets 0-23
  const hourly = new Array(24).fill(0);
  sightings.forEach(s => {
    if(!s.time) return;
    const h = parseInt(s.time);
    if(h >= 0 && h < 24) hourly[h]++;
  });
  const maxH = Math.max(...hourly, 1);
  const total = hourly.reduce((a,b) => a+b, 0);

  // Color by time period
  const periodColor = h => {
    if(h >= 5 && h < 7)  return '#7a9275';  // dawn - blue
    if(h >= 7 && h < 10) return '#7a9275';  // morning - blue
    if(h >= 10 && h < 16) return '#e87a3a'; // midday - orange
    if(h >= 16 && h < 20) return '#c8a951'; // dusk - gold
    return '#2a2a3a';                         // night - near black
  };

  const barW = 10; // 240 viewBox / 24 hours

  // SVG bars
  let bars = '';
  let ticks = '';
  hourly.forEach((cnt, h) => {
    const pct = cnt / maxH;
    const barH = Math.max(pct * 60, cnt > 0 ? 3 : 0);
    const x = h * barW;
    const color = periodColor(h);
    const opacity = cnt > 0 ? (0.4 + pct * 0.6) : 0.1;
    bars += `<rect x="${x}" y="${60 - barH}" width="${barW - 0.3}" height="${barH}"
      fill="${color}" fill-opacity="${opacity}" rx="1"/>`;
    // Count on top of bar if > 0
    if(cnt > 0 && barH > 10) {
      bars += `<text x="${x + barW/2}" y="${58 - barH}" text-anchor="middle"
        font-size="8" fill="${color}" font-family="'Roboto',sans-serif">${cnt}</text>`;
    }
  });

  // Hour tick marks at key hours
  [0,3,6,9,12,15,18,21].forEach(h => {
    const x = h * barW + barW/2;
    const label = h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h-12}p`;
    ticks += `<text x="${x}" y="74" text-anchor="middle" font-size="8"
      fill="#505050" font-family="'Roboto',sans-serif">${label}</text>`;
  });

  // Period labels
  const periods = [
    {label:'Night', start:0, end:5, color:'#2a2a3a'},
    {label:'Dawn', start:5, end:10, color:'#7a9275'},
    {label:'Midday', start:10, end:16, color:'#e87a3a'},
    {label:'Dusk', start:16, end:20, color:'#c8a951'},
    {label:'Night', start:20, end:24, color:'#2a2a3a'},
  ];

  // Peak hour annotation
  const peakHour = hourly.indexOf(maxH);
  const peakLabel = peakHour < 12 ? `${peakHour||12}${peakHour<12?'am':'pm'}` : `${peakHour-12||12}pm`;

  if(mini) return buildMiniTimeline(hourly, maxH);
  return `<div style="position:relative">
    <svg width="100%" height="80" viewBox="0 0 240 80" preserveAspectRatio="none" style="overflow:visible;display:block">
      ${bars}
      <line x1="0" y1="61" x2="240" y2="61" stroke="#222" stroke-width="0.5"/>
      ${ticks}
    </svg>
    <div style="display:flex;justify-content:space-between;margin-top:8px;flex-wrap:wrap;gap:4px">
      ${periods.filter((p,i,arr) => p.label !== arr[i-1]?.label).map(p => {
        const cnt = hourly.slice(p.start, p.end).reduce((a,b)=>a+b,0);
        return `<div style="display:flex;align-items:center;gap:4px">
          <div style="width:8px;height:8px;border-radius:2px;background:${p.color};flex-shrink:0"></div>
          <span style="font-size:9px;color:var(--text3)">${p.label}</span>
          ${cnt > 0 ? `<span style="font-size:9px;color:var(--text2);font-weight:600">${cnt}</span>` : ''}
        </div>`;
      }).join('')}
    </div>
    ${maxH > 0 ? `<div style="margin-top:6px;font-size:10px;color:var(--text3)">Peak: <span style="color:var(--blue)">${peakLabel}</span> &mdash; ${maxH} sighting${maxH>1?'s':''}</div>` : ''}
  </div>`;
}


function buildMiniTimeline(hourly, maxH) {
  const barW = 10; // 240 / 24 hours = 10 units per hour in viewBox coords
  const periodColor = h => {
    if(h >= 5 && h < 10) return '#7a9275';  // dawn/morning - blue
    if(h >= 10 && h < 16) return '#e87a3a'; // midday - orange
    if(h >= 16 && h < 20) return '#c8a951'; // dusk - gold
    return '#2a2a3a';                         // night - near black
  };
  let bars = '';
  hourly.forEach((cnt, h) => {
    const pct = cnt / (maxH||1);
    const barH = Math.max(pct * 40, cnt > 0 ? 2 : 0);
    const x = h * barW;
    bars += `<rect x="${x}" y="${40-barH}" width="${barW - 0.5}" height="${barH}"
      fill="${periodColor(h)}" fill-opacity="${0.4 + pct*0.6}" rx="1"/>`;
  });
  const peakHour = hourly.indexOf(maxH||0);
  const pl = peakHour < 12 ? `${peakHour||12}am` : `${peakHour-12||12}pm`;
  return `<div>
    <svg width="100%" height="44" viewBox="0 0 240 44" preserveAspectRatio="none" style="display:block;overflow:visible">
      ${bars}
      <line x1="0" y1="41" x2="100%" y2="41" stroke="#222" stroke-width="0.5"/>
      <text x="0%" y="50" font-size="7" fill="#505050" font-family="'Roboto',sans-serif">12a</text>
      <text x="25%" y="50" font-size="7" fill="#505050" font-family="'Roboto',sans-serif">6a</text>
      <text x="50%" y="50" font-size="7" fill="#505050" font-family="'Roboto',sans-serif">12p</text>
      <text x="75%" y="50" font-size="7" fill="#505050" font-family="'Roboto',sans-serif">6p</text>
    </svg>
    ${maxH > 0 ? `<div style="font-size:9px;color:var(--text3);margin-top:2px">Peak: <span style="color:var(--blue)">${pl}</span></div>` : ''}
  </div>`;
}



function buildWeatherCorrelation(sightings) {
  if(sightings.length < 5) return '<div style="font-size:11px;color:var(--text3);padding:8px 0">Log at least 5 sightings with weather data to see correlations.</div>';

  const withWeather = sightings.filter(s => s.pressure || s.temp_f || s.wind_speed);
  if(withWeather.length < 3) return '<div style="font-size:11px;color:var(--text3);padding:8px 0">Add weather data when logging to see correlations.</div>';

  // Pressure buckets
  const pressGroups = { low:[], mid:[], high:[] };
  withWeather.forEach(s => {
    if(!s.pressure) return;
    const p = parseFloat(s.pressure);
    if(p < 1008) pressGroups.low.push(s);
    else if(p < 1018) pressGroups.mid.push(s);
    else pressGroups.high.push(s);
  });
  const buckRate = arr => arr.length ? Math.round(arr.filter(s=>s.deer_type&&s.deer_type.includes('Buck')).length/arr.length*100) : 0;
  const matureRate = arr => arr.length ? Math.round(arr.filter(s=>s.deer_type&&s.deer_type.includes('Mature')).length/arr.length*100) : 0;

  // Temp buckets
  const tempGroups = { cold:[], cool:[], mild:[] };
  withWeather.forEach(s => {
    if(!s.temp_f) return;
    const t = parseFloat(s.temp_f);
    if(t < 35) tempGroups.cold.push(s);
    else if(t < 50) tempGroups.cool.push(s);
    else tempGroups.mild.push(s);
  });

  // Wind speed buckets
  const windGroups = { calm:[], moderate:[], strong:[] };
  withWeather.forEach(s => {
    if(!s.wind_speed) return;
    const w = parseFloat(s.wind_speed);
    if(w < 5) windGroups.calm.push(s);
    else if(w < 12) windGroups.moderate.push(s);
    else windGroups.strong.push(s);
  });

  // Precip buckets - before/during/after rain
  const rainSightings = withWeather.filter(s => s.precip && parseFloat(s.precip) > 0.05);
  const dryHighPressure = withWeather.filter(s => (!s.precip || parseFloat(s.precip) < 0.05) && s.pressure && parseFloat(s.pressure) > 1018);

  const maxBuckRate = Math.max(buckRate(pressGroups.low), buckRate(pressGroups.mid), buckRate(pressGroups.high),
    buckRate(tempGroups.cold), buckRate(tempGroups.cool), buckRate(tempGroups.mild), 1);

  const statBar = (pct, isTop) =>
    `<div style="height:3px;background:var(--border);border-radius:2px;margin-top:3px;overflow:hidden">
      <div style="height:100%;width:${pct}%;background:${isTop?'var(--blue)':'#444'};border-radius:2px"></div>
    </div>`;

  const col = (label, arr, allGroups) => {
    const rate = buckRate(arr);
    const max = Math.max(...allGroups.map(a => buckRate(a)), 1);
    const isTop = rate === max && rate > 0;
    return `<div style="text-align:center;padding:6px 4px;background:var(--bg);border-radius:8px;${isTop?'border:1px solid rgba(74,127,193,0.3)':''}">
      <div style="font-size:9px;color:${isTop?'var(--blue)':'var(--text3)'};font-weight:${isTop?700:400}">${label}</div>
      <div style="font-size:15px;font-weight:700;color:${isTop?'var(--blue)':'var(--text2)'};">${arr.length > 0 ? rate+'%' : '--'}</div>
      <div style="font-size:8px;color:var(--text3)">${arr.length} sightings</div>
      ${statBar(arr.length > 0 ? (rate/max*100) : 0, isTop)}
    </div>`;
  };

  return `
    <div style="margin-bottom:10px">
      <div style="font-size:10px;color:var(--text2);margin-bottom:6px;font-weight:600">Buck Activity by Barometric Pressure <span style="color:var(--text3);font-weight:400">(% of sightings that are bucks)</span></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
        ${col('Low (<1008)', pressGroups.low, [pressGroups.low, pressGroups.mid, pressGroups.high])}
        ${col('Mid (1008-18)', pressGroups.mid, [pressGroups.low, pressGroups.mid, pressGroups.high])}
        ${col('High (>1018)', pressGroups.high, [pressGroups.low, pressGroups.mid, pressGroups.high])}
      </div>
    </div>
    <div style="margin-bottom:10px">
      <div style="font-size:10px;color:var(--text2);margin-bottom:6px;font-weight:600">Buck Activity by Temperature</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
        ${col('Cold (<35F)', tempGroups.cold, [tempGroups.cold, tempGroups.cool, tempGroups.mild])}
        ${col('Cool (35-50F)', tempGroups.cool, [tempGroups.cold, tempGroups.cool, tempGroups.mild])}
        ${col('Mild (50F+)', tempGroups.mild, [tempGroups.cold, tempGroups.cool, tempGroups.mild])}
      </div>
    </div>
    <div style="margin-bottom:10px">
      <div style="font-size:10px;color:var(--text2);margin-bottom:6px;font-weight:600">Buck Activity by Wind Speed</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
        ${col('Calm (<5mph)', windGroups.calm, [windGroups.calm, windGroups.moderate, windGroups.strong])}
        ${col('Moderate', windGroups.moderate, [windGroups.calm, windGroups.moderate, windGroups.strong])}
        ${col('Strong (12+)', windGroups.strong, [windGroups.calm, windGroups.moderate, windGroups.strong])}
      </div>
    </div>
    ${rainSightings.length > 0 ? `
    <div style="background:var(--bg);border-radius:10px;padding:10px;margin-top:8px">
      <div style="font-size:10px;color:var(--text2);font-weight:600;margin-bottom:6px">Precipitation Events</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text2)">
          <span style="font-size:14px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><line x1="8" y1="19" x2="8.01" y2="19"/><line x1="12" y1="21" x2="12.01" y2="21"/><line x1="16" y1="19" x2="16.01" y2="19"/></svg></span>
          <span><strong style="color:var(--text)">${rainSightings.length}</strong> sightings during rain/precip events</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text2)">
          <span style="font-size:14px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-1px;"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg></span>
          <span><strong style="color:var(--blue)">${dryHighPressure.length}</strong> sightings post-front (dry + high pressure)</span>
        </div>
      </div>
      ${dryHighPressure.length > rainSightings.length ? '<div style="font-size:10px;color:var(--blue);margin-top:6px;font-style:italic">&#8599; Post-front clear days produce more activity on this property.</div>' :
        rainSightings.length > 0 ? '<div style="font-size:10px;color:var(--text3);margin-top:6px;font-style:italic">Deer moving during precipitation detected -- log more to confirm pattern.</div>' : ''}
    </div>` : ''}
  `;
}

// loadHuntForecast (7-day forecast) loaded from /js/weather.js




function buildCamGrid(camNames, camCounts, camMatureCounts, maxCam, topCam) {
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    ${camNames.map(c => {
      const cnt = camCounts[c] || 0;
      const mature = camMatureCounts[c] || 0;
      const isTop = topCam && topCam[0] === c;
      const pct = maxCam > 0 ? Math.round(cnt / maxCam * 100) : 0;
      // Activity ring - SVG circle
      const r = 18, circ = 2 * Math.PI * r;
      const dash = (pct / 100) * circ;
      const ringColor = isTop ? 'var(--blue)' : mature > 0 ? '#7090b0' : 'var(--border2)';
      return `<div style="background:var(--bg);border:1px solid ${isTop?'var(--blue)':'var(--border)'};border-radius:10px;padding:12px;display:flex;align-items:center;gap:10px">
        <div style="position:relative;flex-shrink:0;width:44px;height:44px">
          <svg width="44" height="44" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="${r}" fill="none" stroke="var(--border)" stroke-width="3"/>
            <circle cx="22" cy="22" r="${r}" fill="none" stroke="${ringColor}" stroke-width="3"
              stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}"
              stroke-dashoffset="${(circ/4).toFixed(1)}"
              stroke-linecap="round"
              transform="rotate(-90 22 22)"/>
            <text x="22" y="26" text-anchor="middle" font-size="11" font-weight="bold"
              fill="${isTop?'var(--blue)':'var(--text2)'}" font-family="'Roboto',sans-serif">${cnt}</text>
          </svg>
        </div>
        <div style="min-width:0">
          <div style="font-size:12px;font-weight:600;color:${isTop?'var(--text)':'var(--text2)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c}</div>
          ${mature > 0
            ? `<div style="font-size:10px;color:var(--blue);margin-top:2px">${mature} mature</div>`
            : `<div style="font-size:10px;color:var(--text3);margin-top:2px">${cnt > 0 ? pct+'% of total' : 'No sightings'}</div>`}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}


// --- Intel redesign helpers ---

// Deer silhouette SVG for buck cards with no photo
var DEER_SILHOUETTE_SVG = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20 L12 14"/><path d="M12 14 L9 10 L7 7 L5 5"/><path d="M9 10 L7 12"/><path d="M7 7 L5 9"/><path d="M12 14 L15 10 L17 7 L19 5"/><path d="M15 10 L17 12"/><path d="M17 7 L19 9"/><ellipse cx="12" cy="17" rx="3" ry="4" fill="none"/></svg>`;

// --- Render Buck Intelligence cards into #intelBuckCards ---
function renderBuckCards(filteredSightings) {
  const container = document.getElementById('intelBuckCards');
  if(!container) return;

  // Group sightings by buck_name (non-null only)
  const buckMap = {};
  filteredSightings.forEach(s => {
    if(!s.buck_name || !s.buck_name.trim()) return;
    const name = s.buck_name.trim();
    if(!buckMap[name]) buckMap[name] = [];
    buckMap[name].push(s);
  });

  const sorted = Object.entries(buckMap).sort((a, b) => b[1].length - a[1].length);

  if(sorted.length === 0) {
    container.innerHTML = `<div class="buck-intel-empty">No named bucks yet \u2014 tag a buck in a sighting to build your registry</div>`;
    return;
  }

  let html = `<div class="buck-intel-row">`;
  sorted.forEach(([buckName, sights]) => {
    const withPhoto = sights.filter(s => s.image_url).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const photoUrl = withPhoto.length ? withPhoto[0].image_url : null;
    const dates = sights.map(s => s.date).filter(Boolean).sort();
    const lastSeen = dates.length ? dates[dates.length - 1] : null;
    const bId = buckIdByName(buckName);
    const regBuck = buckRegistry.find(b => b.name === buckName);
    const ageClass = sights[0]?.deer_type || '';
    const initial = buckName.charAt(0).toUpperCase();

    html += `<div class="buck-intel-card" onclick="openBuckDossier('${bId}')">
      ${photoUrl
        ? `<img class="buck-intel-thumb" src="${photoUrl}" alt="${buckName}" loading="lazy"/>`
        : `<div class="buck-intel-thumb-placeholder"><span style="font-size:22px;font-weight:700;color:var(--bronze)">${initial}</span></div>`}
      <div class="buck-intel-name">${buckName}</div>
      <div class="buck-intel-meta">${sights.length} sighting${sights.length !== 1 ? 's' : ''}</div>
      ${lastSeen ? `<div class="buck-intel-meta">Last ${fmtD(lastSeen)}</div>` : ''}
      ${ageClass && ageClass.includes('Buck') ? `<span class="buck-intel-age">${ageClass.replace('Buck - ','')}</span>` : ''}
    </div>`;
  });
  html += `</div>`;
  container.innerHTML = html;
}

// --- 4-Box Grid renderers (Stage 3) ---

// Box 1: Wind Rose SVG
function renderWindRose(filteredSightings) {
  const el = document.getElementById('intelWindRoseBody');
  if(!el) return;
  const DIRS = ["N","NE","E","SE","S","SW","W","NW"];
  const counts = {};
  DIRS.forEach(d => counts[d] = 0);
  filteredSightings.forEach(s => {
    if(s.wind_dir && counts[s.wind_dir] !== undefined) counts[s.wind_dir]++;
  });
  const maxCount = Math.max(...Object.values(counts), 1);
  const topWinds = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
  el.innerHTML = buildWindRoseSVG(counts, maxCount, topWinds, 100);
}

// Box 2: Activity by Time of Day (Chart.js)
var intelActivityChartInstance = null;

function renderActivityChart(filteredSightings) {
  const el = document.getElementById('intelActivityBody');
  if(!el) return;
  // Destroy old chart instance if present
  if(intelActivityChartInstance) {
    intelActivityChartInstance.destroy();
    intelActivityChartInstance = null;
  }

  // Hourly buckets 0-23
  const hourly = new Array(24).fill(0);
  filteredSightings.forEach(s => {
    if(!s.time) return;
    const h = parseInt(s.time);
    if(h >= 0 && h < 24) hourly[h]++;
  });

  // 12hr labels
  const labels = hourly.map((_, h) => {
    if(h === 0) return '12a';
    if(h < 12) return h + 'a';
    if(h === 12) return '12p';
    return (h - 12) + 'p';
  });

  // Color bars by time period
  const barColors = hourly.map((_, h) => {
    if(h >= 5 && h < 10) return '#7a9275';   // dawn/morning
    if(h >= 10 && h < 16) return '#e87a3a';  // midday
    if(h >= 16 && h < 20) return '#c8a951';  // dusk/evening
    return '#4A4D4E';                          // night
  });

  // Insert canvas if not already there
  if(!el.querySelector('canvas')) {
    el.innerHTML = `<canvas id="intelActivityCanvas" style="width:100%;max-height:160px"></canvas>`;
  }
  const canvas = document.getElementById('intelActivityCanvas');
  if(!canvas || typeof Chart === 'undefined') return;

  intelActivityChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: hourly,
        backgroundColor: barColors,
        borderRadius: 2,
        maxBarThickness: 14
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1d1e',
          titleColor: '#BCC6CC',
          bodyColor: '#BCC6CC',
          borderColor: '#2a2c2e',
          borderWidth: 1,
          callbacks: {
            title: (items) => {
              const h = items[0].dataIndex;
              const suffix = h < 12 ? 'AM' : 'PM';
              const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
              return hr + ':00 ' + suffix;
            },
            label: (item) => item.raw + ' sighting' + (item.raw !== 1 ? 's' : '')
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: '#8a9199',
            font: { family: "'Roboto',sans-serif", size: 8 },
            maxRotation: 0,
            callback: function(val, i) { return i % 3 === 0 ? labels[i] : ''; }
          },
          grid: { display: false },
          border: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: '#4A4D4E',
            font: { family: "'Roboto',sans-serif", size: 9 },
            stepSize: 1,
            precision: 0
          },
          grid: { color: '#2a2d2e', drawBorder: false },
          border: { display: false }
        }
      }
    }
  });
}

// Box 3: Key Insights (wrapper around fetchAiInsights)
function renderKeyInsights(filteredSightings) {
  // Cache key includes property context hash so cache invalidates when intel cards change
  const ctxHash = propertyContextCache ? Object.values(propertyContextCache).join('').length : 0;
  const cacheKey = intelYear + '_' + intelBuck + '_' + filteredSightings.length + '_ctx' + ctxHash;
  fetchAiInsights(filteredSightings, cacheKey);
}

// Box 4: Recent Camera Activity
function renderRecentActivity(filteredSightings) {
  const el = document.getElementById('intelRecentBody');
  if(!el) return;
  const recent = filteredSightings
    .filter(s => s.date)
    .sort((a, b) => {
      const da = a.date + (a.time || '00:00');
      const db = b.date + (b.time || '00:00');
      return db.localeCompare(da);
    })
    .slice(0, 5);

  if(!recent.length) {
    el.innerHTML = `<div style="font-size:11px;color:var(--text3);padding:8px 0">No recent activity.</div>`;
    return;
  }

  el.innerHTML = recent.map(s => {
    const camName = s.camera_name || 'Field obs';
    const escapedCam = (s.camera_name || '').replace(/'/g, "\\'");
    const deerType = s.deer_type || 'Unknown';
    const dateStr = s.date ? fmtD(s.date) : '';
    const timeStr = s.time ? s.time.slice(0, 5) : '';
    const behavior = s.behavior || '';
    return `<div class="intel-activity-row" onclick="goToCamera('${escapedCam}')">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;color:var(--silver);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${camName}</div>
        <div style="font-size:10px;color:var(--text2)">${deerType}${behavior ? ' &middot; ' + behavior : ''}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:10px;color:var(--text2)">${dateStr}</div>
        <div style="font-size:10px;color:var(--text3)">${timeStr}</div>
      </div>
    </div>`;
  }).join('');
}

// Fetch AI key insights from /api/claude.js

var aiInsightsCache = {};
async function fetchAiInsights(filteredSightings, cacheKey) {
  const el = document.getElementById('intelAiInsights');
  if(aiInsightsCache[cacheKey]) {
    if(el) {
      el.innerHTML = aiInsightsCache[cacheKey].map(insight =>
        `<div class="intel-ai-bullet"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg><span>${insight}</span></div>`
      ).join('');
    }
    return aiInsightsCache[cacheKey];
  }
  if(el) el.innerHTML = `<div class="intel-ai-loading"><div class="spinner" style="width:16px;height:16px"></div> Analyzing sightings data...</div>`;

  // Build rich context summary for the AI
  const buckSightings = filteredSightings.filter(s => s.deer_type && s.deer_type.includes('Buck'));
  const cameras = [...new Set(filteredSightings.map(s => s.camera_name).filter(Boolean))];
  const namedBucks = [...new Set(filteredSightings.filter(s => s.buck_name).map(s => s.buck_name))];
  const recentDates = filteredSightings.map(s => s.date).filter(Boolean).sort().reverse().slice(0, 10);

  // Wind breakdown
  const winds = {};
  filteredSightings.forEach(s => { if(s.wind_dir) winds[s.wind_dir] = (winds[s.wind_dir]||0)+1; });
  const topWinds = Object.entries(winds).sort((a,b) => b[1]-a[1]).slice(0,5).map(([w,c]) => w+':'+c);

  // Behavior breakdown
  const behaviors = {};
  filteredSightings.forEach(s => { if(s.behavior) behaviors[s.behavior] = (behaviors[s.behavior]||0)+1; });

  // Hourly activity breakdown
  const hourly = new Array(24).fill(0);
  filteredSightings.forEach(s => { if(s.time) { const h = parseInt(s.time); if(h >= 0 && h < 24) hourly[h]++; } });
  const peakHours = hourly.map((c,h) => ({h,c})).filter(x => x.c > 0).sort((a,b) => b.c - a.c).slice(0,5).map(x => x.h + ':00(' + x.c + ')');

  // Weather conditions from sightings
  const temps = filteredSightings.filter(s => s.temp_f).map(s => s.temp_f);
  const avgTemp = temps.length ? Math.round(temps.reduce((a,b) => a+b, 0) / temps.length) : null;
  const pressures = filteredSightings.filter(s => s.pressure).map(s => s.pressure);
  const avgPressure = pressures.length ? Math.round(pressures.reduce((a,b) => a+b, 0) / pressures.length) : null;
  const precipCount = filteredSightings.filter(s => s.precip && parseFloat(s.precip) > 0).length;

  // Moon phases
  const moons = {};
  filteredSightings.forEach(s => { if(s.moon_phase) moons[s.moon_phase] = (moons[s.moon_phase]||0)+1; });
  const topMoons = Object.entries(moons).sort((a,b) => b[1]-a[1]).slice(0,3).map(([m,c]) => m+':'+c);

  // Monthly breakdown
  const months = new Array(12).fill(0);
  const MNAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  filteredSightings.forEach(s => { if(s.date) { const m = parseInt(s.date.slice(5,7)) - 1; if(m >= 0 && m < 12) months[m]++; } });
  const activeMonths = months.map((c,i) => ({m:MNAMES[i],c})).filter(x => x.c > 0).sort((a,b) => b.c - a.c).map(x => x.m+':'+x.c);

  // Property markers
  const stands = propertyMarkers.filter(m => m.type === 'Stand');
  const scrapes = propertyMarkers.filter(m => m.type === 'Scrape');
  const rubs = propertyMarkers.filter(m => m.type === 'Rub');
  const bedding = propertyMarkers.filter(m => m.type === 'Bedding');
  const markerSummary = 'Stands: ' + (stands.map(s => s.name || 'unnamed').join(', ') || 'none') +
    '. Scrapes: ' + scrapes.length + '. Rubs: ' + rubs.length + '. Bedding areas: ' + bedding.length + '.';

  // Property context (user-entered intel cards)
  let propContext = '';
  if(propertyContextCache) {
    propContext = Object.entries(propertyContextCache)
      .filter(([_,v]) => v)
      .map(([k,v]) => {
        const entries = parseIntelEntries(v);
        const text = entries.map(e => e.text).join(' ');
        return k + ': ' + text;
      }).join('. ');
  }

  // Dynamic property name
  let propName = 'this property';
  try {
    const { data: propData } = await sb.from('properties').select('name, description').eq('id', PROPERTY_ID).maybeSingle();
    if(propData) propName = propData.name + (propData.description ? ' (' + propData.description + ')' : '');
  } catch(_) {}

  const summary = 'Property: ' + propName + '. ' +
    filteredSightings.length + ' total sightings, ' + buckSightings.length + ' bucks. ' +
    'Named bucks: ' + (namedBucks.join(', ') || 'none') + '. ' +
    'Cameras: ' + cameras.join(', ') + '. ' +
    markerSummary + ' ' +
    'Wind dirs: ' + (topWinds.join(', ') || 'none') + '. ' +
    'Peak hours: ' + (peakHours.join(', ') || 'none') + '. ' +
    'Active months: ' + (activeMonths.join(', ') || 'none') + '. ' +
    (avgTemp !== null ? 'Avg temp: ' + avgTemp + 'F. ' : '') +
    (avgPressure !== null ? 'Avg pressure: ' + avgPressure + 'mb. ' : '') +
    (precipCount ? 'Sightings with precip: ' + precipCount + '. ' : '') +
    (topMoons.length ? 'Moon phases: ' + topMoons.join(', ') + '. ' : '') +
    'Behaviors: ' + (Object.entries(behaviors).map(([b,c]) => b+':'+c).join(', ') || 'none') + '. ' +
    'Recent dates: ' + recentDates.join(', ') + '. ' +
    (propContext ? 'Property intel: ' + propContext : '');

  try {
    const resp = await claudeFetch({
        model: 'claude-sonnet-4-5',
        max_tokens: 800,
        system: 'You are a whitetail deer hunting intelligence analyst for Huginn. You analyze property-specific sighting data and deliver sharp, actionable hunting insights. Be specific to this property and this data — never give generic hunting advice. Reference named bucks, specific cameras, and actual patterns in the data. Respond in 4-6 concise insight bullets, each one actionable.',
        messages: [{
          role: 'user',
          content: 'Analyze this property data and provide 4-6 actionable hunting insights. Format as a JSON array of strings.\n\nData: ' + summary
        }]
    });
    if(!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    const text = data.content?.[0]?.text || '';
    // Parse JSON array from response
    const match = text.match(/\[[\s\S]*\]/);
    let insights = [];
    if(match) {
      try { insights = JSON.parse(match[0]); } catch(e) { insights = [text]; }
    } else if(text) {
      insights = [text];
    }
    aiInsightsCache[cacheKey] = insights;
    if(el) {
      el.innerHTML = insights.map(insight =>
        `<div class="intel-ai-bullet"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg><span>${insight}</span></div>`
      ).join('');
    }
    return insights;
  } catch(e) {
    console.error('[KeyInsights] Error:', e);
    if(el) el.innerHTML = `<div style="font-size:11px;color:var(--text3)">Insights unavailable</div>`;
    return [];
  }
}


// --- Buck Dossier Sheet (full-screen, opened from Buck Intelligence cards) ---
var dossierBuckId = null;

function openBuckDossier(buckId) {
  const buckName = buckNameById(buckId) || buckId;
  const bs = sightings.filter(s => s.buck_name === buckName);
  if(!bs.length) return;
  dossierBuckId = buckId;

  // Open dossier sheet on top of current view (intel stays underneath)
  const sheet = document.getElementById('sheet-dossier');
  const overlay = document.getElementById('overlay-dossier');
  if(sheet) sheet.classList.add('open');
  if(overlay) overlay.classList.add('on');

  document.getElementById('dossierSheetTitle').textContent = buckName;

  // Data prep
  const sorted = bs.slice().sort((a,b) => (b.date||'').localeCompare(a.date||''));
  const photos = sorted.filter(s => s.image_url);
  const allPhotoUrls = photos.map(s => s.image_url);
  const cameras = [...new Set(bs.map(s => s.camera_name).filter(Boolean))];
  const regBuck = buckRegistry.find(b => b.id === buckId);
  const ageClass = sorted[0]?.deer_type || '';

  // Peak time bucket
  const TIME_BUCKETS = {Dawn:[5,7],Morning:[7,10],Midday:[10,13],Afternoon:[13,16],Dusk:[16,20],Night:[20,5]};
  const bTime = {}; Object.keys(TIME_BUCKETS).forEach(k => bTime[k]=0);
  bs.forEach(s => {
    if(!s.time) return;
    const h = parseInt(s.time);
    Object.entries(TIME_BUCKETS).forEach(([label,[start,end]]) => {
      if(start < end ? (h>=start && h<end) : (h>=start || h<end)) bTime[label]++;
    });
  });
  const peakTime = Object.entries(bTime).filter(([,c])=>c>0).sort((a,b)=>b[1]-a[1])[0];

  // Wind data for shared buildWindRoseSVG
  const WINDS = ["N","NE","E","SE","S","SW","W","NW"];
  const windCounts = {}; WINDS.forEach(w => windCounts[w]=0);
  bs.forEach(s => { if(s.wind_dir && windCounts[s.wind_dir] !== undefined) windCounts[s.wind_dir]++; });
  const maxWind = Math.max(...Object.values(windCounts), 1);
  const topWinds = Object.entries(windCounts).sort((a,b) => b[1] - a[1]).slice(0,3).map(e => e[0]);
  const hasWind = Object.values(windCounts).some(c => c > 0);

  // Behavior breakdown
  const behCounts = {};
  bs.forEach(s => { if(s.behavior) behCounts[s.behavior] = (behCounts[s.behavior]||0)+1; });
  const behEntries = Object.entries(behCounts).sort((a,b) => b[1]-a[1]);
  const maxBeh = behEntries[0]?.[1] || 1;

  // Seasonal (monthly)
  const monthCounts = new Array(12).fill(0);
  bs.forEach(s => { if(s.date) { const m = parseInt(s.date.slice(5,7)) - 1; if(m >= 0 && m < 12) monthCounts[m]++; } });
  const maxMonth = Math.max(...monthCounts, 1);
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Top cameras
  const camCounts = {};
  bs.forEach(s => { if(s.camera_name) camCounts[s.camera_name] = (camCounts[s.camera_name]||0)+1; });
  const topCams = Object.entries(camCounts).sort((a,b) => b[1]-a[1]).slice(0,5);
  const maxCam = topCams[0]?.[1] || 1;

  // Field observations
  const fieldObs = sorted.filter(s => s.source === 'observation');

  // Recent 10
  const recent10 = sorted.slice(0, 10);

  // Escaped name for onclick
  const eName = buckName.replace(/'/g, "\\'");

  // --- Weather Impact data prep ---
  // Temperature ranges
  const tempRanges = [['<20\u00B0F',0],['20-32\u00B0F',0],['32-45\u00B0F',0],['45-60\u00B0F',0],['>60\u00B0F',0]];
  bs.forEach(s => {
    if(!s.temp_f) return;
    const t = parseFloat(s.temp_f);
    if(t < 20) tempRanges[0][1]++;
    else if(t < 32) tempRanges[1][1]++;
    else if(t < 45) tempRanges[2][1]++;
    else if(t < 60) tempRanges[3][1]++;
    else tempRanges[4][1]++;
  });
  const maxTemp = Math.max(...tempRanges.map(r=>r[1]), 1);
  const hasTemp = tempRanges.some(r => r[1] > 0);

  // Pressure ranges
  const pressRanges = [['Low (<29.6)',0],['Normal',0],['High (>30.2)',0]];
  bs.forEach(s => {
    if(!s.pressure) return;
    const p = parseFloat(s.pressure);
    if(p < 29.6) pressRanges[0][1]++;
    else if(p <= 30.2) pressRanges[1][1]++;
    else pressRanges[2][1]++;
  });
  const maxPress = Math.max(...pressRanges.map(r=>r[1]), 1);
  const hasPress = pressRanges.some(r => r[1] > 0);

  // Wind speed ranges
  const wsRanges = [['Calm (0-5)',0],['Light (5-15)',0],['Moderate (15-25)',0],['Strong (>25)',0]];
  bs.forEach(s => {
    if(!s.wind_speed) return;
    const w = parseFloat(s.wind_speed);
    if(w <= 5) wsRanges[0][1]++;
    else if(w <= 15) wsRanges[1][1]++;
    else if(w <= 25) wsRanges[2][1]++;
    else wsRanges[3][1]++;
  });
  const maxWs = Math.max(...wsRanges.map(r=>r[1]), 1);
  const hasWs = wsRanges.some(r => r[1] > 0);
  const hasWeatherData = hasTemp || hasPress || hasWs;

  // Helper: render bar rows
  const barRows = (ranges, max) => ranges.filter(([,c]) => c > 0).map(([lbl, cnt]) =>
    `<div class="dossier-bar-row"><div class="dossier-bar-lbl">${lbl}</div><div class="dossier-bar-track"><div class="dossier-bar-fill" style="width:${Math.round(cnt/max*100)}%"></div></div><div class="dossier-bar-cnt">${cnt}</div></div>`
  ).join('');

  // --- Build HTML ---
  let html = '';

  // 1. Hero
  if(photos.length) {
    html += `<div class="dossier-hero">
      <img src="${photos[0].image_url}" alt="${buckName}"/>
      <div class="dossier-hero-name">${buckName}</div>
      ${ageClass.includes('Buck') ? `<div class="dossier-hero-age">${ageClass.replace('Buck - ','')}</div>` : ''}
    </div>`;
  } else {
    html += `<div class="dossier-hero dossier-hero-placeholder">
      <div class="dossier-hero-name" style="font-size:32px">${buckName}</div>
    </div>`;
  }

  // 2. Stats row
  html += `<div class="dossier-stats-row">
    <div class="dossier-stat-pill"><div class="dossier-stat-val">${bs.length}</div><div class="dossier-stat-lbl">Sightings</div></div>
    <div class="dossier-stat-pill"><div class="dossier-stat-val">${cameras.length}</div><div class="dossier-stat-lbl">Cameras</div></div>
    <div class="dossier-stat-pill"><div class="dossier-stat-val">${peakTime ? peakTime[0] : '--'}</div><div class="dossier-stat-lbl">Peak Time</div></div>
  </div>`;

  // 3. Key Insights (AI-generated, buck-specific)
  html += `<div class="dossier-sec" style="border-top:1px solid var(--border)">
    <div class="dossier-sec-title"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg> Key Insights</div>
    <div id="dossierAiInsights"><div class="intel-ai-loading"><div class="spinner" style="width:16px;height:16px"></div> Analyzing ${buckName}...</div></div>
  </div>`;

  // 4+5. Wind Conditions + Activity by Hour — full width, side-by-side on desktop
  html += `<div class="dossier-wind-activity-row">`;
  if(hasWind) {
    html += `<div class="dossier-sec">
      <div class="dossier-sec-title"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg> Wind Conditions</div>
      <div style="display:flex;justify-content:center">${buildWindRoseSVG(windCounts, maxWind, topWinds, 100)}</div>
    </div>`;
  }
  html += `<div class="dossier-sec">
    <div class="dossier-sec-title"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Activity by Hour</div>
    ${build24HrTimeline(bs, true)}
  </div>`;
  html += `</div>`;

  // 6. Weather Impact on Movement (NEW)
  if(hasWeatherData) {
    html += `<div class="dossier-sec">
      <div class="dossier-sec-title"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg> Weather Impact on Movement</div>
      <div id="dossierWeatherSummary" style="font-size:11px;color:var(--text2);font-style:italic;margin-bottom:12px;line-height:1.5"><div class="intel-ai-loading"><div class="spinner" style="width:14px;height:14px"></div> Analyzing weather patterns...</div></div>`;
    if(hasTemp) {
      html += `<div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;margin-top:10px">Temperature</div>${barRows(tempRanges, maxTemp)}`;
    }
    if(hasPress) {
      html += `<div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;margin-top:10px">Barometric Pressure</div>${barRows(pressRanges, maxPress)}`;
    }
    if(hasWs) {
      html += `<div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;margin-top:10px">Wind Speed (mph)</div>${barRows(wsRanges, maxWs)}`;
    }
    html += `</div>`;
  }

  // 7. Two-column grid: Behavior+Seasonal | TopCams+FieldObs
  html += `<div class="dossier-2col-grid">`;
  // Left column
  html += `<div>`;
  if(behEntries.length) {
    html += `<div class="dossier-sec">
      <div class="dossier-sec-title"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> Behavior Breakdown</div>
      ${behEntries.map(([beh, cnt]) => `<div class="dossier-bar-row">
        <div class="dossier-bar-lbl">${beh}</div>
        <div class="dossier-bar-track"><div class="dossier-bar-fill" style="width:${Math.round(cnt/maxBeh*100)}%"></div></div>
        <div class="dossier-bar-cnt">${cnt}</div>
      </div>`).join('')}
    </div>`;
  }
  html += `<div class="dossier-sec">
    <div class="dossier-sec-title"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Seasonal Activity</div>
    <div style="display:flex;gap:2px;align-items:flex-end;height:50px">
      ${monthCounts.map((cnt, i) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
        <div style="width:100%;background:${cnt ? 'var(--bronze)' : 'var(--border)'};height:${Math.max(2, Math.round(cnt/maxMonth*40))}px;border-radius:2px;opacity:${cnt ? 1 : 0.3}"></div>
        <div style="font-size:7px;color:var(--text3)">${MONTHS[i]}</div>
      </div>`).join('')}
    </div>
  </div>`;
  html += `</div>`;
  // Right column
  html += `<div>`;
  if(topCams.length) {
    html += `<div class="dossier-sec">
      <div class="dossier-sec-title"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg> Top Cameras</div>
      ${topCams.map(([cam, cnt]) => `<div class="dossier-bar-row">
        <div class="dossier-bar-lbl">${cam}</div>
        <div class="dossier-bar-track"><div class="dossier-bar-fill" style="width:${Math.round(cnt/maxCam*100)}%"></div></div>
        <div class="dossier-bar-cnt">${cnt}</div>
      </div>`).join('')}
    </div>`;
  }
  html += `<div class="dossier-sec">
    <div class="dossier-sec-title"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Field Observations</div>
    ${fieldObs.length ? fieldObs.slice(0,10).map(s => `<div class="dossier-field-obs-item">
      <div style="font-weight:600;color:var(--silver)">${fmtD(s.date)}${s.time ? ' '+s.time.slice(0,5) : ''}</div>
      <div>${s.behavior ? s.behavior + ' &middot; ' : ''}${s.wind_dir ? s.wind_dir+' wind' : ''}${s.temp_f ? ' &middot; '+s.temp_f+'\u00B0F' : ''}</div>
      ${s.notes ? `<div style="color:var(--text3);font-style:italic;margin-top:2px">${s.notes}</div>` : ''}
    </div>`).join('') : `<div style="font-size:12px;color:var(--text3);padding:8px 0">No field observations yet</div>`}
  </div>`;
  html += `</div>`;
  html += `</div>`; // end 2col grid

  // 8. Antler Description (editable)
  html += `<div class="dossier-sec">
    <div class="dossier-sec-title"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><path d="M12 20 L12 14"/><path d="M12 14 L9 10 L7 7 L5 5"/><path d="M9 10 L7 12"/><path d="M7 7 L5 9"/><path d="M12 14 L15 10 L17 7 L19 5"/><path d="M15 10 L17 12"/><path d="M17 7 L19 9"/></svg> Antler Description</div>
    <div style="position:relative">
      <input type="text" id="dossierAntlerDesc" placeholder="e.g. Drop tine left G2, wide spread, dark tarsal glands" style="width:100%;padding:8px 30px 8px 10px;border-radius:8px;background:var(--surface2);border:1px solid var(--border2);color:var(--text);font-size:12px;font-family:var(--font);font-style:italic" onblur="saveDossierAntlerDesc()"/>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2" stroke-linecap="round" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);pointer-events:none;opacity:0.4"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
    </div>
  </div>`;

  // 9. Hunter's Notes (append model)
  html += `<div class="dossier-sec">
    <div class="dossier-sec-title"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Hunter's Notes</div>
    <textarea id="dossierNewNote" placeholder="Add a new observation..." style="width:100%;padding:8px 10px;border-radius:8px;background:var(--surface2);border:1px solid var(--border2);color:var(--text);font-size:12px;font-family:var(--font);resize:vertical;min-height:40px"></textarea>
    <button onclick="appendDossierNote()" style="margin-top:8px;padding:8px 16px;border-radius:8px;border:1px solid var(--gold);background:rgba(140,115,85,0.15);color:var(--gold);font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font);min-height:44px">Add Note</button>
    <div id="dossierNotesHistory" style="max-height:200px;overflow-y:auto;margin-top:8px"></div>
  </div>`;

  // 10. Photo Gallery
  html += `<div class="dossier-sec">
    <div class="dossier-sec-title"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Confirmed Photos${allPhotoUrls.length ? ' ('+allPhotoUrls.length+')' : ''}</div>
    ${allPhotoUrls.length ? `<div class="dossier-photo-row">${allPhotoUrls.slice(0,20).map((url, i) =>
      `<img src="${url}" loading="lazy" alt="Photo ${i+1}" onclick="openPhotoLightbox(dossierPhotoUrls, ${i})"/>`
    ).join('')}</div>` : `<div style="font-size:12px;color:var(--text3);padding:8px 0">No confirmed photos yet</div>`}
  </div>`;

  // 10b. Graph Intelligence (Knowledge Graph — injected async after render)
  html += `<div id="kg-intel-placeholder" class="kg-loading">Loading intelligence...</div>`;

  // 11. Recent Sightings
  html += `<div class="dossier-sec">
    <div class="dossier-sec-title"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> Recent Sightings</div>
    ${recent10.map(s => `<div class="dossier-sighting-item" style="cursor:pointer" onclick="showDetFromDossier(${s.id})">
      ${s.image_url ? `<img class="dossier-sighting-thumb" src="${s.image_url}" loading="lazy"/>` : ''}
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;color:var(--silver)">${s.camera_name || 'Field Obs'}${s.time ? ' &middot; '+s.time.slice(0,5) : ''}</div>
        <div style="font-size:11px;color:var(--text3)">${fmtD(s.date)}${s.behavior ? ' &middot; '+s.behavior : ''}${s.wind_dir ? ' &middot; '+s.wind_dir : ''}</div>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2" stroke-linecap="round" style="flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg>
    </div>`).join('')}
  </div>`;

  // 12. Sticky bottom bar
  html += `<div class="dossier-sticky-bar">
    <button class="dossier-sticky-btn" onclick="viewAllBuckSightings('${eName}')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-2px;margin-right:4px"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/></svg>
      View All Sightings
    </button>
  </div>`;

  // Store photo URLs for lightbox
  window.dossierPhotoUrls = allPhotoUrls;

  document.getElementById('dossierContent').innerHTML = html;

  // Load antler description and notes from bucks table
  loadDossierBuckData(buckId);
  // Fetch buck-specific AI insights + weather summary
  fetchBuckInsights(buckId, buckName, bs);
  if(hasWeatherData) fetchBuckWeatherSummary(buckId, buckName, bs);

  // Inject Graph Intelligence (Knowledge Graph) async — never blocks dossier render.
  // Uses innerHTML (not outerHTML) so the placeholder element remains in the DOM
  // regardless of resolution order. This prevents a mobile race condition where
  // loadBuckGraphIntelligence's Supabase queries resolve faster than the slower
  // claudeFetch calls in fetchBuckInsights and fetchBuckWeatherSummary — on iOS
  // Safari the outerHTML replacement of a sibling could trigger a reparse/reflow
  // that interferes with those still-pending network requests.
  loadBuckGraphIntelligence(buckName, buckId).then(function(data) {
    var placeholder = document.getElementById('kg-intel-placeholder');
    if (!placeholder) return;
    var kgHtml = renderBuckGraphIntelligence(data);
    placeholder.innerHTML = kgHtml || '';
    placeholder.className = ''; // remove kg-loading class regardless of data state
  });
}

// Buck-specific AI insights for dossier
var buckInsightsCache = {};

async function fetchBuckInsights(buckId, buckName, buckSightings) {
  const el = document.getElementById('dossierAiInsights');
  if(!el) return;

  // Check cache
  const cacheKey = 'buck_' + buckId + '_' + buckSightings.length;
  if(buckInsightsCache[cacheKey]) {
    el.innerHTML = buckInsightsCache[cacheKey].map(insight =>
      `<div class="intel-ai-bullet"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg><span>${insight}</span></div>`
    ).join('');
    return;
  }

  // Build buck-specific context
  const regBuck = buckRegistry.find(b => b.id === buckId);
  const ageClass = buckSightings[0]?.deer_type || 'Buck';
  const antlerDesc = regBuck?.antler_description || '';
  const hunterNotes = regBuck?.notes || '';
  const notesSummary = hunterNotes ? hunterNotes.split('\n---\n').slice(-3).map(e => e.replace(/^\[.+?\]\s*/, '')).join('; ') : '';

  const dates = buckSightings.map(s => s.date).filter(Boolean).sort();
  const firstSeen = dates[0] || 'unknown';
  const lastSeen = dates[dates.length - 1] || 'unknown';

  // Top cameras
  const camCounts = {};
  buckSightings.forEach(s => { if(s.camera_name) camCounts[s.camera_name] = (camCounts[s.camera_name]||0)+1; });
  const topCams = Object.entries(camCounts).sort((a,b) => b[1]-a[1]).slice(0,5).map(([c,n]) => c+':'+n);

  // Wind breakdown
  const winds = {};
  buckSightings.forEach(s => { if(s.wind_dir) winds[s.wind_dir] = (winds[s.wind_dir]||0)+1; });
  const topWinds = Object.entries(winds).sort((a,b) => b[1]-a[1]).slice(0,5).map(([w,c]) => w+':'+c);

  // Hourly activity
  const hourly = new Array(24).fill(0);
  buckSightings.forEach(s => { if(s.time) { const h = parseInt(s.time); if(h >= 0 && h < 24) hourly[h]++; } });
  const peakHours = hourly.map((c,h) => ({h,c})).filter(x => x.c > 0).sort((a,b) => b.c - a.c).slice(0,5).map(x => x.h + ':00('+x.c+')');

  // Behavior breakdown
  const behaviors = {};
  buckSightings.forEach(s => { if(s.behavior) behaviors[s.behavior] = (behaviors[s.behavior]||0)+1; });

  // Monthly breakdown
  const months = new Array(12).fill(0);
  const MNAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  buckSightings.forEach(s => { if(s.date) { const m = parseInt(s.date.slice(5,7)) - 1; if(m >= 0 && m < 12) months[m]++; } });
  const activeMonths = months.map((c,i) => ({m:MNAMES[i],c})).filter(x => x.c > 0).sort((a,b) => b.c - a.c).map(x => x.m+':'+x.c);

  // Temps
  const temps = buckSightings.filter(s => s.temp_f).map(s => parseFloat(s.temp_f));
  const avgTemp = temps.length ? Math.round(temps.reduce((a,b) => a+b, 0) / temps.length) : null;

  // Stands nearby
  const stands = propertyMarkers.filter(m => m.type === 'Stand');
  const standNames = stands.map(s => s.name || 'unnamed').join(', ') || 'none';

  const summary = 'Buck: ' + buckName + '. Age class: ' + ageClass + '. ' +
    (antlerDesc ? 'Antler description: ' + antlerDesc + '. ' : '') +
    buckSightings.length + ' total sightings. First seen: ' + firstSeen + '. Last seen: ' + lastSeen + '. ' +
    'Top cameras: ' + (topCams.join(', ') || 'none') + '. ' +
    'Wind dirs: ' + (topWinds.join(', ') || 'none') + '. ' +
    'Peak hours: ' + (peakHours.join(', ') || 'none') + '. ' +
    'Active months: ' + (activeMonths.join(', ') || 'none') + '. ' +
    (avgTemp !== null ? 'Avg temp at sightings: ' + avgTemp + 'F. ' : '') +
    'Behaviors: ' + (Object.entries(behaviors).map(([b,c]) => b+':'+c).join(', ') || 'none') + '. ' +
    'Stands on property: ' + standNames + '. ' +
    (notesSummary ? 'Hunter notes: ' + notesSummary : '');

  try {
    const resp = await claudeFetch({
      model: 'claude-sonnet-4-5',
      max_tokens: 600,
      system: 'You are a whitetail deer hunting intelligence analyst for Huginn. You are analyzing a SINGLE named buck based on its sighting history. Deliver insights specific to this individual buck — behavioral patterns, best conditions to encounter it, which cameras and stands offer the best opportunity, seasonal timing, and an actionable recommendation: "Hunt this buck when..." Be specific to THIS buck and THIS data. Respond in 4-5 concise bullets.',
      messages: [{
        role: 'user',
        content: 'Analyze this individual buck and provide 4-5 actionable hunting insights specific to this deer. Format as a JSON array of strings.\n\nData: ' + summary
      }]
    });
    if(!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\[[\s\S]*\]/);
    let insights = [];
    if(match) {
      try { insights = JSON.parse(match[0]); } catch(e) { insights = [text]; }
    } else if(text) {
      insights = [text];
    }
    buckInsightsCache[cacheKey] = insights;
    if(el) {
      el.innerHTML = insights.map(insight =>
        `<div class="intel-ai-bullet"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg><span>${insight}</span></div>`
      ).join('');
    }
  } catch(e) {
    console.error('[BuckInsights] Error:', e);
    if(el) el.innerHTML = `<div style="font-size:11px;color:var(--text3)">Insights unavailable</div>`;
  }
}

// Buck-specific AI weather summary
var buckWeatherCache = {};

async function fetchBuckWeatherSummary(buckId, buckName, buckSightings) {
  const el = document.getElementById('dossierWeatherSummary');
  if(!el) return;
  const cacheKey = 'wx_' + buckId + '_' + buckSightings.length;
  if(buckWeatherCache[cacheKey]) {
    el.innerHTML = buckWeatherCache[cacheKey];
    return;
  }
  // Build compact weather context
  const temps = buckSightings.filter(s => s.temp_f).map(s => parseFloat(s.temp_f));
  const avgT = temps.length ? Math.round(temps.reduce((a,b)=>a+b,0)/temps.length) : null;
  const minT = temps.length ? Math.round(Math.min(...temps)) : null;
  const maxT = temps.length ? Math.round(Math.max(...temps)) : null;
  const winds = {};
  buckSightings.forEach(s => { if(s.wind_dir) winds[s.wind_dir] = (winds[s.wind_dir]||0)+1; });
  const topW = Object.entries(winds).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([w,c])=>w+':'+c);
  const pressures = buckSightings.filter(s => s.pressure).map(s => parseFloat(s.pressure));
  const avgP = pressures.length ? (pressures.reduce((a,b)=>a+b,0)/pressures.length).toFixed(1) : null;
  const wSpeeds = buckSightings.filter(s => s.wind_speed).map(s => parseFloat(s.wind_speed));
  const avgWs = wSpeeds.length ? Math.round(wSpeeds.reduce((a,b)=>a+b,0)/wSpeeds.length) : null;

  const ctx = buckName + ': ' + buckSightings.length + ' sightings. ' +
    (avgT !== null ? 'Temp range ' + minT + '-' + maxT + 'F, avg ' + avgT + 'F. ' : '') +
    (topW.length ? 'Wind dirs: ' + topW.join(', ') + '. ' : '') +
    (avgP ? 'Avg pressure: ' + avgP + 'mb. ' : '') +
    (avgWs !== null ? 'Avg wind speed: ' + avgWs + 'mph. ' : '');

  try {
    const resp = await claudeFetch({
      model: 'claude-sonnet-4-5',
      max_tokens: 150,
      system: 'You summarize a specific buck\'s weather preferences in ONE sentence based on sighting data. Be specific: mention temp ranges, wind directions, and pressure conditions. Example: "Marsh Buck moves most in cold temps (28-42°F) on post-front days with NW winds." Just the sentence, no quotes or prefix.',
      messages: [{ role: 'user', content: 'Summarize this buck\'s weather preferences in one sentence.\n\n' + ctx }]
    });
    if(!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    const text = (data.content?.[0]?.text || '').replace(/^["']|["']$/g, '').trim();
    if(text) {
      buckWeatherCache[cacheKey] = text;
      el.innerHTML = text;
    } else {
      el.innerHTML = '';
    }
  } catch(e) {
    el.innerHTML = '';
  }
}

// Open sighting detail on top of dossier (without closing dossier)
function showDetFromDossier(id) {
  // Populate detail content using showDet's template, then open detail sheet on top
  const s = sightings.find(x => x.id === id);
  if(!s) return;
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
      <div style="font-size:13px;color:var(--text3);margin-bottom:14px">${s.camera_name||''}</div>
      <div class="detail-grid">
        <div class="d-cell"><div class="d-cell-lbl">Date</div><div class="d-cell-val">${fmtD(s.date)}</div></div>
        <div class="d-cell"><div class="d-cell-lbl">Time</div><div class="d-cell-val">${fmtT(s.time)}</div></div>
        <div class="d-cell"><div class="d-cell-lbl">Moon</div><div class="d-cell-val">${m.i} ${m.l}</div></div>
        <div class="d-cell"><div class="d-cell-lbl">Behavior</div><div class="d-cell-val">${s.behavior||'--'}</div></div>
      </div>
      ${wxHtml}
      ${s.notes?`<div style="background:var(--bg);border-radius:10px;padding:10px;margin-top:10px"><div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Notes</div><div style="font-size:13px;color:var(--text2);line-height:1.6;font-style:italic">${s.notes}</div></div>`:''}
    </div>`;
  // Open detail sheet on top of dossier (don't close dossier)
  document.getElementById('sheet-detail')?.classList.add('open');
  document.getElementById('overlay-detail')?.classList.add('on');
}

function closeDossierSheet() {
  document.getElementById('sheet-dossier')?.classList.remove('open');
  document.getElementById('overlay-dossier')?.classList.remove('on');
}

async function loadDossierBuckData(buckId) {
  try {
    const { data } = await sb.from('bucks').select('notes, antler_description').eq('id', buckId).maybeSingle();
    const ad = document.getElementById('dossierAntlerDesc');
    if(ad && data?.antler_description) ad.value = data.antler_description;
    const hist = document.getElementById('dossierNotesHistory');
    if(hist && data?.notes) {
      const entries = data.notes.split('\n---\n').filter(Boolean).reverse();
      hist.innerHTML = entries.map(e => {
        const tsMatch = e.match(/^\[(.+?)\]\s*/);
        const ts = tsMatch ? tsMatch[1] : '';
        const body = tsMatch ? e.slice(tsMatch[0].length) : e;
        return `<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:11px;color:var(--text2);line-height:1.5">${ts ? `<div style="font-size:9px;color:var(--text3);margin-bottom:2px">${ts}</div>` : ''}${body}</div>`;
      }).join('');
    }
  } catch(e) { /* silent */ }
}

function saveDossierAntlerDesc() {
  if(!dossierBuckId) return;
  const val = document.getElementById('dossierAntlerDesc')?.value || '';
  sb.from('bucks').update({ antler_description: val }).eq('id', dossierBuckId).then(() => {
    const reg = buckRegistry.find(b => b.id === dossierBuckId);
    if(reg) reg.antler_description = val;
    showToast('Antler description saved');
  }).catch(() => showToast('Failed to save'));
}

async function appendDossierNote() {
  if(!dossierBuckId) return;
  const input = document.getElementById('dossierNewNote');
  const text = input?.value?.trim();
  if(!text) return;
  try {
    const { data } = await sb.from('bucks').select('notes').eq('id', dossierBuckId).maybeSingle();
    const ts = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const entry = `[${ts}] ${text}`;
    const updated = data?.notes ? data.notes + '\n---\n' + entry : entry;
    await sb.from('bucks').update({ notes: updated }).eq('id', dossierBuckId);
    const reg = buckRegistry.find(b => b.id === dossierBuckId);
    if(reg) reg.notes = updated;
    input.value = '';
    showToast('Note added');
    loadDossierBuckData(dossierBuckId);
  } catch(e) { showToast('Failed to add note'); }
}

function viewAllBuckSightings(buckName) {
  closeDossierSheet();
  setTimeout(() => {
    const deerSel = document.getElementById('sfDeer');
    if(deerSel) deerSel.value = buckName;
    const yrSel = document.getElementById('sfYear');
    if(yrSel) yrSel.value = 'all';
    const moSel = document.getElementById('sfMonth');
    if(moSel) moSel.value = 'all';
    sfDateMode = 'custom'; // show all time, not just 30 days
    curSightFeed = 'cams';
    sightShowCount = sightPageSize;
    openSheet('sightings');
  }, 250);
}


// --- Photo Lightbox ---
var lightboxPhotos = [];
var lightboxIdx = 0;

function openPhotoLightbox(photos, idx) {
  lightboxPhotos = photos || [];
  lightboxIdx = idx || 0;
  if(!lightboxPhotos.length) return;
  const existing = document.getElementById('photoLightbox');
  if(existing) existing.remove();
  const lb = document.createElement('div');
  lb.id = 'photoLightbox';
  lb.className = 'photo-lightbox';
  lb.onclick = function(e) { if(e.target === lb) closePhotoLightbox(); };
  renderLightboxContent(lb);
  document.body.appendChild(lb);
}

function renderLightboxContent(lb) {
  if(!lb) lb = document.getElementById('photoLightbox');
  if(!lb) return;
  lb.innerHTML = `
    <button class="photo-lightbox-close" onclick="closePhotoLightbox()">&#215;</button>
    ${lightboxPhotos.length > 1 ? `<button class="photo-lightbox-nav prev" onclick="lightboxPrev()">&#8249;</button>
    <button class="photo-lightbox-nav next" onclick="lightboxNext()">&#8250;</button>` : ''}
    <img src="${lightboxPhotos[lightboxIdx]}" alt="Photo"/>
  `;
}

function lightboxPrev() {
  lightboxIdx = (lightboxIdx - 1 + lightboxPhotos.length) % lightboxPhotos.length;
  renderLightboxContent();
}

function lightboxNext() {
  lightboxIdx = (lightboxIdx + 1) % lightboxPhotos.length;
  renderLightboxContent();
}

function closePhotoLightbox() {
  const lb = document.getElementById('photoLightbox');
  if(lb) lb.remove();
  lightboxPhotos = [];
  lightboxIdx = 0;
}

// Jump to camera on map from Recent Activity

function goToCamera(camName) {
  closeSheet('intel');
  activateTab('map');
  setTimeout(() => {
    if(camLocations[camName] && mapInstance) {
      mapInstance.flyTo({ center: [camLocations[camName].lng, camLocations[camName].lat], zoom: 16 });
    }
  }, 400);
}

// Render 7-day conditions chart using Chart.js

var conditionsChartInstance = null;

async function renderConditionsChart() {
  const canvas = document.getElementById('intelConditionsCanvas');
  if(!canvas || typeof Chart === 'undefined') return;

  // Destroy previous instance
  if(conditionsChartInstance) {
    conditionsChartInstance.destroy();
    conditionsChartInstance = null;
  }

  try {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + CLAT + '&longitude=' + CLNG +
      '&daily=temperature_2m_max,windspeed_10m_max' +
      '&hourly=surface_pressure' +
      '&wind_speed_unit=mph&temperature_unit=fahrenheit' +
      '&timezone=America%2FChicago&forecast_days=7';
    const r = await fetch(url);
    const j = await r.json();
    if(!j.daily) return;

    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const labels = j.daily.time.map(d => {
      const dt = new Date(d + 'T12:00:00');
      return dayNames[dt.getDay()];
    });
    const temps = j.daily.temperature_2m_max;
    const winds = j.daily.windspeed_10m_max;
    // Average pressure per day (hPa → inHg: divide by 33.8639)
    const pressures = j.daily.time.map((_, i) => {
      const dayP = j.hourly.surface_pressure.slice(i * 24, (i + 1) * 24).filter(Boolean);
      if(!dayP.length) return null;
      const avgHpa = dayP.reduce((a, b) => a + b, 0) / dayP.length;
      return Math.round(avgHpa / 33.8639 * 100) / 100;
    });

    conditionsChartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Temperature',
            data: temps,
            borderColor: '#8C7355',
            backgroundColor: 'rgba(140,115,85,0.08)',
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointBackgroundColor: '#8C7355',
            pointHoverRadius: 6,
            borderWidth: 2,
            yAxisID: 'y'
          },
          {
            label: 'Pressure',
            data: pressures,
            borderColor: '#BCC6CC',
            backgroundColor: 'rgba(188,198,204,0.06)',
            fill: false,
            tension: 0.35,
            pointRadius: 4,
            pointBackgroundColor: '#BCC6CC',
            pointHoverRadius: 6,
            borderWidth: 2,
            yAxisID: 'y1'
          },
          {
            label: 'Wind Speed',
            data: winds,
            borderColor: '#E5B53B',
            backgroundColor: 'rgba(229,181,59,0.06)',
            fill: false,
            tension: 0.35,
            pointRadius: 4,
            pointBackgroundColor: '#E5B53B',
            pointHoverRadius: 6,
            borderWidth: 2,
            yAxisID: 'y'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'start',
            labels: {
              color: '#8a9199',
              font: { family: "'Roboto',sans-serif", size: 10 },
              boxWidth: 10,
              boxHeight: 10,
              padding: 14,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: 'rgba(18,20,21,0.95)',
            titleColor: '#BCC6CC',
            bodyColor: '#BCC6CC',
            borderColor: '#2a2c2e',
            borderWidth: 1,
            padding: 10,
            titleFont: { family: "'Roboto',sans-serif", size: 11 },
            bodyFont: { family: "'Roboto',sans-serif", size: 11 },
            callbacks: {
              label: function(ctx) {
                const v = ctx.raw;
                if(v == null) return ctx.dataset.label + ': --';
                if(ctx.datasetIndex === 0) return 'Temp: ' + Math.round(v) + '\u00B0F';
                if(ctx.datasetIndex === 1) return 'Pressure: ' + v.toFixed(2) + ' inHg';
                return 'Wind: ' + Math.round(v) + ' mph';
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#4A4D4E', font: { family: "'Roboto',sans-serif", size: 10 } },
            grid: { display: false },
            border: { display: false }
          },
          y: {
            position: 'left',
            ticks: { color: '#4A4D4E', font: { family: "'Roboto',sans-serif", size: 9 } },
            grid: { color: '#2a2d2e', drawBorder: false },
            border: { display: false }
          },
          y1: {
            position: 'right',
            ticks: {
              color: '#4A4D4E',
              font: { family: "'Roboto',sans-serif", size: 9 },
              callback: function(v) { return v.toFixed(1); }
            },
            grid: { display: false },
            border: { display: false }
          }
        }
      }
    });
  } catch(e) {
    console.error('Conditions chart error:', e);
  }
}



function buildYearBar(containerId) {
  const el = document.getElementById(containerId);
  if(!el) return;
  const years = getAvailableYears();
  el.innerHTML = `<button class="ychip${curYear==="all"?" on":""}" onclick="setYear('all')">All Years</button>`
    + years.map(y => `<button class="ychip${curYear===y?" on":""}" onclick="setYear('${y}')">${y}</button>`).join("");
}

function setIntelYear(y) {
  intelYear = y;
  renderDash();
}

function setIntelBuck(b) {
  intelBuck = b;
  renderDash();
}

function buildIntelFilters() {
  const yrSel = document.getElementById('intelYear');
  const bkSel = document.getElementById('intelBuck');
  if(!yrSel || !bkSel) return;
  const years = getAvailableYears();
  yrSel.innerHTML = '<option value="all">All Years</option>' +
    years.map(y => `<option value="${y}"${intelYear===y?' selected':''}>${y}</option>`).join('');
  yrSel.value = intelYear;
  const bucks = getNamedBucks().sort();
  bkSel.innerHTML = '<option value="all">All Bucks</option>' +
    bucks.map(b => `<option value="${b}"${intelBuck===b?' selected':''}>${b}</option>`).join('');
  bkSel.value = intelBuck;
}

function intelFiltered(arr) {
  let base = arr;
  if(intelYear !== 'all') base = base.filter(s => s.date && s.date.startsWith(intelYear));
  if(intelBuck !== 'all') base = base.filter(s => s.buck_name === intelBuck);
  return base;
}

function setYear(y) {
  curYear = y;
  renderLog();
  renderDash();
  buildYearBar('mybar');
  refreshMapPins();
  updateBuckLines();
  if(curMapFilter !== 'all') {
    showHeatmap(curMapFilter);
    showCoreArea(curMapFilter);
  }
}


function renderDash() {
  if(!document.getElementById("intelContent")) return;
  buildIntelFilters();
  const ys = intelFiltered(sightings);
  const totalCount = ys.length;
  const buckCount = ys.filter(s => s.deer_type && s.deer_type.includes("Buck")).length;
  const matureCount = ys.filter(s => s.deer_type && s.deer_type.includes("Mature")).length;

  // Stats strip
  let html = `<div class="sgrid">
    <div class="sbox"><div class="snum">${totalCount}</div><div class="slbl">Total</div></div>
    <div class="sbox"><div class="snum">${buckCount}</div><div class="slbl">Bucks</div></div>
    <div class="sbox"><div class="snum">${matureCount}</div><div class="slbl">Mature</div></div>
  </div>`;

  // Filtered-to-buck banner
  if(intelBuck !== 'all') {
    html += `<div style="background:rgba(140,115,85,0.08);border:1px solid rgba(140,115,85,0.2);border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:11px;color:var(--text2);line-height:1.5">Showing data filtered to <strong style="color:var(--bronze)">${intelBuck}</strong> \u2014 tap the buck card below for full dossier</div>`;
  }

  const emptyMsg = '<div style="font-size:12px;color:var(--text3);text-align:center;padding:16px 8px;line-height:1.6">Log your first sighting to unlock this insight</div>';

  if(!totalCount) {
    // Show Buck Intelligence empty state
    html += `<div style="font-size:10px;color:var(--bronze);text-transform:uppercase;letter-spacing:2.5px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:6px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20 L12 14"/><path d="M12 14 L9 10 L7 7 L5 5"/><path d="M9 10 L7 12"/><path d="M7 7 L5 9"/><path d="M12 14 L15 10 L17 7 L19 5"/><path d="M15 10 L17 12"/><path d="M17 7 L19 9"/></svg> Buck Intelligence</div>`;
    html += `<div class="buck-intel-empty" style="margin-bottom:32px">No named bucks yet \u2014 tag a buck in a sighting to build your registry</div>`;
    // Show full Intel structure with empty state placeholders
    html += `<div style="font-size:10px;color:var(--bronze);text-transform:uppercase;letter-spacing:2.5px;font-weight:700;margin-bottom:10px">Analytics</div>`;
    html += `<div class="intel-4grid" style="margin-bottom:32px">
      <div class="intel-box"><div class="intel-box-title"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg> Wind Rose</div><div class="intel-box-body">${emptyMsg}</div></div>
      <div class="intel-box"><div class="intel-box-title"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/></svg> Activity by Time</div><div class="intel-box-body">${emptyMsg}</div></div>
      <div class="intel-box"><div class="intel-box-title"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg> Key Insights</div><div class="intel-box-body">${emptyMsg}</div></div>
      <div class="intel-box"><div class="intel-box-title"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/></svg> Recent Camera Activity</div><div class="intel-box-body">${emptyMsg}</div></div>
    </div>`;

    // Still show forecast for new users
    html += `<div style="font-size:10px;color:var(--bronze);text-transform:uppercase;letter-spacing:2.5px;font-weight:700;margin-bottom:10px">7-Day Forecast</div>`;
    html += `<div class="prop-stat" style="margin-bottom:32px">
      <div id="forecastContent" style="font-size:11px;color:var(--text3);padding:4px 0">Loading forecast...</div>
    </div>`;

    document.getElementById("intelContent").innerHTML = html;
    loadHuntForecast();
    return;
  }

  // --- Section 1: Buck Intelligence (horizontal scroll cards) ---
  html += `<div style="font-size:10px;color:var(--bronze);text-transform:uppercase;letter-spacing:2.5px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:6px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20 L12 14"/><path d="M12 14 L9 10 L7 7 L5 5"/><path d="M9 10 L7 12"/><path d="M7 7 L5 9"/><path d="M12 14 L15 10 L17 7 L19 5"/><path d="M15 10 L17 12"/><path d="M17 7 L19 9"/></svg> Buck Intelligence</div>`;
  html += `<div id="intelBuckCards" style="margin-bottom:32px"></div>`;

  // --- Section 1b: Stand Intelligence (Knowledge Graph — injected async) ---
  html += `<div id="stand-intel-placeholder"></div>`;

  // --- Section 2: 4-Box Analytics Grid ---
  html += `<div style="font-size:10px;color:var(--bronze);text-transform:uppercase;letter-spacing:2.5px;font-weight:700;margin-bottom:10px">Analytics</div>`;
  html += `<div class="intel-4grid" id="intel4Grid" style="margin-bottom:32px">
    <div class="intel-box" id="intelBoxWindRose">
      <div class="intel-box-title"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg> Wind Rose</div>
      <div class="intel-box-body" id="intelWindRoseBody"><!-- Wind rose SVG will render here --></div>
    </div>
    <div class="intel-box" id="intelBoxActivity">
      <div class="intel-box-title"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/></svg> Activity by Time</div>
      <div class="intel-box-body" id="intelActivityBody"><!-- Activity timeline will render here --></div>
    </div>
    <div class="intel-box" id="intelBoxInsights">
      <div class="intel-box-title"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg> Key Insights</div>
      <div class="intel-box-body" id="intelAiInsights"><!-- AI insights will render here --></div>
    </div>
    <div class="intel-box" id="intelBoxRecent">
      <div class="intel-box-title"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8C7355" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/></svg> Recent Camera Activity</div>
      <div class="intel-box-body" id="intelRecentBody"><!-- Recent sightings will render here --></div>
    </div>
  </div>`;


  // --- Conditions graph (last 7 days) ---
  html += `<div class="intel-conditions-wrap" style="margin-bottom:32px">
    <div style="font-size:10px;color:var(--bronze);text-transform:uppercase;letter-spacing:2.5px;font-weight:700;margin-bottom:12px">Conditions &mdash; Last 7 Days</div>
    <div style="position:relative;height:220px">
      <canvas id="intelConditionsCanvas"></canvas>
    </div>
  </div>`;

  // --- Weather & movement correlation (keep exactly as-is) -
  html += `<div class="prop-stat" style="margin-bottom:32px">
    <div class="cond-title" style="margin-bottom:10px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-1px;margin-right:4px"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><line x1="8" y1="16" x2="8" y2="21"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="16" y1="16" x2="16" y2="21"/></svg>Weather Impact on Movement</div>
    ${buildWeatherCorrelation(sightings)}
  </div>`;

  // --- 7-day hunt forecast -
  html += `<div style="font-size:10px;color:var(--bronze);text-transform:uppercase;letter-spacing:2.5px;font-weight:700;margin-bottom:10px">7-Day Forecast</div>`;
  html += `<div class="prop-stat" style="margin-bottom:32px">
    <div id="forecastContent" style="font-size:11px;color:var(--text3);padding:4px 0">Loading forecast...</div>
  </div>`;

  // --- Season Intel (relocated to bottom) ---
  html += `<div class="intel-season-divider"></div>`;
  html += `<div class="card intel"><div class="stitle"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-1px;margin-right:5px"><path d="M3 12h18M3 6h18M3 18h18"/></svg>Season Intel</div>
    <p style="font-size:12px;color:#BCC6CC;line-height:1.7">December marsh buck confirmed alive. Target window: <span style="color:#E5B53B">Nov 8&ndash;18</span> on NW/W wind. Primary: <span style="color:#E5B53B">By Eric + Behind Rons</span>. Kelly Brook approach from west only.</p>
  </div>`;

  document.getElementById("intelContent").innerHTML = html;
  renderBuckCards(ys);
  renderWindRose(ys);
  renderActivityChart(ys);
  renderKeyInsights(ys);
  renderRecentActivity(ys);
  renderConditionsChart();
  setTimeout(loadHuntForecast, 100);

  // Inject Stand Intelligence (Knowledge Graph) async — never blocks Intel tab render.
  // Uses innerHTML (not outerHTML) so the placeholder stays in the DOM — same
  // mobile-safety reasoning as loadBuckGraphIntelligence in openBuckDossier.
  loadStandIntelligence().then(function(standCards) {
    var placeholder = document.getElementById('stand-intel-placeholder');
    if (!placeholder) return;
    placeholder.innerHTML = renderStandIntelligence(standCards) || '';
  });
}


// ============================================================================
// Knowledge Graph Phase 2 — Surface intelligence visually
// Reads knowledge_nodes / knowledge_edges and formats as readable cards.
// No AI calls. Every loader catches its own errors and returns null on failure
// so the UI falls back gracefully to an empty state.
// ============================================================================

async function loadBuckGraphIntelligence(buckName, buckId) {
  try {
    if (!buckName && !buckId) return null;

    // Find the buck's node ID — try entity_id first, fall back to entity_name.
    // Older nodes may have been upserted with sanitized name as entity_id before
    // a buck registry row existed.
    var nodeResult = await sb.from('knowledge_nodes')
      .select('id')
      .eq('property_id', PROPERTY_ID)
      .eq('entity_type', 'buck')
      .or('entity_id.eq.' + (buckId || '__none__') + ',entity_name.eq.' + (buckName || '__none__'))
      .maybeSingle();

    if (!nodeResult.data) return null;
    var nodeId = nodeResult.data.id;

    // Get all outgoing edges from this buck node.
    var edges = await sb.from('knowledge_edges')
      .select(
        'relationship, strength, evidence_count, attributes, ' +
        'to_node:to_node_id(entity_type, entity_name, attributes)'
      )
      .eq('property_id', PROPERTY_ID)
      .eq('from_node_id', nodeId)
      .gte('evidence_count', 2)
      .order('strength', { ascending: false })
      .limit(20);

    if (!edges.data || edges.data.length === 0) return null;

    var timePatterns = [];
    var weatherPatterns = [];
    var cameraPatterns = [];

    edges.data.forEach(function(edge) {
      if (!edge.to_node) return;
      var conf = Math.round(edge.strength * 100);
      var obs = edge.evidence_count;

      if (edge.relationship === 'active_during') {
        timePatterns.push({
          label: (edge.to_node.entity_name || '').replace(/_/g, ' '),
          confidence: conf,
          observations: obs
        });
      } else if (edge.relationship === 'correlates_with') {
        var attrs = edge.attributes || {};
        weatherPatterns.push({
          label: (edge.to_node.entity_name || '').replace(/_/g, ' '),
          confidence: conf,
          observations: obs,
          wind: attrs.wind_dir || null,
          behavior: attrs.behavior || null
        });
      } else if (edge.relationship === 'seen_at') {
        cameraPatterns.push({
          label: edge.to_node.entity_name || '',
          confidence: conf,
          observations: obs,
          timeOfDay: edge.attributes ? edge.attributes.time_of_day : null
        });
      }
    });

    return { timePatterns: timePatterns, weatherPatterns: weatherPatterns, cameraPatterns: cameraPatterns };

  } catch (err) {
    console.warn('[KG] Buck intelligence load failed:', err && err.message ? err.message : err);
    return null;
  }
}

function renderBuckGraphIntelligence(data) {
  if (!data) return '';
  var hasContent = data.timePatterns.length > 0 ||
                   data.weatherPatterns.length > 0 ||
                   data.cameraPatterns.length > 0;
  if (!hasContent) return '';

  var html = '<div class="dossier-section kg-intelligence-section">' +
    '<div class="dossier-section-title">Graph Intelligence</div>' +
    '<div class="kg-cards-wrap">';

  // Time patterns card
  if (data.timePatterns.length > 0) {
    html += '<div class="kg-card">' +
      '<div class="kg-card-label">Peak Activity Windows</div>';
    data.timePatterns.slice(0, 4).forEach(function(p) {
      html += '<div class="kg-card-row">' +
        '<span class="kg-card-name">' + esc(p.label) + '</span>' +
        '<span class="kg-card-meta">' + p.observations + ' obs &middot; ' + p.confidence + '%</span>' +
        '</div>';
    });
    html += '</div>';
  }

  // Weather patterns card
  if (data.weatherPatterns.length > 0) {
    html += '<div class="kg-card">' +
      '<div class="kg-card-label">Condition Triggers</div>';
    data.weatherPatterns.slice(0, 4).forEach(function(p) {
      var detail = '';
      if (p.wind) detail += p.wind + ' wind';
      if (p.behavior) detail += (detail ? ' \u00B7 ' : '') + p.behavior;
      html += '<div class="kg-card-row">' +
        '<span class="kg-card-name">' + esc(p.label) + '</span>' +
        '<span class="kg-card-meta">' + p.observations + ' obs</span>' +
        '</div>';
      if (detail) {
        html += '<div class="kg-card-detail">' + esc(detail) + '</div>';
      }
    });
    html += '</div>';
  }

  // Camera patterns card
  if (data.cameraPatterns.length > 0) {
    html += '<div class="kg-card">' +
      '<div class="kg-card-label">Camera Activity</div>';
    data.cameraPatterns.slice(0, 4).forEach(function(p) {
      html += '<div class="kg-card-row">' +
        '<span class="kg-card-name">' + esc(p.label) + '</span>' +
        '<span class="kg-card-meta">' + p.observations + ' sightings</span>' +
        '</div>';
    });
    html += '</div>';
  }

  html += '</div></div>';
  return html;
}

async function loadStandIntelligence() {
  try {
    // Get all stand nodes for this property
    var stands = await sb.from('knowledge_nodes')
      .select('id, entity_name, lat, lng, attributes')
      .eq('property_id', PROPERTY_ID)
      .eq('entity_type', 'stand');

    if (!stands.data || stands.data.length === 0) return null;

    var standCards = [];

    for (var i = 0; i < stands.data.length; i++) {
      var stand = stands.data[i];

      // Get edges FROM this stand (near relationships to cameras)
      var nearEdges = await sb.from('knowledge_edges')
        .select(
          'relationship, evidence_count, attributes, ' +
          'to_node:to_node_id(entity_type, entity_name)'
        )
        .eq('property_id', PROPERTY_ID)
        .eq('from_node_id', stand.id)
        .eq('relationship', 'near');

      var nearbyCameraNames = [];
      if (nearEdges.data) {
        nearEdges.data.forEach(function(e) {
          if (e.to_node && e.to_node.entity_type === 'camera') {
            nearbyCameraNames.push(e.to_node.entity_name);
          }
        });
      }

      // Find bucks seen at those cameras
      var buckActivity = [];
      if (nearbyCameraNames.length > 0) {
        for (var j = 0; j < nearbyCameraNames.length; j++) {
          var camNode = await sb.from('knowledge_nodes')
            .select('id')
            .eq('property_id', PROPERTY_ID)
            .eq('entity_type', 'camera')
            .eq('entity_name', nearbyCameraNames[j])
            .maybeSingle();

          if (!camNode.data) continue;

          var buckEdges = await sb.from('knowledge_edges')
            .select(
              'strength, evidence_count, attributes, ' +
              'from_node:from_node_id(entity_type, entity_name)'
            )
            .eq('property_id', PROPERTY_ID)
            .eq('to_node_id', camNode.data.id)
            .eq('relationship', 'seen_at')
            .gte('evidence_count', 2)
            .order('strength', { ascending: false })
            .limit(5);

          if (buckEdges.data) {
            buckEdges.data.forEach(function(e) {
              if (e.from_node && e.from_node.entity_type === 'buck') {
                var existing = buckActivity.find(function(b) {
                  return b.name === e.from_node.entity_name;
                });
                if (existing) {
                  existing.observations += e.evidence_count;
                } else {
                  buckActivity.push({
                    name: e.from_node.entity_name,
                    observations: e.evidence_count,
                    wind: e.attributes ? e.attributes.wind_dir : null,
                    timeOfDay: e.attributes ? e.attributes.time_of_day : null
                  });
                }
              }
            });
          }
        }
      }

      // Sort buck activity by observations
      buckActivity.sort(function(a, b) { return b.observations - a.observations; });

      standCards.push({
        name: stand.entity_name,
        nearbyCameras: nearbyCameraNames,
        buckActivity: buckActivity.slice(0, 4)
      });
    }

    return standCards.filter(function(s) { return s.buckActivity.length > 0; });

  } catch (err) {
    console.warn('[KG] Stand intelligence load failed:', err && err.message ? err.message : err);
    return null;
  }
}

function renderStandIntelligence(standCards) {
  if (!standCards || standCards.length === 0) return '';

  var html = '<div class="stand-intel-section">' +
    '<div class="stand-intel-title">Stand Intelligence</div>' +
    '<div class="stand-cards-wrap">';

  standCards.forEach(function(stand) {
    html += '<div class="stand-card">' +
      '<div class="stand-card-header">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' +
          '<polyline points="9 22 9 12 15 12 15 22"/>' +
        '</svg>' +
        '<span class="stand-card-name">' + esc(stand.name) + '</span>' +
      '</div>';

    if (stand.nearbyCameras.length > 0) {
      html += '<div class="stand-card-cameras">Covers: ' +
        stand.nearbyCameras.slice(0, 3).map(esc).join(', ') + '</div>';
    }

    if (stand.buckActivity.length > 0) {
      html += '<div class="stand-card-bucks-label">Buck Activity Nearby</div>';
      stand.buckActivity.forEach(function(buck) {
        var detail = '';
        if (buck.wind) detail += buck.wind + ' wind';
        if (buck.timeOfDay) detail += (detail ? ' \u00B7 ' : '') + buck.timeOfDay;
        html += '<div class="kg-card-row">' +
          '<span class="kg-card-name">' + esc(buck.name) + '</span>' +
          '<span class="kg-card-meta">' + buck.observations + ' obs' +
            (detail ? ' \u00B7 ' + esc(detail) : '') +
          '</span>' +
          '</div>';
      });
    } else {
      html += '<div class="stand-card-empty">No buck activity recorded nearby yet</div>';
    }

    html += '</div>';
  });

  html += '</div></div>';
  return html;
}



