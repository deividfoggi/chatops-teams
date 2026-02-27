/**
 * Tests for Dependabot Alert Adaptive Card
 *
 * Tests adaptive card generation for Dependabot alerts.
 */

const assert = require('assert');
const {
  createDependabotAlertCard,
  extractDependabotMetadata,
  getSeverityColor,
  getSeverityEmoji,
} = require('./dependabotAlertCard');

console.log('Running Dependabot Alert Card tests...\n');

// ── Fixtures ────────────────────────────────────────────────────────────────

const baseAlert = {
  number: 15,
  state: 'open',
  dependency: {
    package: { ecosystem: 'npm', name: 'lodash' },
    manifest_path: '/package.json',
  },
  security_advisory: {
    ghsa_id: 'GHSA-xxxx-yyyy-zzzz',
    cve_id: 'CVE-2021-23337',
    summary: 'Command Injection in lodash',
    description: 'Lodash versions before 4.17.21 are vulnerable.',
    severity: 'high',
    cvss: { score: 9.8 },
    identifiers: [
      { type: 'GHSA', value: 'GHSA-xxxx-yyyy-zzzz' },
      { type: 'CVE', value: 'CVE-2021-23337' },
    ],
  },
  security_vulnerability: {
    package: { ecosystem: 'npm', name: 'lodash' },
    severity: 'high',
    vulnerable_version_range: '< 4.17.21',
    first_patched_version: { identifier: '4.17.21' },
  },
  html_url: 'https://github.com/test-org/test-repo/security/dependabot/15',
};

const baseRepository = {
  full_name: 'test-org/test-repo',
  name: 'test-repo',
};

// ── Test 1: getSeverityColor ─────────────────────────────────────────────────

console.log('Test 1: Severity color mapping');
try {
  assert.strictEqual(getSeverityColor('critical'), 'attention');
  assert.strictEqual(getSeverityColor('high'), 'warning');
  assert.strictEqual(getSeverityColor('medium'), 'accent');
  assert.strictEqual(getSeverityColor('low'), 'default');
  assert.strictEqual(getSeverityColor('unknown'), 'default');
  assert.strictEqual(getSeverityColor(undefined), 'default');
  console.log('✅ PASSED\n');
} catch (error) {
  console.error(`❌ FAILED: ${error.message}\n`);
  process.exit(1);
}

// ── Test 2: getSeverityEmoji ─────────────────────────────────────────────────

console.log('Test 2: Severity emoji mapping');
try {
  assert.strictEqual(getSeverityEmoji('critical'), '🔴');
  assert.strictEqual(getSeverityEmoji('high'), '🟠');
  assert.strictEqual(getSeverityEmoji('medium'), '🟡');
  assert.strictEqual(getSeverityEmoji('low'), '⚪');
  assert.strictEqual(getSeverityEmoji('unknown'), '⚪');
  assert.strictEqual(getSeverityEmoji(undefined), '⚪');
  console.log('✅ PASSED\n');
} catch (error) {
  console.error(`❌ FAILED: ${error.message}\n`);
  process.exit(1);
}

// ── Test 3: extractDependabotMetadata ────────────────────────────────────────

console.log('Test 3: extractDependabotMetadata - full alert');
try {
  const meta = extractDependabotMetadata(baseAlert);

  assert.strictEqual(meta.packageName, 'lodash');
  assert.strictEqual(meta.packageEcosystem, 'npm');
  assert.strictEqual(meta.severity, 'high');
  assert.strictEqual(meta.ghsaId, 'GHSA-xxxx-yyyy-zzzz');
  assert.strictEqual(meta.cveId, 'CVE-2021-23337');
  assert.strictEqual(meta.cvssScore, 9.8);
  assert.strictEqual(meta.vulnerableVersionRange, '< 4.17.21');
  assert.strictEqual(meta.firstPatchedVersion, '4.17.21');
  assert.strictEqual(meta.manifestPath, '/package.json');
  assert.strictEqual(meta.advisoryUrl, 'https://github.com/advisories/GHSA-xxxx-yyyy-zzzz');
  assert.strictEqual(meta.alertUrl, 'https://github.com/test-org/test-repo/security/dependabot/15');
  assert.strictEqual(meta.alertNumber, 15);
  assert.strictEqual(meta.state, 'open');
  console.log('✅ PASSED\n');
} catch (error) {
  console.error(`❌ FAILED: ${error.message}\n`);
  process.exit(1);
}

// ── Test 4: extractDependabotMetadata with minimal alert ─────────────────────

console.log('Test 4: extractDependabotMetadata - minimal alert');
try {
  const meta = extractDependabotMetadata({});

  assert.strictEqual(meta.packageName, 'unknown');
  assert.strictEqual(meta.packageEcosystem, 'unknown');
  assert.strictEqual(meta.severity, 'unknown');
  assert.strictEqual(meta.ghsaId, null);
  assert.strictEqual(meta.cveId, null);
  assert.strictEqual(meta.cvssScore, null);
  assert.strictEqual(meta.advisoryUrl, null);
  console.log('✅ PASSED\n');
} catch (error) {
  console.error(`❌ FAILED: ${error.message}\n`);
  process.exit(1);
}

// ── Test 5: createDependabotAlertCard - basic structure ──────────────────────

console.log('Test 5: createDependabotAlertCard - basic structure');
try {
  const card = createDependabotAlertCard({
    alert: baseAlert,
    repository: baseRepository,
  });

  assert.strictEqual(card.type, 'AdaptiveCard');
  assert.strictEqual(card.version, '1.5');
  assert.ok(Array.isArray(card.body));
  assert.ok(card.body.length > 0);
  assert.ok(Array.isArray(card.actions));
  assert.ok(card.actions.length > 0);
  console.log('✅ PASSED\n');
} catch (error) {
  console.error(`❌ FAILED: ${error.message}\n`);
  process.exit(1);
}

// ── Test 6: createDependabotAlertCard - card body content ────────────────────

console.log('Test 6: createDependabotAlertCard - card body contains package and severity');
try {
  const card = createDependabotAlertCard({
    alert: baseAlert,
    repository: baseRepository,
  });

  const bodyText = JSON.stringify(card.body);
  assert.ok(bodyText.includes('lodash'), 'Card should contain package name');
  assert.ok(bodyText.includes('HIGH'), 'Card should contain severity label');
  assert.ok(bodyText.includes('GHSA-xxxx-yyyy-zzzz'), 'Card should contain GHSA ID');
  assert.ok(bodyText.includes('CVE-2021-23337'), 'Card should contain CVE ID');
  assert.ok(bodyText.includes('9.8'), 'Card should contain CVSS score');
  assert.ok(bodyText.includes('4.17.21'), 'Card should contain fix version');
  assert.ok(bodyText.includes('< 4.17.21'), 'Card should contain vulnerable range');
  assert.ok(bodyText.includes('test-org/test-repo'), 'Card should contain repository name');
  console.log('✅ PASSED\n');
} catch (error) {
  console.error(`❌ FAILED: ${error.message}\n`);
  process.exit(1);
}

// ── Test 7: createDependabotAlertCard - action buttons ───────────────────────

console.log('Test 7: createDependabotAlertCard - action buttons');
try {
  const card = createDependabotAlertCard({
    alert: baseAlert,
    repository: baseRepository,
  });

  // "View Advisory" opens GitHub Security Advisory
  const viewAdvisory = card.actions.find((a) => a.title === 'View Advisory');
  assert.ok(viewAdvisory, '"View Advisory" action should exist');
  assert.strictEqual(viewAdvisory.type, 'Action.OpenUrl');
  assert.strictEqual(viewAdvisory.url, 'https://github.com/advisories/GHSA-xxxx-yyyy-zzzz');

  // "View Alert" opens the Dependabot alert
  const viewAlert = card.actions.find((a) => a.title === 'View Alert');
  assert.ok(viewAlert, '"View Alert" action should exist');
  assert.strictEqual(viewAlert.type, 'Action.OpenUrl');
  assert.strictEqual(viewAlert.url, 'https://github.com/test-org/test-repo/security/dependabot/15');

  // "Create PR" triggers Dependabot PR creation
  const createPr = card.actions.find((a) => a.title === 'Create PR');
  assert.ok(createPr, '"Create PR" action should exist');
  assert.strictEqual(createPr.type, 'Action.Submit');
  assert.strictEqual(createPr.data.action, 'dependabot_create_pr');
  assert.strictEqual(createPr.data.alertNumber, 15);
  assert.strictEqual(createPr.data.repository, 'test-org/test-repo');
  assert.strictEqual(createPr.data.fixVersion, '4.17.21');

  // "Dismiss" action
  const dismiss = card.actions.find((a) => a.title === 'Dismiss');
  assert.ok(dismiss, '"Dismiss" action should exist');
  assert.strictEqual(dismiss.type, 'Action.Submit');
  assert.strictEqual(dismiss.data.action, 'dependabot_dismiss');
  assert.strictEqual(dismiss.data.alertNumber, 15);

  console.log('✅ PASSED\n');
} catch (error) {
  console.error(`❌ FAILED: ${error.message}\n`);
  process.exit(1);
}

// ── Test 8: createDependabotAlertCard - with security champion ───────────────

console.log('Test 8: createDependabotAlertCard - with security champion');
try {
  const card = createDependabotAlertCard({
    alert: baseAlert,
    repository: baseRepository,
    securityChampion: { github_login: 'security-dave', source: 'custom_property' },
  });

  const bodyText = JSON.stringify(card.body);
  assert.ok(bodyText.includes('security-dave'), 'Card should contain security champion login');
  console.log('✅ PASSED\n');
} catch (error) {
  console.error(`❌ FAILED: ${error.message}\n`);
  process.exit(1);
}

// ── Test 9: createDependabotAlertCard - no GHSA ID, fallback alert URL ───────

console.log('Test 9: createDependabotAlertCard - missing GHSA ID skips View Advisory button');
try {
  const alertNoGhsa = {
    ...baseAlert,
    security_advisory: { ...baseAlert.security_advisory, ghsa_id: null },
    html_url: 'https://github.com/test-org/test-repo/security/dependabot/15',
  };

  const card = createDependabotAlertCard({
    alert: alertNoGhsa,
    repository: baseRepository,
  });

  const viewAdvisory = card.actions.find((a) => a.title === 'View Advisory');
  assert.ok(!viewAdvisory, '"View Advisory" should not appear without GHSA ID');

  const viewAlert = card.actions.find((a) => a.title === 'View Alert');
  assert.ok(viewAlert, '"View Alert" should still exist');
  console.log('✅ PASSED\n');
} catch (error) {
  console.error(`❌ FAILED: ${error.message}\n`);
  process.exit(1);
}

// ── Test 10: severity colour applied to header container ─────────────────────

console.log('Test 10: createDependabotAlertCard - severity color applied to header container');
try {
  const criticalAlert = {
    ...baseAlert,
    security_advisory: { ...baseAlert.security_advisory, severity: 'critical' },
    security_vulnerability: { ...baseAlert.security_vulnerability, severity: 'critical' },
  };

  const card = createDependabotAlertCard({
    alert: criticalAlert,
    repository: baseRepository,
  });

  const headerContainer = card.body[0];
  assert.strictEqual(headerContainer.style, 'attention', 'Critical severity should use "attention" style');

  const bodyText = JSON.stringify(card.body);
  assert.ok(bodyText.includes('CRITICAL'), 'Card should display CRITICAL label');
  console.log('✅ PASSED\n');
} catch (error) {
  console.error(`❌ FAILED: ${error.message}\n`);
  process.exit(1);
}

console.log('All Dependabot Alert Card tests passed! ✅');
