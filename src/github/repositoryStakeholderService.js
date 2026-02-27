/**
 * Repository Stakeholder Service
 * 
 * Identifies repository stakeholders including owners and security champions
 * from various sources (CODEOWNERS, custom properties, repository topics).
 * 
 * @module github/repositoryStakeholderService
 */

const { RepositoryMetadataCache } = require('../cache');

/**
 * Repository Stakeholder Service for identifying owners and security champions
 */
class RepositoryStakeholderService {
  /**
   * Creates a new RepositoryStakeholderService instance
   * @param {Object} config - Configuration object
   * @param {Object} config.githubClient - GitHubClient instance
   * @param {Object} [config.cache] - Cache instance
   * @param {Object} [config.redis] - Redis configuration
   * @param {number} [config.cacheTtl=3600] - Cache TTL in seconds (default: 1 hour)
   * @param {Object} [config.telemetryClient] - Optional Application Insights client
   */
  constructor(config) {
    if (!config || !config.githubClient) {
      throw new Error('githubClient is required');
    }

    this.githubClient = config.githubClient;
    this.telemetryClient = config.telemetryClient;
    this.cacheTtl = config.cacheTtl || 3600; // 1 hour

    // Initialize cache
    this.cache = config.cache || new RepositoryMetadataCache({
      repositoryTtl: this.cacheTtl,
      redis: config.redis,
      telemetryClient: this.telemetryClient,
    });
  }

  /**
   * Retrieves repository owners (up to 2 designated owners)
   * 
   * Sources (in order of precedence):
   * 1. GitHub repository custom properties (owner_1, owner_2)
   * 2. CODEOWNERS file default rule
   * 3. Repository admins
   * 
   * @param {string} owner - Repository owner (org/user)
   * @param {string} repo - Repository name
   * @returns {Promise<Array<Object>>} Array of owner objects with github_login and source
   */
  async getRepositoryOwners(owner, repo) {
    const startTime = Date.now();
    const cacheKey = `repo-owners:${owner}/${repo}`;

    try {
      // Check cache first
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        if (this.telemetryClient) {
          this.telemetryClient.trackEvent('RepositoryOwnersRetrieved', {
            repository: `${owner}/${repo}`,
            source: 'cache',
            count: String(cached.length),
          });
        }
        return cached;
      }

      const owners = [];

      // 1. Try custom properties first
      try {
        const customProperties = await this.githubClient.getRepositoryCustomProperties(owner, repo);
        
        if (customProperties?.owner_1) {
          owners.push({
            github_login: customProperties.owner_1,
            source: 'custom_property',
          });
        }
        
        if (customProperties?.owner_2) {
          owners.push({
            github_login: customProperties.owner_2,
            source: 'custom_property',
          });
        }

        if (owners.length > 0) {
          // TODO: Replace console.log with structured logging framework (Winston/Bunyan)
          console.log(`Found ${owners.length} owners from custom properties for ${owner}/${repo}`);
        }
      } catch (error) {
        console.warn(`Could not retrieve custom properties for ${owner}/${repo}:`, error.message);
      }

      // 2. Try CODEOWNERS file if we don't have enough owners
      if (owners.length < 2) {
        try {
          const codeownersContent = await this.githubClient.getFileContent(owner, repo, 'CODEOWNERS');
          const codeowners = this._parseCodeowners(codeownersContent);
          
          // Look for default rule (*)
          if (codeowners['*']) {
            for (const ownerLogin of codeowners['*']) {
              if (owners.length >= 2) break;
              
              // Avoid duplicates
              if (!owners.find(o => o.github_login === ownerLogin)) {
                owners.push({
                  github_login: ownerLogin,
                  source: 'codeowners',
                });
              }
            }
          }

          if (codeowners['*']?.length > 0) {
            console.log(`Found ${codeowners['*'].length} owners from CODEOWNERS for ${owner}/${repo}`);
          }
        } catch (error) {
          // CODEOWNERS file might not exist, which is fine
          console.debug(`CODEOWNERS not found for ${owner}/${repo}:`, error.message);
        }
      }

      // 3. Fall back to repository admins if we still don't have enough
      if (owners.length < 2) {
        try {
          const admins = await this.githubClient.getRepositoryAdmins(owner, repo);
          
          for (const admin of admins) {
            if (owners.length >= 2) break;
            
            // Avoid duplicates
            if (!owners.find(o => o.github_login === admin.login)) {
              owners.push({
                github_login: admin.login,
                source: 'admin',
              });
            }
          }

          console.log(`Found ${admins.length} admins for ${owner}/${repo}`);
        } catch (error) {
          console.error(`Could not retrieve admins for ${owner}/${repo}:`, error.message);
        }
      }

      // Cache the result
      await this.cache.set(cacheKey, owners, this.cacheTtl);

      // Track telemetry
      if (this.telemetryClient) {
        const duration = Date.now() - startTime;
        this.telemetryClient.trackMetric('RepositoryOwnersRetrievalDuration', duration, {
          repository: `${owner}/${repo}`,
          count: String(owners.length),
        });
        this.telemetryClient.trackEvent('RepositoryOwnersRetrieved', {
          repository: `${owner}/${repo}`,
          source: 'api',
          count: String(owners.length),
          sources: [...new Set(owners.map(o => o.source))].join(','),
        });
      }

      return owners;
    } catch (error) {
      console.error(`Error retrieving repository owners for ${owner}/${repo}:`, error);
      
      if (this.telemetryClient) {
        this.telemetryClient.trackException(error, {
          repository: `${owner}/${repo}`,
          operation: 'getRepositoryOwners',
        });
      }

      return [];
    }
  }

  /**
   * Retrieves the security champion for a repository
   * 
   * Sources (in order of precedence):
   * 1. GitHub repository custom property (security_champion)
   * 2. Repository topic (security-champion:@username)
   * 3. Organization default (from config or fallback)
   * 
   * @param {string} owner - Repository owner (org/user)
   * @param {string} repo - Repository name
   * @returns {Promise<Object|null>} Security champion object with github_login and source
   */
  async getSecurityChampion(owner, repo) {
    const startTime = Date.now();
    const cacheKey = `security-champion:${owner}/${repo}`;

    try {
      // Check cache first
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        if (this.telemetryClient) {
          this.telemetryClient.trackEvent('SecurityChampionRetrieved', {
            repository: `${owner}/${repo}`,
            source: 'cache',
          });
        }
        return cached;
      }

      let champion = null;

      // 1. Try custom properties first
      try {
        const customProperties = await this.githubClient.getRepositoryCustomProperties(owner, repo);
        
        if (customProperties?.security_champion) {
          champion = {
            github_login: customProperties.security_champion,
            source: 'custom_property',
          };
          console.log(`Found security champion from custom property for ${owner}/${repo}: ${champion.github_login}`);
        }
      } catch (error) {
        console.warn(`Could not retrieve custom properties for ${owner}/${repo}:`, error.message);
      }

      // 2. Try repository topics if no champion found
      if (!champion) {
        try {
          const topics = await this.githubClient.getRepositoryTopics(owner, repo);
          
          // Look for security-champion:@username or security-champion:username pattern
          for (const topic of topics) {
            const match = topic.match(/^security-champion:@?(.+)$/i);
            if (match) {
              champion = {
                github_login: match[1],
                source: 'topic',
              };
              console.log(`Found security champion from topic for ${owner}/${repo}: ${champion.github_login}`);
              break;
            }
          }
        } catch (error) {
          console.warn(`Could not retrieve topics for ${owner}/${repo}:`, error.message);
        }
      }

      // 3. Fall back to organization default (placeholder for now)
      if (!champion) {
        console.log(`No security champion found for ${owner}/${repo}, will notify org security team`);
        // In a real implementation, this would check organization config
        // For now, return null to indicate fallback to org security team
        champion = null;
      }

      // Cache the result (even if null)
      await this.cache.set(cacheKey, champion, this.cacheTtl);

      // Track telemetry
      if (this.telemetryClient) {
        const duration = Date.now() - startTime;
        this.telemetryClient.trackMetric('SecurityChampionRetrievalDuration', duration, {
          repository: `${owner}/${repo}`,
          found: champion ? 'true' : 'false',
        });
        this.telemetryClient.trackEvent('SecurityChampionRetrieved', {
          repository: `${owner}/${repo}`,
          source: champion ? champion.source : 'none',
          found: champion ? 'true' : 'false',
        });
      }

      return champion;
    } catch (error) {
      console.error(`Error retrieving security champion for ${owner}/${repo}:`, error);
      
      if (this.telemetryClient) {
        this.telemetryClient.trackException(error, {
          repository: `${owner}/${repo}`,
          operation: 'getSecurityChampion',
        });
      }

      return null;
    }
  }

  /**
   * Parses CODEOWNERS file content
   * 
   * @param {string} content - CODEOWNERS file content
   * @returns {Object} Map of patterns to owner arrays
   * @private
   */
  _parseCodeowners(content) {
    const codeowners = {};
    
    if (!content) return codeowners;

    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Parse line: pattern @owner1 @owner2 ...
      const parts = trimmed.split(/\s+/);
      if (parts.length < 2) {
        continue;
      }

      const pattern = parts[0];
      const owners = parts.slice(1)
        .filter(part => part.startsWith('@'))
        .map(part => part.substring(1)); // Remove @ prefix

      if (owners.length > 0) {
        codeowners[pattern] = owners;
      }
    }

    return codeowners;
  }

  /**
   * Retrieves all stakeholders for a repository (owners + security champion)
   * 
   * @param {string} owner - Repository owner (org/user)
   * @param {string} repo - Repository name
   * @returns {Promise<Object>} Object with owners and securityChampion
   */
  async getAllStakeholders(owner, repo) {
    const [owners, securityChampion] = await Promise.all([
      this.getRepositoryOwners(owner, repo),
      this.getSecurityChampion(owner, repo),
    ]);

    return {
      owners,
      securityChampion,
      repository: `${owner}/${repo}`,
    };
  }
}

module.exports = RepositoryStakeholderService;
