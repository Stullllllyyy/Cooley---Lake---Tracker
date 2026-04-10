// Vercel Serverless Function — USGS PAD-US Federal Lands tile proxy (DISABLED)
// The USGS ArcGIS tile service does not serve tiles in the standard XYZ
// scheme Mapbox expects, so the proxy approach was abandoned. The file is
// kept so git history is preserved and re-enabling is a one-line change
// once a proper Mapbox-hosted PAD-US tileset is uploaded.
// File location: /api/padus-tile.js (root level, same level as /public)

module.exports = async function handler(req, res) {
  res.status(503).json({ error: 'Public Land layer not yet available' });
};
