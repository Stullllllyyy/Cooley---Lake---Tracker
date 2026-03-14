{
  "version": 2,
  "builds": [
    { "src": "index.html", "use": "@vercel/static" },
    { "src": "map.jpg", "use": "@vercel/static" }
  ],
  "routes": [
    { "src": "/map.jpg", "dest": "/map.jpg" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
