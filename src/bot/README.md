# Teams Bot Framework Service

This module implements the Microsoft Teams Bot Framework integration for the ChatOps application. It handles incoming messages, processes adaptive card actions, manages conversations for proactive messaging, and integrates with Azure Application Insights for telemetry.

## Features

- **Message Handling**: Processes incoming messages from users with commands (help, status)
- **Adaptive Card Actions**: Handles interactive button callbacks for alert acknowledgments and deployment approvals
- **Conversation Management**: Stores conversation references for proactive messaging
- **OAuth Authentication**: Supports Entra ID authentication flow
- **Rate Limiting**: Implements Teams API rate limits (30 messages/minute per conversation)
- **Error Handling**: Graceful error messages and comprehensive error tracking
- **Telemetry**: Full Application Insights integration for monitoring and diagnostics
- **Retry Logic**: Exponential backoff for failed message sends

## Architecture

### Components

1. **TeamsBot** (`teamsBot.js`): Main bot activity handler
   - Handles message, invoke, and conversationUpdate activities
   - Processes user commands and adaptive card actions
   - Manages conversation lifecycle

2. **ConversationReferences** (`conversationReferences.js`): Storage for conversation data
   - In-memory storage (replace with database in production)
   - Stores conversation context for proactive messaging
   - Supports filtering by user ID and tenant ID

3. **BotAdapter** (`botAdapter.js`): Configured adapter with resilience
   - Rate limiting implementation
   - Retry logic with exponential backoff
   - Error handling and telemetry

4. **ProactiveMessagingService** (`proactiveMessaging.js`): Proactive messaging capabilities
   - Send messages to users without them initiating
   - Send adaptive cards
   - Update and delete messages
   - Batch messaging to multiple users

5. **Server** (`server.js`): HTTP server for bot endpoints
   - Bot messages endpoint (`/api/messages`)
   - Health check endpoint (`/health`)
   - Admin endpoints for testing

## Installation

```bash
cd src
npm install
```

## Configuration

Set the following environment variables:

```bash
# Required
BOT_APP_ID=<your-microsoft-app-id>
BOT_APP_PASSWORD=<your-microsoft-app-password>

# Optional
PORT=3978
APPLICATIONINSIGHTS_CONNECTION_STRING=<your-app-insights-connection-string>
```

## Usage

### Starting the Bot Server

```bash
node src/bot/server.js
```

Or with environment variables:

```bash
BOT_APP_ID=xxx BOT_APP_PASSWORD=yyy node src/bot/server.js
```

### Integration Example

```javascript
const express = require('express');
const { 
  createBotAdapter, 
  TeamsBot, 
  ConversationReferences, 
  ProactiveMessagingService 
} = require('./bot');
const { getTelemetryClient } = require('./telemetry');

// Initialize telemetry
const telemetry = getTelemetryClient({
  connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
}).initialize();

// Create conversation storage
const conversationReferences = new ConversationReferences();

// Create adapter
const adapter = createBotAdapter({
  appId: process.env.BOT_APP_ID,
  appPassword: process.env.BOT_APP_PASSWORD,
  telemetryClient: telemetry,
});

// Create bot
const bot = new TeamsBot(conversationReferences, telemetry);

// Create proactive messaging service
const proactiveMessaging = new ProactiveMessagingService(
  adapter,
  conversationReferences,
  telemetry
);

// Create Express app
const app = express();
app.use(express.json());

// Handle bot messages
app.post('/api/messages', async (req, res) => {
  await adapter.process(req, res, async (context) => {
    await bot.run(context);
  });
});

// Start server
app.listen(3978, () => {
  console.log('Bot listening on port 3978');
});

// Send proactive notification
await proactiveMessaging.sendMessageToUser(
  userId,
  'Alert: Critical security issue detected!'
);

// Send adaptive card
await proactiveMessaging.sendAdaptiveCardToUser(userId, {
  type: 'AdaptiveCard',
  version: '1.5',
  body: [
    {
      type: 'TextBlock',
      text: 'Security Alert',
      weight: 'bolder',
      size: 'large',
    },
  ],
});
```

## API Endpoints

### Bot Messages
- **POST** `/api/messages`
  - Receives messages from Microsoft Teams
  - Processes activities (messages, invokes, conversation updates)

### Health Check
- **GET** `/health`
  - Returns bot health status
  - Shows conversation count

### Proactive Messaging (Admin)
- **POST** `/api/proactive/:conversationId`
  - Sends proactive message to a conversation
  - Body: `{ "message": "Your message here" }`

### Conversation List (Debug)
- **GET** `/api/conversations`
  - Lists all stored conversation references
  - Returns conversation IDs and metadata

## Activity Handlers

### onMessage
Handles incoming text messages from users:
- Processes commands (help, status)
- Stores conversation reference
- Tracks message metrics

### onInvoke
Handles adaptive card action callbacks:
- `acknowledge_alert` - Acknowledge security alerts
- `approve_deployment` - Approve deployment requests
- `reject_deployment` - Reject deployment requests
- `view_details` - View detailed information

### onConversationUpdate
Handles conversation lifecycle:
- Bot added to conversation: Send welcome message
- Bot removed: Clean up conversation reference
- Members added/removed: Track changes

### onTokenResponseEvent
Handles OAuth authentication:
- Processes sign-in verification
- Tracks authentication events

## Rate Limiting

The bot implements rate limiting per Teams API limits:
- **30 messages per minute per conversation**
- Automatic queuing when limit is reached
- Wait time calculation for next available slot

## Retry Logic

Failed message sends are retried with exponential backoff:
- **Max retries**: 3
- **Backoff**: 1s, 2s, 4s, 8s (capped at 8s)
- Tracks retry attempts in telemetry

## Telemetry Events

### Custom Events
- `BotMessageReceived` - Message received from user
- `BotInvokeReceived` - Adaptive card action received
- `BotConversationUpdate` - Conversation updated
- `BotAuthenticationSuccess` - User authenticated
- `BotInstalled` - Bot installed in conversation
- `BotUninstalled` - Bot removed from conversation
- `AlertAcknowledged` - Alert acknowledged by user
- `DeploymentApproved` - Deployment approved
- `DeploymentRejected` - Deployment rejected
- `ProactiveMessageSent` - Proactive message sent
- `BotRateLimitHit` - Rate limit reached

### Custom Metrics
- `BotMessageProcessingTime` - Time to process message
- `BotInvokeProcessingTime` - Time to process action
- `ProactiveMessageSendTime` - Time to send proactive message

### Exceptions
All errors are tracked with context:
- Conversation ID
- Activity type
- User ID
- Error details

## Production Considerations

### Conversation Storage
The current implementation uses in-memory storage. For production:

1. **Azure SQL Database**
   ```sql
   CREATE TABLE ConversationReferences (
     ConversationId NVARCHAR(255) PRIMARY KEY,
     UserId NVARCHAR(255),
     ServiceUrl NVARCHAR(500),
     ChannelId NVARCHAR(50),
     TenantId NVARCHAR(255),
     ReferenceJson NVARCHAR(MAX),
     LastUpdated DATETIME
   );
   ```

2. **Azure Cosmos DB**
   - Use conversation ID as partition key
   - TTL for automatic cleanup of old references

3. **Azure Table Storage**
   - Low cost option for simple storage
   - Good for high-volume scenarios

### OAuth Configuration
For Entra ID authentication:

1. Register OAuth connection in Azure Bot Service
2. Configure redirect URIs
3. Set up token store
4. Implement token refresh logic

### Scaling
For high availability:
- Deploy multiple instances behind load balancer
- Use distributed conversation storage (database)
- Implement sticky sessions if needed
- Monitor rate limits per instance

## Testing

### Manual Testing with Bot Framework Emulator
1. Download [Bot Framework Emulator](https://github.com/Microsoft/BotFramework-Emulator)
2. Start the bot server
3. Connect to `http://localhost:3978/api/messages`
4. Test message handling and adaptive cards

### Integration Testing
```javascript
// Example test
const { TeamsBot, ConversationReferences } = require('./bot');

describe('TeamsBot', () => {
  it('should handle help command', async () => {
    const conversationRefs = new ConversationReferences();
    const bot = new TeamsBot(conversationRefs);
    
    // Test message handling
    // ...
  });
});
```

## Troubleshooting

### Bot not receiving messages
- Verify BOT_APP_ID and BOT_APP_PASSWORD are correct
- Check Bot Service messaging endpoint is configured
- Ensure HTTPS endpoint is accessible
- Verify bot is installed in the team/chat

### Proactive messages not sending
- Check conversation reference exists
- Verify service URL is valid
- Check rate limits aren't exceeded
- Review Application Insights for errors

### Adaptive card actions not working
- Verify card JSON is valid (use Adaptive Cards Designer)
- Check action handler is implemented
- Review invoke activity telemetry
- Ensure bot has proper permissions

## References

- [Bot Framework SDK](https://github.com/Microsoft/botbuilder-js)
- [Teams Bot Documentation](https://docs.microsoft.com/en-us/microsoftteams/platform/bots/what-are-bots)
- [Adaptive Cards](https://adaptivecards.io/)
- [Application Insights](https://docs.microsoft.com/en-us/azure/azure-monitor/app/nodejs)
