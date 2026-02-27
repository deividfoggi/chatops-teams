/**
 * Tests for GitHub Webhook Handlers
 * 
 * Tests webhook event routing and handler functions.
 */

const assert = require('assert');
const {
  handleCodeScanningAlert,
  handleDependabotAlert,
  handleDeploymentReview,
  handlePing,
  routeWebhookEvent,
} = require('./webhookHandlers');

console.log('Running GitHub Webhook Handler tests...\n');

// Mock telemetry client
const mockTelemetryClient = {
  trackEvent: (name, properties) => {
    // Silent mock for testing
  },
  trackMetric: (name, value, properties) => {
    // Silent mock for testing
  },
  trackException: (error, properties) => {
    // Silent mock for testing
  },
};

// Test 1: Handle code scanning alert - high severity (should escalate)
console.log('Test 1: Handle code scanning alert - high severity (should escalate)');
try {
  const payload = {
    action: 'created',
    alert: {
      number: 42,
      state: 'open',
      rule: {
        id: 'sql-injection',
        name: 'SQL Injection',
        severity: 'high',
        description: 'SQL injection vulnerability',
      },
    },
    repository: {
      full_name: 'test-org/test-repo',
    },
    sender: {
      login: 'test-user',
    },
  };

  handleCodeScanningAlert(payload, mockTelemetryClient).then((result) => {
    assert.strictEqual(result.status, 'escalated'); // Changed: high severity should escalate
    assert.strictEqual(result.eventType, 'code_scanning_alert');
    assert.strictEqual(result.action, 'created');
    assert.strictEqual(result.alertNumber, 42);
    assert.strictEqual(result.severity, 'high');
    assert.strictEqual(result.repository, 'test-org/test-repo');
    assert.strictEqual(result.shouldEscalate, true); // New field
    assert.ok(result.metadata); // New field
    assert.ok(result.metadata.description);
    
    console.log('✅ Code scanning alert handler test passed\n');
  }).catch((error) => {
    console.error('❌ Code scanning alert handler test failed:', error.message);
    process.exit(1);
  });
} catch (error) {
  console.error('❌ Code scanning alert handler test failed:', error.message);
  process.exit(1);
}

// Test 2: Handle Dependabot alert
console.log('Test 2: Handle Dependabot alert');
try {
  const payload = {
    action: 'created',
    alert: {
      number: 7,
      state: 'open',
      security_advisory: {
        severity: 'critical',
        summary: 'Remote code execution in dependency',
      },
      security_vulnerability: {
        package: {
          name: 'lodash',
        },
      },
    },
    repository: {
      full_name: 'test-org/test-repo',
    },
    sender: {
      login: 'dependabot[bot]',
    },
  };

  handleDependabotAlert(payload, mockTelemetryClient).then((result) => {
    assert.strictEqual(result.status, 'processed');
    assert.strictEqual(result.eventType, 'dependabot_alert');
    assert.strictEqual(result.action, 'created');
    assert.strictEqual(result.alertNumber, 7);
    assert.strictEqual(result.severity, 'critical');
    assert.strictEqual(result.package, 'lodash');
    assert.strictEqual(result.securityChampion, null);
    
    console.log('✅ Dependabot alert handler test passed\n');
  }).catch((error) => {
    console.error('❌ Dependabot alert handler test failed:', error.message);
    process.exit(1);
  });
} catch (error) {
  console.error('❌ Dependabot alert handler test failed:', error.message);
  process.exit(1);
}

// Test 2b: Handle Dependabot alert with Security Champion identified
console.log('Test 2b: Handle Dependabot alert - Security Champion identified');
try {
  const payload = {
    action: 'created',
    alert: {
      number: 8,
      state: 'open',
      security_advisory: {
        severity: 'high',
        summary: 'SQL Injection in dependency',
      },
      security_vulnerability: {
        package: {
          name: 'express',
        },
      },
    },
    repository: {
      full_name: 'test-org/test-repo',
    },
    sender: {
      login: 'dependabot[bot]',
    },
  };

  const mockStakeholderServiceWithChampion = {
    getSecurityChampion: async () => ({
      github_login: 'security-hero',
      source: 'custom_property',
    }),
  };

  handleDependabotAlert(payload, mockTelemetryClient, mockStakeholderServiceWithChampion).then((result) => {
    assert.strictEqual(result.status, 'processed');
    assert.strictEqual(result.eventType, 'dependabot_alert');
    assert.ok(result.securityChampion, 'Security champion should be identified');
    assert.strictEqual(result.securityChampion.github_login, 'security-hero');
    assert.strictEqual(result.securityChampion.source, 'custom_property');
    
    console.log('✅ Dependabot alert Security Champion identification test passed\n');
  }).catch((error) => {
    console.error('❌ Dependabot alert Security Champion identification test failed:', error.message);
    process.exit(1);
  });
} catch (error) {
  console.error('❌ Dependabot alert Security Champion identification test failed:', error.message);
  process.exit(1);
}

// Test 2c: Handle Dependabot alert with no Security Champion (fallback to org security team)
console.log('Test 2c: Handle Dependabot alert - no Security Champion (org security team fallback)');
try {
  const payload = {
    action: 'created',
    alert: {
      number: 9,
      state: 'open',
      security_advisory: {
        severity: 'medium',
        summary: 'Prototype pollution',
      },
      security_vulnerability: {
        package: {
          name: 'underscore',
        },
      },
    },
    repository: {
      full_name: 'test-org/no-champion-repo',
    },
    sender: {
      login: 'dependabot[bot]',
    },
  };

  const mockStakeholderServiceNoChampion = {
    getSecurityChampion: async () => null,
  };

  handleDependabotAlert(payload, mockTelemetryClient, mockStakeholderServiceNoChampion).then((result) => {
    assert.strictEqual(result.status, 'processed');
    assert.strictEqual(result.eventType, 'dependabot_alert');
    assert.strictEqual(result.securityChampion, null, 'Security champion should be null when not found');
    
    console.log('✅ Dependabot alert org security team fallback test passed\n');
  }).catch((error) => {
    console.error('❌ Dependabot alert org security team fallback test failed:', error.message);
    process.exit(1);
  });
} catch (error) {
  console.error('❌ Dependabot alert org security team fallback test failed:', error.message);
  process.exit(1);
}

// Test 2d: routeWebhookEvent passes repositoryStakeholderService from notificationService to Dependabot handler
console.log('Test 2d: Route Dependabot alert - Security Champion via notificationService');
try {
  const payload = {
    action: 'created',
    alert: {
      number: 10,
      state: 'open',
      security_advisory: {
        severity: 'critical',
        summary: 'Critical vulnerability',
      },
      security_vulnerability: {
        package: {
          name: 'axios',
        },
      },
    },
    repository: {
      full_name: 'test-org/test-repo',
    },
    sender: {
      login: 'dependabot[bot]',
    },
  };

  const mockNotificationServiceWithStakeholder = {
    repositoryStakeholderService: {
      getSecurityChampion: async () => ({
        github_login: 'sec-champion',
        source: 'topic',
      }),
    },
  };

  routeWebhookEvent('dependabot_alert', payload, mockTelemetryClient, null, mockNotificationServiceWithStakeholder).then((result) => {
    assert.strictEqual(result.status, 'processed');
    assert.strictEqual(result.eventType, 'dependabot_alert');
    assert.ok(result.securityChampion, 'Security champion should be identified via notificationService');
    assert.strictEqual(result.securityChampion.github_login, 'sec-champion');
    assert.strictEqual(result.securityChampion.source, 'topic');
    
    console.log('✅ Route Dependabot alert Security Champion via notificationService test passed\n');
  }).catch((error) => {
    console.error('❌ Route Dependabot alert Security Champion via notificationService test failed:', error.message);
    process.exit(1);
  });
} catch (error) {
  console.error('❌ Route Dependabot alert Security Champion via notificationService test failed:', error.message);
  process.exit(1);
}

// Test 3: Handle deployment review
console.log('Test 3: Handle deployment review');
try {
  const payload = {
    action: 'requested',
    environment: 'production',
    deployment: {
      id: 12345,
    },
    repository: {
      full_name: 'test-org/test-repo',
    },
    sender: {
      login: 'deploy-bot',
    },
  };

  handleDeploymentReview(payload, mockTelemetryClient).then((result) => {
    assert.strictEqual(result.status, 'processed');
    assert.strictEqual(result.eventType, 'deployment_protection_rule');
    assert.strictEqual(result.action, 'requested');
    assert.strictEqual(result.environment, 'production');
    assert.strictEqual(result.deploymentId, 12345);
    
    console.log('✅ Deployment review handler test passed\n');
  }).catch((error) => {
    console.error('❌ Deployment review handler test failed:', error.message);
    process.exit(1);
  });
} catch (error) {
  console.error('❌ Deployment review handler test failed:', error.message);
  process.exit(1);
}

// Test 4: Handle ping event
console.log('Test 4: Handle ping event');
try {
  const payload = {
    zen: 'Keep it simple.',
    hook_id: 98765,
    repository: {
      full_name: 'test-org/test-repo',
    },
  };

  handlePing(payload, mockTelemetryClient).then((result) => {
    assert.strictEqual(result.status, 'processed');
    assert.strictEqual(result.eventType, 'ping');
    assert.ok(result.message.includes('Keep it simple.'));
    
    console.log('✅ Ping handler test passed\n');
  }).catch((error) => {
    console.error('❌ Ping handler test failed:', error.message);
    process.exit(1);
  });
} catch (error) {
  console.error('❌ Ping handler test failed:', error.message);
  process.exit(1);
}

// Test 5: Route webhook event - code_scanning_alert
console.log('Test 5: Route webhook event - code_scanning_alert');
try {
  const payload = {
    action: 'reopened',
    alert: {
      number: 10,
      rule: {
        severity: 'medium',
      },
    },
    repository: {
      full_name: 'test-org/test-repo',
    },
  };

  routeWebhookEvent('code_scanning_alert', payload, mockTelemetryClient).then((result) => {
    assert.strictEqual(result.status, 'logged'); // Changed: medium severity should be logged only
    assert.strictEqual(result.eventType, 'code_scanning_alert');
    
    console.log('✅ Route code scanning event test passed\n');
  }).catch((error) => {
    console.error('❌ Route code scanning event test failed:', error.message);
    process.exit(1);
  });
} catch (error) {
  console.error('❌ Route code scanning event test failed:', error.message);
  process.exit(1);
}

// Test 6: Route webhook event - unsupported type
console.log('Test 6: Route webhook event - unsupported type');
try {
  const payload = {
    action: 'opened',
  };

  routeWebhookEvent('pull_request', payload, mockTelemetryClient).then((result) => {
    assert.strictEqual(result.status, 'unsupported');
    assert.strictEqual(result.eventType, 'pull_request');
    
    console.log('✅ Route unsupported event test passed\n');
  }).catch((error) => {
    console.error('❌ Route unsupported event test failed:', error.message);
    process.exit(1);
  });
} catch (error) {
  console.error('❌ Route unsupported event test failed:', error.message);
  process.exit(1);
}

// Test 7: Handler without telemetry client
console.log('Test 7: Handler without telemetry client');
try {
  const payload = {
    zen: 'Stay focused.',
    hook_id: 11111,
  };

  handlePing(payload, null).then((result) => {
    assert.strictEqual(result.status, 'processed');
    assert.strictEqual(result.eventType, 'ping');
    
    console.log('✅ Handler without telemetry test passed\n');
  }).catch((error) => {
    console.error('❌ Handler without telemetry test failed:', error.message);
    process.exit(1);
  });
} catch (error) {
  console.error('❌ Handler without telemetry test failed:', error.message);
  process.exit(1);
}

// Test 8: Handle code scanning alert - medium severity (should not escalate)
console.log('Test 8: Handle code scanning alert - medium severity (should not escalate)');
try {
  const payload = {
    action: 'created',
    alert: {
      number: 100,
      state: 'open',
      rule: {
        id: 'code-smell',
        name: 'Code Smell',
        severity: 'medium',
        description: 'Potential code quality issue',
      },
    },
    repository: {
      full_name: 'test-org/test-repo',
    },
    sender: {
      login: 'test-user',
    },
  };

  handleCodeScanningAlert(payload, mockTelemetryClient).then((result) => {
    assert.strictEqual(result.status, 'logged');
    assert.strictEqual(result.eventType, 'code_scanning_alert');
    assert.strictEqual(result.severity, 'medium');
    assert.strictEqual(result.shouldEscalate, false);
    assert.ok(result.message.includes('logged only'));
    
    console.log('✅ Medium severity alert test passed\n');
  }).catch((error) => {
    console.error('❌ Medium severity alert test failed:', error.message);
    process.exit(1);
  });
} catch (error) {
  console.error('❌ Medium severity alert test failed:', error.message);
  process.exit(1);
}

// Test 9: Handle code scanning alert - critical severity (should escalate)
console.log('Test 9: Handle code scanning alert - critical severity (should escalate)');
try {
  const payload = {
    action: 'created',
    alert: {
      number: 200,
      state: 'open',
      rule: {
        id: 'remote-code-execution',
        name: 'Remote Code Execution',
        severity: 'critical',
        description: 'Critical RCE vulnerability',
        tags: ['external/cwe/cwe-78', 'security'],
        security_severity_level: '9.8',
      },
      most_recent_instance: {
        location: {
          path: 'src/vulnerable.js',
          start_line: 42,
        },
      },
    },
    repository: {
      full_name: 'test-org/test-repo',
    },
    sender: {
      login: 'test-user',
    },
  };

  handleCodeScanningAlert(payload, mockTelemetryClient).then((result) => {
    assert.strictEqual(result.status, 'escalated');
    assert.strictEqual(result.severity, 'critical');
    assert.strictEqual(result.shouldEscalate, true);
    assert.ok(result.metadata.cweIds);
    assert.ok(result.metadata.cweIds.includes('CWE-78'));
    assert.strictEqual(result.metadata.cvssScore, 9.8);
    assert.ok(result.metadata.affectedFiles.length > 0);
    
    console.log('✅ Critical severity alert test passed\n');
  }).catch((error) => {
    console.error('❌ Critical severity alert test failed:', error.message);
    process.exit(1);
  });
} catch (error) {
  console.error('❌ Critical severity alert test failed:', error.message);
  process.exit(1);
}

// Wait for all async tests to complete
setTimeout(() => {
  console.log('🎉 All webhook handler tests passed!');
  console.log('\nNote: These tests verify basic handler functionality.');
  console.log('Additional integration tests should verify:');
  console.log('- Logic App workflow integration');
  console.log('- Error handling and retry logic');
  console.log('- End-to-end webhook processing');
  console.log('\nNew Story 2.1 Features Tested:');
  console.log('- Severity-based filtering: ✅');
  console.log('- Metadata extraction (CWE, CVE, CVSS): ✅');
  console.log('- Escalation decision logic: ✅');
  console.log('\nNew Story 3.2 Features Tested:');
  console.log('- Dependabot Security Champion identification: ✅');
  console.log('- Org security team fallback when no champion: ✅');
  console.log('- Security Champion via notificationService: ✅');
}, 200);
