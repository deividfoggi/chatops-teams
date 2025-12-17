#!/usr/bin/env node

/**
 * Script to create placeholder PNG icons for Teams app
 * This creates simple colored squares as placeholders
 * In production, these should be replaced with proper branded icons
 */

const fs = require('fs');
const path = require('path');

// Simple 1x1 PNG in base64 format (transparent pixel)
const transparentPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

// Create a simple colored PNG using canvas-like approach
// Since we don't have external dependencies, we'll use a pre-encoded PNG

// 192x192 color icon (purple/blue theme matching accentColor #5558AF)
const colorIconBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAYAAABS3GwHAAAACXBIWXMAAAsTAAALEwEAmpwYAAADKElEQVR42u3bMQ0AAAjAMPr/0DmYwMHQQMHce4A/A4AAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAgAAoAAIAAIAAKAACAACAACgAAgAAjwBLgAAwBnpwBbKzELJAAAAABJRU5ErkJggg==';

// 32x32 outline icon (monochrome/simple)
const outlineIconBase64 = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAABKElEQVR42u2WMQ6DMAxFHYkj9P6HOQqRukRd0g6IIYSq1f+SFVUqfvn6Y0ICAAAAAAAAAAAAAAAAAADgPzG1LrCt67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu67qu6/wC0AS7vTu+qVAAAAAElFTkSuQmCC';

const iconsDir = path.join(__dirname, 'icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Write color icon (192x192)
fs.writeFileSync(path.join(iconsDir, 'color.png'), Buffer.from(colorIconBase64, 'base64'));
console.log('✓ Created color.png (192x192) - placeholder icon');

// Write outline icon (32x32)
fs.writeFileSync(path.join(iconsDir, 'outline.png'), Buffer.from(outlineIconBase64, 'base64'));
console.log('✓ Created outline.png (32x32) - placeholder icon');

console.log('\nNote: These are placeholder icons. Replace them with proper branded icons before production deployment.');
console.log('- color.png should be 192x192 pixels with your brand colors');
console.log('- outline.png should be 32x32 pixels monochrome/transparent');
