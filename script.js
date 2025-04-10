/*************************************************
  MAP SETUP & GLOBALS
**************************************************/
const map = L.map('map').setView([10.762622, 106.660172], 16);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: 'Map data © OpenStreetMap contributors'
}).addTo(map);

// Geoman controls (draw polygon for cluster)
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

// Global variables for cluster polygon
let clusterPolygon = null;   // Leaflet polygon
let turfClusterPoly = null;  // Turf polygon

/*************************************************
  DRAWING THE CLUSTER POLYGON (GEOMAN)
**************************************************/
map.on('pm:create', e => {
  // If a polygon was just drawn
  if (e.layer && e.layer instanceof L.Polygon) {
    // Remove old cluster if any
    if (clusterPolygon) {
      map.removeLayer(clusterPolygon);
    }
    clusterPolygon = e.layer;
    // Optionally disable further polygon drawing
    map.pm.disableDraw('Polygon');

    // Convert Leaflet polygon => Turf polygon
    // Flatten coordinates if nested
    let latlngs = clusterPolygon.getLatLngs()[0];
    while (Array.isArray(latlngs[0])) {
      latlngs = latlngs[0];
    }
    const coords = latlngs.map(pt => [pt.lng, pt.lat]);
    // Close ring
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
const zones = [];         // array of { circle, turfPoly }
let wasInsideZones = [];  // for zone simulation checks

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
  // Next click sets zone center
  clickMode = "zone";
  logMessage(`Click inside cluster to place a circle zone (r = ${rVal}m).`);
});

/*************************************************
  A & B POINTS (SINGLE ROUTE)
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
  const dLat = (lngB - lngA) / (steps - 1);
  const dLon = (latB - latA) / (steps - 1);

  // Correction: Typically lat = y, lng = x
  // So let's do a straightforward approach:
  //   lat + step, lng + step
  path = [];
  const latDiff = (latB - latA) / (steps - 1);
  const lngDiff = (lngB - lngA) / (steps - 1);
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

  // Reset zone states
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

  // Zone checks
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
  MAP CLICK LOGIC + GLOBAL clickMode
**************************************************/
let clickMode = "idle"; // "zone", "setAB", etc.

// On EVERY map click: place a small grey marker + handle modes
map.on("click", e => {
  const { lat, lng } = e.latlng;

  // Always place a small grey circle marker for user feedback
  L.circleMarker([lat, lng], { radius: 3, color: 'grey', opacity: 0.7 }).addTo(map);

  if (clickMode === "zone") {
    if (!insideCluster(lat, lng)) {
      logMessage("🛑 Click is outside the cluster polygon. Try again.");
      return;
    }
    // Add the zone circle
    const rVal = parseFloat(document.getElementById("zoneRadiusInput").value);
    const color = randomColor();
    const circle = L.circle([lat, lng], { radius: rVal, color }).addTo(map);
    zoneCount++;
    logMessage(`➕ Zone${zoneCount} center=[${lat.toFixed(5)}, ${lng.toFixed(5)}], r=${rVal}m`);

    // Convert circle => turf circle for checks
    const turfPoly = turf.circle([lng, lat], rVal / 1000, {
      steps: 64,
      units: 'kilometers'
    });
    zones.push({ circle, turfPoly });
    wasInsideZones.push(false);

    clickMode = "idle";
  }

  else if (clickMode === "setAB") {
    // Must be inside cluster
    if (!insideCluster(lat, lng)) {
      logMessage("🛑 Must click inside cluster polygon.");
      return;
    }
    // If pointA is not set, this click is for A
    if (!pointA) {
      pointA = [lat, lng];
      if (markerA) map.removeLayer(markerA);
      markerA = L.marker(pointA, { icon: redIcon() }).addTo(map);
      logMessage(`Point A set at [${lat.toFixed(5)}, ${lng.toFixed(5)}].`);
    }
    // Else set B
    else if (!pointB) {
      pointB = [lat, lng];
      if (markerB) map.removeLayer(markerB);
      markerB = L.marker(pointB, { icon: blueIcon() }).addTo(map);
      logMessage(`Point B set at [${lat.toFixed(5)}, ${lng.toFixed(5)}].`);
      clickMode = "idle";
    }
  }
});

/*************************************************
  Helper: Check if lat/lng is inside cluster
**************************************************/
function insideCluster(lat, lng) {
  if (!turfClusterPoly) return false;
  const pt = turf.point([lng, lat]);
  return turf.booleanPointInPolygon(pt, turfClusterPoly);
}

/*************************************************
  Logging Function
**************************************************/
function logMessage(msg) {
  const logPanel = document.getElementById("log");
  if (!logPanel) {
    console.warn("No element with ID='log' found in HTML. Logging to console instead:");
    console.warn(msg);
    return;
  }
  const now = new Date().toLocaleTimeString();
  logPanel.innerHTML += `[${now}] ${msg}<br/>`;
  logPanel.scrollTop = logPanel.scrollHeight;
}

/*************************************************
  Icons
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
  Misc. Utils
**************************************************/
function randomColor() {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}
