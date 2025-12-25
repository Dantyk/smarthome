/**
 * Structured Logger for SmartHome UI
 * 
 * Replaces console.log with structured logging.
 * Supports log levels, context metadata, and error tracking.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private level: LogLevel;
  private enableConsole: boolean;
  
  constructor(level: LogLevel = 'info', enableConsole: boolean = true) {
    this.level = level;
    this.enableConsole = enableConsole;
  }
  
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }
  
  private format(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const baseLog = {
      timestamp,
      level,
      message,
      ...context
    };
    
    return JSON.stringify(baseLog);
  }
  
  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog('debug')) return;
    
    const log = this.format('debug', message, context);
    
    if (this.enableConsole) {
      console.debug(log);
    }
    
    this.send(log);
  }
  
  info(message: string, context?: LogContext): void {
    if (!this.shouldLog('info')) return;
    
    const log = this.format('info', message, context);
    
    if (this.enableConsole) {
      console.info(log);
    }
    
    this.send(log);
  }
  
  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog('warn')) return;
    
    const log = this.format('warn', message, context);
    
    if (this.enableConsole) {
      console.warn(log);
    }
    
    this.send(log);
  }
  
  error(message: string, context?: LogContext): void {
    if (!this.shouldLog('error')) return;
    
    const log = this.format('error', message, context);
    
    if (this.enableConsole) {
      console.error(log);
    }
    
    this.send(log);
    
    // TODO: Send to error tracking service (Sentry, etc.)
  }
  
  private send(log: string): void {
    // TODO: Send to log aggregation service
    // For now, just console output
    // Future: POST to /api/logs endpoint
  }
}

// Singleton instance
let loggerInstance: Logger | null = null;

export function getLogger(): Logger {
  if (!loggerInstance) {
    const level = (process.env.LOG_LEVEL as LogLevel) || 'info';
    const enableConsole = process.env.ENABLE_CONSOLE_LOGS !== 'false';
    loggerInstance = new Logger(level, enableConsole);
  }
  return loggerInstance;
}

// Export default instance
export const logger = getLogger();

// Convenience exports
export const debug = (msg: string, ctx?: LogContext) => getLogger().debug(msg, ctx);
export const info = (msg: string, ctx?: LogContext) => getLogger().info(msg, ctx);
export const warn = (msg: string, ctx?: LogContext) => getLogger().warn(msg, ctx);
export const error = (msg: string, ctx?: LogContext) => getLogger().error(msg, ctx);
