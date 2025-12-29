/**
 * Bot Server
 * 
 * Simple HTTP server to host the Teams bot endpoint.
 * This file demonstrates how to integrate the bot with an Express server.
 * 
 * In production, this would be integrated with the main application server.
 * 
 * @module bot/server
 */

const express = require('express');
const { createBotAdapter, TeamsBot, ConversationReferences, ProactiveMessagingService } = require('./index');
const { getTelemetryClient } = require('../telemetry');
const { validateWebhookSignature, getEventType, getDeliveryId, isSupportedEventType } = require('./webhookValidator');
const { routeWebhookEvent } = require('./webhookHandlers');

/**
 * Creates and starts the bot server
 * 
 * @param {Object} config - Server configuration
 * @param {number} [config.port=3978] - Port to listen on
 * @param {string} config.appId - Microsoft App ID
 * @param {string} config.appPassword - Microsoft App Password
 * @param {string} [config.appInsightsConnectionString] - Application Insights connection string
 * @returns {Object} Object containing server, adapter, bot, and proactive messaging service
 */
function createBotServer(config = {}) {
  const {
    port = 3978,
    appId,
    appPassword,
    appInsightsConnectionString,
    githubWebhookSecret,
  } = config;

  // Validate required configuration
  if (!appId) {
    throw new Error('BOT_APP_ID is required');
  }
  if (!appPassword) {
    throw new Error('BOT_APP_PASSWORD is required');
  }

  // Initialize telemetry
  const telemetryClient = getTelemetryClient({
    connectionString: appInsightsConnectionString,
    cloudRole: 'chatops-bot',
  }).initialize();

  // Create conversation references storage
  const conversationReferences = new ConversationReferences();

  // Create bot adapter
  const adapter = createBotAdapter({
    appId,
    appPassword,
    telemetryClient,
  });

  // Create bot
  const bot = new TeamsBot(conversationReferences, telemetryClient);

  // Create proactive messaging service
  const proactiveMessaging = new ProactiveMessagingService(
    adapter,
    conversationReferences,
    telemetryClient
  );

  // Create Express app
  const app = express();

  // Middleware for webhook endpoints - preserve raw body for signature validation
  app.use('/api/webhooks/github', express.raw({ type: 'application/json' }));

  // Parse JSON bodies for other endpoints
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'ChatOps Teams Bot',
      version: '1.0.0',
      conversationCount: conversationReferences.size(),
    });
  });

  // Bot messages endpoint
  app.post('/api/messages', async (req, res) => {
    try {
      await adapter.process(req, res, async (context) => {
        await bot.run(context);
      });
    } catch (error) {
      console.error('Error processing bot message:', error);
      
      if (telemetryClient) {
        telemetryClient.trackException(error, {
          endpoint: '/api/messages',
        });
      }

      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  // Proactive message endpoint (for testing/admin use)
  // WARNING: This endpoint is for testing/development only!
  // In production, this MUST be protected with proper authentication/authorization
  // TODO: Add authentication middleware (e.g., Azure AD bearer token validation)
  app.post('/api/proactive/:conversationId', async (req, res) => {
    const { conversationId } = req.params;
    const { message } = req.body;

    // TODO: Add authentication check
    // Example: if (!req.user || !req.user.roles.includes('admin')) { return res.status(403).json({ error: 'Forbidden' }); }

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    try {
      const success = await proactiveMessaging.sendMessageToConversation(
        conversationId,
        message
      );

      if (success) {
        res.json({ status: 'sent', conversationId });
      } else {
        res.status(404).json({ error: 'Conversation not found' });
      }
    } catch (error) {
      console.error('Error sending proactive message:', error);
      
      if (telemetryClient) {
        telemetryClient.trackException(error, {
          endpoint: '/api/proactive',
          conversationId,
        });
      }

      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  // Get conversation references (for debugging)
  app.get('/api/conversations', (req, res) => {
    const conversations = conversationReferences.getAll();
    res.json({
      count: conversations.length,
      conversations: conversations.map((ref) => ({
        conversationId: ref.conversationId,
        userId: ref.userId,
        tenantId: ref.tenantId,
        lastUpdated: ref.lastUpdated,
      })),
    });
  });

  // GitHub webhook endpoint - GET for webhook verification
  app.get('/api/webhooks/github', (req, res) => {
    // GitHub doesn't use GET for webhook verification, but we provide this for health check
    res.json({
      status: 'ready',
      message: 'GitHub webhook endpoint is configured',
      supportedEvents: [
        'code_scanning_alert',
        'dependabot_alert',
        'deployment_protection_rule',
        'ping',
      ],
    });
  });

  // GitHub webhook endpoint - POST for receiving webhook events
  app.post('/api/webhooks/github', async (req, res) => {
    const startTime = Date.now();
    const signature = req.headers['x-hub-signature-256'];
    const eventType = getEventType(req.headers);
    const deliveryId = getDeliveryId(req.headers);

    console.log(`Received GitHub webhook: event=${eventType}, delivery=${deliveryId}`);

    // Track webhook receipt
    if (telemetryClient) {
      telemetryClient.trackEvent('GitHubWebhookReceived', {
        eventType: eventType || 'unknown',
        deliveryId: deliveryId || 'unknown',
        hasSignature: signature ? 'true' : 'false',
      });
    }

    try {
      // Validate webhook secret is configured
      if (!githubWebhookSecret) {
        console.error('GitHub webhook secret is not configured');
        
        if (telemetryClient) {
          telemetryClient.trackEvent('GitHubWebhookError', {
            error: 'MissingSecret',
            eventType: eventType || 'unknown',
            deliveryId: deliveryId || 'unknown',
          });
        }

        return res.status(500).json({ 
          error: 'Webhook secret not configured',
          message: 'GITHUB_WEBHOOK_SECRET environment variable is required',
        });
      }

      // Validate webhook signature
      const rawBody = req.body; // Raw buffer from express.raw() middleware
      const isValid = validateWebhookSignature(rawBody, signature, githubWebhookSecret);

      if (!isValid) {
        console.error('Invalid webhook signature');
        
        if (telemetryClient) {
          telemetryClient.trackEvent('GitHubWebhookError', {
            error: 'InvalidSignature',
            eventType: eventType || 'unknown',
            deliveryId: deliveryId || 'unknown',
          });

          telemetryClient.trackMetric('WebhookValidationFailures', 1, {
            eventType: eventType || 'unknown',
          });
        }

        return res.status(401).json({ 
          error: 'Invalid signature',
          message: 'Webhook signature validation failed',
        });
      }

      // Parse JSON payload after validation
      const payload = JSON.parse(rawBody.toString('utf8'));

      // Check if event type is supported
      if (!isSupportedEventType(eventType)) {
        console.warn(`Unsupported event type: ${eventType}`);
        
        if (telemetryClient) {
          telemetryClient.trackEvent('GitHubWebhookError', {
            error: 'UnsupportedEventType',
            eventType: eventType || 'unknown',
            deliveryId: deliveryId || 'unknown',
          });
        }

        return res.status(200).json({
          status: 'ignored',
          message: `Event type '${eventType}' is not supported`,
        });
      }

      // Route webhook event to appropriate handler
      const result = await routeWebhookEvent(eventType, payload, telemetryClient);

      // Track processing time
      const processingTime = Date.now() - startTime;
      
      if (telemetryClient) {
        telemetryClient.trackMetric('WebhookProcessingTime', processingTime, {
          eventType: eventType,
          status: result.status,
        });

        telemetryClient.trackEvent('GitHubWebhookProcessed', {
          eventType: eventType,
          deliveryId: deliveryId || 'unknown',
          status: result.status,
          processingTimeMs: String(processingTime),
        });
      }

      console.log(`Webhook processed successfully: event=${eventType}, delivery=${deliveryId}, time=${processingTime}ms`);

      res.status(200).json(result);
    } catch (error) {
      console.error('Error processing webhook:', error);
      
      const processingTime = Date.now() - startTime;

      if (telemetryClient) {
        telemetryClient.trackException(error, {
          endpoint: '/api/webhooks/github',
          eventType: eventType || 'unknown',
          deliveryId: deliveryId || 'unknown',
          processingTimeMs: String(processingTime),
        });

        telemetryClient.trackMetric('WebhookProcessingErrors', 1, {
          eventType: eventType || 'unknown',
          errorType: error.name || 'UnknownError',
        });
      }

      // Send error response
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'Internal server error',
          message: 'Failed to process webhook',
          deliveryId: deliveryId,
        });
      }
    }
  });

  return {
    app,
    adapter,
    bot,
    conversationReferences,
    proactiveMessaging,
    telemetryClient,
  };
}

/**
 * Starts the bot server
 * 
 * @param {Object} serverComponents - Server components from createBotServer
 * @param {number} [port=3978] - Port to listen on
 */
function startBotServer(serverComponents, port = 3978) {
  const { app, telemetryClient } = serverComponents;

  const server = app.listen(port, () => {
    console.log(`\nChatOps Teams Bot listening on port ${port}`);
    console.log('\nBot endpoints:');
    console.log(`  POST http://localhost:${port}/api/messages - Bot messages endpoint`);
    console.log(`  POST http://localhost:${port}/api/webhooks/github - GitHub webhook endpoint`);
    console.log(`  GET  http://localhost:${port}/api/webhooks/github - Webhook status`);
    console.log(`  GET  http://localhost:${port}/health - Health check`);
    
    if (telemetryClient) {
      telemetryClient.trackEvent('BotServerStarted', {
        port: String(port),
      });
    }
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down bot server...');
    
    if (telemetryClient) {
      telemetryClient.trackEvent('BotServerStopped');
      await telemetryClient.flush();
    }

    server.close(() => {
      console.log('Bot server stopped');
      process.exit(0);
    });
  });

  return server;
}

// If running directly, start the server
if (require.main === module) {
  const config = {
    port: process.env.PORT || 3978,
    appId: process.env.BOT_APP_ID,
    appPassword: process.env.BOT_APP_PASSWORD,
    appInsightsConnectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
    githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
  };

  const serverComponents = createBotServer(config);
  startBotServer(serverComponents, config.port);
}

module.exports = {
  createBotServer,
  startBotServer,
};
