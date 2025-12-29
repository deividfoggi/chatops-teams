# Application Insights Alert Runbook

This runbook provides guidance for responding to Application Insights alerts configured for the ChatOps Teams application.

## Table of Contents

- [Overview](#overview)
- [Alert Configuration Summary](#alert-configuration-summary)
- [High Exception Rate Alert](#high-exception-rate-alert)
- [Failed Dependency Alert](#failed-dependency-alert)
- [Slow Response Time Alert](#slow-response-time-alert)
- [Escalation Procedures](#escalation-procedures)
- [Post-Incident Review](#post-incident-review)

## Overview

The ChatOps Teams application uses Azure Application Insights for monitoring and alerting. Alerts are configured via Terraform and managed through Azure Monitor. All alerts notify the Operations Team via email through the `ops-alerts` action group.

### Alert Severity Levels

| Severity | Level | Description |
|----------|-------|-------------|
| 0 | Critical | Service is completely unavailable |
| 1 | Error | Significant functionality is impaired |
| 2 | Warning | Issues detected that may impact users |
| 3 | Informational | Issues to be aware of but not urgent |
| 4 | Verbose | Detailed information for analysis |

## Alert Configuration Summary

| Alert Name | Severity | Evaluation | Window | Threshold |
|------------|----------|------------|--------|-----------|
| High Exception Rate | 2 (Warning) | Every 1 min | 5 min | > 10 exceptions |
| Failed Dependency | 2 (Warning) | Every 5 min | 15 min | > 5 failures |
| Slow Response Time | 3 (Informational) | Every 5 min | 5 min | > 5000ms avg |
| Availability Test Failure | 1 (Error) | Every 5 min | 10 min | ≥ 2 regions failing |

---

## High Exception Rate Alert

### Description

This alert fires when the application logs more than 10 exceptions within a 5-minute window. This may indicate application bugs, configuration issues, or external service problems.

### Investigation Steps

1. **Access Application Insights**
   - Navigate to the Azure Portal
   - Go to the Application Insights resource: `chatops-appinsights`
   - Select **Failures** from the left menu

2. **Analyze Exception Patterns**
   - Review the **Exceptions** tab to identify the most common exception types
   - Check the **Exception Message** and **Stack Trace** for root cause clues
   - Note the **Component** and **Cloud Role Name** to identify which service is affected

3. **Check Recent Changes**
   - Review recent deployments via GitHub Actions workflows
   - Check for configuration changes in the last 24 hours
   - Verify any infrastructure changes via Terraform

4. **Query for Exception Details**
   ```kusto
   exceptions
   | where timestamp > ago(1h)
   | summarize count() by problemId, outerMessage
   | order by count_ desc
   | take 10
   ```

### Resolution Actions

- **Code Bug:** Create a GitHub issue and prioritize based on impact
- **Configuration Issue:** Verify Key Vault secrets and app settings
- **External Service:** Check dependency health and consider circuit breaker patterns
- **Infrastructure:** Verify network connectivity and NSG rules

### Escalation

If exceptions persist after 30 minutes of investigation, escalate to the development team lead.

---

## Failed Dependency Alert

### Description

This alert fires when more than 5 dependency calls fail within a 15-minute window. Dependencies include external APIs, databases, and Azure services that the application relies on.

### Investigation Steps

1. **Access Application Insights**
   - Navigate to the Azure Portal
   - Go to the Application Insights resource: `chatops-appinsights`
   - Select **Application Map** to visualize dependency health

2. **Identify Failed Dependencies**
   - Select **Failures** → **Dependencies** tab
   - Look for dependencies with high failure rates
   - Note the dependency type (HTTP, SQL, Azure, etc.)

3. **Query for Dependency Details**
   ```kusto
   dependencies
   | where timestamp > ago(1h)
   | where success == false
   | summarize count() by target, name, resultCode
   | order by count_ desc
   | take 10
   ```

4. **Check Dependency Status**
   - Verify the external service is available (Azure Status page, third-party status pages)
   - Check network connectivity from the app subnet
   - Verify credentials and authentication tokens haven't expired

### Resolution Actions

- **Network Issue:** Check NSG rules and verify subnet configuration
- **Authentication Failure:** Rotate credentials in Key Vault and restart the application
- **Service Outage:** Enable fallback mechanisms or graceful degradation
- **Rate Limiting:** Implement retry with exponential backoff

### Escalation

If dependency failures persist or impact user experience, escalate to the infrastructure team.

---

## Slow Response Time Alert

### Description

This alert fires when the average response time exceeds 5 seconds over a 5-minute window. This may indicate performance issues, resource constraints, or slow dependencies.

### Investigation Steps

1. **Access Application Insights**
   - Navigate to the Azure Portal
   - Go to the Application Insights resource: `chatops-appinsights`
   - Select **Performance** from the left menu

2. **Identify Slow Operations**
   - Review the **Operations** list sorted by average duration
   - Click on slow operations to view detailed traces
   - Check the **Samples** tab for individual request traces

3. **Query for Slow Requests**
   ```kusto
   requests
   | where timestamp > ago(1h)
   | where duration > 5000
   | summarize count(), avg(duration) by name, resultCode
   | order by avg_duration desc
   | take 10
   ```

4. **Check End-to-End Traces**
   - Use the **End-to-end transaction details** view
   - Identify which component (app code, dependency, database) is slow
   - Look for unusual patterns in timing

### Resolution Actions

- **App Code Performance:** Profile the application and optimize hot paths
- **Database Slowness:** Check query execution plans and add indexes if needed
- **Memory Pressure:** Scale up the App Service plan or optimize memory usage
- **Cold Start:** Consider Always-On settings for the App Service

### Escalation

If response times remain elevated for more than 1 hour, escalate to the development and infrastructure teams.

---

## Availability Test Failure Alert

### Description

This alert fires when availability tests fail from 2 or more regions within a 10-minute window. This indicates a potential service outage or significant degradation affecting global users.

### Investigation Steps

1. **Access Application Insights**
   - Navigate to the Azure Portal
   - Go to the Application Insights resource: `chatops-appinsights`
   - Select **Availability** from the left menu

2. **Review Test Results**
   - Check the availability timeline to see which regions are failing
   - Click on failed tests to see detailed error messages
   - Note the pattern: Is it all regions or specific ones?
   - Check the response time trends for degradation

3. **Query for Availability Details**
   ```kusto
   availabilityResults
   | where timestamp > ago(1h)
   | where success == false
   | summarize count() by location, name, resultCode
   | order by count_ desc
   ```

4. **Check Application Health**
   - Verify the App Service is running in the Azure Portal
   - Check App Service metrics (CPU, Memory, HTTP errors)
   - Review the `/health` endpoint response manually
   - Check recent deployments that might have broken the health check

### Resolution Actions

- **App Service Down:** Restart the App Service or investigate crashes
- **Health Endpoint Issue:** Fix the `/health` endpoint implementation
- **SSL Certificate:** Renew or update SSL certificate if expiring
- **Network Issue:** Check NSG rules, firewall settings, and DNS resolution
- **Regional Outage:** Verify Azure status page for regional issues
- **DDoS Attack:** Check for abnormal traffic patterns and enable DDoS protection

### Escalation

If availability tests fail from multiple regions for more than 15 minutes, this is a **critical incident**. Immediately escalate to the development team lead and infrastructure team. Consider paging on-call engineers.

---

## Escalation Procedures

### Escalation Levels

| Level | Contact | When to Escalate |
|-------|---------|------------------|
| L1 | Operations Team | First responder for all alerts |
| L2 | Development Team Lead | Application code issues |
| L3 | Infrastructure Team | Azure infrastructure issues |
| L4 | Management | Critical business impact |

### Communication Channels

- **Primary:** Microsoft Teams - ChatOps Operations channel
- **Secondary:** Email - ops-team@company.com
- **Emergency:** On-call rotation via PagerDuty

---

## Post-Incident Review

After resolving any significant incident:

1. **Document the Incident**
   - Record the timeline of events
   - Note the root cause and resolution steps
   - Calculate the impact (duration, affected users)

2. **Create Action Items**
   - Identify preventive measures
   - Create GitHub issues for improvements
   - Update this runbook with lessons learned

3. **Review Alert Thresholds**
   - Evaluate if alert thresholds are appropriate
   - Consider adding new alerts for gaps discovered
   - Remove or adjust noisy alerts

---

## Related Resources

- [Azure Application Insights Documentation](https://docs.microsoft.com/azure/azure-monitor/app/app-insights-overview)
- [Kusto Query Language (KQL) Reference](https://docs.microsoft.com/azure/data-explorer/kusto/query/)
- [Azure Monitor Alerts](https://docs.microsoft.com/azure/azure-monitor/alerts/alerts-overview)
- Infrastructure Terraform: `infrastructure/alerts.tf`

---

*Last Updated: November 2024*
*Maintained by: ChatOps Operations Team*
