# =============================================================================
# Azure Key Vault Monitoring and Alerting Configuration
# =============================================================================
# This file defines the monitoring and alerting infrastructure for Azure Key
# Vault to detect security incidents and operational issues following Azure
# Well-Architected Framework principles.
#
# Alert Configuration:
#   - Failed Authentication: Detects brute-force or credential stuffing attacks
#   - Secret Access Anomaly: Detects unusual access patterns
#   - Secret Expiration: Proactive notification for expiring secrets
# =============================================================================

# -----------------------------------------------------------------------------
# Security Alerts Action Group
# -----------------------------------------------------------------------------
# Action group for routing security-related alerts to the security team.
# This ensures immediate notification for security incidents.
# -----------------------------------------------------------------------------

resource "azurerm_monitor_action_group" "security_alerts" {
  name                = "security-alerts"
  resource_group_name = azurerm_resource_group.chatops.name
  short_name          = "SecAlerts"

  email_receiver {
    name                    = "security-team"
    email_address           = var.security_alert_email
    use_common_alert_schema = true
  }

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    ManagedBy   = "Terraform"
  }
}

# -----------------------------------------------------------------------------
# Alert: Key Vault Failed Authentication
# -----------------------------------------------------------------------------
# Detects multiple failed authentication attempts to Key Vault which may
# indicate brute-force attacks or credential stuffing.
#
# Configuration:
#   - Threshold: >5 failures in 15 minutes
#   - Frequency: Every 5 minutes
#   - Severity: 2 (Warning)
# -----------------------------------------------------------------------------

resource "azurerm_monitor_scheduled_query_rules_alert_v2" "kv_failed_auth" {
  name                = "kv-failed-authentication-alert"
  resource_group_name = azurerm_resource_group.chatops.name
  location            = azurerm_resource_group.chatops.location
  description         = "Alert when Key Vault authentication failures exceed threshold, indicating potential brute-force or credential stuffing attacks."
  enabled             = true
  severity            = 2

  scopes = [azurerm_log_analytics_workspace.chatops.id]

  evaluation_frequency = "PT5M"
  window_duration      = "PT15M"

  criteria {
    query = <<-QUERY
      AzureDiagnostics
      | where ResourceType == "VAULTS"
      | where ResultSignature == "Unauthorized" or ResultSignature == "Forbidden" or httpStatusCode_d >= 400
      | summarize FailedAttempts = count() by bin(TimeGenerated, 15m)
    QUERY

    time_aggregation_method = "Count"
    operator                = "GreaterThan"
    threshold               = 5

    failing_periods {
      minimum_failing_periods_to_trigger_alert = 1
      number_of_evaluation_periods             = 1
    }
  }

  action {
    action_groups = [azurerm_monitor_action_group.security_alerts.id]
  }

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    ManagedBy   = "Terraform"
  }
}

# -----------------------------------------------------------------------------
# Alert: Secret Access Anomaly
# -----------------------------------------------------------------------------
# Detects unusual patterns of secret access that may indicate data exfiltration
# or compromised credentials.
#
# Configuration:
#   - Threshold: >100 accesses from a single IP in 1 hour
#   - Frequency: Every 1 hour
#   - Severity: 1 (Error)
# -----------------------------------------------------------------------------

resource "azurerm_monitor_scheduled_query_rules_alert_v2" "kv_secret_access_anomaly" {
  name                = "kv-secret-access-anomaly-alert"
  resource_group_name = azurerm_resource_group.chatops.name
  location            = azurerm_resource_group.chatops.location
  description         = "Alert when secret access from a single IP exceeds threshold, indicating potential data exfiltration or compromised credentials."
  enabled             = true
  severity            = 1

  scopes = [azurerm_log_analytics_workspace.chatops.id]

  evaluation_frequency = "PT1H"
  window_duration      = "PT1H"

  criteria {
    query = <<-QUERY
      AzureDiagnostics
      | where ResourceType == "VAULTS"
      | where OperationName in ("SecretGet", "SecretList")
      | summarize AccessCount = count() by CallerIPAddress, bin(TimeGenerated, 1h)
    QUERY

    time_aggregation_method = "Count"
    operator                = "GreaterThan"
    threshold               = 100

    failing_periods {
      minimum_failing_periods_to_trigger_alert = 1
      number_of_evaluation_periods             = 1
    }
  }

  action {
    action_groups = [azurerm_monitor_action_group.security_alerts.id]
  }

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    ManagedBy   = "Terraform"
  }
}

# -----------------------------------------------------------------------------
# Alert: Secret Expiration Warning
# -----------------------------------------------------------------------------
# Monitors for Key Vault expiration-related audit events. Azure Key Vault
# emits audit events when secrets, keys, or certificates are accessed that
# are near expiration or have expired.
#
# Note: For proactive expiration monitoring, consider:
# 1. Enable Key Vault Event Grid integration for real-time notifications
# 2. Use Azure Policy to enforce expiration dates on secrets
# 3. Set up periodic secret inventory scans
#
# This alert catches expiration events from audit logs which occur when
# items are accessed or during Key Vault internal health checks.
#
# Configuration:
#   - Threshold: Any expiration events detected
#   - Frequency: Daily
#   - Severity: 3 (Informational)
# -----------------------------------------------------------------------------

resource "azurerm_monitor_scheduled_query_rules_alert_v2" "kv_secret_expiration" {
  name                = "kv-secret-expiration-alert"
  resource_group_name = azurerm_resource_group.chatops.name
  location            = azurerm_resource_group.chatops.location
  description         = "Alert when Key Vault audit logs indicate items are near expiry or have expired, triggering investigation for rotation."
  enabled             = true
  severity            = 3

  scopes = [azurerm_log_analytics_workspace.chatops.id]

  evaluation_frequency = "P1D"
  window_duration      = "P1D"

  criteria {
    query = <<-QUERY
      AzureDiagnostics
      | where ResourceType == "VAULTS"
      | where OperationName has_any ("NearExpiry", "Expired")
      | summarize ExpiringItems = count() by Resource, OperationName, bin(TimeGenerated, 1d)
    QUERY

    time_aggregation_method = "Count"
    operator                = "GreaterThan"
    threshold               = 0

    failing_periods {
      minimum_failing_periods_to_trigger_alert = 1
      number_of_evaluation_periods             = 1
    }
  }

  action {
    action_groups = [azurerm_monitor_action_group.security_alerts.id]
  }

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    ManagedBy   = "Terraform"
  }
}
