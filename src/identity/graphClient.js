/**
 * Microsoft Graph API Client
 * 
 * Provides authenticated access to Microsoft Graph API for querying
 * Entra ID (Azure AD) users and performing user lookups.
 * 
 * @module identity/graphClient
 */

/**
 * Microsoft Graph API client for Entra ID user queries
 */
class GraphClient {
  /**
   * Creates a new GraphClient instance
   * @param {Object} config - Configuration object
   * @param {string} config.clientId - Entra ID application client ID
   * @param {string} config.clientSecret - Entra ID application client secret
   * @param {string} config.tenantId - Entra ID tenant ID
   * @param {Object} [config.telemetryClient] - Optional Application Insights client
   */
  constructor(config = {}) {
    this.config = {
      clientId: config.clientId || process.env.ENTRA_CLIENT_ID,
      clientSecret: config.clientSecret || process.env.ENTRA_CLIENT_SECRET,
      tenantId: config.tenantId || process.env.ENTRA_TENANT_ID,
      graphApiUrl: config.graphApiUrl || 'https://graph.microsoft.com/v1.0',
      tokenUrl: config.tokenUrl || `https://login.microsoftonline.com/${config.tenantId || process.env.ENTRA_TENANT_ID}/oauth2/v2.0/token`,
    };
    
    this.telemetryClient = config.telemetryClient;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Gets an OAuth2 access token for Microsoft Graph API
   * @returns {Promise<string>} Access token
   * @throws {Error} If authentication fails
   */
  async getAccessToken() {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const startTime = Date.now();

    try {
      const params = new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      });

      const response = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get access token: ${response.status} ${error}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      // Set expiry with 5-minute buffer
      this.tokenExpiry = Date.now() + ((data.expires_in - 300) * 1000);

      // Track success metric
      if (this.telemetryClient) {
        this.telemetryClient.trackMetric({
          name: 'GraphClient.GetAccessToken.Duration',
          value: Date.now() - startTime,
        });
        this.telemetryClient.trackEvent({
          name: 'GraphClient.GetAccessToken.Success',
        });
      }

      return this.accessToken;
    } catch (error) {
      // Track failure metric
      if (this.telemetryClient) {
        this.telemetryClient.trackMetric({
          name: 'GraphClient.GetAccessToken.Duration',
          value: Date.now() - startTime,
        });
        this.telemetryClient.trackException({
          exception: error,
          properties: {
            operation: 'GraphClient.GetAccessToken',
          },
        });
      }
      throw error;
    }
  }

  /**
   * Queries Microsoft Graph API
   * @param {string} endpoint - API endpoint (e.g., '/users')
   * @param {Object} [options] - Fetch options
   * @returns {Promise<Object>} API response
   * @private
   */
  async query(endpoint, options = {}) {
    const token = await this.getAccessToken();
    const url = `${this.config.graphApiUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Graph API request failed: ${response.status} ${error}`);
    }

    return response.json();
  }

  /**
   * Finds an Entra ID user by email address
   * @param {string} email - Email address to search
   * @returns {Promise<Object|null>} User object or null if not found
   */
  async findUserByEmail(email) {
    const startTime = Date.now();

    try {
      // Query users with email filter
      const result = await this.query(
        `/users?$filter=mail eq '${email}' or userPrincipalName eq '${email}'&$select=id,displayName,mail,userPrincipalName`
      );

      const user = result.value && result.value.length > 0 ? result.value[0] : null;

      // Track metric
      if (this.telemetryClient) {
        this.telemetryClient.trackMetric({
          name: 'GraphClient.FindUserByEmail.Duration',
          value: Date.now() - startTime,
        });
        this.telemetryClient.trackEvent({
          name: 'GraphClient.FindUserByEmail',
          properties: {
            found: user !== null,
            email: email,
          },
        });
      }

      return user;
    } catch (error) {
      if (this.telemetryClient) {
        this.telemetryClient.trackException({
          exception: error,
          properties: {
            operation: 'GraphClient.FindUserByEmail',
            email: email,
          },
        });
      }
      throw error;
    }
  }

  /**
   * Finds an Entra ID user by display name (fuzzy search)
   * @param {string} displayName - Display name to search
   * @returns {Promise<Array>} Array of matching users with similarity scores
   */
  async findUsersByDisplayName(displayName) {
    const startTime = Date.now();

    try {
      // Query users with display name filter (startsWith for better performance)
      const result = await this.query(
        `/users?$filter=startswith(displayName,'${displayName}')&$select=id,displayName,mail,userPrincipalName&$top=10`
      );

      const users = result.value || [];

      // Calculate similarity scores for fuzzy matching
      const usersWithScores = users.map(user => ({
        ...user,
        confidence: this._calculateSimilarity(displayName.toLowerCase(), user.displayName.toLowerCase()),
      }));

      // Sort by confidence score (highest first)
      usersWithScores.sort((a, b) => b.confidence - a.confidence);

      // Track metric
      if (this.telemetryClient) {
        this.telemetryClient.trackMetric({
          name: 'GraphClient.FindUsersByDisplayName.Duration',
          value: Date.now() - startTime,
        });
        this.telemetryClient.trackEvent({
          name: 'GraphClient.FindUsersByDisplayName',
          properties: {
            count: usersWithScores.length,
            displayName: displayName,
          },
        });
      }

      return usersWithScores;
    } catch (error) {
      if (this.telemetryClient) {
        this.telemetryClient.trackException({
          exception: error,
          properties: {
            operation: 'GraphClient.FindUsersByDisplayName',
            displayName: displayName,
          },
        });
      }
      throw error;
    }
  }

  /**
   * Gets an Entra ID user by ID
   * @param {string} userId - Entra ID user ID (object ID)
   * @returns {Promise<Object|null>} User object or null if not found
   */
  async getUserById(userId) {
    const startTime = Date.now();

    try {
      const user = await this.query(
        `/users/${userId}?$select=id,displayName,mail,userPrincipalName`
      );

      // Track metric
      if (this.telemetryClient) {
        this.telemetryClient.trackMetric({
          name: 'GraphClient.GetUserById.Duration',
          value: Date.now() - startTime,
        });
      }

      return user;
    } catch (error) {
      if (error.message.includes('404')) {
        return null;
      }
      
      if (this.telemetryClient) {
        this.telemetryClient.trackException({
          exception: error,
          properties: {
            operation: 'GraphClient.GetUserById',
            userId: userId,
          },
        });
      }
      throw error;
    }
  }

  /**
   * Retrieves multiple users in a single batch request
   * @param {Array<string>} userIds - Array of Entra ID user IDs (max 20)
   * @returns {Promise<Array>} Array of user objects with presence data
   */
  async batchGetUsers(userIds) {
    const startTime = Date.now();

    if (!userIds || userIds.length === 0) {
      return [];
    }

    // Microsoft Graph batch API supports max 20 requests per batch
    if (userIds.length > 20) {
      throw new Error('Batch request cannot exceed 20 users. Split into multiple batches.');
    }

    try {
      // Build batch requests
      const requests = userIds.map((userId, index) => ({
        id: String(index + 1),
        method: 'GET',
        url: `/users/${userId}?$select=id,displayName,mail,userPrincipalName,userType,jobTitle,officeLocation`,
      }));

      const batchRequest = {
        requests,
      };

      const token = await this.getAccessToken();
      const response = await fetch(`${this.config.graphApiUrl}/$batch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batchRequest),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Batch request failed: ${response.status} ${error}`);
      }

      const data = await response.json();
      
      // Process responses and extract user data
      const users = data.responses
        .filter(r => r.status === 200)
        .map(r => r.body);

      // Track metric
      if (this.telemetryClient) {
        this.telemetryClient.trackMetric({
          name: 'GraphClient.BatchGetUsers.Duration',
          value: Date.now() - startTime,
        });
        this.telemetryClient.trackEvent({
          name: 'GraphClient.BatchGetUsers',
          properties: {
            requestedCount: userIds.length,
            successCount: users.length,
          },
        });
      }

      return users;
    } catch (error) {
      if (this.telemetryClient) {
        this.telemetryClient.trackException({
          exception: error,
          properties: {
            operation: 'GraphClient.BatchGetUsers',
            userCount: userIds.length,
          },
        });
      }
      throw error;
    }
  }

  /**
   * Gets user presence information (availability, activity, status message)
   * @param {string} userId - Entra ID user ID
   * @returns {Promise<Object|null>} Presence object or null if not available
   */
  async getUserPresence(userId) {
    const startTime = Date.now();

    try {
      const presence = await this.query(`/users/${userId}/presence`);

      // Track metric
      if (this.telemetryClient) {
        this.telemetryClient.trackMetric({
          name: 'GraphClient.GetUserPresence.Duration',
          value: Date.now() - startTime,
        });
        this.telemetryClient.trackEvent({
          name: 'GraphClient.GetUserPresence',
          properties: {
            userId,
            availability: presence.availability,
            activity: presence.activity,
          },
        });
      }

      return presence;
    } catch (error) {
      // Presence may not be available for all users (e.g., guests)
      if (error.message.includes('404') || error.message.includes('403')) {
        if (this.telemetryClient) {
          this.telemetryClient.trackEvent({
            name: 'GraphClient.GetUserPresence.NotAvailable',
            properties: { userId },
          });
        }
        return null;
      }
      
      if (this.telemetryClient) {
        this.telemetryClient.trackException({
          exception: error,
          properties: {
            operation: 'GraphClient.GetUserPresence',
            userId,
          },
        });
      }
      throw error;
    }
  }

  /**
   * Retrieves presence information for multiple users in a batch
   * @param {Array<string>} userIds - Array of Entra ID user IDs (max 20)
   * @returns {Promise<Array>} Array of presence objects
   */
  async batchGetPresence(userIds) {
    const startTime = Date.now();

    if (!userIds || userIds.length === 0) {
      return [];
    }

    if (userIds.length > 20) {
      throw new Error('Batch request cannot exceed 20 users. Split into multiple batches.');
    }

    try {
      // Build batch requests for presence
      const requests = userIds.map((userId, index) => ({
        id: String(index + 1),
        method: 'GET',
        url: `/users/${userId}/presence`,
      }));

      const batchRequest = {
        requests,
      };

      const token = await this.getAccessToken();
      const response = await fetch(`${this.config.graphApiUrl}/$batch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batchRequest),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Batch presence request failed: ${response.status} ${error}`);
      }

      const data = await response.json();
      
      // Process responses - some may fail if presence not available
      const presences = data.responses.map((r, index) => ({
        userId: userIds[index],
        presence: r.status === 200 ? r.body : null,
        available: r.status === 200,
      }));

      // Track metric
      if (this.telemetryClient) {
        this.telemetryClient.trackMetric({
          name: 'GraphClient.BatchGetPresence.Duration',
          value: Date.now() - startTime,
        });
        this.telemetryClient.trackEvent({
          name: 'GraphClient.BatchGetPresence',
          properties: {
            requestedCount: userIds.length,
            successCount: presences.filter(p => p.available).length,
          },
        });
      }

      return presences;
    } catch (error) {
      if (this.telemetryClient) {
        this.telemetryClient.trackException({
          exception: error,
          properties: {
            operation: 'GraphClient.BatchGetPresence',
            userCount: userIds.length,
          },
        });
      }
      throw error;
    }
  }

  /**
   * Calculates Levenshtein distance-based similarity score
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score between 0 and 1
   * @private
   */
  _calculateSimilarity(str1, str2) {
    const distance = this._levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    
    if (maxLength === 0) return 1.0;
    
    return 1 - (distance / maxLength);
  }

  /**
   * Calculates Levenshtein distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Levenshtein distance
   * @private
   */
  _levenshteinDistance(str1, str2) {
    const matrix = [];

    // Initialize matrix
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}

module.exports = GraphClient;
