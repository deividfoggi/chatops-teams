# Identity Module

Maps GitHub usernames to Microsoft Entra ID (Azure AD) identities to enable targeted notifications in Microsoft Teams. Includes Teams user retrieval with batch operations, presence information, and intelligent caching.

## Features

### User Mapping
- **Direct Email Matching**: Match GitHub users by email address
- **Fuzzy Name Matching**: Find Entra ID users using Levenshtein distance algorithm with confidence scores
- **Manual Overrides**: Support manual mapping configurations for special cases
- **Caching**: Redis-backed caching with configurable TTL (default: 7 days for mappings)
- **Periodic Sync**: Weekly validation job to refresh stale mappings
- **Fallback Mechanisms**: Repository-level and system-wide fallback recipients

### Teams User Retrieval (Story 2.5)
- **Batch Operations**: Retrieve up to 20 users per request using `POST /$batch`
- **User Presence**: Get availability and activity status via `GET /users/{id}/presence`
- **Smart Caching**: 1-hour TTL for Teams user objects
- **Retry Logic**: Automatic retry with exponential backoff (up to 3 attempts)
- **Guest Detection**: Identify external collaborators and guest users
- **Notification Urgency**: Adjust notification priority based on user presence
- **Telemetry**: Comprehensive Application Insights integration

## Installation

The identity module is already included in the project. No additional installation is required.

## Configuration

### Environment Variables

Add these environment variables to your `.env` file:

```bash
# Microsoft Graph API Configuration
ENTRA_CLIENT_ID=your-entra-app-client-id
ENTRA_CLIENT_SECRET=your-entra-app-client-secret
ENTRA_TENANT_ID=your-entra-tenant-id

# Redis Configuration (optional, falls back to in-memory storage)
REDIS_URL=redis://username:password@your-redis-host:6379
# OR
REDIS_HOST=your-redis-host.redis.cache.windows.net
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-access-key
REDIS_TLS=true
```

### Entra ID Application Setup

1. **Create Entra ID App Registration**
   - Go to Azure Portal → Microsoft Entra ID → App registrations
   - Click "New registration"
   - Name: "ChatOps Teams - User Mapping"
   - Supported account types: Single tenant
   - Click "Register"

2. **Add API Permissions**
   - Go to "API permissions"
   - Click "Add a permission" → Microsoft Graph → Application permissions
   - Add these permissions:
     - `User.Read.All` - Read all users' full profiles
     - `Presence.Read.All` - Read presence information for all users (for Story 2.5)
   - Click "Grant admin consent"

3. **Create Client Secret**
   - Go to "Certificates & secrets"
   - Click "New client secret"
   - Add description: "ChatOps User Mapping"
   - Set expiration (recommended: 12-24 months)
   - Copy the secret value (you won't be able to see it again)

4. **Note Configuration Values**
   - Application (client) ID → `ENTRA_CLIENT_ID`
   - Directory (tenant) ID → `ENTRA_TENANT_ID`
   - Client secret value → `ENTRA_CLIENT_SECRET`

## Usage

### Basic Usage

```javascript
const { UserMapper } = require('./identity');

// Initialize the mapper
const userMapper = new UserMapper({
  redis: {
    url: process.env.REDIS_URL,
  },
});

// Map a GitHub user to Entra ID
const mapping = await userMapper.mapUser('githubusername', 'user@example.com');

if (mapping) {
  console.log('Entra ID User:', mapping.entraUserId);
  console.log('Display Name:', mapping.displayName);
  console.log('Email:', mapping.email);
  console.log('Confidence:', mapping.confidence);
  console.log('Source:', mapping.source); // 'email', 'fuzzy', or 'manual'
} else {
  console.log('No mapping found');
}
```

### With Manual Overrides

```javascript
const userMapper = new UserMapper({
  manualMappings: {
    'github-bot': {
      entraId: 'entra-id-for-bot-owner',
    },
    'special-user': {
      entraId: 'custom-entra-id',
    },
  },
});
```

### With Fallback Recipients

```javascript
const fallbacks = await userMapper.getFallbackRecipients('owner/repo', {
  repositoryOwners: {
    'owner/repo': ['entra-id-1', 'entra-id-2'],
  },
  defaultRecipients: ['default-entra-id'],
});

console.log('Fallback recipients:', fallbacks);
```

### Periodic Sync Job

```javascript
const { UserMappingSyncJob } = require('./identity');

// Create sync job
const syncJob = new UserMappingSyncJob({
  intervalMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  runOnStart: true, // Run immediately on start
});

// Start the sync job
syncJob.start();

// Manually trigger sync
const results = await syncJob.runSync();
console.log('Sync results:', results);

// Stop the sync job
syncJob.stop();
```

### Teams User Retrieval (Story 2.5)

```javascript
const { TeamsUserService } = require('./identity');

// Initialize the service
const teamsService = new TeamsUserService({
  clientId: process.env.ENTRA_CLIENT_ID,
  clientSecret: process.env.ENTRA_CLIENT_SECRET,
  tenantId: process.env.ENTRA_TENANT_ID,
  redis: {
    url: process.env.REDIS_URL,
  },
});

// Get a single user with presence
const user = await teamsService.getUser('entra-user-id', {
  includePresence: true,
  useCache: true,
});

console.log('User:', user.displayName);
console.log('Presence:', user.presence?.availability);

// Determine notification urgency
const urgency = teamsService.determineNotificationUrgency(user.presence);
console.log('Urgency:', urgency); // 'high', 'normal', or 'low'

// Check if guest user
const isGuest = teamsService.isGuestUser(user);
console.log('Is Guest:', isGuest);

// Get multiple users (automatically batches in groups of 20)
const users = await teamsService.getUsers([
  'entra-id-1',
  'entra-id-2',
  'entra-id-3',
  // ... up to hundreds of users
], {
  includePresence: true,
  useCache: true,
});

console.log(`Retrieved ${users.length} users`);

// Get users with retry logic for resilience
const usersWithRetry = await teamsService.getUsersWithRetry(userIds, {
  includePresence: true,
  throwOnError: false, // Return partial results on failure
});
```

### Complete Workflow: GitHub to Teams Notifications

```javascript
const { UserMapper, TeamsUserService } = require('./identity');

// Step 1: Map GitHub users to Entra ID
const userMapper = new UserMapper();
const githubUsers = [
  { username: 'alice', email: 'alice@example.com' },
  { username: 'bob', email: 'bob@example.com' },
];

const mappings = [];
for (const githubUser of githubUsers) {
  const mapping = await userMapper.mapUser(githubUser.username, githubUser.email);
  if (mapping) {
    mappings.push(mapping);
  }
}

// Step 2: Retrieve Teams user objects with presence
const teamsService = new TeamsUserService();
const entraIds = mappings.map(m => m.entraUserId);
const teamsUsers = await teamsService.getUsersWithRetry(entraIds, {
  includePresence: true,
});

// Step 3: Determine notification strategy based on presence
const highPriority = teamsUsers.filter(u => 
  teamsService.determineNotificationUrgency(u.presence) === 'high'
);

const lowPriority = teamsUsers.filter(u => 
  teamsService.determineNotificationUrgency(u.presence) === 'low'
);

console.log(`Send immediately: ${highPriority.length} users`);
console.log(`Can be delayed: ${lowPriority.length} users`);
```

## Architecture

### Components

1. **GraphClient**: Microsoft Graph API client for querying Entra ID users
   - OAuth2 token management with automatic refresh
   - User lookup by email, ID, and display name
   - Fuzzy matching with Levenshtein distance algorithm
   - Batch operations for up to 20 users per request
   - User presence retrieval

2. **UserMapper**: Core mapping logic
   - Multi-strategy user matching (manual → cache → email → fuzzy)
   - Redis/in-memory storage for caching
   - Configurable confidence thresholds
   - Fallback recipient management

3. **UserMappingSyncJob**: Periodic validation scheduler
   - Weekly validation of cached mappings
   - Automatic refresh of stale entries
   - Removal of invalid mappings
   - Telemetry tracking

4. **TeamsUserService**: Teams user retrieval with batch optimization (Story 2.5)
   - Batch user retrieval (max 20 per request)
   - User presence information
   - Smart caching (1-hour TTL)
   - Retry logic with exponential backoff
   - Guest user detection
   - Notification urgency determination

### Matching Strategy

The UserMapper follows this priority order:

1. **Manual Overrides**: Check configured manual mappings first
2. **Cache Lookup**: Check cached mappings (TTL: 7 days)
3. **Email Match**: Query Entra ID by email address (exact match)
4. **Fuzzy Match**: Search by display name with similarity scoring
5. **Fallback**: Return null if no match found (use fallback recipients)

### Confidence Scores

Fuzzy matching uses Levenshtein distance to calculate similarity:
- **1.0**: Exact match
- **0.7-0.99**: High confidence (default threshold: 0.7)
- **0.5-0.69**: Medium confidence (below default threshold)
- **< 0.5**: Low confidence (rejected)

## Database Schema

User mappings are stored in Redis with this structure:

```
Key: user_mapping:<github_username>
Value: JSON string
TTL: 604800 seconds (7 days)

Example:
{
  "githubUsername": "johndoe",
  "entraUserId": "entra-id-123",
  "displayName": "John Doe",
  "email": "john.doe@example.com",
  "source": "email",
  "lastVerified": "2025-12-30T01:00:00.000Z",
  "confidence": 1.0
}
```

Teams user objects are cached separately:

```
Key: teams:user:<entra_user_id>
Value: JSON string
TTL: 3600 seconds (1 hour)

Example:
{
  "id": "entra-id-123",
  "displayName": "John Doe",
  "mail": "john.doe@example.com",
  "userPrincipalName": "john.doe@example.com",
  "userType": "Member",
  "jobTitle": "Software Engineer",
  "officeLocation": "Building 1",
  "presence": {
    "availability": "Available",
    "activity": "Available"
  }
}
```

## Telemetry

The module tracks these metrics in Application Insights:

### Metrics
- `GraphClient.GetAccessToken.Duration`
- `GraphClient.FindUserByEmail.Duration`
- `GraphClient.FindUsersByDisplayName.Duration`
- `GraphClient.GetUserById.Duration`
- `GraphClient.BatchGetUsers.Duration` *(Story 2.5)*
- `GraphClient.GetUserPresence.Duration` *(Story 2.5)*
- `GraphClient.BatchGetPresence.Duration` *(Story 2.5)*
- `UserMapper.MapUser.Duration`
- `UserMapper.ValidateMappings.Duration`
- `UserMappingSyncJob.Duration`
- `TeamsUserService.GetUser.Duration` *(Story 2.5)*
- `TeamsUserService.GetUsers.Duration` *(Story 2.5)*

### Events
- `GraphClient.GetAccessToken.Success`
- `GraphClient.FindUserByEmail`
- `GraphClient.FindUsersByDisplayName`
- `GraphClient.BatchGetUsers` *(Story 2.5)*
- `GraphClient.GetUserPresence` *(Story 2.5)*
- `GraphClient.GetUserPresence.NotAvailable` *(Story 2.5)*
- `GraphClient.BatchGetPresence` *(Story 2.5)*
- `UserMapper.MapUser.Success`
- `UserMapper.MapUser.CacheHit`
- `UserMapper.MapUser.NoMatch`
- `UserMapper.FallbackRecipients.Used`
- `UserMapper.ValidateMappings.Completed`
- `UserMappingSyncJob.Started`
- `UserMappingSyncJob.Completed`
- `UserMappingSyncJob.Stopped`
- `TeamsUserService.GetUser.Success` *(Story 2.5)*
- `TeamsUserService.GetUser.CacheHit` *(Story 2.5)*
- `TeamsUserService.GetUser.NotFound` *(Story 2.5)*
- `TeamsUserService.GetUsers.Success` *(Story 2.5)*
- `TeamsUserService.GetUsersWithRetry.SuccessAfterRetry` *(Story 2.5)*
- `TeamsUserService.GetUsersWithRetry.Attempt` *(Story 2.5)*

## Testing

Run the comprehensive test suites:

```bash
cd src

# Test user mapping
node identity/userMapper.test.js

# Test Teams user service (Story 2.5)
node identity/teamsUserService.test.js
```

### Test Coverage

**UserMapper Tests:**
- OAuth2 token acquisition
- User lookup by email
- Fuzzy matching with confidence scores
- Manual mapping overrides
- Cache hit/miss scenarios
- Fallback recipient resolution
- No match handling

**TeamsUserService Tests (Story 2.5):**
- ✓ Get single user with presence
- ✓ Get single user from cache
- ✓ Get multiple users in batch
- ✓ Batch optimization with cache hits
- ✓ Split users into batches when exceeding max batch size
- ✓ Determine notification urgency based on presence
- ✓ Identify guest users
- ✓ Handle user not found
- ✓ Retry logic on failure with exponential backoff
- ✓ Clear user cache
- ✓ Handle partial batch failures gracefully
- ✓ Cache respects TTL expiration
- ✓ GraphClient enforces batch size limit of 20

All 13 tests passing ✓

## Security Considerations

1. **Credential Storage**: Never commit `ENTRA_CLIENT_SECRET` to Git. Use Azure Key Vault in production.
2. **API Permissions**: Use least privilege. Required permissions:
   - `User.Read.All` - Read user profiles (required)
   - `Presence.Read.All` - Read presence information (required for Story 2.5)
3. **Token Caching**: Access tokens are cached with 5-minute buffer before expiration.
4. **TLS**: Always use TLS for Redis connections in production (`REDIS_TLS=true`).

## Troubleshooting

### Common Issues

**Issue**: "Failed to get access token: 401"
- **Solution**: Verify `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, and `ENTRA_TENANT_ID` are correct.
- Check that admin consent was granted for API permissions.

**Issue**: "User not found by email"
- **Solution**: Verify the email domain matches your Entra ID tenant.
- Check that the user exists in Entra ID.
- Try using the user's UPN (userPrincipalName) instead.

**Issue**: "Redis connection error"
- **Solution**: Falls back to in-memory storage automatically.
- Check Redis connection string and credentials.
- Verify network connectivity to Redis host.

**Issue**: Low confidence scores in fuzzy matching
- **Solution**: Adjust `fuzzyMatchThreshold` (default: 0.7).
- Consider using manual mapping overrides for problematic users.
- Ensure GitHub usernames align with Entra ID display names.

**Issue**: "Batch request cannot exceed 20 users" *(Story 2.5)*
- **Solution**: This is expected behavior. TeamsUserService automatically splits large requests into batches of 20.
- If calling GraphClient directly, manually split into batches using the service's helper methods.

**Issue**: "User presence not available" *(Story 2.5)*
- **Solution**: Presence may not be available for:
  - Guest users
  - External collaborators
  - Users with presence privacy settings enabled
- The service handles this gracefully and returns `null` for presence.
- Verify `Presence.Read.All` permission is granted.

**Issue**: Slow batch operations *(Story 2.5)*
- **Solution**: 
  - Ensure Redis is configured for optimal caching (1-hour TTL)
  - Check cache hit ratio in telemetry (target > 80%)
  - Consider pre-warming cache for frequently accessed users
  - Verify network latency to Microsoft Graph API

## Performance

### User Mapping
- **Cache Hit Ratio**: Target > 80% (tracked in telemetry)
- **Graph API Latency**: ~100-500ms per query
- **Cached Lookup**: < 10ms
- **Weekly Sync**: ~1-5 minutes for 1000 users

### Teams User Service (Story 2.5)
- **Single User Retrieval**: < 50ms (cached), ~200-500ms (uncached)
- **Batch Operations**: ~500-1000ms for 20 users (uncached)
- **Cache Hit Ratio**: Target > 80%
- **Retry Latency**: 1s, 2s, 4s (exponential backoff)
- **Maximum Batch Size**: 20 users per request (Microsoft Graph limit)

## Roadmap

Future enhancements:
- [ ] Support for GitHub SAML attribute mapping
- [ ] Bulk import from CSV/JSON files
- [ ] Admin UI for manual mapping management
- [ ] Machine learning-based matching improvements
- [ ] Support for organizational unit filtering

## License

This module is part of the ChatOps Teams Integration project. See the main project license for details.
