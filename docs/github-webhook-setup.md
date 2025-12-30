# GitHub Webhook Setup Guide

This guide explains how to configure GitHub webhooks to integrate with the ChatOps Teams application.

## Overview

The ChatOps Teams application receives real-time notifications from GitHub through webhooks for:
- Code scanning alerts (critical and high severity)
- Dependabot security alerts
- Deployment protection rule events

## Prerequisites

- GitHub organization or repository with admin access
- Azure App Service deployed with the bot application
- GitHub webhook secret stored in Azure Key Vault
- Application Insights configured for monitoring

## Webhook Configuration

### 1. Obtain Webhook Secret

The webhook secret should be stored in Azure Key Vault:

```bash
# Retrieve from Key Vault
az keyvault secret show --name github-webhook-secret --vault-name <your-keyvault-name>
```

Or generate a new secure secret:

```bash
# Generate a new secret
openssl rand -hex 32
```

### 2. Configure Webhook in GitHub

1. Navigate to your GitHub organization or repository settings
2. Go to **Settings** → **Webhooks** → **Add webhook**
3. Configure the webhook:

   - **Payload URL**: `https://<your-app-service>.azurewebsites.net/api/webhooks/github`
   - **Content type**: `application/json`
   - **Secret**: Enter the webhook secret from Key Vault
   - **SSL verification**: Enable SSL verification (required)
   - **Which events would you like to trigger this webhook?**: Select "Let me select individual events"
     - ✅ Code scanning alerts
     - ✅ Dependabot alerts
     - ✅ Deployment protection rules
   - **Active**: ✅ Checked

4. Click **Add webhook**

### 3. Verify Webhook Configuration

GitHub will send a `ping` event to verify the webhook is configured correctly.

Check the webhook delivery history:
1. Go to **Settings** → **Webhooks**
2. Click on the webhook you just created
3. Navigate to **Recent Deliveries**
4. You should see a successful `ping` event with HTTP 200 response

### 4. Test Webhook Integration

#### Test with Ping Event

GitHub automatically sends a ping event when you create the webhook. You can manually trigger another ping:

1. In the webhook settings, click **Edit**
2. Scroll to the bottom and click **Recent Deliveries**
3. Click on any delivery and then **Redeliver**

#### Test with Code Scanning Alert

If you have GitHub Advanced Security enabled:

1. Create a test pull request with a security vulnerability
2. Wait for code scanning to complete
3. Check Application Insights for the webhook event:

```kql
traces
| where message contains "code_scanning_alert"
| project timestamp, message, customDimensions
| order by timestamp desc
```

#### Test with Dependabot Alert

If Dependabot is enabled:

1. Add a dependency with a known vulnerability to your repository
2. Wait for Dependabot to detect the vulnerability
3. Check Application Insights for the webhook event:

```kql
traces
| where message contains "dependabot_alert"
| project timestamp, message, customDimensions
| order by timestamp desc
```

## Monitoring and Troubleshooting

### Webhook Delivery Monitoring

Check webhook delivery status in GitHub:
1. Go to **Settings** → **Webhooks**
2. Click on the webhook
3. View **Recent Deliveries** to see success/failure status

### Application Insights Monitoring

Monitor webhook processing in Application Insights:

```kql
// Webhook processing time
customMetrics
| where name == "WebhookProcessingTime"
| summarize avg(value), max(value), min(value) by bin(timestamp, 5m)
| render timechart

// Webhook validation failures
customEvents
| where name == "GitHubWebhookError"
| where customDimensions.error == "InvalidSignature"
| summarize count() by bin(timestamp, 1h)
| render barchart

// Webhook processing success rate
customEvents
| where name == "GitHubWebhookProcessed"
| summarize 
    Total = count(),
    Success = countif(customDimensions.status == "processed")
| extend SuccessRate = (Success * 100.0) / Total
```

### Common Issues

#### Issue: Invalid Signature Error

**Symptom**: Webhooks are rejected with "Invalid signature" error

**Solution**:
1. Verify the webhook secret in Key Vault matches the secret configured in GitHub
2. Ensure the secret is properly loaded in the application:
   ```bash
   az webapp config appsettings list --name <app-name> --resource-group <rg-name> --query "[?name=='GITHUB_WEBHOOK_SECRET']"
   ```
3. Check that the application is using the raw request body for signature validation

#### Issue: Webhook Timeouts

**Symptom**: GitHub shows "Timeout" in webhook delivery history

**Solution**:
1. Check Application Insights for slow dependencies or errors
2. Verify the webhook endpoint responds within 10 seconds (GitHub timeout)
3. Ensure the application is healthy:
   ```bash
   curl https://<your-app-service>.azurewebsites.net/health
   ```

#### Issue: Missing Events

**Symptom**: Webhooks are not being received for certain event types

**Solution**:
1. Verify the event types are selected in GitHub webhook configuration
2. Check that the application supports the event type in `webhookValidator.js`:
   ```javascript
   isSupportedEventType(eventType)
   ```
3. Review Application Insights logs for unsupported event warnings

## Security Best Practices

### 1. Webhook Secret Management

- ✅ Store webhook secret in Azure Key Vault
- ✅ Use managed identity for Key Vault access
- ✅ Rotate webhook secret every 90 days
- ❌ Never commit secrets to source control
- ❌ Never log the webhook secret value

### 2. Signature Validation

The application validates every webhook using HMAC SHA-256:

```javascript
// Signature validation is mandatory
validateWebhookSignature(payload, signature, secret)
```

All webhooks without valid signatures are rejected with HTTP 401.

### 3. Network Security

- ✅ Use HTTPS endpoints only (TLS 1.2+)
- ✅ Deploy behind Azure Application Gateway with WAF
- ✅ Configure IP restrictions to GitHub IP ranges (optional)
- ✅ Enable Application Insights for monitoring

### 4. Monitoring and Alerting

Set up alerts for:
- High rate of signature validation failures
- Webhook processing errors > 5%
- Average processing time > 500ms
- Service availability < 99%

## Success Metrics

The webhook integration should meet these metrics:

| Metric | Target | Monitoring |
|--------|--------|------------|
| Webhook delivery success rate | 100% | GitHub delivery history + Application Insights |
| Webhook processing latency | < 500ms | `WebhookProcessingTime` metric |
| Signature validation failures | 0 unauthorized access | `GitHubWebhookError` events |
| API rate limit exceeded | Never | GitHub API client telemetry |

## Additional Resources

- [GitHub Webhooks Documentation](https://docs.github.com/en/webhooks)
- [GitHub Webhook Events](https://docs.github.com/en/webhooks/webhook-events-and-payloads)
- [Azure App Service Network Security](https://docs.microsoft.com/azure/app-service/overview-security)
- [Application Insights Monitoring](https://docs.microsoft.com/azure/azure-monitor/app/app-insights-overview)

## Support

For issues or questions:
1. Check webhook delivery history in GitHub
2. Review Application Insights logs and metrics
3. Check the [troubleshooting guide](./key-vault-troubleshooting.md)
4. Contact the platform team
