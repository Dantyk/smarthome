/**
 * Config Hot Reload - File Watcher pre modes.yaml
 * 
 * Automaticky reloaduje konfiguráciu pri zmene modes.yaml
 * bez nutnosti reštartu Node-RED.
 */

const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const Ajv = require('ajv');
const logger = require('./logger');

class ConfigWatcher {
  constructor(configPath, schemaPath, onReload) {
    this.configPath = configPath;
    this.schemaPath = schemaPath;
    this.onReload = onReload;
    this.watcher = null;
    this.currentConfig = null;
    this.reloadTimeout = null;
    this.reloadDelay = 1000; // Debounce: 1s delay
    
    // Load schema
    this.schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    this.ajv = new Ajv({ allErrors: true });
    this.validate = this.ajv.compile(this.schema);
  }
  
  /**
   * Start watching config file
   */
  start() {
    // Load initial config
    this.currentConfig = this.loadConfig();
    
    logger.info('Config watcher started', { 
      configPath: this.configPath,
      schemaPath: this.schemaPath
    });
    
    // Watch for changes
    this.watcher = chokidar.watch(this.configPath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
      }
    });
    
    this.watcher.on('change', (path) => {
      logger.info('Config file changed, scheduling reload', { path });
      this.scheduleReload();
    });
    
    this.watcher.on('error', (error) => {
      logger.error('Config watcher error', { 
        error: error.message,
        stack: error.stack
      });
    });
    
    return this.currentConfig;
  }
  
  /**
   * Stop watching
   */
  stop() {
    if (this.watcher) {
      this.watcher.close();
      logger.info('Config watcher stopped');
    }
  }
  
  /**
   * Schedule reload with debounce
   */
  scheduleReload() {
    if (this.reloadTimeout) {
      clearTimeout(this.reloadTimeout);
    }
    
    this.reloadTimeout = setTimeout(() => {
      this.reload();
    }, this.reloadDelay);
  }
  
  /**
   * Reload configuration
   */
  reload() {
    try {
      logger.info('Reloading configuration...');
      
      // Load new config
      const newConfig = this.loadConfig();
      
      // Validate
      if (!this.validateConfig(newConfig)) {
        logger.error('Config reload failed: validation error');
        return false;
      }
      
      // Check for breaking changes
      const changes = this.detectChanges(this.currentConfig, newConfig);
      logger.info('Config changes detected', changes);
      
      // Update current config
      const oldConfig = this.currentConfig;
      this.currentConfig = newConfig;
      
      // Notify listeners
      if (this.onReload) {
        this.onReload(newConfig, oldConfig, changes);
      }
      
      logger.info('Configuration reloaded successfully', {
        modes: newConfig.modes?.length || 0,
        changes: changes.summary
      });
      
      return true;
    } catch (err) {
      logger.error('Config reload failed', {
        error: err.message,
        stack: err.stack
      });
      return false;
    }
  }
  
  /**
   * Load config from file
   */
  loadConfig() {
    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      const config = yaml.load(content);
      return config;
    } catch (err) {
      logger.error('Failed to load config', {
        path: this.configPath,
        error: err.message
      });
      throw err;
    }
  }
  
  /**
   * Validate config against schema
   */
  validateConfig(config) {
    const valid = this.validate(config);
    
    if (!valid) {
      logger.error('Config validation failed', {
        errors: this.validate.errors
      });
      return false;
    }
    
    // Additional semantic validation
    const modes = config.modes || [];
    const modeNames = modes.map(m => m.name);
    const duplicates = modeNames.filter((name, i) => modeNames.indexOf(name) !== i);
    
    if (duplicates.length > 0) {
      logger.error('Duplicate mode names found', { duplicates });
      return false;
    }
    
    return true;
  }
  
  /**
   * Detect changes between configs
   */
  detectChanges(oldConfig, newConfig) {
    const changes = {
      modesAdded: [],
      modesRemoved: [],
      modesModified: [],
      summary: {}
    };
    
    const oldModes = oldConfig?.modes || [];
    const newModes = newConfig?.modes || [];
    
    const oldNames = new Set(oldModes.map(m => m.name));
    const newNames = new Set(newModes.map(m => m.name));
    
    // Added modes
    for (const mode of newModes) {
      if (!oldNames.has(mode.name)) {
        changes.modesAdded.push(mode.name);
      }
    }
    
    // Removed modes
    for (const mode of oldModes) {
      if (!newNames.has(mode.name)) {
        changes.modesRemoved.push(mode.name);
      }
    }
    
    // Modified modes
    for (const newMode of newModes) {
      const oldMode = oldModes.find(m => m.name === newMode.name);
      if (oldMode) {
        const changed = JSON.stringify(oldMode) !== JSON.stringify(newMode);
        if (changed) {
          changes.modesModified.push(newMode.name);
        }
      }
    }
    
    changes.summary = {
      added: changes.modesAdded.length,
      removed: changes.modesRemoved.length,
      modified: changes.modesModified.length,
      total: newModes.length
    };
    
    return changes;
  }
  
  /**
   * Get current config
   */
  getConfig() {
    return this.currentConfig;
  }
  
  /**
   * Manually trigger reload
   */
  manualReload() {
    logger.info('Manual config reload triggered');
    return this.reload();
  }
}

module.exports = ConfigWatcher;
