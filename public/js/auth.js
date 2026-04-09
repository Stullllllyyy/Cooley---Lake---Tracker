// Huginn — auth.js
// Auth gate, login, invite, session management, onboarding
// Depends on: config.js (SUPABASE_URL, SUPABASE_KEY, PROPERTY_ID, CLAT, CLNG, PROPERTY_CENTER)
//             utils.js (showToast)
//             Supabase CDN (supabase global)

// --- Supabase client (must be created here so auth listener works at load time) ---
var sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
// AI features use /api/claude serverless proxy — key stored in Vercel env vars

// --- Auth gate ---
var appBooted = false;

function showAuthView(view) {
  document.getElementById('authSignIn').style.display = view === 'signin' ? 'block' : 'none';
  document.getElementById('authSignUp').style.display = view === 'signup' ? 'block' : 'none';
  document.getElementById('authSignInError').textContent = '';
  document.getElementById('authSignUpError').textContent = '';
  document.getElementById('authMagicSuccess').innerHTML = '';
}

async function handleSignIn() {
  var email = document.getElementById('authEmail').value.trim();
  var pass = document.getElementById('authPass').value;
  var errEl = document.getElementById('authSignInError');
  var btn = document.getElementById('authSignInBtn');
  errEl.textContent = '';
  if(!email || !pass) { errEl.textContent = 'Enter email and password.'; return; }
  btn.disabled = true; btn.textContent = 'Signing in...';
  var result = await sb.auth.signInWithPassword({ email: email, password: pass });
  btn.disabled = false; btn.textContent = 'Sign In';
  if(result.error) errEl.textContent = result.error.message;
}

async function handleSignUp() {
  var code = document.getElementById('authInviteCode').value.trim().toUpperCase();
  var email = document.getElementById('authSignUpEmail').value.trim();
  var pass = document.getElementById('authSignUpPass').value;
  var errEl = document.getElementById('authSignUpError');
  var btn = document.getElementById('authSignUpBtn');
  errEl.textContent = '';
  if(!code) { errEl.textContent = 'Enter your invite code.'; return; }
  if(!email || !pass) { errEl.textContent = 'Enter email and password.'; return; }
  if(pass.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; return; }

  // Validate invite code against invites table
  btn.disabled = true; btn.textContent = 'Validating invite...';
  var invResult = await sb.from('invites')
    .select('*')
    .eq('code', code)
    .is('claimed_by', null)
    .is('claimed_at', null)
    .single();
  var invite = invResult.data;
  if(invResult.error || !invite) {
    btn.disabled = false; btn.textContent = 'Create Account';
    errEl.textContent = 'Invalid or already used invite code.';
    return;
  }

  // Pre-claim invite while still anon (RLS allows anon UPDATE)
  // Use email as a temporary claim marker so the code can't be reused during signup
  var preClaimResult = await sb.from('invites').update({
    claimed_at: new Date().toISOString()
  }).eq('id', invite.id);
  if(preClaimResult.error) {
    btn.disabled = false; btn.textContent = 'Create Account';
    errEl.textContent = 'Failed to reserve invite. Try again.';
    return;
  }

  // Create account
  btn.textContent = 'Creating account...';
  var signUpResult = await sb.auth.signUp({ email: email, password: pass });
  if(signUpResult.error) {
    // Roll back pre-claim
    await sb.from('invites').update({ claimed_at: null }).eq('id', invite.id);
    btn.disabled = false; btn.textContent = 'Create Account';
    errEl.textContent = signUpResult.error.message;
    return;
  }

  // Finalize claim with user ID and add to property_members
  var newUserId = signUpResult.data.user ? signUpResult.data.user.id : null;
  if(newUserId) {
    // claimed_by update may fail if auth role switched — that's OK, claimed_at is already set
    await sb.from('invites').update({ claimed_by: newUserId }).eq('id', invite.id);

    // Only create property_members if invite has a property_id
    // New-property invites (property_id null) skip this — user will go through onboarding
    if(invite.property_id) {
      await sb.from('property_members').insert({
        property_id: invite.property_id,
        user_id: newUserId,
        role: invite.role,
        invited_at: invite.created_at,
        accepted_at: new Date().toISOString()
      });
    }
  }

  btn.disabled = false; btn.textContent = 'Create Account';
  errEl.textContent = '';
  showAuthView('signin');
  document.getElementById('authSignInError').innerHTML = '<span style="color:var(--bronze)">Check your email to confirm your account, then sign in.</span>';
}

async function handleMagicLink() {
  var email = document.getElementById('authEmail').value.trim();
  var errEl = document.getElementById('authSignInError');
  var successEl = document.getElementById('authMagicSuccess');
  var btn = document.getElementById('authMagicBtn');
  errEl.textContent = ''; successEl.innerHTML = '';
  if(!email) { errEl.textContent = 'Enter your email address first.'; return; }
  btn.disabled = true; btn.textContent = 'Sending...';
  var result = await sb.auth.signInWithOtp({ email: email });
  btn.disabled = false; btn.textContent = 'Email me a login link';
  if(result.error) { errEl.textContent = result.error.message; return; }
  successEl.innerHTML = '<div class="auth-success">Login link sent — check your email.</div>';
}

async function handleLogout() {
  await sb.auth.signOut();
}

// --- Boot app after auth ---
async function bootApp() {
  if(appBooted) return;
  appBooted = true;

  // Check property membership for this user
  var userResult = await sb.auth.getUser();
  var user = userResult.data.user;
  if(!user) { showAuthGate(); return; }

  var memResult = await sb.from('property_members')
    .select('property_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  var membership = memResult.data;

  if(!membership || !membership.property_id) {
    // New user with no property — init map (no data) then show onboarding
    onboardingMode = true;
    document.getElementById('authGate').style.display = 'none';
    startMap();
    showOnboarding(user.id);
    return;
  }

  // Set PROPERTY_ID from membership
  PROPERTY_ID = membership.property_id;

  document.getElementById('authGate').style.display = 'none';
  await Promise.all([loadBuckRegistry(), loadSightings()]);
  startMap();
}

function showAuthGate() {
  appBooted = false;
  document.getElementById('authGate').style.display = 'flex';
  document.getElementById('onboardOverlay').classList.remove('on');
  showAuthView('signin');
  // Clear sensitive form fields
  document.getElementById('authEmail').value = '';
  document.getElementById('authPass').value = '';
  document.getElementById('authSignUpEmail').value = '';
  document.getElementById('authSignUpPass').value = '';
  document.getElementById('authInviteCode').value = '';
}

// --- Onboarding: New User Property Setup ---
var onboardUserId = null;
var onboardPinMarker = null;
var onboardingMode = false;

function showOnboarding(userId) {
  onboardUserId = userId;
  document.getElementById('onboardOverlay').classList.add('on');
  document.getElementById('onboardError').textContent = '';
  document.getElementById('onboardCoords').textContent = '';
  document.getElementById('onboardLat').value = '';
  document.getElementById('onboardLng').value = '';
}

function onboardDetectGPS() {
  var btn = document.getElementById('onboardDetectBtn');
  if(!navigator.geolocation) { showToast('GPS not available on this device'); return; }
  btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-2px"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg> Detecting...';
  btn.disabled = true;
  navigator.geolocation.getCurrentPosition(
    function(pos) {
      var lat = pos.coords.latitude.toFixed(6);
      var lng = pos.coords.longitude.toFixed(6);
      document.getElementById('onboardLat').value = lat;
      document.getElementById('onboardLng').value = lng;
      document.getElementById('onboardCoords').textContent = lat + ', ' + lng;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-2px"><polyline points="20 6 9 17 4 12"/></svg> Location set';
      btn.disabled = false;
    },
    function() {
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-2px"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg> Use My Location';
      btn.disabled = false;
      showToast('GPS unavailable — try Drop a Pin instead');
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

function onboardDropPin() {
  if(!mapInstance) { showToast('Map not ready — try again in a moment'); return; }
  onboardingMode = true;

  // Hide onboarding overlay
  document.getElementById('onboardOverlay').style.display = 'none';

  // Wait for next animation frame + 100ms so container has real dimensions before resize
  requestAnimationFrame(function() {
    setTimeout(function() {
      mapInstance.resize();
      placeOnboardPin();
    }, 100);
  });
}

function placeOnboardPin() {
  // Remove existing pin if any
  if(onboardPinMarker) { onboardPinMarker.remove(); onboardPinMarker = null; }

  var center = mapInstance.getCenter();

  // Pulsating sulfur teardrop — exact same architecture as tap-to-place
  var el = document.createElement('div');
  el.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:grab';
  el.innerHTML =
    '<div style="width:36px;height:44px;position:relative;display:flex;align-items:center;justify-content:center;animation:ttpGlow 1.4s ease-in-out infinite">' +
    '<svg style="position:absolute;top:0;left:0;width:100%;height:100%;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.8))" viewBox="0 0 36 44" fill="none">' +
    '<path d="M18 2C10.268 2 4 8.268 4 16c0 10 14 28 14 28s14-18 14-28C32 8.268 25.732 2 18 2z" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="3"/>' +
    '<path d="M18 2C10.268 2 4 8.268 4 16c0 10 14 28 14 28s14-18 14-28C32 8.268 25.732 2 18 2z" fill="#E5B53B" stroke="#f0c75a" stroke-width="1.5"/>' +
    '</svg>' +
    '<div style="position:relative;z-index:1;padding-bottom:10px">' +
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
    '</div></div>';

  onboardPinMarker = new mapboxgl.Marker({ element: el, draggable: true, anchor: 'bottom' })
    .setLngLat(center)
    .addTo(mapInstance);

  // Show confirm card with updated copy
  showOnboardPinConfirm(center.lat, center.lng);

  onboardPinMarker.on('drag', function() {
    var ll = onboardPinMarker.getLngLat();
    updateOnboardPinCoords(ll.lat, ll.lng);
  });
  onboardPinMarker.on('dragend', function() {
    var ll = onboardPinMarker.getLngLat();
    updateOnboardPinCoords(ll.lat, ll.lng);
  });
}

function showOnboardPinConfirm(lat, lng) {
  var card = document.getElementById('onboardPinCard');
  if(!card) {
    card = document.createElement('div');
    card.id = 'onboardPinCard';
    card.style.cssText = 'position:fixed;bottom:calc(var(--tab-h) + env(safe-area-inset-bottom,0px) + 16px);left:50%;transform:translateX(-50%);z-index:500;background:var(--surface);border:1px solid var(--border2);border-radius:16px;padding:18px 20px;box-shadow:0 8px 40px rgba(0,0,0,0.8);text-align:center;width:min(340px,calc(100vw - 32px))';
    document.body.appendChild(card);
  }
  card.innerHTML =
    '<div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:6px">Drop Your Property Pin</div>' +
    '<div style="font-size:11px;color:var(--text2);line-height:1.6;margin-bottom:10px">Place this pin at the heart of your hunting area \u2014 the center of your property, your main stand, or wherever you spend the most time. This anchors your map and helps Huginn build your first intel.</div>' +
    '<div style="font-size:10px;color:var(--text3);line-height:1.5;margin-bottom:10px">As you log sightings and add cameras and stands, your data will get more precise automatically.</div>' +
    '<div id="onboardPinCoords" style="font-size:11px;color:var(--gold);font-family:monospace;margin-bottom:12px">' + lat.toFixed(6) + ', ' + lng.toFixed(6) + '</div>' +
    '<div style="display:flex;gap:10px">' +
    '<button onclick="cancelOnboardPin()" style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--border2);background:var(--surface2);color:var(--text2);font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font)">Cancel</button>' +
    '<button onclick="confirmOnboardPin()" style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--gold);background:var(--gold);color:var(--bg);font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font)">Confirm</button>' +
    '</div>';
}

function updateOnboardPinCoords(lat, lng) {
  var el = document.getElementById('onboardPinCoords');
  if(el) el.textContent = lat.toFixed(6) + ', ' + lng.toFixed(6);
}

function confirmOnboardPin() {
  var ll = onboardPinMarker.getLngLat();
  document.getElementById('onboardLat').value = ll.lat.toFixed(6);
  document.getElementById('onboardLng').value = ll.lng.toFixed(6);
  document.getElementById('onboardCoords').textContent = ll.lat.toFixed(6) + ', ' + ll.lng.toFixed(6);

  // Clean up pin and card, show onboarding overlay again
  if(onboardPinMarker) { onboardPinMarker.remove(); onboardPinMarker = null; }
  var card = document.getElementById('onboardPinCard');
  if(card) card.remove();

  document.getElementById('onboardOverlay').style.display = '';

  // Update pin button text
  document.getElementById('onboardPinBtn').innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-2px"><polyline points="20 6 9 17 4 12"/></svg> Pin placed';
}

function cancelOnboardPin() {
  if(onboardPinMarker) { onboardPinMarker.remove(); onboardPinMarker = null; }
  var card = document.getElementById('onboardPinCard');
  if(card) card.remove();
  onboardingMode = false;

  document.getElementById('onboardOverlay').style.display = '';
}

async function onboardCreateProperty() {
  var name = document.getElementById('onboardPropName').value.trim();
  var lat = parseFloat(document.getElementById('onboardLat').value);
  var lng = parseFloat(document.getElementById('onboardLng').value);
  var errEl = document.getElementById('onboardError');
  var btn = document.getElementById('onboardCreateBtn');

  if(!name) { errEl.textContent = 'Enter a property name.'; return; }
  if(isNaN(lat) || isNaN(lng)) { errEl.textContent = 'Set your property center using GPS or Drop a Pin.'; return; }
  if(!onboardUserId) { errEl.textContent = 'Session error. Please sign out and try again.'; return; }

  btn.disabled = true; btn.textContent = 'Creating...';
  errEl.textContent = '';

  try {
    // Create property record
    var propResult = await sb.from('properties').insert({
      name: name,
      owner_id: onboardUserId,
      center_lat: lat,
      center_lng: lng
    }).select().single();

    if(propResult.error) throw propResult.error;
    var prop = propResult.data;

    // Add user as owner in property_members
    var memResult = await sb.from('property_members').insert({
      property_id: prop.id,
      user_id: onboardUserId,
      role: 'owner',
      accepted_at: new Date().toISOString()
    });

    if(memResult.error) throw memResult.error;

    // Set globals and boot the app
    PROPERTY_ID = prop.id;
    CLAT = lat;
    CLNG = lng;
    PROPERTY_CENTER[0] = lng;
    PROPERTY_CENTER[1] = lat;
    onboardingMode = false;
    document.getElementById('onboardOverlay').classList.remove('on');
    document.getElementById('authGate').style.display = 'none';
    loadBuckRegistry();
    loadSightings();
    updateMapWeather();
    // Map already exists from Drop a Pin — set up data layers and fly to property
    if(mapInstance) {
      mapInstance.flyTo({ center: [lng, lat], zoom: 15, duration: 1500 });
      loadCamLocations();
      loadPropertyMarkers();
      addLineLayer();
      lineLayerAdded = true;
      initGeolocate();
    } else {
      startMap();
    }
    showToast('Welcome to Huginn! Your property is ready.');

  } catch(e) {
    console.error('Onboarding error:', e);
    errEl.textContent = 'Failed to create property: ' + (e.message || 'Unknown error');
    btn.disabled = false; btn.textContent = 'Create Property';
  }
}

// --- Auth state listener ---
sb.auth.onAuthStateChange(function(event, session) {
  if(session && session.user) { bootApp(); }
  else { showAuthGate(); }
});

// --- Initial session check ---
sb.auth.getSession().then(function(result) {
  var session = result.data.session;
  if(session && session.user) bootApp();
  // If no session, authGate is already visible (default display:flex)
});
