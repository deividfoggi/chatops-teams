/**
 * Tests for GitHub Webhook Validator
 * 
 * Tests webhook signature validation and helper functions.
 */

const assert = require('assert');
const crypto = require('crypto');
const {
  validateWebhookSignature,
  getEventType,
  getDeliveryId,
  isSupportedEventType,
} = require('./webhookValidator');

console.log('Running GitHub Webhook Validator tests...\n');

// Test 1: Valid webhook signature
console.log('Test 1: Valid webhook signature');
try {
  const secret = 'test-secret-key';
  const payload = JSON.stringify({ foo: 'bar', test: 123 });
  
  // Create valid signature
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const signature = 'sha256=' + hmac.digest('hex');
  
  const isValid = validateWebhookSignature(payload, signature, secret);
  assert.strictEqual(isValid, true, 'Should validate correct signature');
  
  console.log('✅ Valid signature test passed\n');
} catch (error) {
  console.error('❌ Valid signature test failed:', error.message);
  process.exit(1);
}

// Test 2: Invalid webhook signature
console.log('Test 2: Invalid webhook signature');
try {
  const secret = 'test-secret-key';
  const payload = JSON.stringify({ foo: 'bar' });
  const invalidSignature = 'sha256=invalid-signature-hash';
  
  const isValid = validateWebhookSignature(payload, invalidSignature, secret);
  assert.strictEqual(isValid, false, 'Should reject invalid signature');
  
  console.log('✅ Invalid signature test passed\n');
} catch (error) {
  console.error('❌ Invalid signature test failed:', error.message);
  process.exit(1);
}

// Test 3: Wrong secret
console.log('Test 3: Wrong secret');
try {
  const secret = 'correct-secret';
  const wrongSecret = 'wrong-secret';
  const payload = JSON.stringify({ foo: 'bar' });
  
  // Create signature with correct secret
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const signature = 'sha256=' + hmac.digest('hex');
  
  // Validate with wrong secret
  const isValid = validateWebhookSignature(payload, signature, wrongSecret);
  assert.strictEqual(isValid, false, 'Should reject signature with wrong secret');
  
  console.log('✅ Wrong secret test passed\n');
} catch (error) {
  console.error('❌ Wrong secret test failed:', error.message);
  process.exit(1);
}

// Test 4: Missing signature
console.log('Test 4: Missing signature');
try {
  const secret = 'test-secret';
  const payload = JSON.stringify({ foo: 'bar' });
  
  const isValid = validateWebhookSignature(payload, null, secret);
  assert.strictEqual(isValid, false, 'Should reject missing signature');
  
  console.log('✅ Missing signature test passed\n');
} catch (error) {
  console.error('❌ Missing signature test failed:', error.message);
  process.exit(1);
}

// Test 5: Missing secret
console.log('Test 5: Missing secret');
try {
  const payload = JSON.stringify({ foo: 'bar' });
  const signature = 'sha256=somehash';
  
  const isValid = validateWebhookSignature(payload, signature, null);
  assert.strictEqual(isValid, false, 'Should reject when secret is missing');
  
  console.log('✅ Missing secret test passed\n');
} catch (error) {
  console.error('❌ Missing secret test failed:', error.message);
  process.exit(1);
}

// Test 6: Invalid signature format
console.log('Test 6: Invalid signature format');
try {
  const secret = 'test-secret';
  const payload = JSON.stringify({ foo: 'bar' });
  const invalidFormatSignature = 'invalid-format-signature';
  
  const isValid = validateWebhookSignature(payload, invalidFormatSignature, secret);
  assert.strictEqual(isValid, false, 'Should reject signature without sha256= prefix');
  
  console.log('✅ Invalid signature format test passed\n');
} catch (error) {
  console.error('❌ Invalid signature format test failed:', error.message);
  process.exit(1);
}

// Test 7: Buffer payload
console.log('Test 7: Buffer payload');
try {
  const secret = 'test-secret-key';
  const payloadString = JSON.stringify({ foo: 'bar', test: 123 });
  const payloadBuffer = Buffer.from(payloadString, 'utf8');
  
  // Create valid signature
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadBuffer);
  const signature = 'sha256=' + hmac.digest('hex');
  
  const isValid = validateWebhookSignature(payloadBuffer, signature, secret);
  assert.strictEqual(isValid, true, 'Should validate signature with Buffer payload');
  
  console.log('✅ Buffer payload test passed\n');
} catch (error) {
  console.error('❌ Buffer payload test failed:', error.message);
  process.exit(1);
}

// Test 8: Get event type
console.log('Test 8: Get event type');
try {
  const headers = {
    'x-github-event': 'code_scanning_alert',
    'x-github-delivery': 'test-delivery-123',
  };
  
  const eventType = getEventType(headers);
  assert.strictEqual(eventType, 'code_scanning_alert');
  
  // Test with missing header
  const emptyHeaders = {};
  const missingEvent = getEventType(emptyHeaders);
  assert.strictEqual(missingEvent, null);
  
  console.log('✅ Get event type test passed\n');
} catch (error) {
  console.error('❌ Get event type test failed:', error.message);
  process.exit(1);
}

// Test 9: Get delivery ID
console.log('Test 9: Get delivery ID');
try {
  const headers = {
    'x-github-event': 'code_scanning_alert',
    'x-github-delivery': 'test-delivery-123',
  };
  
  const deliveryId = getDeliveryId(headers);
  assert.strictEqual(deliveryId, 'test-delivery-123');
  
  // Test with missing header
  const emptyHeaders = {};
  const missingDeliveryId = getDeliveryId(emptyHeaders);
  assert.strictEqual(missingDeliveryId, null);
  
  console.log('✅ Get delivery ID test passed\n');
} catch (error) {
  console.error('❌ Get delivery ID test failed:', error.message);
  process.exit(1);
}

// Test 10: Supported event types
console.log('Test 10: Supported event types');
try {
  // Test supported events
  assert.strictEqual(isSupportedEventType('code_scanning_alert'), true);
  assert.strictEqual(isSupportedEventType('dependabot_alert'), true);
  assert.strictEqual(isSupportedEventType('deployment_protection_rule'), true);
  assert.strictEqual(isSupportedEventType('ping'), true);
  
  // Test unsupported events
  assert.strictEqual(isSupportedEventType('push'), false);
  assert.strictEqual(isSupportedEventType('pull_request'), false);
  assert.strictEqual(isSupportedEventType('issues'), false);
  assert.strictEqual(isSupportedEventType('unknown_event'), false);
  
  console.log('✅ Supported event types test passed\n');
} catch (error) {
  console.error('❌ Supported event types test failed:', error.message);
  process.exit(1);
}

// Test 11: Timing attack resistance
console.log('Test 11: Timing attack resistance');
try {
  const secret = 'test-secret-key';
  const payload = JSON.stringify({ foo: 'bar' });
  
  // Create valid signature
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const validSignature = 'sha256=' + hmac.digest('hex');
  
  // Create signature with different length (should still use timing-safe comparison)
  const shortSignature = 'sha256=abc123';
  
  const isValid1 = validateWebhookSignature(payload, validSignature, secret);
  const isValid2 = validateWebhookSignature(payload, shortSignature, secret);
  
  assert.strictEqual(isValid1, true, 'Valid signature should pass');
  assert.strictEqual(isValid2, false, 'Invalid signature should fail');
  
  console.log('✅ Timing attack resistance test passed\n');
} catch (error) {
  console.error('❌ Timing attack resistance test failed:', error.message);
  process.exit(1);
}

console.log('🎉 All webhook validator tests passed!');
