// simulation.js
// Module: Simulation Logic and Event Listeners

// Import shared globals from script.js.
// (These variables must be exported from script.js.)
import { pointA, pointB, map, markerDevice, path, pathIndex, simulationRunning, zones, wasInsideZones } from './script.js';
// Import utility functions from utils.js.
import { logMessage, carEmojiIcon } from './utils.js';

/**
 * Attaches event listeners for simulation controls (path generation, start/stop simulation)
 * to the corresponding DOM elements.
 */
export function setupSimulation() {
  document.getElementById("genPathBtn").addEventListener("click", generatePath);
  document.getElementById("clearPathBtn").addEventListener("click", clearPath);
  document.getElementById("startBtn").addEventListener("click", startSimulation);
  document.getElementById("stopBtn").addEventListener("click", stopSimulation);
}

/**
 * Generates the simulation path between points A and B.
 */
function generatePath() {
  if (!pointA || !pointB) {
    logMessage("⚠️ Points A and B are not set.");
    return;
  }
  clearPath(); // Reset any existing simulation path
  let steps = parseInt(document.getElementById("numStepsInput").value, 10);
  if (Number.isNaN(steps) || steps < 2) steps = 10;
  
  const [latA, lngA] = pointA;
  const [latB, lngB] = pointB;
  const latDiff = (latB - latA) / (steps - 1);
  const lngDiff = (lngB - lngA) / (steps - 1);
  
  // Reset the global path array and fill with computed coordinates.
  path.length = 0;
  for (let i = 0; i < steps; i++) {
    path.push([latA + latDiff * i, lngA + lngDiff * i]);
  }
  
  logMessage(`🔄 Generated path with ${steps} steps (size: ${path.length}).`);
  if (!markerDevice && path.length > 0) {
    markerDevice = L.marker(path[0], { icon: carEmojiIcon() }).addTo(map);
  } else if (markerDevice) {
    markerDevice.setLatLng(path[0]);
  }
}

/**
 * Clears the simulation path and removes the simulation marker.
 */
export function clearPath() {
  path.length = 0;
  // Reset the path index
  pathIndex = 0;
  if (markerDevice) {
    map.removeLayer(markerDevice);
    markerDevice = null;
  }
  logMessage("🧹 Path cleared.");
}

/**
 * Starts the simulation by resetting necessary indices, placing the marker, and beginning the movement loop.
 */
function startSimulation() {
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
  // Reset zone flag array
  for (let i = 0; i < wasInsideZones.length; i++) {
    wasInsideZones[i] = false;
  }
  logMessage("Simulation started.");
  moveDevice();
}

/**
 * Stops the simulation.
 */
function stopSimulation() {
  if (!simulationRunning) {
    logMessage("Simulation is not running.");
    return;
  }
  simulationRunning = false;
  logMessage("Simulation stopped.");
}

/**
 * Recursively moves the simulation marker along the generated path while checking for zone entry/exit.
 */
function moveDevice() {
  if (!simulationRunning) return;
  if (pathIndex >= path.length) {
    logMessage("End of simulation path reached.");
    simulationRunning = false;
    return;
  }
  const [lat, lng] = path[pathIndex++];
  markerDevice.setLatLng([lat, lng]);
  
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
  
  setTimeout(moveDevice, 1200); // Adjust timing as needed
}

// Optionally, if needed externally, you can export moveDevice
export { moveDevice };
