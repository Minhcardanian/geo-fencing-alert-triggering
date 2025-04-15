// geoFencing.js
// Module: Geo-Fencing Helpers

/**
 * Determines if the given latitude and longitude falls within the current
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
  