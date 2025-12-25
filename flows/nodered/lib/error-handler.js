/**
 * Error Handling Middleware pre MQTT správy
 * 
 * Poskytuje:
 * - Retry logic s exponential backoff
 * - Dead letter queue pre failed messages
 * - Circuit breaker pattern
 * - Error recovery strategies
 */

const logger = require('./logger');

/**
 * Retry s exponential backoff
 */
class RetryHandler {
  constructor(maxRetries = 3, baseDelay = 1000) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
  }
  
  /**
   * Vypočíta delay pre daný retry attempt
   */
  calculateDelay(attempt) {
    return Math.min(this.baseDelay * Math.pow(2, attempt), 30000); // max 30s
  }
  
  /**
   * Skúsi vykonať operáciu s retries
   */
  async execute(operation, context = {}) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (err) {
        lastError = err;
        
        if (attempt < this.maxRetries) {
          const delay = this.calculateDelay(attempt);
          logger.warn('Retry attempt failed, retrying...', {
            attempt: attempt + 1,
            maxRetries: this.maxRetries,
            delay,
            error: err.message,
            ...context
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    logger.error('All retry attempts failed', {
      maxRetries: this.maxRetries,
      error: lastError.message,
      ...context
    });
    
    throw lastError;
  }
}

/**
 * Circuit Breaker pre external APIs
 */
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.threshold = threshold; // Počet failov pred otvorením
    this.timeout = timeout; // Čas v ms pred half-open stavom
    this.failures = 0;
    this.state = 'closed'; // closed, open, half-open
    this.nextAttempt = Date.now();
  }
  
  async execute(operation, context = {}) {
    // Check circuit state
    if (this.state === 'open') {
      if (Date.now() < this.nextAttempt) {
        logger.warn('Circuit breaker is OPEN, rejecting request', context);
        throw new Error('Circuit breaker is OPEN');
      }
      // Try half-open
      this.state = 'half-open';
      logger.info('Circuit breaker entering HALF-OPEN state', context);
    }
    
    try {
      const result = await operation();
      
      // Success - reset or close circuit
      if (this.state === 'half-open') {
        logger.info('Circuit breaker closing after successful half-open attempt', context);
        this.state = 'closed';
        this.failures = 0;
      }
      
      return result;
    } catch (err) {
      this.failures++;
      
      logger.error('Circuit breaker recorded failure', {
        failures: this.failures,
        threshold: this.threshold,
        state: this.state,
        error: err.message,
        ...context
      });
      
      if (this.failures >= this.threshold) {
        this.state = 'open';
        this.nextAttempt = Date.now() + this.timeout;
        logger.error('Circuit breaker OPENED', {
          failures: this.failures,
          nextAttempt: new Date(this.nextAttempt).toISOString(),
          ...context
        });
      }
      
      throw err;
    }
  }
  
  reset() {
    this.failures = 0;
    this.state = 'closed';
    this.nextAttempt = Date.now();
    logger.info('Circuit breaker manually reset');
  }
}

/**
 * Dead Letter Queue pre failed messages
 */
class DeadLetterQueue {
  constructor(mqttClient, dlqTopic = 'dlq/#') {
    this.client = mqttClient;
    this.dlqTopic = dlqTopic;
    this.messages = [];
    this.maxSize = 1000;
  }
  
  /**
   * Pošle message do DLQ
   */
  send(originalTopic, payload, error, context = {}) {
    const dlqMessage = {
      timestamp: new Date().toISOString(),
      originalTopic,
      payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
      error: error.message,
      errorStack: error.stack,
      ...context
    };
    
    // Store in memory (pre manual recovery)
    this.messages.push(dlqMessage);
    if (this.messages.length > this.maxSize) {
      this.messages.shift(); // Remove oldest
    }
    
    // Publish to DLQ topic
    const dlqTopicFull = `dlq/${originalTopic}`;
    this.client.publish(dlqTopicFull, JSON.stringify(dlqMessage), { qos: 1, retain: false });
    
    logger.error('Message sent to DLQ', {
      originalTopic,
      dlqTopic: dlqTopicFull,
      error: error.message,
      ...context
    });
  }
  
  /**
   * Získaj všetky DLQ messages
   */
  getAll() {
    return this.messages;
  }
  
  /**
   * Vymaž DLQ
   */
  clear() {
    const count = this.messages.length;
    this.messages = [];
    logger.info('DLQ cleared', { messageCount: count });
    return count;
  }
}

/**
 * Error Handler wrapper pre Node-RED msg processing
 */
function createErrorHandler(options = {}) {
  const retry = new RetryHandler(
    options.maxRetries || 3,
    options.retryDelay || 1000
  );
  
  const breaker = new CircuitBreaker(
    options.breakerThreshold || 5,
    options.breakerTimeout || 60000
  );
  
  return {
    retry,
    breaker,
    
    /**
     * Handle MQTT message s retry a circuit breaker
     */
    async handleMessage(msg, processor, node) {
      const context = {
        topic: msg.topic,
        trace_id: msg.payload?.trace_id || msg.trace_id
      };
      
      try {
        // Wrap processor s retry logic
        await retry.execute(async () => {
          // Wrap s circuit breaker ak je external API
          if (options.useCircuitBreaker) {
            return await breaker.execute(() => processor(msg, node), context);
          }
          return await processor(msg, node);
        }, context);
        
        return msg;
      } catch (err) {
        logger.error('Message processing failed after all retries', {
          error: err.message,
          stack: err.stack,
          ...context
        });
        
        // Send to DLQ if available
        if (options.dlq) {
          options.dlq.send(msg.topic, msg.payload, err, context);
        }
        
        // Set error on msg
        msg.error = err.message;
        msg.errorStack = err.stack;
        
        return msg;
      }
    }
  };
}

module.exports = {
  RetryHandler,
  CircuitBreaker,
  DeadLetterQueue,
  createErrorHandler
};
