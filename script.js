// -------------------------------------------
// 1) MAP SETUP & GLOBAL VARIABLES
// -------------------------------------------
const map = L.map('map').setView([10.762622, 106.660172], 16);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: 'Map data © OpenStreetMap contributors'
}).addTo(map);

// Initialize Geoman controls (for drawing the cluster polygon)
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

// ----- Cluster Polygon (Freeform via Geoman) -----
let clusterPolygon = null;    // Leaflet polygon for the cluster area
let turfClusterPoly = null;   // Turf polygon for check
// Listen for the drawing complete event
map.on('pm:create', e => {
  if (e.layer && e.layer instanceof L.Polygon) {
    if (clusterPolygon) {
      map.removeLayer(clusterPolygon);
    }
    clusterPolygon = e.layer;
    // Disable drawing after creation
    map.pm.disableDraw('Polygon');
    // Convert polygon to turf format
    const latlngs = clusterPolygon.getLatLngs()[0];
    const coords = latlngs.map(pt => [pt.lng, pt.lat]);
    coords.push([coords[0][0], coords[0][1]]);
    turfClusterPoly = turf.polygon([coords]);
    logMessage("Cluster polygon drawn and saved.");
  }
});
document.getElementById("clearClusterBtn").addEventListener("click", () => {
  if (clusterPolygon) {
    map.removeLayer(clusterPolygon);
    clusterPolygon = null;
    turfClusterPoly = null;
    logMessage("Cluster polygon cleared.");
  } else {
    logMessage("No cluster polygon to clear.");
  }
});

// ----- Circle Zones -----
let zoneCount = 0;
const maxZones = 10;
const zones = [];         // array of { circle, turfPoly }
let wasInsideZones = [];  // for simulation zone check

document.getElementById("addZoneBtn").addEventListener("click", () => {
  if (!turfClusterPoly) {
    logMessage("⚠️ Cluster polygon not set. Draw it first using Geoman.");
    return;
  }
  if (zoneCount >= maxZones) {
    logMessage("⚠️ Already reached the maximum number of zones.");
    return;
  }
  const rVal = parseFloat(document.getElementById("zoneRadiusInput").value);
  if (Number.isNaN(rVal) || rVal <= 0) {
    logMessage("⚠️ Invalid radius value.");
    return;
  }
  // Set mode to add zone; next click will place zone center.
  clickMode = "zone";
  logMessage(`Click inside cluster to place a circle zone (r = ${rVal}m).`);
});

// ----- Points A & B (Single Route Simulation) -----
let pointA = null;
let pointB = null;
let markerA = null;
let markerB = null;

document.getElementById("setABBtn").addEventListener("click", () => {
  if (!turfClusterPoly) {
    logMessage("⚠️ Cluster polygon not set. Draw it first.");
    return;
  }
  clickMode = "setAB";
  logMessage("Click 2 points inside the cluster: first for A (red), second for B (blue).");
});

// ----- Single Route Path & Simulation (For one route) -----
let path = [];
let markerDevice = null;
let pathIndex = 0;
let simulationRunning = false;

document.getElementById("genPathBtn").addEventListener("click", () => {
  if (!pointA || !pointB) {
    logMessage("⚠️ Points A and B are not set.");
    return;
  }
  clearPath();
  let steps = parseInt(document.getElementById("numStepsInput").value, 10);
  if (Number.isNaN(steps) || steps < 2) steps = 10;
  const [latA, lngA] = pointA;
  const [latB, lngB] = pointB;
  const dLat = (latB - latA) / (steps - 1);
  const dLng = (lngB - lngA) / (steps - 1);
  for (let i = 0; i < steps; i++) {
    path.push([latA + dLat * i, lngA + dLng * i]);
  }
  logMessage(`🔄 Generated path with ${steps} steps (size: ${path.length}).`);
  if (!markerDevice && path.length > 0) {
    markerDevice = L.marker(path[0], { icon: carEmojiIcon() }).addTo(map);
  } else if (markerDevice) {
    markerDevice.setLatLng(path[0]);
  }
});
document.getElementById("clearPathBtn").addEventListener("click", clearPath);
function clearPath() {
  path = [];
  pathIndex = 0;
  if (markerDevice) {
    map.removeLayer(markerDevice);
    markerDevice = null;
  }
  logMessage("🧹 Path cleared.");
}

document.getElementById("startBtn").addEventListener("click", () => {
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
  for (let i = 0; i < wasInsideZones.length; i++) {
    wasInsideZones[i] = false;
  }
  logMessage("Simulation started.");
  moveDevice();
});
document.getElementById("stopBtn").addEventListener("click", () => {
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

// ----- Utility: Always place a small grey marker for every map click -----
let clickMode = "idle"; // global mode for additional functions (zone, setAB, etc.)

// Map click event (for additional tasks)
map.on("click", e => {
  const { lat, lng } = e.latlng;
  L.circleMarker(e.latlng, { radius: 3, color: "grey", opacity: 0.7 }).addTo(map);

  // Handle modes: zone or setAB are processed in the above separate map.on events.
  // The Geoman drawing process for cluster is handled by pm:create.
});

// ----- ICONS: A (Red), B (Blue), Car Emoji -----
function redIcon() {
  return L.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
}
function blueIcon() {
  return L.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
}
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

// ----- MULTIPLE VEHICLES & ROUTES -----
// Global array to hold vehicle objects
let vehicles = [];
// Current selected vehicle for editing
let currentVehicle = null;

// UI Elements for multiple vehicles (new section)
const addVehicleBtn = document.getElementById("addVehicleBtn");
const setVehicleStartBtn = document.getElementById("setVehicleStartBtn");
const addDestinationBtn = document.getElementById("addDestinationBtn");
const genVehicleRouteBtn = document.getElementById("genVehicleRouteBtn");
const clearVehicleRouteBtn = document.getElementById("clearVehicleRouteBtn");
const currentVehicleDisplay = document.getElementById("currentVehicleDisplay");

// Create a new vehicle object and set it as current
addVehicleBtn.addEventListener("click", () => {
  const newVehicle = {
    id: `Vehicle${vehicles.length + 1}`,
    marker: null,
    start: null,
    destinations: [],
    path: [],
    currentIndex: 0,
    speed: 1200
  };
  vehicles.push(newVehicle);
  currentVehicle = newVehicle;
  currentVehicleDisplay.textContent = newVehicle.id;
  logMessage(`New vehicle ${newVehicle.id} added. Set start and add destinations.`);
});

// Set vehicle start point: next click inside cluster
setVehicleStartBtn.addEventListener("click", () => {
  if (!currentVehicle) {
    logMessage("⚠️ No vehicle selected. Click 'Add Vehicle' first.");
    return;
  }
  if (!turfClusterPoly) {
    logMessage("⚠️ Cluster polygon not set.");
    return;
  }
  clickMode = "setVehicleStart";
  logMessage(`Click inside the cluster to set start point for ${currentVehicle.id}.`);
});

// Add a destination to current vehicle: next click inside cluster
addDestinationBtn.addEventListener("click", () => {
  if (!currentVehicle) {
    logMessage("⚠️ No vehicle selected. Click 'Add Vehicle' first.");
    return;
  }
  if (!turfClusterPoly) {
    logMessage("⚠️ Cluster polygon not set.");
    return;
  }
  clickMode = "addDestination";
  logMessage(`Click inside the cluster to add a destination for ${currentVehicle.id}.`);
});

// Map click handler for vehicle editing (extend existing map click)
map.on("click", e => {
  const { lat, lng } = e.latlng;
  
  // If mode is setVehicleStart
  if (clickMode === "setVehicleStart") {
    if (!insideCluster(lat, lng)) {
      logMessage("🛑 Click is outside cluster. Try again.");
      return;
    }
    currentVehicle.start = [lat, lng];
    // Place or update vehicle marker (using car emoji icon)
    if (currentVehicle.marker) {
      currentVehicle.marker.setLatLng([lat, lng]);
    } else {
      currentVehicle.marker = L.marker([lat, lng], { icon: carEmojiIcon() }).addTo(map);
    }
    logMessage(`${currentVehicle.id} start set at [${lat.toFixed(5)}, ${lng.toFixed(5)}].`);
    clickMode = "idle";
  }
  
  // If mode is addDestination
  else if (clickMode === "addDestination") {
    if (!insideCluster(lat, lng)) {
      logMessage("🛑 Click is outside cluster. Try again.");
      return;
    }
    currentVehicle.destinations.push([lat, lng]);
    // Optionally add a small blue marker for a destination
    L.circleMarker([lat, lng], { radius: 4, color: 'blue' }).addTo(map);
    logMessage(`Destination added for ${currentVehicle.id} at [${lat.toFixed(5)}, ${lng.toFixed(5)}].`);
    clickMode = "idle";
  }
});

// Generate a complete route for the current vehicle by interpolating between start and all destinations
genVehicleRouteBtn.addEventListener("click", () => {
  if (!currentVehicle || !currentVehicle.start || currentVehicle.destinations.length === 0) {
    logMessage("⚠️ Current vehicle does not have start or destinations set.");
    return;
  }
  // Clear any previous route
  currentVehicle.path = [];
  currentVehicle.currentIndex = 0;
  
  const points = [currentVehicle.start, ...currentVehicle.destinations];
  
  // For simplicity, interpolate a set number of steps between each pair
  let totalPath = [];
  const defaultSteps = 10;
  
  for (let i = 0; i < points.length - 1; i++) {
    const [latA, lngA] = points[i];
    const [latB, lngB] = points[i + 1];
    const dLat = (latB - latA) / (defaultSteps - 1);
    const dLng = (lngB - lngA) / (defaultSteps - 1);
    for (let j = 0; j < defaultSteps; j++) {
      totalPath.push([latA + dLat * j, lngA + dLng * j]);
    }
  }
  currentVehicle.path = totalPath;
  logMessage(`${currentVehicle.id} route generated with ${currentVehicle.path.length} points.`);
});
// Clear current vehicle’s route/destinations
clearVehicleRouteBtn.addEventListener("click", () => {
  if (currentVehicle) {
    currentVehicle.destinations = [];
    currentVehicle.path = [];
    currentVehicle.currentIndex = 0;
    logMessage(`${currentVehicle.id}'s route and destinations cleared.`);
  } else {
    logMessage("No vehicle selected.");
  }
});

// ----- Multiple Vehicles Simulation -----
// Global simulation loop for vehicles
function simulateVehicles() {
  vehicles.forEach(vehicle => {
    if (vehicle.path.length > 0 && vehicle.currentIndex < vehicle.path.length) {
      // Move the vehicle marker along its path
      vehicle.marker.setLatLng(vehicle.path[vehicle.currentIndex]);
      vehicle.currentIndex++;
      // Optionally, zone checks could be done here for each vehicle using turf.booleanPointInPolygon
      // e.g., checkZonesForVehicle(vehicle)
    }
  });
  // Continue simulation if at least one vehicle is still moving
  if (vehicles.some(v => v.currentIndex < v.path.length)) {
    setTimeout(simulateVehicles, 1200);
  } else {
    logMessage("All vehicles have reached the end of their routes.");
  }
}

// Start the simulation for vehicles (separate from the single-route simulation)
function startVehiclesSimulation() {
  if (vehicles.length === 0) {
    logMessage("No vehicles to simulate.");
    return;
  }
  logMessage("Multiple vehicles simulation started.");
  simulateVehicles();
}

// Optionally, add a global button (or reuse existing simulation buttons) to start vehicles simulation.
// For this update, we assume the user will call startVehiclesSimulation() from the browser console or add an extra button.

// ----- ICONS (reuse redIcon, blueIcon, carEmojiIcon functions from earlier) -----
function redIcon() {
  return L.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
}
function blueIcon() {
  return L.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
}
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

// ----- UTILS -----
function randomColor() {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

// ----- For single-route simulation, we reuse the earlier simulation functions.
// (They coexist with the multiple vehicles simulation.)
