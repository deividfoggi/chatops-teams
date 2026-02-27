/**
 * GitHub Webhook Event Handlers
 * 
 * Processes different types of GitHub webhook events and routes them
 * to appropriate Logic App workflows or internal handlers.
 * 
 * @module bot/webhookHandlers
 */

const { processCodeScanningAlert } = require('./alertSeverityFilter');
const { identifyCommitAuthor } = require('../github');

/**
 * Handles code scanning alert webhook events
 * 
 * @param {Object} payload - The webhook payload
 * @param {Object} telemetryClient - Application Insights client
 * @param {Object} githubClient - GitHub API client instance (optional)
 * @param {Object} notificationService - CodeScanningNotificationService instance (optional)
 * @returns {Promise<Object>} Processing result
 */
async function handleCodeScanningAlert(payload, telemetryClient, githubClient, notificationService) {
  const { action, alert, repository, sender } = payload;
  const repositoryFullName = repository?.full_name || 'unknown';

  console.log(`Processing code_scanning_alert: action=${action}, alert=${alert?.number}, repo=${repositoryFullName}`);

  // Process alert through severity filter
  const filterResult = processCodeScanningAlert(alert, repositoryFullName);
  const { shouldEscalate, metadata } = filterResult;

  console.log(`Alert severity filtering: severity=${metadata.severity}, shouldEscalate=${shouldEscalate}, reason=${filterResult.reason}`);

  // Log all alerts to Application Insights regardless of severity
  if (telemetryClient) {
    telemetryClient.trackEvent('GitHubWebhookReceived', {
      eventType: 'code_scanning_alert',
      action: action,
      alertNumber: String(alert?.number || 'unknown'),
      repository: repositoryFullName,
      severity: metadata.severity,
      state: metadata.state,
      sender: sender?.login || 'unknown',
      shouldEscalate: String(shouldEscalate),
      cweIds: metadata.cweIds.length > 0 ? metadata.cweIds.join(',') : 'none',
      cveIds: metadata.cveIds.length > 0 ? metadata.cveIds.join(',') : 'none',
      cvssScore: metadata.cvssScore ? String(metadata.cvssScore) : 'none',
      ruleId: metadata.ruleId,
    });

    // Track custom metric for alert severity
    telemetryClient.trackMetric('CodeScanningAlertsBySeverity', 1, {
      severity: metadata.severity,
      repository: repositoryFullName,
      shouldEscalate: String(shouldEscalate),
    });

    // Track escalated alerts separately
    if (shouldEscalate) {
      telemetryClient.trackMetric('CodeScanningAlertsEscalated', 1, {
        severity: metadata.severity,
        repository: repositoryFullName,
      });
    }
  }

  // Build result object
  const result = {
    status: shouldEscalate ? 'escalated' : 'logged',
    eventType: 'code_scanning_alert',
    action: action,
    alertNumber: alert?.number,
    repository: repositoryFullName,
    severity: metadata.severity,
    shouldEscalate,
    metadata: {
      cweIds: metadata.cweIds,
      cveIds: metadata.cveIds,
      cvssScore: metadata.cvssScore,
      affectedFiles: metadata.affectedFiles,
      ruleId: metadata.ruleId,
      ruleName: metadata.ruleName,
      description: metadata.description,
    },
    message: shouldEscalate
      ? `Code scanning alert ${action} (ESCALATED): ${metadata.description}`
      : `Code scanning alert ${action} (logged only): ${metadata.description}`,
  };

  // Identify commit author if GitHub client is provided
  if (githubClient && alert && repository) {
    try {
      const authorInfo = await identifyCommitAuthor(alert, repository, githubClient, telemetryClient);
      result.authorIdentification = authorInfo;

      if (authorInfo.success && authorInfo.primaryAuthor) {
        console.log(`Commit author identified: ${authorInfo.primaryAuthor.githubLogin}`);
      } else {
        console.log(`Commit author identification: ${authorInfo.message}`);
      }
    } catch (error) {
      console.error('Error identifying commit author:', error.message);
      result.authorIdentificationError = error.message;
    }
  }

  console.log(`Code scanning alert processed: ${JSON.stringify(result)}`);

  // Send notification to Teams if alert should be escalated
  if (shouldEscalate && notificationService) {
    try {
      console.log(`Sending Teams notification for escalated alert #${alert?.number}`);
      
      const notificationResult = await notificationService.processAndNotify({
        alert,
        repository,
        metadata,
        authorInfo: result.authorIdentification,
      });

      result.notification = notificationResult;

      if (notificationResult.success) {
        console.log(`Successfully sent ${notificationResult.notificationResult.sent} notification(s)`);
      } else {
        console.error(`Notification failed: ${notificationResult.message}`);
      }
    } catch (error) {
      console.error('Error sending Teams notification:', error.message);
      result.notificationError = error.message;

      if (telemetryClient) {
        telemetryClient.trackException(error, {
          repository: repositoryFullName,
          alertNumber: String(alert?.number),
          operation: 'sendNotification',
        });
      }
    }
  } else if (shouldEscalate && !notificationService) {
    console.warn('Alert should be escalated but notification service not configured');
  }

  return result;
}

/**
 * Handles Dependabot alert webhook events
 * 
 * @param {Object} payload - The webhook payload
 * @param {Object} telemetryClient - Application Insights client
 * @returns {Promise<Object>} Processing result
 */
async function handleDependabotAlert(payload, telemetryClient) {
  const { action, alert, repository, sender } = payload;

  console.log(`Processing dependabot_alert: action=${action}, alert=${alert?.number}, repo=${repository?.full_name}`);

  // Track event in Application Insights
  if (telemetryClient) {
    telemetryClient.trackEvent('GitHubWebhookReceived', {
      eventType: 'dependabot_alert',
      action: action,
      alertNumber: String(alert?.number || 'unknown'),
      repository: repository?.full_name || 'unknown',
      severity: alert?.security_advisory?.severity || 'unknown',
      state: alert?.state || 'unknown',
      package: alert?.security_vulnerability?.package?.name || 'unknown',
      sender: sender?.login || 'unknown',
    });

    // Track custom metric for vulnerability severity
    if (alert?.security_advisory?.severity) {
      telemetryClient.trackMetric('DependabotAlertsBySeverity', 1, {
        severity: alert.security_advisory.severity,
        repository: repository?.full_name,
        package: alert?.security_vulnerability?.package?.name,
      });
    }
  }

  // TODO: Route to Logic App workflow for Dependabot alerts
  const result = {
    status: 'processed',
    eventType: 'dependabot_alert',
    action: action,
    alertNumber: alert?.number,
    repository: repository?.full_name,
    severity: alert?.security_advisory?.severity,
    package: alert?.security_vulnerability?.package?.name,
    message: `Dependabot alert ${action}: ${alert?.security_advisory?.summary || 'No summary'}`,
  };

  console.log(`Dependabot alert processed: ${JSON.stringify(result)}`);

  return result;
}

/**
 * Handles deployment review/protection rule webhook events
 * 
 * @param {Object} payload - The webhook payload
 * @param {Object} telemetryClient - Application Insights client
 * @returns {Promise<Object>} Processing result
 */
async function handleDeploymentReview(payload, telemetryClient) {
  const { action, environment, deployment, repository, sender } = payload;

  console.log(`Processing deployment_protection_rule: action=${action}, environment=${environment}, repo=${repository?.full_name}`);

  // Track event in Application Insights
  if (telemetryClient) {
    telemetryClient.trackEvent('GitHubWebhookReceived', {
      eventType: 'deployment_protection_rule',
      action: action,
      environment: environment || 'unknown',
      repository: repository?.full_name || 'unknown',
      deploymentId: String(deployment?.id || 'unknown'),
      sender: sender?.login || 'unknown',
    });

    // Track deployment metrics
    telemetryClient.trackMetric('DeploymentReviewRequests', 1, {
      environment: environment,
      repository: repository?.full_name,
    });
  }

  // TODO: Route to Logic App workflow for deployment reviews
  const result = {
    status: 'processed',
    eventType: 'deployment_protection_rule',
    action: action,
    environment: environment,
    repository: repository?.full_name,
    deploymentId: deployment?.id,
    message: `Deployment review ${action} for environment: ${environment}`,
  };

  console.log(`Deployment review processed: ${JSON.stringify(result)}`);

  return result;
}

/**
 * Handles GitHub ping events (webhook configuration test)
 * 
 * @param {Object} payload - The webhook payload
 * @param {Object} telemetryClient - Application Insights client
 * @returns {Promise<Object>} Processing result
 */
async function handlePing(payload, telemetryClient) {
  const { zen, hook_id, repository } = payload;

  console.log(`Processing ping event: hook_id=${hook_id}, repo=${repository?.full_name}`);

  if (telemetryClient) {
    telemetryClient.trackEvent('GitHubWebhookReceived', {
      eventType: 'ping',
      hookId: String(hook_id || 'unknown'),
      repository: repository?.full_name || 'unknown',
    });
  }

  return {
    status: 'processed',
    eventType: 'ping',
    message: `Webhook configured successfully: ${zen}`,
  };
}

/**
 * Routes webhook events to appropriate handlers
 * 
 * @param {string} eventType - The GitHub event type
 * @param {Object} payload - The webhook payload
 * @param {Object} telemetryClient - Application Insights client
 * @param {Object} githubClient - GitHub API client instance (optional)
 * @param {Object} notificationService - CodeScanningNotificationService instance (optional)
 * @returns {Promise<Object>} Processing result
 */
async function routeWebhookEvent(eventType, payload, telemetryClient, githubClient, notificationService) {
  try {
    let result;

    switch (eventType) {
      case 'code_scanning_alert':
        result = await handleCodeScanningAlert(payload, telemetryClient, githubClient, notificationService);
        break;

      case 'dependabot_alert':
        result = await handleDependabotAlert(payload, telemetryClient);
        break;

      case 'deployment_protection_rule':
        result = await handleDeploymentReview(payload, telemetryClient);
        break;

      case 'ping':
        result = await handlePing(payload, telemetryClient);
        break;

      default:
        console.warn(`Unsupported webhook event type: ${eventType}`);
        result = {
          status: 'unsupported',
          eventType: eventType,
          message: `Event type '${eventType}' is not supported`,
        };
    }

    return result;
  } catch (error) {
    console.error(`Error routing webhook event ${eventType}:`, error);

    if (telemetryClient) {
      telemetryClient.trackException(error, {
        eventType: eventType,
        handlerError: error.message,
      });
    }

    throw error;
  }
}

module.exports = {
  handleCodeScanningAlert,
  handleDependabotAlert,
  handleDeploymentReview,
  handlePing,
  routeWebhookEvent,
};
