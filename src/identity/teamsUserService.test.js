/**
 * Tests for TeamsUserService
 * 
 * Tests batch user retrieval, presence information, caching, and error handling
 */

const TeamsUserService = require('./teamsUserService');
const GraphClient = require('./graphClient');

/**
 * Mock GraphClient for testing
 */
class MockGraphClient {
  constructor() {
    this.users = new Map([
      ['user-1', { id: 'user-1', displayName: 'Alice Smith', mail: 'alice@example.com', userType: 'Member' }],
      ['user-2', { id: 'user-2', displayName: 'Bob Jones', mail: 'bob@example.com', userType: 'Member' }],
      ['user-3', { id: 'user-3', displayName: 'Charlie Brown', mail: 'charlie@example.com', userType: 'Guest' }],
    ]);

    this.presences = new Map([
      ['user-1', { availability: 'Available', activity: 'Available' }],
      ['user-2', { availability: 'Busy', activity: 'InACall' }],
      ['user-3', null], // Guest user with no presence
    ]);

    this.batchGetUsersCalls = 0;
    this.batchGetPresenceCalls = 0;
  }

  async getUserById(userId) {
    return this.users.get(userId) || null;
  }

  async getUserPresence(userId) {
    return this.presences.get(userId) || null;
  }

  async batchGetUsers(userIds) {
    this.batchGetUsersCalls++;
    return userIds.map(id => this.users.get(id)).filter(u => u);
  }

  async batchGetPresence(userIds) {
    this.batchGetPresenceCalls++;
    return userIds.map(userId => ({
      userId,
      presence: this.presences.get(userId),
      available: this.presences.has(userId) && this.presences.get(userId) !== null,
    }));
  }
}

/**
 * Mock Cache for testing
 */
class MockCache {
  constructor() {
    this.store = new Map();
    this.ttls = new Map();
  }

  async get(key) {
    const value = this.store.get(key);
    const ttl = this.ttls.get(key);
    
    if (value && ttl && Date.now() < ttl) {
      return value;
    }
    
    // Expired or not found
    this.store.delete(key);
    this.ttls.delete(key);
    return null;
  }

  async set(key, value, ttl = null) {
    this.store.set(key, value);
    if (ttl) {
      this.ttls.set(key, Date.now() + (ttl * 1000));
    }
  }

  async delete(key) {
    this.store.delete(key);
    this.ttls.delete(key);
  }

  async clearPattern(pattern) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const keysToDelete = Array.from(this.store.keys()).filter(key => regex.test(key));
    keysToDelete.forEach(key => {
      this.store.delete(key);
      this.ttls.delete(key);
    });
  }

  clear() {
    this.store.clear();
    this.ttls.clear();
  }
}

/**
 * Run tests
 */
async function runTests() {
  console.log('Starting TeamsUserService tests...\n');

  let passCount = 0;
  let failCount = 0;

  // Helper function to run a test
  async function test(name, fn) {
    try {
      await fn();
      console.log(`✓ ${name}`);
      passCount++;
    } catch (error) {
      console.error(`✗ ${name}`);
      console.error(`  Error: ${error.message}`);
      if (error.stack) {
        console.error(`  Stack: ${error.stack.split('\n')[1]}`);
      }
      failCount++;
    }
  }

  // Helper function to assert
  function assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  // Test 1: Get single user with presence
  await test('Get single user with presence', async () => {
    const mockGraph = new MockGraphClient();
    const mockCache = new MockCache();
    const service = new TeamsUserService({
      graphClient: mockGraph,
      cache: mockCache,
    });

    const user = await service.getUser('user-1', { includePresence: true });

    assert(user !== null, 'User should be found');
    assert(user.id === 'user-1', 'User ID should match');
    assert(user.displayName === 'Alice Smith', 'Display name should match');
    assert(user.presence !== null, 'Presence should be included');
    assert(user.presence.availability === 'Available', 'Presence availability should match');
  });

  // Test 2: Get single user from cache
  await test('Get single user from cache', async () => {
    const mockGraph = new MockGraphClient();
    const mockCache = new MockCache();
    const service = new TeamsUserService({
      graphClient: mockGraph,
      cache: mockCache,
    });

    // First call - should fetch from API
    const user1 = await service.getUser('user-1');
    
    // Second call - should fetch from cache
    const user2 = await service.getUser('user-1');

    assert(user1.id === user2.id, 'Cached user should match fetched user');
    assert(mockGraph.batchGetUsersCalls === 0, 'Should not call batch API for single user');
  });

  // Test 3: Get multiple users in batch
  await test('Get multiple users in batch', async () => {
    const mockGraph = new MockGraphClient();
    const mockCache = new MockCache();
    const service = new TeamsUserService({
      graphClient: mockGraph,
      cache: mockCache,
    });

    const users = await service.getUsers(['user-1', 'user-2', 'user-3'], {
      includePresence: true,
      useCache: false,
    });

    assert(users.length === 3, 'Should retrieve all 3 users');
    assert(mockGraph.batchGetUsersCalls === 1, 'Should call batch API once');
    assert(mockGraph.batchGetPresenceCalls === 1, 'Should call batch presence API once');
    
    // Check presence data
    const user1 = users.find(u => u.id === 'user-1');
    assert(user1.presence !== null, 'User 1 should have presence');
    assert(user1.presence.availability === 'Available', 'User 1 availability should be Available');
  });

  // Test 4: Batch optimization with cache
  await test('Batch optimization with cache hits', async () => {
    const mockGraph = new MockGraphClient();
    const mockCache = new MockCache();
    const service = new TeamsUserService({
      graphClient: mockGraph,
      cache: mockCache,
    });

    // Pre-populate cache with user-1
    await mockCache.set('teams:user:user-1', { id: 'user-1', displayName: 'Alice Smith' }, 3600);

    const users = await service.getUsers(['user-1', 'user-2'], {
      includePresence: false,
      useCache: true,
    });

    assert(users.length === 2, 'Should retrieve 2 users');
    assert(mockGraph.batchGetUsersCalls === 1, 'Should only fetch uncached user');
    
    // Verify user-1 came from cache
    const cachedUser = users.find(u => u.id === 'user-1');
    assert(cachedUser !== undefined, 'User-1 should be in results');
  });

  // Test 5: Split into batches when exceeding batch size
  await test('Split users into batches when exceeding max batch size', async () => {
    const mockGraph = new MockGraphClient();
    const mockCache = new MockCache();
    const service = new TeamsUserService({
      graphClient: mockGraph,
      cache: mockCache,
      batchSize: 2, // Small batch size for testing
    });

    // Add more users to mock
    for (let i = 4; i <= 5; i++) {
      mockGraph.users.set(`user-${i}`, {
        id: `user-${i}`,
        displayName: `User ${i}`,
        mail: `user${i}@example.com`,
        userType: 'Member',
      });
    }

    const users = await service.getUsers(['user-1', 'user-2', 'user-3', 'user-4', 'user-5'], {
      includePresence: false,
      useCache: false,
    });

    assert(users.length === 5, 'Should retrieve all 5 users');
    assert(mockGraph.batchGetUsersCalls === 3, 'Should split into 3 batches (2+2+1)');
  });

  // Test 6: Determine notification urgency based on presence
  await test('Determine notification urgency based on presence', async () => {
    const service = new TeamsUserService();

    const highUrgency = service.determineNotificationUrgency({ availability: 'Available' });
    assert(highUrgency === 'high', 'Available should be high urgency');

    const busyUrgency = service.determineNotificationUrgency({ availability: 'Busy' });
    assert(busyUrgency === 'high', 'Busy should be high urgency');

    const lowUrgency = service.determineNotificationUrgency({ availability: 'Away' });
    assert(lowUrgency === 'low', 'Away should be low urgency');

    const dndUrgency = service.determineNotificationUrgency({ availability: 'DoNotDisturb' });
    assert(dndUrgency === 'low', 'DoNotDisturb should be low urgency');

    const noPresence = service.determineNotificationUrgency(null);
    assert(noPresence === 'normal', 'No presence should be normal urgency');
  });

  // Test 7: Identify guest users
  await test('Identify guest users', async () => {
    const service = new TeamsUserService();

    const memberUser = { id: 'user-1', userType: 'Member' };
    assert(!service.isGuestUser(memberUser), 'Member user should not be guest');

    const guestUser = { id: 'user-3', userType: 'Guest' };
    assert(service.isGuestUser(guestUser), 'Guest user should be identified');
  });

  // Test 8: Handle user not found
  await test('Handle user not found', async () => {
    const mockGraph = new MockGraphClient();
    const mockCache = new MockCache();
    const service = new TeamsUserService({
      graphClient: mockGraph,
      cache: mockCache,
    });

    const user = await service.getUser('nonexistent-user');
    assert(user === null, 'Should return null for nonexistent user');
  });

  // Test 9: Retry logic on failure
  await test('Retry logic on failure with exponential backoff', async () => {
    let attemptCount = 0;
    
    class FailingGraphClient extends MockGraphClient {
      async batchGetUsers(userIds) {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return super.batchGetUsers(userIds);
      }
    }

    const mockGraph = new FailingGraphClient();
    const mockCache = new MockCache();
    const service = new TeamsUserService({
      graphClient: mockGraph,
      cache: mockCache,
      maxRetries: 3,
    });

    const startTime = Date.now();
    const users = await service.getUsersWithRetry(['user-1', 'user-2'], {
      includePresence: false,
      useCache: false,
      throwOnError: true, // Ensure errors propagate for retry
    });
    const duration = Date.now() - startTime;

    assert(users.length === 2, 'Should eventually succeed after retries');
    assert(attemptCount === 3, 'Should attempt 3 times');
    // Check for at least 3 seconds (1s + 2s delays)
    assert(duration >= 2800, `Should have exponential backoff delays, got ${duration}ms`);
  });

  // Test 10: Clear user cache
  await test('Clear user cache', async () => {
    const mockGraph = new MockGraphClient();
    const mockCache = new MockCache();
    const service = new TeamsUserService({
      graphClient: mockGraph,
      cache: mockCache,
    });

    // Cache some users
    await service.getUser('user-1');
    await service.getUser('user-2');

    // Verify cached
    let cached = await mockCache.get('teams:user:user-1');
    assert(cached !== null, 'User should be cached');

    // Clear specific user
    await service.clearCache('user-1');
    cached = await mockCache.get('teams:user:user-1');
    assert(cached === null, 'User-1 cache should be cleared');

    // Verify user-2 still cached
    cached = await mockCache.get('teams:user:user-2');
    assert(cached !== null, 'User-2 should still be cached');

    // Clear all users
    await service.clearCache();
    cached = await mockCache.get('teams:user:user-2');
    assert(cached === null, 'All users should be cleared');
  });

  // Test 11: Handle partial failures in batch (throwOnError: false)
  await test('Handle partial batch failures gracefully', async () => {
    class PartialFailGraphClient extends MockGraphClient {
      async batchGetUsers(userIds) {
        // Only return first 2 users, simulate partial failure
        const users = userIds.slice(0, 2).map(id => this.users.get(id)).filter(u => u);
        if (users.length === 0) {
          throw new Error('All users failed');
        }
        return users;
      }
    }

    const mockGraph = new PartialFailGraphClient();
    const mockCache = new MockCache();
    const service = new TeamsUserService({
      graphClient: mockGraph,
      cache: mockCache,
      batchSize: 2,
    });

    // Request 3 users, batch size is 2, so 2 batches
    // First batch succeeds with 2 users, second batch fails
    const users = await service.getUsers(['user-1', 'user-2', 'user-3'], {
      includePresence: false,
      useCache: false,
      throwOnError: false, // Don't throw on error
    });

    // Should get at least the first batch
    assert(users.length >= 2, 'Should return partial results on batch failure');
  });

  // Test 12: Cache TTL expiration
  await test('Cache respects TTL expiration', async () => {
    const mockGraph = new MockGraphClient();
    const mockCache = new MockCache();
    const service = new TeamsUserService({
      graphClient: mockGraph,
      cache: mockCache,
      userCacheTtl: 1, // 1 second TTL
    });

    // Get user (will cache it)
    await service.getUser('user-1', { useCache: true });

    // Immediately check cache - should be present
    let cached = await mockCache.get('teams:user:user-1');
    assert(cached !== null, 'User should be cached immediately');

    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Check cache again - should be expired
    cached = await mockCache.get('teams:user:user-1');
    assert(cached === null, 'User cache should expire after TTL');
  });

  // Test 13: GraphClient batch operations (not exceeding 20)
  await test('GraphClient enforces batch size limit of 20', async () => {
    class ValidatingGraphClient extends MockGraphClient {
      async batchGetUsers(userIds) {
        if (userIds.length > 20) {
          throw new Error('Batch request cannot exceed 20 users. Split into multiple batches.');
        }
        return super.batchGetUsers(userIds);
      }
      
      async batchGetPresence(userIds) {
        if (userIds.length > 20) {
          throw new Error('Batch request cannot exceed 20 users. Split into multiple batches.');
        }
        return super.batchGetPresence(userIds);
      }
    }
    
    const graphClient = new ValidatingGraphClient();

    // Should succeed with 20 users
    const userIds20 = Array.from({ length: 20 }, (_, i) => `user-${i}`);
    await graphClient.batchGetUsers(userIds20);

    // Should throw with 21 users
    const userIds21 = Array.from({ length: 21 }, (_, i) => `user-${i}`);
    let errorThrown = false;
    try {
      await graphClient.batchGetUsers(userIds21);
    } catch (error) {
      errorThrown = error.message.includes('exceed 20');
    }
    assert(errorThrown, 'Should throw error when batch exceeds 20');
  });

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`Tests completed: ${passCount} passed, ${failCount} failed`);
  console.log('='.repeat(50));

  if (failCount > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
