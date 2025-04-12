// server.js
const { Mesh } = require('meshjs');  // Use the named export
const meshConfig = require('./mesh.config.js');
const express = require('express');
const bodyParser = require('body-parser');

async function startMesh() {
  try {
    // Try to call a startup method if available
    if (typeof Mesh.start === 'function') {
      await Mesh.start(meshConfig);
      console.log('Mesh started with Hydra provider.');
    } else if (typeof Mesh.init === 'function') {
      await Mesh.init(meshConfig);
      console.log('Mesh initialized with Hydra provider.');
    } else {
      throw new Error('Mesh startup function not found. Check MeshJS documentation for the correct initialization method.');
    }

    const app = express();
    app.use(bodyParser.json());

    app.post('/locationUpdate', (req, res) => {
      const { vehicleId, lat, lng } = req.body;
      console.log(`Location update received for ${vehicleId}: [${lat}, ${lng}]`);
      Mesh.publish('locationUpdate', { vehicleId, lat, lng });
      res.json({ success: true });
    });

    const PORT = meshConfig.provider.options.servicePort || 3000;
    app.listen(PORT, () => {
      console.log(`Express server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to initialize Mesh:', err);
  }
}

startMesh();
