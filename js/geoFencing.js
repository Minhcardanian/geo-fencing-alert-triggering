// geoFencing.js
// Module: Geo-Fencing Helpers

/**
 * Initializes geo-fencing functionality.
 * This function can be expanded to include additional setup such as binding event listeners
 * or pre-processing any geo data required by your application.
 */
export function setupGeoFencing() {
  console.log("Geo-fencing module initialized.");
  // Additional geo-fencing setup logic can be added here.
}

/**
 * Determines if the given latitude and longitude fall within the current
 * cluster polygon converted by Turf.js.
 *
 * This function expects that your main script (script.js) assigns the current
 * Turf.js polygon to window.turfClusterPoly.
 *
 * @param {number} lat - The latitude coordinate.
 * @param {number} lng - The longitude coordinate.
 * @returns {boolean} True if the point is inside the cluster polygon; false otherwise.
 */
export function insideCluster(lat, lng) {
  // Attempt to retrieve the current Turf polygon from the global window object.
  const clusterPoly = window.turfClusterPoly;
  if (!clusterPoly) return false;
  
  // Create a Turf point for the given coordinates.
  const pt = turf.point([lng, lat]);
  
  // Use Turf.js to determine if the point lies within the cluster polygon.
  return turf.booleanPointInPolygon(pt, clusterPoly);
}
