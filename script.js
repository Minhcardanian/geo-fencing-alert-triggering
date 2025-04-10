// -------------------------------------------
// 1) MAP SETUP & GLOBALS
// -------------------------------------------
const map = L.map('map').setView([10.762622, 106.660172], 16);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: 'Map data © OpenStreetMap contributors'
}).addTo(map);

// For freeform cluster polygon
let clusterPoints = [];
let clusterMarkers = [];
let clusterPolygon = null;  // Leaflet polygon
let turfClusterPoly = null; // turf polygon
let clusterActive = false;  // Are we drawing the cluster?

// Circle zones
let zoneCount = 0;
const maxZones = 10;
const zones = [];        // array of { circle, turfPoly }
let wasInsideZones = []; // track device in/out for zones

// Points A & B
let pointA = null;
let pointB = null;
let markerA = null;
let markerB = null;

// Path
let path = [];
let markerDevice = null;  // "car" emoji marker
let pathIndex = 0;
let simulationRunning = false;

// Click modes: 'idle', 'cluster', 'zone', 'setAB'
let clickMode = 'idle';

// -------------------------------------------
// 2) DOM Elements
// -------------------------------------------
const logPanel          = document.getElementById("log");
const setClusterBtn     = document.getElementById("setClusterBtn");
const finishClusterBtn  = document.getElementById("finishClusterBtn");
const addZoneBtn        = document.getElementById("addZoneBtn");
const zoneRadiusInput   = document.getElementById("zoneRadiusInput");
const setABBtn          = document.getElementById("setABBtn");
const aCoords           = document.getElementById("aCoords");
const bCoords           = document.getElementById("bCoords");
const numStepsInput     = document.getElementById("numStepsInput");
const genPathBtn        = document.getElementById("genPathBtn");
const clearPathBtn      = document.getElementById("clearPathBtn");
const startBtn          = document.getElementById("startBtn");
const stopBtn           = document.getElementById("stopBtn");

// -------------------------------------------
// 3) LOG HELPER
// -------------------------------------------
function logMessage(msg) {
  const now = new Date().toLocaleTimeString();
  logPanel.innerHTML += `[${now}] ${msg}<br/>`;
  logPanel.scrollTop = logPanel.scrollHeight;
}

// -------------------------------------------
// 4) CLUSTER (FREEFORM POLYGON)
// -------------------------------------------
setClusterBtn.addEventListener("click", () => {
  clickMode = 'cluster';
  clusterActive = true;
  // Reset existing cluster data
  clusterPoints = [];
  clusterMarkers.forEach(m => map.removeLayer(m));
  clusterMarkers = [];
  if (clusterPolygon) {
    map.removeLayer(clusterPolygon);
    clusterPolygon = null;
  }
  turfClusterPoly = null;
  logMessage("Freeform cluster mode: click multiple points (3+). Then click 'Finish Cluster'.");
});

finishClusterBtn.addEventListener("click", () => {
  if (!clusterActive || clusterPoints.length < 3) {
    logMessage("⚠️ Need at least 3 points to form a polygon cluster.");
    return;
  }
  clusterActive = false;
  // Create Leaflet polygon
  clusterPolygon = L.polygon(clusterPoints, { color: 'green' }).addTo(map);
  // Create turf polygon
  const coords = clusterPoints.map(latlng => [latlng.lng, latlng.lat]);
  coords.push([coords[0][0], coords[0][1]]); // close ring
  turfClusterPoly = turf.polygon([coords]);
  logMessage("Cluster polygon created!");
  clickMode = 'idle';
});

// -------------------------------------------
// 5) ADD ZONE (CIRCLE)
// -------------------------------------------
addZoneBtn.addEventListener("click", () => {
  if (!turfClusterPoly) {
    logMessage("⚠️ Cluster polygon not finished. Define it first.");
    return;
  }
  if (zoneCount >= maxZones) {
    logMessage("⚠️ Already at max zones.");
    return;
  }
  const rVal = parseFloat(zoneRadiusInput.value);
  if (Number.isNaN(rVal) || rVal <= 0) {
    logMessage("⚠️ Invalid radius.");
    return;
  }
  clickMode = 'zone';
  logMessage(`Click inside cluster to place circle zone (r=${rVal}m).`);
});

// -------------------------------------------
// 6) SET A & B
// -------------------------------------------
setABBtn.addEventListener("click", () => {
  if (!turfClusterPoly) {
    logMessage("⚠️ Cluster polygon not done. Set it first.");
    return;
  }
  clickMode = 'setAB';
  logMessage("Click 2 points inside cluster: 1st for A, 2nd for B.");
});

// -------------------------------------------
// 7) MAP CLICK (ALWAYS SHOW A MARKER)
// -------------------------------------------
map.on("click", (e) => {
  const { lat, lng } = e.latlng;

  // Always place a small grey circle marker to show user clicks
  L.circleMarker(e.latlng, {
    radius: 3,
    color: 'grey',
    opacity: 0.7
  }).addTo(map);

  // 7.1) cluster mode
  if (clickMode === 'cluster') {
    if (!clusterActive) {
      logMessage("⚠️ Press 'Set Cluster' again if you want to redefine the polygon.");
      return;
    }
    clusterPoints.push(e.latlng);
    const cMarker = L.circleMarker(e.latlng, { radius: 5, color: 'purple' }).addTo(map);
    clusterMarkers.push(cMarker);
    logMessage(`Cluster point #${clusterPoints.length} at [${lat.toFixed(5)}, ${lng.toFixed(5)}].`);
  }

  // 7.2) zone mode
  else if (clickMode === 'zone') {
    if (!insideCluster(lat, lng)) {
      logMessage("🛑 This click is outside the cluster polygon. Try again.");
      return;
    }
    const rVal = parseFloat(zoneRadiusInput.value);
    const color = randomColor();
    const circle = L.circle([lat, lng], { radius: rVal, color }).addTo(map);
    zoneCount++;
    logMessage(`➕ Zone${zoneCount} center=[${lat.toFixed(5)}, ${lng.toFixed(5)}], r=${rVal}m`);
    // create turf circle
    const turfPoly = turf.circle([lng, lat], rVal / 1000, { steps: 64, units: 'kilometers' });
    zones.push({ circle, turfPoly });
    wasInsideZones.push(false);
    clickMode = 'idle';
  }

  // 7.3) setAB
  else if (clickMode === 'setAB') {
    if (!insideCluster(lat, lng)) {
      logMessage("🛑 Must be inside cluster polygon.");
      return;
    }
    if (!pointA) {
      pointA = [lat, lng];
      if (markerA) map.removeLayer(markerA);
      markerA = L.marker(pointA, { icon: redIcon() }).addTo(map);
      aCoords.textContent = `[${lat.toFixed(5)}, ${lng.toFixed(5)}]`;
      logMessage(`Point A set at [${lat.toFixed(5)}, ${lng.toFixed(5)}].`);
    } else if (!pointB) {
      pointB = [lat, lng];
      if (markerB) map.removeLayer(markerB);
      markerB = L.marker(pointB, { icon: blueIcon() }).addTo(map);
      bCoords.textContent = `[${lat.toFixed(5)}, ${lng.toFixed(5)}]`;
      logMessage(`Point B set at [${lat.toFixed(5)}, ${lng.toFixed(5)}].`);
      clickMode = 'idle';
    }
  }
});

// Check if lat/lng inside freeform cluster polygon
function insideCluster(lat, lng) {
  if (!turfClusterPoly) return false;
  const pt = turf.point([lng, lat]);
  return turf.booleanPointInPolygon(pt, turfClusterPoly);
}

// -------------------------------------------
// 8) GENERATE A→B PATH
// -------------------------------------------
genPathBtn.addEventListener("click", () => {
  if (!pointA || !pointB) {
    logMessage("⚠️ A or B not set.");
    return;
  }
  clearPath();
  let steps = parseInt(numStepsInput.value, 10);
  if (Number.isNaN(steps) || steps < 2) steps = 10;

  const [latA, lngA] = pointA;
  const [latB, lngB] = pointB;
  const dLat = (latB - latA) / (steps - 1);
  const dLng = (lngB - lngA) / (steps - 1);

  for (let i=0; i<steps; i++) {
    path.push([latA + dLat*i, lngA + dLng*i]);
  }
  logMessage(`🔄 Path generated with ${steps} steps. Path size: ${path.length}`);

  if (!markerDevice && path.length>0) {
    // Instead of a circleMarker, we use a custom "car" emoji icon
    markerDevice = L.marker(path[0], {
      icon: carEmojiIcon()
    }).addTo(map);
  } else if (markerDevice) {
    markerDevice.setLatLng(path[0]);
  }
});

// -------------------------------------------
// 9) CLEAR PATH
// -------------------------------------------
clearPathBtn.addEventListener("click", clearPath);
function clearPath() {
  path = [];
  pathIndex = 0;
  if (markerDevice) {
    map.removeLayer(markerDevice);
    markerDevice = null;
  }
  logMessage("🧹 Path cleared.");
}

// -------------------------------------------
// 10) SIMULATION
// -------------------------------------------
startBtn.addEventListener("click", () => {
  if (simulationRunning) {
    logMessage("Simulation already running.");
    return;
  }
  if (path.length < 2) {
    logMessage("⚠️ Need at least 2 points in path.");
    return;
  }
  simulationRunning = true;
  pathIndex = 0;
  if (!markerDevice) {
    markerDevice = L.marker(path[0], { icon: carEmojiIcon() }).addTo(map);
  } else {
    markerDevice.setLatLng(path[0]);
  }
  // reset zone states
  for (let i=0; i<wasInsideZones.length; i++) {
    wasInsideZones[i] = false;
  }
  logMessage("Simulation started.");
  moveDevice();
});

stopBtn.addEventListener("click", () => {
  if (!simulationRunning) {
    logMessage("Simulation is not running.");
    return;
  }
  simulationRunning = false;
  logMessage("Simulation stopped.");
});

function moveDevice() {
  if (!simulationRunning) return;
  if (pathIndex >= path.length) {
    logMessage("End of simulation path reached.");
    simulationRunning = false;
    return;
  }

  const [lat, lng] = path[pathIndex++];
  markerDevice.setLatLng([lat, lng]);

  // Check circle zones for enter/exit
  zones.forEach((z, idx) => {
    const pt = turf.point([lng, lat]);
    const isInside = turf.booleanPointInPolygon(pt, z.turfPoly);
    if (isInside && !wasInsideZones[idx]) {
      logMessage(`🚨 ENTERED Zone${idx+1}`);
    }
    if (!isInside && wasInsideZones[idx]) {
      logMessage(`⚠️ EXITED Zone${idx+1}`);
    }
    wasInsideZones[idx] = isInside;
  });

  setTimeout(moveDevice, 1200);
}

// -------------------------------------------
// ICONS: A (Red), B (Blue), Car Emoji
// -------------------------------------------
function redIcon() {
  return L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
}
function blueIcon() {
  return L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
}

// We can create a "car" emoji icon in Leaflet by embedding an emoji
// in a data-URL or using a custom DOM element. Here's a simple example
// using a data-URL with text inside an SVG.
function carEmojiIcon() {
  // Using an SVG with text "🚗" or any emoji
  const svgContent = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="24">🚗</text>
    </svg>
  `);
  const dataUrl = `data:image/svg+xml,${svgContent}`;
  
  return L.icon({
    iconUrl: dataUrl,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
    className: 'car-emoji-icon'
  });
}

// -------------------------------------------
// UTILS
// -------------------------------------------
function randomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i=0; i<6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}
