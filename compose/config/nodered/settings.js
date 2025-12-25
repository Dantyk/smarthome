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
  
  // Enable function external modules
  functionExternalModules: true
}

