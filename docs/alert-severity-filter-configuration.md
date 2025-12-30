# Alert Severity Filter Configuration Example

This document explains how to configure the alert severity filter for code scanning alerts.

## Default Configuration

By default, the severity filter uses the following settings:

```javascript
{
  minEscalationSeverity: 'high',
  repositoryOverrides: {}
}
```

This means:
- **Critical** severity alerts → **Escalated** (sent to Teams)
- **High** severity alerts → **Escalated** (sent to Teams)
- **Medium** severity alerts → **Logged only** (not escalated)
- **Low** severity alerts → **Logged only** (not escalated)
- **Warning** severity alerts → **Logged only** (not escalated)
- **Note** severity alerts → **Logged only** (not escalated)

All alerts are logged to Azure Log Analytics via Application Insights regardless of escalation.

## Repository-Specific Overrides

You can configure different severity thresholds for specific repositories.

### Example: Lower Threshold for Critical Repositories

For repositories that require more attention, you can lower the threshold to `medium`:

```javascript
const { setConfiguration } = require('./bot/alertSeverityFilter');

setConfiguration({
  minEscalationSeverity: 'high', // Global default
  repositoryOverrides: {
    'myorg/critical-service': {
      minEscalationSeverity: 'medium', // Escalate medium and above
    },
    'myorg/payment-api': {
      minEscalationSeverity: 'medium',
    },
  },
});
```

With this configuration:
- Alerts in `myorg/critical-service` with severity **medium or higher** are escalated
- Alerts in `myorg/payment-api` with severity **medium or higher** are escalated
- Alerts in other repositories follow the global default (high or higher)

### Example: Higher Threshold for Low-Priority Repositories

For repositories with lower priority, you can raise the threshold to `critical`:

```javascript
setConfiguration({
  minEscalationSeverity: 'high', // Global default
  repositoryOverrides: {
    'myorg/legacy-tool': {
      minEscalationSeverity: 'critical', // Only escalate critical
    },
    'myorg/experimental-project': {
      minEscalationSeverity: 'critical',
    },
  },
});
```

## Severity Levels

GitHub Code Scanning supports the following severity levels (from highest to lowest):

| Severity | Numeric Value | Description |
|----------|---------------|-------------|
| `critical` | 4 | Critical vulnerabilities requiring immediate attention |
| `high` | 3 | High-severity issues that should be addressed soon |
| `error` | 3 | Mapped to high severity |
| `medium` | 2 | Medium-severity issues for consideration |
| `low` | 1 | Low-severity issues or code quality concerns |
| `warning` | 1 | Same as low |
| `note` | 0 | Informational findings |

## Metadata Extraction

The severity filter automatically extracts vulnerability metadata from alerts:

### CWE (Common Weakness Enumeration)
- Extracted from `alert.rule.tags` (e.g., `external/cwe/cwe-89`)
- Extracted from `alert.rule.help` text (e.g., "CWE-89")

### CVE (Common Vulnerabilities and Exposures)
- Extracted from `alert.rule.tags` (e.g., `external/cve/cve-2021-44228`)
- Extracted from `alert.rule.description` and `alert.rule.help`

### CVSS Score
- Extracted from `alert.rule.security_severity_level`
- Extracted from tags (e.g., `cvss:8.5`)

### Affected Files
- Extracted from `alert.most_recent_instance.location`
- Includes file path and line numbers

## Implementation Location

To configure severity filtering in your application, add the configuration in your server startup code:

```javascript
// In server.js or application initialization
const { setConfiguration } = require('./bot/alertSeverityFilter');

// Load configuration from environment or config file
const config = {
  minEscalationSeverity: process.env.MIN_ESCALATION_SEVERITY || 'high',
  repositoryOverrides: JSON.parse(process.env.REPOSITORY_OVERRIDES || '{}'),
};

setConfiguration(config);
```

## Environment Variable Example

You can also configure via environment variables:

```bash
# Default threshold
MIN_ESCALATION_SEVERITY=high

# Repository overrides (JSON format)
REPOSITORY_OVERRIDES='{"myorg/critical-repo":{"minEscalationSeverity":"medium"}}'
```

## Monitoring

All alert processing is tracked in Application Insights with the following metrics:

- **GitHubWebhookReceived**: Event for each alert received
  - Includes: `severity`, `shouldEscalate`, `cweIds`, `cveIds`, `cvssScore`
- **CodeScanningAlertsBySeverity**: Metric by severity level
  - Includes: `severity`, `repository`, `shouldEscalate`
- **CodeScanningAlertsEscalated**: Metric for escalated alerts only
  - Includes: `severity`, `repository`

## KQL Queries

### View Escalated Alerts

```kql
customEvents
| where name == "GitHubWebhookReceived"
| where customDimensions.eventType == "code_scanning_alert"
| where customDimensions.shouldEscalate == "true"
| project timestamp, repository=customDimensions.repository, 
    severity=customDimensions.severity, alertNumber=customDimensions.alertNumber
| order by timestamp desc
```

### View Logged-Only Alerts

```kql
customEvents
| where name == "GitHubWebhookReceived"
| where customDimensions.eventType == "code_scanning_alert"
| where customDimensions.shouldEscalate == "false"
| project timestamp, repository=customDimensions.repository, 
    severity=customDimensions.severity, alertNumber=customDimensions.alertNumber
| order by timestamp desc
```

### Escalation Rate by Repository

```kql
customEvents
| where name == "GitHubWebhookReceived"
| where customDimensions.eventType == "code_scanning_alert"
| summarize 
    Total=count(),
    Escalated=countif(customDimensions.shouldEscalate == "true")
    by repository=tostring(customDimensions.repository)
| extend EscalationRate = (Escalated * 100.0) / Total
| order by EscalationRate desc
```

## Best Practices

1. **Start Conservative**: Begin with the default `high` threshold and adjust based on team capacity
2. **Monitor Escalation Rates**: Use Application Insights to track how many alerts are escalated
3. **Adjust Gradually**: Make small adjustments to thresholds based on actual alert volume
4. **Document Exceptions**: Clearly document why specific repositories have custom thresholds
5. **Review Regularly**: Periodically review configuration to ensure it meets current needs
