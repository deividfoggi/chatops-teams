/**
 * GitHub API Client
 * 
 * Provides authenticated access to GitHub REST API v3 and GraphQL API
 * with rate limiting, caching, and exponential backoff.
 * 
 * @module github/githubClient
 */

const crypto = require('crypto');

/**
 * Simple in-memory cache with TTL
 */
class Cache {
  constructor(ttlMs = 300000) { // Default 5 minutes
    this.cache = new Map();
    this.ttlMs = ttlMs;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  set(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  clear() {
    this.cache.clear();
  }
}

/**
 * Rate limiter with exponential backoff
 */
class RateLimiter {
  constructor() {
    this.remaining = null;
    this.reset = null;
    this.retryAfter = null;
    this.queue = [];
    this.processing = false;
  }

  /**
   * Updates rate limit info from API response headers
   */
  updateFromHeaders(headers) {
    if (headers['x-ratelimit-remaining']) {
      this.remaining = parseInt(headers['x-ratelimit-remaining'], 10);
    }
    if (headers['x-ratelimit-reset']) {
      this.reset = parseInt(headers['x-ratelimit-reset'], 10) * 1000;
    }
    if (headers['retry-after']) {
      this.retryAfter = Date.now() + (parseInt(headers['retry-after'], 10) * 1000);
    }
  }

  /**
   * Checks if request should be throttled
   */
  shouldThrottle() {
    if (this.retryAfter && Date.now() < this.retryAfter) {
      return true;
    }
    
    if (this.remaining !== null && this.remaining < 10) {
      return true;
    }
    
    return false;
  }

  /**
   * Gets wait time in milliseconds for exponential backoff
   */
  getWaitTime(attempt = 0) {
    if (this.retryAfter && Date.now() < this.retryAfter) {
      return this.retryAfter - Date.now();
    }
    
    if (this.reset && this.remaining !== null && this.remaining < 10) {
      return Math.max(0, this.reset - Date.now());
    }
    
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    return Math.min(1000 * Math.pow(2, attempt), 16000);
  }

  /**
   * Queues a request to be executed when rate limits allow
   */
  async queueRequest(requestFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ requestFn, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Processes queued requests
   */
  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      if (this.shouldThrottle()) {
        const waitTime = this.getWaitTime();
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      const { requestFn, resolve, reject } = this.queue.shift();
      
      try {
        const result = await requestFn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    this.processing = false;
  }
}

/**
 * GitHub API Client
 */
class GitHubClient {
  /**
   * Creates a new GitHub API client
   * 
   * @param {Object} config - Configuration options
   * @param {string} config.appId - GitHub App ID
   * @param {string} config.privateKey - GitHub App private key (PEM format)
   * @param {number} [config.installationId] - GitHub App installation ID
   * @param {string} [config.token] - Personal access token (alternative to App auth)
   * @param {string} [config.apiUrl='https://api.github.com'] - GitHub API base URL
   * @param {Object} [config.telemetryClient] - Application Insights client
   */
  constructor(config = {}) {
    this.config = {
      appId: config.appId || process.env.GITHUB_APP_ID,
      privateKey: config.privateKey || process.env.GITHUB_PRIVATE_KEY,
      installationId: config.installationId || process.env.GITHUB_INSTALLATION_ID,
      token: config.token || process.env.GITHUB_TOKEN,
      apiUrl: config.apiUrl || 'https://api.github.com',
      telemetryClient: config.telemetryClient,
    };

    this.cache = new Cache(300000); // 5 minutes
    this.rateLimiter = new RateLimiter();
    this.installationToken = null;
    this.installationTokenExpiry = null;
  }

  /**
   * Generates a JWT token for GitHub App authentication
   * 
   * @returns {string} JWT token
   */
  generateJWT() {
    if (!this.config.appId || !this.config.privateKey) {
      throw new Error('GitHub App ID and private key are required for JWT generation');
    }

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now - 60, // Issued 60 seconds in the past to account for clock drift
      exp: now + 600, // Expires in 10 minutes
      iss: this.config.appId,
    };

    // Create JWT manually (simple implementation)
    const header = { alg: 'RS256', typ: 'JWT' };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    
    const signature = crypto.sign('RSA-SHA256', Buffer.from(signatureInput), {
      key: this.config.privateKey,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    });
    
    const encodedSignature = signature.toString('base64url');
    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
  }

  /**
   * Gets an installation access token
   * 
   * @returns {Promise<string>} Installation access token
   */
  async getInstallationToken() {
    // Return cached token if still valid
    if (this.installationToken && this.installationTokenExpiry && Date.now() < this.installationTokenExpiry) {
      return this.installationToken;
    }

    if (!this.config.installationId) {
      throw new Error('GitHub App installation ID is required');
    }

    const jwt = this.generateJWT();
    const url = `${this.config.apiUrl}/app/installations/${this.config.installationId}/access_tokens`;

    const response = await this._makeRequest('POST', url, null, {
      'Authorization': `Bearer ${jwt}`,
    });

    this.installationToken = response.token;
    // Set expiry to 5 minutes before actual expiry for safety
    this.installationTokenExpiry = Date.now() + (55 * 60 * 1000);

    return this.installationToken;
  }

  /**
   * Gets the authorization header for API requests
   * 
   * @returns {Promise<Object>} Headers object with authorization
   */
  async getAuthHeaders() {
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'ChatOps-Teams-App',
    };

    if (this.config.token) {
      headers['Authorization'] = `token ${this.config.token}`;
    } else if (this.config.appId && this.config.privateKey && this.config.installationId) {
      const token = await this.getInstallationToken();
      headers['Authorization'] = `token ${token}`;
    } else {
      throw new Error('GitHub authentication not configured. Provide either token or App credentials.');
    }

    return headers;
  }

  /**
   * Makes an HTTP request to GitHub API with retry logic
   * 
   * Note: Uses Node.js built-in fetch (available in Node.js 18+)
   * 
   * @param {string} method - HTTP method
   * @param {string} url - Full URL
   * @param {Object} [body] - Request body
   * @param {Object} [additionalHeaders] - Additional headers
   * @param {number} [attempt=0] - Current attempt number for retries
   * @returns {Promise<Object>} Response data
   */
  async _makeRequest(method, url, body = null, additionalHeaders = {}, attempt = 0) {
    const startTime = Date.now();
    
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...additionalHeaders,
      };

      const options = {
        method,
        headers,
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);
      const duration = Date.now() - startTime;

      // Update rate limiter
      this.rateLimiter.updateFromHeaders(response.headers);

      // Track API call
      if (this.config.telemetryClient) {
        this.config.telemetryClient.trackGitHubApiCall(
          `${method} ${new URL(url).pathname}`,
          duration,
          response.status,
          response.ok
        );
      }

      // Handle rate limiting
      if (response.status === 403 || response.status === 429) {
        const waitTime = this.rateLimiter.getWaitTime(attempt);
        
        if (attempt < 5) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
          return this._makeRequest(method, url, body, additionalHeaders, attempt + 1);
        }
        
        throw new Error(`Rate limit exceeded after ${attempt + 1} attempts`);
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`GitHub API error (${response.status}): ${error}`);
      }

      const data = await response.json();
      return data;

    } catch (error) {
      if (this.config.telemetryClient) {
        this.config.telemetryClient.trackException(error, {
          method,
          url,
          attempt,
        });
      }
      throw error;
    }
  }

  /**
   * Makes an authenticated API request with caching
   * 
   * @param {string} method - HTTP method
   * @param {string} path - API path (e.g., '/repos/owner/repo')
   * @param {Object} [body] - Request body
   * @param {boolean} [useCache=true] - Whether to use cache for GET requests
   * @returns {Promise<Object>} Response data
   */
  async request(method, path, body = null, useCache = true) {
    const url = `${this.config.apiUrl}${path}`;
    const cacheKey = `${method}:${path}`;

    // Check cache for GET requests
    if (method === 'GET' && useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Check if we should throttle
    if (this.rateLimiter.shouldThrottle()) {
      return this.rateLimiter.queueRequest(async () => {
        const headers = await this.getAuthHeaders();
        return this._makeRequest(method, url, body, headers);
      });
    }

    const headers = await this.getAuthHeaders();
    const data = await this._makeRequest(method, url, body, headers);

    // Cache GET requests
    if (method === 'GET' && useCache) {
      this.cache.set(cacheKey, data);
    }

    return data;
  }

  /**
   * Gets repository information including owners
   * 
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Object>} Repository data with owner information
   */
  async getRepository(owner, repo) {
    const data = await this.request('GET', `/repos/${owner}/${repo}`);
    
    return {
      id: data.id,
      name: data.name,
      fullName: data.full_name,
      owner: {
        login: data.owner.login,
        id: data.owner.id,
        type: data.owner.type,
        siteAdmin: data.owner.site_admin,
      },
      private: data.private,
      description: data.description,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Gets commit information including author details
   * 
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} sha - Commit SHA
   * @returns {Promise<Object>} Commit data with author information
   */
  async getCommit(owner, repo, sha) {
    const data = await this.request('GET', `/repos/${owner}/${repo}/commits/${sha}`);
    
    return {
      sha: data.sha,
      commit: {
        message: data.commit.message,
        author: {
          name: data.commit.author.name,
          email: data.commit.author.email,
          date: data.commit.author.date,
        },
        committer: {
          name: data.commit.committer.name,
          email: data.commit.committer.email,
          date: data.commit.committer.date,
        },
      },
      author: data.author ? {
        login: data.author.login,
        id: data.author.id,
        type: data.author.type,
      } : null,
      committer: data.committer ? {
        login: data.committer.login,
        id: data.committer.id,
        type: data.committer.type,
      } : null,
      parents: data.parents.map(p => ({ sha: p.sha, url: p.url })),
    };
  }

  /**
   * Gets security champion metadata from repository custom properties or CODEOWNERS
   * 
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Object>} Security champion information
   */
  async getSecurityChampion(owner, repo) {
    try {
      // Try to get CODEOWNERS file which often contains security team info
      const codeowners = await this.request('GET', `/repos/${owner}/${repo}/contents/.github/CODEOWNERS`, null, false);
      
      if (codeowners && codeowners.content) {
        const content = Buffer.from(codeowners.content, 'base64').toString('utf-8');
        
        // Parse for security-related entries
        const lines = content.split('\n');
        const securityLines = lines.filter(line => 
          line.toLowerCase().includes('security') && line.includes('@')
        );
        
        if (securityLines.length > 0) {
          // Extract GitHub usernames/teams from the line
          const matches = securityLines[0].match(/@[\w-]+/g);
          const champions = matches ? matches.map(m => m.substring(1)) : [];
          
          return {
            found: true,
            source: 'CODEOWNERS',
            champions,
            rawLine: securityLines[0].trim(),
          };
        }
      }
    } catch (error) {
      // CODEOWNERS file might not exist
    }

    // Try to get repository topics/custom properties
    try {
      const repo = await this.request('GET', `/repos/${owner}/${repo}`);
      
      // Check topics for security-champion tag
      if (repo.topics && repo.topics.includes('security-champion')) {
        return {
          found: true,
          source: 'repository-topics',
          champions: [],
          message: 'Repository has security-champion topic',
        };
      }
    } catch (error) {
      // Ignore
    }

    return {
      found: false,
      source: null,
      champions: [],
      message: 'No security champion metadata found',
    };
  }

  /**
   * Gets a list of items with pagination support
   * 
   * @param {string} path - API path
   * @param {Object} [options] - Pagination options
   * @param {number} [options.perPage=30] - Items per page
   * @param {number} [options.page=1] - Page number
   * @returns {Promise<Array>} Array of items
   */
  async getPaginated(path, options = {}) {
    const perPage = options.perPage || 30;
    const page = options.page || 1;
    
    const separator = path.includes('?') ? '&' : '?';
    const paginatedPath = `${path}${separator}per_page=${perPage}&page=${page}`;
    
    const data = await this.request('GET', paginatedPath);
    
    // GitHub API returns arrays for paginated endpoints
    return Array.isArray(data) ? data : [data];
  }

  /**
   * Gets all pages of a paginated endpoint
   * 
   * @param {string} path - API path
   * @param {Object} [options] - Options
   * @param {number} [options.perPage=100] - Items per page (max 100)
   * @param {number} [options.maxPages=10] - Maximum pages to fetch
   * @returns {Promise<Array>} All items from all pages
   */
  async getAllPaginated(path, options = {}) {
    const perPage = Math.min(options.perPage || 100, 100);
    const maxPages = options.maxPages || 10;
    const allItems = [];
    
    for (let page = 1; page <= maxPages; page++) {
      const items = await this.getPaginated(path, { perPage, page });
      
      if (items.length === 0) {
        break;
      }
      
      allItems.push(...items);
      
      if (items.length < perPage) {
        // Last page
        break;
      }
    }
    
    return allItems;
  }

  /**
   * Clears the cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Gets current rate limit status
   * 
   * @returns {Promise<Object>} Rate limit information
   */
  async getRateLimit() {
    const data = await this.request('GET', '/rate_limit', null, false);
    return data.rate;
  }
}

module.exports = {
  GitHubClient,
  Cache,
  RateLimiter,
};
