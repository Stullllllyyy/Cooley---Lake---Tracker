// Vercel Serverless Function — USGS PAD-US Federal Lands tile proxy
// Bypasses CORS restriction on gis1.usgs.gov so Mapbox can load the raster tiles.
// File location: /api/padus-tile.js (root level, same level as /public)

module.exports = async function handler(req, res) {
  const { z, y, x } = req.query;

  if (!z || !y || !x) {
    return res.status(400).json({ error: 'Missing tile coordinates' });
  }

  // Validate params are numeric to prevent injection / SSRF
  if (!/^\d+$/.test(z) || !/^\d+$/.test(y) || !/^\d+$/.test(x)) {
    return res.status(400).json({ error: 'Invalid tile coordinates' });
  }

  const tileUrl = `https://gis1.usgs.gov/arcgis/rest/services/padus3/Federal_Fee_Managers_Authoritative/MapServer/tile/${z}/${y}/${x}`;

  try {
    const response = await fetch(tileUrl, {
      headers: {
        'User-Agent': 'HuginnHunt/1.0 (app.huginnhunt.com)'
      }
    });

    if (!response.ok) {
      return res.status(response.status).end();
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const buffer = await response.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // cache tiles 24 hours
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send(Buffer.from(buffer));

  } catch (err) {
    console.error('PAD-US tile proxy error:', err);
    return res.status(500).end();
  }
};
