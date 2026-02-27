#!/usr/bin/env node
/**
 * Comprehensive Test Runner
 * 
 * Executes all test files in the bot directory, categorizing them by type:
 * - Unit tests: Test individual functions/modules
 * - Integration tests: Test API endpoints and service integrations
 * - Performance tests: Validate response time benchmarks
 * 
 * Exit code 0: All tests passed
 * Exit code 1: One or more tests failed
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Test categories and their files
const testCategories = {
  unit: [
    'test.js',                        // Basic bot functionality
    'webhookValidator.test.js',       // Webhook validation
    'alertSeverityFilter.test.js',    // Alert filtering logic
    '../cards/codeScanningAlertCard.test.js',  // Code scanning alert card
    '../cards/dependabotAlertCard.test.js',    // Dependabot alert card
  ],
  integration: [
    'webhookHandlers.test.js',        // Webhook event handlers
    'commitAuthorIntegration.test.js', // GitHub integration
    'dependabotNotificationService.test.js', // Dependabot notification service
  ],
  performance: [
    'webhookPerformance.test.js',     // Performance benchmarks
  ],
};

// Test results
const results = {
  passed: [],
  failed: [],
  skipped: [],
};

/**
 * Run a test file and capture output
 */
function runTestFile(testFile) {
  const testPath = path.join(__dirname, testFile);
  
  // Check if test file exists
  if (!fs.existsSync(testPath)) {
    return {
      success: false,
      skipped: true,
      output: `Test file not found: ${testFile}`,
    };
  }

  console.log(`${colors.cyan}Running: ${testFile}${colors.reset}`);
  
  const result = spawnSync('node', [testPath], {
    encoding: 'utf-8',
    timeout: 30000, // 30 second timeout per test file
  });

  return {
    success: result.status === 0,
    skipped: false,
    output: result.stdout || result.stderr,
    error: result.error,
  };
}

/**
 * Run all tests in a category
 */
function runCategory(categoryName, testFiles) {
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}${categoryName.toUpperCase()} TESTS${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  let categoryPassed = 0;
  let categoryFailed = 0;
  let categorySkipped = 0;

  for (const testFile of testFiles) {
    const result = runTestFile(testFile);

    if (result.skipped) {
      categorySkipped++;
      results.skipped.push({ category: categoryName, file: testFile });
      console.log(`${colors.yellow}⊘ SKIPPED: ${testFile}${colors.reset}`);
      console.log(`  ${result.output}\n`);
    } else if (result.success) {
      categoryPassed++;
      results.passed.push({ category: categoryName, file: testFile });
      console.log(`${colors.green}✓ PASSED: ${testFile}${colors.reset}\n`);
    } else {
      categoryFailed++;
      results.failed.push({ category: categoryName, file: testFile, output: result.output });
      console.log(`${colors.red}✗ FAILED: ${testFile}${colors.reset}`);
      console.log(`${colors.red}${result.output}${colors.reset}\n`);
    }
  }

  console.log(`${colors.cyan}Category Summary: ${categoryPassed} passed, ${categoryFailed} failed, ${categorySkipped} skipped${colors.reset}\n`);

  return categoryFailed === 0;
}

/**
 * Print final summary
 */
function printSummary() {
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}TEST SUMMARY${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  const totalTests = results.passed.length + results.failed.length + results.skipped.length;
  
  console.log(`Total Tests: ${totalTests}`);
  console.log(`${colors.green}✓ Passed: ${results.passed.length}${colors.reset}`);
  console.log(`${colors.red}✗ Failed: ${results.failed.length}${colors.reset}`);
  console.log(`${colors.yellow}⊘ Skipped: ${results.skipped.length}${colors.reset}\n`);

  if (results.failed.length > 0) {
    console.log(`${colors.red}Failed Tests:${colors.reset}`);
    results.failed.forEach(({ category, file }) => {
      console.log(`  - ${category}/${file}`);
    });
    console.log();
  }

  if (results.skipped.length > 0) {
    console.log(`${colors.yellow}Skipped Tests:${colors.reset}`);
    results.skipped.forEach(({ category, file }) => {
      console.log(`  - ${category}/${file}`);
    });
    console.log();
  }

  return results.failed.length === 0;
}

/**
 * Main execution
 */
function main() {
  console.log(`${colors.cyan}╔═══════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║   ChatOps Teams - Test Suite Runner      ║${colors.reset}`);
  console.log(`${colors.cyan}╚═══════════════════════════════════════════╝${colors.reset}\n`);

  // Check for category filter argument
  const categoryFilter = process.argv[2];
  const validCategories = ['unit', 'integration', 'performance'];
  
  if (categoryFilter && !validCategories.includes(categoryFilter)) {
    console.log(`${colors.red}Error: Invalid category '${categoryFilter}'${colors.reset}`);
    console.log(`Valid categories: ${validCategories.join(', ')}\n`);
    process.exit(1);
  }

  let allPassed = true;
  
  // Run categories based on filter
  const categoriesToRun = categoryFilter ? [categoryFilter] : validCategories;
  
  for (const category of categoriesToRun) {
    if (!runCategory(category, testCategories[category])) {
      allPassed = false;
    }
  }

  // Print final summary
  const success = printSummary();

  if (success) {
    console.log(`${colors.green}🎉 All tests passed!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.red}❌ Some tests failed. Please review the output above.${colors.reset}\n`);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { runTestFile, runCategory };
