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
# This resource is now defined in keyvault-secrets.tf to centralize all
# secret management in one location.
# =============================================================================
