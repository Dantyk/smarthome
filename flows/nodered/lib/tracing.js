/**
 * Distributed Tracing - OpenTelemetry Integration
 * 
 * Jaeger tracing pre Node-RED a UI.
 * Podporuje trace propagation cez MQTT pomocou trace_id.
 */

const logger = require('./logger');

class TracingService {
  constructor(options = {}) {
    this.serviceName = options.serviceName || 'nodered';
    this.jaegerEndpoint = options.jaegerEndpoint || 'http://jaeger:14268/api/traces';
    this.enabled = options.enabled !== false;
    this.traces = new Map(); // In-memory trace storage
    this.maxTraces = options.maxTraces || 1000;
  }
  
  /**
   * Create a new trace
   */
  startTrace(operationName, context = {}) {
    if (!this.enabled) return null;
    
    const traceId = context.trace_id || this.generateTraceId();
    const spanId = this.generateSpanId();
    const startTime = Date.now();
    
    const span = {
      traceId,
      spanId,
      parentSpanId: context.parent_span_id || null,
      operationName,
      startTime,
      endTime: null,
      tags: {
        service: this.serviceName,
        ...context.tags
      },
      logs: []
    };
    
    // Store in memory
    if (!this.traces.has(traceId)) {
      this.traces.set(traceId, []);
      
      // Limit memory usage
      if (this.traces.size > this.maxTraces) {
        const firstKey = this.traces.keys().next().value;
        this.traces.delete(firstKey);
      }
    }
    
    this.traces.get(traceId).push(span);
    
    logger.debug('Trace started', {
      traceId,
      spanId,
      operationName
    });
    
    return {
      traceId,
      spanId,
      finish: (tags = {}) => this.finishSpan(traceId, spanId, tags),
      log: (message, data) => this.logToSpan(traceId, spanId, message, data),
      addTag: (key, value) => this.addTagToSpan(traceId, spanId, key, value)
    };
  }
  
  /**
   * Finish a span
   */
  finishSpan(traceId, spanId, tags = {}) {
    const trace = this.traces.get(traceId);
    if (!trace) return;
    
    const span = trace.find(s => s.spanId === spanId);
    if (!span) return;
    
    span.endTime = Date.now();
    span.tags = { ...span.tags, ...tags };
    
    const duration = span.endTime - span.startTime;
    
    logger.debug('Trace finished', {
      traceId,
      spanId,
      operationName: span.operationName,
      duration
    });
    
    // Send to Jaeger (async, best-effort)
    this.sendToJaeger(traceId, span).catch(err => {
      logger.warn('Failed to send trace to Jaeger', {
        traceId,
        error: err.message
      });
    });
  }
  
  /**
   * Add log to span
   */
  logToSpan(traceId, spanId, message, data = {}) {
    const trace = this.traces.get(traceId);
    if (!trace) return;
    
    const span = trace.find(s => s.spanId === spanId);
    if (!span) return;
    
    span.logs.push({
      timestamp: Date.now(),
      message,
      ...data
    });
  }
  
  /**
   * Add tag to span
   */
  addTagToSpan(traceId, spanId, key, value) {
    const trace = this.traces.get(traceId);
    if (!trace) return;
    
    const span = trace.find(s => s.spanId === spanId);
    if (!span) return;
    
    span.tags[key] = value;
  }
  
  /**
   * Get trace by ID
   */
  getTrace(traceId) {
    return this.traces.get(traceId);
  }
  
  /**
   * Generate trace ID (128-bit)
   */
  generateTraceId() {
    return Array(32).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
  }
  
  /**
   * Generate span ID (64-bit)
   */
  generateSpanId() {
    return Array(16).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
  }
  
  /**
   * Send span to Jaeger (Zipkin format)
   */
  async sendToJaeger(traceId, span) {
    if (!this.enabled) return;
    
    // Convert to Zipkin JSON format
    const zipkinSpan = {
      traceId: traceId,
      id: span.spanId,
      parentId: span.parentSpanId,
      name: span.operationName,
      timestamp: span.startTime * 1000, // microseconds
      duration: span.endTime ? (span.endTime - span.startTime) * 1000 : undefined,
      localEndpoint: {
        serviceName: this.serviceName
      },
      tags: span.tags,
      annotations: span.logs.map(log => ({
        timestamp: log.timestamp * 1000,
        value: log.message
      }))
    };
    
    // Note: Actual HTTP send would require fetch/axios
    // For now, just log (Jaeger agent would normally receive this)
    logger.debug('Sending span to Jaeger', {
      traceId,
      spanId: span.spanId,
      endpoint: this.jaegerEndpoint
    });
  }
  
  /**
   * Wrap MQTT message handler with tracing
   */
  wrapMqttHandler(handler, operationName) {
    return async (msg) => {
      const trace = this.startTrace(operationName, {
        trace_id: msg.payload?.trace_id || msg.trace_id,
        tags: {
          'mqtt.topic': msg.topic,
          'span.kind': 'consumer'
        }
      });
      
      try {
        // Inject trace context into msg
        msg.trace_id = trace.traceId;
        msg.span_id = trace.spanId;
        
        const result = await handler(msg);
        
        trace.addTag('success', true);
        trace.finish();
        
        return result;
      } catch (err) {
        trace.addTag('error', true);
        trace.addTag('error.message', err.message);
        trace.log('Error occurred', { stack: err.stack });
        trace.finish();
        
        throw err;
      }
    };
  }
}

module.exports = TracingService;
