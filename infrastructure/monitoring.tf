# =============================================================================
# Azure Application Insights Configuration
# =============================================================================
# This file defines the Application Insights resource for the ChatOps
# Teams application following Azure Well-Architected Framework principles.
#
# Key Design Decisions:
#   - Workspace-based: Connected to Log Analytics for unified observability
#   - 90% Sampling: Optimizes costs while maintaining sufficient telemetry
#   - Web Application Type: Configured for web application monitoring
# =============================================================================

resource "azurerm_application_insights" "chatops" {
  name                = "chatops-appinsights"
  location            = azurerm_resource_group.chatops.location
  resource_group_name = azurerm_resource_group.chatops.name
  workspace_id        = azurerm_log_analytics_workspace.chatops.id
  application_type    = "web"
  sampling_percentage = 90

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    CostCenter  = var.cost_center
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }
}

# =============================================================================
# Key Vault Secret for Application Insights Connection String
# =============================================================================
# This resource stores the Application Insights connection string in
# Azure Key Vault for secure access by applications.
#
# Note: Previously commented out pending Key Vault deployment (Task 6.4.1).
# This resource is now defined in keyvault-secrets.tf to centralize all
# secret management in one location.
# =============================================================================

# =============================================================================
# Application Insights Availability Tests
# =============================================================================
# These resources configure standard web tests to monitor application endpoint
# health from multiple Azure regions following Azure Well-Architected Framework
# reliability principles.
#
# Key Design Decisions:
#   - Multi-region testing: Tests from 5 different regions for global coverage
#   - 5-minute frequency: Balances cost and responsiveness
#   - 30-second timeout: Appropriate for API endpoints
#   - SSL validation: Ensures certificate validity
#   - Success criteria: 200 status code and response within timeout
# =============================================================================

# -----------------------------------------------------------------------------
# Availability Test - East US (Primary Region)
# -----------------------------------------------------------------------------

resource "azurerm_application_insights_standard_web_test" "chatops_eastus" {
  name                    = "chatops-availability-eastus"
  location                = azurerm_resource_group.chatops.location
  resource_group_name     = azurerm_resource_group.chatops.name
  application_insights_id = azurerm_application_insights.chatops.id

  frequency     = 300 # 5 minutes
  timeout       = 30  # 30 seconds
  enabled       = true
  geo_locations = ["us-va-ash-azr"] # East US

  request {
    url       = "https://chatops-app-${var.environment}.azurewebsites.net/health"
    http_verb = "GET"
  }

  validation_rules {
    ssl_cert_remaining_lifetime = 7 # Alert if SSL cert expires in 7 days
    ssl_check_enabled           = true

    expected_status_code = 200
    content {
      content_match      = "healthy"
      pass_if_text_found = true
    }
  }

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    CostCenter  = var.cost_center
    Owner       = var.owner
    ManagedBy   = "Terraform"
    TestRegion  = "eastus"
  }
}

# -----------------------------------------------------------------------------
# Availability Test - West US
# -----------------------------------------------------------------------------

resource "azurerm_application_insights_standard_web_test" "chatops_westus" {
  name                    = "chatops-availability-westus"
  location                = azurerm_resource_group.chatops.location
  resource_group_name     = azurerm_resource_group.chatops.name
  application_insights_id = azurerm_application_insights.chatops.id

  frequency     = 300
  timeout       = 30
  enabled       = true
  geo_locations = ["us-ca-sjc-azr"] # West US

  request {
    url       = "https://chatops-app-${var.environment}.azurewebsites.net/health"
    http_verb = "GET"
  }

  validation_rules {
    ssl_cert_remaining_lifetime = 7
    ssl_check_enabled           = true

    expected_status_code = 200
    content {
      content_match      = "healthy"
      pass_if_text_found = true
    }
  }

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    CostCenter  = var.cost_center
    Owner       = var.owner
    ManagedBy   = "Terraform"
    TestRegion  = "westus"
  }
}

# -----------------------------------------------------------------------------
# Availability Test - North Europe
# -----------------------------------------------------------------------------

resource "azurerm_application_insights_standard_web_test" "chatops_northeurope" {
  name                    = "chatops-availability-northeurope"
  location                = azurerm_resource_group.chatops.location
  resource_group_name     = azurerm_resource_group.chatops.name
  application_insights_id = azurerm_application_insights.chatops.id

  frequency     = 300
  timeout       = 30
  enabled       = true
  geo_locations = ["emea-nl-ams-azr"] # North Europe

  request {
    url       = "https://chatops-app-${var.environment}.azurewebsites.net/health"
    http_verb = "GET"
  }

  validation_rules {
    ssl_cert_remaining_lifetime = 7
    ssl_check_enabled           = true

    expected_status_code = 200
    content {
      content_match      = "healthy"
      pass_if_text_found = true
    }
  }

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    CostCenter  = var.cost_center
    Owner       = var.owner
    ManagedBy   = "Terraform"
    TestRegion  = "northeurope"
  }
}

# -----------------------------------------------------------------------------
# Availability Test - Southeast Asia
# -----------------------------------------------------------------------------

resource "azurerm_application_insights_standard_web_test" "chatops_southeastasia" {
  name                    = "chatops-availability-southeastasia"
  location                = azurerm_resource_group.chatops.location
  resource_group_name     = azurerm_resource_group.chatops.name
  application_insights_id = azurerm_application_insights.chatops.id

  frequency     = 300
  timeout       = 30
  enabled       = true
  geo_locations = ["apac-sg-sin-azr"] # Southeast Asia

  request {
    url       = "https://chatops-app-${var.environment}.azurewebsites.net/health"
    http_verb = "GET"
  }

  validation_rules {
    ssl_cert_remaining_lifetime = 7
    ssl_check_enabled           = true

    expected_status_code = 200
    content {
      content_match      = "healthy"
      pass_if_text_found = true
    }
  }

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    CostCenter  = var.cost_center
    Owner       = var.owner
    ManagedBy   = "Terraform"
    TestRegion  = "southeastasia"
  }
}

# -----------------------------------------------------------------------------
# Availability Test - Australia East
# -----------------------------------------------------------------------------

resource "azurerm_application_insights_standard_web_test" "chatops_australiaeast" {
  name                    = "chatops-availability-australiaeast"
  location                = azurerm_resource_group.chatops.location
  resource_group_name     = azurerm_resource_group.chatops.name
  application_insights_id = azurerm_application_insights.chatops.id

  frequency     = 300
  timeout       = 30
  enabled       = true
  geo_locations = ["emea-au-syd-edge"] # Australia East

  request {
    url       = "https://chatops-app-${var.environment}.azurewebsites.net/health"
    http_verb = "GET"
  }

  validation_rules {
    ssl_cert_remaining_lifetime = 7
    ssl_check_enabled           = true

    expected_status_code = 200
    content {
      content_match      = "healthy"
      pass_if_text_found = true
    }
  }

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    CostCenter  = var.cost_center
    Owner       = var.owner
    ManagedBy   = "Terraform"
    TestRegion  = "australiaeast"
  }
}
