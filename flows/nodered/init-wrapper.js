#!/usr/bin/env node

/**
 * Init Wrapper Script
 * 
 * Spúšťa init.js mimo Node-RED function node kontextu.
 * Použitie: node init-wrapper.js
 */

const path = require('path');

// Simulácia RED objektu s minimálnymi potrebnými metódami
const mockRED = {
  nodes: {
    eachNode: function(callback) {
      // Mock - v reále by to prechádzalo všetky nodes
      console.log('[init-wrapper] Mock RED.nodes.eachNode called');
    },
    getNode: function(id) {
      console.log('[init-wrapper] Mock RED.nodes.getNode called for:', id);
      return null;
    }
  },
  events: {
    on: function(event, callback) {
      console.log('[init-wrapper] Mock RED.events.on registered:', event);
      // Simuluj runtime-state event po 1s
      if (event === 'runtime-event') {
        setTimeout(() => {
          console.log('[init-wrapper] Triggering runtime-state event');
          callback({
            id: 'runtime-state',
            payload: { state: 'start' }
          });
        }, 1000);
      }
    },
    emit: function(event, data) {
      console.log('[init-wrapper] Mock RED.events.emit:', event);
    }
  },
  httpAdmin: {
    get: function(path, handler) {
      console.log('[init-wrapper] Mock RED.httpAdmin.get registered:', path);
      // V reále by to registrovalo HTTP endpoint, ale v wrapper to len logujeme
    }
  }
};

try {
  console.log('[init-wrapper] Loading init.js...');
  const initFunc = require('./lib/init.js');
  
  if (typeof initFunc !== 'function') {
    console.error('[init-wrapper] ERROR: init.js did not export a function');
    process.exit(1);
  }
  
  console.log('[init-wrapper] Calling init.js with mock RED...');
  initFunc(mockRED);
  
  // Počkaj 3s aby sa dokončili async operácie (Redis connection, cache warming)
  setTimeout(() => {
    console.log('[init-wrapper] Init completed successfully');
    
    // Výpis globálnych premenných (ak sú nastavené)
    if (global.cache) {
      console.log('[init-wrapper] global.cache:', typeof global.cache);
      if (global.cache.getStats) {
        const stats = global.cache.getStats();
        console.log('[init-wrapper] Cache stats:', JSON.stringify(stats, null, 2));
      }
    }
    
    if (global.logger) {
      console.log('[init-wrapper] global.logger:', typeof global.logger);
    }
    
    if (global.metrics) {
      console.log('[init-wrapper] global.metrics:', typeof global.metrics);
    }
    
    process.exit(0);
  }, 3000);
  
} catch (err) {
  console.error('[init-wrapper] ERROR:', err.message);
  console.error(err.stack);
  process.exit(1);
}
