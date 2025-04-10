// -------------------------------------
// 1) Map Initialization
// -------------------------------------
const map = L.map('map').setView([10.762622, 106.660172], 16);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: 'Map data © <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
}).addTo(map);

// -------------------------------------
// 2) Data Structures
// -------------------------------------
let fences = [];         // Array of { name, center: [lat, lon], radius, circle, polygon }
let wasInsideFences = []; // Parallel array tracking device state per fence
let path = [];           // Array of [lat, lon] for movement
let simulationRunning = false;
let pathIndex = 0;
let marker = null; // We'll create it once the user adds the first path point or on start

// -------------------------------------
// 3) DOM Elements
// -------------------------------------
const logPanel = document.getElementById("log");

const zoneNameInput = document.getElementById("zoneName");
const zoneLatInput  = document.getElementById("zoneLat");
const zoneLonInput  = document.getElementById("zoneLon");
const zoneRadiusInput = document.getElementById("zoneRadius");
const addZoneBtn = document.getElementById("addZoneBtn");

const pathLatInput = document.getElementById("pathLat");
const pathLonInput = document.getElementById("pathLon");
const addPathBtn   = document.getElementById("addPathBtn");
const clearPathBtn = document.getElementById("clearPathBtn");

const startBtn = document.getElementById("startBtn");
const stopBtn  = document.getElementById("stopBtn");

// -------------------------------------
// 4) Log Utility
// -------------------------------------
function logMessage(message) {
  const now = new Date().toLocaleTimeString();
  logPanel.innerHTML += `[${now}] ${message}<br>`;
  logPanel.scrollTop = logPanel.scrollHeight;
}

// -------------------------------------
// 5) Add Zone Functionality
// -------------------------------------
function addZone() {
  const name = zoneNameInput.value.trim() || `Zone${fences.length+1}`;
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

  // Create turf polygon
  const polygon = turf.circle([lon, lat], radius / 1000, {
    steps: 64,
    units: 'kilometers'
  });

  // Store zone
  fences.push({
    name, center: [lat, lon], radius, circle, polygon
  });
  wasInsideFences.push(false);

  logMessage(`➕ Added zone "${name}" at [${lat}, ${lon}] radius ${radius}m`);
  
  // Clear inputs
  zoneNameInput.value = "";
  zoneLatInput.value  = "";
  zoneLonInput.value  = "";
  zoneRadiusInput.value = "";
}

// -------------------------------------
// 6) Add Path Functionality
// -------------------------------------
function addPathPoint() {
  const lat = parseFloat(pathLatInput.value);
  const lon = parseFloat(pathLonInput.value);

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    logMessage("⚠️ Invalid path point.");
    return;
  }

  path.push([lat, lon]);
  logMessage(`📍 Added path point [${lat}, ${lon}]. (Total: ${path.length})`);

  // If there's no marker yet, place one at the first point
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

// -------------------------------------
// 7) Simulation Controls
// -------------------------------------
function startSimulation() {
  if (simulationRunning) {
    logMessage("Simulation already running.");
    return;
  }
  if (path.length < 2) {
    logMessage("⚠️ Please add at least 2 points to create a path.");
    return;
  }
  simulationRunning = true;
  pathIndex = 0;

  // If marker doesn't exist, create it at the first path point
  if (!marker) {
    marker = L.marker(path[0]).addTo(map);
  } else {
    // Move marker to start
    marker.setLatLng(path[0]);
  }

  // Reset wasInsideFences
  for (let i = 0; i < wasInsideFences.length; i++) {
    wasInsideFences[i] = false;
  }
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

// -------------------------------------
// 8) simulateMove() Loop
// -------------------------------------
function simulateMove() {
  if (!simulationRunning) return;

  if (pathIndex >= path.length) {
    logMessage("End of simulation path reached.");
    simulationRunning = false;
    return;
  }

  // Move marker to next point
  const [lat, lon] = path[pathIndex++];
  marker.setLatLng([lat, lon]);

  // Check each fence for enter/exit
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

// -------------------------------------
// 9) Event Listeners
// -------------------------------------
addZoneBtn.addEventListener("click", addZone);
addPathBtn.addEventListener("click", addPathPoint);
clearPathBtn.addEventListener("click", clearPath);
startBtn.addEventListener("click", startSimulation);
stopBtn.addEventListener("click", stopSimulation);

// -------------------------------------
// Extra: Random Color Generator
// -------------------------------------
function randomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i=0; i<6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}
