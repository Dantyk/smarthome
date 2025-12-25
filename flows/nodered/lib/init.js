/**
 * Node-RED initialization script
 * 
 * Inicializuje:
 * - Winston logger
 * - Error handler s DLQ
 * - Graceful shutdown
 */

const logger = require('./logger');
const { DeadLetterQueue } = require('./error-handler');
const { initGracefulShutdown } = require('./graceful-shutdown');
const ConfigWatcher = require('./config-watcher');
const { RateLimiter, QueueMonitor } = require('./rate-limiter');
const { getMetricsCollector } = require('./metrics');
const RedisCache = require('./cache');
const redis = require('redis');
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
  
  // Initialize Redis cache
  let redisClient = null;
  const redisHost = process.env.REDIS_HOST || 'redis';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
  
  try {
    redisClient = redis.createClient({
      socket: {
        host: redisHost,
        port: redisPort,
        connectTimeout: 5000
      },
      database: 0,
      enableOfflineQueue: false
    });
    
    redisClient.on('error', (err) => {
      logger.error('Redis connection error', { error: err.message });
    });
    
    redisClient.on('connect', () => {
      logger.info('Redis connected', { host: redisHost, port: redisPort });
    });
    
    redisClient.on('ready', () => {
      logger.info('Redis ready');
    });
    
    // Connect async
    redisClient.connect().catch(err => {
      logger.warn('Redis connection failed, using in-memory cache fallback', { error: err.message });
      redisClient = null;
    });
  } catch (err) {
    logger.warn('Redis client creation failed, using in-memory cache fallback', { error: err.message });
    redisClient = null;
  }
  
  // Initialize cache (with or without Redis)
  global.cache = new RedisCache(redisClient);
  logger.info('Cache initialized', { backend: redisClient ? 'Redis' : 'Memory' });
  
  // Cache warming - preload frequently accessed data
  async function warmCache() {
    try {
      logger.info('Cache warming started');
      
      // Preload modes config
      const initialConfig = global.configWatcher.getCurrentConfig();
      if (initialConfig) {
        await global.cache.cacheModesConfig(initialConfig);
        logger.info('Modes config cached', { modes: initialConfig.modes?.length || 0 });
      }
      
      logger.info('Cache warming complete');
    } catch (err) {
      logger.error('Cache warming failed', { error: err.message });
    }
  }
  
  // Initialize config watcher
  const configPath = path.join(__dirname, '../../config/modes.yaml');
  const schemaPath = path.join(__dirname, '../../config/modes.schema.json');
  
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
  
  // Warm cache after config is loaded
  warmCache();
  
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
  
  // Also expose via functionGlobalContext for function nodes
  if (RED && RED.settings) {
    if (!RED.settings.functionGlobalContext) {
      RED.settings.functionGlobalContext = {};
    }
    RED.settings.functionGlobalContext.cache = global.cache;
    RED.settings.functionGlobalContext.logger = global.logger;
    RED.settings.functionGlobalContext.metrics = global.metrics;
    logger.info('Exposed cache/logger/metrics to functionGlobalContext');
  }
  
  // Expose cache stats via metrics
  setInterval(() => {
    if (global.cache && global.metrics) {
      const stats = global.cache.getStats();
      global.metrics.updateCacheMetrics(stats);
    }
  }, 10000); // Update every 10s
  
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
