#!/usr/bin/env node
/**
 * Extract coverage percentages from coverage-summary.json
 * Outputs GITHUB_ENV format for use in GitHub Actions
 */

const fs = require('fs');
const path = require('path');

const coveragePath = path.join(__dirname, '../coverage/coverage-summary.json');

try {
  if (!fs.existsSync(coveragePath)) {
    console.log('COVERAGE_LINES=0');
    console.log('COVERAGE_FUNCTIONS=0');
    console.log('COVERAGE_BRANCHES=0');
    console.log('COVERAGE_STATEMENTS=0');
    process.exit(0);
  }

  const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
  const total = coverage.total;

  console.log(`COVERAGE_LINES=${total.lines.pct}`);
  console.log(`COVERAGE_FUNCTIONS=${total.functions.pct}`);
  console.log(`COVERAGE_BRANCHES=${total.branches.pct}`);
  console.log(`COVERAGE_STATEMENTS=${total.statements.pct}`);
} catch (error) {
  console.error('Error parsing coverage:', error.message);
  console.log('COVERAGE_LINES=0');
  console.log('COVERAGE_FUNCTIONS=0');
  console.log('COVERAGE_BRANCHES=0');
  console.log('COVERAGE_STATEMENTS=0');
  process.exit(1);
}
