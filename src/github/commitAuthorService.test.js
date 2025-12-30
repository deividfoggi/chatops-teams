/**
 * Tests for Commit Author Identification Service
 * 
 * Tests various scenarios of identifying commit authors from alerts.
 */

const assert = require('assert');
const { identifyCommitAuthor, identifyMultipleCommitAuthors, isBot } = require('./commitAuthorService');

console.log('Running Commit Author Service tests...\n');

// Mock GitHub client
class MockGitHubClient {
  constructor(responses) {
    this.responses = responses || {};
    this.callCount = 0;
  }

  async getCommit(owner, repo, sha) {
    this.callCount++;
    
    if (this.responses[sha]) {
      return this.responses[sha];
    }
    
    throw new Error(`Commit not found: ${sha}`);
  }
}

// Test 1: isBot function
console.log('Test 1: Bot detection');
try {
  assert.strictEqual(isBot({ login: 'dependabot[bot]', type: 'User' }), true);
  assert.strictEqual(isBot({ login: 'renovate[bot]', type: 'User' }), true);
  assert.strictEqual(isBot({ login: 'github-actions[bot]', type: 'Bot' }), true);
  assert.strictEqual(isBot({ login: 'snyk-bot', type: 'User' }), true);
  assert.strictEqual(isBot({ login: 'regular-user', type: 'User' }), false);
  assert.strictEqual(isBot({ login: 'johndoe', type: 'User' }), false);
  assert.strictEqual(isBot(null), false);
  
  console.log('✅ Bot detection test passed\n');
} catch (error) {
  console.error('❌ Bot detection test failed:', error.message);
  process.exit(1);
}

// Test 2: Single author commit identification
console.log('Test 2: Single author commit identification');
(async () => {
  try {
    const mockClient = new MockGitHubClient({
      'abc123': {
        sha: 'abc123',
        commit: {
          message: 'Fix security vulnerability',
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
        parents: [{ sha: 'parent1', url: 'https://api.github.com/repos/owner/repo/commits/parent1' }],
      },
    });

    const alert = {
      number: 1,
      most_recent_instance: {
        commit_sha: 'abc123',
      },
    };

    const repository = {
      full_name: 'owner/repo',
    };

    const result = await identifyCommitAuthor(alert, repository, mockClient);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.commitSha, 'abc123');
    assert.strictEqual(result.isBotCommit, false);
    assert.strictEqual(result.isMergeCommit, false);
    assert.strictEqual(result.authors.length, 1);
    assert.strictEqual(result.primaryAuthor.githubLogin, 'johndoe');
    assert.strictEqual(result.primaryAuthor.githubId, 12345);
    assert.strictEqual(result.primaryAuthor.gitName, 'John Doe');
    assert.strictEqual(result.primaryAuthor.gitEmail, 'john@example.com');
    assert.strictEqual(result.primaryAuthor.isBot, false);
    assert.strictEqual(result.primaryAuthor.role, 'author');

    console.log('✅ Single author commit identification test passed\n');
  } catch (error) {
    console.error('❌ Single author commit test failed:', error.message);
    process.exit(1);
  }
})();

// Test 3: Bot commit detection
console.log('Test 3: Bot commit detection');
setTimeout(async () => {
  try {
    const mockClient = new MockGitHubClient({
      'bot123': {
        sha: 'bot123',
        commit: {
          message: 'Bump dependencies',
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
          id: 99999,
          type: 'Bot',
        },
        committer: null,
        parents: [{ sha: 'parent1', url: 'https://api.github.com/repos/owner/repo/commits/parent1' }],
      },
    });

    const alert = {
      number: 2,
      most_recent_instance: {
        commit_sha: 'bot123',
      },
    };

    const repository = {
      full_name: 'owner/repo',
    };

    const result = await identifyCommitAuthor(alert, repository, mockClient);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isBotCommit, true);
    assert.strictEqual(result.authors.length, 1);
    assert.strictEqual(result.authors[0].githubLogin, 'dependabot[bot]');
    assert.strictEqual(result.authors[0].isBot, true);
    assert.ok(result.message.includes('Bot commit'));

    console.log('✅ Bot commit detection test passed\n');
  } catch (error) {
    console.error('❌ Bot commit test failed:', error.message);
    process.exit(1);
  }
}, 100);

// Test 4: Merge commit handling
console.log('Test 4: Merge commit handling');
setTimeout(async () => {
  try {
    const mockClient = new MockGitHubClient({
      'merge123': {
        sha: 'merge123',
        commit: {
          message: 'Merge pull request #42',
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
          { sha: 'parent1', url: 'https://api.github.com/repos/owner/repo/commits/parent1' },
          { sha: 'parent2', url: 'https://api.github.com/repos/owner/repo/commits/parent2' },
        ],
      },
    });

    const alert = {
      number: 3,
      most_recent_instance: {
        commit_sha: 'merge123',
      },
    };

    const repository = {
      full_name: 'owner/repo',
    };

    const result = await identifyCommitAuthor(alert, repository, mockClient);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isMergeCommit, true);
    assert.strictEqual(result.authors.length, 1);
    assert.strictEqual(result.primaryAuthor.githubLogin, 'janesmith');
    assert.strictEqual(result.primaryAuthor.role, 'merger');
    assert.ok(result.message.includes('Merge commit'));

    console.log('✅ Merge commit handling test passed\n');
  } catch (error) {
    console.error('❌ Merge commit test failed:', error.message);
    process.exit(1);
  }
}, 200);

// Test 5: Missing commit SHA
console.log('Test 5: Missing commit SHA fallback');
setTimeout(async () => {
  try {
    const mockClient = new MockGitHubClient({});

    const alert = {
      number: 4,
      most_recent_instance: {
        // No commit_sha
      },
    };

    const repository = {
      full_name: 'owner/repo',
    };

    const result = await identifyCommitAuthor(alert, repository, mockClient);

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.reason, 'no_commit_sha');
    assert.strictEqual(result.authors.length, 0);
    assert.ok(result.message.includes('No commit SHA'));

    console.log('✅ Missing commit SHA test passed\n');
  } catch (error) {
    console.error('❌ Missing commit SHA test failed:', error.message);
    process.exit(1);
  }
}, 300);

// Test 6: No GitHub user linked to commit
console.log('Test 6: No GitHub user linked to commit');
setTimeout(async () => {
  try {
    const mockClient = new MockGitHubClient({
      'nogithub123': {
        sha: 'nogithub123',
        commit: {
          message: 'Fix bug',
          author: {
            name: 'External Contributor',
            email: 'external@company.com',
            date: '2024-01-01T12:00:00Z',
          },
          committer: {
            name: 'External Contributor',
            email: 'external@company.com',
            date: '2024-01-01T12:00:00Z',
          },
        },
        author: null, // No GitHub account
        committer: null,
        parents: [{ sha: 'parent1', url: 'https://api.github.com/repos/owner/repo/commits/parent1' }],
      },
    });

    const alert = {
      number: 5,
      most_recent_instance: {
        commit_sha: 'nogithub123',
      },
    };

    const repository = {
      full_name: 'owner/repo',
    };

    const result = await identifyCommitAuthor(alert, repository, mockClient);

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.reason, 'no_github_user');
    assert.strictEqual(result.authors.length, 1);
    assert.strictEqual(result.authors[0].githubLogin, null);
    assert.strictEqual(result.authors[0].gitEmail, 'external@company.com');

    console.log('✅ No GitHub user test passed\n');
  } catch (error) {
    console.error('❌ No GitHub user test failed:', error.message);
    process.exit(1);
  }
}, 400);

// Test 7: GitHub API error
console.log('Test 7: GitHub API error handling');
setTimeout(async () => {
  try {
    const mockClient = new MockGitHubClient({}); // No responses defined

    const alert = {
      number: 6,
      most_recent_instance: {
        commit_sha: 'nonexistent',
      },
    };

    const repository = {
      full_name: 'owner/repo',
    };

    const result = await identifyCommitAuthor(alert, repository, mockClient);

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.reason, 'api_error');
    assert.strictEqual(result.authors.length, 0);
    assert.ok(result.error);
    assert.ok(result.message.includes('Failed'));

    console.log('✅ GitHub API error handling test passed\n');
  } catch (error) {
    console.error('❌ API error handling test failed:', error.message);
    process.exit(1);
  }
}, 500);

// Test 8: Multiple commit authors
console.log('Test 8: Multiple commit authors identification');
setTimeout(async () => {
  try {
    const mockClient = new MockGitHubClient({
      'commit1': {
        sha: 'commit1',
        commit: {
          author: {
            name: 'Alice',
            email: 'alice@example.com',
            date: '2024-01-01T12:00:00Z',
          },
        },
        author: {
          login: 'alice',
          id: 1,
          type: 'User',
        },
        parents: [{ sha: 'parent1' }],
      },
      'commit2': {
        sha: 'commit2',
        commit: {
          author: {
            name: 'Bob',
            email: 'bob@example.com',
            date: '2024-01-01T13:00:00Z',
          },
        },
        author: {
          login: 'bob',
          id: 2,
          type: 'User',
        },
        parents: [{ sha: 'parent2' }],
      },
      'commit3': {
        sha: 'commit3',
        commit: {
          author: {
            name: 'Alice',
            email: 'alice@example.com',
            date: '2024-01-01T14:00:00Z',
          },
        },
        author: {
          login: 'alice',
          id: 1,
          type: 'User',
        },
        parents: [{ sha: 'parent3' }],
      },
    });

    const commitShas = ['commit1', 'commit2', 'commit3'];
    const repository = { full_name: 'owner/repo' };

    const result = await identifyMultipleCommitAuthors(commitShas, repository, mockClient);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.commitCount, 3);
    assert.strictEqual(result.authors.length, 2); // Alice and Bob (Alice appears twice but counted once)
    
    const logins = result.authors.map(a => a.githubLogin).sort();
    assert.deepStrictEqual(logins, ['alice', 'bob']);

    console.log('✅ Multiple commit authors test passed\n');
  } catch (error) {
    console.error('❌ Multiple commit authors test failed:', error.message);
    process.exit(1);
  }
}, 600);

// Test 9: Multiple commits with failures
console.log('Test 9: Multiple commits with some failures');
setTimeout(async () => {
  try {
    const mockClient = new MockGitHubClient({
      'commit1': {
        sha: 'commit1',
        commit: {
          author: {
            name: 'Alice',
            email: 'alice@example.com',
            date: '2024-01-01T12:00:00Z',
          },
        },
        author: {
          login: 'alice',
          id: 1,
          type: 'User',
        },
        parents: [{ sha: 'parent1' }],
      },
      // commit2 will fail (not in responses)
    });

    const commitShas = ['commit1', 'commit2-nonexistent'];
    const repository = { full_name: 'owner/repo' };

    const result = await identifyMultipleCommitAuthors(commitShas, repository, mockClient);

    // Should succeed with partial results
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.commitCount, 2);
    assert.strictEqual(result.authors.length, 1); // Only Alice from commit1
    assert.strictEqual(result.authors[0].githubLogin, 'alice');

    console.log('✅ Multiple commits with failures test passed\n');
  } catch (error) {
    console.error('❌ Multiple commits with failures test failed:', error.message);
    process.exit(1);
  }
}, 700);

// Test 10: Empty commit list
console.log('Test 10: Empty commit list');
setTimeout(async () => {
  try {
    const mockClient = new MockGitHubClient({});
    const commitShas = [];
    const repository = { full_name: 'owner/repo' };

    const result = await identifyMultipleCommitAuthors(commitShas, repository, mockClient);

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.reason, 'no_commits');
    assert.strictEqual(result.authors.length, 0);

    console.log('✅ Empty commit list test passed\n');
  } catch (error) {
    console.error('❌ Empty commit list test failed:', error.message);
    process.exit(1);
  }
}, 800);

// Wait for all async tests to complete
setTimeout(() => {
  console.log('✅ All Commit Author Service tests passed!\n');
  process.exit(0);
}, 1000);
