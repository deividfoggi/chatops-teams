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

  # Network ACLs - temporarily allow all access for initial deployment
  # TODO: Restrict to app subnet only after initial deployment
  network_acls {
    default_action             = "Allow"
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
  }
}

# =============================================================================
# Key Vault RBAC Role Assignments
# =============================================================================
# Role assignments follow the principle of least privilege:
#   - Key Vault Administrator: Full management access (for admin group)
#   - Key Vault Secrets Officer: Create, read, update, delete secrets (for DevOps)
#   - Key Vault Secrets User: Read secrets only (for applications)
#
# Note: RBAC authorization is enabled on the Key Vault (enable_rbac_authorization = true),
# which means access is controlled through Azure AD RBAC instead of access policies.
# =============================================================================

# -----------------------------------------------------------------------------
# Key Vault Administrator Role Assignment
# -----------------------------------------------------------------------------
# Grants full management capabilities over Key Vault including:
#   - Manage secrets, keys, and certificates
#   - Manage Key Vault access policies and settings
#   - Recover deleted vaults and purge soft-deleted resources
#
# This role should be assigned to the admin group responsible for
# managing the Key Vault infrastructure.
# -----------------------------------------------------------------------------

resource "azurerm_role_assignment" "kv_admin" {
  count = var.admin_group_object_id != null ? 1 : 0

  scope                = azurerm_key_vault.chatops.id
  role_definition_name = "Key Vault Administrator"
  principal_id         = var.admin_group_object_id

  description = "Admin group access for Key Vault management"
}

# -----------------------------------------------------------------------------
# Key Vault Secrets Officer Role Assignment
# -----------------------------------------------------------------------------
# Grants permissions to manage secrets including:
#   - Create, read, update, and delete secrets
#   - Backup and restore secrets
#   - Manage secret metadata
#
# This role is ideal for DevOps service principals that need to
# manage application secrets during CI/CD deployments.
# -----------------------------------------------------------------------------

resource "azurerm_role_assignment" "kv_secrets_officer" {
  count = var.devops_sp_object_id != null ? 1 : 0

  scope                = azurerm_key_vault.chatops.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = var.devops_sp_object_id

  description = "DevOps service principal access for secrets management"
}

# -----------------------------------------------------------------------------
# Key Vault Secrets User Role Assignment for App Service
# -----------------------------------------------------------------------------
# This role assignment is now defined in app-service.tf after the App Service
# is created with its managed identity. It grants read-only access to secrets,
# following the principle of least privilege for application runtime access.
# -----------------------------------------------------------------------------
