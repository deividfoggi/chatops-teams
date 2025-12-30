# Repository Metadata Cache

Distributed caching layer for GitHub repository metadata using Redis or Azure Cache for Redis. Provides LRU eviction, cache warming, metrics tracking, and automatic fallback to in-memory caching when Redis is unavailable.

## Features

- **Distributed Caching**: Uses Redis or Azure Cache for Redis for shared cache across multiple instances
- **LRU Eviction**: Configurable LRU (Least Recently Used) eviction policy when cache is full
- **Cache Metrics**: Tracks hit/miss ratio, sets, and errors
- **Cache Bypass**: Support for `x-cache-bypass` header for troubleshooting
- **Cache Warming**: Preload frequently accessed repositories on startup
- **Automatic Fallback**: Falls back to in-memory cache if Redis is unavailable
- **Configurable TTLs**: Different TTLs for repository metadata (5 min) and user lists (1 hour)
- **Performance**: < 50ms response time for cache hits

## Installation

The cache module is already included in the application. To enable Redis:

```bash
npm install ioredis
```

## Configuration

Configure Redis connection via environment variables:

```bash
# Option 1: Using Redis URL (recommended)
REDIS_URL=redis://username:password@your-redis-host:6379

# Option 2: Using separate configuration
REDIS_HOST=your-redis-host.redis.cache.windows.net
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-access-key
REDIS_TLS=true
```

### Azure Cache for Redis

For Azure Cache for Redis:

```bash
REDIS_HOST=your-cache-name.redis.cache.windows.net
REDIS_PORT=6380
REDIS_PASSWORD=your-access-key
REDIS_TLS=true
```

## Usage

### Basic Usage

```javascript
const { RepositoryMetadataCache } = require('./cache');

// Create cache instance
const cache = new RepositoryMetadataCache({
  repositoryTtl: 300,  // 5 minutes
  userListTtl: 3600,   // 1 hour
  telemetryClient: telemetryClient,
});

// Set a value
await cache.set('my-key', { data: 'value' });

// Get a value
const value = await cache.get('my-key');

// Delete a value
await cache.delete('my-key');

// Clear pattern
await cache.clearPattern('repo:*');
```

### With GitHub Client

The `GitHubClient` automatically uses the distributed cache:

```javascript
const { GitHubClient } = require('./github/githubClient');

const client = new GitHubClient({
  token: 'your-github-token',
  telemetryClient: telemetryClient,
  // Cache is automatically configured
});

// API calls are automatically cached
const repo = await client.getRepository('owner', 'repo');
```

### Cache Bypass

Add the `x-cache-bypass` header to bypass cache for troubleshooting:

```javascript
// In HTTP request
const value = await cache.get('my-key', {
  'x-cache-bypass': 'true'
});

// Or via HTTP header
curl -H "X-Cache-Bypass: true" https://api.example.com/repos/owner/repo
```

### Cache Warming

Warm the cache on application startup:

```javascript
const repositories = [
  { owner: 'org1', repo: 'repo1' },
  { owner: 'org1', repo: 'repo2' },
  { owner: 'org2', repo: 'repo3' },
];

// Using GitHub client
await client.warmRepositoryCache(repositories);

// Or directly with cache
const repositoryData = repositories.map(r => ({
  owner: r.owner,
  repo: r.repo,
  data: { /* repository metadata */ },
}));
await cache.warmCache(repositoryData);
```

### Cache Metrics

Track cache performance:

```javascript
// Get metrics
const metrics = cache.getMetrics();
console.log(`Hit ratio: ${(metrics.hitRatio * 100).toFixed(2)}%`);
console.log(`Hits: ${metrics.hits}, Misses: ${metrics.misses}`);
console.log(`Using Redis: ${metrics.isRedisConnected}`);

// With GitHub client
const metrics = client.getCacheMetrics();
```

### Key Generation

Use helper methods to generate consistent cache keys:

```javascript
// Repository metadata
const key = cache.getRepositoryKey('owner', 'repo');
// Returns: 'repo:metadata:owner/repo'

// User lists
const key = cache.getUserListKey('team1');
// Returns: 'users:list:team1'

// Security champion
const key = cache.getSecurityChampionKey('owner', 'repo');
// Returns: 'repo:security-champion:owner/repo'
```

## Architecture

### Cache Layers

1. **Redis (Primary)**: Distributed cache shared across instances
2. **In-Memory (Fallback)**: Local cache when Redis is unavailable
3. **Simple Cache**: Backward compatibility cache in GitHubClient

### TTL Configuration

| Data Type | TTL | Use Case |
|-----------|-----|----------|
| Repository Metadata | 5 minutes | Frequently changing data |
| User Lists | 1 hour | Rarely changing data |
| Custom | Configurable | Specific use cases |

### LRU Eviction

The cache uses `allkeys-lru` policy by default, which evicts the least recently used keys when the cache is full. This is automatically configured when connecting to Redis.

## Testing

Run the cache tests:

```bash
cd src
node cache/repositoryMetadataCache.test.js
```

Test coverage includes:
- ✓ Cache metrics tracking and hit/miss ratio calculation
- ✓ In-memory fallback cache functionality
- ✓ TTL expiration for both default and custom TTLs
- ✓ Cache initialization with fallback when Redis unavailable
- ✓ Key generation for repositories, users, and security champions
- ✓ Cache bypass header support (x-cache-bypass)
- ✓ Get/set/delete operations with metrics tracking
- ✓ Pattern-based cache clearing
- ✓ Cache warming with multiple repositories
- ✓ Different TTLs for repository metadata vs user lists
- ✓ Metrics reset functionality
- ✓ Performance meets < 50ms requirement

## Performance

### Acceptance Criteria

| Criteria | Target | Status |
|----------|--------|--------|
| Cache hit response time | < 50ms | ✅ Achieved |
| Stale data refresh | Automatic via TTL | ✅ Implemented |
| Cache invalidation | Within 5 minutes | ✅ Via TTL |
| Eviction policy | LRU | ✅ Configured |
| Hit/miss ratio | > 80% | ✅ Tracked |

### Monitoring

Cache metrics are automatically tracked in Application Insights:

- `CacheHitRatio`: Percentage of cache hits
- `CacheHits`: Number of cache hits
- `CacheMisses`: Number of cache misses
- `CacheGetDuration`: Time to retrieve from cache
- `CacheSetDuration`: Time to store in cache

## Troubleshooting

### Redis Connection Issues

If Redis is unavailable, the cache automatically falls back to in-memory caching:

```
Redis not configured, using in-memory cache fallback
Enabling in-memory cache fallback
```

### Cache Bypass for Debugging

Use the `x-cache-bypass` header to force fresh data:

```bash
# Test endpoint with cache bypass
curl -H "X-Cache-Bypass: true" https://api.example.com/repos/owner/repo
```

### Verify Cache Metrics

Check cache performance:

```javascript
const metrics = cache.getMetrics();
if (metrics.hitRatio < 0.8) {
  console.warn('Cache hit ratio below 80%:', metrics.hitRatio);
}
```

### Clear Cache

Clear specific patterns or all cache entries:

```javascript
// Clear all repository metadata
await cache.clearPattern('repo:metadata:*');

// Clear all user lists
await cache.clearPattern('users:*');

// Clear everything
await cache.clearPattern('*');
```

## Best Practices

1. **Use Cache Warming**: Preload frequently accessed repositories on startup
2. **Monitor Hit Ratio**: Aim for > 80% hit ratio
3. **Configure TTLs**: Balance freshness vs performance
4. **Use Redis in Production**: In-memory fallback is for development only
5. **Track Metrics**: Monitor cache performance in Application Insights
6. **Use Cache Bypass**: For troubleshooting and testing
7. **Pattern-based Clearing**: Clear related cache entries together

## Azure Cache for Redis Setup

### Provisioning

```bash
# Create Azure Cache for Redis
az redis create \
  --resource-group myResourceGroup \
  --name myCacheName \
  --location eastus \
  --sku Basic \
  --vm-size c0 \
  --enable-non-ssl-port false
```

### Configuration

```bash
# Get connection details
az redis show \
  --resource-group myResourceGroup \
  --name myCacheName

# Get access keys
az redis list-keys \
  --resource-group myResourceGroup \
  --name myCacheName
```

### Environment Variables

```bash
REDIS_HOST=myCacheName.redis.cache.windows.net
REDIS_PORT=6380
REDIS_PASSWORD=<primary-key>
REDIS_TLS=true
```

## Dependencies

- `ioredis` - Redis client for Node.js
- `applicationinsights` - Azure Application Insights SDK (optional)

## Related Documentation

- [GitHub API Client](../github/README.md)
- [Application Insights Custom Metrics](../../docs/application-insights-custom-metrics.md)
- [Azure Cache for Redis Documentation](https://docs.microsoft.com/azure/azure-cache-for-redis/)
