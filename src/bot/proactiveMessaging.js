/**
 * Proactive Messaging Service
 * 
 * This module provides functionality for sending proactive messages
 * to users and channels in Microsoft Teams.
 * 
 * @module bot/proactiveMessaging
 */

const { MessageFactory } = require('botbuilder');

/**
 * Proactive Messaging Service
 * 
 * Handles sending messages to users without them initiating the conversation
 */
class ProactiveMessagingService {
  /**
   * Creates a new ProactiveMessagingService instance
   * 
   * @param {Object} adapter - Bot adapter
   * @param {Object} conversationReferences - Conversation references storage
   * @param {Object} [telemetryClient] - Application Insights telemetry client
   */
  constructor(adapter, conversationReferences, telemetryClient) {
    if (!adapter) {
      throw new Error('adapter is required');
    }
    if (!conversationReferences) {
      throw new Error('conversationReferences is required');
    }

    this.adapter = adapter;
    this.conversationReferences = conversationReferences;
    this.telemetryClient = telemetryClient;
  }

  /**
   * Sends a proactive message to a specific conversation
   * 
   * @param {string} conversationId - Conversation ID
   * @param {Object|string} message - Message activity or text
   * @returns {Promise<boolean>} True if sent successfully, false otherwise
   */
  async sendMessageToConversation(conversationId, message) {
    const startTime = Date.now();

    try {
      // Get conversation reference
      const conversationReference = this.conversationReferences.get(conversationId);

      if (!conversationReference) {
        console.warn(`Conversation reference not found for: ${conversationId}`);
        
        if (this.telemetryClient) {
          this.telemetryClient.trackEvent('ProactiveMessageConversationNotFound', {
            conversationId,
          });
        }

        return false;
      }

      // Send the message
      await this.adapter.continueConversationWithRateLimit(
        conversationReference,
        async (context) => {
          await context.sendActivity(message);
        }
      );

      // Track success
      if (this.telemetryClient) {
        const duration = Date.now() - startTime;
        this.telemetryClient.trackMetric('ProactiveMessageSendTime', duration, {
          conversationId,
          success: 'true',
        });
      }

      return true;
    } catch (error) {
      console.error(`Error sending proactive message to ${conversationId}:`, error);

      // Track error
      if (this.telemetryClient) {
        const duration = Date.now() - startTime;
        this.telemetryClient.trackException(error, {
          conversationId,
          operationType: 'proactiveMessage',
        });
        this.telemetryClient.trackMetric('ProactiveMessageSendTime', duration, {
          conversationId,
          success: 'false',
        });
      }

      return false;
    }
  }

  /**
   * Sends a proactive message to a specific user
   * 
   * @param {string} userId - User ID
   * @param {Object|string} message - Message activity or text
   * @returns {Promise<number>} Number of messages sent successfully
   */
  async sendMessageToUser(userId, message) {
    // Get all conversations for the user
    const userConversations = this.conversationReferences.getByUserId(userId);

    if (userConversations.length === 0) {
      console.warn(`No conversation references found for user: ${userId}`);
      
      if (this.telemetryClient) {
        this.telemetryClient.trackEvent('ProactiveMessageUserNotFound', {
          userId,
        });
      }

      return 0;
    }

    // Send to all conversations (typically just one for 1-on-1)
    let successCount = 0;
    for (const conversationRef of userConversations) {
      const success = await this.sendMessageToConversation(
        conversationRef.conversationId,
        message
      );
      if (success) {
        successCount++;
      }
    }

    return successCount;
  }

  /**
   * Sends a proactive message to multiple users
   * 
   * @param {Array<string>} userIds - Array of user IDs
   * @param {Object|string} message - Message activity or text
   * @returns {Promise<Object>} Object with success and failure counts
   */
  async sendMessageToUsers(userIds, message) {
    const results = {
      sent: 0,
      failed: 0,
      userIds: [],
    };

    for (const userId of userIds) {
      const sentCount = await this.sendMessageToUser(userId, message);
      
      if (sentCount > 0) {
        results.sent += sentCount;
        results.userIds.push(userId);
      } else {
        results.failed++;
      }
    }

    // Track batch send
    if (this.telemetryClient) {
      this.telemetryClient.trackEvent('ProactiveMessageBatchSend', {
        totalUsers: String(userIds.length),
        sentCount: String(results.sent),
        failedCount: String(results.failed),
      });
    }

    return results;
  }

  /**
   * Sends an adaptive card to a conversation
   * 
   * @param {string} conversationId - Conversation ID
   * @param {Object} cardJson - Adaptive card JSON
   * @returns {Promise<boolean>} True if sent successfully, false otherwise
   */
  async sendAdaptiveCard(conversationId, cardJson) {
    const cardActivity = MessageFactory.attachment({
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: cardJson,
    });

    return await this.sendMessageToConversation(conversationId, cardActivity);
  }

  /**
   * Sends an adaptive card to a user
   * 
   * @param {string} userId - User ID
   * @param {Object} cardJson - Adaptive card JSON
   * @returns {Promise<number>} Number of cards sent successfully
   */
  async sendAdaptiveCardToUser(userId, cardJson) {
    const cardActivity = MessageFactory.attachment({
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: cardJson,
    });

    return await this.sendMessageToUser(userId, cardActivity);
  }

  /**
   * Sends an adaptive card to multiple users
   * 
   * @param {Array<string>} userIds - Array of user IDs
   * @param {Object} cardJson - Adaptive card JSON
   * @returns {Promise<Object>} Object with success and failure counts
   */
  async sendAdaptiveCardToUsers(userIds, cardJson) {
    const cardActivity = MessageFactory.attachment({
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: cardJson,
    });

    return await this.sendMessageToUsers(userIds, cardActivity);
  }

  /**
   * Updates an existing message in a conversation
   * 
   * @param {string} conversationId - Conversation ID
   * @param {string} activityId - Activity ID of the message to update
   * @param {Object|string} newMessage - New message content
   * @returns {Promise<boolean>} True if updated successfully, false otherwise
   */
  async updateMessage(conversationId, activityId, newMessage) {
    try {
      const conversationReference = this.conversationReferences.get(conversationId);

      if (!conversationReference) {
        console.warn(`Conversation reference not found for: ${conversationId}`);
        return false;
      }

      await this.adapter.continueConversationWithRateLimit(
        conversationReference,
        async (context) => {
          const activity =
            typeof newMessage === 'string'
              ? MessageFactory.text(newMessage)
              : newMessage;
          
          activity.id = activityId;
          await context.updateActivity(activity);
        }
      );

      // Track success
      if (this.telemetryClient) {
        this.telemetryClient.trackEvent('ProactiveMessageUpdated', {
          conversationId,
          activityId,
        });
      }

      return true;
    } catch (error) {
      console.error(`Error updating message in ${conversationId}:`, error);

      // Track error
      if (this.telemetryClient) {
        this.telemetryClient.trackException(error, {
          conversationId,
          activityId,
          operationType: 'updateMessage',
        });
      }

      return false;
    }
  }

  /**
   * Deletes a message from a conversation
   * 
   * @param {string} conversationId - Conversation ID
   * @param {string} activityId - Activity ID of the message to delete
   * @returns {Promise<boolean>} True if deleted successfully, false otherwise
   */
  async deleteMessage(conversationId, activityId) {
    try {
      const conversationReference = this.conversationReferences.get(conversationId);

      if (!conversationReference) {
        console.warn(`Conversation reference not found for: ${conversationId}`);
        return false;
      }

      await this.adapter.continueConversationWithRateLimit(
        conversationReference,
        async (context) => {
          await context.deleteActivity(activityId);
        }
      );

      // Track success
      if (this.telemetryClient) {
        this.telemetryClient.trackEvent('ProactiveMessageDeleted', {
          conversationId,
          activityId,
        });
      }

      return true;
    } catch (error) {
      console.error(`Error deleting message in ${conversationId}:`, error);

      // Track error
      if (this.telemetryClient) {
        this.telemetryClient.trackException(error, {
          conversationId,
          activityId,
          operationType: 'deleteMessage',
        });
      }

      return false;
    }
  }
}

module.exports = ProactiveMessagingService;
