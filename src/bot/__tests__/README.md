# Test Infrastructure

This directory contains the automated test infrastructure for the ChatOps Teams bot.

## Test Organization

Tests are organized into three categories:

### 1. Unit Tests
Test individual functions and modules in isolation with mocked dependencies.

**Files:**
- `test.js` - Basic bot functionality tests
- `webhookValidator.test.js` - Webhook signature validation
- `alertSeverityFilter.test.js` - Alert filtering and severity logic

**Run:** `npm run test:unit`

### 2. Integration Tests
Test API endpoints and service integrations with webhook handlers.

**Files:**
- `webhookHandlers.test.js` - GitHub webhook event routing and handlers
- `commitAuthorIntegration.test.js` - GitHub API integration for commit author identification

**Run:** `npm run test:integration`

### 3. Performance Tests
Validate response time benchmarks and concurrent request handling.

**Files:**
- `webhookPerformance.test.js` - Webhook processing latency validation (< 500ms requirement)

**Run:** `npm run test:performance`

## Running Tests

### All Tests
```bash
npm test
# or
npm run test:all
```

### By Category
```bash
npm run test:unit           # Run only unit tests
npm run test:integration    # Run only integration tests
npm run test:performance    # Run only performance tests
```

### With Coverage
```bash
npm run test:coverage
```

Coverage thresholds:
- Lines: 80%
- Functions: 80%
- Branches: 80%

**Note:** Coverage enforcement is currently informational while test coverage is being improved.

## Test Fixtures

Sample webhook payloads are stored in `__tests__/fixtures/`:
- `code-scanning-alert.json` - Code scanning alert webhook payload
- `dependabot-alert.json` - Dependabot alert webhook payload
- `deployment-created.json` - Deployment webhook payload

## CI/CD Integration

Tests run automatically in GitHub Actions on every pull request:

1. **Unit tests** execute first to validate core functionality
2. **Integration tests** validate API interactions and webhook handling
3. **Performance tests** ensure latency requirements are met (< 500ms)
4. **Coverage report** is generated and displayed in PR comments

### CI Workflow Steps

```yaml
- Run linter
- Run unit tests
- Run integration tests
- Run performance tests
- Generate coverage report
- Post results to PR
```

## Writing Tests

### Test File Structure

```javascript
/**
 * Test file description
 */

const assert = require('assert');
const { functionToTest } = require('./module');

console.log('Running tests for module...\n');

// Test 1: Description
console.log('Test 1: Description');
try {
  // Test code
  assert.strictEqual(actual, expected);
  console.log('✅ Test passed\n');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}

// More tests...
console.log('🎉 All tests passed!');
```

### Mocking External Dependencies

Mock GitHub API, Teams API, and Azure services in tests:

```javascript
// Mock GitHub client
const mockGitHubClient = {
  getCommit: async (owner, repo, sha) => {
    return mockCommitData;
  },
};

// Mock telemetry client
const mockTelemetryClient = {
  trackEvent: () => {},
  trackMetric: () => {},
  trackException: () => {},
};
```

### Async Tests with Timeouts

Use `setTimeout` for async test coordination:

```javascript
setTimeout(async () => {
  try {
    const result = await asyncFunction();
    assert.strictEqual(result, expected);
    console.log('✅ Test passed\n');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}, 100); // Delay to ensure test execution order
```

## Test Runner

The `test-runner.js` orchestrates test execution:
- Runs tests by category
- Captures output and exit codes
- Generates formatted summary
- Provides color-coded results

## Coverage Reports

Coverage reports are generated using `c8`:
- **Text report** displayed in console
- **LCOV report** for tooling integration
- **JSON summary** for programmatic access

Reports are uploaded as artifacts in CI for 30 days.

## Performance Requirements

From Epic 1 Success Metrics:
- **Webhook processing latency:** < 500ms from trigger to bot processing
- **Concurrent webhooks:** Must handle multiple simultaneous requests
- **Signature validation:** < 50ms per request

These requirements are validated in `webhookPerformance.test.js`.
