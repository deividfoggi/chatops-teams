/**
 * GitHub Webhook Validator
 * 
 * Validates GitHub webhook signatures using HMAC SHA-256.
 * Implements security best practices for webhook authentication.
 * 
 * @module bot/webhookValidator
 */

const crypto = require('crypto');

/**
 * Validates a GitHub webhook signature
 * 
 * @param {string|Buffer} payload - The raw request body (must be raw, not parsed JSON)
 * @param {string} signature - The X-Hub-Signature-256 header value
 * @param {string} secret - The webhook secret from Azure Key Vault
 * @returns {boolean} True if the signature is valid, false otherwise
 * 
 * @example
 * const isValid = validateWebhookSignature(
 *   req.body,
 *   req.headers['x-hub-signature-256'],
 *   process.env.GITHUB_WEBHOOK_SECRET
 * );
 */
function validateWebhookSignature(payload, signature, secret) {
  // Validate inputs
  if (!payload) {
    console.error('Webhook validation failed: payload is required');
    return false;
  }

  if (!signature) {
    console.error('Webhook validation failed: signature is required');
    return false;
  }

  if (!secret) {
    console.error('Webhook validation failed: secret is required');
    return false;
  }

  // Signature must be in format: sha256=<hash>
  if (!signature.startsWith('sha256=')) {
    console.error('Webhook validation failed: invalid signature format');
    return false;
  }

  try {
    // Extract the hash from the signature
    const signatureHash = signature.substring(7); // Remove 'sha256=' prefix

    // Convert payload to Buffer if it's a string
    const payloadBuffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8');

    // Compute HMAC SHA-256 hash
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payloadBuffer);
    const computedHash = hmac.digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(signatureHash, 'hex');
    const computedBuffer = Buffer.from(computedHash, 'hex');

    if (signatureBuffer.length !== computedBuffer.length) {
      console.error('Webhook validation failed: signature length mismatch');
      return false;
    }

    // crypto.timingSafeEqual requires buffers of the same length
    const isValid = crypto.timingSafeEqual(signatureBuffer, computedBuffer);

    if (!isValid) {
      console.error('Webhook validation failed: signature mismatch');
    }

    return isValid;
  } catch (error) {
    console.error('Webhook validation error:', error.message);
    return false;
  }
}

/**
 * Extracts the GitHub event type from request headers
 * 
 * @param {Object} headers - Request headers object
 * @returns {string|null} The event type (e.g., 'code_scanning_alert') or null if not found
 */
function getEventType(headers) {
  return headers['x-github-event'] || null;
}

/**
 * Extracts the GitHub delivery ID from request headers
 * 
 * @param {Object} headers - Request headers object
 * @returns {string|null} The delivery ID or null if not found
 */
function getDeliveryId(headers) {
  return headers['x-github-delivery'] || null;
}

/**
 * Validates that the webhook event type is supported
 * 
 * @param {string} eventType - The GitHub event type
 * @returns {boolean} True if the event type is supported
 */
function isSupportedEventType(eventType) {
  const supportedEvents = [
    'code_scanning_alert',
    'dependabot_alert',
    'deployment_review',
    'deployment_protection_rule',
    'ping', // GitHub sends ping events to test webhook configuration
  ];

  return supportedEvents.includes(eventType);
}

module.exports = {
  validateWebhookSignature,
  getEventType,
  getDeliveryId,
  isSupportedEventType,
};
