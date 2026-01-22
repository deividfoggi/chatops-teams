# =============================================================================
# Azure Monitor Alert Rules Configuration
# =============================================================================
# This file defines Azure Monitor alert rules for the ChatOps Teams application
# to enable proactive monitoring and incident response following Azure
# Well-Architected Framework reliability and operational excellence principles.
#
# Alerts Included:
#   - High Exception Rate: Detects abnormal exception patterns
#   - Failed Dependency: Monitors downstream service failures
#   - Slow Response Time: Identifies performance degradation
# =============================================================================

# -----------------------------------------------------------------------------
# Action Group for Operations Team
# -----------------------------------------------------------------------------
# This action group defines how alert notifications are delivered to the
# operations team for incident response.
# -----------------------------------------------------------------------------

resource "azurerm_monitor_action_group" "ops_alerts" {
  name                = "ops-alerts"
  resource_group_name = azurerm_resource_group.chatops.name
  short_name          = "OpsAlert"

  email_receiver {
    name          = "Operations Team"
    email_address = var.ops_team_email
  }

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    CostCenter  = var.cost_center
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }
}

# -----------------------------------------------------------------------------
# High Exception Rate Alert
# -----------------------------------------------------------------------------
# Monitors for abnormally high exception rates in the application.
# Triggers when more than 10 exceptions occur within a 5-minute window.
# Severity: 2 (Warning) - Requires prompt investigation
# -----------------------------------------------------------------------------

resource "azurerm_monitor_scheduled_query_rules_alert_v2" "high_exception_rate" {
  name                = "high-exception-rate"
  location            = azurerm_resource_group.chatops.location
  resource_group_name = azurerm_resource_group.chatops.name
  description         = "Alert when the exception rate exceeds 10 exceptions in 5 minutes, indicating potential application issues requiring investigation."

  evaluation_frequency = "PT5M"
  window_duration      = "PT5M"
  scopes               = [azurerm_application_insights.chatops.id]
  severity             = 2
  enabled              = true

  criteria {
    query = <<-QUERY
      exceptions
      | where timestamp > ago(5m)
      | summarize Count = count()
    QUERY

    time_aggregation_method = "Count"
    operator                = "GreaterThan"
    threshold               = 10

    failing_periods {
      minimum_failing_periods_to_trigger_alert = 1
      number_of_evaluation_periods             = 1
    }
  }

  action {
    action_groups = [azurerm_monitor_action_group.ops_alerts.id]
  }

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    CostCenter  = var.cost_center
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }
}

# -----------------------------------------------------------------------------
# Failed Dependency Alert
# -----------------------------------------------------------------------------
# Monitors for failed dependencies (external service calls).
# Triggers when more than 5 failed dependency calls occur within 15 minutes.
# Severity: 2 (Warning) - Indicates downstream service issues
# -----------------------------------------------------------------------------

resource "azurerm_monitor_scheduled_query_rules_alert_v2" "failed_dependency" {
  name                = "failed-dependency"
  location            = azurerm_resource_group.chatops.location
  resource_group_name = azurerm_resource_group.chatops.name
  description         = "Alert when more than 5 dependency calls fail within 15 minutes, indicating downstream service issues."

  evaluation_frequency = "PT5M"
  window_duration      = "PT15M"
  scopes               = [azurerm_application_insights.chatops.id]
  severity             = 2
  enabled              = true

  criteria {
    query = <<-QUERY
      dependencies
      | where timestamp > ago(15m)
      | where success == false
      | summarize Count = count()
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
    action_groups = [azurerm_monitor_action_group.ops_alerts.id]
  }

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    CostCenter  = var.cost_center
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }
}

# -----------------------------------------------------------------------------
# Slow Response Time Alert
# -----------------------------------------------------------------------------
# Monitors for slow application response times.
# Triggers when average request duration exceeds 5000ms (5 seconds).
# Severity: 3 (Informational) - Performance degradation warning
# -----------------------------------------------------------------------------

resource "azurerm_monitor_scheduled_query_rules_alert_v2" "slow_response_time" {
  name                = "slow-response-time"
  location            = azurerm_resource_group.chatops.location
  resource_group_name = azurerm_resource_group.chatops.name
  description         = "Alert when average request duration exceeds 5 seconds, indicating performance degradation."

  evaluation_frequency = "PT5M"
  window_duration      = "PT5M"
  scopes               = [azurerm_application_insights.chatops.id]
  severity             = 3
  enabled              = true

  criteria {
    query = <<-QUERY
      requests
      | where timestamp > ago(5m)
      | summarize AvgDuration = avg(duration)
    QUERY

    time_aggregation_method = "Average"
    metric_measure_column   = "AvgDuration"
    operator                = "GreaterThan"
    threshold               = 5000

    failing_periods {
      minimum_failing_periods_to_trigger_alert = 1
      number_of_evaluation_periods             = 1
    }
  }

  action {
    action_groups = [azurerm_monitor_action_group.ops_alerts.id]
  }

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    CostCenter  = var.cost_center
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }
}

# -----------------------------------------------------------------------------
# Availability Test Failure Alert
# -----------------------------------------------------------------------------
# Monitors for availability test failures across all regions.
# Triggers when availability tests fail from 2 or more regions within 10 minutes.
# Severity: 1 (Error) - Indicates potential service outage or degradation
# -----------------------------------------------------------------------------

resource "azurerm_monitor_scheduled_query_rules_alert_v2" "availability_test_failure" {
  name                = "availability-test-failure"
  location            = azurerm_resource_group.chatops.location
  resource_group_name = azurerm_resource_group.chatops.name
  description         = "Alert when availability tests fail from multiple regions within 10 minutes, indicating potential service outage or degradation."

  evaluation_frequency = "PT5M"
  window_duration      = "PT10M"
  scopes               = [azurerm_application_insights.chatops.id]
  severity             = 1
  enabled              = true

  criteria {
    query = <<-QUERY
      availabilityResults
      | where timestamp > ago(10m)
      | where success == false
      | summarize FailedRegions = dcount(location)
    QUERY

    time_aggregation_method = "Maximum"
    metric_measure_column   = "FailedRegions"
    operator                = "GreaterThanOrEqual"
    threshold               = 2

    failing_periods {
      minimum_failing_periods_to_trigger_alert = 1
      number_of_evaluation_periods             = 1
    }
  }

  action {
    action_groups = [azurerm_monitor_action_group.ops_alerts.id]
  }

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    CostCenter  = var.cost_center
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }
}

# =============================================================================
# GitHub Actions Runner Alerts
# =============================================================================
# Alerts for monitoring GitHub Actions runner health and performance.
# These alerts help ensure runner availability and detect issues early.
# =============================================================================

# -----------------------------------------------------------------------------
# Runner Container Startup Failure Alert
# -----------------------------------------------------------------------------
# Monitors for container startup failures in GitHub Actions runners.
# Triggers when container groups fail to start or enter a failed state.
# Severity: 1 (Error) - Indicates runner deployment issues requiring immediate attention
#
# Note: This alert uses Azure Resource Graph to query container group states.
# It detects containers in "Failed" provisioning state or with restart count > 0.
# -----------------------------------------------------------------------------

resource "azurerm_monitor_scheduled_query_rules_alert_v2" "runner_container_failure" {
  name                = "runner-container-startup-failure"
  location            = azurerm_resource_group.chatops.location
  resource_group_name = azurerm_resource_group.chatops.name
  description         = "Alert when GitHub Actions runner containers fail to start or enter a failed state, indicating deployment or configuration issues."

  evaluation_frequency = "PT5M"
  window_duration      = "PT15M"
  scopes               = [azurerm_log_analytics_workspace.chatops.id]
  severity             = 1
  enabled              = true

  criteria {
    query = <<-QUERY
      ContainerInstanceLog_CL
      | where ResourceGroup == "${azurerm_resource_group.chatops.name}"
      | where ContainerGroup_s startswith "github-runner-${var.environment}"
      | where Message contains "error" or Message contains "failed" or Message contains "exception"
      | summarize ErrorCount = count() by ContainerGroup_s
      | where ErrorCount > 0
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
    action_groups = [azurerm_monitor_action_group.ops_alerts.id]
  }

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    Purpose     = "GitHub Runners"
    CostCenter  = var.cost_center
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }
}

# -----------------------------------------------------------------------------
# Runner Registration Failure Alert
# -----------------------------------------------------------------------------
# Monitors for runner registration failures with GitHub Actions.
# Triggers when runners fail to register successfully within 15 minutes.
# Severity: 2 (Warning) - Indicates authentication or configuration issues
# -----------------------------------------------------------------------------

resource "azurerm_monitor_scheduled_query_rules_alert_v2" "runner_registration_failure" {
  name                = "runner-registration-failure"
  location            = azurerm_resource_group.chatops.location
  resource_group_name = azurerm_resource_group.chatops.name
  description         = "Alert when GitHub Actions runners fail to register with GitHub, indicating authentication or configuration issues."

  evaluation_frequency = "PT5M"
  window_duration      = "PT15M"
  scopes               = [azurerm_log_analytics_workspace.chatops.id]
  severity             = 2
  enabled              = true

  criteria {
    query = <<-QUERY
      ContainerInstanceLog_CL
      | where ResourceGroup == "${azurerm_resource_group.chatops.name}"
      | where ContainerGroup_s startswith "github-runner-${var.environment}"
      | where Message contains "registration" and (Message contains "failed" or Message contains "error")
      | summarize RegistrationFailures = count() by ContainerGroup_s
      | where RegistrationFailures > 0
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
    action_groups = [azurerm_monitor_action_group.ops_alerts.id]
  }

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    Purpose     = "GitHub Runners"
    CostCenter  = var.cost_center
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }
}

# -----------------------------------------------------------------------------
# Runner High Failure Rate Alert
# -----------------------------------------------------------------------------
# Monitors for high failure rate in runner job executions.
# Triggers when more than 3 job failures occur within 30 minutes.
# Severity: 2 (Warning) - Indicates runner stability or resource issues
# -----------------------------------------------------------------------------

resource "azurerm_monitor_scheduled_query_rules_alert_v2" "runner_job_failure_rate" {
  name                = "runner-job-failure-rate"
  location            = azurerm_resource_group.chatops.location
  resource_group_name = azurerm_resource_group.chatops.name
  description         = "Alert when GitHub Actions runner jobs fail frequently, indicating runner stability or resource issues."

  evaluation_frequency = "PT10M"
  window_duration      = "PT30M"
  scopes               = [azurerm_log_analytics_workspace.chatops.id]
  severity             = 2
  enabled              = true

  criteria {
    query = <<-QUERY
      ContainerInstanceLog_CL
      | where ResourceGroup == "${azurerm_resource_group.chatops.name}"
      | where ContainerGroup_s startswith "github-runner-${var.environment}"
      | where Message contains "job" and Message contains "failed"
      | summarize JobFailures = count()
      | where JobFailures > 3
    QUERY

    time_aggregation_method = "Count"
    operator                = "GreaterThan"
    threshold               = 3

    failing_periods {
      minimum_failing_periods_to_trigger_alert = 1
      number_of_evaluation_periods             = 1
    }
  }

  action {
    action_groups = [azurerm_monitor_action_group.ops_alerts.id]
  }

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    Purpose     = "GitHub Runners"
    CostCenter  = var.cost_center
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }
}
