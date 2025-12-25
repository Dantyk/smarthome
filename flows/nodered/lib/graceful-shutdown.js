/**
 * Graceful Shutdown Handler pre Node-RED
 * 
 * Zachytáva SIGTERM/SIGINT a zabezpečuje:
 * - Graceful MQTT disconnect
 * - Log flush
 * - Cleanup resources
 * - Timeout protection
 */

const logger = require('./logger');

class GracefulShutdown {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000; // 30s default
    this.cleanup = options.cleanup || [];
    this.mqttClient = options.mqttClient;
    this.isShuttingDown = false;
    
    this.registerHandlers();
  }
  
  /**
   * Registruje SIGTERM/SIGINT handlers
   */
  registerHandlers() {
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    
    // Catch uncaught exceptions
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught exception', {
        error: err.message,
        stack: err.stack
      });
      this.shutdown('uncaughtException');
    });
    
    // Catch unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
        promise: String(promise)
      });
    });
  }
  
  /**
   * Pridá cleanup funkciu
   */
  addCleanup(name, fn) {
    this.cleanup.push({ name, fn });
    logger.debug('Cleanup function registered', { name });
  }
  
  /**
   * Vykoná graceful shutdown
   */
  async shutdown(signal) {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress, ignoring signal', { signal });
      return;
    }
    
    this.isShuttingDown = true;
    
    logger.info('Graceful shutdown initiated', { signal });
    
    // Setup timeout protection
    const timeoutHandle = setTimeout(() => {
      logger.error('Shutdown timeout exceeded, forcing exit', {
        timeout: this.timeout
      });
      process.exit(1);
    }, this.timeout);
    
    try {
      // 1. Close MQTT connections
      if (this.mqttClient) {
        await this.closeMqtt();
      }
      
      // 2. Run cleanup functions
      for (const { name, fn } of this.cleanup) {
        try {
          logger.info('Running cleanup function', { name });
          await Promise.race([
            fn(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Cleanup timeout')), 5000)
            )
          ]);
          logger.info('Cleanup function completed', { name });
        } catch (err) {
          logger.error('Cleanup function failed', {
            name,
            error: err.message
          });
        }
      }
      
      // 3. Flush logs
      await this.flushLogs();
      
      logger.info('Graceful shutdown completed successfully');
      
      clearTimeout(timeoutHandle);
      process.exit(0);
    } catch (err) {
      logger.error('Graceful shutdown failed', {
        error: err.message,
        stack: err.stack
      });
      
      clearTimeout(timeoutHandle);
      process.exit(1);
    }
  }
  
  /**
   * Close MQTT client gracefully
   */
  async closeMqtt() {
    return new Promise((resolve, reject) => {
      if (!this.mqttClient) {
        resolve();
        return;
      }
      
      logger.info('Closing MQTT connection');
      
      const timeout = setTimeout(() => {
        logger.warn('MQTT close timeout, forcing disconnect');
        this.mqttClient.end(true); // Force
        resolve();
      }, 5000);
      
      this.mqttClient.end(false, {}, () => {
        clearTimeout(timeout);
        logger.info('MQTT connection closed gracefully');
        resolve();
      });
    });
  }
  
  /**
   * Flush all Winston transports
   */
  async flushLogs() {
    return new Promise((resolve) => {
      logger.info('Flushing logs');
      
      // Winston doesn't have built-in flush, but we can close/reopen transports
      const promises = logger.transports.map(transport => {
        return new Promise((res) => {
          if (typeof transport.close === 'function') {
            transport.close();
          }
          res();
        });
      });
      
      Promise.all(promises).then(() => {
        logger.info('Logs flushed');
        resolve();
      });
    });
  }
}

// Singleton instance
let shutdownHandler = null;

/**
 * Initialize graceful shutdown
 */
function initGracefulShutdown(options = {}) {
  if (shutdownHandler) {
    logger.warn('Graceful shutdown already initialized');
    return shutdownHandler;
  }
  
  shutdownHandler = new GracefulShutdown(options);
  logger.info('Graceful shutdown initialized', {
    timeout: shutdownHandler.timeout
  });
  
  return shutdownHandler;
}

module.exports = {
  GracefulShutdown,
  initGracefulShutdown,
  getShutdownHandler: () => shutdownHandler
};
