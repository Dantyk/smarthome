/**
 * Redis Cache Layer for SmartHome
 * 
 * Cacheuje:
 * - modes.yaml (config hot reload)
 * - Weather data (avoid repeated API calls)
 * - Frequently accessed MQTT state
 */

const logger = require('./logger');

class RedisCache {
  constructor(redisClient) {
    this.redis = redisClient;
    this.enabled = false;
    
    if (redisClient) {
      this.enabled = true;
      logger.info('Redis cache enabled');
    } else {
      logger.warn('Redis not available, using in-memory fallback');
      this.memoryCache = new Map();
    }
  }
  
  /**
   * Get value from cache
   */
  async get(key) {
    try {
      if (this.enabled) {
        const value = await this.redis.get(key);
        return value ? JSON.parse(value) : null;
      } else {
        return this.memoryCache.get(key) || null;
      }
    } catch (error) {
      logger.error('Cache get error', { key, error: error.message });
      return null;
    }
  }
  
  /**
   * Set value in cache with optional TTL
   */
  async set(key, value, ttlSeconds = null) {
    try {
      const serialized = JSON.stringify(value);
      
      if (this.enabled) {
        if (ttlSeconds) {
          // Redis v4+ uses setEx instead of setex
          await this.redis.setEx(key, ttlSeconds, serialized);
        } else {
          await this.redis.set(key, serialized);
        }
      } else {
        this.memoryCache.set(key, value);
        
        if (ttlSeconds) {
          setTimeout(() => {
            this.memoryCache.delete(key);
          }, ttlSeconds * 1000);
        }
      }
      
      return true;
    } catch (error) {
      logger.error('Cache set error', { key, error: error.message });
      return false;
    }
  }
  
  /**
   * Delete key from cache
   */
  async del(key) {
    try {
      if (this.enabled) {
        await this.redis.del(key);
      } else {
        this.memoryCache.delete(key);
      }
      return true;
    } catch (error) {
      logger.error('Cache delete error', { key, error: error.message });
      return false;
    }
  }
  
  /**
   * Check if key exists
   */
  async exists(key) {
    try {
      if (this.enabled) {
        return (await this.redis.exists(key)) === 1;
      } else {
        return this.memoryCache.has(key);
      }
    } catch (error) {
      logger.error('Cache exists error', { key, error: error.message });
      return false;
    }
  }
  
  /**
   * Get multiple keys
   */
  async mget(keys) {
    try {
      if (this.enabled) {
        const values = await this.redis.mget(keys);
        return values.map(v => v ? JSON.parse(v) : null);
      } else {
        return keys.map(k => this.memoryCache.get(k) || null);
      }
    } catch (error) {
      logger.error('Cache mget error', { keys, error: error.message });
      return keys.map(() => null);
    }
  }
  
  /**
   * Cache modes.yaml config
   */
  async cacheModesConfig(config) {
    await this.set('config:modes', config);
    logger.info('Modes config cached');
  }
  
  /**
   * Get cached modes config
   */
  async getModesConfig() {
    return await this.get('config:modes');
  }
  
  /**
   * Cache weather data with 10min TTL
   */
  async cacheWeather(location, data) {
    const key = `weather:${location}`;
    await this.set(key, data, 600); // 10 minutes
    logger.debug('Weather data cached', { location });
  }
  
  /**
   * Get cached weather
   */
  async getWeather(location) {
    const key = `weather:${location}`;
    return await this.get(key);
  }
  
  /**
   * Cache MQTT device state
   */
  async cacheMqttState(topic, state) {
    const key = `mqtt:state:${topic}`;
    await this.set(key, state, 3600); // 1 hour
  }
  
  /**
   * Get cached MQTT state
   */
  async getMqttState(topic) {
    const key = `mqtt:state:${topic}`;
    return await this.get(key);
  }
  
  /**
   * Invalidate cache pattern
   */
  async invalidatePattern(pattern) {
    try {
      if (this.enabled) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
          logger.info('Cache invalidated', { pattern, count: keys.length });
        }
      } else {
        // In-memory: delete matching keys
        for (const [key] of this.memoryCache) {
          if (this.matchPattern(key, pattern)) {
            this.memoryCache.delete(key);
          }
        }
      }
      return true;
    } catch (error) {
      logger.error('Cache invalidate error', { pattern, error: error.message });
      return false;
    }
  }
  
  /**
   * Simple pattern matching for in-memory cache
   */
  matchPattern(key, pattern) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(key);
  }
  
  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      if (this.enabled) {
        const info = await this.redis.info('stats');
        return {
          enabled: true,
          type: 'redis',
          info: info
        };
      } else {
        return {
          enabled: false,
          type: 'memory',
          size: this.memoryCache.size
        };
      }
    } catch (error) {
      logger.error('Cache stats error', { error: error.message });
      return { enabled: false, error: error.message };
    }
  }
}

module.exports = RedisCache;
