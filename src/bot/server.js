/**
 * Bot Server
 * 
 * Simple HTTP server to host the Teams bot endpoint.
 * This file demonstrates how to integrate the bot with an Express-like server.
 * 
 * In production, this would be integrated with the main application server.
 * 
 * @module bot/server
 */

const restify = require('restify');
const { createBotAdapter, TeamsBot, ConversationReferences, ProactiveMessagingService } = require('./index');
const { getTelemetryClient } = require('../telemetry');

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

  // Create HTTP server
  const server = restify.createServer({
    name: 'ChatOps Teams Bot',
    version: '1.0.0',
  });

  server.use(restify.plugins.bodyParser());
  server.use(restify.plugins.queryParser());

  // Health check endpoint
  server.get('/health', (req, res, next) => {
    res.send(200, {
      status: 'healthy',
      service: 'ChatOps Teams Bot',
      version: '1.0.0',
      conversationCount: conversationReferences.size(),
    });
    next();
  });

  // Bot messages endpoint
  server.post('/api/messages', async (req, res, next) => {
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

      res.send(500, { error: 'Internal server error' });
    }
    next();
  });

  // Proactive message endpoint (for testing/admin use)
  // In production, this should be protected with authentication
  server.post('/api/proactive/:conversationId', async (req, res, next) => {
    const { conversationId } = req.params;
    const { message } = req.body;

    if (!message) {
      res.send(400, { error: 'message is required' });
      return next();
    }

    try {
      const success = await proactiveMessaging.sendMessageToConversation(
        conversationId,
        message
      );

      if (success) {
        res.send(200, { status: 'sent', conversationId });
      } else {
        res.send(404, { error: 'Conversation not found' });
      }
    } catch (error) {
      console.error('Error sending proactive message:', error);
      
      if (telemetryClient) {
        telemetryClient.trackException(error, {
          endpoint: '/api/proactive',
          conversationId,
        });
      }

      res.send(500, { error: 'Failed to send message' });
    }
    next();
  });

  // Get conversation references (for debugging)
  server.get('/api/conversations', (req, res, next) => {
    const conversations = conversationReferences.getAll();
    res.send(200, {
      count: conversations.length,
      conversations: conversations.map((ref) => ({
        conversationId: ref.conversationId,
        userId: ref.userId,
        tenantId: ref.tenantId,
        lastUpdated: ref.lastUpdated,
      })),
    });
    next();
  });

  return {
    server,
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
  const { server, telemetryClient } = serverComponents;

  server.listen(port, () => {
    console.log(`\n${server.name} listening on port ${port}`);
    console.log('\nBot endpoints:');
    console.log(`  POST http://localhost:${port}/api/messages - Bot messages endpoint`);
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
}

// If running directly, start the server
if (require.main === module) {
  const config = {
    port: process.env.PORT || 3978,
    appId: process.env.BOT_APP_ID,
    appPassword: process.env.BOT_APP_PASSWORD,
    appInsightsConnectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
  };

  const serverComponents = createBotServer(config);
  startBotServer(serverComponents, config.port);
}

module.exports = {
  createBotServer,
  startBotServer,
};
