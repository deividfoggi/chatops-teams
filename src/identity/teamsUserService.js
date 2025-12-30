/**
 * Teams User Service
 * 
 * Retrieves Teams user objects for notifications with caching, batch optimization,
 * presence information, and error handling.
 * 
 * @module identity/teamsUserService
 */

const GraphClient = require('./graphClient');
const { RepositoryMetadataCache } = require('../cache');

/**
 * Teams User Service for retrieving user information with caching
 */
class TeamsUserService {
  /**
   * Creates a new TeamsUserService instance
   * @param {Object} config - Configuration object
   * @param {Object} [config.graphClient] - GraphClient instance
   * @param {Object} [config.cache] - Cache instance
   * @param {Object} [config.redis] - Redis configuration
   * @param {number} [config.userCacheTtl=3600] - User cache TTL in seconds (default: 1 hour)
   * @param {number} [config.batchSize=20] - Max users per batch request
   * @param {number} [config.maxRetries=3] - Max retry attempts on failure
   * @param {Object} [config.telemetryClient] - Optional Application Insights client
   */
  constructor(config = {}) {
    this.config = {
      userCacheTtl: config.userCacheTtl || 3600, // 1 hour
      batchSize: config.batchSize || 20,
      maxRetries: config.maxRetries || 3,
      ...config,
    };

    this.graphClient = config.graphClient || new GraphClient(config);
    this.telemetryClient = config.telemetryClient;
    
    // Initialize cache for Teams user objects
    this.cache = config.cache || new RepositoryMetadataCache({
      repositoryTtl: this.config.userCacheTtl,
      userListTtl: this.config.userCacheTtl,
      redis: config.redis,
      telemetryClient: this.telemetryClient,
    });
  }

  /**
   * Retrieves a single Teams user with presence information
   * @param {string} userId - Entra ID user ID
   * @param {Object} [options] - Retrieval options
   * @param {boolean} [options.includePresence=true] - Include presence information
   * @param {boolean} [options.useCache=true] - Use cached data if available
   * @returns {Promise<Object|null>} Teams user object or null if not found
   */
  async getUser(userId, options = {}) {
    const { includePresence = true, useCache = true } = options;
    const startTime = Date.now();

    try {
      // Check cache first
      if (useCache) {
        const cacheKey = this._getUserCacheKey(userId);
        const cached = await this.cache.get(cacheKey);
        
        if (cached) {
          if (this.telemetryClient) {
            this.telemetryClient.trackMetric({
              name: 'TeamsUserService.GetUser.Duration',
              value: Date.now() - startTime,
            });
            this.telemetryClient.trackEvent({
              name: 'TeamsUserService.GetUser.CacheHit',
              properties: { userId },
            });
          }
          return cached;
        }
      }

      // Fetch user from Graph API
      const user = await this.graphClient.getUserById(userId);
      
      if (!user) {
        if (this.telemetryClient) {
          this.telemetryClient.trackEvent({
            name: 'TeamsUserService.GetUser.NotFound',
            properties: { userId },
          });
        }
        return null;
      }

      // Enrich with presence if requested
      if (includePresence) {
        const presence = await this.graphClient.getUserPresence(userId);
        user.presence = presence;
      }

      // Cache the user object
      const cacheKey = this._getUserCacheKey(userId);
      await this.cache.set(cacheKey, user, this.config.userCacheTtl);

      // Track metric
      if (this.telemetryClient) {
        this.telemetryClient.trackMetric({
          name: 'TeamsUserService.GetUser.Duration',
          value: Date.now() - startTime,
        });
        this.telemetryClient.trackEvent({
          name: 'TeamsUserService.GetUser.Success',
          properties: {
            userId,
            isGuest: user.userType === 'Guest',
          },
        });
      }

      return user;
    } catch (error) {
      if (this.telemetryClient) {
        this.telemetryClient.trackException({
          exception: error,
          properties: {
            operation: 'TeamsUserService.GetUser',
            userId,
          },
        });
      }
      throw error;
    }
  }

  /**
   * Retrieves multiple Teams users in optimized batches
   * @param {Array<string>} userIds - Array of Entra ID user IDs
   * @param {Object} [options] - Retrieval options
   * @param {boolean} [options.includePresence=true] - Include presence information
   * @param {boolean} [options.useCache=true] - Use cached data if available
   * @param {boolean} [options.throwOnError=false] - Throw error on failure or return partial results
   * @returns {Promise<Array>} Array of Teams user objects
   */
  async getUsers(userIds, options = {}) {
    const { includePresence = true, useCache = true, throwOnError = false } = options;
    const startTime = Date.now();

    if (!userIds || userIds.length === 0) {
      return [];
    }

    try {
      const results = [];
      const uncachedIds = [];

      // Check cache for each user
      if (useCache) {
        for (const userId of userIds) {
          const cacheKey = this._getUserCacheKey(userId);
          const cached = await this.cache.get(cacheKey);
          
          if (cached) {
            results.push(cached);
          } else {
            uncachedIds.push(userId);
          }
        }
      } else {
        uncachedIds.push(...userIds);
      }

      // Fetch uncached users in batches
      if (uncachedIds.length > 0) {
        const batches = this._splitIntoBatches(uncachedIds, this.config.batchSize);
        
        for (const batch of batches) {
          try {
            const batchUsers = await this._fetchUserBatch(batch, includePresence);
            results.push(...batchUsers);

            // Cache each user
            for (const user of batchUsers) {
              const cacheKey = this._getUserCacheKey(user.id);
              await this.cache.set(cacheKey, user, this.config.userCacheTtl);
            }
          } catch (error) {
            console.error('Error fetching user batch:', error);
            
            if (throwOnError) {
              throw error;
            }
            
            // Continue with partial results
            if (this.telemetryClient) {
              this.telemetryClient.trackException({
                exception: error,
                properties: {
                  operation: 'TeamsUserService.GetUsers.BatchFailed',
                  batchSize: batch.length,
                },
              });
            }
          }
        }
      }

      // Track metrics
      if (this.telemetryClient) {
        this.telemetryClient.trackMetric({
          name: 'TeamsUserService.GetUsers.Duration',
          value: Date.now() - startTime,
        });
        this.telemetryClient.trackEvent({
          name: 'TeamsUserService.GetUsers.Success',
          properties: {
            requestedCount: userIds.length,
            retrievedCount: results.length,
            cacheHits: userIds.length - uncachedIds.length,
          },
        });
      }

      return results;
    } catch (error) {
      if (this.telemetryClient) {
        this.telemetryClient.trackException({
          exception: error,
          properties: {
            operation: 'TeamsUserService.GetUsers',
            userCount: userIds.length,
          },
        });
      }
      throw error;
    }
  }

  /**
   * Retrieves users with retry logic for resilience
   * @param {Array<string>} userIds - Array of Entra ID user IDs
   * @param {Object} [options] - Retrieval options
   * @returns {Promise<Array>} Array of Teams user objects
   */
  async getUsersWithRetry(userIds, options = {}) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const users = await this.getUsers(userIds, options);
        
        // Track retry success
        if (attempt > 1 && this.telemetryClient) {
          this.telemetryClient.trackEvent({
            name: 'TeamsUserService.GetUsersWithRetry.SuccessAfterRetry',
            properties: {
              attempt,
              userCount: userIds.length,
            },
          });
        }
        
        return users;
      } catch (error) {
        lastError = error;
        
        if (attempt < this.config.maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000;
          
          if (this.telemetryClient) {
            this.telemetryClient.trackEvent({
              name: 'TeamsUserService.GetUsersWithRetry.Attempt',
              properties: {
                attempt,
                nextDelayMs: delay,
                userCount: userIds.length,
              },
            });
          }
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    if (this.telemetryClient) {
      this.telemetryClient.trackException({
        exception: lastError,
        properties: {
          operation: 'TeamsUserService.GetUsersWithRetry.AllAttemptsFailed',
          attempts: this.config.maxRetries,
          userCount: userIds.length,
        },
      });
    }

    throw lastError;
  }

  /**
   * Determines notification urgency based on user presence
   * @param {Object} presence - User presence object
   * @returns {string} Urgency level: 'high', 'normal', 'low'
   */
  determineNotificationUrgency(presence) {
    if (!presence || !presence.availability) {
      return 'normal';
    }

    // High urgency if user is available or busy
    if (presence.availability === 'Available' || presence.availability === 'Busy') {
      return 'high';
    }

    // Low urgency if user is away, offline, or DND
    if (['Away', 'BeRightBack', 'DoNotDisturb', 'Offline'].includes(presence.availability)) {
      return 'low';
    }

    return 'normal';
  }

  /**
   * Checks if a user is a guest or external collaborator
   * @param {Object} user - User object
   * @returns {boolean} True if user is guest/external
   */
  isGuestUser(user) {
    return user && user.userType === 'Guest';
  }

  /**
   * Fetches a batch of users with presence
   * @param {Array<string>} userIds - Array of user IDs (max 20)
   * @param {boolean} includePresence - Include presence data
   * @returns {Promise<Array>} Array of user objects
   * @private
   */
  async _fetchUserBatch(userIds, includePresence) {
    // Fetch users
    const users = await this.graphClient.batchGetUsers(userIds);

    // Fetch presence if requested
    if (includePresence && users.length > 0) {
      try {
        const presences = await this.graphClient.batchGetPresence(users.map(u => u.id));
        
        // Merge presence data with users
        const presenceMap = new Map(presences.map(p => [p.userId, p.presence]));
        users.forEach(user => {
          user.presence = presenceMap.get(user.id) || null;
        });
      } catch (error) {
        console.error('Error fetching presence for batch:', error);
        // Continue without presence data
      }
    }

    return users;
  }

  /**
   * Splits an array into batches of specified size
   * @param {Array} items - Array to split
   * @param {number} batchSize - Size of each batch
   * @returns {Array<Array>} Array of batches
   * @private
   */
  _splitIntoBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Generates cache key for a user
   * @param {string} userId - User ID
   * @returns {string} Cache key
   * @private
   */
  _getUserCacheKey(userId) {
    return `teams:user:${userId}`;
  }

  /**
   * Clears cached user data
   * @param {string} [userId] - Optional user ID to clear specific user
   */
  async clearCache(userId = null) {
    if (userId) {
      const cacheKey = this._getUserCacheKey(userId);
      await this.cache.delete(cacheKey);
    } else {
      await this.cache.clearPattern('teams:user:*');
    }
  }

  /**
   * Closes connections
   */
  async close() {
    // Cache cleanup handled by cache instance
  }
}

module.exports = TeamsUserService;
