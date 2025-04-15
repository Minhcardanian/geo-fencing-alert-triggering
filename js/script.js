/*************************************************
  MAP SETUP & GLOBAL VARIABLES
**************************************************/

// Import the insideCluster function from geoFencing.js so it is defined for this module
import { insideCluster } from './geoFencing.js';

// Module-level variables (exported so that other modules can use them)
export let map;
export let clusterPolygon = null;   // Leaflet polygon for the cluster
export let turfClusterPoly = null;    // Turf.js polygon version of the cluster
export let clickMode = "idle";        // Controls behavior for subsequent map clicks 
                                    // ("zone", "setAB", "setVehicleStart", "addDestination", etc.)

// Variables for simulation and route handling (exported)
export let pointA = null;
export let pointB = null;
export let markerA = null;
export let markerB = null;
export let path = [];
export let zones = [];         // Array of zone objects: { circle, turfPoly }
export let wasInsideZones = [];  // For simulation zone checks
export let zoneCount = 0;
export const maxZones = 10;

/*************************************************
  Mutable Simulation State
  (Group simulationRunning, pathIndex, and markerDevice together)
**************************************************/
export const simulationState = {
  simulationRunning: false,
  pathIndex: 0,
  markerDevice: null
};

/*************************************************
  Initialization Function: initMap
**************************************************/
export function initMap() {
  // Initialize the map
  map = L.map('map').setView([10.762622, 106.660172], 16);
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
  
  // When a polygon is drawn, set it as the cluster polygon and convert it to a Turf.js polygon.
  map.on('pm:create', e => {
    if (e.layer && e.layer instanceof L.Polygon) {
      if (clusterPolygon) {
        map.removeLayer(clusterPolygon);
      }
      clusterPolygon = e.layer;
      // Disable further polygon drawing
      map.pm.disableDraw('Polygon');
  
      // Convert drawn polygon to Turf.js polygon
      let latlngs = clusterPolygon.getLatLngs()[0];
      while (Array.isArray(latlngs[0])) { 
        latlngs = latlngs[0]; 
      }
      const coords = latlngs.map(pt => [pt.lng, pt.lat]);
      // Close the polygon by pushing the first coordinate to the end
      coords.push([coords[0][0], coords[0][1]]);
      turfClusterPoly = turf.polygon([coords]);
      
      // Also assign to global for geo-fencing (if needed)
      window.turfClusterPoly = turfClusterPoly;
  
      logMessage("Cluster polygon drawn and saved.");
    }
  });
  
  // Event listener for clearing the cluster polygon
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
    CIRCLE ZONES & POINTS A/B (SINGLE ROUTE)
  **************************************************/
  
  // Event listener for adding a circle zone
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
  
  // Event listener for setting Points A & B for the single route
  document.getElementById("setABBtn").addEventListener("click", () => {
    if (!turfClusterPoly) {
      logMessage("⚠️ Cluster polygon not set. Draw it first.");
      return;
    }
    clickMode = "setAB";
    logMessage("Click 2 points inside the cluster: first for A (red), second for B (blue).");
  });
  
  /*************************************************
    SINGLE ROUTE PATH & SIMULATION CONTROLS
  **************************************************/
  
  // Event listener for generating a path between points A and B
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
    // Remove any existing marker to prevent leftover markers
    if (simulationState.markerDevice) {
      map.removeLayer(simulationState.markerDevice);
      simulationState.markerDevice = null;
    }
    if (path.length > 0) {
      simulationState.markerDevice = L.marker(path[0], { icon: carEmojiIcon() }).addTo(map);
    }
  });
  
  // Event listener for clearing the simulation path
  document.getElementById("clearPathBtn").addEventListener("click", clearPath);
  
  // Event listener for starting the simulation
  document.getElementById("startBtn").addEventListener("click", () => {
    if (simulationState.simulationRunning) {
      logMessage("Simulation already running.");
      return;
    }
    if (path.length < 2) {
      logMessage("⚠️ Need at least 2 points in path.");
      return;
    }
    simulationState.simulationRunning = true;
    simulationState.pathIndex = 0;
    // Remove any leftover marker
    if (simulationState.markerDevice) {
      map.removeLayer(simulationState.markerDevice);
      simulationState.markerDevice = null;
    }
    simulationState.markerDevice = L.marker(path[0], { icon: carEmojiIcon() }).addTo(map);
    // Reset zone flags
    for (let i = 0; i < wasInsideZones.length; i++) {
      wasInsideZones[i] = false;
    }
    logMessage("Simulation started.");
    moveDevice();
  });
  
  // Event listener for stopping the simulation
  document.getElementById("stopBtn").addEventListener("click", () => {
    if (!simulationState.simulationRunning) {
      logMessage("Simulation is not running.");
      return;
    }
    simulationState.simulationRunning = false;
    logMessage("Simulation stopped.");
  });
  
  /*************************************************
    GLOBAL MAP CLICK HANDLER (for additional modes)
  **************************************************/
  map.on("click", e => {
    const { lat, lng } = e.latlng;
    // Always add a small grey marker for feedback
    L.circleMarker([lat, lng], { radius: 3, color: "grey", opacity: 0.7 }).addTo(map);
    
    // If in zone mode: create a new zone with the given radius
    if (clickMode === "zone") {
      if (!insideCluster(lat, lng)) {
        logMessage("🛑 Click is outside the cluster polygon. Try again.");
        return;
      }
      const rVal = parseFloat(document.getElementById("zoneRadiusInput").value);
      const zoneColor = randomColor();
      L.circle([lat, lng], { radius: rVal, color: zoneColor }).addTo(map);
      zoneCount++;
      logMessage(`➕ Zone${zoneCount} created at [${lat.toFixed(5)}, ${lng.toFixed(5)}] with radius ${rVal}m.`);
      const turfPoly = turf.circle([lng, lat], rVal / 1000, { steps: 64, units: "kilometers" });
      zones.push({ circle: null, turfPoly });  // storing Turf polygon (the circle layer is already added)
      wasInsideZones.push(false);
      clickMode = "idle";
    }
    // If in setAB mode: set Points A and B
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
}

/*************************************************
  HELPER: clearPath
**************************************************/
function clearPath() {
  path = [];
  simulationState.pathIndex = 0;
  if (simulationState.markerDevice) {
    map.removeLayer(simulationState.markerDevice);
    simulationState.markerDevice = null;
  }
  logMessage("🧹 Path cleared.");
}

/*************************************************
  HELPER: moveDevice
**************************************************/
function moveDevice() {
  if (!simulationState.simulationRunning) return;
  if (simulationState.pathIndex >= path.length) {
    logMessage("End of simulation path reached.");
    simulationState.simulationRunning = false;
    return;
  }
  const [lat, lng] = path[simulationState.pathIndex++];
  simulationState.markerDevice.setLatLng([lat, lng]);
  
  // Check each zone for entry/exit events
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
  UTILITY FUNCTIONS (these could later be moved to utils.js)
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

function randomColor() {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}
