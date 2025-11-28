/**
 * Application Insights Telemetry Client for ChatOps Teams
 *
 * This module configures custom metrics, dependency tracking, and distributed
 * tracing for the ChatOps application following Azure Well-Architected Framework
 * observability best practices.
 *
 * @module telemetry/telemetryClient
 */

const appInsights = require('applicationinsights');
const { v4: uuidv4 } = require('uuid');

/**
 * Telemetry client configuration and wrapper
 */
class TelemetryClient {
  /**
   * Creates a new TelemetryClient instance
   *
   * @param {Object} config - Configuration options
   * @param {string} config.connectionString - Application Insights connection string
   * @param {string} [config.environment='production'] - Environment name
   * @param {string} [config.version='1.0.0'] - Application version
   * @param {string} [config.region='eastus'] - Azure region
   * @param {string} [config.cloudRole='chatops-backend'] - Cloud role name
   * @param {string} [config.cloudRoleInstance] - Cloud role instance (optional)
   */
  constructor(config = {}) {
    this.config = {
      connectionString: config.connectionString || process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
      environment: config.environment || process.env.NODE_ENV || 'production',
      version: config.version || process.env.APP_VERSION || '1.0.0',
      region: config.region || process.env.AZURE_REGION || 'eastus',
      cloudRole: config.cloudRole || 'chatops-backend',
      cloudRoleInstance: config.cloudRoleInstance || process.env.WEBSITE_INSTANCE_ID,
    };

    this.client = null;
    this.initialized = false;
  }

  /**
   * Initializes the Application Insights SDK
   *
   * @returns {TelemetryClient} The initialized telemetry client
   */
  initialize() {
    if (this.initialized) {
      return this;
    }

    if (!this.config.connectionString) {
      console.warn('Application Insights connection string not configured. Telemetry will be disabled.');
      return this;
    }

    // Configure Application Insights
    appInsights
      .setup(this.config.connectionString)
      .setAutoDependencyCorrelation(true)
      .setAutoCollectRequests(true)
      .setAutoCollectPerformance(true, true)
      .setAutoCollectExceptions(true)
      .setAutoCollectDependencies(true)
      .setAutoCollectConsole(true, true)
      .setUseDiskRetryCaching(true)
      .setSendLiveMetrics(true)
      .start();

    this.client = appInsights.defaultClient;

    // Set cloud role for Application Map
    this.client.context.tags[this.client.context.keys.cloudRole] = this.config.cloudRole;
    if (this.config.cloudRoleInstance) {
      this.client.context.tags[this.client.context.keys.cloudRoleInstance] = this.config.cloudRoleInstance;
    }

    // Set common properties for all telemetry
    this.client.commonProperties = {
      environment: this.config.environment,
      version: this.config.version,
      region: this.config.region,
    };

    this.initialized = true;
    return this;
  }

  /**
   * Sets the operation context for distributed tracing
   *
   * @param {string} operationId - Unique operation/correlation ID
   * @param {string} operationName - Name of the operation
   * @param {string} [parentId] - Parent operation ID for nested operations
   */
  setOperationContext(operationId, operationName, parentId = null) {
    if (!this.client) return;

    this.client.context.tags[this.client.context.keys.operationId] = operationId;
    this.client.context.tags[this.client.context.keys.operationName] = operationName;

    if (parentId) {
      this.client.context.tags[this.client.context.keys.operationParentId] = parentId;
    }
  }

  /**
   * Tracks webhook processing time metric
   *
   * @param {number} duration - Processing duration in milliseconds
   * @param {Object} properties - Additional properties
   * @param {string} properties.webhookType - Type of webhook (e.g., 'code_scanning_alert')
   * @param {string} properties.repository - Repository full name (e.g., 'owner/repo')
   * @param {string} [properties.severity] - Alert severity if applicable
   * @param {boolean} [properties.success=true] - Whether processing was successful
   */
  trackWebhookProcessingTime(duration, properties = {}) {
    if (!this.client) return;

    this.client.trackMetric({
      name: 'WebhookProcessingTime',
      value: duration,
      properties: {
        webhookType: properties.webhookType,
        repository: properties.repository,
        severity: properties.severity,
        success: String(properties.success !== false),
      },
    });
  }

  /**
   * Tracks alert notification sent event
   *
   * @param {Object} properties - Event properties
   * @param {string} properties.alertType - Type of alert (e.g., 'code_scanning', 'dependabot')
   * @param {string} properties.notificationChannel - Notification channel (e.g., 'teams')
   * @param {number} properties.recipientCount - Number of recipients
   * @param {string} properties.repository - Repository full name
   * @param {boolean} [properties.success=true] - Whether notification was successful
   */
  trackAlertNotificationSent(properties = {}) {
    if (!this.client) return;

    this.client.trackEvent({
      name: 'AlertNotificationSent',
      properties: {
        alertType: properties.alertType,
        notificationChannel: properties.notificationChannel,
        recipientCount: String(properties.recipientCount),
        repository: properties.repository,
        success: String(properties.success !== false),
      },
    });
  }

  /**
   * Tracks deployment approval time metric
   *
   * @param {number} duration - Time from request to approval in milliseconds
   * @param {Object} properties - Additional properties
   * @param {string} properties.environment - Deployment environment (e.g., 'production')
   * @param {string} properties.repository - Repository full name
   * @param {string} properties.outcome - Approval outcome ('approved', 'rejected', 'timeout')
   * @param {string} [properties.approver] - Approver username (if approved)
   */
  trackDeploymentApprovalTime(duration, properties = {}) {
    if (!this.client) return;

    this.client.trackMetric({
      name: 'DeploymentApprovalTime',
      value: duration,
      properties: {
        environment: properties.environment,
        repository: properties.repository,
        outcome: properties.outcome,
        approver: properties.approver,
      },
    });
  }

  /**
   * Tracks user mapping success event
   *
   * @param {Object} properties - Event properties
   * @param {boolean} properties.success - Whether mapping was successful
   * @param {string} properties.mappingMethod - Method used (e.g., 'email', 'username', 'saml')
   * @param {string} [properties.sourceUser] - GitHub username being mapped
   * @param {number} [properties.confidenceScore] - Mapping confidence score (0-100)
   */
  trackUserMappingSuccess(properties = {}) {
    if (!this.client) return;

    this.client.trackEvent({
      name: 'UserMappingSuccess',
      properties: {
        success: String(properties.success),
        mappingMethod: properties.mappingMethod,
        sourceUser: properties.sourceUser,
        confidenceScore: properties.confidenceScore != null ? String(properties.confidenceScore) : undefined,
      },
    });
  }

  /**
   * Tracks dependency call (external API call)
   *
   * @param {Object} options - Dependency tracking options
   * @param {string} options.target - Target host (e.g., 'api.github.com')
   * @param {string} options.name - Operation name (e.g., 'GET /repos/{owner}/{repo}/commits')
   * @param {number} options.duration - Call duration in milliseconds
   * @param {number} options.resultCode - HTTP status code
   * @param {boolean} options.success - Whether the call was successful
   * @param {string} [options.dependencyTypeName='HTTP'] - Type of dependency
   * @param {string} [options.data] - Additional data (e.g., request ID)
   * @param {Object} [options.properties] - Additional custom properties
   */
  trackDependency(options = {}) {
    if (!this.client) return;

    this.client.trackDependency({
      target: options.target,
      name: options.name,
      data: options.data,
      duration: options.duration,
      resultCode: options.resultCode,
      success: options.success,
      dependencyTypeName: options.dependencyTypeName || 'HTTP',
      properties: options.properties,
    });
  }

  /**
   * Tracks GitHub API dependency call
   *
   * @param {string} operation - API operation (e.g., 'GET /repos/{owner}/{repo}')
   * @param {number} duration - Call duration in milliseconds
   * @param {number} resultCode - HTTP status code
   * @param {boolean} success - Whether the call was successful
   * @param {Object} [properties] - Additional properties
   */
  trackGitHubApiCall(operation, duration, resultCode, success, properties = {}) {
    this.trackDependency({
      target: 'api.github.com',
      name: operation,
      duration,
      resultCode,
      success,
      dependencyTypeName: 'HTTP',
      properties: {
        ...properties,
        api: 'GitHub REST API',
      },
    });
  }

  /**
   * Tracks Microsoft Graph API dependency call
   *
   * @param {string} operation - API operation (e.g., 'POST /users/{id}/sendMail')
   * @param {number} duration - Call duration in milliseconds
   * @param {number} resultCode - HTTP status code
   * @param {boolean} success - Whether the call was successful
   * @param {Object} [properties] - Additional properties
   */
  trackGraphApiCall(operation, duration, resultCode, success, properties = {}) {
    this.trackDependency({
      target: 'graph.microsoft.com',
      name: operation,
      duration,
      resultCode,
      success,
      dependencyTypeName: 'HTTP',
      properties: {
        ...properties,
        api: 'Microsoft Graph API',
      },
    });
  }

  /**
   * Tracks Teams Bot API dependency call
   *
   * @param {string} operation - API operation (e.g., 'POST /v3/conversations')
   * @param {number} duration - Call duration in milliseconds
   * @param {number} resultCode - HTTP status code
   * @param {boolean} success - Whether the call was successful
   * @param {Object} [properties] - Additional properties
   */
  trackTeamsApiCall(operation, duration, resultCode, success, properties = {}) {
    this.trackDependency({
      target: 'smba.trafficmanager.net',
      name: operation,
      duration,
      resultCode,
      success,
      dependencyTypeName: 'HTTP',
      properties: {
        ...properties,
        api: 'Teams Bot API',
      },
    });
  }

  /**
   * Tracks an incoming HTTP request
   *
   * @param {Object} options - Request tracking options
   * @param {string} options.name - Request name (e.g., 'POST /webhook')
   * @param {string} options.url - Request URL
   * @param {number} options.duration - Request duration in milliseconds
   * @param {number} options.resultCode - HTTP status code
   * @param {boolean} options.success - Whether the request was successful
   * @param {Object} [options.properties] - Additional properties
   */
  trackRequest(options = {}) {
    if (!this.client) return;

    this.client.trackRequest({
      name: options.name,
      url: options.url,
      duration: options.duration,
      resultCode: options.resultCode,
      success: options.success,
      properties: options.properties,
    });
  }

  /**
   * Tracks an exception
   *
   * @param {Error} exception - The exception to track
   * @param {Object} [properties] - Additional properties
   */
  trackException(exception, properties = {}) {
    if (!this.client) return;

    this.client.trackException({
      exception,
      properties,
    });
  }

  /**
   * Tracks a custom event
   *
   * @param {string} name - Event name
   * @param {Object} [properties] - Event properties
   * @param {Object} [measurements] - Numeric measurements
   */
  trackEvent(name, properties = {}, measurements = {}) {
    if (!this.client) return;

    this.client.trackEvent({
      name,
      properties,
      measurements,
    });
  }

  /**
   * Tracks a custom metric
   *
   * @param {string} name - Metric name
   * @param {number} value - Metric value
   * @param {Object} [properties] - Additional properties
   */
  trackMetric(name, value, properties = {}) {
    if (!this.client) return;

    this.client.trackMetric({
      name,
      value,
      properties,
    });
  }

  /**
   * Flushes all pending telemetry
   *
   * @returns {Promise<void>}
   */
  flush() {
    return new Promise((resolve) => {
      if (!this.client) {
        resolve();
        return;
      }

      this.client.flush({
        callback: () => resolve(),
      });
    });
  }

  /**
   * Gets the underlying Application Insights default client
   *
   * @returns {Object|null} The Application Insights TelemetryClient
   */
  getClient() {
    return this.client;
  }
}

// Singleton instance
let telemetryInstance = null;

/**
 * Gets or creates the singleton telemetry client instance
 *
 * @param {Object} [config] - Configuration options (only used on first call)
 * @returns {TelemetryClient} The telemetry client instance
 */
function getTelemetryClient(config = {}) {
  if (!telemetryInstance) {
    telemetryInstance = new TelemetryClient(config);
  } else if (Object.keys(config).length > 0) {
    console.warn(
      'TelemetryClient: Configuration ignored - singleton already initialized. ' +
      'Configuration must be passed on the first call to getTelemetryClient().'
    );
  }
  return telemetryInstance;
}

/**
 * Creates a middleware function for Express to enable distributed tracing
 *
 * @param {TelemetryClient} telemetryClient - The telemetry client instance
 * @returns {Function} Express middleware function
 */
function createTracingMiddleware(telemetryClient) {
  return (req, res, next) => {
    // Get correlation ID from GitHub webhook header or generate new one
    const correlationId = req.headers['x-github-delivery'] || uuidv4();
    const operationName = `${req.method} ${req.path}`;

    // Set operation context for distributed tracing
    telemetryClient.setOperationContext(correlationId, operationName);

    // Attach correlation ID to request for use in handlers
    req.correlationId = correlationId;

    // Track request timing
    const startTime = Date.now();

    // Override res.end to track request completion
    const originalEnd = res.end.bind(res);
    res.end = function (...args) {
      const duration = Date.now() - startTime;

      telemetryClient.trackRequest({
        name: operationName,
        url: req.url,
        duration,
        resultCode: res.statusCode,
        success: res.statusCode < 400,
        properties: {
          correlationId,
          method: req.method,
          path: req.path,
        },
      });

      return originalEnd(...args);
    };

    next();
  };
}

module.exports = {
  TelemetryClient,
  getTelemetryClient,
  createTracingMiddleware,
};
