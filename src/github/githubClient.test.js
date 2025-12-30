/**
 * Tests for GitHub API Client
 * 
 * Tests authentication, API methods, rate limiting, and caching.
 */

const assert = require('assert');
const { GitHubClient, Cache, RateLimiter } = require('./githubClient');

console.log('Running GitHub API Client tests...\n');

// Test 1: Cache functionality
console.log('Test 1: Cache with TTL');
try {
  const cache = new Cache(100); // 100ms TTL
  
  // Set and get
  cache.set('key1', { data: 'value1' });
  const value = cache.get('key1');
  assert.deepStrictEqual(value, { data: 'value1' });
  
  // Test expiry
  setTimeout(() => {
    const expired = cache.get('key1');
    assert.strictEqual(expired, null, 'Should return null after TTL expiry');
    console.log('✅ Cache TTL test passed\n');
  }, 150);
} catch (error) {
  console.error('❌ Cache test failed:', error.message);
  process.exit(1);
}

// Test 2: RateLimiter - basic throttling
console.log('Test 2: RateLimiter throttling');
try {
  const limiter = new RateLimiter();
  
  // Set low remaining
  limiter.updateFromHeaders({
    'x-ratelimit-remaining': '5',
    'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
  });
  
  assert.strictEqual(limiter.remaining, 5);
  assert.strictEqual(limiter.shouldThrottle(), true, 'Should throttle when remaining < 10');
  
  // Set high remaining
  limiter.updateFromHeaders({
    'x-ratelimit-remaining': '100',
  });
  
  assert.strictEqual(limiter.remaining, 100);
  assert.strictEqual(limiter.shouldThrottle(), false, 'Should not throttle when remaining >= 10');
  
  console.log('✅ RateLimiter throttling test passed\n');
} catch (error) {
  console.error('❌ RateLimiter test failed:', error.message);
  process.exit(1);
}

// Test 3: RateLimiter - exponential backoff
console.log('Test 3: RateLimiter exponential backoff');
try {
  const limiter = new RateLimiter();
  
  const wait0 = limiter.getWaitTime(0);
  const wait1 = limiter.getWaitTime(1);
  const wait2 = limiter.getWaitTime(2);
  const wait3 = limiter.getWaitTime(3);
  
  assert.strictEqual(wait0, 1000, 'Attempt 0 should wait 1s');
  assert.strictEqual(wait1, 2000, 'Attempt 1 should wait 2s');
  assert.strictEqual(wait2, 4000, 'Attempt 2 should wait 4s');
  assert.strictEqual(wait3, 8000, 'Attempt 3 should wait 8s');
  
  // Test max backoff
  const wait5 = limiter.getWaitTime(5);
  assert.strictEqual(wait5, 16000, 'Should cap at 16s');
  
  console.log('✅ RateLimiter exponential backoff test passed\n');
} catch (error) {
  console.error('❌ RateLimiter exponential backoff test failed:', error.message);
  process.exit(1);
}

// Test 4: GitHubClient initialization
console.log('Test 4: GitHubClient initialization');
try {
  // Test with token
  const client1 = new GitHubClient({
    token: 'test-token',
  });
  assert.ok(client1, 'Should create client with token');
  assert.strictEqual(client1.config.token, 'test-token');
  assert.ok(client1.cache, 'Should have cache instance');
  assert.ok(client1.rateLimiter, 'Should have rate limiter instance');
  
  // Test with App credentials
  const mockPrivateKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDBRHIYtJn2PUoA
WHkR3Fa2FqUgWB1nP639U9FLtawztTXqIf79JLYU1eqLgwsb+IyeCVkfYH2r/VrY
chs3iM0i4h/FiUz31JDPr6Wlaijl7HG5yBor2rqaqjUEiYaB84d2XOTCmjp/teTU
wg9akCVqmbTqvqBSBk1gjxo5PumoS8HtpESm1jwzFdER/fb7IB4TqWtlEzTPpPsQ
3d7Bk354Ax43ChwZlUMl0BLCHg5cxffvEEexQ0eqmbNatLaiMki7fFCjSO67ZKPd
sigqZSbU/NN6ZFSVRE0z3uB3rDWW6pZJLJsVkwsHCSQgS6BuC3iiUEZJmSh/xz/T
Skx89Z1JAgMBAAECggEAFZx6HzPbxwaPtrXt9N61BgfGd3VO9WeQJMSZgewq2T3d
TWT3itZO84m/oFHbHUm37KiaMgljyCaMoOkyjK1UFf9f4uKBbDGVb1nibZqvP9Wm
mmoLLiX3aZnYk50uwKuLFWPaEz40hikgcV+RYLS/cFoHelvuWLm6b46U9buInIBJ
YNu8BAHn75XB5Vra7sgnkMVaG9483e+TfrUtnIEPHcggPczFiDNI7u/rywafJ3KR
iydyxfywbyj07KPpT9SEsoamf9SrbQEab4gIIWhUWuupJcs+EuamOZ0fKGfvUVFR
Lai4Cs7k6IzOLL21DTapN47hmVST2TXzXkVfCfa4IQKBgQDoGOnAgyiW0Ee8u0P9
glPiZqGBk4MKPvyvR2Mm3WGJlguKIXwPCIY529qNKHg9n0EUfqYh+V6Gr65HnPEo
S4p/CeKk2r7et33fHltqo6ugDJwJJ7e3Y2gS4bLWEYUrjjrALQXL1ahKxaU8ZMzD
2vGABzsFBc/YXpkkPO9+PZNbaQKBgQDVK865iwQwfz8fU1eiG+40xUOVJshRFvwB
hxMxXQ+MSn2LaiyvtKD54nIIDuk7zWJFOtY9i3FopRx44H9Chq0mKdgPWdlfaCcm
0PjljXNeOdEwNK39YZ95tdYG3HLp+W8cTcA7OugIIsOm+6Yz/fvW93fG9B/5jUpv
eHGmSTVW4QKBgCfOXgjOdd+nySXtWDPablieEYUPr6HKO7w0GiVIQro+Kax/Ia/S
XnL96fXbwwOOlLLXJdcd1cBz0QgnOpUWn6I6J8zuV14LSmNB6ZvYhk7k2r4XOcMS
IX9bhjiAuL5HnnvnPN9AvaRVUYmSICxXGKREmTK7VHJfhxRX/xs/pE5BAoGBAILK
WBH7O1zOFdqQdgoefO6fwbF3lBw8r+34BEybPnjjE1hAkp5TgxkOWMyc6XkpsIut
Z9lm/vQnqep4Q1x76SyrK8dvZzFkY/Eq8itVuF0tuC2NhNsb1I8GhAS9qTvpMMT6
52Dv6YFkYwrHB9iKksP4HeNR0XR5vhvamFBgRnvBAoGAWN2EXhr9M+a+kUkC8ZgA
3b9nz349pxEZq+AqCFMPq7juTb4gxxOVSDuru7xyNl3YyScGtyRS3Wq6DV14ABBN
Ad9MJV4FBYTZs5ahjI9pTJB619FvYHF+cocS8XcqU3idhAa6EEeYQpoA/Qa3ol1f
8/arEF0Kn1IA+0+Of91F9+Q=
-----END PRIVATE KEY-----`;

  const client2 = new GitHubClient({
    appId: '12345',
    privateKey: mockPrivateKey,
    installationId: '67890',
  });
  assert.ok(client2, 'Should create client with App credentials');
  assert.strictEqual(client2.config.appId, '12345');
  
  console.log('✅ GitHubClient initialization test passed\n');
} catch (error) {
  console.error('❌ GitHubClient initialization test failed:', error.message);
  process.exit(1);
}

// Test 5: JWT generation
console.log('Test 5: JWT token generation');
try {
  const mockPrivateKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDBRHIYtJn2PUoA
WHkR3Fa2FqUgWB1nP639U9FLtawztTXqIf79JLYU1eqLgwsb+IyeCVkfYH2r/VrY
chs3iM0i4h/FiUz31JDPr6Wlaijl7HG5yBor2rqaqjUEiYaB84d2XOTCmjp/teTU
wg9akCVqmbTqvqBSBk1gjxo5PumoS8HtpESm1jwzFdER/fb7IB4TqWtlEzTPpPsQ
3d7Bk354Ax43ChwZlUMl0BLCHg5cxffvEEexQ0eqmbNatLaiMki7fFCjSO67ZKPd
sigqZSbU/NN6ZFSVRE0z3uB3rDWW6pZJLJsVkwsHCSQgS6BuC3iiUEZJmSh/xz/T
Skx89Z1JAgMBAAECggEAFZx6HzPbxwaPtrXt9N61BgfGd3VO9WeQJMSZgewq2T3d
TWT3itZO84m/oFHbHUm37KiaMgljyCaMoOkyjK1UFf9f4uKBbDGVb1nibZqvP9Wm
mmoLLiX3aZnYk50uwKuLFWPaEz40hikgcV+RYLS/cFoHelvuWLm6b46U9buInIBJ
YNu8BAHn75XB5Vra7sgnkMVaG9483e+TfrUtnIEPHcggPczFiDNI7u/rywafJ3KR
iydyxfywbyj07KPpT9SEsoamf9SrbQEab4gIIWhUWuupJcs+EuamOZ0fKGfvUVFR
Lai4Cs7k6IzOLL21DTapN47hmVST2TXzXkVfCfa4IQKBgQDoGOnAgyiW0Ee8u0P9
glPiZqGBk4MKPvyvR2Mm3WGJlguKIXwPCIY529qNKHg9n0EUfqYh+V6Gr65HnPEo
S4p/CeKk2r7et33fHltqo6ugDJwJJ7e3Y2gS4bLWEYUrjjrALQXL1ahKxaU8ZMzD
2vGABzsFBc/YXpkkPO9+PZNbaQKBgQDVK865iwQwfz8fU1eiG+40xUOVJshRFvwB
hxMxXQ+MSn2LaiyvtKD54nIIDuk7zWJFOtY9i3FopRx44H9Chq0mKdgPWdlfaCcm
0PjljXNeOdEwNK39YZ95tdYG3HLp+W8cTcA7OugIIsOm+6Yz/fvW93fG9B/5jUpv
eHGmSTVW4QKBgCfOXgjOdd+nySXtWDPablieEYUPr6HKO7w0GiVIQro+Kax/Ia/S
XnL96fXbwwOOlLLXJdcd1cBz0QgnOpUWn6I6J8zuV14LSmNB6ZvYhk7k2r4XOcMS
IX9bhjiAuL5HnnvnPN9AvaRVUYmSICxXGKREmTK7VHJfhxRX/xs/pE5BAoGBAILK
WBH7O1zOFdqQdgoefO6fwbF3lBw8r+34BEybPnjjE1hAkp5TgxkOWMyc6XkpsIut
Z9lm/vQnqep4Q1x76SyrK8dvZzFkY/Eq8itVuF0tuC2NhNsb1I8GhAS9qTvpMMT6
52Dv6YFkYwrHB9iKksP4HeNR0XR5vhvamFBgRnvBAoGAWN2EXhr9M+a+kUkC8ZgA
3b9nz349pxEZq+AqCFMPq7juTb4gxxOVSDuru7xyNl3YyScGtyRS3Wq6DV14ABBN
Ad9MJV4FBYTZs5ahjI9pTJB619FvYHF+cocS8XcqU3idhAa6EEeYQpoA/Qa3ol1f
8/arEF0Kn1IA+0+Of91F9+Q=
-----END PRIVATE KEY-----`;

  const client = new GitHubClient({
    appId: '12345',
    privateKey: mockPrivateKey,
  });

  const jwt = client.generateJWT();
  assert.ok(jwt, 'Should generate JWT token');
  assert.strictEqual(typeof jwt, 'string');
  
  // JWT should have 3 parts separated by dots
  const parts = jwt.split('.');
  assert.strictEqual(parts.length, 3, 'JWT should have 3 parts');
  
  // Decode and verify payload
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  assert.strictEqual(payload.iss, '12345', 'Issuer should be app ID');
  assert.ok(payload.iat, 'Should have issued at time');
  assert.ok(payload.exp, 'Should have expiry time');
  assert.ok(payload.exp > payload.iat, 'Expiry should be after issued time');
  
  console.log('✅ JWT generation test passed\n');
} catch (error) {
  console.error('❌ JWT generation test failed:', error.message);
  process.exit(1);
}

// Test 6: JWT generation without credentials
console.log('Test 6: JWT generation error handling');
try {
  const client = new GitHubClient({
    token: 'some-token',
  });

  try {
    client.generateJWT();
    assert.fail('Should throw error without App credentials');
  } catch (error) {
    assert.ok(error.message.includes('GitHub App ID and private key are required'));
  }
  
  console.log('✅ JWT generation error handling test passed\n');
} catch (error) {
  console.error('❌ JWT generation error handling test failed:', error.message);
  process.exit(1);
}

// Test 7: Auth headers with token
console.log('Test 7: Auth headers with token');
try {
  const client = new GitHubClient({
    token: 'test-token-123',
  });

  client.getAuthHeaders().then(headers => {
    assert.strictEqual(headers['Authorization'], 'token test-token-123');
    assert.strictEqual(headers['Accept'], 'application/vnd.github.v3+json');
    assert.strictEqual(headers['User-Agent'], 'ChatOps-Teams-App');
    
    console.log('✅ Auth headers with token test passed\n');
  }).catch(error => {
    console.error('❌ Auth headers test failed:', error.message);
    process.exit(1);
  });
} catch (error) {
  console.error('❌ Auth headers test failed:', error.message);
  process.exit(1);
}

// Test 8: Auth headers without credentials
console.log('Test 8: Auth headers error handling');
try {
  const client = new GitHubClient({});

  client.getAuthHeaders().then(() => {
    assert.fail('Should throw error without credentials');
  }).catch(error => {
    assert.ok(error.message.includes('GitHub authentication not configured'));
    console.log('✅ Auth headers error handling test passed\n');
  });
} catch (error) {
  console.error('❌ Auth headers error handling test failed:', error.message);
  process.exit(1);
}

// Test 9: Rate limiter queue
console.log('Test 9: Rate limiter request queue');
try {
  const limiter = new RateLimiter();
  
  // Set to throttle
  limiter.updateFromHeaders({
    'x-ratelimit-remaining': '5',
    'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 1), // 1 second
  });
  
  let executed = false;
  const mockRequest = async () => {
    executed = true;
    return { data: 'test' };
  };
  
  limiter.queueRequest(mockRequest).then(result => {
    assert.strictEqual(executed, true, 'Request should be executed');
    assert.deepStrictEqual(result, { data: 'test' });
    console.log('✅ Rate limiter queue test passed\n');
  }).catch(error => {
    console.error('❌ Rate limiter queue test failed:', error.message);
    process.exit(1);
  });
} catch (error) {
  console.error('❌ Rate limiter queue test failed:', error.message);
  process.exit(1);
}

// Test 10: Cache clear
console.log('Test 10: Cache clear');
try {
  const cache = new Cache();
  
  cache.set('key1', 'value1');
  cache.set('key2', 'value2');
  
  assert.strictEqual(cache.get('key1'), 'value1');
  assert.strictEqual(cache.get('key2'), 'value2');
  
  cache.clear();
  
  assert.strictEqual(cache.get('key1'), null);
  assert.strictEqual(cache.get('key2'), null);
  
  console.log('✅ Cache clear test passed\n');
} catch (error) {
  console.error('❌ Cache clear test failed:', error.message);
  process.exit(1);
}

// Test 11: Client cache clear
console.log('Test 11: Client cache clear');
try {
  const client = new GitHubClient({
    token: 'test-token',
  });

  client.cache.set('test-key', 'test-value');
  assert.strictEqual(client.cache.get('test-key'), 'test-value');
  
  client.clearCache();
  assert.strictEqual(client.cache.get('test-key'), null);
  
  console.log('✅ Client cache clear test passed\n');
} catch (error) {
  console.error('❌ Client cache clear test failed:', error.message);
  process.exit(1);
}

// Test 12: Rate limiter retry-after header
console.log('Test 12: Rate limiter retry-after handling');
try {
  const limiter = new RateLimiter();
  
  const retryAfterTime = Date.now() + 5000; // 5 seconds from now
  limiter.updateFromHeaders({
    'retry-after': '5',
  });
  
  assert.ok(limiter.retryAfter, 'Should set retry-after');
  assert.strictEqual(limiter.shouldThrottle(), true, 'Should throttle when retry-after is set');
  
  const waitTime = limiter.getWaitTime();
  assert.ok(waitTime >= 4000 && waitTime <= 5000, 'Wait time should be approximately 5 seconds');
  
  console.log('✅ Rate limiter retry-after test passed\n');
} catch (error) {
  console.error('❌ Rate limiter retry-after test failed:', error.message);
  process.exit(1);
}

// Wait for async tests to complete
setTimeout(() => {
  console.log('🎉 All GitHub API Client unit tests passed!');
  console.log('\nNote: These tests verify core functionality.');
  console.log('Integration tests with actual GitHub API should verify:');
  console.log('- Repository and commit information retrieval');
  console.log('- Security champion metadata parsing');
  console.log('- Pagination for large result sets');
  console.log('- End-to-end authentication flow');
  console.log('- Rate limit handling with real API responses');
}, 200);
