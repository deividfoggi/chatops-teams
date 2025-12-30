/**
 * Code Scanning Alert Notification Service
 * 
 * Orchestrates the end-to-end notification workflow for code scanning alerts:
 * 1. Identifies all stakeholders (commit author, owners, security champion)
 * 2. Maps GitHub users to Teams users
 * 3. Creates adaptive card with alert details
 * 4. Sends notifications to all stakeholders
 * 
 * @module bot/codeScanningNotificationService
 */

const { createCodeScanningAlertCard } = require('../cards/codeScanningAlertCard');

/**
 * Code Scanning Alert Notification Service
 */
class CodeScanningNotificationService {
  /**
   * Creates a new CodeScanningNotificationService instance
   * 
   * @param {Object} config - Configuration object
   * @param {Object} config.repositoryStakeholderService - RepositoryStakeholderService instance
   * @param {Object} config.userMapper - UserMapper instance for GitHub to Entra ID mapping
   * @param {Object} config.teamsUserService - TeamsUserService instance
   * @param {Object} config.proactiveMessagingService - ProactiveMessagingService instance
   * @param {Object} [config.telemetryClient] - Optional Application Insights client
   */
  constructor(config) {
    if (!config) {
      throw new Error('config is required');
    }
    if (!config.repositoryStakeholderService) {
      throw new Error('repositoryStakeholderService is required');
    }
    if (!config.userMapper) {
      throw new Error('userMapper is required');
    }
    if (!config.teamsUserService) {
      throw new Error('teamsUserService is required');
    }
    if (!config.proactiveMessagingService) {
      throw new Error('proactiveMessagingService is required');
    }

    this.repositoryStakeholderService = config.repositoryStakeholderService;
    this.userMapper = config.userMapper;
    this.teamsUserService = config.teamsUserService;
    this.proactiveMessagingService = config.proactiveMessagingService;
    this.telemetryClient = config.telemetryClient;
  }

  /**
   * Processes a code scanning alert and sends notifications
   * 
   * @param {Object} alertData - Alert data from webhook handler
   * @param {Object} alertData.alert - GitHub alert object
   * @param {Object} alertData.repository - Repository information
   * @param {Object} alertData.metadata - Alert metadata (severity, CWE, CVE, etc.)
   * @param {Object} [alertData.authorInfo] - Commit author information (if available)
   * @returns {Promise<Object>} Notification result with sent count and details
   */
  async processAndNotify(alertData) {
    const startTime = Date.now();
    const { alert, repository, metadata, authorInfo } = alertData;

    try {
      console.log(`Processing code scanning alert notification for ${repository.full_name} alert #${alert.number}`);

      // Step 1: Identify all stakeholders
      const stakeholders = await this._identifyStakeholders(repository, authorInfo);

      // Step 2: Map GitHub users to Teams users
      const teamsUsers = await this._mapToTeamsUsers(stakeholders);

      // Step 3: Create adaptive card
      const card = createCodeScanningAlertCard({
        alert,
        repository,
        metadata,
        authorInfo,
        owners: stakeholders.owners,
        securityChampion: stakeholders.securityChampion,
      });

      // Step 4: Send notifications to all Teams users
      const notificationResult = await this._sendNotifications(teamsUsers, card, {
        alertNumber: alert.number,
        repository: repository.full_name,
        severity: metadata.severity,
      });

      // Track overall success
      if (this.telemetryClient) {
        const duration = Date.now() - startTime;
        this.telemetryClient.trackMetric('CodeScanningAlertNotificationDuration', duration, {
          repository: repository.full_name,
          alertNumber: String(alert.number),
          severity: metadata.severity,
          stakeholdersFound: String(stakeholders.githubLogins.length),
          teamsUsersMapped: String(teamsUsers.length),
          notificationsSent: String(notificationResult.sent),
        });

        this.telemetryClient.trackEvent('CodeScanningAlertNotificationComplete', {
          repository: repository.full_name,
          alertNumber: String(alert.number),
          severity: metadata.severity,
          stakeholdersFound: String(stakeholders.githubLogins.length),
          teamsUsersMapped: String(teamsUsers.length),
          notificationsSent: String(notificationResult.sent),
          success: notificationResult.sent > 0 ? 'true' : 'false',
        });
      }

      return {
        success: notificationResult.sent > 0,
        stakeholders,
        teamsUsers,
        notificationResult,
        message: `Sent ${notificationResult.sent} notification(s) for alert #${alert.number}`,
      };
    } catch (error) {
      console.error(`Error processing code scanning alert notification:`, error);

      if (this.telemetryClient) {
        this.telemetryClient.trackException(error, {
          repository: repository.full_name,
          alertNumber: String(alert.number),
          operation: 'processAndNotify',
        });
      }

      return {
        success: false,
        error: error.message,
        message: `Failed to send notifications for alert #${alert.number}: ${error.message}`,
      };
    }
  }

  /**
   * Identifies all stakeholders for an alert
   * @private
   */
  async _identifyStakeholders(repository, authorInfo) {
    const [owner, repo] = repository.full_name.split('/');
    
    // Get owners and security champion in parallel
    const [owners, securityChampion] = await Promise.all([
      this.repositoryStakeholderService.getRepositoryOwners(owner, repo),
      this.repositoryStakeholderService.getSecurityChampion(owner, repo),
    ]);

    // Collect all unique GitHub logins
    const githubLogins = new Set();

    // Add commit author if available
    if (authorInfo?.primaryAuthor?.githubLogin) {
      githubLogins.add(authorInfo.primaryAuthor.githubLogin);
    }

    // Add owners
    owners.forEach(ownerObj => {
      if (ownerObj.github_login) {
        githubLogins.add(ownerObj.github_login);
      }
    });

    // Add security champion
    if (securityChampion?.github_login) {
      githubLogins.add(securityChampion.github_login);
    }

    console.log(`Identified ${githubLogins.size} unique stakeholders for ${repository.full_name}`);

    return {
      owners,
      securityChampion,
      githubLogins: Array.from(githubLogins),
    };
  }

  /**
   * Maps GitHub users to Teams users
   * @private
   */
  async _mapToTeamsUsers(stakeholders) {
    const teamsUsers = [];

    for (const githubLogin of stakeholders.githubLogins) {
      try {
        // Map GitHub login to Entra ID
        const entraIdUser = await this.userMapper.mapGitHubToEntraId(githubLogin);

        if (entraIdUser) {
          // Get Teams user details
          const teamsUser = await this.teamsUserService.getUser(entraIdUser.id, {
            includePresence: true,
            useCache: true,
          });

          if (teamsUser) {
            teamsUsers.push({
              githubLogin,
              entraId: entraIdUser.id,
              teamsUser,
            });
            console.log(`Mapped ${githubLogin} to Teams user ${teamsUser.displayName}`);
          } else {
            console.warn(`Teams user not found for ${githubLogin} (Entra ID: ${entraIdUser.id})`);
          }
        } else {
          console.warn(`Could not map GitHub user ${githubLogin} to Entra ID`);
        }
      } catch (error) {
        console.error(`Error mapping ${githubLogin} to Teams:`, error.message);
      }
    }

    console.log(`Mapped ${teamsUsers.length} of ${stakeholders.githubLogins.length} GitHub users to Teams`);

    return teamsUsers;
  }

  /**
   * Sends notifications to Teams users
   * @private
   */
  async _sendNotifications(teamsUsers, card, context) {
    const results = {
      sent: 0,
      failed: 0,
      users: [],
    };

    for (const user of teamsUsers) {
      try {
        // Send adaptive card to user
        const sentCount = await this.proactiveMessagingService.sendAdaptiveCardToUser(
          user.entraId,
          card
        );

        if (sentCount > 0) {
          results.sent++;
          results.users.push({
            githubLogin: user.githubLogin,
            entraId: user.entraId,
            displayName: user.teamsUser.displayName,
            success: true,
          });
          console.log(`Sent notification to ${user.teamsUser.displayName} (${user.githubLogin})`);
        } else {
          results.failed++;
          results.users.push({
            githubLogin: user.githubLogin,
            entraId: user.entraId,
            displayName: user.teamsUser.displayName,
            success: false,
            reason: 'No conversation reference found',
          });
          console.warn(`Failed to send notification to ${user.teamsUser.displayName}: no conversation`);
        }
      } catch (error) {
        results.failed++;
        results.users.push({
          githubLogin: user.githubLogin,
          entraId: user.entraId,
          displayName: user.teamsUser?.displayName || 'Unknown',
          success: false,
          reason: error.message,
        });
        console.error(`Error sending notification to ${user.githubLogin}:`, error.message);
      }
    }

    // Track notification metrics
    if (this.telemetryClient) {
      this.telemetryClient.trackMetric('CodeScanningAlertNotificationsSent', results.sent, {
        repository: context.repository,
        alertNumber: String(context.alertNumber),
        severity: context.severity,
      });

      if (results.failed > 0) {
        this.telemetryClient.trackMetric('CodeScanningAlertNotificationsFailed', results.failed, {
          repository: context.repository,
          alertNumber: String(context.alertNumber),
          severity: context.severity,
        });
      }
    }

    return results;
  }
}

module.exports = CodeScanningNotificationService;
