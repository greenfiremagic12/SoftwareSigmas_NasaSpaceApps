// --- Initialize map centered over NYC ---
const map = L.map('map').setView([40.7128, -74.0060], 11);

// OpenStreetMap base layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// --- Sample GeoJSON Layers ---
const foodGeoJSON = {
  "type": "FeatureCollection",
  "features": [
    { "type":"Feature", "properties":{ "name":"Brooklyn", "score":35 },
      "geometry":{"type":"Polygon","coordinates":[[[-73.97,40.67],[-73.93,40.67],[-73.93,40.7],[-73.97,40.7],[-73.97,40.67]]]}}
  ]
};

const heatGeoJSON = {
  "type": "FeatureCollection",
  "features": [
    { "type":"Feature", "properties":{ "name":"Harlem heat", "temp":6.5 },
      "geometry":{ "type":"Point", "coordinates":[-73.94,40.82] }}
  ]
};

const wasteGeoJSON = {
  "type": "FeatureCollection",
  "features": [
    { "type":"Feature", "properties":{ "name":"Transfer Station", "tons_per_day": 500 },
      "geometry":{ "type":"Point", "coordinates":[-74.17,40.63] }}
  ]
};

// --- Styling and Popups ---
const foodLayer = L.geoJSON(foodGeoJSON, {
  style: { color: '#00d4ff', fillOpacity: 0.3 },
  onEachFeature: (f, l) => l.bindPopup(`<strong>${f.properties.name}</strong><br>Food score: ${f.properties.score}`)
}).addTo(map);

const heatLayer = L.geoJSON(heatGeoJSON, {
  pointToLayer: (f, latlng) => L.circleMarker(latlng, { radius: 10, fillColor: '#ff5e5e', color: '#ff5e5e', fillOpacity: 0.8 }),
  onEachFeature: (f, l) => l.bindPopup(`<strong>${f.properties.name}</strong><br>Temp anomaly: ${f.properties.temp}°C`)
}).addTo(map);

const wasteLayer = L.geoJSON(wasteGeoJSON, {
  pointToLayer: (f, latlng) => L.circleMarker(latlng, { radius: 8, fillColor: '#888', color: '#555', fillOpacity: 0.8 }),
  onEachFeature: (f, l) => l.bindPopup(`<strong>${f.properties.name}</strong><br>${f.properties.tons_per_day} tons/day`)
}).addTo(map);

// --- Checkbox Toggles ---
document.getElementById('toggleFood').addEventListener('change', e => e.target.checked ? map.addLayer(foodLayer) : map.removeLayer(foodLayer));
document.getElementById('toggleHeat').addEventListener('change', e => e.target.checked ? map.addLayer(heatLayer) : map.removeLayer(heatLayer));
document.getElementById('toggleWaste').addEventListener('change', e => e.target.checked ? map.addLayer(wasteLayer) : map.removeLayer(wasteLayer));

// --- NASA POWER Data Chart ---
async function getNasaPowerData() {
  const lat = 40.7128, lon = -74.0060;
  const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN&community=RE&longitude=${lon}&latitude=${lat}&start=20250101&end=20250110&format=JSON`;

  const res = await fetch(url);
  const data = await res.json();
  const dates = Object.keys(data.properties.parameter.T2M_MAX);
  const tMax = Object.values(data.properties.parameter.T2M_MAX);
  const tMin = Object.values(data.properties.parameter.T2M_MIN);

  Plotly.newPlot("chart", [
    { x: dates, y: tMax, type: "scatter", name: "Max Temp (°C)", line: { color: "#ff5e5e" } },
    { x: dates, y: tMin, type: "scatter", name: "Min Temp (°C)", line: { color: "#00d4ff" } }
  ], {
    title: "NASA POWER: NYC Temperature (°C)",
    paper_bgcolor: "#0b0c10",
    plot_bgcolor: "#0b0c10",
    font: { color: "#d1f0ff", family: "Orbitron" },
    xaxis: { title: "Date" },
    yaxis: { title: "Temperature (°C)" }
  });
}
getNasaPowerData();
