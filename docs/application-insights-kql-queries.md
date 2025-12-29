# Application Insights KQL Query Examples

This document provides a comprehensive collection of Kusto Query Language (KQL) queries for monitoring and analyzing the ChatOps Teams application using Azure Application Insights.

## Table of Contents

- [Performance Queries](#performance-queries)
- [Error Queries](#error-queries)
- [Business Metrics](#business-metrics)
- [Dependency Health](#dependency-health)
- [User Activity](#user-activity)
- [Advanced Analysis](#advanced-analysis)

## Performance Queries

### Average request duration by operation

```kusto
requests
| where timestamp > ago(24h)
| summarize avg(duration), count() by name
| order by avg_duration desc
```

### P50, P95, P99 response times

```kusto
requests
| where timestamp > ago(1h)
| summarize 
    p50=percentile(duration, 50),
    p95=percentile(duration, 95),
    p99=percentile(duration, 99)
| project p50, p95, p99
```

### Slowest dependencies

```kusto
dependencies
| where timestamp > ago(24h)
| summarize avg(duration), count() by target, name
| order by avg_duration desc
| take 10
```

### Request throughput over time

```kusto
requests
| where timestamp > ago(24h)
| summarize requestCount = count() by bin(timestamp, 5m)
| render timechart
```

### Performance degradation detection

```kusto
requests
| where timestamp > ago(24h)
| summarize avgDuration = avg(duration) by bin(timestamp, 15m), name
| order by timestamp desc, avgDuration desc
| render timechart
```

## Error Queries

### Exception rate by type

```kusto
exceptions
| where timestamp > ago(24h)
| summarize count() by type, outerMessage
| order by count_ desc
```

### Failed requests with details

```kusto
requests
| where timestamp > ago(1h) and success == false
| project timestamp, name, url, resultCode, duration
| order by timestamp desc
```

### Top 10 error messages

```kusto
exceptions
| where timestamp > ago(24h)
| summarize count() by outerMessage
| order by count_ desc
| take 10
```

### Error rate trend

```kusto
requests
| where timestamp > ago(24h)
| summarize 
    total = count(),
    failed = countif(success == false)
    by bin(timestamp, 30m)
| extend errorRate = (failed * 100.0) / total
| render timechart
```

### Failed requests by status code

```kusto
requests
| where timestamp > ago(24h) and success == false
| summarize count() by resultCode
| render piechart
```

## Business Metrics

### Webhook processing by type

```kusto
customMetrics
| where name == "WebhookProcessingTime"
| summarize avg(value), count() by tostring(customDimensions.webhookType)
```

### Webhook processing time trend

```kusto
customMetrics
| where name == "WebhookProcessingTime"
| where timestamp > ago(24h)
| extend webhookType = tostring(customDimensions.webhookType)
| summarize avgDuration = avg(value) by webhookType, bin(timestamp, 1h)
| render timechart
```

### Alert notifications sent

```kusto
customEvents
| where name == "AlertNotificationSent"
| summarize count() by tostring(customDimensions.alertType)
| render piechart
```

### Notification success rate

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
| project alertType, total, successful, successRate
```

### Deployment approval metrics

```kusto
customMetrics
| where name == "DeploymentApprovalTime"
| where timestamp > ago(24h)
| extend 
    environment = tostring(customDimensions.environment),
    outcome = tostring(customDimensions.outcome)
| summarize 
    avgApprovalTime = avg(value) / 1000 / 60,
    count = count()
    by environment, outcome
| project environment, outcome, avgApprovalMinutes = avgApprovalTime, approvalCount = count
```

### User mapping success rate

```kusto
customEvents
| where name == "UserMappingSuccess"
| where timestamp > ago(24h)
| extend 
    mappingMethod = tostring(customDimensions.mappingMethod),
    success = tostring(customDimensions.success)
| summarize 
    total = count(),
    successful = countif(success == "true")
    by mappingMethod
| extend successRate = round((successful * 100.0) / total, 2)
| project mappingMethod, total, successful, successRate
```

## Dependency Health

### Dependency success rate

```kusto
dependencies
| where timestamp > ago(1h)
| summarize total=count(), failed=countif(success==false) by target
| extend successRate = (total-failed)*100.0/total
| project target, successRate, total, failed
| order by successRate asc
```

### GitHub API call patterns

```kusto
dependencies
| where target == "api.github.com"
| where timestamp > ago(24h)
| summarize count() by name, bin(timestamp, 1h)
| render timechart
```

### GitHub API response times

```kusto
dependencies
| where target == "api.github.com"
| where timestamp > ago(24h)
| summarize 
    avg_duration = avg(duration),
    p95_duration = percentile(duration, 95),
    count = count()
    by name
| order by avg_duration desc
```

### Microsoft Graph API performance

```kusto
dependencies
| where target == "graph.microsoft.com"
| where timestamp > ago(24h)
| summarize 
    avgDuration = avg(duration),
    count = count()
    by name
| order by avgDuration desc
```

### Teams API call success rate

```kusto
dependencies
| where target == "smba.trafficmanager.net"
| where timestamp > ago(24h)
| summarize 
    total = count(),
    failed = countif(success == false)
    by name
| extend failureRate = round((failed * 100.0) / total, 2)
| project name, total, failed, failureRate
| order by failureRate desc
```

### All dependency failures

```kusto
dependencies
| where timestamp > ago(1h) and success == false
| summarize 
    failureCount = count(),
    avgDuration = avg(duration)
    by target, name, resultCode
| order by failureCount desc
```

## User Activity

### Active users over time

```kusto
customEvents
| where timestamp > ago(7d)
| where name in ("AlertNotificationSent", "DeploymentApprovalTime")
| extend userId = tostring(customDimensions.approver)
| where isnotempty(userId)
| summarize dcount(userId) by bin(timestamp, 1d)
| render timechart
```

### Most active repositories

```kusto
union customEvents, customMetrics
| where timestamp > ago(7d)
| extend repository = tostring(customDimensions.repository)
| where isnotempty(repository)
| summarize activityCount = count() by repository
| order by activityCount desc
| take 20
```

### Alert activity by severity

```kusto
customMetrics
| where name == "WebhookProcessingTime"
| where timestamp > ago(7d)
| extend severity = tostring(customDimensions.severity)
| where isnotempty(severity)
| summarize count() by severity
| render piechart
```

## Advanced Analysis

### End-to-end transaction tracing

```kusto
union requests, dependencies, customEvents
| where operation_Id == "<webhook-delivery-id>"
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

### Application Map data

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

### Correlation between metrics

```kusto
let webhookProcessing = customMetrics
| where name == "WebhookProcessingTime"
| where timestamp > ago(1h)
| extend webhookType = tostring(customDimensions.webhookType)
| summarize avgWebhookTime = avg(value) by bin(timestamp, 5m), webhookType;
let notificationsSent = customEvents
| where name == "AlertNotificationSent"
| where timestamp > ago(1h)
| extend alertType = tostring(customDimensions.alertType)
| summarize notificationCount = count() by bin(timestamp, 5m), alertType;
webhookProcessing
| join kind=leftouter (notificationsSent) on $left.timestamp == $right.timestamp
| project timestamp, webhookType, avgWebhookTime, notificationCount
```

### Performance baseline comparison

```kusto
let baseline = requests
| where timestamp between (ago(7d) .. ago(1d))
| summarize baselineAvg = avg(duration), baselineP95 = percentile(duration, 95);
let current = requests
| where timestamp > ago(1h)
| summarize currentAvg = avg(duration), currentP95 = percentile(duration, 95);
baseline | extend currentAvg = toscalar(current | project currentAvg)
| extend currentP95 = toscalar(current | project currentP95)
| extend avgChange = round((currentAvg - baselineAvg) * 100.0 / baselineAvg, 2)
| extend p95Change = round((currentP95 - baselineP95) * 100.0 / baselineP95, 2)
| project baselineAvg, currentAvg, avgChange, baselineP95, currentP95, p95Change
```

### Resource utilization over time

```kusto
performanceCounters
| where timestamp > ago(24h)
| where name in ("% Processor Time", "Available Bytes")
| summarize avg(value) by name, bin(timestamp, 15m)
| render timechart
```

## Useful Filters and Operators

### Filter by environment

```kusto
requests
| where customDimensions.environment == "production"
```

### Filter by specific time window

```kusto
requests
| where timestamp between (datetime(2025-01-01) .. datetime(2025-01-02))
```

### Filter by operation success

```kusto
dependencies
| where success == true
```

### Aggregate by custom dimension

```kusto
customEvents
| extend repository = tostring(customDimensions.repository)
| summarize count() by repository
```

## Best Practices

1. **Use time filters**: Always filter by `timestamp > ago(Xh)` to limit data scanned
2. **Project early**: Use `project` to select only needed columns early in the query
3. **Summarize before joins**: Aggregate data before joining to reduce memory usage
4. **Use bin() for time series**: Group timestamps into bins for time-series charts
5. **Limit results**: Use `take N` or `top N` to limit result sets
6. **Use extends wisely**: Extract custom dimensions once and reuse the variable

## Additional Resources

- [Kusto Query Language (KQL) Reference](https://docs.microsoft.com/azure/data-explorer/kusto/query/)
- [Application Insights Query Documentation](https://docs.microsoft.com/azure/azure-monitor/logs/get-started-queries)
- [Custom Metrics Documentation](./application-insights-custom-metrics.md)
- [Troubleshooting Guide](./application-insights-troubleshooting.md)
