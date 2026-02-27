/**
 * Tests for Repository Member Mapping Service
 *
 * Tests that repository members (GitHub logins) are correctly mapped to
 * Entra ID / Teams user IDs, including batch processing, caching, and
 * unmapped-user handling.
 */

const assert = require('assert');
const RepositoryMemberMappingService = require('./repositoryMemberMappingService');

console.log('Running Repository Member Mapping Service tests...\n');

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

class MockUserMapper {
  constructor(mappings = {}) {
    this.mappings = mappings; // { login: mappingObject | null }
    this.callCount = 0;
  }

  async mapUser(login, email) {
    this.callCount++;
    if (login in this.mappings) {
      return this.mappings[login];
    }
    return null;
  }
}

class MockCache {
  constructor() {
    this.data = new Map();
  }

  async get(key) {
    return this.data.get(key) || null;
  }

  async set(key, value) {
    this.data.set(key, value);
  }

  clear() {
    this.data.clear();
  }
}

// ---------------------------------------------------------------------------
// Test 1: Constructor throws without userMapper
// ---------------------------------------------------------------------------
console.log('Test 1: Constructor throws without userMapper');
(async () => {
  try {
    new RepositoryMemberMappingService({});
    console.error('❌ FAILED: Expected error not thrown\n');
    process.exit(1);
  } catch (error) {
    assert.ok(error.message.includes('userMapper'), `Unexpected error: ${error.message}`);
    console.log('✅ PASSED\n');
  }
})();

// ---------------------------------------------------------------------------
// Test 2: mapRepositoryMembers returns empty result for empty input
// ---------------------------------------------------------------------------
setTimeout(async () => {
  console.log('Test 2: mapRepositoryMembers returns empty result for empty input');
  try {
    const service = new RepositoryMemberMappingService({
      userMapper: new MockUserMapper(),
      cache: new MockCache(),
    });

    const result = await service.mapRepositoryMembers([]);

    assert.deepStrictEqual(result, { mapped: [], unmapped: [] });
    console.log('✅ PASSED\n');
  } catch (error) {
    console.error(`❌ FAILED: ${error.message}\n`);
    process.exit(1);
  }
}, 100);

// ---------------------------------------------------------------------------
// Test 3: mapRepositoryMembers maps all members successfully
// ---------------------------------------------------------------------------
setTimeout(async () => {
  console.log('Test 3: mapRepositoryMembers maps all members successfully');
  try {
    const mapper = new MockUserMapper({
      alice: { githubUsername: 'alice', entraUserId: 'entra-alice', displayName: 'Alice', source: 'email' },
      bob: { githubUsername: 'bob', entraUserId: 'entra-bob', displayName: 'Bob', source: 'fuzzy' },
    });

    const service = new RepositoryMemberMappingService({
      userMapper: mapper,
      cache: new MockCache(),
    });

    const result = await service.mapRepositoryMembers([
      { login: 'alice', email: 'alice@example.com' },
      { login: 'bob' },
    ]);

    assert.strictEqual(result.mapped.length, 2);
    assert.strictEqual(result.unmapped.length, 0);
    assert.strictEqual(result.mapped[0].entraUserId, 'entra-alice');
    assert.strictEqual(result.mapped[1].entraUserId, 'entra-bob');
    console.log('✅ PASSED\n');
  } catch (error) {
    console.error(`❌ FAILED: ${error.message}\n`);
    process.exit(1);
  }
}, 200);

// ---------------------------------------------------------------------------
// Test 4: Unmapped users are reported and do not block mapped users
// ---------------------------------------------------------------------------
setTimeout(async () => {
  console.log('Test 4: Unmapped users are reported and do not block mapped users');
  try {
    const mapper = new MockUserMapper({
      alice: { githubUsername: 'alice', entraUserId: 'entra-alice', displayName: 'Alice', source: 'email' },
      // charlie is not in the mapper – will be unmapped
    });

    const service = new RepositoryMemberMappingService({
      userMapper: mapper,
      cache: new MockCache(),
    });

    const result = await service.mapRepositoryMembers([
      { login: 'alice' },
      { login: 'charlie' },
    ]);

    assert.strictEqual(result.mapped.length, 1);
    assert.strictEqual(result.unmapped.length, 1);
    assert.strictEqual(result.mapped[0].entraUserId, 'entra-alice');
    assert.strictEqual(result.unmapped[0], 'charlie');
    console.log('✅ PASSED\n');
  } catch (error) {
    console.error(`❌ FAILED: ${error.message}\n`);
    process.exit(1);
  }
}, 300);

// ---------------------------------------------------------------------------
// Test 5: Batch processing – members are chunked into groups of batchSize
// ---------------------------------------------------------------------------
setTimeout(async () => {
  console.log('Test 5: Batch processing splits members into groups of batchSize');
  try {
    // Create 25 members; with batchSize=20 they should be split into 2 batches
    const logins = Array.from({ length: 25 }, (_, i) => `user${i}`);
    const mappings = Object.fromEntries(
      logins.map(login => [login, { githubUsername: login, entraUserId: `entra-${login}`, source: 'fuzzy' }])
    );

    const mapper = new MockUserMapper(mappings);
    const service = new RepositoryMemberMappingService({
      userMapper: mapper,
      cache: new MockCache(),
      batchSize: 20,
    });

    const members = logins.map(login => ({ login }));
    const result = await service.mapRepositoryMembers(members);

    assert.strictEqual(result.mapped.length, 25);
    assert.strictEqual(result.unmapped.length, 0);
    // All 25 users should have been queried
    assert.strictEqual(mapper.callCount, 25);
    console.log('✅ PASSED\n');
  } catch (error) {
    console.error(`❌ FAILED: ${error.message}\n`);
    process.exit(1);
  }
}, 400);

// ---------------------------------------------------------------------------
// Test 6: Service-level cache is used on repeated calls (no second mapper hit)
// ---------------------------------------------------------------------------
setTimeout(async () => {
  console.log('Test 6: Service-level cache prevents duplicate UserMapper calls');
  try {
    const mapper = new MockUserMapper({
      alice: { githubUsername: 'alice', entraUserId: 'entra-alice', displayName: 'Alice', source: 'email' },
    });

    const cache = new MockCache();
    const service = new RepositoryMemberMappingService({
      userMapper: mapper,
      cache,
      cacheTtl: 3600,
    });

    // First call – populates cache
    await service.mapMember('alice', 'alice@example.com');
    const firstCallCount = mapper.callCount;

    // Second call – should hit cache, not call mapper again
    const cachedResult = await service.mapMember('alice');

    assert.strictEqual(mapper.callCount, firstCallCount, 'Mapper should not be called on cache hit');
    assert.ok(cachedResult, 'Should return cached mapping');
    assert.strictEqual(cachedResult.entraUserId, 'entra-alice');
    console.log('✅ PASSED\n');
  } catch (error) {
    console.error(`❌ FAILED: ${error.message}\n`);
    process.exit(1);
  }
}, 500);

// ---------------------------------------------------------------------------
// Test 7: Cache can be bypassed with useCache=false
// ---------------------------------------------------------------------------
setTimeout(async () => {
  console.log('Test 7: Cache bypass (useCache=false) forces fresh UserMapper call');
  try {
    const mapper = new MockUserMapper({
      alice: { githubUsername: 'alice', entraUserId: 'entra-alice', displayName: 'Alice', source: 'email' },
    });

    const cache = new MockCache();
    const service = new RepositoryMemberMappingService({
      userMapper: mapper,
      cache,
    });

    // Populate cache
    await service.mapMember('alice');
    const countAfterFirst = mapper.callCount;

    // Bypass cache
    await service.mapMember('alice', null, false);

    assert.strictEqual(mapper.callCount, countAfterFirst + 1, 'Mapper should be called when cache is bypassed');
    console.log('✅ PASSED\n');
  } catch (error) {
    console.error(`❌ FAILED: ${error.message}\n`);
    process.exit(1);
  }
}, 600);

// ---------------------------------------------------------------------------
// Test 8: Mapper errors are caught and member treated as unmapped
// ---------------------------------------------------------------------------
setTimeout(async () => {
  console.log('Test 8: Mapper errors are caught gracefully; member treated as unmapped');
  try {
    const faultyMapper = {
      async mapUser() {
        throw new Error('Graph API unavailable');
      },
    };

    const service = new RepositoryMemberMappingService({
      userMapper: faultyMapper,
      cache: new MockCache(),
    });

    const result = await service.mapRepositoryMembers([{ login: 'dave' }]);

    assert.strictEqual(result.mapped.length, 0);
    assert.strictEqual(result.unmapped.length, 1);
    assert.strictEqual(result.unmapped[0], 'dave');
    console.log('✅ PASSED\n');
  } catch (error) {
    console.error(`❌ FAILED: ${error.message}\n`);
    process.exit(1);
  }
}, 700);

// ---------------------------------------------------------------------------
// Test 9: Admin recipients are captured and unmapped notification is logged
// ---------------------------------------------------------------------------
setTimeout(async () => {
  console.log('Test 9: Admin recipients receive notification for unmapped users');
  try {
    const telemetryEvents = [];
    const mockTelemetry = {
      trackEvent(event) { telemetryEvents.push(event); },
      trackMetric() {},
      trackException() {},
    };

    const service = new RepositoryMemberMappingService({
      userMapper: new MockUserMapper({}), // no mappings → all unmapped
      cache: new MockCache(),
      adminRecipients: ['admin-entra-id-1', 'admin-entra-id-2'],
      telemetryClient: mockTelemetry,
    });

    await service.mapRepositoryMembers([{ login: 'unknown-user' }]);

    const unmappedEvent = telemetryEvents.find(
      e => e.name === 'RepositoryMemberMappingService.UnmappedUsers'
    );

    assert.ok(unmappedEvent, 'UnmappedUsers telemetry event should be emitted');
    assert.strictEqual(unmappedEvent.properties.adminRecipientCount, '2');
    assert.ok(unmappedEvent.properties.unmappedLogins.includes('unknown-user'));
    console.log('✅ PASSED\n');
  } catch (error) {
    console.error(`❌ FAILED: ${error.message}\n`);
    process.exit(1);
  }
}, 800);

// ---------------------------------------------------------------------------
// Test 10: Telemetry is tracked for a successful batch mapping
// ---------------------------------------------------------------------------
setTimeout(async () => {
  console.log('Test 10: Telemetry is tracked for successful batch mapping');
  try {
    const telemetryEvents = [];
    const mockTelemetry = {
      trackEvent(event) { telemetryEvents.push(event); },
      trackMetric() {},
      trackException() {},
    };

    const mapper = new MockUserMapper({
      alice: { githubUsername: 'alice', entraUserId: 'entra-alice', source: 'email' },
    });

    const service = new RepositoryMemberMappingService({
      userMapper: mapper,
      cache: new MockCache(),
      telemetryClient: mockTelemetry,
    });

    await service.mapRepositoryMembers([{ login: 'alice' }, { login: 'nobody' }]);

    const completedEvent = telemetryEvents.find(
      e => e.name === 'RepositoryMemberMappingService.MapMembers.Completed'
    );

    assert.ok(completedEvent, 'Completed telemetry event should be emitted');
    assert.strictEqual(completedEvent.properties.totalMembers, '2');
    assert.strictEqual(completedEvent.properties.mappedCount, '1');
    assert.strictEqual(completedEvent.properties.unmappedCount, '1');

    console.log('✅ PASSED\n');
    console.log('All Repository Member Mapping Service tests passed! ✅');
  } catch (error) {
    console.error(`❌ FAILED: ${error.message}\n`);
    process.exit(1);
  }
}, 900);
