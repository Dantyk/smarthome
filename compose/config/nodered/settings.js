const path = require('path');

let settingsExported = false;

module.exports = {
  flowFile: "flows.json",
  credentialSecret: process.env.NR_CRED_SECRET || "change-me",
  contextStorage: { default: { module: "localfilesystem" } },
  editorTheme: {
    tours: false,
    page: {
      title: "SmartHome Node-RED"
    }
  },
  
  // Hook to initialize custom libraries after Node-RED starts
  httpNodeMiddleware: function(req, res, next) {
    // Call init.js only once when Node-RED is ready
    if (!settingsExported && global.RED) {
      settingsExported = true;
      try {
        const initFunc = require('/data/lib/init.js');
        initFunc(global.RED);
      } catch (err) {
        console.error('Failed to load init.js:', err);
      }
    }
    next();
  }
}
