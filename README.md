# Geo-Fencing & Multi-Vehicle Route Simulation Demo

This project provides a **Leaflet.js + Turf.js** powered demo for geofencing and simulating multiple vehicle routes within a custom-defined polygonal area. Built with simplicity in mind, the interface enables both single-route and multi-vehicle path simulations over a cluster area defined freely by the user.

## 🌍 Features

### 1. Cluster Drawing
- Use **Leaflet-Geoman** tools to draw a freeform polygon (the "cluster area") on the map.
- Internally converted to a **Turf.js polygon** for geospatial operations.

### 2. Circle Zone Placement
- Add up to 10 **geofence zones** (circular areas) within the drawn cluster.
- Radius is configurable in meters.
- Alerts are logged when a moving point enters/exits any zone.

### 3. Point-to-Point Route (A → B)
- Click to set **Point A** (red marker) and **Point B** (blue marker).
- Generate interpolated path in a set number of steps.
- Simulate movement of a car icon along this route with zone entry/exit detection.

### 4. Multi-Vehicle Simulation
- Add any number of vehicles.
- Set start points and multiple destinations.
- Supports drag-to-reorder for destination lists (via **Sortable.js**).
- Generates a path and allows individual simulation control.

## 🔧 Technologies Used
- [Leaflet.js](https://leafletjs.com) – Map rendering and interaction
- [Leaflet-Geoman](https://geoman.io/leaflet-geoman) – Freeform shape drawing
- [Turf.js](https://turfjs.org) – Geospatial calculations (polygon checks, circle creation, etc.)
- [Sortable.js](https://sortablejs.github.io/Sortable/) – Drag-and-drop list management

## 🚀 How to Use
1. **Draw a Cluster** using the polygon tool in the top-left corner.
2. **Add Zones**: Input a radius and click inside the cluster.
3. **Set A & B**: Click "Set A & B" and choose two points inside the cluster.
4. **Generate Path**: Choose number of steps and simulate the movement.
5. **Add Vehicles**: Use buttons to add new vehicles and assign routes.

## 📁 File Structure
- `index.html` – Contains map UI layout and controls.
- `script.js` – Full logic including map setup, zone logic, routing, and simulation.
- `README.md` – This documentation.

## 📸 Screenshots
*(Add screenshots of drawn cluster, zones, and a running simulation here if desired)*

## 💡 Demo Use Case
Ideal for:
- Indoor or outdoor **asset tracking** simulations
- Basic **geofencing behavior** visualization
- Education on spatial logic using JavaScript libraries

---

**Author**: [Minhcadarnian](mailto:markbuicadarnian@gmail.com)

**License**: MIT

