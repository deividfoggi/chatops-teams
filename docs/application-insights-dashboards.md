# Application Insights Dashboards

This document describes the recommended dashboards for monitoring the ChatOps Teams application using Azure Application Insights.

## Table of Contents

- [Dashboard Overview](#dashboard-overview)
- [Operational Dashboard](#operational-dashboard)
- [Business Metrics Dashboard](#business-metrics-dashboard)
- [Security Dashboard](#security-dashboard)
- [Performance Dashboard](#performance-dashboard)
- [Creating Dashboards](#creating-dashboards)
- [Workbook Templates](#workbook-templates)

## Dashboard Overview

Azure Application Insights provides several ways to visualize telemetry data:

1. **Azure Portal Dashboards**: Pin charts to shared dashboards
2. **Workbooks**: Interactive reports with parameters and multiple visualizations
3. **Power BI**: Export data to Power BI for advanced analytics
4. **Grafana**: Use Azure Monitor data source for Grafana dashboards

## Operational Dashboard

The Operational Dashboard provides real-time health and performance metrics for day-to-day operations.

### Key Metrics

#### Request Rate
**Purpose**: Monitor incoming webhook and API request volume  
**Query**:
```kusto
requests
| where timestamp > ago(24h)
| summarize requestCount = count() by bin(timestamp, 5m)
| render timechart
```

**Threshold**: Alert if request rate drops below 10/minute (may indicate webhook delivery issues)

#### Average Response Time
**Purpose**: Track application responsiveness  
**Query**:
```kusto
requests
| where timestamp > ago(24h)
| summarize avgDuration = avg(duration) by bin(timestamp, 5m)
| render timechart
```

**Threshold**: Alert if average response time exceeds 2000ms

#### Error Rate
**Purpose**: Monitor application health  
**Query**:
```kusto
requests
| where timestamp > ago(24h)
| summarize 
    total = count(),
    failed = countif(success == false)
    by bin(timestamp, 5m)
| extend errorRate = (failed * 100.0) / total
| render timechart
```

**Threshold**: Alert if error rate exceeds 5%

#### Exception Count
**Purpose**: Track application exceptions  
**Query**:
```kusto
exceptions
| where timestamp > ago(24h)
| summarize count() by bin(timestamp, 5m)
| render timechart
```

**Threshold**: Alert if exceptions exceed 10/minute

#### Dependency Failure Rate
**Purpose**: Monitor external service health  
**Query**:
```kusto
dependencies
| where timestamp > ago(1h)
| summarize 
    total = count(),
    failed = countif(success == false)
    by target
| extend failureRate = (failed * 100.0) / total
| project target, failureRate, total, failed
| order by failureRate desc
```

**Threshold**: Alert if any dependency failure rate exceeds 10%

#### Active Alerts
**Purpose**: Current Application Insights alerts firing  
**Source**: Azure Monitor Alerts view

### Layout Recommendation

```
+------------------+------------------+------------------+
|  Request Rate    | Avg Response Time|   Error Rate     |
|   (Line Chart)   |   (Line Chart)   |  (Line Chart)    |
+------------------+------------------+------------------+
|  Exception Count | Dependency Failures | Active Alerts |
|   (Line Chart)   |    (Table)       |    (List)        |
+------------------+------------------+------------------+
```

## Business Metrics Dashboard

The Business Metrics Dashboard tracks ChatOps-specific KPIs and business value.

### Key Metrics

#### Webhooks Processed (by type)
**Purpose**: Track webhook processing volume and distribution  
**Query**:
```kusto
customMetrics
| where name == "WebhookProcessingTime"
| where timestamp > ago(24h)
| extend webhookType = tostring(customDimensions.webhookType)
| summarize count() by webhookType
| render piechart
```

#### Webhook Processing Time
**Purpose**: Monitor webhook processing performance  
**Query**:
```kusto
customMetrics
| where name == "WebhookProcessingTime"
| where timestamp > ago(24h)
| extend webhookType = tostring(customDimensions.webhookType)
| summarize avgDuration = avg(value) by webhookType, bin(timestamp, 1h)
| render timechart
```

#### Notifications Sent (by channel)
**Purpose**: Track notification delivery  
**Query**:
```kusto
customEvents
| where name == "AlertNotificationSent"
| where timestamp > ago(24h)
| extend notificationChannel = tostring(customDimensions.notificationChannel)
| summarize count() by notificationChannel
| render piechart
```

#### Notification Success Rate
**Purpose**: Monitor notification delivery reliability  
**Query**:
```kusto
customEvents
| where name == "AlertNotificationSent"
| where timestamp > ago(24h)
| extend 
    alertType = tostring(customDimensions.alertType),
    success = tostring(customDimensions.success)
| summarize 
    total = count(),
    successful = countif(success == "true")
    by alertType
| extend successRate = round((successful * 100.0) / total, 2)
| project alertType, successRate, total
| render barchart
```

#### Deployment Approvals (approved/rejected)
**Purpose**: Track deployment approval decisions  
**Query**:
```kusto
customMetrics
| where name == "DeploymentApprovalTime"
| where timestamp > ago(7d)
| extend outcome = tostring(customDimensions.outcome)
| summarize count() by outcome
| render piechart
```

#### Deployment Approval Time
**Purpose**: Monitor time to approve deployments  
**Query**:
```kusto
customMetrics
| where name == "DeploymentApprovalTime"
| where timestamp > ago(7d)
| extend 
    environment = tostring(customDimensions.environment),
    outcome = tostring(customDimensions.outcome)
| where outcome == "approved"
| summarize avgMinutes = avg(value) / 1000 / 60 by environment
| render barchart
```

#### User Mapping Success Rate
**Purpose**: Monitor GitHub to Entra ID mapping effectiveness  
**Query**:
```kusto
customEvents
| where name == "UserMappingSuccess"
| where timestamp > ago(7d)
| extend 
    mappingMethod = tostring(customDimensions.mappingMethod),
    success = tostring(customDimensions.success)
| summarize 
    total = count(),
    successful = countif(success == "true")
    by mappingMethod
| extend successRate = round((successful * 100.0) / total, 2)
| render barchart
```

#### Most Active Repositories
**Purpose**: Identify repositories generating most activity  
**Query**:
```kusto
union customEvents, customMetrics
| where timestamp > ago(7d)
| extend repository = tostring(customDimensions.repository)
| where isnotempty(repository)
| summarize activityCount = count() by repository
| order by activityCount desc
| take 10
| render barchart
```

### Layout Recommendation

```
+------------------+------------------+------------------+
| Webhooks by Type | Notifications by | Approvals by     |
|   (Pie Chart)    |  Channel (Pie)   | Outcome (Pie)    |
+------------------+------------------+------------------+
| Webhook Processing| Notification    | Approval Time    |
|  Time (Line)     | Success (Bar)    | by Env (Bar)     |
+------------------+------------------+------------------+
| User Mapping     | Active Repos     |                  |
| Success (Bar)    | (Bar Chart)      |                  |
+------------------+------------------+------------------+
```

## Security Dashboard

The Security Dashboard monitors security-related events and potential threats.

### Key Metrics

#### Failed Authentication Attempts
**Purpose**: Detect potential unauthorized access  
**Query**:
```kusto
requests
| where timestamp > ago(24h)
| where resultCode == 401
| summarize count() by bin(timestamp, 15m), url
| render timechart
```

**Threshold**: Alert if failed auth attempts exceed 50/hour

#### Suspicious API Calls
**Purpose**: Identify unusual API call patterns  
**Query**:
```kusto
dependencies
| where timestamp > ago(24h)
| where target == "api.github.com"
| where resultCode in (403, 429)
| summarize count() by name, resultCode
| order by count_ desc
```

**Threshold**: Alert if rate limit (429) hits exceed 10/hour

#### Rate Limit Violations
**Purpose**: Monitor GitHub API rate limit usage  
**Query**:
```kusto
dependencies
| where timestamp > ago(24h)
| where target == "api.github.com"
| where resultCode == 429
| summarize count() by bin(timestamp, 1h)
| render timechart
```

#### Unauthorized Access Attempts
**Purpose**: Track 403 Forbidden responses  
**Query**:
```kusto
union requests, dependencies
| where timestamp > ago(24h)
| where resultCode == 403
| summarize count() by itemType, name
| order by count_ desc
```

#### Exception by Type
**Purpose**: Monitor security-related exceptions  
**Query**:
```kusto
exceptions
| where timestamp > ago(24h)
| extend securityRelated = type contains "Auth" or type contains "Permission" or type contains "Forbidden"
| where securityRelated
| summarize count() by type
| render piechart
```

#### Alert Processing Failures
**Purpose**: Identify failed security alert processing  
**Query**:
```kusto
customMetrics
| where name == "WebhookProcessingTime"
| where timestamp > ago(24h)
| extend 
    webhookType = tostring(customDimensions.webhookType),
    success = tostring(customDimensions.success)
| where webhookType in ("code_scanning_alert", "secret_scanning_alert", "dependabot_alert")
| where success == "false"
| summarize failureCount = count() by webhookType
```

### Layout Recommendation

```
+------------------+------------------+------------------+
| Failed Auth      | Suspicious API   | Rate Limit       |
| Attempts (Line)  | Calls (Table)    | Violations (Line)|
+------------------+------------------+------------------+
| Unauthorized     | Security         | Alert Processing |
| Access (Table)   | Exceptions (Pie) | Failures (Bar)   |
+------------------+------------------+------------------+
```

## Performance Dashboard

The Performance Dashboard provides deep insights into application performance characteristics.

### Key Metrics

#### Request Duration Percentiles
**Purpose**: Track response time distribution  
**Query**:
```kusto
requests
| where timestamp > ago(24h)
| summarize 
    p50 = percentile(duration, 50),
    p95 = percentile(duration, 95),
    p99 = percentile(duration, 99)
    by bin(timestamp, 15m)
| render timechart
```

#### Slowest Operations
**Purpose**: Identify performance bottlenecks  
**Query**:
```kusto
requests
| where timestamp > ago(24h)
| summarize 
    avgDuration = avg(duration),
    p95Duration = percentile(duration, 95),
    count = count()
    by name
| order by avgDuration desc
| take 10
```

#### Dependency Performance
**Purpose**: Monitor external service response times  
**Query**:
```kusto
dependencies
| where timestamp > ago(24h)
| summarize 
    avgDuration = avg(duration),
    p95Duration = percentile(duration, 95)
    by target, name
| order by avgDuration desc
| take 10
```

#### GitHub API Response Times
**Purpose**: Track GitHub API performance  
**Query**:
```kusto
dependencies
| where target == "api.github.com"
| where timestamp > ago(24h)
| summarize 
    avgDuration = avg(duration),
    p95Duration = percentile(duration, 95)
    by name, bin(timestamp, 1h)
| render timechart
```

#### Memory Usage
**Purpose**: Monitor application memory consumption  
**Query**:
```kusto
performanceCounters
| where timestamp > ago(24h)
| where name == "Available Bytes"
| summarize avg(value) by bin(timestamp, 5m)
| render timechart
```

#### CPU Usage
**Purpose**: Monitor processor utilization  
**Query**:
```kusto
performanceCounters
| where timestamp > ago(24h)
| where name == "% Processor Time"
| summarize avg(value) by bin(timestamp, 5m)
| render timechart
```

### Layout Recommendation

```
+------------------+------------------+------------------+
| Duration         | Slowest          | Dependency       |
| Percentiles(Line)| Operations(Table)| Performance(Table)|
+------------------+------------------+------------------+
| GitHub API       | Memory Usage     | CPU Usage        |
| Response (Line)  | (Line Chart)     | (Line Chart)     |
+------------------+------------------+------------------+
```

## Creating Dashboards

### Azure Portal Dashboards

1. Navigate to Azure Portal → Application Insights → your resource
2. Go to Logs and create your KQL query
3. Click "Pin to dashboard" button
4. Select existing dashboard or create new
5. Repeat for all desired charts

### Creating Workbooks

1. Navigate to Azure Portal → Application Insights → Workbooks
2. Click "New" or select a template
3. Add query blocks using KQL
4. Add parameters for interactivity (time range, environment, etc.)
5. Save as workbook template
6. Share with team members

Example workbook structure:
```json
{
  "version": "Notebook/1.0",
  "items": [
    {
      "type": 1,
      "content": {
        "json": "## Operational Dashboard\n\nReal-time health and performance metrics"
      }
    },
    {
      "type": 9,
      "content": {
        "version": "KqlParameterItem/1.0",
        "parameters": [
          {
            "id": "time-range",
            "name": "TimeRange",
            "type": 4,
            "value": {
              "durationMs": 86400000
            }
          }
        ]
      }
    }
  ]
}
```

### Sharing Dashboards

1. **Portal Dashboards**: Use "Share" button → Set permissions
2. **Workbooks**: Click "Share" → Generate link or export as template
3. **ARM Templates**: Export dashboard as ARM template for deployment
4. **Gallery**: Publish to shared gallery for organization-wide access

## Workbook Templates

See [application-insights-workbook.json](./application-insights-workbook.json) for a complete workbook template that includes:

- Operational metrics (requests, errors, response times)
- Business metrics (webhooks, notifications, approvals)
- Performance metrics (percentiles, dependencies)
- Security metrics (failed auth, suspicious activity)

### Importing Workbook Template

1. Navigate to Application Insights → Workbooks
2. Click "New" → Advanced Editor
3. Paste the JSON from `application-insights-workbook.json`
4. Click "Apply"
5. Save workbook with descriptive name

## Best Practices

### Dashboard Design

1. **Keep it simple**: Focus on key metrics, avoid clutter
2. **Use appropriate visualizations**: 
   - Line charts for trends over time
   - Pie charts for distribution
   - Tables for detailed data
   - Bar charts for comparisons
3. **Set time ranges**: Use relative time ranges (last 24h, last 7d)
4. **Add context**: Include metric descriptions and thresholds
5. **Organize logically**: Group related metrics together

### Performance Optimization

1. **Limit time ranges**: Shorter ranges = faster queries
2. **Use summarization**: Aggregate data before displaying
3. **Cache results**: Use workbook caching for slow queries
4. **Avoid complex joins**: Pre-aggregate data when possible
5. **Use parameters**: Allow users to filter data interactively

### Maintenance

1. **Review regularly**: Ensure metrics are still relevant
2. **Update thresholds**: Adjust alert thresholds based on baselines
3. **Archive old dashboards**: Remove unused dashboards
4. **Document changes**: Track dashboard version history
5. **Test queries**: Validate KQL queries after schema changes

## Additional Resources

- [KQL Query Examples](./application-insights-kql-queries.md)
- [Custom Metrics Documentation](./application-insights-custom-metrics.md)
- [Troubleshooting Guide](./application-insights-troubleshooting.md)
- [Azure Dashboards Documentation](https://docs.microsoft.com/azure/azure-portal/azure-portal-dashboards)
- [Workbooks Documentation](https://docs.microsoft.com/azure/azure-monitor/visualize/workbooks-overview)
