/**
 * Repository Member Mapping Service
 *
 * Maps GitHub repository members to Microsoft Teams (Entra ID) user IDs by
 * reusing the UserMapper from Story 1.3. Members are processed in batches of
 * 20 to align with the Graph API $batch limit. Results are cached with a
 * 1-hour TTL so that stale data is refreshed every hour.
 *
 * @module github/repositoryMemberMappingService
 */

const { RepositoryMetadataCache } = require('../cache');

/**
 * Maps a list of repository members (GitHub logins) to Entra ID / Teams user IDs.
 */
class RepositoryMemberMappingService {
  /**
   * Creates a new RepositoryMemberMappingService instance
   * @param {Object} config - Configuration object
   * @param {Object} config.userMapper - UserMapper instance (from Story 1.3)
   * @param {Object} [config.cache] - Cache instance
   * @param {Object} [config.redis] - Redis configuration
   * @param {number} [config.cacheTtl=3600] - Mapping cache TTL in seconds (default: 1 hour)
   * @param {number} [config.batchSize=20] - Members per processing batch (Graph API $batch limit)
   * @param {Array<string>} [config.adminRecipients=[]] - Entra ID user IDs to notify about unmapped users
   * @param {Object} [config.telemetryClient] - Optional Application Insights client
   */
  constructor(config) {
    if (!config || !config.userMapper) {
      throw new Error('userMapper is required');
    }

    this.userMapper = config.userMapper;
    this.telemetryClient = config.telemetryClient;
    this.cacheTtl = config.cacheTtl || 3600; // 1 hour
    this.batchSize = config.batchSize || 20;
    this.adminRecipients = config.adminRecipients || [];

    // Initialize cache for member mappings
    this.cache = config.cache || new RepositoryMetadataCache({
      repositoryTtl: this.cacheTtl,
      userListTtl: this.cacheTtl,
      redis: config.redis,
      telemetryClient: this.telemetryClient,
    });
  }

  /**
   * Maps a list of repository members to Entra ID / Teams user IDs.
   *
   * Members are processed in batches of `batchSize` (default 20) to stay
   * within the Graph API $batch limit. Successfully mapped users are returned;
   * unmapped users are logged as warnings and admin recipients are notified.
   *
   * @param {Array<Object>} members - Repository members to map
   * @param {string} members[].login - GitHub username
   * @param {string} [members[].email] - GitHub email (improves match accuracy)
   * @param {Object} [options] - Options
   * @param {boolean} [options.useCache=true] - Use cached mappings when available
   * @returns {Promise<Object>} Mapping result with `mapped` and `unmapped` arrays
   */
  async mapRepositoryMembers(members, options = {}) {
    const { useCache = true } = options;
    const startTime = Date.now();

    if (!members || members.length === 0) {
      return { mapped: [], unmapped: [] };
    }

    const mapped = [];
    const unmapped = [];

    try {
      // Split members into batches of batchSize (Graph API $batch limit)
      const batches = this._splitIntoBatches(members, this.batchSize);

      for (const batch of batches) {
        const batchResults = await this._processBatch(batch, useCache);
        mapped.push(...batchResults.mapped);
        unmapped.push(...batchResults.unmapped);
      }

      // Log and notify about unmapped users
      if (unmapped.length > 0) {
        this._handleUnmappedUsers(unmapped);
      }

      // Track telemetry
      if (this.telemetryClient) {
        this.telemetryClient.trackMetric({
          name: 'RepositoryMemberMappingService.MapMembers.Duration',
          value: Date.now() - startTime,
        });
        this.telemetryClient.trackEvent({
          name: 'RepositoryMemberMappingService.MapMembers.Completed',
          properties: {
            totalMembers: String(members.length),
            mappedCount: String(mapped.length),
            unmappedCount: String(unmapped.length),
          },
        });
      }

      return { mapped, unmapped };
    } catch (error) {
      if (this.telemetryClient) {
        this.telemetryClient.trackException({
          exception: error,
          properties: { operation: 'RepositoryMemberMappingService.MapMembers' },
        });
      }
      throw error;
    }
  }

  /**
   * Maps a single repository member to an Entra ID / Teams user ID.
   *
   * Checks the service-level cache first (1-hour TTL). On a cache miss the
   * UserMapper is called and the result is stored in the cache.
   *
   * @param {string} login - GitHub username
   * @param {string} [email] - GitHub email address
   * @param {boolean} [useCache=true] - Use cached mapping when available
   * @returns {Promise<Object|null>} Mapping result or null if not found
   */
  async mapMember(login, email = null, useCache = true) {
    try {
      // Check service-level cache first
      if (useCache) {
        const cacheKey = this._getCacheKey(login);
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          if (this.telemetryClient) {
            this.telemetryClient.trackEvent({
              name: 'RepositoryMemberMappingService.MapMember.CacheHit',
              properties: { login },
            });
          }
          return cached;
        }
      }

      // Delegate to UserMapper (handles manual, cache, email, fuzzy strategies)
      const mapping = await this.userMapper.mapUser(login, email);

      if (mapping) {
        // Store in service-level cache with 1-hour TTL
        const cacheKey = this._getCacheKey(login);
        await this.cache.set(cacheKey, mapping, this.cacheTtl);
      }

      return mapping;
    } catch (error) {
      console.error(`Error mapping member ${login}:`, error.message);

      if (this.telemetryClient) {
        this.telemetryClient.trackException({
          exception: error,
          properties: {
            operation: 'RepositoryMemberMappingService.MapMember',
            login,
          },
        });
      }

      // Return null so batch processing continues with other members
      return null;
    }
  }

  /**
   * Processes a batch of members concurrently (up to batchSize at a time).
   * @param {Array<Object>} batch - Batch of members to process
   * @param {boolean} useCache - Whether to use cached mappings
   * @returns {Promise<Object>} Object with `mapped` and `unmapped` arrays
   * @private
   */
  async _processBatch(batch, useCache) {
    const results = await Promise.all(
      batch.map(member => this.mapMember(member.login, member.email || null, useCache))
    );

    const mapped = [];
    const unmapped = [];

    results.forEach((mapping, index) => {
      if (mapping) {
        mapped.push(mapping);
      } else {
        unmapped.push(batch[index].login);
      }
    });

    return { mapped, unmapped };
  }

  /**
   * Logs warnings for unmapped users and notifies admin recipients.
   * @param {Array<string>} unmappedLogins - GitHub logins that could not be mapped
   * @private
   */
  _handleUnmappedUsers(unmappedLogins) {
    console.warn(
      `[RepositoryMemberMappingService] ${unmappedLogins.length} user(s) could not be mapped to Teams: ${unmappedLogins.join(', ')}`
    );

    if (this.telemetryClient) {
      this.telemetryClient.trackEvent({
        name: 'RepositoryMemberMappingService.UnmappedUsers',
        properties: {
          unmappedLogins: unmappedLogins.join(','),
          unmappedCount: String(unmappedLogins.length),
          adminRecipientCount: String(this.adminRecipients.length),
        },
      });
    }

    if (this.adminRecipients.length > 0) {
      // Notify admins – in production this would dispatch an alert; here we
      // log the intent so downstream components can act on it.
      console.warn(
        `[RepositoryMemberMappingService] Admin notification queued for ${this.adminRecipients.length} recipient(s) regarding unmapped users: ${unmappedLogins.join(', ')}`
      );
    }
  }

  /**
   * Splits an array into batches of the specified size.
   * @param {Array} items - Items to batch
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
   * Returns the cache key for a GitHub login.
   * @param {string} login - GitHub username
   * @returns {string} Cache key
   * @private
   */
  _getCacheKey(login) {
    return `repo-member-mapping:${login}`;
  }
}

module.exports = RepositoryMemberMappingService;
