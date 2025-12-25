/**
 * Prometheus Metrics Exporter pre Node-RED
 * 
 * Exportuje custom metrics v Prometheus formáte.
 */

const logger = require('./logger');

class MetricsCollector {
  constructor() {
    this.metrics = {
      // Counters
      mqtt_messages_total: new Map(),
      mqtt_errors_total: 0,
      http_requests_total: 0,
      config_reloads_total: 0,
      
      // Gauges
      mqtt_queue_size: 0,
      active_traces: 0,
      circuit_breaker_state: new Map(),
      
      // Histograms (simplified - store buckets)
      mqtt_message_duration_ms: [],
      http_request_duration_ms: [],
      
      // Rate limiter metrics
      rate_limit_allowed: 0,
      rate_limit_rejected: 0,
      
      // Error handler metrics
      retry_attempts: 0,
      dlq_messages: 0,
      
      // Cache metrics
      cache_hits_total: 0,
      cache_misses_total: 0,
      cache_size: 0
    };
    
    this.startTime = Date.now();
  }
  
  /**
   * Increment MQTT message counter
   */
  incMqttMessages(topic, status = 'success') {
    const key = `${topic}:${status}`;
    const current = this.metrics.mqtt_messages_total.get(key) || 0;
    this.metrics.mqtt_messages_total.set(key, current + 1);
  }
  
  /**
   * Increment MQTT error counter
   */
  incMqttErrors() {
    this.metrics.mqtt_errors_total++;
  }
  
  /**
   * Increment HTTP request counter
   */
  incHttpRequests() {
    this.metrics.http_requests_total++;
  }
  
  /**
   * Increment config reload counter
   */
  incConfigReloads() {
    this.metrics.config_reloads_total++;
  }
  
  /**
   * Set MQTT queue size
   */
  setMqttQueueSize(size) {
    this.metrics.mqtt_queue_size = size;
  }
  
  /**
   * Set active traces count
   */
  setActiveTraces(count) {
    this.metrics.active_traces = count;
  }
  
  /**
   * Set circuit breaker state
   */
  setCircuitBreakerState(name, state) {
    const stateValue = state === 'closed' ? 0 : state === 'half-open' ? 1 : 2;
    this.metrics.circuit_breaker_state.set(name, stateValue);
  }
  
  /**
   * Observe MQTT message duration
   */
  observeMqttDuration(duration) {
    this.metrics.mqtt_message_duration_ms.push(duration);
    
    // Keep only last 1000 measurements
    if (this.metrics.mqtt_message_duration_ms.length > 1000) {
      this.metrics.mqtt_message_duration_ms.shift();
    }
  }
  
  /**
   * Observe HTTP request duration
   */
  observeHttpDuration(duration) {
    this.metrics.http_request_duration_ms.push(duration);
    
    if (this.metrics.http_request_duration_ms.length > 1000) {
      this.metrics.http_request_duration_ms.shift();
    }
  }
  
  /**
   * Update rate limiter metrics
   */
  updateRateLimiter(allowed, rejected) {
    this.metrics.rate_limit_allowed = allowed;
    this.metrics.rate_limit_rejected = rejected;
  }
  
  /**
   * Update error handler metrics
   */
  updateErrorHandler(retries, dlqSize) {
    this.metrics.retry_attempts = retries;
    this.metrics.dlq_messages = dlqSize;
  }
  
  /**
   * Update cache metrics
   */
  updateCacheMetrics(stats) {
    this.metrics.cache_hits_total = stats.hits || 0;
    this.metrics.cache_misses_total = stats.misses || 0;
    this.metrics.cache_size = stats.size || 0;
  }
  
  /**
   * Calculate percentile from array
   */
  percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index] || 0;
  }
  
  /**
   * Generate Prometheus metrics output
   */
  getMetrics() {
    const lines = [];
    const uptime = (Date.now() - this.startTime) / 1000;
    
    // Process info
    lines.push('# HELP nodered_build_info Node-RED build info');
    lines.push('# TYPE nodered_build_info gauge');
    lines.push(`nodered_build_info{version="${process.version}"} 1`);
    
    // Uptime
    lines.push('# HELP nodered_uptime_seconds Node-RED uptime in seconds');
    lines.push('# TYPE nodered_uptime_seconds counter');
    lines.push(`nodered_uptime_seconds ${uptime.toFixed(2)}`);
    
    // MQTT messages
    lines.push('# HELP mqtt_messages_total Total MQTT messages processed');
    lines.push('# TYPE mqtt_messages_total counter');
    for (const [key, value] of this.metrics.mqtt_messages_total.entries()) {
      const [topic, status] = key.split(':');
      lines.push(`mqtt_messages_total{topic="${topic}",status="${status}"} ${value}`);
    }
    
    // MQTT errors
    lines.push('# HELP mqtt_errors_total Total MQTT errors');
    lines.push('# TYPE mqtt_errors_total counter');
    lines.push(`mqtt_errors_total ${this.metrics.mqtt_errors_total}`);
    
    // HTTP requests
    lines.push('# HELP http_requests_total Total HTTP requests');
    lines.push('# TYPE http_requests_total counter');
    lines.push(`http_requests_total ${this.metrics.http_requests_total}`);
    
    // Config reloads
    lines.push('# HELP config_reloads_total Total config reloads');
    lines.push('# TYPE config_reloads_total counter');
    lines.push(`config_reloads_total ${this.metrics.config_reloads_total}`);
    
    // MQTT queue size
    lines.push('# HELP mqtt_queue_size Current MQTT queue size');
    lines.push('# TYPE mqtt_queue_size gauge');
    lines.push(`mqtt_queue_size ${this.metrics.mqtt_queue_size}`);
    
    // Active traces
    lines.push('# HELP active_traces Number of active traces');
    lines.push('# TYPE active_traces gauge');
    lines.push(`active_traces ${this.metrics.active_traces}`);
    
    // Circuit breaker state
    lines.push('# HELP circuit_breaker_state Circuit breaker state (0=closed, 1=half-open, 2=open)');
    lines.push('# TYPE circuit_breaker_state gauge');
    for (const [name, state] of this.metrics.circuit_breaker_state.entries()) {
      lines.push(`circuit_breaker_state{name="${name}"} ${state}`);
    }
    
    // Rate limiter
    lines.push('# HELP rate_limit_allowed Messages allowed by rate limiter');
    lines.push('# TYPE rate_limit_allowed counter');
    lines.push(`rate_limit_allowed ${this.metrics.rate_limit_allowed}`);
    
    lines.push('# HELP rate_limit_rejected Messages rejected by rate limiter');
    lines.push('# TYPE rate_limit_rejected counter');
    lines.push(`rate_limit_rejected ${this.metrics.rate_limit_rejected}`);
    
    // Error handler
    lines.push('# HELP retry_attempts Total retry attempts');
    lines.push('# TYPE retry_attempts counter');
    lines.push(`retry_attempts ${this.metrics.retry_attempts}`);
    
    lines.push('# HELP dlq_messages Messages in dead letter queue');
    lines.push('# TYPE dlq_messages gauge');
    lines.push(`dlq_messages ${this.metrics.dlq_messages}`);
    
    // Cache metrics
    lines.push('# HELP cache_hits_total Total cache hits');
    lines.push('# TYPE cache_hits_total counter');
    lines.push(`cache_hits_total ${this.metrics.cache_hits_total}`);
    
    lines.push('# HELP cache_misses_total Total cache misses');
    lines.push('# TYPE cache_misses_total counter');
    lines.push(`cache_misses_total ${this.metrics.cache_misses_total}`);
    
    lines.push('# HELP cache_size Current cache size');
    lines.push('# TYPE cache_size gauge');
    lines.push(`cache_size ${this.metrics.cache_size}`);
    
    const totalCacheRequests = this.metrics.cache_hits_total + this.metrics.cache_misses_total;
    const cacheHitRate = totalCacheRequests > 0 
      ? this.metrics.cache_hits_total / totalCacheRequests 
      : 0;
    lines.push('# HELP cache_hit_rate Cache hit rate (0-1)');
    lines.push('# TYPE cache_hit_rate gauge');
    lines.push(`cache_hit_rate ${cacheHitRate.toFixed(4)}`);
    
    // MQTT duration histogram
    if (this.metrics.mqtt_message_duration_ms.length > 0) {
      const p50 = this.percentile(this.metrics.mqtt_message_duration_ms, 0.5);
      const p95 = this.percentile(this.metrics.mqtt_message_duration_ms, 0.95);
      const p99 = this.percentile(this.metrics.mqtt_message_duration_ms, 0.99);
      
      lines.push('# HELP mqtt_message_duration_ms MQTT message processing duration');
      lines.push('# TYPE mqtt_message_duration_ms summary');
      lines.push(`mqtt_message_duration_ms{quantile="0.5"} ${p50}`);
      lines.push(`mqtt_message_duration_ms{quantile="0.95"} ${p95}`);
      lines.push(`mqtt_message_duration_ms{quantile="0.99"} ${p99}`);
    }
    
    // HTTP duration histogram
    if (this.metrics.http_request_duration_ms.length > 0) {
      const p50 = this.percentile(this.metrics.http_request_duration_ms, 0.5);
      const p95 = this.percentile(this.metrics.http_request_duration_ms, 0.95);
      const p99 = this.percentile(this.metrics.http_request_duration_ms, 0.99);
      
      lines.push('# HELP http_request_duration_ms HTTP request duration');
      lines.push('# TYPE http_request_duration_ms summary');
      lines.push(`http_request_duration_ms{quantile="0.5"} ${p50}`);
      lines.push(`http_request_duration_ms{quantile="0.95"} ${p95}`);
      lines.push(`http_request_duration_ms{quantile="0.99"} ${p99}`);
    }
    
    return lines.join('\n') + '\n';
  }
  
  /**
   * Get metrics as JSON
   */
  getMetricsJson() {
    return {
      uptime: (Date.now() - this.startTime) / 1000,
      mqtt: {
        messages: Object.fromEntries(this.metrics.mqtt_messages_total),
        errors: this.metrics.mqtt_errors_total,
        queueSize: this.metrics.mqtt_queue_size,
        durationP50: this.percentile(this.metrics.mqtt_message_duration_ms, 0.5),
        durationP95: this.percentile(this.metrics.mqtt_message_duration_ms, 0.95),
        durationP99: this.percentile(this.metrics.mqtt_message_duration_ms, 0.99)
      },
      http: {
        requests: this.metrics.http_requests_total,
       ,
      cache: {
        hits: this.metrics.cache_hits_total,
        misses: this.metrics.cache_misses_total,
        size: this.metrics.cache_size,
        hitRate: this.metrics.cache_hits_total + this.metrics.cache_misses_total > 0
          ? this.metrics.cache_hits_total / (this.metrics.cache_hits_total + this.metrics.cache_misses_total)
          : 0
      } durationP50: this.percentile(this.metrics.http_request_duration_ms, 0.5),
        durationP95: this.percentile(this.metrics.http_request_duration_ms, 0.95),
        durationP99: this.percentile(this.metrics.http_request_duration_ms, 0.99)
      },
      config: {
        reloads: this.metrics.config_reloads_total
      },
      tracing: {
        activeTraces: this.metrics.active_traces
      },
      circuitBreaker: Object.fromEntries(this.metrics.circuit_breaker_state),
      rateLimiter: {
        allowed: this.metrics.rate_limit_allowed,
        rejected: this.metrics.rate_limit_rejected,
        rejectionRate: this.metrics.rate_limit_allowed > 0
          ? this.metrics.rate_limit_rejected / (this.metrics.rate_limit_allowed + this.metrics.rate_limit_rejected)
          : 0
      },
      errorHandler: {
        retries: this.metrics.retry_attempts,
        dlqSize: this.metrics.dlq_messages
      }
    };
  }
}

// Singleton instance
let metricsCollector = null;

function getMetricsCollector() {
  if (!metricsCollector) {
    metricsCollector = new MetricsCollector();
  }
  return metricsCollector;
}

module.exports = {
  MetricsCollector,
  getMetricsCollector
};
