// Huginn — utils.js
// Pure utility functions extracted from index.html
// Plain function declarations for global scope across script tags

function showToast(msg, duration) {
  if (duration === undefined) duration = 2500;
  var t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:calc(var(--tab-h) + env(safe-area-inset-bottom,0px) + 16px);left:50%;transform:translateX(-50%);background:rgba(30,32,34,0.95);border:1px solid var(--border2);color:var(--text);padding:9px 18px;border-radius:20px;font-size:12px;z-index:700;pointer-events:none;font-family:var(--font);white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,0.5)';
  document.body.appendChild(t);
  setTimeout(function() { t.remove(); }, duration);
}

function fmtT(t) {
  if(!t) return "";
  var parts = t.slice(0,5).split(":");
  var hr = parseInt(parts[0]);
  return (hr>12?hr-12:(hr||12)) + ":" + parts[1] + " " + (hr>=12?"PM":"AM");
}

function fmtD(d) {
  if(!d) return "";
  return new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
}

function moonPhase(date) {
  var p = (((new Date(date) - new Date("2000-01-06")) / 86400000) % 29.53 + 29.53) % 29.53;
  if(p<1.85) return {i:"New Moon",l:"New Moon"};
  if(p<7.38) return {i:"Waxing Crescent",l:"Waxing Crescent"};
  if(p<9.22) return {i:"First Quarter",l:"First Quarter"};
  if(p<14.76) return {i:"Waxing Gibbous",l:"Waxing Gibbous"};
  if(p<16.61) return {i:"Full Moon",l:"Full Moon"};
  if(p<22.15) return {i:"Waning Gibbous",l:"Waning Gibbous"};
  if(p<23.99) return {i:"Last Quarter",l:"Last Quarter"};
  return {i:"Waning Crescent",l:"Waning Crescent"};
}

function deg2dir(d) {
  return DIR_LABELS[Math.round(d/22.5)%16];
}

function simpleDir(windDir) {
  if(!windDir) return "";
  var simple = ["NW","NE","SE","SW","N","S","E","W"];
  return simple.find(function(d) { return windDir.startsWith(d); }) || "";
}

// Client-side image compression via Canvas API
// Resizes to max 1200px on longest edge, JPEG quality 0.82, targets ~300KB
function compressImage(file) {
  return new Promise(function(resolve) {
    if (!file || !file.type.startsWith('image/')) { resolve(file); return; }
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function() {
      URL.revokeObjectURL(url);
      var MAX = 1200;
      var w = img.width, h = img.height;
      if (w <= MAX && h <= MAX && file.size <= 300000) { resolve(file); return; }
      if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
      else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      c.toBlob(function(blob) {
        if (!blob) { resolve(file); return; }
        var compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
        resolve(compressed);
      }, 'image/jpeg', 0.82);
    };
    img.onerror = function() { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// Anthropic API proxy — all AI calls route through /api/claude.js serverless function
async function claudeFetch(body) {
  var res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (res.status === 429) {
    showToast("You\u2019ve reached the AI request limit. Try again in an hour.", 5000);
    throw new Error('RATE_LIMITED');
  }
  return res;
}
