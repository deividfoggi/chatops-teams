# GitHub API Client

A comprehensive GitHub API client library for the ChatOps Teams integration. Provides authenticated access to GitHub REST API v3 with rate limiting, caching, and exponential backoff.

## Features

- ✅ **OAuth 2.0 Authentication**: Support for GitHub Apps with JWT token generation
- ✅ **Personal Access Token**: Alternative authentication method
- ✅ **Rate Limiting**: Automatic detection and throttling with exponential backoff
- ✅ **Request Queuing**: Queue requests when rate limits are approached
- ✅ **Caching**: 5-minute TTL cache for frequently accessed data
- ✅ **Pagination**: Support for large result sets
- ✅ **Telemetry**: Integration with Application Insights
- ✅ **Repository Queries**: Get repository metadata and owners
- ✅ **Commit Information**: Retrieve commit author details
- ✅ **Security Champions**: Parse security champion metadata from CODEOWNERS

## Installation

The GitHub client is included in the main application. No additional installation is required.

## Configuration

### Environment Variables

Configure authentication using environment variables:

#### Option 1: Personal Access Token (Simple)

```bash
GITHUB_TOKEN=ghp_your_personal_access_token
```

#### Option 2: GitHub App (Recommended for Production)

```bash
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBA...your-key...\n-----END PRIVATE KEY-----"
GITHUB_INSTALLATION_ID=98765
```

### Creating a GitHub App

1. Go to GitHub Settings → Developer Settings → GitHub Apps
2. Click "New GitHub App"
3. Configure permissions:
   - Repository permissions:
     - Contents: Read
     - Metadata: Read
     - Commit statuses: Read
4. Generate a private key and save it securely
5. Install the app on your target repositories
6. Note the App ID and Installation ID

## Usage

### Basic Usage

```javascript
const { GitHubClient } = require('./github');

// Initialize with token
const client = new GitHubClient({
  token: process.env.GITHUB_TOKEN
});

// Or initialize with GitHub App
const client = new GitHubClient({
  appId: process.env.GITHUB_APP_ID,
  privateKey: process.env.GITHUB_PRIVATE_KEY,
  installationId: process.env.GITHUB_INSTALLATION_ID
});
```

### Get Repository Information

```javascript
// Get repository with owner information
const repo = await client.getRepository('owner', 'repo-name');

console.log(repo.owner.login); // Repository owner
console.log(repo.fullName);    // owner/repo-name
console.log(repo.private);     // true/false
```

### Get Commit Information

```javascript
// Get commit with author details
const commit = await client.getCommit('owner', 'repo-name', 'commit-sha');

console.log(commit.author.login);       // GitHub username
console.log(commit.commit.author.name); // Git author name
console.log(commit.commit.author.email); // Git author email
```

### Get Security Champion Information

```javascript
// Parse security champion from CODEOWNERS file
const champion = await client.getSecurityChampion('owner', 'repo-name');

if (champion.found) {
  console.log(champion.source);    // 'CODEOWNERS' or 'repository-topics'
  console.log(champion.champions); // Array of GitHub usernames
}
```

### Pagination Support

```javascript
// Get a single page
const issues = await client.getPaginated('/repos/owner/repo/issues', {
  perPage: 30,
  page: 1
});

// Get all pages (up to maxPages)
const allIssues = await client.getAllPaginated('/repos/owner/repo/issues', {
  perPage: 100,
  maxPages: 10
});
```

### Rate Limit Management

```javascript
// Check current rate limit status
const rateLimit = await client.getRateLimit();

console.log(rateLimit.remaining); // Remaining requests
console.log(rateLimit.reset);     // Reset timestamp
```

### Custom API Requests

```javascript
// Make any API request
const data = await client.request('GET', '/repos/owner/repo/pulls');

// Disable caching for specific requests
const freshData = await client.request('GET', '/repos/owner/repo', null, false);
```

### With Telemetry

```javascript
const { getTelemetryClient } = require('./telemetry');

const telemetryClient = getTelemetryClient().initialize();

const client = new GitHubClient({
  token: process.env.GITHUB_TOKEN,
  telemetryClient: telemetryClient
});

// All API calls will be tracked in Application Insights
const repo = await client.getRepository('owner', 'repo');
```

## Rate Limiting

The client automatically handles GitHub API rate limits:

1. **Detection**: Monitors `X-RateLimit-Remaining` and `Retry-After` headers
2. **Throttling**: Automatically throttles requests when remaining < 10
3. **Queueing**: Queues requests when throttled
4. **Exponential Backoff**: Waits progressively longer (1s, 2s, 4s, 8s, 16s)
5. **Auto-Retry**: Retries up to 5 times on rate limit errors

## Caching

The client caches GET requests for 5 minutes by default:

```javascript
// Cached for 5 minutes
const repo1 = await client.getRepository('owner', 'repo');
const repo2 = await client.getRepository('owner', 'repo'); // Returns cached

// Clear cache manually
client.clearCache();

// Bypass cache for specific request
const freshRepo = await client.request('GET', '/repos/owner/repo', null, false);
```

## Authentication

### JWT Token Generation

The client automatically generates JWT tokens for GitHub App authentication:

```javascript
const jwt = client.generateJWT();
// Returns signed JWT valid for 10 minutes
```

### Installation Access Tokens

Installation tokens are automatically obtained and cached:

```javascript
const token = await client.getInstallationToken();
// Cached for 55 minutes (5 min before actual expiry)
```

## Error Handling

```javascript
try {
  const repo = await client.getRepository('owner', 'repo');
} catch (error) {
  if (error.message.includes('Rate limit exceeded')) {
    // Handle rate limit error
    console.error('Too many requests, try again later');
  } else if (error.message.includes('authentication')) {
    // Handle auth error
    console.error('Invalid credentials');
  } else {
    // Handle other errors
    console.error('API error:', error.message);
  }
}
```

## Testing

Run the test suite:

```bash
node github/githubClient.test.js
```

Tests cover:
- Cache functionality with TTL
- Rate limiter throttling and exponential backoff
- Client initialization
- JWT token generation
- Authentication headers
- Request queueing

## API Reference

### GitHubClient

#### Constructor

```javascript
new GitHubClient(config)
```

**Parameters:**
- `config.token` - Personal access token
- `config.appId` - GitHub App ID
- `config.privateKey` - GitHub App private key (PEM format)
- `config.installationId` - GitHub App installation ID
- `config.apiUrl` - GitHub API base URL (default: 'https://api.github.com')
- `config.telemetryClient` - Application Insights client

#### Methods

##### `getRepository(owner, repo)`
Gets repository information including owners.

##### `getCommit(owner, repo, sha)`
Gets commit information including author details.

##### `getSecurityChampion(owner, repo)`
Gets security champion metadata from CODEOWNERS or repository topics.

##### `getPaginated(path, options)`
Gets a single page of results.

##### `getAllPaginated(path, options)`
Gets all pages of results (up to maxPages).

##### `getRateLimit()`
Gets current rate limit status.

##### `request(method, path, body, useCache)`
Makes a custom API request.

##### `clearCache()`
Clears the request cache.

##### `generateJWT()`
Generates a JWT token for GitHub App authentication.

##### `getInstallationToken()`
Gets an installation access token.

### Cache

Simple in-memory cache with TTL.

```javascript
const cache = new Cache(ttlMs);
cache.set(key, value);
const value = cache.get(key);
cache.clear();
```

### RateLimiter

Rate limiter with exponential backoff and request queueing.

```javascript
const limiter = new RateLimiter();
limiter.updateFromHeaders(headers);
const shouldWait = limiter.shouldThrottle();
const waitMs = limiter.getWaitTime(attempt);
const result = await limiter.queueRequest(requestFn);
```

## Security Best Practices

1. **Store credentials in Azure Key Vault**, not in environment variables in production
2. **Use GitHub Apps** instead of personal access tokens for production
3. **Rotate credentials** regularly (90-day cycle recommended)
4. **Use least privilege** - only request necessary permissions
5. **Monitor API usage** through Application Insights telemetry
6. **Never commit credentials** to source control

## Troubleshooting

### "GitHub authentication not configured"

Ensure you've set either `GITHUB_TOKEN` or all three of `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, and `GITHUB_INSTALLATION_ID`.

### "Rate limit exceeded"

The client automatically handles rate limits, but if you see this error:
1. Check your Application Insights for API usage patterns
2. Consider increasing cache TTL
3. Batch requests where possible
4. Use webhooks instead of polling

### "Invalid signature"

For GitHub Apps:
1. Verify the private key format (should be PEM with newlines)
2. Check that the App ID matches your GitHub App
3. Ensure the installation ID is correct

## Contributing

When adding new API methods:
1. Add the method to `githubClient.js`
2. Add corresponding tests to `githubClient.test.js`
3. Update this README with usage examples
4. Follow existing patterns for error handling and telemetry

## License

Part of the ChatOps Teams Integration project.
