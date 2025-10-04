// script.js
// Simple demo map + sample GeoJSON layers for NYC.
// Replace sampleGeoJSONs with your real processed data (GeoJSON exports or tile service).

// --- Initialize map centered over NYC ---
const map = L.map('map', { zoomControl: true }).setView([40.7128, -74.0060], 11);

// OpenStreetMap baselayer
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// --- Sample GeoJSON features (small mock data) ---
// Food access sample: polygons representing neighborhoods with relative food access score
const foodGeoJSON = {
  "type": "FeatureCollection",
  "features": [
    { "type":"Feature", "properties": { "name":"Central Brooklyn", "score": 35, "type":"low-access" },
      "geometry": { "type":"Polygon", "coordinates":[[
        [-73.962,40.680],[-73.940,40.680],[-73.940,40.700],[-73.962,40.700],[-73.962,40.680]
      ]] }
    },
    { "type":"Feature", "properties": { "name":"Upper Manhattan", "score": 78, "type":"good-access" },
      "geometry": { "type":"Polygon", "coordinates":[[
        [-73.95,40.84],[-73.92,40.84],[-73.92,40.86],[-73.95,40.86],[-73.95,40.84]
      ]] }
    }
  ]
};

// Heat islands sample: points with intensity
const heatGeoJSON = {
  "type": "FeatureCollection",
  "features": [
    { "type":"Feature", "properties": { "name":"Bushwick heat spot", "temp": 6.5 },
      "geometry": { "type":"Point", "coordinates":[-73.91,40.70] }
    },
    { "type":"Feature", "properties": { "name":"Harlem heat spot", "temp": 5.8 },
      "geometry": { "type":"Point", "coordinates":[-73.94,40.82] }
    }
  ]
};

// Waste sites sample: points representing collection hubs / landfill
const wasteGeoJSON = {
  "type":"FeatureCollection",
  "features": [
    { "type":"Feature", "properties":{ "name":"Sample Transfer Station", "tons_per_day": 600 },
      "geometry":{"type":"Point","coordinates":[-74.17,40.63]} // Staten Island-ish example
    }
  ]
};

// --- Styling functions ---
function foodStyle(feature){
  const score = feature.properties.score;
  // simple color ramp
  const color = score < 50 ? '#f08c6b' : '#76c893';
  return { color: color, weight:1.5, fillOpacity: 0.35 };
}

function heatPointToLayer(feature, latlng){
  const temp = feature.properties.temp;
  const r = 8 + (temp - 4) * 3; // scale marker size roughly
  return L.circleMarker(latlng, { radius: r, fillColor: '#ff5e5b', color:'#b23b3b', fillOpacity:0.8, weight:1 });
}

function wastePointToLayer(feature, latlng){
  return L.circleMarker(latlng, { radius: 10, fillColor: '#6b6b6b', color:'#333', fillOpacity:0.9 });
}

// --- Create layers ---
const foodLayer = L.geoJSON(foodGeoJSON, {
  style: foodStyle,
  onEachFeature: function(feature, layer){
    layer.bindPopup(`<strong>${feature.properties.name}</strong><br>Food access score: ${feature.properties.score}`);
  }
}).addTo(map);

const heatLayer = L.geoJSON(heatGeoJSON, {
  pointToLayer: heatPointToLayer,
  onEachFeature: function(feature, layer){
    layer.bindPopup(`<strong>${feature.properties.name}</strong><br>Relative temp anomaly: ${feature.properties.temp}°C`);
  }
}).addTo(map);

const wasteLayer = L.geoJSON(wasteGeoJSON, {
  pointToLayer: wastePointToLayer,
  onEachFeature: function(feature, layer){
    layer.bindPopup(`<strong>${feature.properties.name}</strong><br>Tons/day (sample): ${feature.properties.tons_per_day}`);
  }
}).addTo(map);

// --- Layer toggle controls wired to checkboxes ---
document.getElementById('toggleFood').addEventListener('change', function(e){
  if (e.target.checked) map.addLayer(foodLayer); else map.removeLayer(foodLayer);
});
document.getElementById('toggleHeat').addEventListener('change', function(e){
  if (e.target.checked) map.addLayer(heatLayer); else map.removeLayer(heatLayer);
});
document.getElementById('toggleWaste').addEventListener('change', function(e){
  if (e.target.checked) map.addLayer(wasteLayer); else map.removeLayer(wasteLayer);
});

// --- Legend (simple) ---
const legend = L.control({position: 'bottomright'});
legend.onAdd = function(){
  const div = L.DomUtil.create('div', 'info legend card');
  div.style.padding = '8px';
  div.innerHTML = `
    <strong>Legend</strong><br>
    <span style="display:inline-block;width:12px;height:12px;background:#76c893;margin-right:6px"></span> Good food access<br>
    <span style="display:inline-block;width:12px;height:12px;background:#f08c6b;margin-right:6px"></span> Low food access<br>
    <span style="display:inline-block;width:12px;height:12px;background:#ff5e5b;margin-right:6px;border-radius:50%"></span> Heat spot<br>
    <span style="display:inline-block;width:12px;height:12px;background:#6b6b6b;margin-right:6px"></span> Waste site
  `;
  return div;
};
legend.addTo(map);

// --- Example Chart: correlation demonstration (mock) ---
const ctx = document.getElementById('exampleChart').getContext('2d');
const exampleChart = new Chart(ctx, {
  type: 'bar',
  data: {
    labels: ['Neighborhood A', 'Neighborhood B', 'Neighborhood C', 'Neighborhood D'],
    datasets: [
      { label: 'Heat index (°C)', data: [5.2, 3.7, 6.1, 4.8], backgroundColor: 'rgba(255,94,91,0.7)' },
      { label: 'Food access index', data: [40, 70, 30, 55], backgroundColor: 'rgba(118,200,147,0.8)' }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { beginAtZero:true }
    },
    plugins: {
      legend: { position: 'bottom' }
    }
  }
});

// --- Helpful console hints ---
console.log("Smart New York demo loaded. Replace sample GeoJSON in script.js with real GeoJSON exports from GEE or your GIS pipeline.");
