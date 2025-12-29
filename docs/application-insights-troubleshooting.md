# Application Insights Troubleshooting

This guide covers common issues, diagnostic steps, and solutions for Application Insights telemetry in the ChatOps Teams application.

## Table of Contents

- [No Telemetry Data Appearing](#no-telemetry-data-appearing)
- [Missing Dependency Tracking](#missing-dependency-tracking)
- [High Data Ingestion Costs](#high-data-ingestion-costs)
- [Incomplete Distributed Tracing](#incomplete-distributed-tracing)
- [Missing Custom Metrics](#missing-custom-metrics)
- [Performance Issues](#performance-issues)
- [Sampling Configuration](#sampling-configuration)
- [Useful Commands](#useful-commands)

## No Telemetry Data Appearing

### Symptoms
- Empty dashboards in Azure Portal
- No requests, dependencies, or exceptions visible
- Application Map shows no data
- Live Metrics shows no activity

### Diagnostic Steps

1. **Check connection string/instrumentation key**
   ```bash
   echo $APPLICATIONINSIGHTS_CONNECTION_STRING
   ```
   Verify the connection string is set and matches the Application Insights resource.

2. **Verify SDK initialization**
   ```javascript
   // Check that telemetry is initialized at application startup
   const telemetry = getTelemetryClient({
     connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
   }).initialize();
   ```

3. **Check network connectivity**
   ```bash
   # Test connectivity to Application Insights endpoint
   curl -v https://dc.services.visualstudio.com
   ```

4. **Verify App Service configuration**
   - Navigate to Azure Portal → App Service → Configuration
   - Ensure `APPLICATIONINSIGHTS_CONNECTION_STRING` is set
   - Restart the App Service after configuration changes

5. **Check sampling rate**
   - Verify sampling is not set to 0% (which would drop all telemetry)
   - Default sampling is 90% retention

6. **Wait for data ingestion**
   - Application Insights has a 2-5 minute latency for data ingestion
   - Use Live Metrics for real-time monitoring

### Solutions

**Solution 1: Fix connection string**
```bash
# Set the correct connection string
export APPLICATIONINSIGHTS_CONNECTION_STRING="InstrumentationKey=xxx;IngestionEndpoint=https://..."
```

**Solution 2: Enable SDK initialization**
```javascript
const { getTelemetryClient } = require('./telemetry');

const telemetry = getTelemetryClient({
  connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
  environment: process.env.NODE_ENV || 'production',
}).initialize();
```

**Solution 3: Allow outbound traffic**
- Ensure firewall/NSG allows outbound HTTPS (443) to `*.services.visualstudio.com`
- For App Service with VNet integration, ensure route table allows internet egress

## Missing Dependency Tracking

### Symptoms
- Application Map is empty
- No dependencies shown in transaction details
- External API calls not tracked

### Diagnostic Steps

1. **Check auto-dependency collection**
   ```javascript
   // Verify this is called during initialization
   appInsights.setup()
     .setAutoDependencyCorrelation(true)
     .start();
   ```

2. **Verify HTTP client libraries**
   - Automatic tracking supports: `http`, `https`, `axios` (using http/https)
   - Custom HTTP clients may need manual tracking

3. **Check distributed tracing headers**
   ```bash
   # Verify Request-Id or traceparent headers are sent
   curl -v https://api.github.com/repos/owner/repo -H "Authorization: token xxx"
   ```

### Solutions

**Solution 1: Enable automatic dependency tracking**
```javascript
const appInsights = require('applicationinsights');

appInsights.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
  .setAutoDependencyCorrelation(true)
  .setAutoCollectRequests(true)
  .setAutoCollectPerformance(true)
  .setAutoCollectExceptions(true)
  .setAutoCollectDependencies(true)
  .start();
```

**Solution 2: Manual dependency tracking**
```javascript
// For custom HTTP clients or non-standard libraries
const telemetry = getTelemetryClient();

const startTime = Date.now();
const response = await customHttpClient.get('https://api.github.com/repos/owner/repo');
const duration = Date.now() - startTime;

telemetry.trackDependency({
  target: 'api.github.com',
  name: 'GET /repos/{owner}/{repo}',
  duration: duration,
  resultCode: response.status,
  success: response.status >= 200 && response.status < 300,
  dependencyTypeName: 'HTTP',
});
```

**Solution 3: Propagate correlation headers**
```javascript
// Ensure correlation headers are propagated in outgoing requests
const headers = {
  'Authorization': `token ${githubToken}`,
  'Request-Id': telemetry.context.tags['ai.operation.id'],
};
```

## High Data Ingestion Costs

### Symptoms
- Unexpectedly high Azure bill
- High volume of telemetry data ingested
- Application Insights reaching daily cap

### Diagnostic Steps

1. **Check ingestion volume**
   ```bash
   az monitor app-insights metrics show \
     --resource-group rg-chatops-prod \
     --app chatops-appinsights \
     --metric "requests/count" \
     --start-time 2025-11-27T00:00:00Z \
     --end-time 2025-11-27T23:59:59Z
   ```

2. **Review data by type**
   - Navigate to Azure Portal → Application Insights → Usage and estimated costs
   - Check breakdown by telemetry type (requests, dependencies, traces, etc.)

3. **Check sampling rate**
   ```kusto
   requests
   | where timestamp > ago(1h)
   | summarize count(), dcount(operation_Id) by itemCount
   ```

### Solutions

**Solution 1: Increase sampling rate**
```javascript
// Increase sampling from 90% to 95% (sample more data out)
appInsights.setup(connectionString)
  .setSamplingPercentage(5) // Keep only 5% of telemetry
  .start();
```

**Solution 2: Disable verbose logging**
```javascript
// Disable console log collection in production
appInsights.setup(connectionString)
  .setAutoCollectRequests(true)
  .setAutoCollectPerformance(true)
  .setAutoCollectExceptions(true)
  .setAutoCollectDependencies(true)
  .setAutoCollectConsole(false) // Disable console logs
  .setAutoCollectHeartbeat(false) // Disable heartbeat telemetry
  .start();
```

**Solution 3: Filter telemetry before sending**
```javascript
appInsights.setup(connectionString)
  .start();

// Add telemetry processor to filter out health check requests
appInsights.defaultClient.addTelemetryProcessor((envelope) => {
  if (envelope.data.baseType === 'RequestData') {
    if (envelope.data.baseData.name.includes('/health')) {
      return false; // Drop health check requests
    }
  }
  return true;
});
```

**Solution 4: Reduce retention period**
```bash
# Reduce data retention from 90 to 30 days
az monitor app-insights component update \
  --resource-group rg-chatops-prod \
  --app chatops-appinsights \
  --retention-time 30
```

**Solution 5: Set daily cap**
```bash
# Set daily ingestion cap to 5 GB
az monitor app-insights component billing update \
  --resource-group rg-chatops-prod \
  --app chatops-appinsights \
  --cap 5
```

## Incomplete Distributed Tracing

### Symptoms
- Missing correlation IDs in telemetry
- Cannot trace requests end-to-end
- Application Map shows disconnected components

### Diagnostic Steps

1. **Check correlation ID propagation**
   ```kusto
   requests
   | where timestamp > ago(1h)
   | where isempty(operation_Id)
   | count
   ```

2. **Verify middleware setup**
   ```javascript
   // Ensure tracing middleware is added before route handlers
   app.use(createTracingMiddleware(telemetry));
   app.use('/api/webhooks', webhookRoutes);
   ```

3. **Check webhook headers**
   ```bash
   # Verify X-GitHub-Delivery header is present
   curl -v -X POST http://localhost:3978/api/webhooks/github \
     -H "X-GitHub-Delivery: 12345-67890"
   ```

### Solutions

**Solution 1: Add tracing middleware**
```javascript
const { createTracingMiddleware } = require('./telemetry');

// Add at the top of middleware chain
app.use(createTracingMiddleware(telemetry));
```

**Solution 2: Manual context setting for async operations**
```javascript
// For async operations outside request context
telemetry.setOperationContext(
  webhookDeliveryId, // operationId from X-GitHub-Delivery
  'ProcessCodeScanningAlert', // operationName
  parentOperationId // optional parent operation
);
```

**Solution 3: Propagate correlation to child processes**
```javascript
const { spawn } = require('child_process');

// Pass correlation context to child processes
const child = spawn('node', ['worker.js'], {
  env: {
    ...process.env,
    CORRELATION_ID: telemetry.context.tags['ai.operation.id'],
  }
});
```

## Missing Custom Metrics

### Symptoms
- Custom metrics not appearing in Metrics Explorer
- Custom events missing from Logs
- Business KPIs not tracked

### Diagnostic Steps

1. **Verify metric tracking code**
   ```javascript
   // Check that custom metrics are being tracked
   telemetry.trackWebhookProcessingTime(duration, {
     webhookType: 'code_scanning_alert',
     repository: 'owner/repo',
   });
   ```

2. **Check custom dimensions**
   ```kusto
   customMetrics
   | where name == "WebhookProcessingTime"
   | where timestamp > ago(1h)
   | take 10
   ```

3. **Verify initialization**
   - Ensure `telemetry.initialize()` is called before tracking metrics

### Solutions

**Solution 1: Ensure proper initialization**
```javascript
const telemetry = getTelemetryClient(config).initialize();

// Now track metrics
telemetry.trackWebhookProcessingTime(1500, {
  webhookType: 'dependabot_alert',
  repository: 'owner/repo',
});
```

**Solution 2: Flush before exit**
```javascript
// For short-lived processes or Azure Functions
telemetry.flush();

// Or use async flush
await telemetry.flushAsync();
```

**Solution 3: Use correct metric names**
```javascript
// Use predefined metric names from telemetry module
telemetry.trackWebhookProcessingTime(); // Correct
telemetry.trackCustomMetric('WebhookProcessingTime'); // Avoid custom names
```

## Performance Issues

### Symptoms
- Application slowdown after enabling telemetry
- High memory usage
- Request latency increased

### Diagnostic Steps

1. **Check telemetry overhead**
   ```javascript
   // Measure time spent in telemetry calls
   const start = Date.now();
   telemetry.trackEvent('TestEvent');
   console.log('Telemetry overhead:', Date.now() - start);
   ```

2. **Review sampling configuration**
   - Lower sampling percentage = more data ingested = higher overhead

3. **Check disk caching**
   - Application Insights SDK uses disk caching for reliability
   - High disk I/O may indicate caching issues

### Solutions

**Solution 1: Use async telemetry**
```javascript
// Telemetry is sent asynchronously by default
// Avoid blocking operations
telemetry.trackEvent('MyEvent'); // Non-blocking
```

**Solution 2: Increase sampling**
```javascript
// Sample more aggressively in high-traffic scenarios
appInsights.setup(connectionString)
  .setSamplingPercentage(1) // Keep only 1% for very high volume
  .start();
```

**Solution 3: Disable unnecessary auto-collection**
```javascript
appInsights.setup(connectionString)
  .setAutoCollectRequests(true)
  .setAutoCollectPerformance(false) // Disable if not needed
  .setAutoCollectExceptions(true)
  .setAutoCollectDependencies(true)
  .setAutoCollectConsole(false)
  .setAutoCollectHeartbeat(false)
  .start();
```

**Solution 4: Use flush only when needed**
```javascript
// Only flush on process exit or critical events
process.on('SIGTERM', async () => {
  await telemetry.flushAsync();
  process.exit(0);
});
```

## Sampling Configuration

### Understanding Sampling

Application Insights uses adaptive sampling to control data volume:
- **Ingestion sampling**: Applied at SDK level before sending to Azure
- **Fixed-rate sampling**: Set via `setSamplingPercentage()`
- **Adaptive sampling**: Automatically adjusts based on telemetry volume

### Current Configuration

The ChatOps application uses 90% retention (10% sampling):
```javascript
.setSamplingPercentage(90) // Keep 90% of telemetry
```

### Adjusting Sampling

```javascript
// High-traffic environment (sample aggressively)
.setSamplingPercentage(10) // Keep 10%

// Low-traffic environment (minimal sampling)
.setSamplingPercentage(100) // Keep 100%

// Development environment (no sampling)
.setSamplingPercentage(100)
```

### Sampling Considerations

- **Pros**: Reduces costs, improves performance
- **Cons**: May miss rare errors, reduces metric accuracy
- **Recommendation**: Start with 90%, adjust based on volume and budget

## Useful Commands

### Check Application Insights configuration
```bash
az monitor app-insights component show \
  --resource-group rg-chatops-prod \
  --app chatops-appinsights
```

### View ingestion metrics
```bash
az monitor app-insights metrics show \
  --resource-group rg-chatops-prod \
  --app chatops-appinsights \
  --metric "requests/count" \
  --start-time 2025-11-27T00:00:00Z \
  --end-time 2025-11-27T23:59:59Z
```

### Check billing information
```bash
az monitor app-insights component billing show \
  --resource-group rg-chatops-prod \
  --app chatops-appinsights
```

### Export telemetry to storage (for compliance)
```bash
az monitor app-insights component continues-export create \
  --resource-group rg-chatops-prod \
  --app chatops-appinsights \
  --record-types Request Trace Exception \
  --dest-account <storage-account-id>
```

### Test connectivity
```bash
# Test Application Insights ingestion endpoint
curl -v https://dc.services.visualstudio.com/v2/track

# Test Live Metrics endpoint
curl -v https://rt.services.visualstudio.com/QuickPulseService.svc
```

### Query from CLI
```bash
az monitor app-insights query \
  --app chatops-appinsights \
  --resource-group rg-chatops-prod \
  --analytics-query "requests | where timestamp > ago(1h) | summarize count()"
```

## Getting Help

### Internal Resources
- [KQL Query Examples](./application-insights-kql-queries.md)
- [Custom Metrics Documentation](./application-insights-custom-metrics.md)
- [Dashboard Setup](./application-insights-dashboards.md)
- [Alert Runbook](./application-insights-alert-runbook.md)

### External Resources
- [Application Insights Documentation](https://docs.microsoft.com/azure/azure-monitor/app/app-insights-overview)
- [Node.js SDK Documentation](https://github.com/microsoft/ApplicationInsights-node.js)
- [Troubleshooting Guide (Microsoft)](https://docs.microsoft.com/azure/azure-monitor/app/asp-net-troubleshoot-no-data)
- [Azure Support Portal](https://portal.azure.com/#blade/Microsoft_Azure_Support/HelpAndSupportBlade)

## Common Error Messages

### Error: "The requested resource does not exist"
**Cause**: Invalid connection string or deleted Application Insights resource  
**Solution**: Verify connection string and resource existence in Azure Portal

### Error: "401 Unauthorized"
**Cause**: Invalid instrumentation key or authentication failure  
**Solution**: Regenerate connection string from Azure Portal

### Error: "Connection timeout"
**Cause**: Network connectivity issues or firewall blocking  
**Solution**: Check network configuration and allow outbound HTTPS to Azure endpoints

### Error: "Sampling dropped telemetry"
**Cause**: Sampling rate too aggressive  
**Solution**: Adjust `setSamplingPercentage()` to higher value

### Warning: "Telemetry channel is full"
**Cause**: High volume of telemetry exceeds buffer capacity  
**Solution**: Increase sampling or reduce telemetry volume
