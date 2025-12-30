/**
 * User Mapper
 * 
 * Maps GitHub usernames to Microsoft Entra ID identities with support for:
 * - Direct username matching
 * - Email-based matching
 * - Fuzzy matching with confidence scores
 * - Manual mapping overrides
 * - Periodic validation and sync
 * - Fallback notification mechanisms
 * 
 * @module identity/userMapper
 */

const GraphClient = require('./graphClient');
const Redis = require('ioredis');

/**
 * In-memory fallback storage when Redis is unavailable
 */
class InMemoryStore {
  constructor() {
    this.mappings = new Map();
  }

  async get(key) {
    return this.mappings.get(key) || null;
  }

  async set(key, value, ttl = null) {
    this.mappings.set(key, value);
  }

  async del(key) {
    this.mappings.delete(key);
  }

  async keys(pattern) {
    const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
    return Array.from(this.mappings.keys()).filter(key => regex.test(key));
  }

  async clear() {
    this.mappings.clear();
  }
}

/**
 * User mapper for GitHub to Entra ID identity mapping
 */
class UserMapper {
  /**
   * Creates a new UserMapper instance
   * @param {Object} config - Configuration object
   * @param {Object} config.graphClient - GraphClient instance
   * @param {Object} [config.redis] - Redis configuration
   * @param {string} [config.redis.url] - Redis connection URL
   * @param {string} [config.redis.host] - Redis host
   * @param {number} [config.redis.port=6379] - Redis port
   * @param {string} [config.redis.password] - Redis password
   * @param {boolean} [config.redis.tls=false] - Use TLS
   * @param {Object} [config.manualMappings] - Manual mapping overrides
   * @param {number} [config.mappingTtl=604800] - Mapping TTL in seconds (default: 7 days)
   * @param {number} [config.fuzzyMatchThreshold=0.7] - Minimum confidence for fuzzy matches
   * @param {Object} [config.telemetryClient] - Optional Application Insights client
   */
  constructor(config = {}) {
    this.config = {
      mappingTtl: config.mappingTtl || 604800, // 7 days
      fuzzyMatchThreshold: config.fuzzyMatchThreshold || 0.7,
      ...config,
    };

    // Initialize Graph API client
    this.graphClient = config.graphClient || new GraphClient(config);
    this.telemetryClient = config.telemetryClient;

    // Load manual mapping overrides
    this.manualMappings = config.manualMappings || {};

    // Initialize storage (Redis or in-memory fallback)
    this._initializeStorage(config.redis);
  }

  /**
   * Initializes storage backend (Redis or in-memory)
   * @param {Object} redisConfig - Redis configuration
   * @private
   */
  _initializeStorage(redisConfig) {
    if (!redisConfig) {
      this.storage = new InMemoryStore();
      this.storageType = 'memory';
      return;
    }

    try {
      if (redisConfig.url || process.env.REDIS_URL) {
        this.storage = new Redis(redisConfig.url || process.env.REDIS_URL, {
          // Note: rejectUnauthorized: false is used for Azure Redis Cache compatibility
          // In production, ensure proper certificate validation is in place
          tls: redisConfig.tls ? { rejectUnauthorized: false } : undefined,
        });
      } else if (redisConfig.host || process.env.REDIS_HOST) {
        this.storage = new Redis({
          host: redisConfig.host || process.env.REDIS_HOST,
          port: redisConfig.port || parseInt(process.env.REDIS_PORT || '6379', 10),
          password: redisConfig.password || process.env.REDIS_PASSWORD,
          // Note: rejectUnauthorized: false is used for Azure Redis Cache compatibility
          // In production, ensure proper certificate validation is in place
          tls: redisConfig.tls || (process.env.REDIS_TLS === 'true') ? { rejectUnauthorized: false } : undefined,
        });
      } else {
        this.storage = new InMemoryStore();
        this.storageType = 'memory';
        return;
      }

      this.storageType = 'redis';
      
      this.storage.on('error', (err) => {
        console.error('Redis connection error:', err);
        if (this.telemetryClient) {
          this.telemetryClient.trackException({
            exception: err,
            properties: { component: 'UserMapper.Redis' },
          });
        }
      });
    } catch (error) {
      console.warn('Failed to initialize Redis, falling back to in-memory storage:', error);
      this.storage = new InMemoryStore();
      this.storageType = 'memory';
    }
  }

  /**
   * Maps a GitHub username to an Entra ID user
   * @param {string} githubUsername - GitHub username
   * @param {string} [githubEmail] - Optional GitHub email address
   * @returns {Promise<Object|null>} Mapping result with Entra ID user or null
   */
  async mapUser(githubUsername, githubEmail = null) {
    const startTime = Date.now();

    try {
      // Check manual mapping overrides first
      if (this.manualMappings[githubUsername]) {
        const manualMapping = this.manualMappings[githubUsername];
        
        // Verify the manual mapping is valid
        const entraUser = await this.graphClient.getUserById(manualMapping.entraId);
        
        if (entraUser) {
          const mapping = {
            githubUsername,
            entraUserId: entraUser.id,
            displayName: entraUser.displayName,
            email: entraUser.mail || entraUser.userPrincipalName,
            source: 'manual',
            lastVerified: new Date().toISOString(),
            confidence: 1.0,
          };

          // Cache the mapping
          await this._storeMapping(githubUsername, mapping);

          // Track metric
          if (this.telemetryClient) {
            this.telemetryClient.trackMetric({
              name: 'UserMapper.MapUser.Duration',
              value: Date.now() - startTime,
            });
            this.telemetryClient.trackEvent({
              name: 'UserMapper.MapUser.Success',
              properties: {
                githubUsername,
                source: 'manual',
              },
            });
          }

          return mapping;
        }
      }

      // Check cached mapping
      const cachedMapping = await this._getCachedMapping(githubUsername);
      if (cachedMapping) {
        // Track cache hit
        if (this.telemetryClient) {
          this.telemetryClient.trackMetric({
            name: 'UserMapper.MapUser.Duration',
            value: Date.now() - startTime,
          });
          this.telemetryClient.trackEvent({
            name: 'UserMapper.MapUser.CacheHit',
            properties: { githubUsername },
          });
        }

        return cachedMapping;
      }

      // Attempt direct email match if email is provided
      if (githubEmail) {
        const emailMatch = await this._matchByEmail(githubUsername, githubEmail);
        if (emailMatch) {
          // Track metric
          if (this.telemetryClient) {
            this.telemetryClient.trackMetric({
              name: 'UserMapper.MapUser.Duration',
              value: Date.now() - startTime,
            });
            this.telemetryClient.trackEvent({
              name: 'UserMapper.MapUser.Success',
              properties: {
                githubUsername,
                source: 'email',
              },
            });
          }

          return emailMatch;
        }
      }

      // Attempt fuzzy matching by display name
      const fuzzyMatches = await this._fuzzyMatchByName(githubUsername);
      if (fuzzyMatches && fuzzyMatches.length > 0) {
        const bestMatch = fuzzyMatches[0];
        
        if (bestMatch.confidence >= this.config.fuzzyMatchThreshold) {
          // Track metric
          if (this.telemetryClient) {
            this.telemetryClient.trackMetric({
              name: 'UserMapper.MapUser.Duration',
              value: Date.now() - startTime,
            });
            this.telemetryClient.trackEvent({
              name: 'UserMapper.MapUser.Success',
              properties: {
                githubUsername,
                source: 'fuzzy',
                confidence: bestMatch.confidence,
              },
            });
          }

          return bestMatch;
        }
      }

      // No match found
      if (this.telemetryClient) {
        this.telemetryClient.trackMetric({
          name: 'UserMapper.MapUser.Duration',
          value: Date.now() - startTime,
        });
        this.telemetryClient.trackEvent({
          name: 'UserMapper.MapUser.NoMatch',
          properties: { githubUsername },
        });
      }

      return null;
    } catch (error) {
      if (this.telemetryClient) {
        this.telemetryClient.trackException({
          exception: error,
          properties: {
            operation: 'UserMapper.MapUser',
            githubUsername,
          },
        });
      }
      throw error;
    }
  }

  /**
   * Matches GitHub user by email address
   * @param {string} githubUsername - GitHub username
   * @param {string} email - Email address
   * @returns {Promise<Object|null>} Mapping result or null
   * @private
   */
  async _matchByEmail(githubUsername, email) {
    try {
      const entraUser = await this.graphClient.findUserByEmail(email);
      
      if (entraUser) {
        const mapping = {
          githubUsername,
          entraUserId: entraUser.id,
          displayName: entraUser.displayName,
          email: entraUser.mail || entraUser.userPrincipalName,
          source: 'email',
          lastVerified: new Date().toISOString(),
          confidence: 1.0,
        };

        // Cache the mapping
        await this._storeMapping(githubUsername, mapping);

        return mapping;
      }

      return null;
    } catch (error) {
      console.error('Error matching by email:', error);
      return null;
    }
  }

  /**
   * Performs fuzzy matching by display name
   * @param {string} githubUsername - GitHub username
   * @returns {Promise<Array>} Array of potential matches with confidence scores
   * @private
   */
  async _fuzzyMatchByName(githubUsername) {
    try {
      // Search for users with similar display names
      const users = await this.graphClient.findUsersByDisplayName(githubUsername);

      // Map to standard format
      const matches = users.map(user => ({
        githubUsername,
        entraUserId: user.id,
        displayName: user.displayName,
        email: user.mail || user.userPrincipalName,
        source: 'fuzzy',
        lastVerified: new Date().toISOString(),
        confidence: user.confidence,
      }));

      // Cache the best match if confidence is high enough
      if (matches.length > 0 && matches[0].confidence >= this.config.fuzzyMatchThreshold) {
        await this._storeMapping(githubUsername, matches[0]);
      }

      return matches;
    } catch (error) {
      console.error('Error in fuzzy matching:', error);
      return [];
    }
  }

  /**
   * Gets a cached mapping
   * @param {string} githubUsername - GitHub username
   * @returns {Promise<Object|null>} Cached mapping or null
   * @private
   */
  async _getCachedMapping(githubUsername) {
    try {
      const key = `user_mapping:${githubUsername}`;
      const cached = await this.storage.get(key);

      if (!cached) return null;

      const mapping = typeof cached === 'string' ? JSON.parse(cached) : cached;

      // Check if mapping is still valid (within TTL)
      const lastVerified = new Date(mapping.lastVerified);
      const age = Date.now() - lastVerified.getTime();
      
      if (age > this.config.mappingTtl * 1000) {
        // Mapping is stale, remove from cache
        await this.storage.del(key);
        return null;
      }

      return mapping;
    } catch (error) {
      console.error('Error getting cached mapping:', error);
      return null;
    }
  }

  /**
   * Stores a mapping in cache
   * @param {string} githubUsername - GitHub username
   * @param {Object} mapping - Mapping object
   * @private
   */
  async _storeMapping(githubUsername, mapping) {
    try {
      const key = `user_mapping:${githubUsername}`;
      const value = JSON.stringify(mapping);

      if (this.storageType === 'redis') {
        await this.storage.set(key, value, 'EX', this.config.mappingTtl);
      } else {
        await this.storage.set(key, value, this.config.mappingTtl);
      }
    } catch (error) {
      console.error('Error storing mapping:', error);
    }
  }

  /**
   * Validates and refreshes existing mappings
   * Intended to be run periodically (e.g., weekly)
   * @returns {Promise<Object>} Validation results
   */
  async validateMappings() {
    const startTime = Date.now();
    const results = {
      validated: 0,
      refreshed: 0,
      removed: 0,
      errors: 0,
    };

    try {
      // Get all mapping keys
      const pattern = 'user_mapping:*';
      const keys = await this.storage.keys(pattern);

      for (const key of keys) {
        try {
          const cached = await this.storage.get(key);
          if (!cached) continue;

          const mapping = typeof cached === 'string' ? JSON.parse(cached) : cached;

          // Verify the Entra ID user still exists
          const entraUser = await this.graphClient.getUserById(mapping.entraUserId);

          if (entraUser) {
            // Update mapping with fresh data
            mapping.displayName = entraUser.displayName;
            mapping.email = entraUser.mail || entraUser.userPrincipalName;
            mapping.lastVerified = new Date().toISOString();

            await this._storeMapping(mapping.githubUsername, mapping);
            results.refreshed++;
          } else {
            // User no longer exists, remove mapping
            await this.storage.del(key);
            results.removed++;
          }

          results.validated++;
        } catch (error) {
          console.error(`Error validating mapping ${key}:`, error);
          results.errors++;
        }
      }

      // Track metric
      if (this.telemetryClient) {
        this.telemetryClient.trackMetric({
          name: 'UserMapper.ValidateMappings.Duration',
          value: Date.now() - startTime,
        });
        this.telemetryClient.trackEvent({
          name: 'UserMapper.ValidateMappings.Completed',
          properties: results,
        });
      }

      return results;
    } catch (error) {
      if (this.telemetryClient) {
        this.telemetryClient.trackException({
          exception: error,
          properties: { operation: 'UserMapper.ValidateMappings' },
        });
      }
      throw error;
    }
  }

  /**
   * Gets fallback recipients for notifications when mapping fails
   * @param {string} repository - Repository name (owner/repo)
   * @param {Object} [config] - Fallback configuration
   * @returns {Promise<Array>} Array of fallback recipient IDs
   */
  async getFallbackRecipients(repository, config = {}) {
    const fallbacks = [];

    // Add repository owners from config
    if (config.repositoryOwners && config.repositoryOwners[repository]) {
      fallbacks.push(...config.repositoryOwners[repository]);
    }

    // Add default fallback recipients
    if (config.defaultRecipients) {
      fallbacks.push(...config.defaultRecipients);
    }

    // Track fallback usage
    if (this.telemetryClient) {
      this.telemetryClient.trackEvent({
        name: 'UserMapper.FallbackRecipients.Used',
        properties: {
          repository,
          count: fallbacks.length,
        },
      });
    }

    return [...new Set(fallbacks)]; // Remove duplicates
  }

  /**
   * Closes storage connections
   */
  async close() {
    if (this.storageType === 'redis' && this.storage) {
      await this.storage.quit();
    }
  }
}

module.exports = UserMapper;
