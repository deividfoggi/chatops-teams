/**
 * Dependabot Alert Notification Service
 *
 * Orchestrates the end-to-end notification workflow for Dependabot alerts:
 * 1. Identifies the Security Champion for the repository
 * 2. Optionally identifies all repository members (notify_all_members flag)
 * 3. Maps GitHub users to Teams users
 * 4. Creates an adaptive card with alert details
 * 5. Sends 1-on-1 notifications to each recipient
 *
 * @module bot/dependabotNotificationService
 */

const { createDependabotAlertCard, extractDependabotMetadata } = require('../cards/dependabotAlertCard');

/**
 * Dependabot Alert Notification Service
 */
class DependabotNotificationService {
  /**
   * Creates a new DependabotNotificationService instance
   *
   * @param {Object} config - Configuration object
   * @param {Object} config.repositoryStakeholderService - RepositoryStakeholderService instance
   * @param {Object} config.userMapper - UserMapper instance for GitHub to Entra ID mapping
   * @param {Object} config.teamsUserService - TeamsUserService instance
   * @param {Object} config.proactiveMessagingService - ProactiveMessagingService instance
   * @param {Object} [config.githubClient] - Optional GitHubClient for member retrieval
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
    this.githubClient = config.githubClient || null;
    this.telemetryClient = config.telemetryClient || null;
  }

  /**
   * Processes a Dependabot alert and sends Teams notifications
   *
   * @param {Object} alertData - Alert data from webhook handler
   * @param {Object} alertData.alert - GitHub Dependabot alert object
   * @param {Object} alertData.repository - Repository information
   * @param {boolean} [alertData.notifyAllMembers=false] - Whether to notify all repository members
   * @returns {Promise<Object>} Notification result with sent count and details
   */
  async processAndNotify(alertData) {
    const startTime = Date.now();
    const { alert, repository, notifyAllMembers = false } = alertData;

    try {
      console.log(
        `Processing Dependabot alert notification for ${repository.full_name} alert #${alert.number}`
      );

      const metadata = extractDependabotMetadata(alert);

      // Step 1: Identify recipients
      const githubLogins = await this._identifyRecipients(repository, notifyAllMembers);

      // Step 2: Map GitHub users to Teams users
      const teamsUsers = await this._mapToTeamsUsers(githubLogins);

      // Step 3: Get security champion for card context
      const [owner, repo] = repository.full_name.split('/');
      const securityChampion = await this.repositoryStakeholderService.getSecurityChampion(
        owner,
        repo
      );

      // Step 4: Create adaptive card
      const card = createDependabotAlertCard({
        alert,
        repository,
        securityChampion,
      });

      // Step 5: Send notifications to all Teams users
      const notificationResult = await this._sendNotifications(teamsUsers, card, {
        alertNumber: alert.number,
        repository: repository.full_name,
        severity: metadata.severity,
      });

      // Track overall success
      if (this.telemetryClient) {
        const duration = Date.now() - startTime;
        this.telemetryClient.trackMetric('DependabotAlertNotificationDuration', duration, {
          repository: repository.full_name,
          alertNumber: String(alert.number),
          severity: metadata.severity,
          recipientsFound: String(githubLogins.length),
          teamsUsersMapped: String(teamsUsers.length),
          notificationsSent: String(notificationResult.sent),
        });

        this.telemetryClient.trackEvent('DependabotAlertNotificationComplete', {
          repository: repository.full_name,
          alertNumber: String(alert.number),
          severity: metadata.severity,
          package: metadata.packageName,
          recipientsFound: String(githubLogins.length),
          teamsUsersMapped: String(teamsUsers.length),
          notificationsSent: String(notificationResult.sent),
          notifyAllMembers: String(notifyAllMembers),
          success: notificationResult.sent > 0 ? 'true' : 'false',
        });
      }

      return {
        success: notificationResult.sent > 0,
        githubLogins,
        teamsUsers,
        notificationResult,
        message: `Sent ${notificationResult.sent} notification(s) for Dependabot alert #${alert.number}`,
      };
    } catch (error) {
      console.error('Error processing Dependabot alert notification:', error);

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
        message: `Failed to send notifications for Dependabot alert #${alert.number}: ${error.message}`,
      };
    }
  }

  /**
   * Identifies all GitHub logins that should receive notifications.
   * Always includes the Security Champion. Includes all repository members
   * if notifyAllMembers is true.
   *
   * @param {Object} repository - Repository object with full_name
   * @param {boolean} notifyAllMembers - Whether to include all members
   * @returns {Promise<string[]>} Deduplicated array of GitHub logins
   * @private
   */
  async _identifyRecipients(repository, notifyAllMembers) {
    const [owner, repo] = repository.full_name.split('/');
    const loginsSet = new Set();

    // Always notify the Security Champion
    try {
      const securityChampion = await this.repositoryStakeholderService.getSecurityChampion(
        owner,
        repo
      );
      if (securityChampion?.github_login) {
        loginsSet.add(securityChampion.github_login);
        console.log(`Security champion identified: ${securityChampion.github_login}`);
      } else {
        console.warn(`No security champion found for ${repository.full_name}`);
      }
    } catch (error) {
      console.error('Error retrieving security champion:', error.message);
    }

    // Optionally notify all repository members
    if (notifyAllMembers) {
      try {
        if (this.githubClient) {
          const members = await this.githubClient.getRepositoryMembers(owner, repo);
          members.forEach((m) => {
            if (m.login) {
              loginsSet.add(m.login);
            }
          });
          console.log(
            `Added ${members.length} repository member(s) to notification list for ${repository.full_name}`
          );
        } else {
          console.warn('notify_all_members is true but no githubClient provided; skipping member retrieval');
        }
      } catch (error) {
        console.error('Error retrieving repository members:', error.message);
      }
    }

    const logins = Array.from(loginsSet);
    console.log(`Identified ${logins.length} recipient(s) for ${repository.full_name}`);
    return logins;
  }

  /**
   * Maps GitHub logins to Teams user objects
   *
   * @param {string[]} githubLogins - Array of GitHub login names
   * @returns {Promise<Array<Object>>} Array of mapped Teams user objects
   * @private
   */
  async _mapToTeamsUsers(githubLogins) {
    const teamsUsers = [];

    for (const githubLogin of githubLogins) {
      try {
        const entraIdUser = await this.userMapper.mapGitHubToEntraId(githubLogin);

        if (entraIdUser) {
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

    console.log(`Mapped ${teamsUsers.length} of ${githubLogins.length} GitHub user(s) to Teams`);
    return teamsUsers;
  }

  /**
   * Sends adaptive card notifications to the resolved Teams users
   *
   * @param {Array<Object>} teamsUsers - Array of Teams user objects
   * @param {Object} card - Adaptive card JSON
   * @param {Object} context - Contextual metadata for telemetry
   * @returns {Promise<Object>} Results object with sent/failed counts
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
          console.log(`Sent Dependabot notification to ${user.teamsUser.displayName} (${user.githubLogin})`);
        } else {
          results.failed++;
          results.users.push({
            githubLogin: user.githubLogin,
            entraId: user.entraId,
            displayName: user.teamsUser.displayName,
            success: false,
            reason: 'No conversation reference found',
          });
          console.warn(
            `Failed to send Dependabot notification to ${user.teamsUser.displayName}: no conversation`
          );
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
        console.error(`Error sending Dependabot notification to ${user.githubLogin}:`, error.message);
      }
    }

    // Track notification metrics
    if (this.telemetryClient) {
      this.telemetryClient.trackMetric('DependabotAlertNotificationsSent', results.sent, {
        repository: context.repository,
        alertNumber: String(context.alertNumber),
        severity: context.severity,
      });

      if (results.failed > 0) {
        this.telemetryClient.trackMetric('DependabotAlertNotificationsFailed', results.failed, {
          repository: context.repository,
          alertNumber: String(context.alertNumber),
          severity: context.severity,
        });
      }
    }

    return results;
  }
}

module.exports = DependabotNotificationService;
