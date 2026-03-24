// Vercel Serverless Function — Anthropic API Proxy
// Keeps API key server-side, fixes CORS for browser calls
// File location: /api/claude.js (root level, same level as /public)

// --- Rate Limiting (in-memory sliding window) ---
// Stores { key: [timestamp, timestamp, ...] } per client IP.
// Persists across warm invocations on the same Vercel instance.
// Resets on cold start — acceptable for pre-beta; swap to Vercel KV for production scale.
const RATE_LIMIT_MAX = 50;          // max requests per window
const RATE_LIMIT_WINDOW = 3600000;  // 1 hour in ms
const rateLimitMap = new Map();

function getRateLimitKey(req) {
  // Use IP from Vercel's x-forwarded-for header.
  // When Auth ships, switch to authenticated user ID from JWT.
  const forwarded = req.headers['x-forwarded-for'];
  return (forwarded ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress) || 'unknown';
}

function checkRateLimit(key) {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW;

  let timestamps = rateLimitMap.get(key);
  if (!timestamps) {
    timestamps = [];
    rateLimitMap.set(key, timestamps);
  }

  // Prune entries older than the window
  while (timestamps.length && timestamps[0] <= cutoff) {
    timestamps.shift();
  }

  if (timestamps.length >= RATE_LIMIT_MAX) {
    // Calculate seconds until the oldest entry expires
    const retryAfter = Math.ceil((timestamps[0] + RATE_LIMIT_WINDOW - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  timestamps.push(now);
  return { allowed: true, remaining: RATE_LIMIT_MAX - timestamps.length };
}
// --- End Rate Limiting ---

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit check
  const clientKey = getRateLimitKey(req);
  const limit = checkRateLimit(clientKey);

  res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT_MAX));
  res.setHeader('X-RateLimit-Remaining', String(limit.remaining));

  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: `Maximum ${RATE_LIMIT_MAX} AI requests per hour. Try again in ${Math.ceil(limit.retryAfter / 60)} minutes.`
    });
  }

  const apiKey = process.env.ANTHROPIC_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Proxy request failed', details: error.message });
  }
};
