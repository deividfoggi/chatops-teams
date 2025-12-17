#!/usr/bin/env node

/**
 * Teams App Package Builder
 * 
 * This script packages the Teams app manifest, icons, and localization files
 * into a .zip file ready for upload to Microsoft Teams.
 * 
 * Usage:
 *   node package-app.js [output-filename]
 * 
 * Environment variables (optional for manifest substitution):
 *   - MICROSOFT_APP_ID: Azure Bot Service App ID
 *   - AZURE_APP_SERVICE_DOMAIN: Your Azure App Service domain
 *   - ENTRA_CLIENT_ID: Entra ID Application Client ID
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Default output filename
const defaultOutputFile = 'chatops-teams.zip';

// Get output filename from args or use default
const outputFile = process.argv[2] || defaultOutputFile;

// Files to include in the package
const filesToPackage = [
  'manifest.json',
  'icons/color.png',
  'icons/outline.png',
  'locales/en-us.json'
];

// Environment variables for substitution
const envVars = {
  MICROSOFT_APP_ID: process.env.MICROSOFT_APP_ID || '{{MICROSOFT_APP_ID}}',
  AZURE_APP_SERVICE_DOMAIN: process.env.AZURE_APP_SERVICE_DOMAIN || '{{AZURE_APP_SERVICE_DOMAIN}}',
  ENTRA_CLIENT_ID: process.env.ENTRA_CLIENT_ID || '{{ENTRA_CLIENT_ID}}'
};

console.log('📦 Building Teams App Package...\n');

// Validate that all required files exist
console.log('Validating files...');
let allFilesExist = true;
for (const file of filesToPackage) {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Missing required file: ${file}`);
    allFilesExist = false;
  } else {
    console.log(`✓ ${file}`);
  }
}

if (!allFilesExist) {
  console.error('\n❌ Package creation failed: Missing required files');
  process.exit(1);
}

// Process manifest.json to substitute environment variables
console.log('\nProcessing manifest.json...');
let manifestContent = fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8');

// Replace placeholders
for (const [key, value] of Object.entries(envVars)) {
  const placeholder = `{{${key}}}`;
  const count = (manifestContent.match(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  manifestContent = manifestContent.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  
  if (count > 0) {
    if (value.startsWith('{{')) {
      console.log(`⚠️  ${key}: ${value} (not set - using placeholder)`);
    } else {
      console.log(`✓ ${key}: ${value}`);
    }
  }
}

// Validate manifest JSON
try {
  JSON.parse(manifestContent);
  console.log('✓ Manifest JSON is valid');
} catch (error) {
  console.error('❌ Invalid manifest JSON:', error.message);
  process.exit(1);
}

// Create the zip archive
console.log('\nCreating package...');
const output = fs.createWriteStream(path.join(__dirname, outputFile));
const archive = archiver('zip', {
  zlib: { level: 9 } // Maximum compression
});

// Listen for archive completion
output.on('close', function() {
  const sizeInKB = (archive.pointer() / 1024).toFixed(2);
  console.log(`\n✅ Package created successfully!`);
  console.log(`📄 File: ${outputFile}`);
  console.log(`📊 Size: ${sizeInKB} KB`);
  console.log(`\nNext steps:`);
  console.log(`1. Register your bot in Azure Bot Service to get MICROSOFT_APP_ID`);
  console.log(`2. Create Entra ID app registration for SSO to get ENTRA_CLIENT_ID`);
  console.log(`3. Set environment variables and rebuild the package`);
  console.log(`4. Upload ${outputFile} to Microsoft Teams Admin Center or Teams App Studio`);
});

// Listen for archive errors
archive.on('error', function(err) {
  console.error('❌ Error creating package:', err.message);
  process.exit(1);
});

// Pipe archive data to the file
archive.pipe(output);

// Add processed manifest
archive.append(manifestContent, { name: 'manifest.json' });

// Add icons
archive.file(path.join(__dirname, 'icons/color.png'), { name: 'color.png' });
archive.file(path.join(__dirname, 'icons/outline.png'), { name: 'outline.png' });

// Add localization files
archive.directory(path.join(__dirname, 'locales'), 'locales');

// Finalize the archive
archive.finalize();
