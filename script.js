// -------------------------------------------
// 1) MAP SETUP & GLOBALS
// -------------------------------------------
const map = L.map('map').setView([10.762622, 106.660172], 16);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: 'Map data © OpenStreetMap contributors'
}).addTo(map);

// For cluster rectangle
let clusterCorner1 = null;
let clusterCorner2 = null;
let clusterRect = null;
let clusterBounds = null; // Will store L.LatLngBounds
let clusterSet = false;

// For circle zones
const zones = []; // array of { circle, turfPoly, color, radius }
let wasInsideZones = []; // parallel array for enter/exit tracking
let zoneCount = 0;
const maxZones = 10;

// For A & B
let pointA = null;
let pointB = null;
let markerA = null;
let markerB = null;

// For path
let path = [];
let markerDevice = null;
let pathIndex = 0;
let simulationRunning = false;

// Click modes: "idle", "cluster", "zone", "setAB"
let clickMode = "idle";

// -------------------------------------------
// 2) DOM Elements
// -------------------------------------------
const logPanel        = document.getElementById("log");
const setClusterBtn   = document.getElementById("setClusterBtn");
const addZoneBtn      = document.getElementById("addZoneBtn");
const zoneRadiusInput = document.getElementById("zoneRadiusInput");
const setABBtn        = document.getElementById("setABBtn");
const aCoords         = document.getElementById("aCoords");
const bCoords         = document.getElementById("bCoords");
const numStepsInput   = document.getElementById("numStepsInput");
const genPathBtn      = document.getElementById("genPathBtn");
const clearPathBtn    = document.getElementById("clearPathBtn");
const startBtn        = document.getElementById("startBtn");
const stopBtn         = document.getElementById("stopBtn");

// -------------------------------------------
// 3) Logging Function
// -------------------------------------------
function logMessage(msg) {
  const now = new Date().toLocaleTimeString();
  logPanel.innerHTML += `[${now}] ${msg}<br/>`;
  logPanel.scrollTop = logPanel.scrollHeight;
}

// -------------------------------------------
// 4) Set Cluster Rectangle
// -------------------------------------------
setClusterBtn.addEventListener("click", () => {
  clickMode = "cluster";
  clusterCorner1 = null;
  clusterCorner2 = null;
  clusterSet = false;
  if (clusterRect) {
    map.removeLayer(clusterRect);
    clusterRect = null;
  }
  logMessage("Click 2 points on map to define cluster rectangle corners.");
});

// -------------------------------------------
// 5) Add Circle Zone
// -------------------------------------------
addZoneBtn.addEventListener("click", () => {
  if (!clusterSet) {
    logMessage("⚠️ Cluster not set yet. Please set the cluster first.");
    return;
  }
  if (zoneCount >= maxZones) {
    logMessage("⚠️ Already have max zones.");
    return;
  }
  const rVal = parseFloat(zoneRadiusInput.value);
  if (Number.isNaN(rVal) || rVal <= 0) {
    logMessage("⚠️ Invalid radius.");
    return;
  }
  // Switch mode to 'zone'; next map click sets circle center
  clickMode = "zone";
  logMessage("Click inside cluster to place zone center.");
});

// -------------------------------------------
// 6) Set Points A & B
// -------------------------------------------
setABBtn.addEventListener("click", () => {
  if (!clusterSet) {
    logMessage("⚠️ Cluster not set. Set cluster first.");
    return;
  }
  clickMode = "setAB";
  logMessage("Click 2 points inside cluster: 1st for A, 2nd for B.");
});

// -------------------------------------------
// 7) Map Click Handler
// -------------------------------------------
map.on("click", (e) => {
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;

  if (clickMode === "cluster") {
    if (!clusterCorner1) {
      clusterCorner1 = e.latlng;
      logMessage(`Cluster corner #1 at [${lat.toFixed(5)}, ${lng.toFixed(5)}]. Click the 2nd corner.`);
    } else if (!clusterCorner2) {
      clusterCorner2 = e.latlng;
      // Draw rectangle
      clusterBounds = L.latLngBounds(clusterCorner1, clusterCorner2);
      clusterRect = L.rectangle(clusterBounds, { color: 'green', weight: 2 }).addTo(map);
      clusterSet = true;
      logMessage("Cluster rectangle defined!");
      clickMode = "idle";
    }
  }
  else if (clickMode === "zone") {
    // Make sure click is inside cluster rectangle
    if (!clusterSet || !clusterBounds.contains(e.latlng)) {
      logMessage("🛑 Click is outside cluster rectangle. Try again.");
      return;
    }
    // Create circle in Leaflet
    const rVal = parseFloat(zoneRadiusInput.value);
    const color = randomColor();
    const circle = L.circle([lat, lng], { radius: rVal, color }).addTo(map);
    zoneCount++;
    logMessage(`➕ Created Zone${zoneCount} at [${lat.toFixed(5)}, ${lng.toFixed(5)}], r=${rVal}m`);

    // Create turf polygon approximation
    const turfPoly = turf.circle([lng, lat], rVal / 1000, { steps: 64, units: 'kilometers' });
    zones.push({ circle, turfPoly, color, radius: rVal });
    wasInsideZones.push(false);

    // Return to idle
    clickMode = "idle";
  }
  else if (clickMode === "setAB") {
    if (!clusterSet || !clusterBounds.contains(e.latlng)) {
      logMessage("🛑 Point must be inside cluster rectangle.");
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
      clickMode = "idle";
    }
  }
});

// -------------------------------------------
// 8) Generate Path (A→B Interpolation)
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

  logMessage(`🔄 Generated path with ${steps} steps (size: ${path.length}).`);
  if (!markerDevice && path.length > 0) {
    markerDevice = L.circleMarker(path[0], { radius: 6, color: 'orange' }).addTo(map);
  } else if (markerDevice) {
    markerDevice.setLatLng(path[0]);
  }
});

// -------------------------------------------
// 9) Clear Path
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
// 10) Start/Stop Simulation
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
    markerDevice = L.circleMarker(path[0], { radius: 6, color: 'orange' }).addTo(map);
  } else {
    markerDevice.setLatLng(path[0]);
  }
  // Reset wasInsideZones
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

  // Check each zone for enter/exit
  zones.forEach((z, idx) => {
    const point = turf.point([lng, lat]);
    const isInside = turf.booleanPointInPolygon(point, z.turfPoly);
    
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
// 11) Icon Helpers for A (Red), B (Blue)
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

// -------------------------------------------
// 12) Random Color
// -------------------------------------------
function randomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i=0; i<6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}
