/**
 * Teams Bot Framework Module
 * 
 * This module provides the Teams Bot Framework integration for the
 * ChatOps application, including:
 * - Bot activity handling
 * - Conversation management
 * - Proactive messaging
 * - Rate limiting
 * - OAuth authentication support
 * 
 * @module bot
 * 
 * @example
 * // Initialize the bot
 * const { createBotAdapter, TeamsBot, ConversationReferences, ProactiveMessagingService } = require('./bot');
 * const { getTelemetryClient } = require('./telemetry');
 * 
 * const telemetry = getTelemetryClient().initialize();
 * 
 * const conversationReferences = new ConversationReferences();
 * 
 * const adapter = createBotAdapter({
 *   appId: process.env.BOT_APP_ID,
 *   appPassword: process.env.BOT_APP_PASSWORD,
 *   telemetryClient: telemetry,
 * });
 * 
 * const bot = new TeamsBot(conversationReferences, telemetry);
 * 
 * const proactiveMessaging = new ProactiveMessagingService(
 *   adapter,
 *   conversationReferences,
 *   telemetry
 * );
 * 
 * // Use with Express
 * app.post('/api/messages', async (req, res) => {
 *   await adapter.process(req, res, async (context) => {
 *     await bot.run(context);
 *   });
 * });
 * 
 * // Send proactive message
 * await proactiveMessaging.sendMessageToUser(userId, 'Alert: Security issue detected!');
 */

const TeamsBot = require('./teamsBot');
const ConversationReferences = require('./conversationReferences');
const { createBotAdapter, RateLimiter } = require('./botAdapter');
const ProactiveMessagingService = require('./proactiveMessaging');

module.exports = {
  TeamsBot,
  ConversationReferences,
  createBotAdapter,
  RateLimiter,
  ProactiveMessagingService,
};
