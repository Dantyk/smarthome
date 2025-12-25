/**
 * Node-RED initialization script
 * 
 * Inicializuje:
 * - Winston logger
 * - Error handler s DLQ
 * - Graceful shutdown
 */

const logger = require('./lib/logger');
const { DeadLetterQueue } = require('./lib/error-handler');
const { initGracefulShutdown } = require('./lib/graceful-shutdown');
const ConfigWatcher = require('./lib/config-watcher');
const { RateLimiter, QueueMonitor } = require('./lib/rate-limiter');
const { getMetricsCollector } = require('./lib/metrics');
const path = require('path');

module.exports = function(RED) {
  logger.info('Node-RED SmartHome initialization started');
  
  // Initialize rate limiter
  global.rateLimiter = new RateLimiter({
    defaultCapacity: 100,
    defaultRefillRate: 10
  });
  
  global.queueMonitor = new QueueMonitor({
    maxQueueSize: 10000,
    warningThreshold: 0.8,
    criticalThreshold: 0.95
  });
  
  logger.info('Rate limiter initialized');
  
  // Initialize config watcher
  const configPath = path.join(__dirname, '../../../config/modes.yaml');
  const schemaPath = path.join(__dirname, '../../../config/modes.schema.json');
  
  global.configWatcher = new ConfigWatcher(
    configPath,
    schemaPath,
    (newConfig, oldConfig, changes) => {
      logger.info('Config reloaded, publishing notification', {
        changes: changes.summary
      });
      
      // Publish config reload event to MQTT
      RED.events.emit('config:reloaded', {
        config: newConfig,
        changes
      });
    }
  );
  
  const initialConfig = global.configWatcher.start();
  logger.info('Config watcher started', { 
    modes: initialConfig.modes?.length || 0 
  });
  
  // Get MQTT client (after Node-RED starts)
  RED.events.on('runtime-event', (event) => {
    if (event.id === 'runtime-state' && event.payload.state === 'start') {
      logger.info('Node-RED runtime started');
      
      // Find MQTT broker node
      RED.nodes.eachNode((node) => {
        if (node.type === 'mqtt-broker') {
          const brokerNode = RED.nodes.getNode(node.id);
          if (brokerNode && brokerNode.client) {
            logger.info('MQTT broker found, initializing DLQ and graceful shutdown');
            
            // Initialize DLQ
            global.dlq = new DeadLetterQueue(brokerNode.client);
            
            // Initialize graceful shutdown
            const shutdown = initGracefulShutdown({
              mqttClient: brokerNode.client,
              timeout: 30000
            });
            
            // Register cleanup functions
            shutdown.addCleanup('flush-dlq', async () => {
              logger.info('Flushing DLQ', { messageCount: global.dlq.messages.length });
            });
            
            logger.info('Initialization complete', {
              mqttBroker: node.broker,
              dlqSize: 0
            });
          }
        }
      });
    }
  });
  
  // Make logger, error handler, and metrics globally available
  global.logger = logger;
  global.metrics = getMetricsCollector();
  
  logger.info('Node-RED SmartHome libraries loaded');
  
  // Register /metrics HTTP endpoint
  RED.httpAdmin.get('/metrics', (req, res) => {
    global.metrics.incHttpRequests();
    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(global.metrics.getMetrics());
  });
  
  // Register /metrics/json endpoint for debugging
  RED.httpAdmin.get('/metrics/json', (req, res) => {
    global.metrics.incHttpRequests();
    res.json(global.metrics.getMetricsJson());
  });
  
  logger.info('Metrics endpoints registered on /metrics and /metrics/json');
};
