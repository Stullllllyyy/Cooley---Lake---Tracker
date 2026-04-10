// Huginn — hunt-ai.js
// Hunt AI chat, conversations, Property Intel cards/wizard, system prompt assembly
// Depends on: config.js (PROPERTY_ID, CLAT, CLNG), utils.js (showToast)
// References from inline: sb, sightings, camLocations, propertyMarkers, getNamedBucks, buckRegistry, claudeFetch, closeFabDial

// --- AI Chat ---
var chatConversationId = null;
var chatHistory = []; // {role, content} for current conversation
var chatStreaming = false;
var chatVvListener = null;

function openAiChat() {
  closeFabDial();
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('on'));
  document.getElementById('tab-chat')?.classList.add('on');
  ['intel','sightings','detail'].forEach(s => {
    document.getElementById('sheet-'+s)?.classList.remove('open');
    document.getElementById('overlay-'+s)?.classList.remove('on');
  });
  document.getElementById('sheet-chat')?.classList.add('open');
  document.getElementById('overlay-chat')?.classList.add('on');

  // iOS keyboard handling via visualViewport
  if (window.visualViewport && !chatVvListener) {
    chatVvListener = () => {
      const bar = document.getElementById('chatInputBar');
      if (!bar) return;
      const offset = window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop;
      bar.style.transform = offset > 0 ? `translateY(-${offset}px)` : '';
      if (offset > 0) scrollChatToBottom();
    };
    window.visualViewport.addEventListener('resize', chatVvListener);
    window.visualViewport.addEventListener('scroll', chatVvListener);
  }

  // Enable send button based on input
  const inp = document.getElementById('chatInput');
  if (inp && !inp._chatListenerAdded) {
    inp.addEventListener('input', () => {
      document.getElementById('chatSendBtn').disabled = !inp.value.trim();
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (inp.value.trim()) sendChatMessage();
      }
    });
    inp._chatListenerAdded = true;
  }

  // Load conversations list and property context
  if (!chatConversationId) loadChatConversations();
  if (!propertyContextCache) loadPropertyContext();
}

function closeAiChat() {
  document.getElementById('sheet-chat')?.classList.remove('open');
  document.getElementById('overlay-chat')?.classList.remove('on');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('on'));
  document.getElementById('tab-map')?.classList.add('on');
  // Close drawer if open
  document.getElementById('chatDrawer')?.classList.remove('open');
  document.getElementById('chatDrawerOverlay')?.classList.remove('on');
}

function autoGrowChatInput(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
}

function scrollChatToBottom() {
  const mc = document.getElementById('chatMessages');
  if (mc) mc.scrollTop = mc.scrollHeight;
}

// --- Build system prompt with property data ---
async function buildChatSystemPrompt() {
  const namedBucks = getNamedBucks();
  const camList = Object.entries(camLocations).map(([name, loc]) =>
    `${name}: lat ${loc.lat?.toFixed(4)}, lng ${loc.lng?.toFixed(4)}`
  ).join('\n');

  // Property markers summary
  const markerSummary = propertyMarkers.map(m =>
    `${m.type}: ${m.name || 'Unnamed'} (${m.lat?.toFixed(4)}, ${m.lng?.toFixed(4)})${m.notes ? ' - ' + m.notes : ''}`
  ).join('\n');

  // Per-buck summary (compressed)
  const buckSummaries = namedBucks.map(name => {
    const bs = sightings.filter(s => s.buck_name === name);
    if (!bs.length) return null;
    const cameras = [...new Set(bs.map(s => s.camera_name))];
    const behaviors = [...new Set(bs.filter(s=>s.behavior).map(s => s.behavior))];
    const dates = bs.map(s => s.date).sort();
    return `${name}: ${bs.length} sightings, cameras [${cameras.join(', ')}], behaviors [${behaviors.join(', ')}], date range ${dates[0]} to ${dates[dates.length-1]}`;
  }).filter(Boolean).join('\n');

  // Recent sightings (last 150, slimmed)
  const recentSlim = sightings.slice(0, 150).map(s => {
    const parts = [s.date, s.time || '', s.camera_name || '', s.deer_type || ''];
    if (s.buck_name) parts.push(s.buck_name);
    if (s.behavior) parts.push(s.behavior);
    if (s.wind_dir) parts.push('wind:' + s.wind_dir);
    if (s.temp_f) parts.push(s.temp_f + 'F');
    if (s.moon_phase) parts.push('moon:' + s.moon_phase);
    if (s.travel_dir) parts.push('travel:' + s.travel_dir);
    return parts.join(' | ');
  }).join('\n');

  // Property context from guided wizard — send only 2-3 most recent entries per category
  let contextSection = '';
  if (propertyContextCache) {
    const labels = { terrain: 'Terrain', food_sources: 'Food Sources', bedding_areas: 'Bedding Areas', water_sources: 'Water Sources', access_routes: 'Access Routes', hunting_pressure: 'Hunting Pressure', additional_notes: 'Additional Notes' };
    const parts = Object.entries(propertyContextCache)
      .filter(([_, v]) => v)
      .map(([k, v]) => {
        const entries = parseIntelEntries(v).slice(-3);
        if (!entries.length) return null;
        const lines = entries.map(e => (e.date ? `[${e.date}] ` : '') + e.text).join(' | ');
        return `${labels[k] || k}: ${lines}`;
      })
      .filter(Boolean);
    if (parts.length) contextSection = '\n\nPROPERTY CONTEXT (from the hunter):\n' + parts.join('\n');
  }

  // Pull knowledge graph context — structured behavioral intelligence distinct
  // from raw sightings. Fails silently (returns null) if the graph is empty or
  // the tables are unavailable.
  const kgContext = await kgGetPropertyContext();
  const kgSection = kgContext
    ? '\n\nPROPERTY INTELLIGENCE GRAPH (observed behavioral patterns — confidence derived from repeated observations):\n' + kgContext
    : '';

  return `You are Huginn, an expert whitetail deer hunting advisor for a property called Cooley Lake in Suring, Wisconsin (center: ${CLAT}, ${CLNG}).
Your job: analyze the hunter's trail camera data, property features, and weather to give specific, actionable hunting advice. Be concise and direct. Use the data — don't guess.

PROPERTY CAMERAS:
${camList || 'No cameras configured.'}

PROPERTY FEATURES (stands, scrapes, rubs, bedding):
${markerSummary || 'No features marked yet.'}

NAMED BUCKS (${namedBucks.length} total):
${buckSummaries || 'No named bucks yet.'}${kgSection}

RECENT SIGHTINGS (${Math.min(sightings.length, 150)} of ${sightings.length} total):
date | time | camera | type | buck | behavior | wind | temp | moon | travel
${recentSlim || 'No sightings logged yet.'}

TODAY: ${new Date().toLocaleDateString('en-US', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}
TOTAL SIGHTINGS: ${sightings.length}${contextSection}

Guidelines:
- Reference specific cameras, bucks, and dates from the data
- When recommending stands, cite which bucks/deer have been seen nearby and wind direction considerations
- For pattern analysis, look at time-of-day clusters, camera frequency, and behavioral trends
- Keep responses focused and practical — this is a hunter in the field
- If asked about a buck with no data, say so honestly
- Format responses with clear sections when appropriate`;
}

// --- Send message ---
async function sendChatMessage() {
  const inp = document.getElementById('chatInput');
  const text = inp.value.trim();
  if (!text || chatStreaming) return;

  // Hide welcome, show message
  const welcome = document.getElementById('chatWelcome');
  if (welcome) welcome.style.display = 'none';

  // Create conversation if needed
  if (!chatConversationId) {
    chatConversationId = crypto.randomUUID();
  }

  // Add user bubble
  appendChatBubble('user', text);
  chatHistory.push({ role: 'user', content: text });

  // Persist user message
  persistChatMessage('user', text);

  // Clear input
  inp.value = '';
  inp.style.height = 'auto';
  document.getElementById('chatSendBtn').disabled = true;
  scrollChatToBottom();

  // Show typing indicator
  const typing = document.createElement('div');
  typing.className = 'chat-typing';
  typing.id = 'chatTyping';
  typing.innerHTML = '<span></span><span></span><span></span>';
  document.getElementById('chatMessages').appendChild(typing);
  scrollChatToBottom();

  chatStreaming = true;

  try {
    // Build messages array (last 20 messages for context)
    const msgs = chatHistory.slice(-20).map(m => ({
      role: m.role, content: m.content
    }));

    const res = await claudeFetch({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: await buildChatSystemPrompt(),
        messages: msgs
    });

    const data = await res.json();
    typing.remove();

    if (!res.ok || data.type === 'error') {
      const errMsg = (data.error && data.error.message) ? data.error.message : 'Something went wrong. Try again.';
      console.error('[HuntAI] API error:', errMsg);
      appendChatBubble('ai', errMsg);
      chatStreaming = false;
      return;
    }

    const aiText = data.content?.[0]?.text || 'No response received.';
    appendChatBubble('ai', aiText);
    chatHistory.push({ role: 'assistant', content: aiText });
    persistChatMessage('assistant', aiText);
    scrollChatToBottom();
  } catch (err) {
    typing.remove();
    appendChatBubble('ai', 'Network error. Check your connection and try again.');
    console.error('Chat error:', err);
  }

  chatStreaming = false;
}

function sendChatSuggestion(btn) {
  const inp = document.getElementById('chatInput');
  inp.value = btn.textContent;
  document.getElementById('chatSendBtn').disabled = false;
  sendChatMessage();
}

function appendChatBubble(role, text) {
  const mc = document.getElementById('chatMessages');
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role === 'user' ? 'user' : 'ai'}`;
  if (role !== 'user') {
    const label = document.createElement('div');
    label.className = 'ai-label';
    label.textContent = 'Huginn';
    bubble.appendChild(label);
    // Parse basic markdown: **bold**, bullet lists
    const content = document.createElement('div');
    content.innerHTML = formatAiText(text);
    bubble.appendChild(content);
  } else {
    bubble.textContent = text;
  }
  mc.appendChild(bubble);
}

function formatAiText(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

// --- Persistence ---
async function persistChatMessage(role, content) {
  try {
    await sb.from('chat_messages').insert({
      conversation_id: chatConversationId,
      role: role,
      content: content,
      created_at: new Date().toISOString(),
      property_id: PROPERTY_ID
    });
  } catch (e) {
    console.warn('Failed to persist chat message:', e);
  }
}

// --- Conversations ---
async function loadChatConversations() {
  try {
    const { data, error } = await sb.from('chat_messages')
      .select('conversation_id, content, created_at, role')
      .eq('property_id', PROPERTY_ID)
      .order('created_at', { ascending: true });
    if (error || !data || !data.length) return;

    // Group by conversation_id, take first USER message as preview
    const convos = {};
    data.forEach(msg => {
      if (!convos[msg.conversation_id]) {
        convos[msg.conversation_id] = { id: msg.conversation_id, preview: null, date: msg.created_at };
      }
      if (msg.role === 'user' && !convos[msg.conversation_id].preview) {
        convos[msg.conversation_id].preview = msg.content;
        convos[msg.conversation_id].date = msg.created_at;
      }
    });

    const sorted = Object.values(convos).sort((a, b) => b.date.localeCompare(a.date));
    renderChatDrawer(sorted);
  } catch (e) {
    console.warn('Failed to load conversations:', e);
  }
}

function renderChatDrawer(convos) {
  const list = document.getElementById('chatDrawerList');
  if (!convos.length) {
    list.innerHTML = '<div class="chat-drawer-empty">No conversations yet.<br/>Start chatting to create one.</div>';
    return;
  }
  list.innerHTML = convos.map(c => {
    const preview = (c.preview || 'New conversation').slice(0, 60) + (c.preview && c.preview.length > 60 ? '...' : '');
    const d = new Date(c.date);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const active = c.id === chatConversationId ? ' active' : '';
    return `<div class="chat-drawer-item${active}" onclick="loadConversation('${c.id}')">
      <div class="chat-drawer-item-title">${preview.replace(/</g,'&lt;')}</div>
      <div class="chat-drawer-item-date">${dateStr}</div>
    </div>`;
  }).join('');
}

async function loadConversation(convId) {
  chatConversationId = convId;
  chatHistory = [];

  const mc = document.getElementById('chatMessages');
  mc.innerHTML = '';
  const welcome = document.getElementById('chatWelcome');

  try {
    const { data, error } = await sb.from('chat_messages')
      .select('role, content, created_at')
      .eq('property_id', PROPERTY_ID)
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (error || !data || !data.length) {
      // Empty conversation
      if (!welcome) {
        // Re-create welcome
      }
      return;
    }

    data.forEach(msg => {
      appendChatBubble(msg.role === 'assistant' ? 'ai' : 'user', msg.content);
      chatHistory.push({ role: msg.role, content: msg.content });
    });

    scrollChatToBottom();
  } catch (e) {
    console.warn('Failed to load conversation:', e);
  }

  toggleChatDrawer(); // close drawer
  loadChatConversations(); // refresh active state
}

function startNewConversation() {
  chatConversationId = null;
  chatHistory = [];
  // Switch to assistant tab if on intel
  switchChatTab('assistant');
  const mc = document.getElementById('chatMessages');
  mc.innerHTML = `<div class="chat-welcome" id="chatWelcome">
    <div class="chat-welcome-icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.6" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    </div>
    <h3>Hunt Planner AI</h3>
    <p>I know your property, your bucks, your cameras, and the forecast. Ask me anything about your next hunt.</p>
    <div class="chat-suggestions" id="chatSuggestions">
      <button class="chat-suggest-btn" onclick="sendChatSuggestion(this)">Where should I sit tomorrow morning?</button>
      <button class="chat-suggest-btn" onclick="sendChatSuggestion(this)">What patterns has Marsh Buck shown this season?</button>
      <button class="chat-suggest-btn" onclick="sendChatSuggestion(this)">Which cameras have the most mature buck activity?</button>
    </div>
    <button class="chat-setup-btn" onclick="switchChatTab('intel')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      Teach Huginn about your property
    </button>
  </div>`;
}

function toggleChatDrawer() {
  const drawer = document.getElementById('chatDrawer');
  const overlay = document.getElementById('chatDrawerOverlay');
  const isOpen = drawer.classList.contains('open');
  if (isOpen) {
    drawer.classList.remove('open');
    overlay.classList.remove('on');
  } else {
    loadChatConversations();
    drawer.classList.add('open');
    overlay.classList.add('on');
  }
}

// --- Chat Tab Toggle ---
function switchChatTab(tab) {
  const assistantView = document.getElementById('chatAssistantView');
  const intelView = document.getElementById('chatIntelView');
  const tabA = document.getElementById('chatTabAssistant');
  const tabI = document.getElementById('chatTabIntel');

  if (tab === 'intel') {
    assistantView.style.display = 'none';
    intelView.style.display = 'flex';
    tabA.classList.remove('active');
    tabI.classList.add('active');
    renderIntelCards();
  } else {
    assistantView.style.display = 'flex';
    intelView.style.display = 'none';
    tabA.classList.add('active');
    tabI.classList.remove('active');
  }
}

// --- Intel Cards ---
var INTEL_CARD_LABELS = {
  terrain: 'Terrain & Layout',
  food_sources: 'Food Sources',
  bedding_areas: 'Bedding Areas',
  water_sources: 'Water Sources',
  access_routes: 'Access Routes',
  hunting_pressure: 'Hunting Pressure',
  additional_notes: 'Additional Notes'
};
var INTEL_CARD_ICONS = {
  terrain: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3l4 8 5-5 2 4"/><path d="M2 21h20"/><path d="M4 21l4-12 5 7 3-4 4 9"/></svg>',
  food_sources: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 11 7 11s7-6 7-11a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  bedding_areas: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v11"/><path d="M3 18h18"/><path d="M3 11h18a2 2 0 0 1 2 2v5"/><path d="M7 11V7a4 4 0 0 1 8 0v4"/></svg>',
  water_sources: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>',
  access_routes: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
  hunting_pressure: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  additional_notes: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>'
};
var INTEL_CARD_COLORS = {
  terrain: 'rgba(140,115,85,0.15)',
  food_sources: 'rgba(76,140,60,0.15)',
  bedding_areas: 'rgba(100,80,150,0.15)',
  water_sources: 'rgba(60,120,180,0.15)',
  access_routes: 'rgba(180,140,60,0.15)',
  hunting_pressure: 'rgba(180,70,70,0.15)',
  additional_notes: 'rgba(140,140,140,0.15)'
};

var intelEditCategory = null;

async function renderIntelCards() {
  // Always reload fresh data
  await loadPropertyContext();

  const container = document.getElementById('intelCardsView');
  const filled = propertyContextCache ? Object.keys(propertyContextCache).filter(k => propertyContextCache[k]) : [];

  container.innerHTML = `
    <div class="intel-cards-header">
      <h4>Property Knowledge</h4>
      <span>${filled.length} of ${INTEL_STEPS.length} filled</span>
    </div>
    <div style="font-size:12px;color:var(--text2);line-height:1.5;margin-bottom:4px">Tap a card to add or edit. The more Huginn knows, the better its recommendations.</div>
    ${INTEL_STEPS.map(step => {
      const content = propertyContextCache?.[step.key] || '';
      const icon = INTEL_CARD_ICONS[step.key] || '&#128221;';
      const bgColor = INTEL_CARD_COLORS[step.key] || 'rgba(140,140,140,0.15)';
      return `<div class="intel-card" onclick="openIntelEdit('${step.key}')">
        <div class="intel-card-hdr">
          <div class="intel-card-title">
            <div class="intel-card-icon" style="background:${bgColor}">${icon}</div>
            ${INTEL_CARD_LABELS[step.key] || step.key}
          </div>
          <div class="intel-card-status${content ? ' filled' : ''}">${(() => { const n = parseIntelEntries(content).length; return n ? n + (n===1?' entry':' entries') : 'Empty'; })()}</div>
        </div>
        ${(() => {
          const entries = parseIntelEntries(content);
          if (!entries.length) return `<div class="intel-card-empty">Tap to add</div>`;
          const recent = entries.slice(-3);
          return recent.map(e => `<div class="intel-card-preview">${e.date ? `<span style="font-size:10px;color:var(--text3);margin-right:6px">${e.date}</span>` : ''}${(e.text||'').replace(/</g, '&lt;')}</div>`).join('');
        })()}
      </div>`;
    }).join('')}
  `;
}

function openIntelEdit(category) {
  const step = INTEL_STEPS.find(s => s.key === category);
  if (!step) return;

  intelEditCategory = category;
  document.getElementById('intelEditTitle').textContent = INTEL_CARD_LABELS[category] || step.question;
  document.getElementById('intelEditHint').textContent = step.hint;

  // Render existing entries
  const entries = parseIntelEntries(propertyContextCache?.[category]);
  const historyEl = document.getElementById('intelEditHistory');
  if (entries.length) {
    historyEl.innerHTML = entries.map(e =>
      `<div class="intel-edit-entry">
        <div class="intel-edit-entry-date">${e.date || 'Earlier note'}</div>
        <div class="intel-edit-entry-text">${(e.text||'').replace(/</g, '&lt;')}</div>
      </div>`
    ).join('') + `<div class="intel-edit-add-label">Add new note</div>`;
  } else {
    historyEl.innerHTML = '';
  }

  const textarea = document.getElementById('intelEditTextarea');
  textarea.value = '';
  textarea.placeholder = step.placeholder;

  document.getElementById('intelEditOverlay').classList.add('on');
  setTimeout(() => textarea.focus(), 300);
}

function closeIntelEdit() {
  document.getElementById('intelEditOverlay').classList.remove('on');
  intelEditCategory = null;
}

async function saveIntelEdit() {
  if (!intelEditCategory) return;
  const newText = document.getElementById('intelEditTextarea').value.trim();
  if (!newText) { showToast('Nothing to save'); return; }

  try {
    // Parse existing entries, append new one
    const existing = parseIntelEntries(propertyContextCache?.[intelEditCategory]);
    existing.push({ text: newText, date: new Date().toISOString().slice(0, 10) });
    const serialized = serializeIntelEntries(existing);

    const { error } = await sb.from('property_context').upsert(
      { category: intelEditCategory, content: serialized, updated_at: new Date().toISOString(), property_id: PROPERTY_ID },
      { onConflict: 'property_id,category' }
    );
    if (error) throw error;

    // Update cache
    if (!propertyContextCache) propertyContextCache = {};
    propertyContextCache[intelEditCategory] = serialized;

    showToast('Entry added');
    closeIntelEdit();
    renderIntelCards();
  } catch (e) {
    console.warn('Failed to save intel:', e);
    showToast('Failed to save');
  }
}

// --- Property Intel Wizard ---
var INTEL_STEPS = [
  {
    key: 'terrain',
    question: 'Describe your property terrain',
    hint: 'Hills, ridges, valleys, swamps, creek bottoms, flat hardwoods, etc. The more detail, the better Huginn understands your land.',
    placeholder: 'e.g., Rolling hardwood ridges with a creek bottom running NE to SW. Thick swamp on the east side, open ag fields to the north...'
  },
  {
    key: 'food_sources',
    question: 'What food sources are on or near the property?',
    hint: 'Ag fields (corn, beans, alfalfa), food plots, oak flats, apple trees, browse areas, etc.',
    placeholder: 'e.g., Standing corn on the north field through November. White oak flat on the ridge drops acorns early October...'
  },
  {
    key: 'bedding_areas',
    question: 'Where do deer bed on your property?',
    hint: 'Known bedding areas, thermal cover, thick cover, south-facing slopes in winter, etc.',
    placeholder: 'e.g., Does bed in the cattail swamp on the east side. Mature bucks stage in the thick brush along the creek...'
  },
  {
    key: 'water_sources',
    question: 'What water sources are available?',
    hint: 'Creeks, ponds, springs, ditches, water holes, etc.',
    placeholder: 'e.g., Year-round creek runs NE to SW through the middle. Small spring seep on the south ridge...'
  },
  {
    key: 'access_routes',
    question: 'How do you access your stands?',
    hint: 'Entry/exit routes, parking spots, wind-dependent access, problem areas where you bump deer.',
    placeholder: 'e.g., Park at the NW gate. Walk the creek bed south to the Ridge stand on SW winds. Avoid walking past the swamp on east wind mornings...'
  },
  {
    key: 'hunting_pressure',
    question: 'What does hunting pressure look like?',
    hint: 'Neighbors hunting, public land nearby, gun season pressure, how pressured are the deer?',
    placeholder: 'e.g., Light pressure — only 2-3 hunters on the property. Public land borders the south side. Heavy pressure during gun season pushes deer onto our land...'
  },
  {
    key: 'additional_notes',
    question: 'Anything else Huginn should know?',
    hint: 'Season goals, target bucks, property history, special areas, anything that helps the AI give better advice.',
    placeholder: 'e.g., Targeting Marsh Buck this season — he tends to move between Dan cam and Colin cam. Property has been managed for 8 years, no does shot in 3 years...'
  }
];

var intelWizardStep = 0;
var intelWizardData = {};

async function openIntelWizard() {
  intelWizardStep = 0;
  intelWizardData = {};

  // Wizard always starts with empty fields for new entries
  document.getElementById('intelWizardOverlay').classList.add('on');
  renderIntelWizardStep();
}

function closeIntelWizard() {
  document.getElementById('intelWizardOverlay').classList.remove('on');
}

function renderIntelWizardStep() {
  const step = INTEL_STEPS[intelWizardStep];
  const total = INTEL_STEPS.length;

  // Progress dots
  const progress = document.getElementById('intelWizardProgress');
  progress.innerHTML = INTEL_STEPS.map((_, i) => {
    let cls = 'intel-wizard-dot';
    if (i < intelWizardStep) cls += ' done';
    if (i === intelWizardStep) cls += ' active';
    return `<div class="${cls}"></div>`;
  }).join('');

  // Title
  document.getElementById('intelWizardTitle').textContent = `Property Intel (${intelWizardStep + 1}/${total})`;

  // Body
  const existing = intelWizardData[step.key] || '';
  document.getElementById('intelWizardBody').innerHTML = `
    <div class="intel-wizard-q">${step.question}</div>
    <div class="intel-wizard-hint">${step.hint}</div>
    <textarea class="intel-wizard-textarea" id="intelWizardInput" placeholder="${step.placeholder}">${existing}</textarea>
  `;

  // Footer
  const isFirst = intelWizardStep === 0;
  const isLast = intelWizardStep === total - 1;
  document.getElementById('intelWizardFooter').innerHTML = `
    <button class="intel-wizard-btn" onclick="${isFirst ? 'closeIntelWizard()' : 'prevIntelStep()'}" style="flex:0.6">${isFirst ? 'Cancel' : 'Back'}</button>
    <button class="intel-wizard-btn" onclick="skipIntelStep()" style="flex:0.5;font-size:12px;color:var(--text3)">Skip</button>
    <button class="intel-wizard-btn primary" onclick="${isLast ? 'finishIntelWizard()' : 'nextIntelStep()'}">${isLast ? 'Save' : 'Next'}</button>
  `;
}

function saveCurrentIntelStep() {
  const input = document.getElementById('intelWizardInput');
  if (input && input.value.trim()) {
    intelWizardData[INTEL_STEPS[intelWizardStep].key] = input.value.trim();
  }
}

function nextIntelStep() {
  saveCurrentIntelStep();
  if (intelWizardStep < INTEL_STEPS.length - 1) {
    intelWizardStep++;
    renderIntelWizardStep();
  }
}

function prevIntelStep() {
  saveCurrentIntelStep();
  if (intelWizardStep > 0) {
    intelWizardStep--;
    renderIntelWizardStep();
  }
}

function skipIntelStep() {
  if (intelWizardStep < INTEL_STEPS.length - 1) {
    intelWizardStep++;
    renderIntelWizardStep();
  } else {
    finishIntelWizard();
  }
}

async function finishIntelWizard() {
  saveCurrentIntelStep();

  // Save each key-value to property_context (append model)
  const wizEntries = Object.entries(intelWizardData).filter(([_, v]) => v);
  if (!wizEntries.length) {
    closeIntelWizard();
    return;
  }

  try {
    await loadPropertyContext();
    for (const [key, value] of wizEntries) {
      const existing = parseIntelEntries(propertyContextCache?.[key]);
      existing.push({ text: value, date: new Date().toISOString().slice(0, 10) });
      const serialized = serializeIntelEntries(existing);
      const { error } = await sb.from('property_context').upsert(
        { category: key, content: serialized, updated_at: new Date().toISOString(), property_id: PROPERTY_ID },
        { onConflict: 'property_id,category' }
      );
      if (error) throw error;
      if (!propertyContextCache) propertyContextCache = {};
      propertyContextCache[key] = serialized;
    }
    showToast('Property intel saved');
  } catch (e) {
    console.warn('Failed to save property context:', e);
    showToast('Some intel may not have saved');
  }

  closeIntelWizard();
}

// Load property context into system prompt
var propertyContextCache = null;

// Parse property_context content: returns array of {text, date} entries
// Handles legacy plain-text content (pre-append model) as a single entry
function parseIntelEntries(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (_) {}
  // Legacy plain text — wrap as single undated entry
  return [{ text: raw, date: null }];
}

function serializeIntelEntries(entries) {
  return JSON.stringify(entries);
}

async function loadPropertyContext() {
  try {
    const { data } = await sb.from('property_context').select('category, content').eq('property_id', PROPERTY_ID);
    if (data && data.length) {
      propertyContextCache = {};
      data.forEach(row => { propertyContextCache[row.category] = row.content; });
    }
  } catch (e) {
    console.warn('Could not load property context:', e);
  }
}
