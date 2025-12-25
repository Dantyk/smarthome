/**
 * Rate Limiter - Token Bucket Algorithm
 * 
 * Implementuje rate limiting pre MQTT topics s:
 * - Token bucket algorithm
 * - Per-topic rate limits
 * - Queue overflow protection
 * - Backpressure metrics
 */

const logger = require('./logger');

class TokenBucket {
  constructor(capacity, refillRate) {
    this.capacity = capacity; // Max tokens
    this.tokens = capacity; // Current tokens
    this.refillRate = refillRate; // Tokens per second
    this.lastRefill = Date.now();
  }
  
  /**
   * Refill tokens based on time elapsed
   */
  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = elapsed * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
  
  /**
   * Try to consume a token
   */
  consume(tokens = 1) {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    
    return false;
  }
  
  /**
   * Get available tokens
   */
  available() {
    this.refill();
    return this.tokens;
  }
}

class RateLimiter {
  constructor(options = {}) {
    this.defaultCapacity = options.defaultCapacity || 100; // 100 messages
    this.defaultRefillRate = options.defaultRefillRate || 10; // 10 msg/s
    this.buckets = new Map();
    this.metrics = {
      allowed: 0,
      rejected: 0,
      topics: {}
    };
    
    // Per-topic rate limits
    this.limits = options.limits || {
      'cmd/#': { capacity: 50, refillRate: 5 },      // Commands: 5 msg/s
      'virt/#': { capacity: 100, refillRate: 10 },   // Virtual: 10 msg/s
      'stat/#': { capacity: 200, refillRate: 20 },   // Status: 20 msg/s
      'event/safety/#': { capacity: 10, refillRate: 1 }, // Safety: 1 msg/s
      'dlq/#': { capacity: 10, refillRate: 1 }       // DLQ: 1 msg/s
    };
  }
  
  /**
   * Get or create bucket for topic
   */
  getBucket(topic) {
    if (this.buckets.has(topic)) {
      return this.buckets.get(topic);
    }
    
    // Find matching limit pattern
    const limit = this.findLimit(topic);
    const bucket = new TokenBucket(limit.capacity, limit.refillRate);
    this.buckets.set(topic, bucket);
    
    return bucket;
  }
  
  /**
   * Find rate limit for topic (supports wildcards)
   */
  findLimit(topic) {
    for (const [pattern, limit] of Object.entries(this.limits)) {
      if (this.matchPattern(pattern, topic)) {
        return limit;
      }
    }
    
    // Default limit
    return {
      capacity: this.defaultCapacity,
      refillRate: this.defaultRefillRate
    };
  }
  
  /**
   * Match MQTT topic pattern
   */
  matchPattern(pattern, topic) {
    const patternParts = pattern.split('/');
    const topicParts = topic.split('/');
    
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] === '#') {
        return true; // Multi-level wildcard
      }
      if (patternParts[i] === '+') {
        continue; // Single-level wildcard
      }
      if (patternParts[i] !== topicParts[i]) {
        return false;
      }
    }
    
    return patternParts.length === topicParts.length;
  }
  
  /**
   * Check if message is allowed
   */
  allow(topic, tokens = 1) {
    const bucket = this.getBucket(topic);
    const allowed = bucket.consume(tokens);
    
    // Update metrics
    if (allowed) {
      this.metrics.allowed++;
    } else {
      this.metrics.rejected++;
      logger.warn('Rate limit exceeded', {
        topic,
        available: bucket.available(),
        requested: tokens
      });
    }
    
    // Per-topic metrics
    if (!this.metrics.topics[topic]) {
      this.metrics.topics[topic] = { allowed: 0, rejected: 0 };
    }
    
    if (allowed) {
      this.metrics.topics[topic].allowed++;
    } else {
      this.metrics.topics[topic].rejected++;
    }
    
    return allowed;
  }
  
  /**
   * Get metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      rejectionRate: this.metrics.allowed > 0 
        ? this.metrics.rejected / (this.metrics.allowed + this.metrics.rejected)
        : 0
    };
  }
  
  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      allowed: 0,
      rejected: 0,
      topics: {}
    };
  }
  
  /**
   * Get bucket info for topic
   */
  getBucketInfo(topic) {
    const bucket = this.getBucket(topic);
    const limit = this.findLimit(topic);
    
    return {
      topic,
      capacity: limit.capacity,
      refillRate: limit.refillRate,
      available: bucket.available(),
      utilization: 1 - (bucket.available() / limit.capacity)
    };
  }
}

/**
 * MQTT Queue Monitor - Backpressure detection
 */
class QueueMonitor {
  constructor(options = {}) {
    this.maxQueueSize = options.maxQueueSize || 10000;
    this.warningThreshold = options.warningThreshold || 0.8; // 80%
    this.criticalThreshold = options.criticalThreshold || 0.95; // 95%
    this.queues = new Map();
    this.metrics = {
      dropped: 0,
      warnings: 0,
      critical: 0
    };
  }
  
  /**
   * Check queue size and apply backpressure
   */
  checkQueue(queueName, currentSize) {
    const utilization = currentSize / this.maxQueueSize;
    
    // Track per-queue stats
    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, { 
        maxSize: 0,
        drops: 0,
        warnings: 0
      });
    }
    
    const queueStats = this.queues.get(queueName);
    queueStats.maxSize = Math.max(queueStats.maxSize, currentSize);
    
    // Check thresholds
    if (utilization >= this.criticalThreshold) {
      this.metrics.critical++;
      queueStats.drops++;
      logger.error('Queue critical - dropping messages', {
        queue: queueName,
        size: currentSize,
        maxSize: this.maxQueueSize,
        utilization: (utilization * 100).toFixed(1) + '%'
      });
      return { action: 'drop', utilization };
    }
    
    if (utilization >= this.warningThreshold) {
      this.metrics.warnings++;
      queueStats.warnings++;
      logger.warn('Queue warning - backpressure applied', {
        queue: queueName,
        size: currentSize,
        maxSize: this.maxQueueSize,
        utilization: (utilization * 100).toFixed(1) + '%'
      });
      return { action: 'warn', utilization };
    }
    
    return { action: 'ok', utilization };
  }
  
  /**
   * Record dropped message
   */
  recordDrop(queueName) {
    this.metrics.dropped++;
    const queueStats = this.queues.get(queueName);
    if (queueStats) {
      queueStats.drops++;
    }
  }
  
  /**
   * Get metrics
   */
  getMetrics() {
    const queueMetrics = {};
    for (const [name, stats] of this.queues.entries()) {
      queueMetrics[name] = {
        ...stats,
        utilization: stats.maxSize / this.maxQueueSize
      };
    }
    
    return {
      ...this.metrics,
      queues: queueMetrics,
      maxQueueSize: this.maxQueueSize
    };
  }
}

module.exports = {
  RateLimiter,
  QueueMonitor,
  TokenBucket
};
