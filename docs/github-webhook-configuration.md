# GitHub Webhook Configuration Guide

This guide explains how to configure GitHub webhooks to send events to the ChatOps Teams application.

## Overview

The ChatOps Teams application provides webhook endpoints that receive real-time events from GitHub, enabling automated notifications and workflows for:

- **Code Scanning Alerts**: Security vulnerabilities detected in your code
- **Dependabot Alerts**: Dependency security vulnerabilities
- **Deployment Reviews**: Deployment approval requests

## Prerequisites

Before configuring webhooks, ensure:

1. Azure App Service is deployed with HTTPS endpoint
2. GitHub webhook secret is stored in Azure Key Vault
3. App Service has read access to Key Vault secrets
4. Application Gateway with WAF is configured (for DDoS protection)

## Webhook Endpoints

### Main Webhook Endpoint

**URL**: `https://your-app-service.azurewebsites.net/api/webhooks/github`

**Method**: `POST`

**Content-Type**: `application/json`

**Headers Required**:
- `X-Hub-Signature-256`: HMAC SHA-256 signature for payload validation
- `X-GitHub-Event`: Event type (e.g., `code_scanning_alert`)
- `X-GitHub-Delivery`: Unique delivery ID for the webhook event

### Status Endpoint

**URL**: `https://your-app-service.azurewebsites.net/api/webhooks/github`

**Method**: `GET`

Returns the webhook endpoint status and supported event types.

## Supported Event Types

The following GitHub webhook event types are supported:

| Event Type | Description | Use Case |
|------------|-------------|----------|
| `code_scanning_alert` | Code scanning alerts from GitHub Advanced Security | Notify security team of vulnerabilities |
| `dependabot_alert` | Dependabot security alerts | Notify maintainers of vulnerable dependencies |
| `deployment_protection_rule` | Deployment approval requests | Enable deployment approvals in Teams |
| `ping` | Webhook configuration test | Verify webhook setup |

## Configuration Steps

### 1. Generate Webhook Secret

Generate a secure random string (32+ characters) for the webhook secret:

```bash
# Using OpenSSL
openssl rand -hex 32

# Using PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### 2. Store Secret in Azure Key Vault

Store the webhook secret in Azure Key Vault:

```bash
# Using Azure CLI
az keyvault secret set \
  --vault-name chatops-keyvault \
  --name github-webhook-secret \
  --value "your-secret-here" \
  --expires "$(date -u -d '90 days' +%Y-%m-%dT%H:%M:%SZ)"
```

**Note**: The secret name must be `github-webhook-secret` as configured in the infrastructure.

### 3. Configure Webhook in GitHub

#### Organization-Level Webhook

For organization-wide webhooks:

1. Navigate to your GitHub organization settings
2. Go to **Settings** → **Webhooks** → **Add webhook**
3. Configure the webhook:
   - **Payload URL**: `https://your-app-service.azurewebsites.net/api/webhooks/github`
   - **Content type**: `application/json`
   - **Secret**: Enter the webhook secret from Key Vault
   - **SSL verification**: Enable
   - **Which events would you like to trigger this webhook?**: Select **Let me select individual events**
     - ✅ Code scanning alerts
     - ✅ Dependabot alerts
     - ✅ Deployment protection rules
   - **Active**: ✅ Enabled

4. Click **Add webhook**

#### Repository-Level Webhook

For individual repository webhooks:

1. Navigate to your repository
2. Go to **Settings** → **Webhooks** → **Add webhook**
3. Follow the same configuration steps as above

### 4. Test Webhook Configuration

GitHub automatically sends a `ping` event when you create a webhook. Verify:

1. Check the **Recent Deliveries** section in GitHub webhook settings
2. The response should be `200 OK` with a JSON payload:
   ```json
   {
     "status": "processed",
     "eventType": "ping",
     "message": "Webhook configured successfully: ..."
   }
   ```

3. Check Application Insights logs for the webhook event:
   ```kusto
   traces
   | where message contains "Processing ping event"
   | order by timestamp desc
   | take 10
   ```

## Security

### Signature Validation

All webhook requests are validated using HMAC SHA-256:

1. GitHub signs the payload with the webhook secret
2. The signature is sent in the `X-Hub-Signature-256` header
3. Our endpoint validates the signature before processing
4. Invalid signatures are rejected with `401 Unauthorized`

**Security Features**:
- Timing-safe comparison to prevent timing attacks
- Raw body validation (before JSON parsing)
- Signature format validation (`sha256=...`)

### DDoS Protection

The Application Gateway with Web Application Firewall (WAF) provides:

- Rate limiting for webhook endpoints
- IP address filtering (optional)
- DDoS protection
- SSL/TLS termination

### Network Security

- App Service IP restrictions allow only Application Gateway subnet
- VNet integration for secure backend communication
- HTTPS-only endpoints (TLS 1.2+)

## Monitoring and Logging

### Application Insights Events

All webhook events are tracked in Application Insights:

**Custom Events**:
- `GitHubWebhookReceived`: Every webhook received
- `GitHubWebhookProcessed`: Successfully processed webhooks
- `GitHubWebhookError`: Webhook processing errors

**Custom Metrics**:
- `WebhookProcessingTime`: Processing duration in milliseconds
- `WebhookValidationFailures`: Failed signature validations
- `WebhookProcessingErrors`: Processing errors by type
- `CodeScanningAlertsBySeverity`: Code scanning alerts by severity
- `DependabotAlertsBySeverity`: Dependabot alerts by severity
- `DeploymentReviewRequests`: Deployment review requests

### Query Examples

**Recent webhook events**:
```kusto
customEvents
| where name == "GitHubWebhookReceived"
| order by timestamp desc
| take 50
| project timestamp, eventType=customDimensions.eventType, deliveryId=customDimensions.deliveryId
```

**Failed webhook validations**:
```kusto
customEvents
| where name == "GitHubWebhookError" and customDimensions.error == "InvalidSignature"
| order by timestamp desc
| take 20
```

**Webhook processing performance**:
```kusto
customMetrics
| where name == "WebhookProcessingTime"
| summarize avg(value), percentile(value, 95) by bin(timestamp, 5m)
| render timechart
```

## Troubleshooting

### Webhook Delivery Failures

**Symptoms**: GitHub shows failed deliveries (non-200 status codes)

**Possible Causes**:
1. Invalid webhook secret
2. App Service is down or restarting
3. Network connectivity issues
4. Application Gateway health probe failure

**Resolution**:
1. Verify webhook secret in Key Vault matches GitHub configuration
2. Check App Service health endpoint: `https://your-app-service.azurewebsites.net/health`
3. Check Application Insights for exceptions
4. Review Application Gateway logs

### Invalid Signature Errors

**Symptoms**: Webhook returns `401 Unauthorized` with "Invalid signature" error

**Possible Causes**:
1. Webhook secret mismatch
2. GitHub webhook secret not configured
3. Webhook secret expired in Key Vault

**Resolution**:
1. Retrieve current secret from Key Vault:
   ```bash
   az keyvault secret show --vault-name chatops-keyvault --name github-webhook-secret
   ```
2. Update GitHub webhook secret if needed
3. Check Key Vault access policy for App Service managed identity
4. Verify secret expiration date

### Events Not Processing

**Symptoms**: Webhook receives 200 OK but events aren't processed

**Possible Causes**:
1. Event type not supported
2. Logic App workflow not configured
3. Application error during processing

**Resolution**:
1. Verify event type is supported (see Supported Event Types)
2. Check Application Insights for processing errors
3. Review console logs in App Service

## Secret Rotation

Rotate the GitHub webhook secret every 90 days:

1. Generate a new secret
2. Add the new secret to Key Vault (with expiration)
3. Update GitHub webhook configuration with new secret
4. Wait 24 hours to ensure all cached values are updated
5. Delete the old secret from Key Vault

See [Secret Rotation Procedure](key-vault-secret-rotation.md) for detailed steps.

## API Response Codes

| Status Code | Description | Action |
|-------------|-------------|--------|
| `200 OK` | Webhook processed successfully | None |
| `401 Unauthorized` | Invalid webhook signature | Verify webhook secret |
| `500 Internal Server Error` | Processing error | Check Application Insights logs |

## Rate Limiting

GitHub webhooks are not rate-limited by the application, but Application Gateway may apply rate limits to prevent abuse. If you encounter rate limiting:

1. Check Application Gateway metrics
2. Review WAF logs
3. Adjust rate limit rules if necessary

## Support

For issues or questions:

1. Check Application Insights logs for errors
2. Review GitHub webhook delivery history
3. Verify Key Vault access and secret values
4. Contact the platform team

## References

- [GitHub Webhooks Documentation](https://docs.github.com/webhooks)
- [GitHub Webhook Events](https://docs.github.com/webhooks-and-events/webhooks/webhook-events-and-payloads)
- [Azure Key Vault Usage Guide](key-vault-usage.md)
- [Application Insights Custom Metrics](application-insights-custom-metrics.md)
