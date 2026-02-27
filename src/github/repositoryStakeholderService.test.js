/**
 * Tests for Repository Stakeholder Service
 * 
 * Tests repository owner and security champion identification.
 */

const assert = require('assert');
const RepositoryStakeholderService = require('./repositoryStakeholderService');

console.log('Running Repository Stakeholder Service tests...\n');

// Mock GitHub client
class MockGitHubClient {
  constructor(mockData = {}) {
    this.mockData = mockData;
  }

  async getRepositoryCustomProperties(owner, repo) {
    if (this.mockData.customPropertiesError) {
      throw new Error('Custom properties not available');
    }
    return this.mockData.customProperties || null;
  }

  async getFileContent(owner, repo, path) {
    if (path === 'CODEOWNERS' && this.mockData.codeowners) {
      return this.mockData.codeowners;
    }
    throw new Error('File not found');
  }

  async getRepositoryAdmins(owner, repo) {
    return this.mockData.admins || [];
  }

  async getRepositoryTopics(owner, repo) {
    return this.mockData.topics || [];
  }
}

// Mock cache
class MockCache {
  constructor() {
    this.data = new Map();
  }

  async get(key) {
    return this.data.get(key) || null;
  }

  async set(key, value, ttl) {
    this.data.set(key, value);
  }

  clear() {
    this.data.clear();
  }
}

// Test 1: Get repository owners from custom properties
console.log('Test 1: Get repository owners from custom properties');
(async () => {
  try {
    const mockGitHub = new MockGitHubClient({
      customProperties: {
        owner_1: 'alice',
        owner_2: 'bob',
      },
    });

    const service = new RepositoryStakeholderService({
      githubClient: mockGitHub,
      cache: new MockCache(),
    });

    const owners = await service.getRepositoryOwners('test-org', 'test-repo');

    assert.strictEqual(owners.length, 2);
    assert.strictEqual(owners[0].github_login, 'alice');
    assert.strictEqual(owners[0].source, 'custom_property');
    assert.strictEqual(owners[1].github_login, 'bob');
    assert.strictEqual(owners[1].source, 'custom_property');

    console.log('✅ PASSED\n');
  } catch (error) {
    console.error(`❌ FAILED: ${error.message}\n`);
    process.exit(1);
  }
})();

// Test 2: Get repository owners from CODEOWNERS file
setTimeout(async () => {
  console.log('Test 2: Get repository owners from CODEOWNERS file');
  try {
    const mockGitHub = new MockGitHubClient({
      customPropertiesError: true,
      codeowners: '# Default owners\n* @charlie @dave\n',
    });

    const service = new RepositoryStakeholderService({
      githubClient: mockGitHub,
      cache: new MockCache(),
    });

    const owners = await service.getRepositoryOwners('test-org', 'test-repo');

    assert.strictEqual(owners.length, 2);
    assert.strictEqual(owners[0].github_login, 'charlie');
    assert.strictEqual(owners[0].source, 'codeowners');
    assert.strictEqual(owners[1].github_login, 'dave');
    assert.strictEqual(owners[1].source, 'codeowners');

    console.log('✅ PASSED\n');
  } catch (error) {
    console.error(`❌ FAILED: ${error.message}\n`);
    process.exit(1);
  }
}, 100);

// Test 3: Fall back to repository admins
setTimeout(async () => {
  console.log('Test 3: Fall back to repository admins');
  try {
    const mockGitHub = new MockGitHubClient({
      customPropertiesError: true,
      admins: [
        { login: 'eve', permissions: { admin: true } },
        { login: 'frank', permissions: { admin: true } },
      ],
    });

    const service = new RepositoryStakeholderService({
      githubClient: mockGitHub,
      cache: new MockCache(),
    });

    const owners = await service.getRepositoryOwners('test-org', 'test-repo');

    assert.strictEqual(owners.length, 2);
    assert.strictEqual(owners[0].github_login, 'eve');
    assert.strictEqual(owners[0].source, 'admin');
    assert.strictEqual(owners[1].github_login, 'frank');
    assert.strictEqual(owners[1].source, 'admin');

    console.log('✅ PASSED\n');
  } catch (error) {
    console.error(`❌ FAILED: ${error.message}\n`);
    process.exit(1);
  }
}, 200);

// Test 4: Get security champion from custom properties
setTimeout(async () => {
  console.log('Test 4: Get security champion from custom properties');
  try {
    const mockGitHub = new MockGitHubClient({
      customProperties: {
        security_champion: 'security-alice',
      },
    });

    const service = new RepositoryStakeholderService({
      githubClient: mockGitHub,
      cache: new MockCache(),
    });

    const champion = await service.getSecurityChampion('test-org', 'test-repo');

    assert.strictEqual(champion.github_login, 'security-alice');
    assert.strictEqual(champion.source, 'custom_property');

    console.log('✅ PASSED\n');
  } catch (error) {
    console.error(`❌ FAILED: ${error.message}\n`);
    process.exit(1);
  }
}, 300);

// Test 5: Get security champion from repository topics
setTimeout(async () => {
  console.log('Test 5: Get security champion from repository topics');
  try {
    const mockGitHub = new MockGitHubClient({
      customPropertiesError: true,
      topics: ['javascript', 'security-champion:@security-bob', 'nodejs'],
    });

    const service = new RepositoryStakeholderService({
      githubClient: mockGitHub,
      cache: new MockCache(),
    });

    const champion = await service.getSecurityChampion('test-org', 'test-repo');

    assert.strictEqual(champion.github_login, 'security-bob');
    assert.strictEqual(champion.source, 'topic');

    console.log('✅ PASSED\n');
  } catch (error) {
    console.error(`❌ FAILED: ${error.message}\n`);
    process.exit(1);
  }
}, 400);

// Test 6: No security champion found
setTimeout(async () => {
  console.log('Test 6: No security champion found');
  try {
    const mockGitHub = new MockGitHubClient({
      customPropertiesError: true,
      topics: ['javascript', 'nodejs'],
    });

    const service = new RepositoryStakeholderService({
      githubClient: mockGitHub,
      cache: new MockCache(),
    });

    const champion = await service.getSecurityChampion('test-org', 'test-repo');

    assert.strictEqual(champion, null);

    console.log('✅ PASSED\n');
  } catch (error) {
    console.error(`❌ FAILED: ${error.message}\n`);
    process.exit(1);
  }
}, 500);

// Test 7: Get all stakeholders
setTimeout(async () => {
  console.log('Test 7: Get all stakeholders');
  try {
    const mockGitHub = new MockGitHubClient({
      customProperties: {
        owner_1: 'alice',
        owner_2: 'bob',
        security_champion: 'security-alice',
      },
    });

    const service = new RepositoryStakeholderService({
      githubClient: mockGitHub,
      cache: new MockCache(),
    });

    const stakeholders = await service.getAllStakeholders('test-org', 'test-repo');

    assert.strictEqual(stakeholders.owners.length, 2);
    assert.strictEqual(stakeholders.securityChampion.github_login, 'security-alice');
    assert.strictEqual(stakeholders.repository, 'test-org/test-repo');

    console.log('✅ PASSED\n');
    console.log('All Repository Stakeholder Service tests passed! ✅');
  } catch (error) {
    console.error(`❌ FAILED: ${error.message}\n`);
    process.exit(1);
  }
}, 600);
