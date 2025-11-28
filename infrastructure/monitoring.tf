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
    ManagedBy   = "Terraform"
  }
}

# =============================================================================
# Key Vault Secret for Application Insights Connection String
# =============================================================================
# This resource will store the Application Insights connection string in
# Azure Key Vault for secure access by applications.
#
# Note: Key Vault is not yet configured (Task 6.4.1 dependency).
# Uncomment this resource once Key Vault is available.
# =============================================================================
#
# resource "azurerm_key_vault_secret" "appinsights_connection_string" {
#   name         = "appinsights-connection-string"
#   value        = azurerm_application_insights.chatops.connection_string
#   key_vault_id = azurerm_key_vault.chatops.id
#
#   tags = {
#     Environment = var.environment
#     Application = "ChatOps"
#     ManagedBy   = "Terraform"
#   }
# }
# =============================================================================
