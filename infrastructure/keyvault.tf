# =============================================================================
# Azure Key Vault Configuration
# =============================================================================
# This file defines the Azure Key Vault infrastructure for the ChatOps
# Teams application following Azure Well-Architected Framework security
# best practices.
# =============================================================================

# -----------------------------------------------------------------------------
# Random String for Key Vault Name Uniqueness
# -----------------------------------------------------------------------------
# Key Vault names must be globally unique. This random suffix ensures
# uniqueness across deployments.
# -----------------------------------------------------------------------------

resource "random_string" "kv_suffix" {
  length  = 8
  special = false
  upper   = false
}

# -----------------------------------------------------------------------------
# Azure Key Vault
# -----------------------------------------------------------------------------
# Key Vault for secure storage of secrets, keys, and certificates.
# 
# Security Features:
#   - RBAC Authorization: Uses Azure AD RBAC instead of access policies
#   - Soft Delete: 90-day retention for recovery
#   - Purge Protection: Prevents permanent deletion during retention period
#   - Network ACLs: Restricts access to app subnet only
#   - Bypass: Allows trusted Azure services access
# -----------------------------------------------------------------------------

resource "azurerm_key_vault" "chatops" {
  name                = "chatops-kv-${random_string.kv_suffix.result}"
  location            = azurerm_resource_group.chatops.location
  resource_group_name = azurerm_resource_group.chatops.name
  tenant_id           = data.azurerm_client_config.current.tenant_id

  sku_name = "standard"

  # Enable RBAC authorization (recommended over access policies)
  enable_rbac_authorization = true

  # Soft delete and purge protection for data recovery
  soft_delete_retention_days = 90
  purge_protection_enabled   = true

  # Network ACLs - restrict access to trusted networks only
  network_acls {
    default_action             = "Deny"
    bypass                     = "AzureServices"
    virtual_network_subnet_ids = [azurerm_subnet.app_subnet.id]
  }

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    ManagedBy   = "Terraform"
  }
}

# -----------------------------------------------------------------------------
# Key Vault Diagnostic Settings
# -----------------------------------------------------------------------------
# Enables audit logging for security monitoring and compliance.
# Logs are sent to Log Analytics for analysis and alerting.
# -----------------------------------------------------------------------------

resource "azurerm_monitor_diagnostic_setting" "kv_diagnostics" {
  name                       = "kv-diagnostics"
  target_resource_id         = azurerm_key_vault.chatops.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.chatops.id

  enabled_log {
    category = "AuditEvent"
  }

  metric {
    category = "AllMetrics"
    enabled  = true
  }
}
