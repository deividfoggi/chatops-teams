/**
 * Integration Tests for Commit Author Identification in Webhooks
 * 
 * Tests the integration between webhook handlers and commit author identification.
 */

const assert = require('assert');
const { routeWebhookEvent, handleCodeScanningAlert } = require('./webhookHandlers');

console.log('Running Commit Author Integration Tests...\n');

// Mock GitHub client
class MockGitHubClient {
  constructor(responses) {
    this.responses = responses || {};
  }

  async getCommit(owner, repo, sha) {
    if (this.responses[sha]) {
      return this.responses[sha];
    }
    throw new Error(`Commit not found: ${sha}`);
  }
}

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

// Test 1: Code scanning alert with commit author identification
console.log('Test 1: Code scanning alert with commit author');
(async () => {
  try {
    const mockClient = new MockGitHubClient({
      'abc123def456': {
        sha: 'abc123def456',
        commit: {
          message: 'Add new feature',
          author: {
            name: 'John Doe',
            email: 'john@example.com',
            date: '2024-01-01T12:00:00Z',
          },
          committer: {
            name: 'John Doe',
            email: 'john@example.com',
            date: '2024-01-01T12:00:00Z',
          },
        },
        author: {
          login: 'johndoe',
          id: 12345,
          type: 'User',
        },
        committer: {
          login: 'johndoe',
          id: 12345,
          type: 'User',
        },
        parents: [{ sha: 'parent1', url: 'https://api.github.com/repos/test-org/test-repo/commits/parent1' }],
      },
    });

    const payload = {
      action: 'created',
      alert: {
        number: 42,
        state: 'open',
        rule: {
          severity: 'high',
          description: 'SQL injection vulnerability',
        },
        most_recent_instance: {
          commit_sha: 'abc123def456',
        },
      },
      repository: {
        full_name: 'test-org/test-repo',
      },
      sender: {
        login: 'test-user',
      },
    };

    const result = await handleCodeScanningAlert(payload, mockTelemetryClient, mockClient);

    assert.strictEqual(result.status, 'processed');
    assert.strictEqual(result.eventType, 'code_scanning_alert');
    assert.ok(result.authorIdentification, 'Should have author identification');
    assert.strictEqual(result.authorIdentification.success, true);
    assert.strictEqual(result.authorIdentification.commitSha, 'abc123def456');
    assert.strictEqual(result.authorIdentification.primaryAuthor.githubLogin, 'johndoe');
    assert.strictEqual(result.authorIdentification.primaryAuthor.githubId, 12345);
    assert.strictEqual(result.authorIdentification.isBotCommit, false);
    assert.strictEqual(result.authorIdentification.isMergeCommit, false);

    console.log('✅ Code scanning alert with commit author test passed\n');
  } catch (error) {
    console.error('❌ Commit author integration test failed:', error.message);
    process.exit(1);
  }
})();

// Test 2: Code scanning alert with bot commit
console.log('Test 2: Code scanning alert with bot commit');
setTimeout(async () => {
  try {
    const mockClient = new MockGitHubClient({
      'bot456def789': {
        sha: 'bot456def789',
        commit: {
          message: 'Update dependencies',
          author: {
            name: 'dependabot[bot]',
            email: 'dependabot[bot]@users.noreply.github.com',
            date: '2024-01-01T12:00:00Z',
          },
          committer: {
            name: 'GitHub',
            email: 'noreply@github.com',
            date: '2024-01-01T12:00:00Z',
          },
        },
        author: {
          login: 'dependabot[bot]',
          id: 49699333,
          type: 'Bot',
        },
        committer: null,
        parents: [{ sha: 'parent1', url: 'https://api.github.com/repos/test-org/test-repo/commits/parent1' }],
      },
    });

    const payload = {
      action: 'created',
      alert: {
        number: 43,
        state: 'open',
        rule: {
          severity: 'medium',
          description: 'Dependency vulnerability',
        },
        most_recent_instance: {
          commit_sha: 'bot456def789',
        },
      },
      repository: {
        full_name: 'test-org/test-repo',
      },
      sender: {
        login: 'dependabot[bot]',
      },
    };

    const result = await handleCodeScanningAlert(payload, mockTelemetryClient, mockClient);

    assert.strictEqual(result.status, 'processed');
    assert.ok(result.authorIdentification);
    assert.strictEqual(result.authorIdentification.success, true);
    assert.strictEqual(result.authorIdentification.isBotCommit, true);
    assert.strictEqual(result.authorIdentification.authors[0].githubLogin, 'dependabot[bot]');
    assert.strictEqual(result.authorIdentification.authors[0].isBot, true);

    console.log('✅ Code scanning alert with bot commit test passed\n');
  } catch (error) {
    console.error('❌ Bot commit integration test failed:', error.message);
    process.exit(1);
  }
}, 100);

// Test 3: Code scanning alert without commit SHA
console.log('Test 3: Code scanning alert without commit SHA');
setTimeout(async () => {
  try {
    const mockClient = new MockGitHubClient({});

    const payload = {
      action: 'created',
      alert: {
        number: 44,
        state: 'open',
        rule: {
          severity: 'low',
          description: 'Code quality issue',
        },
        most_recent_instance: {
          // No commit_sha
        },
      },
      repository: {
        full_name: 'test-org/test-repo',
      },
      sender: {
        login: 'test-user',
      },
    };

    const result = await handleCodeScanningAlert(payload, mockTelemetryClient, mockClient);

    assert.strictEqual(result.status, 'processed');
    assert.ok(result.authorIdentification);
    assert.strictEqual(result.authorIdentification.success, false);
    assert.strictEqual(result.authorIdentification.reason, 'no_commit_sha');

    console.log('✅ Code scanning alert without commit SHA test passed\n');
  } catch (error) {
    console.error('❌ No commit SHA test failed:', error.message);
    process.exit(1);
  }
}, 200);

// Test 4: Code scanning alert without GitHub client
console.log('Test 4: Code scanning alert without GitHub client');
setTimeout(async () => {
  try {
    const payload = {
      action: 'created',
      alert: {
        number: 45,
        state: 'open',
        rule: {
          severity: 'high',
          description: 'Security issue',
        },
        most_recent_instance: {
          commit_sha: 'abc123',
        },
      },
      repository: {
        full_name: 'test-org/test-repo',
      },
      sender: {
        login: 'test-user',
      },
    };

    // Call without GitHub client (backwards compatibility)
    const result = await handleCodeScanningAlert(payload, mockTelemetryClient);

    assert.strictEqual(result.status, 'processed');
    assert.strictEqual(result.authorIdentification, undefined);

    console.log('✅ Code scanning alert without GitHub client test passed\n');
  } catch (error) {
    console.error('❌ Without GitHub client test failed:', error.message);
    process.exit(1);
  }
}, 300);

// Test 5: Route webhook event with GitHub client
console.log('Test 5: Route webhook event with GitHub client');
setTimeout(async () => {
  try {
    const mockClient = new MockGitHubClient({
      'merge789': {
        sha: 'merge789',
        commit: {
          message: 'Merge pull request #100',
          author: {
            name: 'Jane Smith',
            email: 'jane@example.com',
            date: '2024-01-01T12:00:00Z',
          },
          committer: {
            name: 'GitHub',
            email: 'noreply@github.com',
            date: '2024-01-01T12:00:00Z',
          },
        },
        author: {
          login: 'janesmith',
          id: 54321,
          type: 'User',
        },
        committer: {
          login: 'web-flow',
          id: 19864447,
          type: 'User',
        },
        parents: [
          { sha: 'parent1', url: 'https://api.github.com/repos/test-org/test-repo/commits/parent1' },
          { sha: 'parent2', url: 'https://api.github.com/repos/test-org/test-repo/commits/parent2' },
        ],
      },
    });

    const payload = {
      action: 'reopened',
      alert: {
        number: 46,
        rule: {
          severity: 'critical',
        },
        most_recent_instance: {
          commit_sha: 'merge789',
        },
      },
      repository: {
        full_name: 'test-org/test-repo',
      },
    };

    const result = await routeWebhookEvent('code_scanning_alert', payload, mockTelemetryClient, mockClient);

    assert.strictEqual(result.status, 'processed');
    assert.ok(result.authorIdentification);
    assert.strictEqual(result.authorIdentification.success, true);
    assert.strictEqual(result.authorIdentification.isMergeCommit, true);
    assert.strictEqual(result.authorIdentification.primaryAuthor.githubLogin, 'janesmith');

    console.log('✅ Route webhook event with GitHub client test passed\n');
  } catch (error) {
    console.error('❌ Route webhook test failed:', error.message);
    process.exit(1);
  }
}, 400);

// Test 6: GitHub API error handling
console.log('Test 6: GitHub API error handling');
setTimeout(async () => {
  try {
    const mockClient = new MockGitHubClient({}); // No responses, will throw error

    const payload = {
      action: 'created',
      alert: {
        number: 47,
        rule: {
          severity: 'high',
        },
        most_recent_instance: {
          commit_sha: 'nonexistent',
        },
      },
      repository: {
        full_name: 'test-org/test-repo',
      },
    };

    const result = await handleCodeScanningAlert(payload, mockTelemetryClient, mockClient);

    assert.strictEqual(result.status, 'processed');
    assert.ok(result.authorIdentification);
    assert.strictEqual(result.authorIdentification.success, false);
    assert.strictEqual(result.authorIdentification.reason, 'api_error');

    console.log('✅ GitHub API error handling test passed\n');
  } catch (error) {
    console.error('❌ API error handling test failed:', error.message);
    process.exit(1);
  }
}, 500);

// Wait for all async tests to complete
setTimeout(() => {
  console.log('✅ All Commit Author Integration tests passed!\n');
  console.log('Integration verified:');
  console.log('  ✓ Webhook handlers identify commit authors');
  console.log('  ✓ Bot commits are detected');
  console.log('  ✓ Merge commits are handled');
  console.log('  ✓ Missing SHA handled gracefully');
  console.log('  ✓ Backwards compatible (works without GitHub client)');
  console.log('  ✓ API errors handled gracefully\n');
  process.exit(0);
}, 600);
