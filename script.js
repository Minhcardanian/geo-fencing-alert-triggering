// =================== HYDRA PROVIDER INTEGRATION ===================
import { HydraProvider } from "@meshsdk/hydra";

// Replace with your actual Hydra Head URL and port
const HYDRA_URL = "http://123.45.67.890:4001";
const hydraProvider = new HydraProvider(HYDRA_URL);

// Immediately connect and initialize the Hydra Head
(async () => {
  try {
    await hydraProvider.connect();
    await hydraProvider.init();
    console.log("Hydra Head connected and initialized.");
  } catch (error) {
    console.error("Hydra initialization error:", error);
  }
})();

// This function submits a dummy transaction via Hydra to simulate a location update.
// In production, build a valid CBOR transaction according to your requirements.
async function sendLocationUpdate(lat, lng) {
  try {
    const dummyCbor = "00"; // Dummy CBOR hex value, replace with a valid transaction in real usage.
    const description = `Location update for DemoVehicle1 at [${lat}, ${lng}]`;
    const result = await hydraProvider.newTx(dummyCbor, "Unwitnessed Tx ConwayEra", description);
    console.log("Location update submitted via Hydra:", result);
  } catch (error) {
    console.error("Error submitting transaction via Hydra:", error);
  }
}
// =================== END HYDRA PROVIDER INTEGRATION ===================


// =================== MAP SETUP & GEOSPATIAL CODE ===================
/*************************************************
  MAP SETUP & GLOBAL VARIABLES
**************************************************/
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
  removalMode: false
});

// Global variables for cluster polygon and its Turf conversion
let clusterPolygon = null;   // Leaflet polygon
let turfClusterPoly = null;  // Turf polygon

// Global clickMode controlling behavior for subsequent map clicks
let clickMode = "idle"; // "zone", "setAB", "setVehicleStart", "addDestination", etc.

/*************************************************
  DRAWING THE CLUSTER POLYGON (GEOMAN)
**************************************************/
map.on('pm:create', e => {
  if (e.layer && e.layer instanceof L.Polygon) {
    if (clusterPolygon) {
      map.removeLayer(clusterPolygon);
    }
    clusterPolygon = e.layer;
    // Disable further polygon drawing
    map.pm.disableDraw('Polygon');

    // Convert drawn polygon to Turf polygon
    let latlngs = clusterPolygon.getLatLngs()[0];
    while (Array.isArray(latlngs[0])) { latlngs = latlngs[0]; }
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

/*************************************************
  CIRCLE ZONES
**************************************************/
let zoneCount = 0;
const maxZones = 10;
const zones = [];         // Array of { circle, turfPoly }
let wasInsideZones = [];  // For simulation zone checks

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
  clickMode = "zone";
  logMessage(`Click inside cluster to place a circle zone (r = ${rVal}m).`);
});

/*************************************************
  POINTS A & B (SINGLE ROUTE)
**************************************************/
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

/*************************************************
  SINGLE ROUTE PATH & SIMULATION
**************************************************/
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
  const latDiff = (latB - latA) / (steps - 1);
  const lngDiff = (lngB - lngA) / (steps - 1);
  
  path = [];
  for (let i = 0; i < steps; i++) {
    path.push([latA + latDiff * i, lngA + lngDiff * i]);
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
  if (!markerDevice && path.length > 0) {
    markerDevice = L.marker(path[0], { icon: carEmojiIcon() }).addTo(map);
  } else if (markerDevice) {
    markerDevice.setLatLng(path[0]);
  }
  // Reset zone check status
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

  // --- HYDRA: Submit location update via Hydra Provider ---
  // Instead of sending a REST request, we use our Hydra integration.
  sendLocationUpdate(lat, lng);
  // --- END HYDRA SECTION ---

  // Check zones for single-route simulation
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

/*************************************************
  GLOBAL MAP CLICK HANDLER (for additional modes)
**************************************************/
map.on("click", e => {
  const { lat, lng } = e.latlng;
  // Always add a small grey marker for feedback
  L.circleMarker([lat, lng], { radius: 3, color: "grey", opacity: 0.7 }).addTo(map);
  
  // If in zone mode
  if (clickMode === "zone") {
    if (!insideCluster(lat, lng)) {
      logMessage("🛑 Click is outside the cluster polygon. Try again.");
      return;
    }
    const rVal = parseFloat(document.getElementById("zoneRadiusInput").value);
    const zoneColor = randomColor();
    const circle = L.circle([lat, lng], { radius: rVal, color: zoneColor }).addTo(map);
    zoneCount++;
    logMessage(`➕ Zone${zoneCount} created at [${lat.toFixed(5)}, ${lng.toFixed(5)}] with radius ${rVal}m.`);
    const turfPoly = turf.circle([lng, lat], rVal / 1000, { steps: 64, units: "kilometers" });
    zones.push({ circle, turfPoly });
    wasInsideZones.push(false);
    clickMode = "idle";
  }
  // If in setAB mode
  else if (clickMode === "setAB") {
    if (!insideCluster(lat, lng)) {
      logMessage("🛑 Must click inside cluster polygon.");
      return;
    }
    if (!pointA) {
      pointA = [lat, lng];
      if (markerA) map.removeLayer(markerA);
      markerA = L.marker(pointA, { icon: redIcon() }).addTo(map);
      logMessage(`Point A set at [${lat.toFixed(5)}, ${lng.toFixed(5)}].`);
    } else if (!pointB) {
      pointB = [lat, lng];
      if (markerB) map.removeLayer(markerB);
      markerB = L.marker(pointB, { icon: blueIcon() }).addTo(map);
      logMessage(`Point B set at [${lat.toFixed(5)}, ${lng.toFixed(5)}].`);
      clickMode = "idle";
    }
  }
});

/*************************************************
  HELPER: Check if point is inside cluster polygon
**************************************************/
function insideCluster(lat, lng) {
  if (!turfClusterPoly) return false;
  const pt = turf.point([lng, lat]);
  return turf.booleanPointInPolygon(pt, turfClusterPoly);
}

/*************************************************
  LOGGING FUNCTION
**************************************************/
function logMessage(msg) {
  const logPanel = document.getElementById("log");
  if (!logPanel) {
    console.warn("No element with ID='log' found. Logging to console:", msg);
    return;
  }
  const now = new Date().toLocaleTimeString();
  logPanel.innerHTML += `[${now}] ${msg}<br/>`;
  logPanel.scrollTop = logPanel.scrollHeight;
}

/*************************************************
  ICONS
**************************************************/
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

/*************************************************
  MISC. UTILS
**************************************************/
function randomColor() {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

/*************************************************
  MULTIPLE VEHICLES & ROUTES
**************************************************/
// Global array to hold vehicle objects
let vehicles = [];
// Current selected vehicle for editing
let currentVehicle = null;

const addVehicleBtn = document.getElementById("addVehicleBtn");
const setVehicleStartBtn = document.getElementById("setVehicleStartBtn");
const addDestinationBtn = document.getElementById("addDestinationBtn");
const genVehicleRouteBtn = document.getElementById("genVehicleRouteBtn");
const clearVehicleRouteBtn = document.getElementById("clearVehicleRouteBtn");
const currentVehicleDisplay = document.getElementById("currentVehicleDisplay");
const destinationsList = document.getElementById("destinationsList");

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
  destinationsList.innerHTML = "";
  logMessage(`New vehicle ${newVehicle.id} added. Set start and add destinations.`);
});

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
  logMessage(`Click inside cluster to set start point for ${currentVehicle.id}.`);
});

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
  logMessage(`Click inside cluster to add a destination for ${currentVehicle.id}.`);
});

genVehicleRouteBtn.addEventListener("click", () => {
  if (!currentVehicle || !currentVehicle.start || currentVehicle.destinations.length === 0) {
    logMessage("⚠️ Current vehicle does not have start or destinations set.");
    return;
  }
  currentVehicle.path = [];
  currentVehicle.currentIndex = 0;
  
  const pts = [currentVehicle.start, ...currentVehicle.destinations];
  const defaultSteps = 10;
  let totalPath = [];
  
  for (let i = 0; i < pts.length - 1; i++) {
    const [latA, lngA] = pts[i];
    const [latB, lngB] = pts[i + 1];
    const latDiff = (latB - latA) / (defaultSteps - 1);
    const lngDiff = (lngB - lngA) / (defaultSteps - 1);
    for (let j = 0; j < defaultSteps; j++) {
      totalPath.push([latA + latDiff * j, lngA + lngDiff * j]);
    }
  }
  currentVehicle.path = totalPath;
  logMessage(`${currentVehicle.id} route generated with ${currentVehicle.path.length} points.`);
});

clearVehicleRouteBtn.addEventListener("click", () => {
  if (currentVehicle) {
    currentVehicle.destinations = [];
    currentVehicle.path = [];
    currentVehicle.currentIndex = 0;
    destinationsList.innerHTML = "";
    logMessage(`${currentVehicle.id}'s route and destinations cleared.`);
  } else {
    logMessage("No vehicle selected.");
  }
});

// Initialize Sortable for destinations list
new Sortable(destinationsList, {
  animation: 150,
  onEnd: function(evt) {
    if (currentVehicle) {
      const lis = destinationsList.querySelectorAll("li");
      const newDests = [];
      lis.forEach(li => {
        const lat = parseFloat(li.getAttribute("data-lat"));
        const lng = parseFloat(li.getAttribute("data-lng"));
        newDests.push([lat, lng]);
      });
      currentVehicle.destinations = newDests;
      logMessage(`${currentVehicle.id} destinations reordered.`);
    }
  }
});

/*************************************************
  GLOBAL MAP CLICK HANDLER (for vehicle editing)
**************************************************/
map.on("click", e => {
  const { lat, lng } = e.latlng;
  L.circleMarker([lat, lng], { radius: 3, color: "grey", opacity: 0.7 }).addTo(map);
  
  if (clickMode === "setVehicleStart") {
    if (!insideCluster(lat, lng)) {
      logMessage("🛑 Click is outside the cluster. Try again.");
      return;
    }
    currentVehicle.start = [lat, lng];
    if (currentVehicle.marker) {
      currentVehicle.marker.setLatLng([lat, lng]);
    } else {
      currentVehicle.marker = L.marker([lat, lng], { icon: carEmojiIcon() }).addTo(map);
    }
    logMessage(`${currentVehicle.id} start set at [${lat.toFixed(5)}, ${lng.toFixed(5)}].`);
    clickMode = "idle";
  }
  else if (clickMode === "addDestination") {
    if (!insideCluster(lat, lng)) {
      logMessage("🛑 Click is outside the cluster. Try again.");
      return;
    }
    currentVehicle.destinations.push([lat, lng]);
    L.circleMarker([lat, lng], { radius: 4, color: "blue" }).addTo(map);
    const li = document.createElement("li");
    li.textContent = `(${lat.toFixed(5)}, ${lng.toFixed(5)})`;
    li.setAttribute("data-lat", lat);
    li.setAttribute("data-lng", lng);
    destinationsList.appendChild(li);
    logMessage(`Destination added for ${currentVehicle.id} at [${lat.toFixed(5)}, ${lng.toFixed(5)}].`);
    clickMode = "idle";
  }
});
