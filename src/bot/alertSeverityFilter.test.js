/**
 * Tests for Code Scanning Alert Severity Filter
 * 
 * Tests severity filtering logic, metadata extraction, and configuration overrides.
 */

const assert = require('assert');
const {
  shouldEscalateAlert,
  extractCWEIds,
  extractCVEIds,
  extractCVSSScore,
  extractAffectedFiles,
  extractAlertMetadata,
  processCodeScanningAlert,
  setConfiguration,
  getConfiguration,
  resetConfiguration,
  getRepositorySeverityThreshold,
  SEVERITY_LEVELS,
} = require('./alertSeverityFilter');

console.log('Running Alert Severity Filter tests...\n');

// Helper to run async tests
function runTest(testName, testFn) {
  console.log(`Test: ${testName}`);
  try {
    const result = testFn();
    if (result instanceof Promise) {
      return result
        .then(() => {
          console.log('✅ PASSED\n');
        })
        .catch((error) => {
          console.error(`❌ FAILED: ${error.message}\n`);
          process.exit(1);
        });
    } else {
      console.log('✅ PASSED\n');
    }
  } catch (error) {
    console.error(`❌ FAILED: ${error.message}\n`);
    process.exit(1);
  }
}

// Reset configuration before each test
function beforeEach() {
  resetConfiguration();
}

// Test 1: Critical severity should escalate
runTest('Critical severity should escalate', () => {
  beforeEach();
  const result = shouldEscalateAlert('critical', 'test-org/test-repo');
  assert.strictEqual(result, true);
});

// Test 2: High severity should escalate
runTest('High severity should escalate', () => {
  beforeEach();
  const result = shouldEscalateAlert('high', 'test-org/test-repo');
  assert.strictEqual(result, true);
});

// Test 3: Medium severity should not escalate by default
runTest('Medium severity should not escalate by default', () => {
  beforeEach();
  const result = shouldEscalateAlert('medium', 'test-org/test-repo');
  assert.strictEqual(result, false);
});

// Test 4: Low severity should not escalate
runTest('Low severity should not escalate', () => {
  beforeEach();
  const result = shouldEscalateAlert('low', 'test-org/test-repo');
  assert.strictEqual(result, false);
});

// Test 5: Warning severity should not escalate
runTest('Warning severity should not escalate', () => {
  beforeEach();
  const result = shouldEscalateAlert('warning', 'test-org/test-repo');
  assert.strictEqual(result, false);
});

// Test 6: Note severity should not escalate
runTest('Note severity should not escalate', () => {
  beforeEach();
  const result = shouldEscalateAlert('note', 'test-org/test-repo');
  assert.strictEqual(result, false);
});

// Test 7: Error severity should escalate (mapped to high)
runTest('Error severity should escalate (mapped to high)', () => {
  beforeEach();
  const result = shouldEscalateAlert('error', 'test-org/test-repo');
  assert.strictEqual(result, true);
});

// Test 8: Case insensitive severity checking
runTest('Case insensitive severity checking', () => {
  beforeEach();
  assert.strictEqual(shouldEscalateAlert('CRITICAL', 'test-org/test-repo'), true);
  assert.strictEqual(shouldEscalateAlert('High', 'test-org/test-repo'), true);
  assert.strictEqual(shouldEscalateAlert('Medium', 'test-org/test-repo'), false);
});

// Test 9: Unknown severity should not escalate
runTest('Unknown severity should not escalate', () => {
  beforeEach();
  const result = shouldEscalateAlert('unknown-severity', 'test-org/test-repo');
  assert.strictEqual(result, false);
});

// Test 10: Null/undefined severity should not escalate
runTest('Null/undefined severity should not escalate', () => {
  beforeEach();
  assert.strictEqual(shouldEscalateAlert(null, 'test-org/test-repo'), false);
  assert.strictEqual(shouldEscalateAlert(undefined, 'test-org/test-repo'), false);
});

// Test 11: Repository-specific override - lower threshold
runTest('Repository-specific override - lower threshold to medium', () => {
  beforeEach();
  setConfiguration({
    repositoryOverrides: {
      'test-org/critical-repo': {
        minEscalationSeverity: 'medium',
      },
    },
  });

  // Medium should now escalate for this specific repo
  assert.strictEqual(shouldEscalateAlert('medium', 'test-org/critical-repo'), true);
  
  // But not for other repos
  assert.strictEqual(shouldEscalateAlert('medium', 'test-org/other-repo'), false);
});

// Test 12: Repository-specific override - higher threshold
runTest('Repository-specific override - higher threshold to critical', () => {
  beforeEach();
  setConfiguration({
    repositoryOverrides: {
      'test-org/low-priority-repo': {
        minEscalationSeverity: 'critical',
      },
    },
  });

  // High should not escalate for this repo
  assert.strictEqual(shouldEscalateAlert('high', 'test-org/low-priority-repo'), false);
  
  // Critical should still escalate
  assert.strictEqual(shouldEscalateAlert('critical', 'test-org/low-priority-repo'), true);
  
  // High should escalate for other repos (default)
  assert.strictEqual(shouldEscalateAlert('high', 'test-org/other-repo'), true);
});

// Test 13: Extract CWE IDs from rule tags
runTest('Extract CWE IDs from rule tags', () => {
  beforeEach();
  const alert = {
    rule: {
      tags: ['external/cwe/cwe-89', 'security', 'external/cwe/cwe-79'],
    },
  };

  const cweIds = extractCWEIds(alert);
  assert.deepStrictEqual(cweIds, ['CWE-89', 'CWE-79']);
});

// Test 14: Extract CWE IDs from rule help text
runTest('Extract CWE IDs from rule help text', () => {
  beforeEach();
  const alert = {
    rule: {
      help: 'This vulnerability is classified as CWE-89 (SQL Injection) and CWE 79 (XSS)',
      tags: [],
    },
  };

  const cweIds = extractCWEIds(alert);
  assert.ok(cweIds.includes('CWE-89'));
  assert.ok(cweIds.includes('CWE-79'));
});

// Test 15: Extract CWE IDs - no duplicates
runTest('Extract CWE IDs - no duplicates', () => {
  beforeEach();
  const alert = {
    rule: {
      tags: ['external/cwe/cwe-89'],
      help: 'CWE-89 is a serious vulnerability',
    },
  };

  const cweIds = extractCWEIds(alert);
  assert.strictEqual(cweIds.filter((id) => id === 'CWE-89').length, 1);
});

// Test 16: Extract CVE IDs from rule tags
runTest('Extract CVE IDs from rule tags', () => {
  beforeEach();
  const alert = {
    rule: {
      tags: ['external/cve/cve-2021-44228', 'external/cve/cve-2022-12345'],
    },
  };

  const cveIds = extractCVEIds(alert);
  assert.deepStrictEqual(cveIds, ['CVE-2021-44228', 'CVE-2022-12345']);
});

// Test 17: Extract CVE IDs from rule description
runTest('Extract CVE IDs from rule description', () => {
  beforeEach();
  const alert = {
    rule: {
      description: 'Log4Shell vulnerability CVE-2021-44228 detected',
      tags: [],
    },
  };

  const cveIds = extractCVEIds(alert);
  assert.ok(cveIds.includes('CVE-2021-44228'));
});

// Test 18: Extract CVSS score from security_severity_level
runTest('Extract CVSS score from security_severity_level', () => {
  beforeEach();
  const alert = {
    rule: {
      security_severity_level: '8.5',
    },
  };

  const score = extractCVSSScore(alert);
  assert.strictEqual(score, 8.5);
});

// Test 19: Extract CVSS score from tags
runTest('Extract CVSS score from tags', () => {
  beforeEach();
  const alert = {
    rule: {
      tags: ['cvss:7.2', 'security'],
    },
  };

  const score = extractCVSSScore(alert);
  assert.strictEqual(score, 7.2);
});

// Test 20: Extract CVSS score returns null when not available
runTest('Extract CVSS score returns null when not available', () => {
  beforeEach();
  const alert = {
    rule: {
      tags: ['security'],
    },
  };

  const score = extractCVSSScore(alert);
  assert.strictEqual(score, null);
});

// Test 21: Extract affected files from most_recent_instance
runTest('Extract affected files from most_recent_instance', () => {
  beforeEach();
  const alert = {
    most_recent_instance: {
      location: {
        path: 'src/main/java/App.java',
        start_line: 42,
        end_line: 45,
        start_column: 10,
        end_column: 20,
      },
    },
  };

  const files = extractAffectedFiles(alert);
  assert.strictEqual(files.length, 1);
  assert.strictEqual(files[0].path, 'src/main/java/App.java');
  assert.strictEqual(files[0].startLine, 42);
  assert.strictEqual(files[0].endLine, 45);
});

// Test 22: Extract affected files from instances array
runTest('Extract affected files from instances array', () => {
  beforeEach();
  const alert = {
    instances: [
      {
        location: {
          path: 'src/file1.js',
          start_line: 10,
        },
      },
      {
        location: {
          path: 'src/file2.js',
          start_line: 20,
        },
      },
    ],
  };

  const files = extractAffectedFiles(alert);
  assert.strictEqual(files.length, 2);
  assert.strictEqual(files[0].path, 'src/file1.js');
  assert.strictEqual(files[1].path, 'src/file2.js');
});

// Test 23: Extract comprehensive metadata
runTest('Extract comprehensive metadata', () => {
  beforeEach();
  const alert = {
    rule: {
      id: 'sql-injection',
      name: 'SQL Injection vulnerability',
      severity: 'high',
      description: 'Potential SQL injection vulnerability',
      tags: ['external/cwe/cwe-89', 'security'],
      security_severity_level: '8.1',
    },
    state: 'open',
    most_recent_instance: {
      location: {
        path: 'src/db.js',
        start_line: 100,
      },
    },
  };

  const metadata = extractAlertMetadata(alert);
  
  assert.deepStrictEqual(metadata.cweIds, ['CWE-89']);
  assert.strictEqual(metadata.cvssScore, 8.1);
  assert.strictEqual(metadata.severity, 'high');
  assert.strictEqual(metadata.description, 'Potential SQL injection vulnerability');
  assert.strictEqual(metadata.ruleId, 'sql-injection');
  assert.strictEqual(metadata.state, 'open');
  assert.strictEqual(metadata.affectedFiles.length, 1);
  assert.strictEqual(metadata.affectedFiles[0].path, 'src/db.js');
});

// Test 24: Process alert - should escalate
runTest('Process alert - should escalate critical alert', () => {
  beforeEach();
  const alert = {
    rule: {
      severity: 'critical',
      description: 'Critical vulnerability',
    },
  };

  const result = processCodeScanningAlert(alert, 'test-org/test-repo');
  
  assert.strictEqual(result.shouldEscalate, true);
  assert.strictEqual(result.severity, 'critical');
  assert.strictEqual(result.repository, 'test-org/test-repo');
  assert.ok(result.reason.includes('meets or exceeds threshold'));
  assert.ok(result.metadata);
});

// Test 25: Process alert - should not escalate
runTest('Process alert - should not escalate medium alert', () => {
  beforeEach();
  const alert = {
    rule: {
      severity: 'medium',
      description: 'Medium severity issue',
    },
  };

  const result = processCodeScanningAlert(alert, 'test-org/test-repo');
  
  assert.strictEqual(result.shouldEscalate, false);
  assert.strictEqual(result.severity, 'medium');
  assert.ok(result.reason.includes('below threshold'));
});

// Test 26: Get configuration
runTest('Get configuration returns current settings', () => {
  beforeEach();
  setConfiguration({
    minEscalationSeverity: 'medium',
    repositoryOverrides: {
      'test-org/repo': { minEscalationSeverity: 'critical' },
    },
  });

  const config = getConfiguration();
  assert.strictEqual(config.minEscalationSeverity, 'medium');
  assert.ok(config.repositoryOverrides['test-org/repo']);
});

// Test 27: Get repository severity threshold - with override
runTest('Get repository severity threshold - with override', () => {
  beforeEach();
  setConfiguration({
    minEscalationSeverity: 'high',
    repositoryOverrides: {
      'test-org/special-repo': { minEscalationSeverity: 'medium' },
    },
  });

  const threshold = getRepositorySeverityThreshold('test-org/special-repo');
  assert.strictEqual(threshold, 'medium');
});

// Test 28: Get repository severity threshold - without override
runTest('Get repository severity threshold - without override', () => {
  beforeEach();
  setConfiguration({
    minEscalationSeverity: 'high',
  });

  const threshold = getRepositorySeverityThreshold('test-org/normal-repo');
  assert.strictEqual(threshold, 'high');
});

// Test 29: Reset configuration
runTest('Reset configuration restores defaults', () => {
  beforeEach();
  setConfiguration({
    minEscalationSeverity: 'medium',
    repositoryOverrides: { 'test-org/repo': { minEscalationSeverity: 'low' } },
  });

  resetConfiguration();
  
  const config = getConfiguration();
  assert.strictEqual(config.minEscalationSeverity, 'high');
  assert.deepStrictEqual(config.repositoryOverrides, {});
});

// Test 30: SEVERITY_LEVELS constant
runTest('SEVERITY_LEVELS constant has correct mappings', () => {
  assert.strictEqual(SEVERITY_LEVELS.critical, 4);
  assert.strictEqual(SEVERITY_LEVELS.high, 3);
  assert.strictEqual(SEVERITY_LEVELS.medium, 2);
  assert.strictEqual(SEVERITY_LEVELS.low, 1);
  assert.strictEqual(SEVERITY_LEVELS.warning, 1);
  assert.strictEqual(SEVERITY_LEVELS.note, 0);
  assert.strictEqual(SEVERITY_LEVELS.error, 3);
});

// Wait for all tests to complete
setTimeout(() => {
  console.log('🎉 All Alert Severity Filter tests passed!');
  console.log('\nTest Coverage:');
  console.log('- Severity escalation logic: ✅');
  console.log('- Configuration overrides: ✅');
  console.log('- CWE/CVE extraction: ✅');
  console.log('- CVSS score extraction: ✅');
  console.log('- Affected file extraction: ✅');
  console.log('- Comprehensive metadata extraction: ✅');
  console.log('- Alert processing: ✅');
}, 100);
