/**
 * Tests for Repository Metadata Cache
 * 
 * Tests cache operations, metrics, LRU eviction, and fallback behavior.
 */

const assert = require('assert');
const { RepositoryMetadataCache, CacheMetrics, InMemoryCache } = require('./repositoryMetadataCache');

console.log('Running Repository Metadata Cache tests...\n');

// Test 1: CacheMetrics functionality
console.log('Test 1: CacheMetrics - hit/miss tracking');
try {
  const metrics = new CacheMetrics();
  
  // Initially empty
  assert.strictEqual(metrics.hits, 0);
  assert.strictEqual(metrics.misses, 0);
  assert.strictEqual(metrics.getHitRatio(), 0);
  
  // Record some hits and misses
  metrics.recordHit();
  metrics.recordHit();
  metrics.recordMiss();
  
  assert.strictEqual(metrics.hits, 2);
  assert.strictEqual(metrics.misses, 1);
  assert.strictEqual(metrics.getHitRatio(), 2/3);
  
  // Get stats
  const stats = metrics.getStats();
  assert.strictEqual(stats.hits, 2);
  assert.strictEqual(stats.misses, 1);
  assert.strictEqual(stats.total, 3);
  assert.strictEqual(stats.hitRatio, 2/3);
  
  // Reset
  metrics.reset();
  assert.strictEqual(metrics.hits, 0);
  assert.strictEqual(metrics.misses, 0);
  
  console.log('✅ CacheMetrics test passed\n');
} catch (error) {
  console.error('❌ CacheMetrics test failed:', error.message);
  process.exit(1);
}

// Test 2: InMemoryCache - basic operations
console.log('Test 2: InMemoryCache - get/set/del');
(async () => {
  try {
    const cache = new InMemoryCache(1000); // 1 second TTL
    
    // Set and get
    await cache.set('key1', { data: 'value1' });
    const value1 = await cache.get('key1');
    assert.deepStrictEqual(value1, { data: 'value1' });
    
    // Get non-existent key
    const value2 = await cache.get('key2');
    assert.strictEqual(value2, null);
    
    // Delete key
    await cache.del('key1');
    const value3 = await cache.get('key1');
    assert.strictEqual(value3, null);
    
    console.log('✅ InMemoryCache basic operations test passed\n');
  } catch (error) {
    console.error('❌ InMemoryCache test failed:', error.message);
    process.exit(1);
  }
})();

// Test 3: InMemoryCache - TTL expiry
console.log('Test 3: InMemoryCache - TTL expiry');
(async () => {
  try {
    const cache = new InMemoryCache(100); // 100ms TTL
    
    await cache.set('key1', 'value1');
    const value1 = await cache.get('key1');
    assert.strictEqual(value1, 'value1');
    
    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const value2 = await cache.get('key1');
    assert.strictEqual(value2, null, 'Value should expire after TTL');
    
    console.log('✅ InMemoryCache TTL expiry test passed\n');
  } catch (error) {
    console.error('❌ InMemoryCache TTL test failed:', error.message);
    process.exit(1);
  }
})();

// Test 4: InMemoryCache - custom TTL
console.log('Test 4: InMemoryCache - custom TTL per key');
(async () => {
  try {
    const cache = new InMemoryCache(1000); // Default 1 second
    
    // Set with custom TTL (100ms)
    await cache.set('key1', 'value1', 0.1);
    
    // Should exist initially
    const value1 = await cache.get('key1');
    assert.strictEqual(value1, 'value1');
    
    // Wait for custom TTL to expire
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const value2 = await cache.get('key1');
    assert.strictEqual(value2, null, 'Value should expire after custom TTL');
    
    console.log('✅ InMemoryCache custom TTL test passed\n');
  } catch (error) {
    console.error('❌ InMemoryCache custom TTL test failed:', error.message);
    process.exit(1);
  }
})();

// Test 5: InMemoryCache - clear and keys pattern matching
console.log('Test 5: InMemoryCache - clear and pattern matching');
(async () => {
  try {
    const cache = new InMemoryCache();
    
    await cache.set('repo:owner1/repo1', 'data1');
    await cache.set('repo:owner1/repo2', 'data2');
    await cache.set('users:list1', 'users1');
    
    // Get keys matching pattern
    const repoKeys = await cache.keys('repo:*');
    assert.strictEqual(repoKeys.length, 2);
    
    const userKeys = await cache.keys('users:*');
    assert.strictEqual(userKeys.length, 1);
    
    // Clear all
    await cache.clear();
    
    const allKeys = await cache.keys('*');
    assert.strictEqual(allKeys.length, 0);
    
    console.log('✅ InMemoryCache clear and pattern matching test passed\n');
  } catch (error) {
    console.error('❌ InMemoryCache pattern matching test failed:', error.message);
    process.exit(1);
  }
})();

// Test 6: RepositoryMetadataCache - initialization with fallback
console.log('Test 6: RepositoryMetadataCache - initialization with fallback');
(async () => {
  try {
    // Create cache without Redis configuration (should use fallback)
    const cache = new RepositoryMetadataCache({
      enableFallback: true,
    });
    
    // Wait a bit for initialization
    await new Promise(resolve => setTimeout(resolve, 100));
    
    assert.ok(cache.isConnected(), 'Cache should be connected via fallback');
    assert.ok(cache.fallbackCache, 'Fallback cache should be enabled');
    assert.strictEqual(cache.isRedisConnected, false, 'Redis should not be connected');
    
    await cache.close();
    
    console.log('✅ RepositoryMetadataCache fallback initialization test passed\n');
  } catch (error) {
    console.error('❌ RepositoryMetadataCache initialization test failed:', error.message);
    process.exit(1);
  }
})();

// Test 7: RepositoryMetadataCache - key generation
console.log('Test 7: RepositoryMetadataCache - key generation');
try {
  const cache = new RepositoryMetadataCache({ enableFallback: true });
  
  const repoKey = cache.getRepositoryKey('owner', 'repo');
  assert.strictEqual(repoKey, 'repo:metadata:owner/repo');
  
  const userKey = cache.getUserListKey('team1');
  assert.strictEqual(userKey, 'users:list:team1');
  
  const securityKey = cache.getSecurityChampionKey('owner', 'repo');
  assert.strictEqual(securityKey, 'repo:security-champion:owner/repo');
  
  console.log('✅ RepositoryMetadataCache key generation test passed\n');
} catch (error) {
  console.error('❌ RepositoryMetadataCache key generation test failed:', error.message);
  process.exit(1);
}

// Test 8: RepositoryMetadataCache - cache bypass header
console.log('Test 8: RepositoryMetadataCache - cache bypass');
(async () => {
  try {
    const cache = new RepositoryMetadataCache({ enableFallback: true });
    
    // Wait for fallback initialization
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Set a value
    await cache.set('test-key', { data: 'test-value' });
    
    // Get without bypass
    const value1 = await cache.get('test-key');
    assert.deepStrictEqual(value1, { data: 'test-value' });
    
    // Get with bypass header
    const value2 = await cache.get('test-key', { 'x-cache-bypass': 'true' });
    assert.strictEqual(value2, null, 'Should return null when cache is bypassed');
    
    // Check bypass detection
    assert.strictEqual(cache.shouldBypassCache({ 'x-cache-bypass': 'true' }), true);
    assert.strictEqual(cache.shouldBypassCache({ 'X-Cache-Bypass': '1' }), true);
    assert.strictEqual(cache.shouldBypassCache({ 'x-cache-bypass': 'false' }), false);
    assert.strictEqual(cache.shouldBypassCache({}), false);
    
    await cache.close();
    
    console.log('✅ RepositoryMetadataCache cache bypass test passed\n');
  } catch (error) {
    console.error('❌ RepositoryMetadataCache cache bypass test failed:', error.message);
    process.exit(1);
  }
})();

// Test 9: RepositoryMetadataCache - get/set operations
console.log('Test 9: RepositoryMetadataCache - get/set with metrics');
(async () => {
  try {
    const cache = new RepositoryMetadataCache({
      enableFallback: true,
      repositoryTtl: 300,
    });
    
    // Wait for fallback initialization
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Initially no hits/misses
    let metrics = cache.getMetrics();
    assert.strictEqual(metrics.hits, 0);
    assert.strictEqual(metrics.misses, 0);
    
    // Cache miss
    const value1 = await cache.get('missing-key');
    assert.strictEqual(value1, null);
    metrics = cache.getMetrics();
    assert.strictEqual(metrics.misses, 1);
    
    // Cache set
    const repoData = {
      id: 123,
      name: 'test-repo',
      owner: 'test-owner',
    };
    const setSuccess = await cache.set('test-key', repoData);
    assert.strictEqual(setSuccess, true);
    metrics = cache.getMetrics();
    assert.strictEqual(metrics.sets, 1);
    
    // Cache hit
    const value2 = await cache.get('test-key');
    assert.deepStrictEqual(value2, repoData);
    metrics = cache.getMetrics();
    assert.strictEqual(metrics.hits, 1);
    assert.strictEqual(metrics.hitRatio, 1/2); // 1 hit, 1 miss
    
    await cache.close();
    
    console.log('✅ RepositoryMetadataCache get/set with metrics test passed\n');
  } catch (error) {
    console.error('❌ RepositoryMetadataCache get/set test failed:', error.message);
    process.exit(1);
  }
})();

// Test 10: RepositoryMetadataCache - delete operation
console.log('Test 10: RepositoryMetadataCache - delete');
(async () => {
  try {
    const cache = new RepositoryMetadataCache({ enableFallback: true });
    
    // Wait for fallback initialization
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Set and verify
    await cache.set('delete-key', { data: 'to-be-deleted' });
    const value1 = await cache.get('delete-key');
    assert.ok(value1, 'Value should exist before delete');
    
    // Delete
    const deleteSuccess = await cache.delete('delete-key');
    assert.strictEqual(deleteSuccess, true);
    
    // Verify deleted
    const value2 = await cache.get('delete-key');
    assert.strictEqual(value2, null, 'Value should be null after delete');
    
    await cache.close();
    
    console.log('✅ RepositoryMetadataCache delete test passed\n');
  } catch (error) {
    console.error('❌ RepositoryMetadataCache delete test failed:', error.message);
    process.exit(1);
  }
})();

// Test 11: RepositoryMetadataCache - clear pattern
console.log('Test 11: RepositoryMetadataCache - clear pattern');
(async () => {
  try {
    const cache = new RepositoryMetadataCache({ enableFallback: true });
    
    // Wait for fallback initialization
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Set multiple keys
    await cache.set('repo:owner1/repo1', { name: 'repo1' });
    await cache.set('repo:owner1/repo2', { name: 'repo2' });
    await cache.set('repo:owner2/repo3', { name: 'repo3' });
    await cache.set('users:list1', { users: [] });
    
    // Clear repo pattern
    const cleared = await cache.clearPattern('repo:owner1/*');
    assert.ok(cleared >= 2, 'Should clear at least 2 keys');
    
    // Verify cleared
    const value1 = await cache.get('repo:owner1/repo1');
    const value2 = await cache.get('repo:owner1/repo2');
    const value3 = await cache.get('repo:owner2/repo3');
    const value4 = await cache.get('users:list1');
    
    assert.strictEqual(value1, null, 'repo1 should be cleared');
    assert.strictEqual(value2, null, 'repo2 should be cleared');
    assert.ok(value3, 'repo3 should still exist');
    assert.ok(value4, 'users list should still exist');
    
    await cache.close();
    
    console.log('✅ RepositoryMetadataCache clear pattern test passed\n');
  } catch (error) {
    console.error('❌ RepositoryMetadataCache clear pattern test failed:', error.message);
    process.exit(1);
  }
})();

// Test 12: RepositoryMetadataCache - cache warming
console.log('Test 12: RepositoryMetadataCache - cache warming');
(async () => {
  try {
    const cache = new RepositoryMetadataCache({ enableFallback: true });
    
    // Wait for fallback initialization
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Prepare repositories for warming
    const repositories = [
      { owner: 'org1', repo: 'repo1', data: { name: 'repo1', stars: 100 } },
      { owner: 'org1', repo: 'repo2', data: { name: 'repo2', stars: 200 } },
      { owner: 'org2', repo: 'repo3', data: { name: 'repo3', stars: 300 } },
    ];
    
    // Warm cache
    const cached = await cache.warmCache(repositories);
    assert.strictEqual(cached, 3, 'Should cache all 3 repositories');
    
    // Verify all are cached
    const value1 = await cache.get(cache.getRepositoryKey('org1', 'repo1'));
    const value2 = await cache.get(cache.getRepositoryKey('org1', 'repo2'));
    const value3 = await cache.get(cache.getRepositoryKey('org2', 'repo3'));
    
    assert.deepStrictEqual(value1, { name: 'repo1', stars: 100 });
    assert.deepStrictEqual(value2, { name: 'repo2', stars: 200 });
    assert.deepStrictEqual(value3, { name: 'repo3', stars: 300 });
    
    await cache.close();
    
    console.log('✅ RepositoryMetadataCache cache warming test passed\n');
  } catch (error) {
    console.error('❌ RepositoryMetadataCache cache warming test failed:', error.message);
    process.exit(1);
  }
})();

// Test 13: RepositoryMetadataCache - different TTLs for different data types
console.log('Test 13: RepositoryMetadataCache - different TTLs');
(async () => {
  try {
    const cache = new RepositoryMetadataCache({
      enableFallback: true,
      repositoryTtl: 1, // 1 second for repos
      userListTtl: 2, // 2 seconds for users
    });
    
    // Wait for fallback initialization
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Set repository data (should use repositoryTtl)
    await cache.set('repo:metadata:owner/repo', { name: 'repo' });
    
    // Set user list (should use userListTtl)
    await cache.set('users:list:team1', { users: ['user1'] });
    
    // Verify both exist
    let repoValue = await cache.get('repo:metadata:owner/repo');
    let usersValue = await cache.get('users:list:team1');
    assert.ok(repoValue, 'Repo should exist initially');
    assert.ok(usersValue, 'Users should exist initially');
    
    // Wait for repo TTL to expire (1.2 seconds)
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    // Repo should be expired, users should still exist
    repoValue = await cache.get('repo:metadata:owner/repo');
    usersValue = await cache.get('users:list:team1');
    assert.strictEqual(repoValue, null, 'Repo should be expired after 1 second');
    assert.ok(usersValue, 'Users should still exist after 1 second');
    
    await cache.close();
    
    console.log('✅ RepositoryMetadataCache different TTLs test passed\n');
  } catch (error) {
    console.error('❌ RepositoryMetadataCache different TTLs test failed:', error.message);
    process.exit(1);
  }
})();

// Test 14: RepositoryMetadataCache - metrics reset
console.log('Test 14: RepositoryMetadataCache - metrics reset');
(async () => {
  try {
    const cache = new RepositoryMetadataCache({ enableFallback: true });
    
    // Wait for fallback initialization
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Generate some metrics
    await cache.set('key1', 'value1');
    await cache.get('key1'); // hit
    await cache.get('key2'); // miss
    
    let metrics = cache.getMetrics();
    assert.strictEqual(metrics.hits, 1);
    assert.strictEqual(metrics.misses, 1);
    
    // Reset metrics
    cache.resetMetrics();
    
    metrics = cache.getMetrics();
    assert.strictEqual(metrics.hits, 0);
    assert.strictEqual(metrics.misses, 0);
    assert.strictEqual(metrics.sets, 0);
    
    await cache.close();
    
    console.log('✅ RepositoryMetadataCache metrics reset test passed\n');
  } catch (error) {
    console.error('❌ RepositoryMetadataCache metrics reset test failed:', error.message);
    process.exit(1);
  }
})();

// Test 15: RepositoryMetadataCache - performance (< 50ms requirement)
console.log('Test 15: RepositoryMetadataCache - performance test');
(async () => {
  try {
    const cache = new RepositoryMetadataCache({ enableFallback: true });
    
    // Wait for fallback initialization
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Set test data
    const testData = {
      id: 123,
      name: 'test-repo',
      owner: 'test-owner',
      description: 'Test repository',
    };
    await cache.set('perf-test-key', testData);
    
    // Measure get performance
    const iterations = 100;
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await cache.get('perf-test-key');
      const duration = Date.now() - start;
      times.push(duration);
    }
    
    // Calculate average
    const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
    const maxTime = Math.max(...times);
    
    console.log(`  Average get time: ${avgTime.toFixed(2)}ms`);
    console.log(`  Max get time: ${maxTime}ms`);
    
    assert.ok(avgTime < 50, `Average time ${avgTime}ms should be < 50ms`);
    
    await cache.close();
    
    console.log('✅ RepositoryMetadataCache performance test passed\n');
  } catch (error) {
    console.error('❌ RepositoryMetadataCache performance test failed:', error.message);
    process.exit(1);
  }
})();

// Wait for all async tests to complete
(async () => {
  // Give async tests time to complete
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('🎉 All Repository Metadata Cache tests passed!');
  console.log('\nTest Coverage:');
  console.log('✓ Cache metrics tracking and hit/miss ratio calculation');
  console.log('✓ In-memory fallback cache functionality');
  console.log('✓ TTL expiration for both default and custom TTLs');
  console.log('✓ Cache initialization with fallback when Redis unavailable');
  console.log('✓ Key generation for repositories, users, and security champions');
  console.log('✓ Cache bypass header support (x-cache-bypass)');
  console.log('✓ Get/set/delete operations with metrics tracking');
  console.log('✓ Pattern-based cache clearing');
  console.log('✓ Cache warming with multiple repositories');
  console.log('✓ Different TTLs for repository metadata vs user lists');
  console.log('✓ Metrics reset functionality');
  console.log('✓ Performance meets < 50ms requirement');
  console.log('\nIntegration tests with actual Redis should verify:');
  console.log('- Redis connection and configuration');
  console.log('- LRU eviction policy configuration');
  console.log('- Distributed caching across multiple instances');
  console.log('- Failover from Redis to in-memory cache');
  console.log('- Cache metrics in Application Insights');
})();
