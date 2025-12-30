/**
 * Repository Metadata Cache
 * 
 * Provides distributed caching for repository metadata using Redis or Azure Cache for Redis.
 * Implements LRU eviction, cache warming, metrics tracking, and cache bypass support.
 * 
 * @module cache/repositoryMetadataCache
 */

const Redis = require('ioredis');

/**
 * Cache metrics tracker
 */
class CacheMetrics {
  constructor() {
    this.hits = 0;
    this.misses = 0;
    this.sets = 0;
    this.errors = 0;
  }

  recordHit() {
    this.hits++;
  }

  recordMiss() {
    this.misses++;
  }

  recordSet() {
    this.sets++;
  }

  recordError() {
    this.errors++;
  }

  getHitRatio() {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : this.hits / total;
  }

  getStats() {
    return {
      hits: this.hits,
      misses: this.misses,
      sets: this.sets,
      errors: this.errors,
      hitRatio: this.getHitRatio(),
      total: this.hits + this.misses,
    };
  }

  reset() {
    this.hits = 0;
    this.misses = 0;
    this.sets = 0;
    this.errors = 0;
  }
}

/**
 * Simple in-memory cache with TTL (fallback when Redis is unavailable)
 */
class InMemoryCache {
  constructor(ttlMs = 300000) {
    this.cache = new Map();
    this.ttlMs = ttlMs;
  }

  async get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // Use item-specific TTL if available, otherwise use default
    const ttl = item.ttlMs !== undefined ? item.ttlMs : this.ttlMs;
    if (Date.now() - item.timestamp > ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  async set(key, value, ttl = null) {
    const ttlMs = ttl !== null ? ttl * 1000 : this.ttlMs;
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttlMs,
    });
  }

  async del(key) {
    this.cache.delete(key);
  }

  async clear() {
    this.cache.clear();
  }

  async keys(pattern) {
    // Simple pattern matching for in-memory cache
    // Escape special regex characters except * which we want to convert to .*
    const escapedPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')  // Escape special regex chars
      .replace(/\*/g, '.*');  // Convert * to .*
    const regex = new RegExp(`^${escapedPattern}$`);
    const matchingKeys = [];
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        matchingKeys.push(key);
      }
    }
    return matchingKeys;
  }

  isConnected() {
    return true;
  }
}

/**
 * Repository Metadata Cache
 * 
 * Provides distributed caching with LRU eviction, metrics, and cache warming
 */
class RepositoryMetadataCache {
  /**
   * Creates a new repository metadata cache
   * 
   * @param {Object} config - Configuration options
   * @param {string} [config.redisUrl] - Redis connection URL
   * @param {string} [config.redisHost] - Redis host (alternative to redisUrl)
   * @param {number} [config.redisPort=6379] - Redis port
   * @param {string} [config.redisPassword] - Redis password
   * @param {boolean} [config.redisTls=false] - Use TLS for Redis connection
   * @param {number} [config.repositoryTtl=300] - TTL for repository metadata in seconds (default: 5 minutes)
   * @param {number} [config.userListTtl=3600] - TTL for user lists in seconds (default: 1 hour)
   * @param {number} [config.maxMemoryPolicy='allkeys-lru'] - Redis maxmemory-policy
   * @param {Object} [config.telemetryClient] - Application Insights client
   * @param {boolean} [config.enableFallback=true] - Enable in-memory fallback if Redis unavailable
   */
  constructor(config = {}) {
    this.config = {
      redisUrl: config.redisUrl || process.env.REDIS_URL,
      redisHost: config.redisHost || process.env.REDIS_HOST,
      redisPort: config.redisPort || parseInt(process.env.REDIS_PORT || '6379', 10),
      redisPassword: config.redisPassword || process.env.REDIS_PASSWORD,
      redisTls: config.redisTls !== undefined ? config.redisTls : (process.env.REDIS_TLS === 'true'),
      repositoryTtl: config.repositoryTtl || 300, // 5 minutes
      userListTtl: config.userListTtl || 3600, // 1 hour
      maxMemoryPolicy: config.maxMemoryPolicy || 'allkeys-lru',
      telemetryClient: config.telemetryClient,
      enableFallback: config.enableFallback !== undefined ? config.enableFallback : true,
    };

    this.metrics = new CacheMetrics();
    this.client = null;
    this.isRedisConnected = false;
    this.fallbackCache = null;

    // Initialize cache
    this._initialize();
  }

  /**
   * Initialize Redis connection or fallback cache
   */
  _initialize() {
    try {
      if (this.config.redisUrl) {
        // Connect using URL
        this.client = new Redis(this.config.redisUrl, {
          tls: this.config.redisTls ? { rejectUnauthorized: false } : undefined,
          retryStrategy: (times) => {
            // Retry with exponential backoff
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
          maxRetriesPerRequest: 3,
        });
      } else if (this.config.redisHost) {
        // Connect using host/port/password
        this.client = new Redis({
          host: this.config.redisHost,
          port: this.config.redisPort,
          password: this.config.redisPassword,
          tls: this.config.redisTls ? { rejectUnauthorized: false } : undefined,
          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
          maxRetriesPerRequest: 3,
        });
      }

      if (this.client) {
        // Set up event handlers
        this.client.on('connect', () => {
          console.log('Redis cache connected');
          this.isRedisConnected = true;
          
          // Configure LRU eviction policy
          this._configureLRU();
          
          if (this.config.telemetryClient) {
            this.config.telemetryClient.trackEvent('CacheConnected', {
              cacheType: 'redis',
            });
          }
        });

        this.client.on('error', (error) => {
          console.error('Redis cache error:', error.message);
          this.isRedisConnected = false;
          this.metrics.recordError();
          
          if (this.config.telemetryClient) {
            this.config.telemetryClient.trackException(error, {
              component: 'RepositoryMetadataCache',
            });
          }
        });

        this.client.on('close', () => {
          console.warn('Redis cache connection closed');
          this.isRedisConnected = false;
        });
      } else {
        // No Redis configuration provided
        console.warn('Redis not configured, using in-memory cache fallback');
        this._enableFallback();
      }
    } catch (error) {
      console.error('Failed to initialize Redis:', error.message);
      this.metrics.recordError();
      
      if (this.config.telemetryClient) {
        this.config.telemetryClient.trackException(error, {
          component: 'RepositoryMetadataCache',
          phase: 'initialization',
        });
      }
      
      this._enableFallback();
    }
  }

  /**
   * Enable in-memory fallback cache
   */
  _enableFallback() {
    if (this.config.enableFallback && !this.fallbackCache) {
      console.log('Enabling in-memory cache fallback');
      this.fallbackCache = new InMemoryCache(this.config.repositoryTtl * 1000);
      
      if (this.config.telemetryClient) {
        this.config.telemetryClient.trackEvent('CacheFallbackEnabled', {
          reason: 'redis_unavailable',
        });
      }
    }
  }

  /**
   * Configure Redis LRU eviction policy
   */
  async _configureLRU() {
    try {
      if (this.client && this.isRedisConnected) {
        // Set maxmemory-policy to LRU
        // Note: This requires CONFIG command permission in Redis
        // Azure Cache for Redis may restrict this in some tiers
        await this.client.config('SET', 'maxmemory-policy', this.config.maxMemoryPolicy);
        console.log(`Redis LRU eviction policy configured: ${this.config.maxMemoryPolicy}`);
      }
    } catch (error) {
      // CONFIG command may not be allowed (e.g., in some Azure Cache tiers)
      // This is not critical - the policy can be set at Redis server level
      console.warn('Failed to configure LRU policy (may require server-level configuration):', error.message);
    }
  }

  /**
   * Get active cache client (Redis or fallback)
   */
  _getClient() {
    if (this.client && this.isRedisConnected) {
      return this.client;
    }
    
    if (!this.fallbackCache && this.config.enableFallback) {
      this._enableFallback();
    }
    
    return this.fallbackCache;
  }

  /**
   * Check if cache bypass is requested
   * 
   * @param {Object} headers - Request headers
   * @returns {boolean} True if cache should be bypassed
   */
  shouldBypassCache(headers = {}) {
    const bypassHeader = headers['x-cache-bypass'] || headers['X-Cache-Bypass'];
    return bypassHeader === 'true' || bypassHeader === '1';
  }

  /**
   * Generate cache key for repository metadata
   * 
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {string} Cache key
   */
  getRepositoryKey(owner, repo) {
    return `repo:metadata:${owner}/${repo}`;
  }

  /**
   * Generate cache key for user list
   * 
   * @param {string} identifier - User list identifier
   * @returns {string} Cache key
   */
  getUserListKey(identifier) {
    return `users:list:${identifier}`;
  }

  /**
   * Generate cache key for security champion
   * 
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {string} Cache key
   */
  getSecurityChampionKey(owner, repo) {
    return `repo:security-champion:${owner}/${repo}`;
  }

  /**
   * Get value from cache
   * 
   * @param {string} key - Cache key
   * @param {Object} [headers] - Request headers (for cache bypass)
   * @returns {Promise<any|null>} Cached value or null if not found
   */
  async get(key, headers = {}) {
    const startTime = Date.now();
    
    try {
      // Check for cache bypass
      if (this.shouldBypassCache(headers)) {
        console.log(`Cache bypassed for key: ${key}`);
        this.metrics.recordMiss();
        return null;
      }

      const client = this._getClient();
      if (!client) {
        this.metrics.recordMiss();
        return null;
      }

      const value = await client.get(key);
      const duration = Date.now() - startTime;

      if (value) {
        this.metrics.recordHit();
        
        if (this.config.telemetryClient) {
          this.config.telemetryClient.trackMetric('CacheGetDuration', duration, {
            cacheType: this.isRedisConnected ? 'redis' : 'memory',
            result: 'hit',
          });
        }

        return JSON.parse(value);
      } else {
        this.metrics.recordMiss();
        
        if (this.config.telemetryClient) {
          this.config.telemetryClient.trackMetric('CacheGetDuration', duration, {
            cacheType: this.isRedisConnected ? 'redis' : 'memory',
            result: 'miss',
          });
        }

        return null;
      }
    } catch (error) {
      console.error('Cache get error:', error.message);
      this.metrics.recordError();
      this.metrics.recordMiss();
      
      if (this.config.telemetryClient) {
        this.config.telemetryClient.trackException(error, {
          component: 'RepositoryMetadataCache',
          operation: 'get',
          key,
        });
      }
      
      return null;
    }
  }

  /**
   * Set value in cache
   * 
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} [ttl] - TTL in seconds (uses default if not specified)
   * @returns {Promise<boolean>} True if successful
   */
  async set(key, value, ttl = null) {
    const startTime = Date.now();
    
    try {
      const client = this._getClient();
      if (!client) {
        return false;
      }

      // Determine TTL based on key type
      let cacheTtl = ttl;
      if (!cacheTtl) {
        if (key.startsWith('users:')) {
          cacheTtl = this.config.userListTtl;
        } else {
          cacheTtl = this.config.repositoryTtl;
        }
      }

      const serialized = JSON.stringify(value);
      
      if (this.isRedisConnected && this.client) {
        await this.client.setex(key, cacheTtl, serialized);
      } else {
        await client.set(key, serialized, cacheTtl);
      }

      this.metrics.recordSet();
      
      const duration = Date.now() - startTime;
      if (this.config.telemetryClient) {
        this.config.telemetryClient.trackMetric('CacheSetDuration', duration, {
          cacheType: this.isRedisConnected ? 'redis' : 'memory',
        });
      }

      return true;
    } catch (error) {
      console.error('Cache set error:', error.message);
      this.metrics.recordError();
      
      if (this.config.telemetryClient) {
        this.config.telemetryClient.trackException(error, {
          component: 'RepositoryMetadataCache',
          operation: 'set',
          key,
        });
      }
      
      return false;
    }
  }

  /**
   * Delete value from cache
   * 
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} True if successful
   */
  async delete(key) {
    try {
      const client = this._getClient();
      if (!client) {
        return false;
      }

      await client.del(key);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error.message);
      this.metrics.recordError();
      
      if (this.config.telemetryClient) {
        this.config.telemetryClient.trackException(error, {
          component: 'RepositoryMetadataCache',
          operation: 'delete',
          key,
        });
      }
      
      return false;
    }
  }

  /**
   * Clear all cache entries matching a pattern
   * 
   * @param {string} pattern - Key pattern (e.g., 'repo:*')
   * @returns {Promise<number>} Number of keys deleted
   */
  async clearPattern(pattern) {
    try {
      const client = this._getClient();
      if (!client) {
        return 0;
      }

      const keys = await client.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      if (this.isRedisConnected && this.client) {
        // Use pipeline for large key deletions to avoid max args limit
        if (keys.length > 1000) {
          const pipeline = this.client.pipeline();
          for (const key of keys) {
            pipeline.del(key);
          }
          await pipeline.exec();
        } else {
          await this.client.del(...keys);
        }
      } else {
        for (const key of keys) {
          await client.del(key);
        }
      }

      console.log(`Cleared ${keys.length} cache entries matching pattern: ${pattern}`);
      return keys.length;
    } catch (error) {
      console.error('Cache clear pattern error:', error.message);
      this.metrics.recordError();
      
      if (this.config.telemetryClient) {
        this.config.telemetryClient.trackException(error, {
          component: 'RepositoryMetadataCache',
          operation: 'clearPattern',
          pattern,
        });
      }
      
      return 0;
    }
  }

  /**
   * Warm cache with frequently accessed repositories
   * 
   * @param {Array<Object>} repositories - Array of {owner, repo, data}
   * @returns {Promise<number>} Number of repositories cached
   */
  async warmCache(repositories) {
    console.log(`Warming cache with ${repositories.length} repositories...`);
    
    let cached = 0;
    for (const { owner, repo, data } of repositories) {
      const key = this.getRepositoryKey(owner, repo);
      const success = await this.set(key, data);
      if (success) {
        cached++;
      }
    }

    console.log(`Cache warmed: ${cached}/${repositories.length} repositories cached`);
    
    if (this.config.telemetryClient) {
      this.config.telemetryClient.trackEvent('CacheWarmed', {
        totalRepositories: String(repositories.length),
        cachedRepositories: String(cached),
      });
    }

    return cached;
  }

  /**
   * Get cache metrics
   * 
   * @returns {Object} Cache metrics
   */
  getMetrics() {
    const stats = this.metrics.getStats();
    
    // Track metrics in Application Insights
    if (this.config.telemetryClient) {
      this.config.telemetryClient.trackMetric('CacheHitRatio', stats.hitRatio, {
        cacheType: this.isRedisConnected ? 'redis' : 'memory',
      });
      this.config.telemetryClient.trackMetric('CacheHits', stats.hits);
      this.config.telemetryClient.trackMetric('CacheMisses', stats.misses);
    }

    return {
      ...stats,
      isRedisConnected: this.isRedisConnected,
      usingFallback: !this.isRedisConnected && this.fallbackCache !== null,
    };
  }

  /**
   * Reset cache metrics
   */
  resetMetrics() {
    this.metrics.reset();
  }

  /**
   * Check if cache is connected and operational
   * 
   * @returns {boolean} True if connected
   */
  isConnected() {
    if (this.client && this.isRedisConnected) {
      return true;
    }
    return this.fallbackCache !== null;
  }

  /**
   * Close cache connections
   */
  async close() {
    try {
      if (this.client) {
        await this.client.quit();
        console.log('Redis cache connection closed');
      }
    } catch (error) {
      console.error('Error closing cache connection:', error.message);
    }
  }
}

module.exports = {
  RepositoryMetadataCache,
  CacheMetrics,
  InMemoryCache,
};
