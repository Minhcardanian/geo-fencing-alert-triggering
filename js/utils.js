// utils.js
// Utility functions for logging, icon creation, and color generation

/**
 * Logs a message to the element with ID "log". If that element is not found,
 * logs to the console instead.
 * @param {string} msg - The message to display.
 */
export function logMessage(msg) {
    const logPanel = document.getElementById("log");
    if (!logPanel) {
      console.warn("No element with ID='log' found. Logging to console:", msg);
      return;
    }
    const now = new Date().toLocaleTimeString();
    logPanel.innerHTML += `[${now}] ${msg}<br/>`;
    logPanel.scrollTop = logPanel.scrollHeight;
  }
  
  /**
   * Returns a Leaflet icon with a red marker.
   * @returns {L.Icon} - The red marker icon.
   */
  export function redIcon() {
    return L.icon({
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
  }
  
  /**
   * Returns a Leaflet icon with a blue marker.
   * @returns {L.Icon} - The blue marker icon.
   */
  export function blueIcon() {
    return L.icon({
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
  }
  
  /**
   * Returns a Leaflet icon created from an inline SVG with a car emoji.
   * @returns {L.Icon} - The car emoji icon.
   */
  export function carEmojiIcon() {
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
  
  /**
   * Generates a random hexadecimal color string.
   * @returns {string} A random color in the format "#RRGGBB".
   */
  export function randomColor() {
    const letters = "0123456789ABCDEF";
    let color = "#";
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }
  