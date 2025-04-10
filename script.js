// -------------------------------------------
// 1) MAP SETUP & GLOBALS
// -------------------------------------------
const map = L.map('map').setView([10.762622, 106.660172], 16);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: 'Map data © OpenStreetMap contributors'
}).addTo(map);

// Initialize Geoman controls (only enable polygon drawing)
map.pm.addControls({
  position: 'topleft',
  drawMarker: false,
  drawCircle: false,
  drawPolyline: false,
  drawRectangle: false,
  drawCircleMarker: false,
  drawPolygon: true,
  editMode: true,
  dragMode: true,
  removalMode: false,
});

// Cluster polygon variables
let clusterPolygon = null;    // Leaflet polygon for the cluster
let turfClusterPoly = null;   // Turf polygon for checks

// Circle zones
let zoneCount = 0;
const maxZones = 10;
const zones = [];         // array of { circle, turfPoly }
let wasInsideZones = [];  // track device in/out for zones

// Points A & B
let pointA = null;
let pointB = null;
let markerA = null;
let markerB = null;

// Path & simulation
let path = [];
let markerDevice = null;
let pathIndex = 0;
let simulationRunning = false;

// Click mode for additional functions (for zones or set A/B)
let clickMode = 'idle'; // 'zone' or 'setAB' when active

// -------------------------------------------
// 2) DOM ELEMENTS
// -------------------------------------------
const logPanel          = document.getElementById("log");
const clearClusterBtn   = document.getElementById("clearClusterBtn");
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
// 4) CLUSTER POLYGON VIA GEOMAN
// -------------------------------------------
// Listen for when the user creates a polygon using Geoman
map.on('pm:create', e => {
  if (e.layer && e.layer instanceof L.Polygon) {
    // When a polygon is created, assume it is the cluster polygon
    if (clusterPolygon) {
      // If one exists already, remove it
      map.removeLayer(clusterPolygon);
    }
    clusterPolygon = e.layer;
    // Optionally, disable drawing mode after creation:
    map.pm.disableDraw('Polygon');

    // Convert the polygon's latlngs into [lng, lat] coordinates
    const latlngs = clusterPolygon.getLatLngs()[0];
    const coords = latlngs.map(pt => [pt.lng, pt.lat]);
    // Close the ring
    coords.push([coords[0][0], coords[0][1]]);
    turfClusterPoly = turf.polygon([coords]);
    logMessage("Cluster polygon drawn and saved (editable via Geoman).");
  }
});

// Optional: allow user to clear the cluster polygon manually
clearClusterBtn.addEventListener("click", () => {
  if (clusterPolygon) {
    map.removeLayer(clusterPolygon);
    clusterPolygon = null;
    turfClusterPoly = null;
    logMessage("Cluster polygon cleared.");
  } else {
    logMessage("No cluster polygon to clear.");
  }
});

// -------------------------------------------
// 5) ADD CIRCLE ZONES
// -------------------------------------------
addZoneBtn.addEventListener("click", () => {
  if (!turfClusterPoly) {
    logMessage("⚠️ Cluster polygon not set. Please draw it first using Geoman.");
    return;
  }
  if (zoneCount >= maxZones) {
    logMessage("⚠️ Already reached maximum of 10 zones.");
    return;
  }
  const rVal = parseFloat(zoneRadiusInput.value);
  if (Number.isNaN(rVal) || rVal <= 0) {
    logMessage("⚠️ Invalid radius value.");
    return;
  }
  clickMode = 'zone';
  logMessage(`Click inside the cluster polygon to place a circle zone (r=${rVal}m).`);
});

// -------------------------------------------
// 6) SET POINTS A & B
// -------------------------------------------
setABBtn.addEventListener("click", () => {
  if (!turfClusterPoly) {
    logMessage("⚠️ Cluster polygon not set. Draw it first.");
    return;
  }
  clickMode = 'setAB';
  logMessage("Click 2 points inside the cluster polygon: 1st for A, 2nd for B.");
});

// -------------------------------------------
// 7) MAP CLICK HANDLER (for zone and set A/B)
// -------------------------------------------
map.on("click", e => {
  const { lat, lng } = e.latlng;
  // Always add a small grey marker for feedback
  L.circleMarker(e.latlng, {
    radius: 3,
    color: 'grey',
    opacity: 0.7
  }).addTo(map);

  // Check additional modes:
  // a) Zone mode
  if (clickMode === 'zone') {
    if (!insideCluster(lat, lng)) {
      logMessage("🛑 Click is outside the cluster polygon. Try again.");
      return;
    }
    const rVal = parseFloat(zoneRadiusInput.value);
    const zoneColor = randomColor();
    const circle = L.circle([lat, lng], { radius: rVal, color: zoneColor }).addTo(map);
    zoneCount++;
    logMessage(`➕ Zone${zoneCount} created at [${lat.toFixed(5)}, ${lng.toFixed(5)}] with radius ${rVal}m.`);
    // Create Turf circle for detection
    const turfPoly = turf.circle([lng, lat], rVal / 1000, { steps: 64, units: 'kilometers' });
    zones.push({ circle, turfPoly });
    wasInsideZones.push(false);
    clickMode = 'idle';
  }
  // b) Set A & B mode
  else if (clickMode === 'setAB') {
    if (!insideCluster(lat, lng)) {
      logMessage("🛑 Must click inside cluster polygon.");
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

// Utility: Check if a point is inside cluster polygon using Turf
function insideCluster(lat, lng) {
  if (!turfClusterPoly) return false;
  const pt = turf.point([lng, lat]);
  return turf.booleanPointInPolygon(pt, turfClusterPoly);
}

// -------------------------------------------
// 8) GENERATE A→B PATH (Interpolation)
// -------------------------------------------
genPathBtn.addEventListener("click", () => {
  if (!pointA || !pointB) {
    logMessage("⚠️ Points A and B are not set.");
    return;
  }
  clearPath();
  let steps = parseInt(numStepsInput.value, 10);
  if (Number.isNaN(steps) || steps < 2) steps = 10;
  const [latA, lngA] = pointA;
  const [latB, lngB] = pointB;
  const dLat = (latB - latA) / (steps - 1);
  const dLng = (lngB - lngA) / (steps - 1);
  for (let i = 0; i < steps; i++) {
    path.push([latA + dLat * i, lngA + dLng * i]);
  }
  logMessage(`🔄 Path generated with ${steps} steps (size: ${path.length}).`);
  if (!markerDevice && path.length > 0) {
    markerDevice = L.marker(path[0], { icon: carEmojiIcon() }).addTo(map);
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
    logMessage("⚠️ Need at least 2 path points.");
    return;
  }
  simulationRunning = true;
  pathIndex = 0;
  if (!markerDevice) {
    markerDevice = L.marker(path[0], { icon: carEmojiIcon() }).addTo(map);
  } else {
    markerDevice.setLatLng(path[0]);
  }
  // Reset zone states
  for (let i = 0; i < wasInsideZones.length; i++) {
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

  // Check all zones for enter/exit events
  zones.forEach((z, idx) => {
    const pt = turf.point([lng, lat]);
    const isInside = turf.booleanPointInPolygon(pt, z.turfPoly);
    if (isInside && !wasInsideZones[idx]) {
      logMessage(`🚨 ENTERED Zone${idx + 1}`);
    }
    if (!isInside && wasInsideZones[idx]) {
      logMessage(`⚠️ EXITED Zone${idx + 1}`);
    }
    wasInsideZones[idx] = isInside;
  });
  setTimeout(moveDevice, 1200);
}

// -------------------------------------------
// 11) ICONS: A (Red), B (Blue), Car Emoji
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

// Car emoji icon using an SVG data URL
function carEmojiIcon() {
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
    popupAnchor: [0, -20]
  });
}

// -------------------------------------------
// 12) UTILS
// -------------------------------------------
function randomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}
