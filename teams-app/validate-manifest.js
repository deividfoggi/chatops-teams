#!/usr/bin/env node

/**
 * Teams App Manifest Validator
 * 
 * This script validates the Teams app manifest against the Microsoft Teams schema
 * and performs additional custom validations.
 * 
 * Usage:
 *   node validate-manifest.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Teams App Manifest...\n');

// Read manifest file
const manifestPath = path.join(__dirname, 'manifest.json');
let manifestContent;

try {
  manifestContent = fs.readFileSync(manifestPath, 'utf8');
} catch (error) {
  console.error('❌ Error reading manifest.json:', error.message);
  process.exit(1);
}

// Parse JSON
let manifest;
try {
  manifest = JSON.parse(manifestContent);
  console.log('✓ Valid JSON syntax');
} catch (error) {
  console.error('❌ Invalid JSON:', error.message);
  process.exit(1);
}

// Validation checks
const errors = [];
const warnings = [];

// Required fields
const requiredFields = [
  'manifestVersion',
  'version',
  'id',
  'packageName',
  'developer',
  'name',
  'description',
  'icons',
  'accentColor'
];

console.log('\nChecking required fields...');
for (const field of requiredFields) {
  if (!manifest[field]) {
    errors.push(`Missing required field: ${field}`);
  } else {
    console.log(`✓ ${field}`);
  }
}

// Validate manifest version
if (manifest.manifestVersion) {
  if (manifest.manifestVersion !== '1.16') {
    warnings.push(`Manifest version is ${manifest.manifestVersion}, expected 1.16`);
  }
  console.log(`✓ manifestVersion: ${manifest.manifestVersion}`);
}

// Validate version format (should be semver)
if (manifest.version) {
  const semverPattern = /^\d+\.\d+\.\d+$/;
  if (!semverPattern.test(manifest.version)) {
    warnings.push(`Version "${manifest.version}" does not follow semantic versioning (x.y.z)`);
  }
}

// Validate package name format
if (manifest.packageName) {
  const packageNamePattern = /^[a-z][a-z0-9-_.]*$/;
  if (!packageNamePattern.test(manifest.packageName)) {
    errors.push(`Invalid packageName format: ${manifest.packageName}`);
  }
}

// Validate accent color format
if (manifest.accentColor) {
  const hexColorPattern = /^#[0-9A-Fa-f]{6}$/;
  if (!hexColorPattern.test(manifest.accentColor)) {
    errors.push(`Invalid accentColor format: ${manifest.accentColor} (must be #RRGGBB)`);
  }
}

// Validate name lengths
if (manifest.name) {
  if (manifest.name.short && manifest.name.short.length > 30) {
    errors.push(`name.short exceeds 30 characters: ${manifest.name.short.length}`);
  }
  if (manifest.name.full && manifest.name.full.length > 100) {
    errors.push(`name.full exceeds 100 characters: ${manifest.name.full.length}`);
  }
}

// Validate description lengths
if (manifest.description) {
  if (manifest.description.short && manifest.description.short.length > 80) {
    errors.push(`description.short exceeds 80 characters: ${manifest.description.short.length}`);
  }
  if (manifest.description.full && manifest.description.full.length > 4000) {
    errors.push(`description.full exceeds 4000 characters: ${manifest.description.full.length}`);
  }
}

// Check for placeholder values
console.log('\nChecking for placeholder values...');
const placeholderPattern = /\{\{[A-Z_]+\}\}/g;
const placeholders = manifestContent.match(placeholderPattern);
if (placeholders) {
  const uniquePlaceholders = [...new Set(placeholders)];
  console.log('⚠️  Found placeholders (should be replaced before deployment):');
  uniquePlaceholders.forEach(p => console.log(`   - ${p}`));
  warnings.push('Manifest contains placeholder values that must be replaced');
} else {
  console.log('✓ No placeholders found');
}

// Validate icon files exist
console.log('\nChecking icon files...');
const iconFiles = [
  { path: 'icons/color.png', expected: 'color.png' },
  { path: 'icons/outline.png', expected: 'outline.png' }
];

for (const icon of iconFiles) {
  const iconPath = path.join(__dirname, icon.path);
  if (!fs.existsSync(iconPath)) {
    errors.push(`Missing icon file: ${icon.path}`);
  } else {
    const stats = fs.statSync(iconPath);
    console.log(`✓ ${icon.expected} (${stats.size} bytes)`);
    
    // Validate icon sizes (basic check)
    if (icon.expected === 'color.png' && stats.size < 100) {
      warnings.push('color.png seems too small, expected 192x192 pixels');
    }
    if (icon.expected === 'outline.png' && stats.size < 100) {
      warnings.push('outline.png seems too small, expected 32x32 pixels');
    }
  }
}

// Validate localization files
console.log('\nChecking localization files...');
if (manifest.localizationInfo && manifest.localizationInfo.additionalLanguages) {
  for (const lang of manifest.localizationInfo.additionalLanguages) {
    const langPath = path.join(__dirname, lang.file);
    if (!fs.existsSync(langPath)) {
      errors.push(`Missing localization file: ${lang.file}`);
    } else {
      console.log(`✓ ${lang.file}`);
      
      // Validate localization JSON
      try {
        const langContent = fs.readFileSync(langPath, 'utf8');
        JSON.parse(langContent);
        console.log(`  ✓ Valid JSON`);
      } catch (error) {
        errors.push(`Invalid JSON in ${lang.file}: ${error.message}`);
      }
    }
  }
}

// Validate valid domains
console.log('\nChecking valid domains...');
if (manifest.validDomains && Array.isArray(manifest.validDomains)) {
  console.log(`✓ ${manifest.validDomains.length} valid domain(s) configured`);
  manifest.validDomains.forEach(domain => {
    if (domain.includes('{{')) {
      console.log(`  ⚠️  ${domain} (placeholder)`);
    } else {
      console.log(`  ✓ ${domain}`);
    }
  });
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('Validation Summary:');
console.log('='.repeat(60));

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ All validations passed!');
  console.log('\nManifest is ready for packaging.');
  process.exit(0);
} else {
  if (errors.length > 0) {
    console.log(`\n❌ ${errors.length} Error(s):`);
    errors.forEach((err, idx) => console.log(`   ${idx + 1}. ${err}`));
  }
  
  if (warnings.length > 0) {
    console.log(`\n⚠️  ${warnings.length} Warning(s):`);
    warnings.forEach((warn, idx) => console.log(`   ${idx + 1}. ${warn}`));
  }
  
  if (errors.length > 0) {
    console.log('\n❌ Validation failed. Please fix the errors above.');
    process.exit(1);
  } else {
    console.log('\n⚠️  Validation passed with warnings. Review warnings before deployment.');
    process.exit(0);
  }
}
