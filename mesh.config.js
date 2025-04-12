// mesh.config.js
module.exports = {
    provider: {
      type: 'hydra',
      options: {
        serviceName: 'geo-fence-service', // A descriptive name for your service
        serviceIP: '',                    // Leave blank to let Mesh auto-detect
        servicePort: 3000,                // Or any free port you choose
        redis: {
          url: 'redis://127.0.0.1:6379/0'   // Adjust if you’re using a different Redis instance
        }
      }
    }
  };
  