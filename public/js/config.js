// Huginn — config.js
// Top-level configuration constants extracted from index.html
// All declared with var for global scope across script tags

// --- Supabase ---
var SUPABASE_URL = 'https://drzmfoaspnahzbrrmnrv.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyem1mb2FzcG5haHpicnJtbnJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzQ0NzMsImV4cCI6MjA4ODY1MDQ3M30.-2nFoPIqeutHMKFWEJUvILZ54mq2h-RR1PlC7yxm-x8';

// --- Property defaults (Cooley Lake — Property #1) ---
var CLAT = 45.0200, CLNG = -88.2756;
var PROPERTY_ID = '403a9c61-4b6a-4bd1-81a3-a82054a4ce5e'; // Cooley Lake — Property #1 (default, overwritten by membership check)
var PROPERTY_CENTER = [-88.2756, 45.0200];
var PROPERTY_BOUNDS = [[-88.295, 45.010], [-88.258, 45.035]];

// --- Camera & sighting constants ---
var CAMNAMES = ["Dan","Colin","Ridge","Behind Rons","By Eric","Andy Cam","Creek Crossing","Jake Cam","Other"];
var PIN_MAP = {"Dan":"Dan","Colin":"Colin","Ridge":"Ridge","Behind Rons":"Rons","By Eric":"Eric"};
var PIN_POS = {"Dan":[35.4,49.1],"Colin":[17.5,61.4],"Ridge":[58.5,57.6],"Behind Rons":[77.4,82.2],"By Eric":[92.1,83.6]};
var DTYPES = ["Buck - Mature (4.5+)","Buck - 3.5","Buck - 2.5","Buck - 1.5","Doe","Fawn","Unknown"];
var BEHS = ["Feeding","Traveling","Scraping/Rubbing","Bedding","Chasing","Breeding","Alert/Spooked","Other"];
var TRAVEL_DIRS = ["Entering","Exiting","Passing Through","Unknown"];
var FACING_DIRS = ["N","NE","E","SE","S","SW","W","NW"];
var BUCK_COLORS = ["#e8c84a","#e87a4a","#4ae8c8","#c84ae8","#4a8ae8","#e84a8a","#8ae84a","#f0a050"];
var DIR_LABELS = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];

// --- Feature marker constants ---
var FEAT_TYPES = ['Stand','Scrape','Rub','Bedding'];
var FEAT_COLORS  = { Stand:'#8C7355', Scrape:'#E5B53B', Rub:'#c07b4c', Bedding:'#4a7a4e' };
var FEAT_STROKES = { Stand:'#a08468', Scrape:'#f0c75a', Rub:'#d4906a', Bedding:'#5d9462' };
var FEAT_LABELS  = { Stand:'S', Scrape:'Sc', Rub:'R', Bedding:'Bd' };
// Feather-style stroke SVG icons for each feature type (14×14, white stroke, 24×24 viewBox)
var FEAT_ICONS = {
  Stand:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
  Scrape:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round">' +
    '<line x1="7" y1="4" x2="5" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="17" y1="4" x2="19" y2="20"/></svg>',
  Rub:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="6 12 12 4 18 12"/><line x1="12" y1="22" x2="12" y2="12"/>' +
    '<line x1="9" y1="15" x2="15" y2="15"/><line x1="10" y1="19" x2="14" y2="19"/></svg>',
  Bedding:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round">' +
    '<ellipse cx="12" cy="14" rx="9" ry="5"/><path d="M8 14Q12 10 16 14"/></svg>'
};
var PIN_COLORS = ['#8C7355','#E5B53B','#c07b4c','#4a7a4e','#4a7ac8','#c84a4a'];
var PIN_COLOR_STROKES = {
  '#8C7355':'#a08468', '#E5B53B':'#f0c75a', '#c07b4c':'#d4906a',
  '#4a7a4e':'#5d9462', '#4a7ac8':'#6a8ad4', '#c84a4a':'#d46a6a'
};
