/**
 * Centralized Logger pre Node-RED
 * 
 * Winston-based structured logging s rotation a level filtering.
 * Nahradí console.log v function nodes.
 */

const winston = require('winston');
const path = require('path');

// Custom format pre JSON logs
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Custom format pre console (human-readable)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}] ${message}`;
    if (Object.keys(meta).length > 0 && meta.timestamp === undefined) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'nodered' },
  transports: [
    // Console output (colorized)
    new winston.transports.Console({
      format: consoleFormat
    }),
    
    // Error log file (errors only)
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/error.log'),
      level: 'error',
      format: jsonFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Combined log file (all levels)
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/combined.log'),
      format: jsonFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true
    })
  ]
});

// Create child logger with flow/node context
logger.child = function(context) {
  return winston.createLogger({
    level: logger.level,
    defaultMeta: { service: 'nodered', ...context },
    transports: logger.transports
  });
};

// Convenience methods s trace_id support
logger.trace = function(message, trace_id, meta = {}) {
  this.debug(message, { trace_id, ...meta });
};

logger.mqtt = function(level, topic, payload, meta = {}) {
  this.log(level, `MQTT: ${topic}`, { topic, payload, ...meta });
};

logger.http = function(method, url, status, meta = {}) {
  this.info(`HTTP: ${method} ${url} ${status}`, { method, url, status, ...meta });
};

// Export for Node-RED function nodes
module.exports = logger;

// Also export as global for easy access
if (typeof global !== 'undefined') {
  global.logger = logger;
}
