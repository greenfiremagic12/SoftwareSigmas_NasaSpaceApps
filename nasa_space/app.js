// ---------------------------
// app.js — heat points + NASA raster + chart matching map points
// ---------------------------

// ---------- CONFIG ----------
const FOOD_URL  = 'https://data.ny.gov/resource/9a8c-vfzj.geojson?$limit=5000';
const WASTE_URL = 'https://data.cityofnewyork.us/resource/8znf-7b2c.geojson?$limit=5000';
const HEAT_URL  = 'https://data.cityofnewyork.us/resource/4mhf-duep.geojson?$limit=500';

const NASA_POWER_START = '20250101';
const NASA_POWER_END   = '20250110';

// ---------- MAP INIT ----------
const map = L.map('map').setView([40.7128, -74.0060], 11);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// ---------- LAYERS & STATE ----------
let foodLayer = null;
let heatLayer = null;
let wasteLayer = null;
let nasaRasterLayer = null;
let nasaPowerPointsLayer = null;

let chartReady = false;

let toggleFoodEl, toggleHeatEl, toggleWasteEl, toggleNASARasterEl, toggleNASAGeoEl;

// store point-level metric arrays (for chart aggregation)
const heatPoints = []; // {name, lat, lon, hvi}
const foodPoints = []; // {name, lat, lon, score?}
const wastePoints = []; // {name, lat, lon, tons?}

// ---------- HELPERS ----------
function safeLayerGroup(){ return L.layerGroup(); }
function dbg(...a){ console.debug('[APP]', ...a); }
function wrn(...a){ console.warn('[APP]', ...a); }

function getLayerCount(layer){
  try {
    if (!layer || typeof layer.getLayers !== 'function') return 0;
    return layer.getLayers().reduce((acc, child) => {
      if (child && typeof child.getLayers === 'function') return acc + getLayerCount(child);
      const isMarker = (child instanceof L.Marker) || (child instanceof L.CircleMarker);
      return acc + (isMarker ? 1 : 0);
    }, 0);
  } catch(e){ wrn('getLayerCount err', e); return 0; }
}

// parse string geometries that sometimes come from Socrata
function parseGeom(m){
  if (!m) return null;
  if (typeof m === 'object') return m;
  if (typeof m === 'string'){
    try { return JSON.parse(m); } catch(e){ wrn('parseGeom not JSON'); return null; }
  }
  return null;
}

function extractFirstCoordArray(obj){
  if (!obj) return null;
  if (Array.isArray(obj)) {
    if (obj.length >= 2 && typeof obj[0] === 'number' && typeof obj[1] === 'number') return [obj[0], obj[1]];
    for (const c of obj){ const f = extractFirstCoordArray(c); if (f) return f; }
    return null;
  } else if (typeof obj === 'object') {
    for (const k of Object.keys(obj)){ const f = extractFirstCoordArray(obj[k]); if (f) return f; }
    return null;
  }
  return null;
}

function averageLngLat(coordsArray){
  if (!coordsArray || !coordsArray.length) return null;
  let sx=0, sy=0, n=0;
  for (const c of coordsArray){
    if (!Array.isArray(c) || c.length<2) continue;
    const [lng, lat] = c;
    if (!isFinite(lng) || !isFinite(lat)) continue;
    sx += lng; sy += lat; n++;
  }
  if (!n) return null;
  return [sy/n, sx/n]; // [lat, lng]
}

function getFeatureCentroid(feature){
  if (!feature) return null;
  let geom = feature.geometry ?? feature.the_geom ?? null;
  geom = parseGeom(geom);
  if (!geom) return null;
  const t = geom.type;
  if (t === 'Point' && Array.isArray(geom.coordinates)){ const [lng,lat] = geom.coordinates; return (isFinite(lat)&&isFinite(lng)) ? [lat,lng] : null; }
  if (t === 'MultiPoint' && Array.isArray(geom.coordinates) && geom.coordinates[0]){ const [lng,lat] = geom.coordinates[0]; return (isFinite(lat)&&isFinite(lng)) ? [lat,lng] : null; }
  if (t === 'Polygon' && Array.isArray(geom.coordinates)){ const outer = geom.coordinates[0] || []; return averageLngLat(outer); }
  if (t === 'MultiPolygon' && Array.isArray(geom.coordinates)){ const firstPoly = geom.coordinates[0]; const outer = Array.isArray(firstPoly) ? (firstPoly[0]||[]) : []; return averageLngLat(outer); }
  if (t === 'GeometryCollection' && Array.isArray(geom.geometries)){
    for (const g of geom.geometries){
      if (!g) continue;
      if (g.type === 'Point' && Array.isArray(g.coordinates)){ const [lng,lat] = g.coordinates; return (isFinite(lat)&&isFinite(lng)) ? [lat,lng] : null; }
      if (g.type === 'Polygon' && Array.isArray(g.coordinates) && g.coordinates[0]) return averageLngLat(g.coordinates[0]);
    }
  }
  const first = extractFirstCoordArray(geom);
  if (first){ const [lng,lat] = first; return (isFinite(lat)&&isFinite(lng)) ? [lat,lng] : null; }
  return null;
}

function getHeatColor(score){ return score>75? '#d73027' : score>50? '#fc8d59' : score>25? '#fee08b' : '#ffffbf'; }

// ---------- LOAD LAYERS: WASTE / FOOD / HEAT ----------
async function loadWasteLayer(){
  try {
    const res = await fetch(WASTE_URL);
    if (!res.ok) throw new Error(`Waste fetch HTTP ${res.status}`);
    const data = await res.json();
    dbg('waste fetched', (data && data.features)? `${data.features.length} features` : data);

    // clear wastePoints array
    wastePoints.length = 0;

    const geo = L.geoJSON(data, {
      style: { color:'#666', weight:1, fillOpacity:0.15 },
      pointToLayer: (f, latlng) => L.circleMarker(latlng, { radius:6, fillColor:'#888', color:'#555', fillOpacity:0.9 }),
      onEachFeature: (f, l) => {
        const name = f.properties?.name ?? f.properties?.facility ?? 'Unknown';
        const info = f.properties?.tons_per_day ?? f.properties?.description ?? '';
        l.bindPopup(`<strong>${name}</strong><br>${info}`);
      }
    });

    const pointLayer = L.layerGroup();
    (data.features || []).forEach((f,i) => {
      const c = getFeatureCentroid(f);
      if (!c) { wrn('waste feature missing geometry', i, f.properties); return; }
      const [lat,lng] = c;
      const tons = f.properties?.tons_per_day ? Number(f.properties.tons_per_day) : null;
      const popup = `<strong>${f.properties?.name ?? f.properties?.facility ?? 'Waste'}</strong><br>${tons ?? f.properties?.description ?? ''}`;
      const m = L.circleMarker([lat,lng], { radius:6, fillColor:'#888', color:'#111', weight:1, fillOpacity:0.9 }).bindPopup(popup);
      pointLayer.addLayer(m);

      // store for chart aggregation
      wastePoints.push({ name: f.properties?.name ?? f.properties?.facility ?? `waste-${i}`, lat, lon: lng, tons });
    });

    wasteLayer = L.layerGroup([geo, pointLayer]);
    dbg('waste layer ready — markers:', getLayerCount(wasteLayer));
  } catch (err){
    console.error('Waste load error', err);
    wasteLayer = safeLayerGroup();
  } finally { updateAllAggregatesAndChart(); }
}

async function loadFoodLayer(){
  try {
    const res = await fetch(FOOD_URL);
    if (!res.ok) throw new Error(`Food fetch HTTP ${res.status}`);
    const data = await res.json();
    dbg('food fetched', (data && data.features) ? `${data.features.length} features` : data);

    foodPoints.length = 0;

    const geo = L.geoJSON(data, {
      style: { color:'#00d4ff', weight:2, fillColor:'#00d4ff', fillOpacity:0.25 },
      pointToLayer: (f, latlng) => L.circleMarker(latlng, { radius:5, fillColor:'#00d4ff', color:'#003b4d', fillOpacity:0.95 }),
      onEachFeature: (f,l) => {
        const name = f.properties?.businessname ?? f.properties?.name ?? 'Food Access';
        const score = f.properties?.score ?? f.properties?.type ?? '';
        l.bindPopup(`<strong>${name}</strong><br>${score}`);
      }
    });

    const pointLayer = L.layerGroup();
    (data.features || []).forEach((f,i) => {
      const c = getFeatureCentroid(f);
      if (!c) { wrn('food feature missing geometry', i, f.properties); return; }
      const [lat,lng] = c;
      const score = (f.properties && (f.properties.score || f.properties.score === 0)) ? Number(f.properties.score) : null;
      const popup = `<strong>${f.properties?.businessname ?? f.properties?.name ?? 'Unknown'}</strong><br>${score ?? f.properties?.type ?? ''}`;
      const m = L.circleMarker([lat,lng], { radius:6, fillColor:'#00d4ff', color:'#002b3a', weight:1, fillOpacity:0.95 }).bindPopup(popup);
      pointLayer.addLayer(m);

      foodPoints.push({ name: f.properties?.businessname ?? f.properties?.name ?? `food-${i}`, lat, lon: lng, score });
    });

    foodLayer = L.layerGroup([geo, pointLayer]);
    dbg('food layer ready — markers:', getLayerCount(foodLayer));
  } catch (err){
    console.error('Food load error', err);
    foodLayer = safeLayerGroup();
  } finally { updateAllAggregatesAndChart(); }
}

async function loadHeatLayer(){
  try {
    const res = await fetch(HEAT_URL);
    if (!res.ok) throw new Error(`Heat fetch HTTP ${res.status}`);
    const data = await res.json();
    dbg('heat fetched', (data && data.features) ? `${data.features.length} features` : data);

    heatPoints.length = 0;

    // normalize features (some APIs already return geojson)
    const normalized = (data.features || []).map(f => {
      const g = parseGeom(f.geometry ?? f.the_geom ?? null);
      if (!g) return null;
      // copy small set of properties; dataset may use different field names
      const props = Object.assign({}, f.properties ?? f);
      // try common name fields
      props.hvi_score = props.hvi_score ?? props.HVI ?? props.hvi ?? props.hviScore ?? null;
      return { type:'Feature', properties: props, geometry: g };
    }).filter(Boolean);

    const geojson = { type:'FeatureCollection', features: normalized };

    const geo = L.geoJSON(geojson, {
      style: feature => ({ color:'#ff5e5e', weight:1.2, fillColor:getHeatColor(feature.properties?.hvi_score ?? 0), fillOpacity:0.6 }),
      onEachFeature: (f, l) => l.bindPopup(`<strong>${f.properties?.neighborhood ?? 'Unknown'}</strong><br>HVI: ${f.properties?.hvi_score ?? 'N/A'}`)
    });

    const pointLayer = L.layerGroup();
    (geojson.features || []).forEach((f,i) => {
      const c = getFeatureCentroid(f);
      if (!c) { wrn('heat feature missing geometry', i, f.properties); return; }
      const [lat,lng] = c;
      const score = (f.properties && (f.properties.hvi_score || f.properties.hvi_score === 0)) ? Number(f.properties.hvi_score) : null;
      const popup = `<strong>${f.properties?.neighborhood ?? 'Unknown'}</strong><br>HVI: ${score ?? 'N/A'}`;
      const m = L.circleMarker([lat,lng], { radius:7, fillColor:getHeatColor(score ?? 0), color:'#111', weight:0.8, fillOpacity:0.95 })
        .bindPopup(popup);
      pointLayer.addLayer(m);

      heatPoints.push({ name: f.properties?.neighborhood ?? `heat-${i}`, lat, lon: lng, hvi: score });
    });

    heatLayer = L.layerGroup([geo, pointLayer]);
    dbg('heat layer ready — markers:', getLayerCount(heatLayer));
  } catch (err){
    console.error('Heat load error', err);
    heatLayer = safeLayerGroup();
  } finally { updateAllAggregatesAndChart(); }
}

// ---------- NASA GIBS RASTER ----------
function buildGibsTemplate(dateISO){
  // Use GoogleMapsCompatible_Level9 to fit Leaflet zoom levels; dateISO format 'YYYY-MM-DD'
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${dateISO}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
}
function ensureNasaRaster(){
  if (nasaRasterLayer) return;
  const dateISO = new Date().toISOString().slice(0,10);
  const tpl = buildGibsTemplate(dateISO);
  nasaRasterLayer = L.tileLayer(tpl, { maxZoom: 9, minZoom: 2, attribution: 'NASA GIBS' });
  dbg('NASA raster prepared for', dateISO);
}

// ---------- NASA POWER POINTS ----------
async function loadNasaPowerPoints(){
  if (nasaPowerPointsLayer) return;
  const pts = [
    { name:'Manhattan', lat:40.7831, lon:-73.9712 },
    { name:'Brooklyn', lat:40.6782, lon:-73.9442 },
    { name:'Queens', lat:40.7282, lon:-73.7949 },
    { name:'Bronx', lat:40.8448, lon:-73.8648 },
    { name:'Staten Island', lat:40.5795, lon:-74.1502 }
  ];
  const g = L.layerGroup();
  for (const p of pts){
    try {
      const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN&community=RE&longitude=${p.lon}&latitude=${p.lat}&start=${NASA_POWER_START}&end=${NASA_POWER_END}&format=JSON`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`POWER HTTP ${res.status}`);
      const payload = await res.json();
      const tMaxObj = payload?.properties?.parameter?.T2M_MAX || {};
      const tMinObj = payload?.properties?.parameter?.T2M_MIN || {};
      const tMaxVals = Object.values(tMaxObj).map(v => Number(v)).filter(v => !isNaN(v));
      const tMinVals = Object.values(tMinObj).map(v => Number(v)).filter(v => !isNaN(v));
      const avgMax = tMaxVals.length ? (tMaxVals.reduce((a,b)=>a+b,0)/tMaxVals.length).toFixed(1) : 'N/A';
      const avgMin = tMinVals.length ? (tMinVals.reduce((a,b)=>a+b,0)/tMinVals.length).toFixed(1) : 'N/A';
      const popup = `<strong>${p.name}</strong><br>Avg T2M_MAX: ${avgMax} °C<br>Avg T2M_MIN: ${avgMin} °C`;
      const m = L.circleMarker([p.lat,p.lon], { radius:7, fillColor:'#ffd24d', color:'#6b4500', weight:1, fillOpacity:0.95 }).bindPopup(popup);
      g.addLayer(m);
      dbg('NASA POWER point added', p.name);
    } catch(err){ console.error('POWER point error', p.name, err); }
  }
  nasaPowerPointsLayer = g;
  dbg('NASA POWER points ready — markers:', getLayerCount(nasaPowerPointsLayer));
}

// ---------- INDICATORS & LEGEND ----------
function createIndicatorsControl(){
  const c = L.control({ position:'topright' });
  c.onAdd = function(){
    const div = L.DomUtil.create('div','map-indicators');
    div.style.minWidth='170px'; div.style.background='rgba(18,24,38,0.95)'; div.style.color='#d1f0ff';
    div.style.padding='8px'; div.style.borderRadius='8px'; div.style.fontFamily='Orbitron, sans-serif';
    div.style.fontSize='13px'; div.style.boxShadow='0 2px 8px rgba(0,0,0,0.6)';
    div.innerHTML = `
      <strong style="display:block; margin-bottom:6px; color:#00d4ff;">Layers</strong>
      <div id="indicator-food" style="cursor:pointer; display:flex; align-items:center; gap:8px; padding:4px 0;">
        <span style="width:12px;height:12px;border-radius:50%;background:#00d4ff;display:inline-block"></span>
        <span style="flex:1">Food</span><span id="indicator-food-count">0</span>
      </div>
      <div id="indicator-heat" style="cursor:pointer; display:flex; align-items:center; gap:8px; padding:4px 0;">
        <span style="width:12px;height:12px;border-radius:50%;background:#ff5e5e;display:inline-block"></span>
        <span style="flex:1">Heat</span><span id="indicator-heat-count">0</span>
      </div>
      <div id="indicator-waste" style="cursor:pointer; display:flex; align-items:center; gap:8px; padding:4px 0;">
        <span style="width:12px;height:12px;border-radius:50%;background:#888;display:inline-block"></span>
        <span style="flex:1">Waste</span><span id="indicator-waste-count">0</span>
      </div>
      <div style="margin-top:8px; font-size:11px; color:#9fbfdc;">Click an indicator to toggle</div>
    `;
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);
    return div;
  };
  c.addTo(map);
}

function updateIndicators(){
  const f = getLayerCount(foodLayer), h = getLayerCount(heatLayer), w = getLayerCount(wasteLayer);
  const fe = document.getElementById('indicator-food-count');
  const he = document.getElementById('indicator-heat-count');
  const we = document.getElementById('indicator-waste-count');
  if (fe) fe.textContent = f;
  if (he) he.textContent = h;
  if (we) we.textContent = w;
  const rowF = document.getElementById('indicator-food');
  const rowH = document.getElementById('indicator-heat');
  const rowW = document.getElementById('indicator-waste');
  if (rowF) rowF.style.opacity = toggleFoodEl?.checked ? '1' : '0.5';
  if (rowH) rowH.style.opacity = toggleHeatEl?.checked ? '1' : '0.5';
  if (rowW) rowW.style.opacity = toggleWasteEl?.checked ? '1' : '0.5';
}

function createHeatLegend(){
  const c = L.control({ position:'bottomright' });
  c.onAdd = function(){
    const div = L.DomUtil.create('div','heat-legend');
    div.style.background='rgba(18,24,38,0.95)'; div.style.color='#d1f0ff'; div.style.padding='8px';
    div.style.borderRadius='8px'; div.style.fontFamily='Orbitron, sans-serif'; div.style.fontSize='12px';
    div.style.boxShadow='0 2px 8px rgba(0,0,0,0.6)';
    div.innerHTML = `
      <strong style="color:#ff5e5e; display:block; margin-bottom:6px;">Heat Vulnerability</strong>
      <div style="display:flex; gap:6px; align-items:center;"><span style="width:14px;height:14px;background:#d73027;display:inline-block;border-radius:2px"></span> > 75</div>
      <div style="display:flex; gap:6px; align-items:center;"><span style="width:14px;height:14px;background:#fc8d59;display:inline-block;border-radius:2px"></span> 51–75</div>
      <div style="display:flex; gap:6px; align-items:center;"><span style="width:14px;height:14px;background:#fee08b;display:inline-block;border-radius:2px"></span> 26–50</div>
      <div style="display:flex; gap:6px; align-items:center;"><span style="width:14px;height:14px;background:#ffffbf;display:inline-block;border-radius:2px"></span> 0–25</div>
    `;
    L.DomEvent.disableClickPropagation(div);
    return div;
  };
  c.addTo(map);
}

// ---------- AGGREGATION & CHART UPDATES ----------
function computeAggregates(){
  // heat avg HVI (0-100)
  const heatVals = heatPoints.map(p => p.hvi).filter(v => v !== null && !isNaN(v));
  const avgHeat = heatVals.length ? (heatVals.reduce((a,b)=>a+b,0)/heatVals.length) : null;

  // food: average score if present, otherwise count
  const foodScores = foodPoints.map(p => p.score).filter(v => v !== null && !isNaN(v));
  const avgFoodScore = foodScores.length ? (foodScores.reduce((a,b)=>a+b,0) / foodScores.length) : null;
  const foodCount = foodPoints.length;

  // waste: total tons (sum of tons fields)
  const wasteTons = wastePoints.map(p => p.tons).filter(v => v !== null && !isNaN(v));
  const totalWaste = wasteTons.length ? wasteTons.reduce((a,b)=>a+b,0) : null;

  return {
    avgHeat, avgFoodScore, foodCount, totalWaste
  };
}

function updateAggregatesChart(){
  if (!chartReady) return;
  const agg = computeAggregates();

  // Prepare values for right-axis traces (traces 2,3,4)
  const heatY = agg.avgHeat !== null ? [Number(agg.avgHeat.toFixed(1))] : [0];
  const foodY = agg.avgFoodScore !== null ? [Number(agg.avgFoodScore.toFixed(2))] : [agg.foodCount || 0];
  const wasteY = agg.totalWaste !== null ? [Number(agg.totalWaste.toFixed(1))] : [0];

  const heatText = agg.avgHeat !== null ? [`${agg.avgHeat.toFixed(1)} (avg HVI)`] : ['N/A'];
  const foodText = agg.avgFoodScore !== null ? [`${agg.avgFoodScore.toFixed(2)} (avg score)`] : [`${agg.foodCount} features`];
  const wasteText = agg.totalWaste !== null ? [`${agg.totalWaste.toFixed(1)} tons/day`] : ['N/A'];

  try {
    Plotly.restyle('chart', { y: [heatY], text: [heatText] }, [2]);
    Plotly.restyle('chart', { y: [foodY], text: [foodText] }, [3]);
    Plotly.restyle('chart', { y: [wasteY], text: [wasteText] }, [4]);

    // adjust right axis range based on values: use max of metrics scaled
    const rightMax = Math.max(100, heatY[0]*1.2, foodY[0]*1.2, wasteY[0]*1.2, 10);
    Plotly.relayout('chart', { 'yaxis2.range': [0, rightMax] });
    dbg('Aggregates updated', { agg, rightMax });
  } catch (err){
    wrn('updateAggregatesChart failed', err);
  }
}

function updateAllAggregatesAndChart(){
  updateLayerCounts();
  updateIndicators();
  updateAggregatesChart();
}

// ---------- PLOTLY CHART INITIALIZATION ----------
async function getNasaPowerDataForNYC(){
  const lat=40.7128, lon=-74.0060;
  const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN&community=RE&longitude=${lon}&latitude=${lat}&start=${NASA_POWER_START}&end=${NASA_POWER_END}&format=JSON`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const tMaxObj = data?.properties?.parameter?.T2M_MAX || {};
    const tMinObj = data?.properties?.parameter?.T2M_MIN || {};
    const dates = Object.keys(tMaxObj);
    const tMax = Object.values(tMaxObj).map(v => v === null ? NaN : v);
    const tMin = Object.values(tMinObj).map(v => v === null ? NaN : v);
    return { dates, tMax, tMin };
  } catch(err){ console.error('NASA POWER fetch failed', err); return { dates:[], tMax:[], tMin:[] }; }
}

function toggleChartTraceVisibility(traceIndex, visible){
  if (!chartReady) return;
  try { Plotly.restyle('chart', { visible }, [traceIndex]); } catch(e){ wrn('toggleChartTraceVisibility', e); }
}

function updateLayerCounts(){
  if (chartReady){
    try {
      Plotly.restyle('chart', { y: [[getLayerCount(foodLayer)]] }, [2]); // note: initial design kept counts here for backward compatibility
      Plotly.restyle('chart', { y: [[getLayerCount(heatLayer)]] }, [3]);
      Plotly.restyle('chart', { y: [[getLayerCount(wasteLayer)]] }, [4]);
    } catch(e){ /* ignore if chart not ready */ }
  }
  updateIndicators();
}

async function initCharts(){
  try {
    const nasa = await getNasaPowerDataForNYC();

    // initial aggregated metrics
    const agg = computeAggregates();
    const heatBar = agg.avgHeat !== null ? [Number(agg.avgHeat.toFixed(1))] : [0];
    const foodBar = agg.avgFoodScore !== null ? [Number(agg.avgFoodScore.toFixed(2))] : [agg.foodCount || 0];
    const wasteBar = agg.totalWaste !== null ? [Number(agg.totalWaste.toFixed(1))] : [0];

    const traces = [
      // NASA temps (left axis)
      { x: nasa.dates, y: nasa.tMax, type:'scatter', name:'Max Temp (°C)', line:{ color:'#ff5e5e' }, yaxis: 'y' },
      { x: nasa.dates, y: nasa.tMin, type:'scatter', name:'Min Temp (°C)', line:{ color:'#00d4ff' }, yaxis: 'y' },

      // Aggregated map metrics (right axis)
      { x: ['Avg HVI'], y: heatBar, type:'bar', name:'Heat (avg HVI)', marker:{ color:'#ff5e5e' }, text: heatBar.map(v=>v ? `${v}` : 'N/A'), textposition:'auto', hovertemplate:'Heat avg HVI: %{y}<extra></extra>', yaxis: 'y2', visible: true },
      { x: ['Food'], y: foodBar, type:'bar', name:'Food (avg score / count)', marker:{ color:'#00d4ff' }, text: foodBar.map(v=>v ? `${v}` : 'N/A'), textposition:'auto', hovertemplate:'Food avg score / count: %{y}<extra></extra>', yaxis: 'y2', visible: true },
      { x: ['Waste'], y: wasteBar, type:'bar', name:'Waste (total tons/day)', marker:{ color:'#888' }, text: wasteBar.map(v=>v ? `${v}` : 'N/A'), textposition:'auto', hovertemplate:'Waste total tons/day: %{y}<extra></extra>', yaxis: 'y2', visible: true }
    ];

    const layout = {
      title: "NASA POWER: NYC Temperature (°C) — map metrics (right axis)",
      paper_bgcolor: "#0b0c10",
      plot_bgcolor: "#0b0c10",
      font: { color: "#d1f0ff", family: "Orbitron" },
      xaxis: { title: "Date / Category", automargin: true },
      yaxis: { title: "Temperature (°C)", automargin: true },
      yaxis2: { title: "Map metrics (see units)", overlaying: 'y', side: 'right', automargin: true, range: [0, Math.max(100, heatBar[0]*1.2, foodBar[0]*1.2, wasteBar[0]*1.2, 10)] },
      legend: { orientation: 'h', x: 0, y: -0.2 },
      margin: { t: 60, b: 80 }
    };

    Plotly.newPlot('chart', traces, layout, { responsive: true });
    chartReady = true;
    updateAllAggregatesAndChart();
    dbg('Chart initialized');
  } catch(err){ console.error('initCharts failed', err); }
}

// ---------- INIT: build layers and wire UI ----------
async function initNYCLayers(){
  // load data layers
  await Promise.all([ loadWasteLayer(), loadFoodLayer(), loadHeatLayer() ]);

  // DOM toggles
  toggleFoodEl = document.getElementById('toggleFood');
  toggleHeatEl = document.getElementById('toggleHeat');
  toggleWasteEl = document.getElementById('toggleWaste');
  toggleNASARasterEl = document.getElementById('toggleNASARaster');
  toggleNASAGeoEl = document.getElementById('toggleNASAGeo');

  // indicators + legend
  createIndicatorsControl();
  createHeatLegend();

  // prepare NASA raster (tile template uses today's date)
  ensureNasaRaster();

  // hook indicator clicks to checkboxes
  const rowF = document.getElementById('indicator-food');
  const rowH = document.getElementById('indicator-heat');
  const rowW = document.getElementById('indicator-waste');
  if (rowF) rowF.addEventListener('click', ()=>{ if(!toggleFoodEl) return; toggleFoodEl.checked = !toggleFoodEl.checked; toggleFoodEl.dispatchEvent(new Event('change')); });
  if (rowH) rowH.addEventListener('click', ()=>{ if(!toggleHeatEl) return; toggleHeatEl.checked = !toggleHeatEl.checked; toggleHeatEl.dispatchEvent(new Event('change')); });
  if (rowW) rowW.addEventListener('click', ()=>{ if(!toggleWasteEl) return; toggleWasteEl.checked = !toggleWasteEl.checked; toggleWasteEl.dispatchEvent(new Event('change')); });

  // safe add/remove helpers
  const safeAdd = l => { if (l && !map.hasLayer(l)) map.addLayer(l); };
  const safeRemove = l => { if (l && map.hasLayer(l)) map.removeLayer(l); };

  // wire main toggles
  if (toggleFoodEl) toggleFoodEl.addEventListener('change', e => { e.target.checked ? safeAdd(foodLayer) : safeRemove(foodLayer); updateAllAggregatesAndChart(); toggleChartTraceVisibility(3, e.target.checked); });
  if (toggleHeatEl) toggleHeatEl.addEventListener('change', e => { e.target.checked ? safeAdd(heatLayer) : safeRemove(heatLayer); updateAllAggregatesAndChart(); toggleChartTraceVisibility(2, e.target.checked); });
  if (toggleWasteEl) toggleWasteEl.addEventListener('change', e => { e.target.checked ? safeAdd(wasteLayer) : safeRemove(wasteLayer); updateAllAggregatesAndChart(); toggleChartTraceVisibility(4, e.target.checked); });

  // NASA raster toggle
  if (toggleNASARasterEl) toggleNASARasterEl.addEventListener('change', e => { if (e.target.checked) { ensureNasaRaster(); safeAdd(nasaRasterLayer); } else safeRemove(nasaRasterLayer); });

  // NASA POWER points toggle (lazy load)
  if (toggleNASAGeoEl) toggleNASAGeoEl.addEventListener('change', async e => {
    if (e.target.checked) { if (!nasaPowerPointsLayer) await loadNasaPowerPoints(); safeAdd(nasaPowerPointsLayer); } else if (nasaPowerPointsLayer) safeRemove(nasaPowerPointsLayer);
  });

  // add defaults according to checked state
  if (toggleFoodEl?.checked) safeAdd(foodLayer);
  if (toggleHeatEl?.checked) safeAdd(heatLayer);
  if (toggleWasteEl?.checked) safeAdd(wasteLayer);
  if (toggleNASARasterEl?.checked) { ensureNasaRaster(); safeAdd(nasaRasterLayer); }
  if (toggleNASAGeoEl?.checked) { await loadNasaPowerPoints(); safeAdd(nasaPowerPointsLayer); }

  // fit map to present layers (if any)
  const present = [foodLayer, heatLayer, wasteLayer, nasaPowerPointsLayer].filter(l => l && l.getLayers && l.getLayers().length > 0);
  if (present.length){
    try { const group = L.featureGroup(present); map.fitBounds(group.getBounds(), { padding:[20,20] }); } catch(e){ wrn('fitBounds failed', e); }
  }

  updateIndicators();
  dbg('initNYCLayers done');
}

// ---------- BOOTSTRAP ----------
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initNYCLayers();
    await initCharts();
  } catch (err){ console.error('Initialization error', err); }
});

