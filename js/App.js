// App.js
// Main entry point for the Geo-Fencing Alert Triggering application

// Import the necessary modules from the js folder
import { initMap } from './script.js';         // Map setup and global event hookups
import { setupGeoFencing } from './geoFencing.js';   // Geo-fencing helper(s) and related setup
import * as utils from './utils.js';               // Utility functions

// Initialize the application
function initApp() {
  // Initialize the map and core functionality (e.g., Geoman controls)
  initMap();
  
  // Setup geo-fencing utilities (e.g., insideCluster helper, listeners, etc.)
  setupGeoFencing();
  
  // Setup simulation event listeners and logic
  setupSimulation();
  
  // Log a confirmation
  utils.logMessage("Application initialized successfully.");
}

// Call the initialization routine
initApp();
