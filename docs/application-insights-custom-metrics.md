# Application Insights Custom Metrics and Telemetry

This document describes the custom metrics, dependency tracking, and distributed tracing configuration for the ChatOps Teams application.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Business Metrics](#business-metrics)
- [Dependencies Tracked](#dependencies-tracked)
- [Distributed Tracing](#distributed-tracing)
- [Custom Dimensions](#custom-dimensions)
- [Query Examples](#query-examples)
- [Alerting](#alerting)
- [Troubleshooting](#troubleshooting)

## Overview

The ChatOps application uses Azure Application Insights for comprehensive observability including:

- **Custom Metrics**: Track business KPIs like webhook processing time and notification delivery
- **Dependency Tracking**: Monitor external API calls to GitHub, Microsoft Graph, and Teams
- **Distributed Tracing**: End-to-end transaction correlation for webhook processing
- **Custom Dimensions**: Filtering by environment, repository, and user context

## Quick Start

### Installation

The telemetry module requires the Application Insights SDK:

```bash
npm install applicationinsights uuid
```

### Initialization

Initialize the telemetry client at application startup:

```javascript
const { getTelemetryClient, createTracingMiddleware } = require('./src/telemetry');

// Initialize with configuration
const telemetry = getTelemetryClient({
  connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
  environment: process.env.NODE_ENV || 'production',
  version: process.env.APP_VERSION || '1.0.0',
  region: process.env.AZURE_REGION || 'eastus',
  cloudRole: 'chatops-backend',
}).initialize();

// Add distributed tracing middleware to Express
const express = require('express');
const app = express();
app.use(createTracingMiddleware(telemetry));
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Application Insights connection string | Yes |
| `NODE_ENV` | Environment name (development, staging, production) | No |
| `APP_VERSION` | Application version | No |
| `AZURE_REGION` | Azure region for deployment | No |
| `WEBSITE_INSTANCE_ID` | App Service instance ID (auto-set by Azure) | No |

## Business Metrics

### WebhookProcessingTime

Tracks the time taken to process incoming GitHub webhooks.

| Dimension | Description | Example Values |
|-----------|-------------|----------------|
| `webhookType` | Type of GitHub webhook | `code_scanning_alert`, `dependabot_alert`, `deployment_review` |
| `repository` | Repository full name | `owner/repo` |
| `severity` | Alert severity (if applicable) | `critical`, `high`, `medium`, `low` |
| `success` | Whether processing succeeded | `true`, `false` |

**Usage Example:**

```javascript
const startTime = Date.now();

// Process webhook...

telemetry.trackWebhookProcessingTime(Date.now() - startTime, {
  webhookType: 'code_scanning_alert',
  repository: 'owner/repo',
  severity: 'critical',
  success: true,
});
```

### AlertNotificationSent

Tracks when alert notifications are sent to Microsoft Teams.

| Dimension | Description | Example Values |
|-----------|-------------|----------------|
| `alertType` | Type of security alert | `code_scanning`, `dependabot`, `secret_scanning` |
| `notificationChannel` | Notification delivery channel | `teams`, `email` |
| `recipientCount` | Number of notification recipients | `1`, `5`, `10` |
| `repository` | Repository full name | `owner/repo` |
| `success` | Whether notification was delivered | `true`, `false` |

**Usage Example:**

```javascript
telemetry.trackAlertNotificationSent({
  alertType: 'code_scanning',
  notificationChannel: 'teams',
  recipientCount: 3,
  repository: 'owner/repo',
  success: true,
});
```

### DeploymentApprovalTime

Tracks the time from deployment request to approval decision.

| Dimension | Description | Example Values |
|-----------|-------------|----------------|
| `environment` | Deployment target environment | `production`, `staging`, `development` |
| `repository` | Repository full name | `owner/repo` |
| `outcome` | Approval decision | `approved`, `rejected`, `timeout` |
| `approver` | Username who approved (if applicable) | `username` |

**Usage Example:**

```javascript
const approvalDuration = Date.now() - deploymentRequestTime;

telemetry.trackDeploymentApprovalTime(approvalDuration, {
  environment: 'production',
  repository: 'owner/repo',
  outcome: 'approved',
  approver: 'admin-user',
});
```

### UserMappingSuccess

Tracks GitHub to Entra ID user mapping operations.

| Dimension | Description | Example Values |
|-----------|-------------|----------------|
| `success` | Whether mapping was successful | `true`, `false` |
| `mappingMethod` | Method used for mapping | `email`, `username`, `saml`, `manual` |
| `sourceUser` | GitHub username being mapped | `github-user` |
| `confidenceScore` | Mapping confidence (0-100) | `100`, `85`, `60` |

**Usage Example:**

```javascript
telemetry.trackUserMappingSuccess({
  success: true,
  mappingMethod: 'email',
  sourceUser: 'github-user',
  confidenceScore: 100,
});
```

## Dependencies Tracked

The application automatically tracks calls to external APIs:

### GitHub API

Target: `api.github.com`

Common operations tracked:
- `GET /repos/{owner}/{repo}` - Repository info
- `GET /repos/{owner}/{repo}/commits/{sha}` - Commit details
- `GET /repos/{owner}/{repo}/code-scanning/alerts` - Code scanning alerts
- `GET /repos/{owner}/{repo}/dependabot/alerts` - Dependabot alerts
- `POST /repos/{owner}/{repo}/actions/runs/{id}/deployment_protection_rule` - Deployment approval

**Usage Example:**

```javascript
const startTime = Date.now();

const response = await fetch('https://api.github.com/repos/owner/repo');
const duration = Date.now() - startTime;

telemetry.trackGitHubApiCall(
  'GET /repos/{owner}/{repo}',
  duration,
  response.status,
  response.ok,
  { repository: 'owner/repo' }
);
```

### Microsoft Graph API

Target: `graph.microsoft.com`

Common operations tracked:
- `GET /users/{id}` - User lookup
- `GET /users` - User search
- `POST /users/{id}/sendMail` - Email notifications
- `POST /$batch` - Batch operations

**Usage Example:**

```javascript
const startTime = Date.now();

const response = await graphClient.api('/users').get();
const duration = Date.now() - startTime;

telemetry.trackGraphApiCall(
  'GET /users',
  duration,
  200,
  true,
  { userCount: response.value.length }
);
```

### Teams Bot API

Target: `smba.trafficmanager.net`

Common operations tracked:
- `POST /v3/conversations` - Create conversation
- `POST /v3/conversations/{id}/activities` - Send message
- `PUT /v3/conversations/{id}/activities/{activityId}` - Update message

**Usage Example:**

```javascript
const startTime = Date.now();

await context.sendActivity(card);
const duration = Date.now() - startTime;

telemetry.trackTeamsApiCall(
  'POST /v3/conversations/{id}/activities',
  duration,
  202,
  true,
  { messageType: 'adaptiveCard' }
);
```

### Generic Dependency Tracking

For other HTTP dependencies:

```javascript
telemetry.trackDependency({
  target: 'custom-api.example.com',
  name: 'POST /api/webhook',
  duration: 150,
  resultCode: 200,
  success: true,
  dependencyTypeName: 'HTTP',
  properties: { customProperty: 'value' },
});
```

## Distributed Tracing

### Correlation ID

The application uses the GitHub webhook delivery ID (`X-GitHub-Delivery` header) as the correlation ID for distributed tracing. This enables end-to-end tracking of webhook processing.

### Express Middleware

Use the tracing middleware to automatically:
- Extract or generate correlation IDs
- Set operation context for all telemetry
- Track request duration and status

```javascript
const { createTracingMiddleware } = require('./src/telemetry');

app.use(createTracingMiddleware(telemetry));
```

### Manual Context Setting

For custom scenarios:

```javascript
// Set operation context
telemetry.setOperationContext(
  req.headers['x-github-delivery'], // operationId
  'ProcessCodeScanningAlert',       // operationName
  parentOperationId                 // optional parentId
);
```

## Custom Dimensions

All telemetry includes common dimensions set globally:

| Dimension | Description | Source |
|-----------|-------------|--------|
| `environment` | Deployment environment | `NODE_ENV` env var |
| `version` | Application version | `APP_VERSION` env var |
| `region` | Azure region | `AZURE_REGION` env var |
| `ai.cloud.role` | Cloud role for Application Map | Configuration |
| `ai.cloud.roleInstance` | Instance ID | `WEBSITE_INSTANCE_ID` env var |

## Query Examples

### Average Webhook Processing Time by Type

```kusto
customMetrics
| where name == "WebhookProcessingTime"
| extend webhookType = tostring(customDimensions.webhookType)
| summarize 
    avgDuration = avg(value),
    maxDuration = max(value),
    count = count()
  by webhookType
| order by avgDuration desc
```

### Failed Dependencies in Last Hour

```kusto
dependencies
| where timestamp > ago(1h)
| where success == false
| summarize 
    failureCount = count(),
    avgDuration = avg(duration)
  by target, name, resultCode
| order by failureCount desc
```

### Notification Success Rate by Alert Type

```kusto
customEvents
| where name == "AlertNotificationSent"
| extend 
    alertType = tostring(customDimensions.alertType),
    success = tostring(customDimensions.success)
| summarize 
    total = count(),
    successful = countif(success == "true")
  by alertType
| extend successRate = round(100.0 * successful / total, 2)
| project alertType, total, successful, successRate
```

### End-to-End Transaction Flow

```kusto
union requests, dependencies, customEvents
| where operation_Id == "webhook-delivery-id-here"
| project 
    timestamp,
    itemType = case(
        itemType == "request", "Request",
        itemType == "dependency", "Dependency",
        "Event"
    ),
    name,
    duration,
    success
| order by timestamp asc
```

### Deployment Approval Performance

```kusto
customMetrics
| where name == "DeploymentApprovalTime"
| extend 
    environment = tostring(customDimensions.environment),
    outcome = tostring(customDimensions.outcome)
| summarize 
    avgApprovalTime = avg(value) / 1000 / 60,  // Convert to minutes
    p95ApprovalTime = percentile(value, 95) / 1000 / 60
  by environment, outcome
```

### User Mapping Success Rate by Method

```kusto
customEvents
| where name == "UserMappingSuccess"
| extend 
    mappingMethod = tostring(customDimensions.mappingMethod),
    success = tostring(customDimensions.success)
| summarize 
    total = count(),
    successful = countif(success == "true")
  by mappingMethod
| extend successRate = round(100.0 * successful / total, 2)
```

### Application Map Dependencies

```kusto
dependencies
| where timestamp > ago(24h)
| summarize 
    callCount = count(),
    avgDuration = avg(duration),
    failureRate = round(100.0 * countif(success == false) / count(), 2)
  by target
| order by callCount desc
```

## Alerting

Recommended alert rules based on these metrics:

### High Webhook Processing Time

```kusto
customMetrics
| where name == "WebhookProcessingTime"
| where value > 5000  // > 5 seconds
| summarize count() by bin(timestamp, 5m)
```

Threshold: > 10 slow webhooks in 5 minutes

### High Dependency Failure Rate

```kusto
dependencies
| where timestamp > ago(5m)
| summarize 
    total = count(),
    failures = countif(success == false)
| where failures > total * 0.1  // > 10% failure rate
```

### Notification Delivery Failures

```kusto
customEvents
| where name == "AlertNotificationSent"
| where timestamp > ago(5m)
| where customDimensions.success == "false"
| summarize failureCount = count()
```

Threshold: > 5 notification failures in 5 minutes

### User Mapping Failures

```kusto
customEvents
| where name == "UserMappingSuccess"
| where timestamp > ago(1h)
| where customDimensions.success == "false"
| summarize failureCount = count()
```

Threshold: > 20 mapping failures in 1 hour

## Troubleshooting

### Telemetry Not Appearing

1. **Verify connection string**: Ensure `APPLICATIONINSIGHTS_CONNECTION_STRING` is set correctly
2. **Check initialization**: Confirm `telemetry.initialize()` is called at startup
3. **Sampling rate**: Check if sampling is filtering out data (90% sampling is configured)
4. **Latency**: Allow 2-5 minutes for telemetry to appear in Azure Portal

### Missing Correlation IDs

1. Ensure `createTracingMiddleware` is added before route handlers
2. Verify `X-GitHub-Delivery` header is present in webhook requests
3. Check that `setOperationContext` is called for async operations

### Dependencies Not Tracked

1. Verify `setAutoCollectDependencies(true)` is configured
2. For custom HTTP clients, manually track using `trackDependency` or `trackGitHubApiCall`
3. Check network configuration allows telemetry to `dc.services.visualstudio.com`

### Performance Impact

The telemetry SDK has minimal performance impact:
- Async telemetry sending
- Disk caching for reliability
- Configurable sampling (90% configured to reduce costs)

For high-volume scenarios, consider:
- Increasing sampling rate
- Using `flush()` before process exit
- Monitoring Application Insights ingestion costs

## References

- [Azure Application Insights Documentation](https://docs.microsoft.com/azure/azure-monitor/app/app-insights-overview)
- [Application Insights Node.js SDK](https://github.com/microsoft/ApplicationInsights-node.js)
- [Kusto Query Language (KQL)](https://docs.microsoft.com/azure/data-explorer/kusto/query/)
- [Application Insights Metrics Explorer](https://docs.microsoft.com/azure/azure-monitor/essentials/metrics-charts)
