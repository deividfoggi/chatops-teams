# Identity Module

Maps GitHub usernames to Microsoft Entra ID (Azure AD) identities to enable targeted notifications in Microsoft Teams.

## Features

- **Direct Email Matching**: Match GitHub users by email address
- **Fuzzy Name Matching**: Find Entra ID users using Levenshtein distance algorithm with confidence scores
- **Manual Overrides**: Support manual mapping configurations for special cases
- **Caching**: Redis-backed caching with configurable TTL (default: 7 days)
- **Periodic Sync**: Weekly validation job to refresh stale mappings
- **Fallback Mechanisms**: Repository-level and system-wide fallback recipients
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

## Architecture

### Components

1. **GraphClient**: Microsoft Graph API client for querying Entra ID users
   - OAuth2 token management with automatic refresh
   - User lookup by email, ID, and display name
   - Fuzzy matching with Levenshtein distance algorithm

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

## Telemetry

The module tracks these metrics in Application Insights:

### Metrics
- `GraphClient.GetAccessToken.Duration`
- `GraphClient.FindUserByEmail.Duration`
- `GraphClient.FindUsersByDisplayName.Duration`
- `GraphClient.GetUserById.Duration`
- `UserMapper.MapUser.Duration`
- `UserMapper.ValidateMappings.Duration`
- `UserMappingSyncJob.Duration`

### Events
- `GraphClient.GetAccessToken.Success`
- `GraphClient.FindUserByEmail`
- `GraphClient.FindUsersByDisplayName`
- `UserMapper.MapUser.Success`
- `UserMapper.MapUser.CacheHit`
- `UserMapper.MapUser.NoMatch`
- `UserMapper.FallbackRecipients.Used`
- `UserMapper.ValidateMappings.Completed`
- `UserMappingSyncJob.Started`
- `UserMappingSyncJob.Completed`
- `UserMappingSyncJob.Stopped`

## Testing

Run the comprehensive test suite:

```bash
cd src
node identity/userMapper.test.js
```

Tests cover:
- OAuth2 token acquisition
- User lookup by email
- Fuzzy matching with confidence scores
- Manual mapping overrides
- Cache hit/miss scenarios
- Fallback recipient resolution
- No match handling

## Security Considerations

1. **Credential Storage**: Never commit `ENTRA_CLIENT_SECRET` to Git. Use Azure Key Vault in production.
2. **API Permissions**: Use least privilege. `User.Read.All` is required but limit to application permissions only.
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

## Performance

- **Cache Hit Ratio**: Target > 80% (tracked in telemetry)
- **Graph API Latency**: ~100-500ms per query
- **Cached Lookup**: < 10ms
- **Weekly Sync**: ~1-5 minutes for 1000 users

## Roadmap

Future enhancements:
- [ ] Support for GitHub SAML attribute mapping
- [ ] Bulk import from CSV/JSON files
- [ ] Admin UI for manual mapping management
- [ ] Machine learning-based matching improvements
- [ ] Support for organizational unit filtering

## License

This module is part of the ChatOps Teams Integration project. See the main project license for details.
