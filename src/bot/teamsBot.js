/**
 * Teams Bot for ChatOps Integration
 * 
 * This module implements the Bot Framework ActivityHandler to process
 * messages, handle adaptive card actions, and manage conversations
 * for proactive messaging.
 * 
 * @module bot/teamsBot
 */

const { ActivityHandler, MessageFactory, CardFactory } = require('botbuilder');

/**
 * Teams Bot Activity Handler
 * 
 * Handles incoming activities from Microsoft Teams including:
 * - Messages from users
 * - Adaptive card action callbacks (invoke activities)
 * - Conversation updates (bot added/removed)
 */
class TeamsBot extends ActivityHandler {
  /**
   * Creates a new TeamsBot instance
   * 
   * @param {Object} conversationReferences - Service for storing conversation references
   * @param {Object} telemetryClient - Application Insights telemetry client
   */
  constructor(conversationReferences, telemetryClient) {
    super();

    if (!conversationReferences) {
      throw new Error('conversationReferences is required');
    }

    this.conversationReferences = conversationReferences;
    this.telemetryClient = telemetryClient;

    // Handle incoming messages
    this.onMessage(async (context, next) => {
      const startTime = Date.now();
      
      try {
        // Add conversation reference for proactive messaging
        this.addConversationReference(context.activity);

        const text = context.activity.text ? context.activity.text.trim() : '';
        
        // Track message received
        if (this.telemetryClient) {
          this.telemetryClient.trackEvent('BotMessageReceived', {
            conversationId: context.activity.conversation.id,
            userId: context.activity.from.id,
            messageLength: String(text.length),
          });
        }

        // Process user message
        await this.handleUserMessage(context, text);

        // Track processing time
        if (this.telemetryClient) {
          const duration = Date.now() - startTime;
          this.telemetryClient.trackMetric('BotMessageProcessingTime', duration, {
            success: 'true',
          });
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Track error
        if (this.telemetryClient) {
          this.telemetryClient.trackException(error, {
            conversationId: context.activity.conversation.id,
            activityType: 'message',
          });
          this.telemetryClient.trackMetric('BotMessageProcessingTime', duration, {
            success: 'false',
          });
        }

        // Send graceful error message to user
        await this.sendErrorMessage(context, error);
      }

      await next();
    });

    // Handle adaptive card action callbacks
    this.onInvoke(async (context, next) => {
      const startTime = Date.now();
      
      try {
        const action = context.activity.value?.action;
        
        // Track invoke received
        if (this.telemetryClient) {
          this.telemetryClient.trackEvent('BotInvokeReceived', {
            action: action || 'unknown',
            conversationId: context.activity.conversation.id,
            userId: context.activity.from.id,
          });
        }

        // Process the action
        const result = await this.handleAdaptiveCardAction(context);

        // Track processing time
        if (this.telemetryClient) {
          const duration = Date.now() - startTime;
          this.telemetryClient.trackMetric('BotInvokeProcessingTime', duration, {
            action: action || 'unknown',
            success: 'true',
          });
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Track error
        if (this.telemetryClient) {
          this.telemetryClient.trackException(error, {
            conversationId: context.activity.conversation.id,
            activityType: 'invoke',
          });
          this.telemetryClient.trackMetric('BotInvokeProcessingTime', duration, {
            success: 'false',
          });
        }

        // Return error response
        return {
          status: 500,
          body: { error: 'An error occurred processing your action. Please try again.' },
        };
      }

      await next();
    });

    // Handle conversation updates (bot added/removed, members added/removed)
    this.onConversationUpdate(async (context, next) => {
      try {
        // Add conversation reference when bot is added
        this.addConversationReference(context.activity);

        // Check if members were added
        if (context.activity.membersAdded && context.activity.membersAdded.length > 0) {
          for (const member of context.activity.membersAdded) {
            // Check if the bot was added
            if (member.id !== context.activity.recipient.id) {
              // A user was added to the conversation
              await this.handleMemberAdded(context, member);
            } else {
              // The bot was added to the conversation
              await this.handleBotAdded(context);
            }
          }
        }

        // Check if members were removed
        if (context.activity.membersRemoved && context.activity.membersRemoved.length > 0) {
          for (const member of context.activity.membersRemoved) {
            if (member.id === context.activity.recipient.id) {
              // Bot was removed - clean up conversation reference
              await this.handleBotRemoved(context);
            }
          }
        }

        // Track conversation update
        if (this.telemetryClient) {
          this.telemetryClient.trackEvent('BotConversationUpdate', {
            conversationId: context.activity.conversation.id,
            membersAdded: String(context.activity.membersAdded?.length || 0),
            membersRemoved: String(context.activity.membersRemoved?.length || 0),
          });
        }
      } catch (error) {
        // Track error but don't fail
        if (this.telemetryClient) {
          this.telemetryClient.trackException(error, {
            conversationId: context.activity.conversation.id,
            activityType: 'conversationUpdate',
          });
        }
      }

      await next();
    });

    // Handle sign-in verification for OAuth
    this.onTokenResponseEvent(async (context, next) => {
      try {
        // Track authentication event
        if (this.telemetryClient) {
          this.telemetryClient.trackEvent('BotAuthenticationSuccess', {
            userId: context.activity.from.id,
            conversationId: context.activity.conversation.id,
          });
        }

        await context.sendActivity('You have been successfully authenticated!');
      } catch (error) {
        if (this.telemetryClient) {
          this.telemetryClient.trackException(error, {
            activityType: 'tokenResponse',
          });
        }
      }

      await next();
    });
  }

  /**
   * Adds conversation reference for proactive messaging
   * 
   * @param {Object} activity - The activity containing conversation information
   */
  addConversationReference(activity) {
    const conversationReference = {
      conversationId: activity.conversation.id,
      userId: activity.from?.id,
      serviceUrl: activity.serviceUrl,
      channelId: activity.channelId,
      bot: activity.recipient,
      conversation: activity.conversation,
      activityId: activity.id,
      tenantId: activity.channelData?.tenant?.id,
    };

    this.conversationReferences.set(activity.conversation.id, conversationReference);
  }

  /**
   * Handles incoming user messages
   * 
   * @param {Object} context - Turn context
   * @param {string} text - Message text
   */
  async handleUserMessage(context, text) {
    if (!text) {
      await context.sendActivity('I received your message. How can I help you?');
      return;
    }

    const lowerText = text.toLowerCase();

    // Simple command handling
    if (lowerText === 'help') {
      await this.sendHelpMessage(context);
    } else if (lowerText === 'status') {
      await this.sendStatusMessage(context);
    } else {
      // Default response
      await context.sendActivity(
        `I received your message: "${text}". ` +
        `Type "help" to see available commands.`
      );
    }
  }

  /**
   * Sends help message to user
   * 
   * @param {Object} context - Turn context
   */
  async sendHelpMessage(context) {
    const helpCard = CardFactory.adaptiveCard({
      type: 'AdaptiveCard',
      version: '1.5',
      body: [
        {
          type: 'TextBlock',
          text: 'ChatOps Bot Help',
          weight: 'bolder',
          size: 'large',
        },
        {
          type: 'TextBlock',
          text: 'Available Commands:',
          weight: 'bolder',
          spacing: 'medium',
        },
        {
          type: 'TextBlock',
          text: '• **help** - Show this help message',
          wrap: true,
        },
        {
          type: 'TextBlock',
          text: '• **status** - Check bot status',
          wrap: true,
        },
        {
          type: 'TextBlock',
          text: '\n**Automated Notifications**',
          weight: 'bolder',
          spacing: 'medium',
        },
        {
          type: 'TextBlock',
          text: 'This bot will send you notifications for:',
          wrap: true,
        },
        {
          type: 'TextBlock',
          text: '• Code scanning alerts (critical/high severity)',
          wrap: true,
        },
        {
          type: 'TextBlock',
          text: '• Dependabot security alerts',
          wrap: true,
        },
        {
          type: 'TextBlock',
          text: '• Deployment approval requests',
          wrap: true,
        },
      ],
    });

    await context.sendActivity({ attachments: [helpCard] });
  }

  /**
   * Sends status message to user
   * 
   * @param {Object} context - Turn context
   */
  async sendStatusMessage(context) {
    const statusCard = CardFactory.adaptiveCard({
      type: 'AdaptiveCard',
      version: '1.5',
      body: [
        {
          type: 'TextBlock',
          text: 'Bot Status',
          weight: 'bolder',
          size: 'large',
        },
        {
          type: 'FactSet',
          facts: [
            {
              title: 'Status:',
              value: '✅ Online',
            },
            {
              title: 'Version:',
              value: '1.0.0',
            },
            {
              title: 'Service:',
              value: 'ChatOps Teams Integration',
            },
          ],
        },
      ],
    });

    await context.sendActivity({ attachments: [statusCard] });
  }

  /**
   * Handles adaptive card action callbacks
   * 
   * @param {Object} context - Turn context
   * @returns {Object} Invoke response
   */
  async handleAdaptiveCardAction(context) {
    const action = context.activity.value?.action;
    const data = context.activity.value?.data || {};

    // Handle different action types
    switch (action) {
      case 'acknowledge_alert':
        return await this.handleAcknowledgeAlert(context, data);
      
      case 'approve_deployment':
        return await this.handleApproveDeployment(context, data);
      
      case 'reject_deployment':
        return await this.handleRejectDeployment(context, data);
      
      case 'view_details':
        return await this.handleViewDetails(context, data);
      
      default:
        return {
          status: 200,
          body: { message: 'Action received but not yet implemented.' },
        };
    }
  }

  /**
   * Handles alert acknowledgment action
   * 
   * @param {Object} context - Turn context
   * @param {Object} data - Action data
   * @returns {Object} Invoke response
   */
  async handleAcknowledgeAlert(context, data) {
    const alertId = data.alertId;
    const userId = context.activity.from.id;
    const userName = context.activity.from.name;

    // Track acknowledgment
    if (this.telemetryClient) {
      this.telemetryClient.trackEvent('AlertAcknowledged', {
        alertId: alertId || 'unknown',
        userId,
        userName,
      });
    }

    // TODO: Update alert status in database

    // Send confirmation
    await context.sendActivity(`Alert ${alertId} has been acknowledged. Thank you!`);

    return {
      status: 200,
      body: { acknowledged: true, alertId, userId },
    };
  }

  /**
   * Handles deployment approval action
   * 
   * @param {Object} context - Turn context
   * @param {Object} data - Action data
   * @returns {Object} Invoke response
   */
  async handleApproveDeployment(context, data) {
    const deploymentId = data.deploymentId;
    const userId = context.activity.from.id;
    const userName = context.activity.from.name;

    // Track approval
    if (this.telemetryClient) {
      this.telemetryClient.trackEvent('DeploymentApproved', {
        deploymentId: deploymentId || 'unknown',
        userId,
        userName,
      });
    }

    // TODO: Update deployment status in GitHub
    // TODO: Update deployment record in database

    // Send confirmation
    await context.sendActivity(`Deployment ${deploymentId} has been approved by ${userName}.`);

    return {
      status: 200,
      body: { approved: true, deploymentId, approver: userId },
    };
  }

  /**
   * Handles deployment rejection action
   * 
   * @param {Object} context - Turn context
   * @param {Object} data - Action data
   * @returns {Object} Invoke response
   */
  async handleRejectDeployment(context, data) {
    const deploymentId = data.deploymentId;
    const reason = data.reason || 'No reason provided';
    const userId = context.activity.from.id;
    const userName = context.activity.from.name;

    // Track rejection
    if (this.telemetryClient) {
      this.telemetryClient.trackEvent('DeploymentRejected', {
        deploymentId: deploymentId || 'unknown',
        userId,
        userName,
        reason,
      });
    }

    // TODO: Update deployment status in GitHub
    // TODO: Update deployment record in database

    // Send confirmation
    await context.sendActivity(
      `Deployment ${deploymentId} has been rejected by ${userName}. Reason: ${reason}`
    );

    return {
      status: 200,
      body: { rejected: true, deploymentId, approver: userId, reason },
    };
  }

  /**
   * Handles view details action
   * 
   * @param {Object} context - Turn context
   * @param {Object} data - Action data
   * @returns {Object} Invoke response
   */
  async handleViewDetails(context, data) {
    // TODO: Retrieve and send detailed information
    await context.sendActivity('Detailed information will be displayed here.');

    return {
      status: 200,
      body: { viewed: true },
    };
  }

  /**
   * Handles when bot is added to a conversation
   * 
   * @param {Object} context - Turn context
   */
  async handleBotAdded(context) {
    const welcomeCard = CardFactory.adaptiveCard({
      type: 'AdaptiveCard',
      version: '1.5',
      body: [
        {
          type: 'TextBlock',
          text: '👋 Welcome to ChatOps!',
          weight: 'bolder',
          size: 'large',
        },
        {
          type: 'TextBlock',
          text: 'I will help you stay on top of security alerts and deployment approvals.',
          wrap: true,
          spacing: 'medium',
        },
        {
          type: 'TextBlock',
          text: '**What I can do:**',
          weight: 'bolder',
          spacing: 'medium',
        },
        {
          type: 'TextBlock',
          text: '• Notify you about critical code scanning alerts',
          wrap: true,
        },
        {
          type: 'TextBlock',
          text: '• Alert you to Dependabot security vulnerabilities',
          wrap: true,
        },
        {
          type: 'TextBlock',
          text: '• Request deployment approvals',
          wrap: true,
        },
        {
          type: 'TextBlock',
          text: '\nType **help** to see available commands.',
          wrap: true,
          spacing: 'medium',
        },
      ],
    });

    await context.sendActivity({ attachments: [welcomeCard] });

    // Track bot installation
    if (this.telemetryClient) {
      this.telemetryClient.trackEvent('BotInstalled', {
        conversationId: context.activity.conversation.id,
        tenantId: context.activity.channelData?.tenant?.id,
      });
    }
  }

  /**
   * Handles when a member is added to a conversation
   * 
   * @param {Object} context - Turn context
   * @param {Object} member - Member information
   */
  async handleMemberAdded(context, member) {
    // Track member added
    if (this.telemetryClient) {
      this.telemetryClient.trackEvent('ConversationMemberAdded', {
        conversationId: context.activity.conversation.id,
        memberId: member.id,
        memberName: member.name,
      });
    }
  }

  /**
   * Handles when bot is removed from a conversation
   * 
   * @param {Object} context - Turn context
   */
  async handleBotRemoved(context) {
    const conversationId = context.activity.conversation.id;

    // Remove conversation reference
    this.conversationReferences.delete(conversationId);

    // Track bot uninstallation
    if (this.telemetryClient) {
      this.telemetryClient.trackEvent('BotUninstalled', {
        conversationId,
        tenantId: context.activity.channelData?.tenant?.id,
      });
    }
  }

  /**
   * Sends graceful error message to user
   * 
   * @param {Object} context - Turn context
   * @param {Error} error - The error that occurred
   */
  async sendErrorMessage(context, error) {
    const errorCard = CardFactory.adaptiveCard({
      type: 'AdaptiveCard',
      version: '1.5',
      body: [
        {
          type: 'TextBlock',
          text: '⚠️ An Error Occurred',
          weight: 'bolder',
          size: 'large',
          color: 'warning',
        },
        {
          type: 'TextBlock',
          text: 'Sorry, I encountered an error processing your request.',
          wrap: true,
          spacing: 'medium',
        },
        {
          type: 'TextBlock',
          text: 'Please try again later or contact support if the issue persists.',
          wrap: true,
        },
      ],
    });

    try {
      await context.sendActivity({ attachments: [errorCard] });
    } catch (sendError) {
      // If we can't send the card, try a simple text message
      try {
        await context.sendActivity(
          '⚠️ An error occurred. Please try again later or contact support.'
        );
      } catch (finalError) {
        // Log the error but don't throw
        console.error('Failed to send error message to user:', finalError);
      }
    }
  }
}

module.exports = TeamsBot;
