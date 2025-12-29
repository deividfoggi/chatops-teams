/**
 * Basic functionality tests for Teams Bot Framework
 * 
 * These tests verify that the bot components load and function correctly.
 * For comprehensive testing, use a testing framework like Jest or Mocha.
 */

const assert = require('assert');
const { 
  TeamsBot, 
  ConversationReferences, 
  RateLimiter,
  ProactiveMessagingService 
} = require('./index');

console.log('Running basic bot functionality tests...\n');

// Test 1: ConversationReferences
console.log('Test 1: ConversationReferences storage');
try {
  const refs = new ConversationReferences();
  
  // Test set and get
  const testRef = {
    conversationId: 'test-conv-123',
    userId: 'test-user-456',
    serviceUrl: 'https://test.service.url',
    channelId: 'msteams',
    tenantId: 'test-tenant-789',
  };
  
  refs.set('test-conv-123', testRef);
  const retrieved = refs.get('test-conv-123');
  
  assert.strictEqual(retrieved.conversationId, 'test-conv-123');
  assert.strictEqual(retrieved.userId, 'test-user-456');
  assert.ok(retrieved.lastUpdated, 'Should have lastUpdated timestamp');
  
  // Test has
  assert.strictEqual(refs.has('test-conv-123'), true);
  assert.strictEqual(refs.has('non-existent'), false);
  
  // Test getByUserId
  const userRefs = refs.getByUserId('test-user-456');
  assert.strictEqual(userRefs.length, 1);
  assert.strictEqual(userRefs[0].userId, 'test-user-456');
  
  // Test delete
  refs.delete('test-conv-123');
  assert.strictEqual(refs.has('test-conv-123'), false);
  
  console.log('✅ ConversationReferences tests passed\n');
} catch (error) {
  console.error('❌ ConversationReferences tests failed:', error.message);
  process.exit(1);
}

// Test 2: RateLimiter
console.log('Test 2: RateLimiter');
try {
  const limiter = new RateLimiter(3, 1000); // 3 requests per second
  
  // Should allow first 3 requests
  assert.strictEqual(limiter.isAllowed('conv-1'), true);
  assert.strictEqual(limiter.isAllowed('conv-1'), true);
  assert.strictEqual(limiter.isAllowed('conv-1'), true);
  
  // 4th request should be denied
  assert.strictEqual(limiter.isAllowed('conv-1'), false);
  
  // Different conversation should be allowed
  assert.strictEqual(limiter.isAllowed('conv-2'), true);
  
  console.log('✅ RateLimiter tests passed\n');
} catch (error) {
  console.error('❌ RateLimiter tests failed:', error.message);
  process.exit(1);
}

// Test 3: Bot components can be loaded
console.log('Test 3: Bot components loading');
try {
  const refs = new ConversationReferences();
  
  // Verify TeamsBot class exists and can be instantiated
  // Note: Full initialization requires Bot Framework runtime context
  assert.ok(TeamsBot, 'TeamsBot class should be available');
  assert.strictEqual(typeof TeamsBot, 'function');
  
  // Verify required parameter validation
  try {
    new TeamsBot();
    assert.fail('Should throw error without conversationReferences');
  } catch (error) {
    assert.ok(error.message.includes('conversationReferences is required'));
  }
  
  console.log('✅ Bot components loading tests passed\n');
  console.log('Note: Full bot handler testing requires Bot Framework test context\n');
} catch (error) {
  console.error('❌ Bot components loading tests failed:', error.message);
  process.exit(1);
}

// Test 4: ProactiveMessagingService initialization
console.log('Test 4: ProactiveMessagingService initialization');
try {
  const refs = new ConversationReferences();
  
  // Mock adapter with minimal interface
  const mockAdapter = {
    continueConversationWithRateLimit: async () => {},
  };
  
  const service = new ProactiveMessagingService(mockAdapter, refs);
  
  assert.ok(service, 'ProactiveMessagingService should be created');
  assert.strictEqual(service.conversationReferences, refs);
  
  // Test that service requires adapter
  try {
    new ProactiveMessagingService();
    assert.fail('Should throw error without adapter');
  } catch (error) {
    assert.ok(error.message.includes('adapter is required'));
  }
  
  // Test that service requires conversationReferences
  try {
    new ProactiveMessagingService(mockAdapter);
    assert.fail('Should throw error without conversationReferences');
  } catch (error) {
    assert.ok(error.message.includes('conversationReferences is required'));
  }
  
  console.log('✅ ProactiveMessagingService initialization tests passed\n');
} catch (error) {
  console.error('❌ ProactiveMessagingService initialization tests failed:', error.message);
  process.exit(1);
}

console.log('🎉 All basic tests passed!');
console.log('\nNote: These are basic unit tests. For comprehensive testing:');
console.log('- Use a testing framework (Jest, Mocha)');
console.log('- Add integration tests with Bot Framework Emulator');
console.log('- Test actual message handling and adaptive card interactions');
console.log('- Test error scenarios and edge cases');
