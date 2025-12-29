/**
 * Simple webhook endpoint test
 * 
 * Tests webhook endpoint without full bot initialization
 */

const express = require('express');
const crypto = require('crypto');
const { validateWebhookSignature, getEventType, getDeliveryId } = require('./webhookValidator');
const { routeWebhookEvent } = require('./webhookHandlers');

// Create minimal server for webhook testing
function createWebhookTestServer(port = 3978, webhookSecret = 'test-secret') {
  const app = express();

  // Middleware for webhook endpoints - preserve raw body for signature validation
  app.use('/api/webhooks/github', express.raw({ type: 'application/json' }));
  app.use(express.json());

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'ChatOps Webhook Test Server',
    });
  });

  // Webhook status
  app.get('/api/webhooks/github', (req, res) => {
    res.json({
      status: 'ready',
      message: 'GitHub webhook endpoint is configured',
      supportedEvents: [
        'code_scanning_alert',
        'dependabot_alert',
        'deployment_protection_rule',
        'ping',
      ],
    });
  });

  // Webhook endpoint
  app.post('/api/webhooks/github', async (req, res) => {
    const signature = req.headers['x-hub-signature-256'];
    const eventType = getEventType(req.headers);
    const deliveryId = getDeliveryId(req.headers);

    console.log(`Received webhook: event=${eventType}, delivery=${deliveryId}`);

    try {
      if (!webhookSecret) {
        return res.status(500).json({ error: 'Webhook secret not configured' });
      }

      const rawBody = req.body;
      const isValid = validateWebhookSignature(rawBody, signature, webhookSecret);

      if (!isValid) {
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const payload = JSON.parse(rawBody.toString('utf8'));
      const result = await routeWebhookEvent(eventType, payload, null);

      res.status(200).json(result);
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return app.listen(port, () => {
    console.log(`Webhook test server listening on port ${port}`);
  });
}

// Start server if run directly
if (require.main === module) {
  const port = process.env.PORT || 3978;
  const secret = process.env.GITHUB_WEBHOOK_SECRET || 'test-secret';
  createWebhookTestServer(port, secret);
}

module.exports = { createWebhookTestServer };
