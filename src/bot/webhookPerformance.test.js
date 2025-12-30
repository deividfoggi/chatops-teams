/**
 * Webhook Performance Tests
 * 
 * Validates that webhook processing meets the < 500ms latency requirement
 * specified in Epic 1 success metrics.
 */

const crypto = require('crypto');
const { validateWebhookSignature } = require('./webhookValidator');
const { routeWebhookEvent } = require('./webhookHandlers');

console.log('Running Webhook Performance Tests...\n');
console.log('Epic 1 Success Metric: < 500ms latency from webhook trigger to bot processing\n');

// Mock telemetry client for testing
const mockTelemetryClient = {
  trackEvent: () => {},
  trackMetric: () => {},
  trackException: () => {},
};

/**
 * Test 1: Signature Validation Performance
 */
console.log('Test 1: Signature Validation Performance');
const secret = 'test-webhook-secret-12345';
const payload = JSON.stringify({
  action: 'created',
  alert: {
    number: 42,
    state: 'open',
    rule: {
      severity: 'high',
      description: 'SQL injection vulnerability detected',
    },
  },
  repository: {
    full_name: 'test-org/test-repo',
  },
  sender: {
    login: 'test-user',
  },
});

// Create valid signature
const hmac = crypto.createHmac('sha256', secret);
hmac.update(payload);
const signature = 'sha256=' + hmac.digest('hex');

// Measure validation time
const validationIterations = 1000;
const validationStart = Date.now();

for (let i = 0; i < validationIterations; i++) {
  validateWebhookSignature(payload, signature, secret);
}

const validationEnd = Date.now();
const avgValidationTime = (validationEnd - validationStart) / validationIterations;

console.log(`✅ Average validation time: ${avgValidationTime.toFixed(3)}ms (${validationIterations} iterations)`);

if (avgValidationTime < 50) {
  console.log('✅ Validation performance is excellent (< 50ms)\n');
} else if (avgValidationTime < 100) {
  console.log('⚠️  Validation performance is acceptable but could be optimized\n');
} else {
  console.log('❌ Validation performance needs optimization\n');
}

/**
 * Test 2: Event Routing Performance
 */
async function runRoutingTests() {
  console.log('Test 2: Event Routing Performance');

  const testPayloads = [
    {
      type: 'code_scanning_alert',
      payload: {
        action: 'created',
        alert: {
          number: 42,
          state: 'open',
          rule: {
            severity: 'high',
            description: 'SQL injection',
          },
        },
        repository: { full_name: 'test-org/test-repo' },
        sender: { login: 'test-user' },
      },
    },
    {
      type: 'dependabot_alert',
      payload: {
        action: 'created',
        alert: {
          number: 7,
          state: 'open',
          security_advisory: {
            severity: 'critical',
            summary: 'RCE vulnerability',
          },
          security_vulnerability: {
            package: { name: 'lodash' },
          },
        },
        repository: { full_name: 'test-org/test-repo' },
        sender: { login: 'dependabot[bot]' },
      },
    },
    {
      type: 'deployment_protection_rule',
      payload: {
        action: 'requested',
        environment: 'production',
        deployment: { id: 12345 },
        repository: { full_name: 'test-org/test-repo' },
        sender: { login: 'deploy-bot' },
      },
    },
    {
      type: 'ping',
      payload: {
        zen: 'Keep it simple.',
        hook_id: 98765,
        repository: { full_name: 'test-org/test-repo' },
      },
    },
  ];

  const routingResults = [];

  // Use Promise.all to properly wait for all async operations
  await Promise.all(
    testPayloads.map(async (testCase) => {
      const routingStart = Date.now();
      await routeWebhookEvent(testCase.type, testCase.payload, mockTelemetryClient);
      const routingEnd = Date.now();
      const routingTime = routingEnd - routingStart;
      routingResults.push({
        type: testCase.type,
        time: routingTime,
      });
    })
  );

  console.log('\nEvent Routing Performance Results:');
  let totalTime = 0;
  let maxTime = 0;
  
  for (const result of routingResults) {
    console.log(`  ${result.type}: ${result.time}ms`);
    totalTime += result.time;
    maxTime = Math.max(maxTime, result.time);
  }
  
  const avgRoutingTime = totalTime / routingResults.length;
  
  console.log(`\n✅ Average routing time: ${avgRoutingTime.toFixed(2)}ms`);
  console.log(`✅ Max routing time: ${maxTime}ms`);
  
  if (maxTime < 50) {
    console.log('✅ Routing performance is excellent (< 50ms)\n');
  } else if (maxTime < 100) {
    console.log('✅ Routing performance is good\n');
  } else {
    console.log('⚠️  Routing performance could be optimized\n');
  }

  return avgRoutingTime;
}

/**
 * Test 3: End-to-End Webhook Processing Simulation
 */
async function runEndToEndTest(avgRoutingTime) {
  console.log('Test 3: End-to-End Webhook Processing Simulation');
  
  const e2eStart = Date.now();
  
  // Simulate full webhook processing pipeline
  // 1. Signature validation
  const isValid = validateWebhookSignature(payload, signature, secret);
  
  // 2. Parse payload (already done)
  const parsedPayload = JSON.parse(payload);
  
  // 3. Route event
  await routeWebhookEvent('code_scanning_alert', parsedPayload, mockTelemetryClient);
  
  const e2eEnd = Date.now();
  const e2eTime = e2eEnd - e2eStart;
  
  console.log(`\n✅ End-to-end processing time: ${e2eTime}ms`);
  
  // Check against Epic 1 success metric: < 500ms
  if (e2eTime < 500) {
    console.log('✅ SUCCESS: Meets Epic 1 requirement (< 500ms latency)');
  } else {
    console.log('❌ FAIL: Exceeds Epic 1 requirement (< 500ms latency)');
    console.log('   Performance optimization needed!');
  }
  
  // Additional performance insights
  console.log('\n📊 Performance Summary:');
  console.log(`  Signature Validation: ~${avgValidationTime.toFixed(2)}ms`);
  console.log(`  Event Routing: ~${avgRoutingTime.toFixed(2)}ms`);
  console.log(`  Total Processing: ~${e2eTime}ms`);
  console.log(`  Target: < 500ms`);
  const margin = 500 - e2eTime;
  console.log(`  Margin: ${margin >= 0 ? margin.toFixed(0) : '0 (EXCEEDED)'}ms`);
  
  console.log('\n🎉 Performance tests completed!');
  console.log('\nNote: These tests measure internal processing time only.');
  console.log('Real-world latency includes:');
  console.log('  - Network latency from GitHub to Azure');
  console.log('  - Azure App Service request handling');
  console.log('  - Express.js middleware overhead');
  console.log('  - Database/cache operations (if any)');
  console.log('\nRecommendation: Monitor actual webhook processing time in');
  console.log('Application Insights using the WebhookProcessingTime metric.');
}

// Run all tests sequentially
(async () => {
  const avgRoutingTime = await runRoutingTests();
  await runEndToEndTest(avgRoutingTime);
})();
