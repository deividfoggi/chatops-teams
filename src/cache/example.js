/**
 * Example: Using Repository Metadata Cache
 * 
 * Demonstrates how to use the distributed cache with GitHub API client
 * for caching repository metadata, security champions, and user lists.
 */

const { GitHubClient } = require('../github/githubClient');
const { RepositoryMetadataCache } = require('./index');

/**
 * Example 1: Basic cache usage
 */
async function exampleBasicCache() {
  console.log('\n=== Example 1: Basic Cache Usage ===\n');
  
  const cache = new RepositoryMetadataCache({
    repositoryTtl: 300,  // 5 minutes
    userListTtl: 3600,   // 1 hour
    enableFallback: true, // Use in-memory fallback if Redis unavailable
  });

  // Set repository data
  const repoData = {
    id: 123,
    name: 'example-repo',
    owner: 'example-org',
    description: 'Example repository',
  };
  
  const key = cache.getRepositoryKey('example-org', 'example-repo');
  await cache.set(key, repoData);
  console.log('✓ Set repository data in cache');

  // Get repository data (cache hit)
  const cachedData = await cache.get(key);
  console.log('✓ Retrieved from cache:', cachedData);

  // Get cache metrics
  const metrics = cache.getMetrics();
  console.log('✓ Cache metrics:', {
    hits: metrics.hits,
    misses: metrics.misses,
    hitRatio: (metrics.hitRatio * 100).toFixed(2) + '%',
    usingRedis: metrics.isRedisConnected,
  });

  await cache.close();
}

/**
 * Example 2: GitHub Client with distributed cache
 */
async function exampleGitHubClientWithCache() {
  console.log('\n=== Example 2: GitHub Client with Distributed Cache ===\n');
  
  // Note: Requires GITHUB_TOKEN environment variable
  if (!process.env.GITHUB_TOKEN) {
    console.log('⚠️  GITHUB_TOKEN not set, skipping GitHub API example');
    return;
  }

  const client = new GitHubClient({
    token: process.env.GITHUB_TOKEN,
    useDistributedCache: true,
  });

  try {
    // First call - cache miss, fetches from GitHub API
    console.log('First call (cache miss)...');
    const repo1 = await client.getRepository('microsoft', 'vscode');
    console.log('✓ Fetched repository:', repo1.fullName);

    // Second call - cache hit, returns from cache
    console.log('Second call (cache hit)...');
    const repo2 = await client.getRepository('microsoft', 'vscode');
    console.log('✓ Retrieved from cache:', repo2.fullName);

    // Get cache metrics
    const metrics = client.getCacheMetrics();
    console.log('✓ Cache performance:', {
      hitRatio: (metrics.hitRatio * 100).toFixed(2) + '%',
      hits: metrics.hits,
      misses: metrics.misses,
    });
  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * Example 3: Cache warming on startup
 */
async function exampleCacheWarming() {
  console.log('\n=== Example 3: Cache Warming ===\n');
  
  if (!process.env.GITHUB_TOKEN) {
    console.log('⚠️  GITHUB_TOKEN not set, skipping cache warming example');
    return;
  }

  const client = new GitHubClient({
    token: process.env.GITHUB_TOKEN,
    useDistributedCache: true,
  });

  // Define active repositories to warm
  const activeRepositories = [
    { owner: 'microsoft', repo: 'vscode' },
    { owner: 'microsoft', repo: 'TypeScript' },
    { owner: 'facebook', repo: 'react' },
  ];

  try {
    console.log('Warming cache with active repositories...');
    const cached = await client.warmRepositoryCache(activeRepositories);
    console.log(`✓ Cached ${cached}/${activeRepositories.length} repositories`);

    // Verify cache hit for warmed repositories
    const repo = await client.getRepository('microsoft', 'vscode');
    console.log('✓ Retrieved from warmed cache:', repo.fullName);

    const metrics = client.getCacheMetrics();
    console.log('✓ Cache hit ratio:', (metrics.hitRatio * 100).toFixed(2) + '%');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * Example 4: Cache bypass for troubleshooting
 */
async function exampleCacheBypass() {
  console.log('\n=== Example 4: Cache Bypass ===\n');
  
  const cache = new RepositoryMetadataCache({
    enableFallback: true,
  });

  // Set some data
  await cache.set('test-key', { data: 'cached-value' });
  console.log('✓ Data stored in cache');

  // Normal get (cache hit)
  const value1 = await cache.get('test-key');
  console.log('✓ Normal get (cache hit):', value1);

  // Get with bypass header (cache miss)
  const value2 = await cache.get('test-key', { 'x-cache-bypass': 'true' });
  console.log('✓ Get with bypass header (cache miss):', value2);

  const metrics = cache.getMetrics();
  console.log('✓ Metrics show 1 hit, 1 miss:', {
    hits: metrics.hits,
    misses: metrics.misses,
  });

  await cache.close();
}

/**
 * Example 5: Different TTLs for different data types
 */
async function exampleDifferentTTLs() {
  console.log('\n=== Example 5: Different TTLs ===\n');
  
  const cache = new RepositoryMetadataCache({
    repositoryTtl: 300,   // 5 minutes for repos
    userListTtl: 3600,    // 1 hour for users
    enableFallback: true,
  });

  // Store repository metadata (5 min TTL)
  const repoKey = cache.getRepositoryKey('org', 'repo');
  await cache.set(repoKey, { name: 'repo' });
  console.log('✓ Stored repository metadata (5 min TTL)');

  // Store user list (1 hour TTL)
  const userKey = cache.getUserListKey('team1');
  await cache.set(userKey, { users: ['user1', 'user2'] });
  console.log('✓ Stored user list (1 hour TTL)');

  // Custom TTL (30 seconds)
  await cache.set('custom-key', { data: 'custom' }, 30);
  console.log('✓ Stored with custom TTL (30 seconds)');

  console.log('\nCache entries created with appropriate TTLs based on data type');

  await cache.close();
}

/**
 * Example 6: Pattern-based cache clearing
 */
async function examplePatternClearing() {
  console.log('\n=== Example 6: Pattern-based Cache Clearing ===\n');
  
  const cache = new RepositoryMetadataCache({
    enableFallback: true,
  });

  // Store multiple repository entries
  await cache.set('repo:metadata:org1/repo1', { name: 'repo1' });
  await cache.set('repo:metadata:org1/repo2', { name: 'repo2' });
  await cache.set('repo:metadata:org2/repo3', { name: 'repo3' });
  await cache.set('users:list:team1', { users: [] });
  console.log('✓ Stored 4 cache entries');

  // Clear only org1 repositories
  const cleared = await cache.clearPattern('repo:metadata:org1/*');
  console.log(`✓ Cleared ${cleared} org1 repository entries`);

  // Verify cleared
  const repo1 = await cache.get('repo:metadata:org1/repo1');
  const repo3 = await cache.get('repo:metadata:org2/repo3');
  console.log('✓ org1/repo1 cleared:', repo1 === null);
  console.log('✓ org2/repo3 still exists:', repo3 !== null);

  await cache.close();
}

/**
 * Example 7: Monitoring cache performance
 */
async function exampleCacheMonitoring() {
  console.log('\n=== Example 7: Cache Performance Monitoring ===\n');
  
  const cache = new RepositoryMetadataCache({
    enableFallback: true,
  });

  // Simulate some cache operations
  await cache.set('key1', { data: 'value1' });
  await cache.set('key2', { data: 'value2' });
  await cache.set('key3', { data: 'value3' });

  // Mix of hits and misses
  await cache.get('key1'); // hit
  await cache.get('key2'); // hit
  await cache.get('key4'); // miss
  await cache.get('key1'); // hit
  await cache.get('key5'); // miss

  // Get performance metrics
  const metrics = cache.getMetrics();
  console.log('Cache Performance Metrics:');
  console.log(`  Hit Ratio: ${(metrics.hitRatio * 100).toFixed(2)}% (target: > 80%)`);
  console.log(`  Total Operations: ${metrics.total}`);
  console.log(`  Hits: ${metrics.hits}`);
  console.log(`  Misses: ${metrics.misses}`);
  console.log(`  Sets: ${metrics.sets}`);
  console.log(`  Errors: ${metrics.errors}`);
  console.log(`  Redis Connected: ${metrics.isRedisConnected}`);
  console.log(`  Using Fallback: ${metrics.usingFallback}`);

  await cache.close();
}

/**
 * Run all examples
 */
async function main() {
  console.log('Repository Metadata Cache Examples');
  console.log('==================================');

  try {
    await exampleBasicCache();
    await exampleGitHubClientWithCache();
    await exampleCacheWarming();
    await exampleCacheBypass();
    await exampleDifferentTTLs();
    await examplePatternClearing();
    await exampleCacheMonitoring();

    console.log('\n✅ All examples completed successfully!\n');
    console.log('Configuration Notes:');
    console.log('- Set REDIS_URL or REDIS_HOST to use Redis');
    console.log('- Set GITHUB_TOKEN to run GitHub API examples');
    console.log('- Cache automatically falls back to in-memory if Redis unavailable');
  } catch (error) {
    console.error('\n❌ Error running examples:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().then(() => process.exit(0)).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  exampleBasicCache,
  exampleGitHubClientWithCache,
  exampleCacheWarming,
  exampleCacheBypass,
  exampleDifferentTTLs,
  examplePatternClearing,
  exampleCacheMonitoring,
};
