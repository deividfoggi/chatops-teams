/**
 * Tests for Dependabot Notification Service
 *
 * Tests the end-to-end notification workflow for Dependabot alerts.
 */

const assert = require('assert');
const DependabotNotificationService = require('./dependabotNotificationService');

console.log('Running Dependabot Notification Service tests...\n');

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

// ── Mock factories ───────────────────────────────────────────────────────────

function buildMocks({ securityChampion = null, mappedUser = null, sendCount = 1 } = {}) {
  const mockStakeholderService = {
    getSecurityChampion: async () => securityChampion,
    getRepositoryOwners: async () => [],
  };

  const mockUserMapper = {
    mapGitHubToEntraId: async (login) =>
      mappedUser ? { id: 'entra-id-123', login } : null,
  };

  const mockTeamsUserService = {
    getUser: async () =>
      mappedUser ? { displayName: 'Test User', id: 'entra-id-123' } : null,
  };

  const mockProactiveMessaging = {
    sendAdaptiveCardToUser: async () => sendCount,
  };

  const mockTelemetryClient = {
    trackEvent: () => {},
    trackMetric: () => {},
    trackException: () => {},
  };

  return {
    mockStakeholderService,
    mockUserMapper,
    mockTeamsUserService,
    mockProactiveMessaging,
    mockTelemetryClient,
  };
}

function buildService(overrides = {}) {
  const {
    mockStakeholderService,
    mockUserMapper,
    mockTeamsUserService,
    mockProactiveMessaging,
    mockTelemetryClient,
  } = buildMocks(overrides);

  return new DependabotNotificationService({
    repositoryStakeholderService: mockStakeholderService,
    userMapper: mockUserMapper,
    teamsUserService: mockTeamsUserService,
    proactiveMessagingService: mockProactiveMessaging,
    telemetryClient: mockTelemetryClient,
    ...('githubClient' in overrides ? { githubClient: overrides.githubClient } : {}),
  });
}

// ── Test 1: Constructor validation ───────────────────────────────────────────

console.log('Test 1: Constructor - throws when required config is missing');
try {
  try {
    new DependabotNotificationService(null);
    assert.fail('Should have thrown');
  } catch (e) {
    assert.ok(e.message.includes('config is required'));
  }

  try {
    new DependabotNotificationService({});
    assert.fail('Should have thrown');
  } catch (e) {
    assert.ok(e.message.includes('repositoryStakeholderService is required'));
  }

  console.log('✅ PASSED\n');
} catch (error) {
  console.error(`❌ FAILED: ${error.message}\n`);
  process.exit(1);
}

// ── Test 2: processAndNotify - notify Security Champion only ─────────────────

console.log('Test 2: processAndNotify - notifies Security Champion');
(async () => {
  try {
    const service = buildService({
      securityChampion: { github_login: 'security-dave', source: 'custom_property' },
      mappedUser: true,
      sendCount: 1,
    });

    const result = await service.processAndNotify({
      alert: baseAlert,
      repository: baseRepository,
      notifyAllMembers: false,
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.githubLogins.includes('security-dave'));
    assert.strictEqual(result.notificationResult.sent, 1);
    assert.strictEqual(result.notificationResult.failed, 0);
    console.log('✅ PASSED\n');
  } catch (error) {
    console.error(`❌ FAILED: ${error.message}\n`);
    process.exit(1);
  }
})();

// ── Test 3: processAndNotify - notify_all_members uses githubClient ───────────

console.log('Test 3: processAndNotify - notifyAllMembers includes extra members');
(async () => {
  try {
    const mockGithubClient = {
      getRepositoryMembers: async () => [
        { login: 'member-alice' },
        { login: 'member-bob' },
      ],
    };

    const {
      mockStakeholderService,
      mockUserMapper,
      mockTeamsUserService,
      mockProactiveMessaging,
      mockTelemetryClient,
    } = buildMocks({ securityChampion: { github_login: 'security-dave' }, mappedUser: true, sendCount: 1 });

    const service = new DependabotNotificationService({
      repositoryStakeholderService: mockStakeholderService,
      userMapper: mockUserMapper,
      teamsUserService: mockTeamsUserService,
      proactiveMessagingService: mockProactiveMessaging,
      telemetryClient: mockTelemetryClient,
      githubClient: mockGithubClient,
    });

    const result = await service.processAndNotify({
      alert: baseAlert,
      repository: baseRepository,
      notifyAllMembers: true,
    });

    // security-dave + member-alice + member-bob = 3 logins
    assert.strictEqual(result.githubLogins.length, 3);
    assert.ok(result.githubLogins.includes('security-dave'));
    assert.ok(result.githubLogins.includes('member-alice'));
    assert.ok(result.githubLogins.includes('member-bob'));
    console.log('✅ PASSED\n');
  } catch (error) {
    console.error(`❌ FAILED: ${error.message}\n`);
    process.exit(1);
  }
})();

// ── Test 4: processAndNotify - no security champion found ────────────────────

console.log('Test 4: processAndNotify - succeeds with no security champion found');
(async () => {
  try {
    const service = buildService({
      securityChampion: null,
      mappedUser: false,
    });

    const result = await service.processAndNotify({
      alert: baseAlert,
      repository: baseRepository,
    });

    // No users can be mapped → success=false but no error thrown
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.githubLogins.length, 0);
    assert.strictEqual(result.notificationResult.sent, 0);
    console.log('✅ PASSED\n');
  } catch (error) {
    console.error(`❌ FAILED: ${error.message}\n`);
    process.exit(1);
  }
})();

// ── Test 5: processAndNotify - user cannot be mapped to Teams ────────────────

console.log('Test 5: processAndNotify - gracefully handles unmappable users');
(async () => {
  try {
    const service = buildService({
      securityChampion: { github_login: 'security-dave' },
      mappedUser: false, // userMapper returns null
    });

    const result = await service.processAndNotify({
      alert: baseAlert,
      repository: baseRepository,
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.teamsUsers.length, 0);
    assert.strictEqual(result.notificationResult.sent, 0);
    console.log('✅ PASSED\n');
  } catch (error) {
    console.error(`❌ FAILED: ${error.message}\n`);
    process.exit(1);
  }
})();

// ── Test 6: processAndNotify - proactive messaging fails gracefully ───────────

console.log('Test 6: processAndNotify - handles send failure gracefully');
(async () => {
  try {
    const service = buildService({
      securityChampion: { github_login: 'security-dave' },
      mappedUser: true,
      sendCount: 0, // sendAdaptiveCardToUser returns 0 (no conversation reference)
    });

    const result = await service.processAndNotify({
      alert: baseAlert,
      repository: baseRepository,
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.notificationResult.sent, 0);
    assert.strictEqual(result.notificationResult.failed, 1);
    console.log('✅ PASSED\n');
  } catch (error) {
    console.error(`❌ FAILED: ${error.message}\n`);
    process.exit(1);
  }
})();

// ── Test 7: processAndNotify - deduplicates security champion from members ────

console.log('Test 7: processAndNotify - deduplicates security champion from member list');
(async () => {
  try {
    const mockGithubClient = {
      // security-dave appears in the member list too
      getRepositoryMembers: async () => [
        { login: 'security-dave' },
        { login: 'member-alice' },
      ],
    };

    const {
      mockStakeholderService,
      mockUserMapper,
      mockTeamsUserService,
      mockProactiveMessaging,
      mockTelemetryClient,
    } = buildMocks({ securityChampion: { github_login: 'security-dave' }, mappedUser: true, sendCount: 1 });

    const service = new DependabotNotificationService({
      repositoryStakeholderService: mockStakeholderService,
      userMapper: mockUserMapper,
      teamsUserService: mockTeamsUserService,
      proactiveMessagingService: mockProactiveMessaging,
      telemetryClient: mockTelemetryClient,
      githubClient: mockGithubClient,
    });

    const result = await service.processAndNotify({
      alert: baseAlert,
      repository: baseRepository,
      notifyAllMembers: true,
    });

    // security-dave should appear only once even though they're in both lists
    assert.strictEqual(result.githubLogins.length, 2);
    assert.ok(result.githubLogins.includes('security-dave'));
    assert.ok(result.githubLogins.includes('member-alice'));
    console.log('✅ PASSED\n');
  } catch (error) {
    console.error(`❌ FAILED: ${error.message}\n`);
    process.exit(1);
  }
})();

// ── Wait for async tests ─────────────────────────────────────────────────────
setTimeout(() => {
  console.log('🎉 All Dependabot Notification Service tests passed!');
}, 500);
