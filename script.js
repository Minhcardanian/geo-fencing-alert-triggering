// ------------------------------------------
// 1) Map Initialization & Global Variables
// ------------------------------------------
const map = L.map('map').setView([10.762622, 106.660172], 16);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: 'Map data © OpenStreetMap contributors'
}).addTo(map);

let fences = [];            // Array of zone objects { name, center, radius, circle, polygon }
let wasInsideFences = [];   // Parallel array to track inside/outside state
let path = [];              // Array of [lat, lon] for movement
let marker = null;          // Marker for the simulated device
let simulationRunning = false;
let pathIndex = 0;

// We track the "mode" to know if user is clicking for zone center or path point
let pinpointMode = null; // "zone" or "path" or null

// ------------------------------------------
// 2) DOM References
// ------------------------------------------
const logPanel = document.getElementById("log");

const zoneNameInput   = document.getElementById("zoneName");
const zoneLatInput    = document.getElementById("zoneLat");
const zoneLonInput    = document.getElementById("zoneLon");
const zoneRadiusInput = document.getElementById("zoneRadius");
const addZoneBtn      = document.getElementById("addZoneBtn");
const pinZoneBtn      = document.getElementById("pinZoneBtn");
const randomZoneBtn   = document.getElementById("randomZoneBtn");

const pathLatInput    = document.getElementById("pathLat");
const pathLonInput    = document.getElementById("pathLon");
const addPathBtn      = document.getElementById("addPathBtn");
const pinPathBtn      = document.getElementById("pinPathBtn");
const clearPathBtn    = document.getElementById("clearPathBtn");

const startBtn = document.getElementById("startBtn");
const stopBtn  = document.getElementById("stopBtn");

// ------------------------------------------
// 3) Logging Helper
// ------------------------------------------
function logMessage(msg) {
  const now = new Date().toLocaleTimeString();
  logPanel.innerHTML += `[${now}] ${msg}<br>`;
  logPanel.scrollTop = logPanel.scrollHeight;
}

// ------------------------------------------
// 4) Creating or Updating Fences (Zones)
// ------------------------------------------
function addZone() {
  const name = zoneNameInput.value.trim() || `Zone${fences.length + 1}`;
  const lat  = parseFloat(zoneLatInput.value);
  const lon  = parseFloat(zoneLonInput.value);
  const radius = parseFloat(zoneRadiusInput.value);

  if (Number.isNaN(lat) || Number.isNaN(lon) || Number.isNaN(radius)) {
    logMessage("⚠️ Invalid zone parameters.");
    return;
  }

  // Draw circle on map
  const circle = L.circle([lat, lon], {
    radius: radius,
    color: randomColor()
  }).addTo(map);

  // Create turf polygon approximation
  const polygon = turf.circle([lon, lat], radius / 1000, {
    steps: 64,
    units: 'kilometers'
  });

  fences.push({ name, center: [lat, lon], radius, circle, polygon });
  wasInsideFences.push(false);

  logMessage(`➕ Added zone "${name}" at [${lat}, ${lon}], radius ${radius}m.`);
  // Clear inputs
  zoneNameInput.value = "";
  zoneLatInput.value  = "";
  zoneLonInput.value  = "";
  zoneRadiusInput.value = "";
}

// ------------------------------------------
// 5) Creating or Updating Path
// ------------------------------------------
function addPathPoint() {
  const lat = parseFloat(pathLatInput.value);
  const lon = parseFloat(pathLonInput.value);

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    logMessage("⚠️ Invalid path point.");
    return;
  }

  path.push([lat, lon]);
  logMessage(`📍 Added path point [${lat}, ${lon}]. (Total: ${path.length})`);

  // If marker doesn't exist, place one at the first point
  if (path.length === 1 && !marker) {
    marker = L.marker([lat, lon]).addTo(map);
  }

  pathLatInput.value = "";
  pathLonInput.value = "";
}

function clearPath() {
  path = [];
  logMessage("🧹 Path cleared.");
  if (marker) {
    map.removeLayer(marker);
    marker = null;
  }
}

// ------------------------------------------
// 6) Pinpoint On Map (Click Handlers)
// ------------------------------------------
pinZoneBtn.addEventListener("click", () => {
  pinpointMode = "zone";
  logMessage("🖱 Click on the map to set zone center...");
});

pinPathBtn.addEventListener("click", () => {
  pinpointMode = "path";
  logMessage("🖱 Click on the map to set path point...");
});

// Leaflet click event
map.on("click", (e) => {
  if (pinpointMode === "zone") {
    zoneLatInput.value = e.latlng.lat.toFixed(6);
    zoneLonInput.value = e.latlng.lng.toFixed(6);
    logMessage(`📍 Zone center pinned at [${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}].`);
    pinpointMode = null; // reset
  } else if (pinpointMode === "path") {
    pathLatInput.value = e.latlng.lat.toFixed(6);
    pathLonInput.value = e.latlng.lng.toFixed(6);
    logMessage(`📍 Path point pinned at [${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}].`);
    pinpointMode = null; // reset
  }
});

// ------------------------------------------
// 7) Random Zone Generator
// ------------------------------------------
randomZoneBtn.addEventListener("click", () => {
  const bounds = map.getBounds();
  // Get corners
  const southWest = bounds.getSouthWest(); // latlng
  const northEast = bounds.getNorthEast(); // latlng
  
  // Random lat/lon within current map bounds
  const lat = Math.random() * (northEast.lat - southWest.lat) + southWest.lat;
  const lon = Math.random() * (northEast.lng - southWest.lng) + southWest.lng;
  const radius = Math.floor(50 + Math.random() * 150); // random 50–200m

  zoneNameInput.value = `RandZone${fences.length+1}`;
  zoneLatInput.value = lat.toFixed(6);
  zoneLonInput.value = lon.toFixed(6);
  zoneRadiusInput.value = radius.toString();

  logMessage(`🎲 Random zone params -> [${lat.toFixed(6)}, ${lon.toFixed(6)}], radius: ${radius}m`);
});

// ------------------------------------------
// 8) Simulation Start/Stop
// ------------------------------------------
function startSimulation() {
  if (simulationRunning) {
    logMessage("Simulation already running.");
    return;
  }
  if (path.length < 2) {
    logMessage("⚠️ Please add at least 2 points for a path.");
    return;
  }
  simulationRunning = true;
  pathIndex = 0;

  // If marker doesn't exist, place it at the first path point
  if (!marker) {
    marker = L.marker(path[0]).addTo(map);
  } else {
    marker.setLatLng(path[0]);
  }

  // Reset fence states
  wasInsideFences = wasInsideFences.map(() => false);

  logMessage("Simulation started.");
  simulateMove();
}

function stopSimulation() {
  if (!simulationRunning) {
    logMessage("Simulation is not running.");
    return;
  }
  simulationRunning = false;
  logMessage("Simulation stopped.");
}

function simulateMove() {
  if (!simulationRunning) return;

  if (pathIndex >= path.length) {
    logMessage("End of simulation path reached.");
    simulationRunning = false;
    return;
  }

  const [lat, lon] = path[pathIndex++];
  marker.setLatLng([lat, lon]);

  // Check each fence
  fences.forEach((fence, fenceIndex) => {
    const point = turf.point([lon, lat]);
    const isInside = turf.booleanPointInPolygon(point, fence.polygon);

    if (isInside && !wasInsideFences[fenceIndex]) {
      logMessage(`🚨 ENTERED ${fence.name}`);
    }
    if (!isInside && wasInsideFences[fenceIndex]) {
      logMessage(`⚠️ EXITED ${fence.name}`);
    }

    wasInsideFences[fenceIndex] = isInside;
  });

  setTimeout(simulateMove, 1500);
}

// ------------------------------------------
// 9) Event Listeners
// ------------------------------------------
addZoneBtn.addEventListener("click", addZone);
addPathBtn.addEventListener("click", addPathPoint);
clearPathBtn.addEventListener("click", clearPath);

startBtn.addEventListener("click", startSimulation);
stopBtn.addEventListener("click", stopSimulation);

// ------------------------------------------
// Extra: Random Color
// ------------------------------------------
function randomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}
