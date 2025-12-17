/**
 * Bot Adapter with Rate Limiting and Resilience
 * 
 * This module creates and configures the Bot Framework adapter with:
 * - Error handling
 * - Rate limiting
 * - Retry logic
 * - Telemetry integration
 * 
 * @module bot/botAdapter
 */

const {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication,
  ConfigurationServiceClientCredentialFactory,
} = require('botbuilder');

/**
 * Rate limiter implementation
 * 
 * Teams API limits: 30 messages per minute per conversation
 */
class RateLimiter {
  constructor(maxRequests = 30, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map(); // conversationId -> [timestamps]
  }

  /**
   * Checks if a request is allowed
   * 
   * @param {string} conversationId - Conversation identifier
   * @returns {boolean} True if request is allowed, false if rate limited
   */
  isAllowed(conversationId) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get or create request history for this conversation
    let requestTimes = this.requests.get(conversationId) || [];

    // Remove expired timestamps
    requestTimes = requestTimes.filter((time) => time > windowStart);

    // Check if under limit
    if (requestTimes.length >= this.maxRequests) {
      return false;
    }

    // Add current request
    requestTimes.push(now);
    this.requests.set(conversationId, requestTimes);

    return true;
  }

  /**
   * Gets time to wait before next request is allowed
   * 
   * @param {string} conversationId - Conversation identifier
   * @returns {number} Milliseconds to wait, or 0 if request is allowed
   */
  getWaitTime(conversationId) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const requestTimes = this.requests.get(conversationId) || [];
    const validTimes = requestTimes.filter((time) => time > windowStart);

    if (validTimes.length < this.maxRequests) {
      return 0;
    }

    // Wait until the oldest request in the window expires
    const oldestTime = validTimes[0];
    return oldestTime + this.windowMs - now;
  }
}

/**
 * Creates and configures the bot adapter
 * 
 * @param {Object} config - Configuration object
 * @param {string} config.appId - Microsoft App ID
 * @param {string} config.appPassword - Microsoft App Password
 * @param {Object} [config.telemetryClient] - Application Insights telemetry client
 * @returns {CloudAdapter} Configured bot adapter
 */
function createBotAdapter(config) {
  const { appId, appPassword, telemetryClient } = config;

  // Validate required configuration
  if (!appId) {
    throw new Error('Bot App ID is required');
  }
  if (!appPassword) {
    throw new Error('Bot App Password is required');
  }

  // Create credential factory
  const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
    MicrosoftAppId: appId,
    MicrosoftAppPassword: appPassword,
    MicrosoftAppType: 'MultiTenant', // or 'SingleTenant' for specific tenant
  });

  // Create bot framework authentication
  const botFrameworkAuthentication = new ConfigurationBotFrameworkAuthentication(
    {},
    credentialsFactory
  );

  // Create the adapter
  const adapter = new CloudAdapter(botFrameworkAuthentication);

  // Create rate limiter
  const rateLimiter = new RateLimiter();

  // Configure error handler
  adapter.onTurnError = async (context, error) => {
    // Log the error
    console.error('[Bot Error]', error);

    // Track error in telemetry
    if (telemetryClient) {
      telemetryClient.trackException(error, {
        conversationId: context.activity?.conversation?.id,
        activityType: context.activity?.type,
        activityId: context.activity?.id,
      });
    }

    // Send error message to user
    try {
      await context.sendActivity(
        '⚠️ Sorry, an error occurred. The issue has been logged and will be investigated.'
      );
    } catch (sendError) {
      console.error('[Bot Error] Failed to send error message:', sendError);
    }

    // Send trace activity for Bot Framework Emulator
    if (context.activity?.channelId === 'emulator') {
      await context.sendTraceActivity(
        'OnTurnError Trace',
        error.toString(),
        'https://www.botframework.com/schemas/error',
        'TurnError'
      );
    }
  };

  /**
   * Send activity with rate limiting and retry logic
   * 
   * @param {Object} context - Turn context
   * @param {Object} activity - Activity to send
   * @param {number} [maxRetries=3] - Maximum number of retry attempts
   * @returns {Promise<Object>} Send activity result
   */
  adapter.sendActivityWithRetry = async function (context, activity, maxRetries = 3) {
    const conversationId = context.activity?.conversation?.id;

    // Check rate limit
    if (!rateLimiter.isAllowed(conversationId)) {
      const waitTime = rateLimiter.getWaitTime(conversationId);
      
      // Track rate limit hit
      if (telemetryClient) {
        telemetryClient.trackEvent('BotRateLimitHit', {
          conversationId,
          waitTime: String(waitTime),
        });
      }

      // Wait before proceeding
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    // Retry logic with exponential backoff
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await context.sendActivity(activity);
        
        // Track successful send
        if (telemetryClient && attempt > 0) {
          telemetryClient.trackEvent('BotSendRetrySuccess', {
            conversationId,
            attempts: String(attempt + 1),
          });
        }

        return result;
      } catch (error) {
        lastError = error;
        
        // Calculate backoff delay: 1s, 2s, 4s, 8s, etc.
        const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
        
        // Track retry attempt
        if (telemetryClient) {
          telemetryClient.trackEvent('BotSendRetry', {
            conversationId,
            attempt: String(attempt + 1),
            delay: String(delay),
            error: error.message,
          });
        }

        // Don't retry on the last attempt
        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    if (telemetryClient) {
      telemetryClient.trackException(lastError, {
        conversationId,
        maxRetries: String(maxRetries),
        finalFailure: 'true',
      });
    }

    throw lastError;
  };

  /**
   * Continue conversation with rate limiting
   * 
   * @param {Object} conversationReference - Conversation reference
   * @param {Function} logic - Logic to execute in the conversation
   * @returns {Promise<void>}
   */
  adapter.continueConversationWithRateLimit = async function (
    conversationReference,
    logic
  ) {
    const conversationId = conversationReference.conversation?.id;

    // Check rate limit
    if (!rateLimiter.isAllowed(conversationId)) {
      const waitTime = rateLimiter.getWaitTime(conversationId);
      
      // Track rate limit hit
      if (telemetryClient) {
        telemetryClient.trackEvent('BotProactiveRateLimitHit', {
          conversationId,
          waitTime: String(waitTime),
        });
      }

      // Wait before proceeding
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    // Continue conversation
    return await adapter.continueConversationAsync(
      appId,
      conversationReference,
      logic
    );
  };

  return adapter;
}

module.exports = {
  createBotAdapter,
  RateLimiter,
};
