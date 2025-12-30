/**
 * Tests for Code Scanning Alert Adaptive Card
 * 
 * Tests adaptive card generation for code scanning alerts.
 */

const assert = require('assert');
const {
  createCodeScanningAlertCard,
  getSeverityColor,
  getSeverityEmoji,
} = require('./codeScanningAlertCard');

console.log('Running Code Scanning Alert Card tests...\n');

// Test 1: Severity color mapping
console.log('Test 1: Severity color mapping');
try {
  assert.strictEqual(getSeverityColor('critical'), 'attention');
  assert.strictEqual(getSeverityColor('high'), 'warning');
  assert.strictEqual(getSeverityColor('medium'), 'good');
  assert.strictEqual(getSeverityColor('low'), 'default');
  assert.strictEqual(getSeverityColor('unknown'), 'default');
  console.log('✅ PASSED\n');
} catch (error) {
  console.error(`❌ FAILED: ${error.message}\n`);
  process.exit(1);
}

// Test 2: Severity emoji mapping
console.log('Test 2: Severity emoji mapping');
try {
  assert.strictEqual(getSeverityEmoji('critical'), '🔴');
  assert.strictEqual(getSeverityEmoji('high'), '🟠');
  assert.strictEqual(getSeverityEmoji('medium'), '🟡');
  assert.strictEqual(getSeverityEmoji('low'), '⚪');
  assert.strictEqual(getSeverityEmoji('unknown'), '⚪');
  console.log('✅ PASSED\n');
} catch (error) {
  console.error(`❌ FAILED: ${error.message}\n`);
  process.exit(1);
}

// Test 3: Create card with minimal data
console.log('Test 3: Create card with minimal data');
try {
  const card = createCodeScanningAlertCard({
    alert: {
      number: 42,
      state: 'open',
      html_url: 'https://github.com/test-org/test-repo/security/code-scanning/42',
    },
    repository: {
      full_name: 'test-org/test-repo',
    },
    metadata: {
      severity: 'high',
      ruleName: 'SQL Injection',
      ruleId: 'sql-injection',
      description: 'SQL injection vulnerability detected',
      cweIds: [],
      cveIds: [],
      cvssScore: null,
      affectedFiles: [],
    },
  });

  assert.strictEqual(card.type, 'AdaptiveCard');
  assert.strictEqual(card.version, '1.5');
  assert.ok(Array.isArray(card.body));
  assert.ok(card.body.length > 0);
  assert.ok(Array.isArray(card.actions));
  assert.ok(card.actions.length > 0);

  // Check for "View in GitHub" action
  const viewAction = card.actions.find(a => a.title === 'View in GitHub');
  assert.ok(viewAction);
  assert.strictEqual(viewAction.type, 'Action.OpenUrl');
  assert.strictEqual(viewAction.url, 'https://github.com/test-org/test-repo/security/code-scanning/42');

  console.log('✅ PASSED\n');
} catch (error) {
  console.error(`❌ FAILED: ${error.message}\n`);
  process.exit(1);
}

// Test 4: Create card with full data
console.log('Test 4: Create card with full data');
try {
  const card = createCodeScanningAlertCard({
    alert: {
      number: 123,
      state: 'open',
      html_url: 'https://github.com/test-org/test-repo/security/code-scanning/123',
    },
    repository: {
      full_name: 'test-org/test-repo',
    },
    metadata: {
      severity: 'critical',
      ruleName: 'SQL Injection',
      ruleId: 'sql-injection',
      description: 'Unsanitized user input in SQL query',
      cweIds: ['CWE-89'],
      cveIds: ['CVE-2021-12345'],
      cvssScore: 9.8,
      affectedFiles: [
        {
          path: 'src/database/query.js',
          startLine: 42,
          endLine: 45,
        },
      ],
      state: 'open',
    },
    authorInfo: {
      primaryAuthor: {
        githubLogin: 'developer-alice',
      },
    },
    owners: [
      { github_login: 'owner-bob', source: 'custom_property' },
      { github_login: 'owner-charlie', source: 'codeowners' },
    ],
    securityChampion: {
      github_login: 'security-dave',
      source: 'custom_property',
    },
  });

  assert.strictEqual(card.type, 'AdaptiveCard');
  assert.ok(Array.isArray(card.body));

  // Check for stakeholders in card body
  const bodyText = JSON.stringify(card.body);
  assert.ok(bodyText.includes('developer-alice'));
  assert.ok(bodyText.includes('owner-bob'));
  assert.ok(bodyText.includes('security-dave'));

  // Check for vulnerability identifiers
  assert.ok(bodyText.includes('CWE-89'));
  assert.ok(bodyText.includes('CVE-2021-12345'));
  assert.ok(bodyText.includes('9.8'));

  // Check for affected file
  assert.ok(bodyText.includes('src/database/query.js'));
  assert.ok(bodyText.includes('line 42'));

  console.log('✅ PASSED\n');
} catch (error) {
  console.error(`❌ FAILED: ${error.message}\n`);
  process.exit(1);
}

// Test 5: Card has acknowledge action
console.log('Test 5: Card has acknowledge action');
try {
  const card = createCodeScanningAlertCard({
    alert: {
      number: 456,
      state: 'open',
    },
    repository: {
      full_name: 'test-org/test-repo',
    },
    metadata: {
      severity: 'high',
      ruleName: 'XSS',
      ruleId: 'xss',
      description: 'Cross-site scripting vulnerability',
      cweIds: [],
      cveIds: [],
      cvssScore: null,
      affectedFiles: [],
    },
  });

  const acknowledgeAction = card.actions.find(a => a.title === 'Acknowledge');
  assert.ok(acknowledgeAction);
  assert.strictEqual(acknowledgeAction.type, 'Action.Submit');
  assert.strictEqual(acknowledgeAction.data.action, 'acknowledge_alert');
  assert.strictEqual(acknowledgeAction.data.alertNumber, 456);
  assert.strictEqual(acknowledgeAction.data.repository, 'test-org/test-repo');

  console.log('✅ PASSED\n');
  console.log('All Code Scanning Alert Card tests passed! ✅');
} catch (error) {
  console.error(`❌ FAILED: ${error.message}\n`);
  process.exit(1);
}
