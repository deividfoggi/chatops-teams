# =============================================================================
# Azure App Service Configuration
# =============================================================================
# This file defines the Azure App Service infrastructure for the ChatOps
# Teams application following Azure Well-Architected Framework principles.
# =============================================================================

# -----------------------------------------------------------------------------
# App Service Plan
# -----------------------------------------------------------------------------
# PremiumV3 P1v3 SKU (2 cores, 8 GB RAM) supports VNet integration and
# provides autoscaling capabilities for production workloads.
# -----------------------------------------------------------------------------

resource "azurerm_service_plan" "chatops" {
  name                = "chatops-app-plan"
  location            = azurerm_resource_group.chatops.location
  resource_group_name = azurerm_resource_group.chatops.name
  os_type             = "Linux"
  sku_name            = "P1v3"

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    CostCenter  = var.cost_center
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }
}

# -----------------------------------------------------------------------------
# App Service Plan Autoscale Settings
# -----------------------------------------------------------------------------
# Autoscaling configuration based on CPU and memory metrics to ensure
# optimal performance and cost efficiency.
# -----------------------------------------------------------------------------

resource "azurerm_monitor_autoscale_setting" "chatops_app_plan" {
  name                = "chatops-app-plan-autoscale"
  resource_group_name = azurerm_resource_group.chatops.name
  location            = azurerm_resource_group.chatops.location
  target_resource_id  = azurerm_service_plan.chatops.id

  profile {
    name = "default"

    capacity {
      default = 1
      minimum = 1
      maximum = 5
    }

    rule {
      metric_trigger {
        metric_name        = "CpuPercentage"
        metric_resource_id = azurerm_service_plan.chatops.id
        time_grain         = "PT1M"
        statistic          = "Average"
        time_window        = "PT5M"
        time_aggregation   = "Average"
        operator           = "GreaterThan"
        threshold          = 75
      }

      scale_action {
        direction = "Increase"
        type      = "ChangeCount"
        value     = "1"
        cooldown  = "PT5M"
      }
    }

    rule {
      metric_trigger {
        metric_name        = "CpuPercentage"
        metric_resource_id = azurerm_service_plan.chatops.id
        time_grain         = "PT1M"
        statistic          = "Average"
        time_window        = "PT5M"
        time_aggregation   = "Average"
        operator           = "LessThan"
        threshold          = 25
      }

      scale_action {
        direction = "Decrease"
        type      = "ChangeCount"
        value     = "1"
        cooldown  = "PT5M"
      }
    }

    rule {
      metric_trigger {
        metric_name        = "MemoryPercentage"
        metric_resource_id = azurerm_service_plan.chatops.id
        time_grain         = "PT1M"
        statistic          = "Average"
        time_window        = "PT5M"
        time_aggregation   = "Average"
        operator           = "GreaterThan"
        threshold          = 85
      }

      scale_action {
        direction = "Increase"
        type      = "ChangeCount"
        value     = "1"
        cooldown  = "PT5M"
      }
    }

    rule {
      metric_trigger {
        metric_name        = "MemoryPercentage"
        metric_resource_id = azurerm_service_plan.chatops.id
        time_grain         = "PT1M"
        statistic          = "Average"
        time_window        = "PT5M"
        time_aggregation   = "Average"
        operator           = "LessThan"
        threshold          = 30
      }

      scale_action {
        direction = "Decrease"
        type      = "ChangeCount"
        value     = "1"
        cooldown  = "PT5M"
      }
    }
  }

  notification {
    email {
      send_to_subscription_administrator    = false
      send_to_subscription_co_administrator = false
      custom_emails                         = [var.ops_team_email]
    }
  }

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    ManagedBy   = "Terraform"
  }
}

# -----------------------------------------------------------------------------
# Linux App Service
# -----------------------------------------------------------------------------
# App Service for hosting the ChatOps Teams application with:
#   - System-assigned managed identity for Azure service authentication
#   - VNet integration for secure network connectivity
#   - HTTPS only configuration
#   - Health check endpoint monitoring
# -----------------------------------------------------------------------------

resource "azurerm_linux_web_app" "chatops" {
  name                = "chatops-app-service"
  location            = azurerm_resource_group.chatops.location
  resource_group_name = azurerm_resource_group.chatops.name
  service_plan_id     = azurerm_service_plan.chatops.id

  https_only = true

  identity {
    type = "SystemAssigned"
  }

  site_config {
    always_on           = true
    http2_enabled       = true
    minimum_tls_version = "1.2"

    application_stack {
      node_version = "18-lts"
    }

    health_check_path                 = "/health"
    health_check_eviction_time_in_min = 5

    # IP restrictions - allow only from Application Gateway subnet
    ip_restriction {
      action     = "Allow"
      priority   = 100
      name       = "AllowApplicationGateway"
      ip_address = "10.0.2.0/24"
    }

    # Deny all other traffic
    ip_restriction {
      action     = "Deny"
      priority   = 2147483647
      name       = "DenyAll"
      ip_address = "0.0.0.0/0"
    }
  }

  app_settings = {
    # Application Insights
    "APPLICATIONINSIGHTS_CONNECTION_STRING"      = azurerm_application_insights.chatops.connection_string
    "ApplicationInsightsAgent_EXTENSION_VERSION" = "~3"

    # Managed Identity
    # Note: For system-assigned managed identity, AZURE_CLIENT_ID will be set to the principal_id.
    # This can be manually updated post-deployment or the Azure SDK will auto-detect the identity.
    "AZURE_CLIENT_ID" = ""

    # Key Vault references
    "GITHUB_WEBHOOK_SECRET" = "@Microsoft.KeyVault(VaultName=${azurerm_key_vault.chatops.name};SecretName=github-webhook-secret)"
    "BOT_APP_ID"            = "@Microsoft.KeyVault(VaultName=${azurerm_key_vault.chatops.name};SecretName=bot-app-id)"
    "BOT_APP_PASSWORD"      = "@Microsoft.KeyVault(VaultName=${azurerm_key_vault.chatops.name};SecretName=bot-app-password)"

    # General settings
    "WEBSITE_NODE_DEFAULT_VERSION" = "18-lts"
    "WEBSITE_RUN_FROM_PACKAGE"     = "1"
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
# VNet Integration
# -----------------------------------------------------------------------------
# Integrates the App Service with the app-subnet for secure network access.
# -----------------------------------------------------------------------------

resource "azurerm_app_service_virtual_network_swift_connection" "chatops" {
  app_service_id = azurerm_linux_web_app.chatops.id
  subnet_id      = azurerm_subnet.app_subnet.id
}

# -----------------------------------------------------------------------------
# Key Vault RBAC - App Service Managed Identity
# -----------------------------------------------------------------------------
# Grants the App Service managed identity read access to Key Vault secrets
# following the principle of least privilege.
# -----------------------------------------------------------------------------

resource "azurerm_role_assignment" "kv_secrets_user_app_service" {
  scope                = azurerm_key_vault.chatops.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_linux_web_app.chatops.identity[0].principal_id

  description = "App Service managed identity access for reading secrets"
}

# -----------------------------------------------------------------------------
# App Service Diagnostic Settings
# -----------------------------------------------------------------------------
# Enables comprehensive logging and monitoring for the App Service.
# Logs are sent to Log Analytics for centralized analysis.
# -----------------------------------------------------------------------------

resource "azurerm_monitor_diagnostic_setting" "app_service" {
  name                       = "app-service-diagnostics"
  target_resource_id         = azurerm_linux_web_app.chatops.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.chatops.id

  enabled_log {
    category = "AppServiceHTTPLogs"
  }

  enabled_log {
    category = "AppServiceConsoleLogs"
  }

  enabled_log {
    category = "AppServiceAppLogs"
  }

  enabled_log {
    category = "AppServiceAuditLogs"
  }

  enabled_log {
    category = "AppServiceIPSecAuditLogs"
  }

  enabled_log {
    category = "AppServicePlatformLogs"
  }

  metric {
    category = "AllMetrics"
  }
}
