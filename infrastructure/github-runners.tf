# =============================================================================
# Azure Container Instances - GitHub Actions Runners
# =============================================================================
# This file defines Azure Container Instances (ACI) for hosting GitHub Actions
# self-hosted runners. Runners are deployed in the secure VNet-integrated
# runner subnet with managed identity for Key Vault access.
#
# Features:
#   - Ephemeral runners (restart_policy = "Never")
#   - VNet integration via runner subnet
#   - Managed identity for Key Vault access
#   - Environment-specific labels for isolation
#   - Secure secret management
# =============================================================================

# -----------------------------------------------------------------------------
# Random String for Unique Container Group Names
# -----------------------------------------------------------------------------
# Container group names must be unique within the resource group.
# This random suffix ensures uniqueness across deployments.
# -----------------------------------------------------------------------------

resource "random_string" "runner_suffix" {
  count   = var.github_runner_count
  length  = 8
  special = false
  upper   = false
}

# -----------------------------------------------------------------------------
# User Assigned Managed Identity for GitHub Runners
# -----------------------------------------------------------------------------
# This managed identity is assigned to the runner containers and grants them
# access to Azure Key Vault secrets for retrieving GitHub PAT and repository
# configuration without storing secrets in the container.
# -----------------------------------------------------------------------------

resource "azurerm_user_assigned_identity" "github_runner" {
  name                = "github-runner-identity-${var.environment}"
  location            = azurerm_resource_group.chatops.location
  resource_group_name = azurerm_resource_group.chatops.name

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    Purpose     = "GitHub Runners"
    ManagedBy   = "Terraform"
  }
}

# -----------------------------------------------------------------------------
# Key Vault RBAC Role Assignment for Runner Identity
# -----------------------------------------------------------------------------
# Grants the runner managed identity "Key Vault Secrets User" role to read
# secrets required for runner registration (GitHub PAT and repository URL).
# -----------------------------------------------------------------------------

resource "azurerm_role_assignment" "runner_kv_secrets_user" {
  scope                = azurerm_key_vault.chatops.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.github_runner.principal_id
  description          = "GitHub runner managed identity access to read Key Vault secrets"
}

# =============================================================================
# Network Profile for Container Instances
# =============================================================================
# Network profile enables VNet integration for container groups, allowing them
# to run within the secure runner subnet with proper network isolation.
#
# Note: Network profiles are required for VNet-integrated ACI deployments.
# Each profile is associated with a specific subnet and can be reused across
# multiple container groups.
# =============================================================================

resource "azurerm_container_group" "github_runner" {
  count               = var.github_runner_count
  name                = "github-runner-${var.environment}-${random_string.runner_suffix[count.index].result}"
  location            = azurerm_resource_group.chatops.location
  resource_group_name = azurerm_resource_group.chatops.name
  os_type             = "Linux"
  restart_policy      = "Never"
  ip_address_type     = "Private"
  subnet_ids          = [azurerm_subnet.github_runners_subnet.id]

  # Attach managed identity for Key Vault access
  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.github_runner.id]
  }

  # =============================================================================
  # GitHub Actions Runner Container
  # =============================================================================
  # Container configuration for the GitHub Actions runner. The runner uses
  # environment variables to configure registration with GitHub.
  #
  # Environment Variables:
  #   - REPO_URL: Target GitHub repository (from Key Vault)
  #   - RUNNER_TOKEN: GitHub registration token (from Key Vault)
  #   - RUNNER_NAME: Unique name for this runner instance
  #   - RUNNER_LABELS: Labels for runner selection in workflows
  #   - RUNNER_GROUP: Runner group for organization-level grouping
  #   - RUNNER_WORKDIR: Working directory for workflow execution
  #
  # Note: The official GitHub Actions runner image requires a registration
  # token. In production, this should be retrieved from Key Vault using
  # Key Vault references or a custom startup script with managed identity.
  # =============================================================================

  container {
    name   = "github-runner"
    image  = "ghcr.io/actions/actions-runner:latest"
    cpu    = var.github_runner_cpu
    memory = var.github_runner_memory

    # =============================================================================
    # Environment Variables Configuration
    # =============================================================================
    # These environment variables configure the runner at startup. In production,
    # sensitive values (REPO_URL, RUNNER_TOKEN) should be injected via:
    #   1. Azure Key Vault references (requires custom entrypoint script)
    #   2. Init container that retrieves secrets using managed identity
    #   3. Azure Container Instances secret volumes (deprecated)
    #
    # Current Implementation: Using secure_environment_variables with placeholders
    # that reference Key Vault secret names. The actual secret retrieval must be
    # implemented in a custom entrypoint script or init container.
    # =============================================================================

    # Non-sensitive environment variables
    environment_variables = {
      RUNNER_NAME    = "chatops-runner-${var.environment}-${count.index + 1}"
      RUNNER_LABELS  = "self-hosted,azure,vnet,${var.environment},aci"
      RUNNER_GROUP   = var.github_runner_group
      RUNNER_WORKDIR = "/home/runner/work"
      AZURE_KEYVAULT = azurerm_key_vault.chatops.name
      ENVIRONMENT    = var.environment
    }

    # Secure environment variables (not exposed in logs or portal)
    # Note: These still need to be populated. In production, use Key Vault
    # references or a startup script with managed identity.
    secure_environment_variables = {
      # Placeholder for GitHub PAT - must be retrieved from Key Vault
      # In production: Use managed identity to fetch from Key Vault
      GITHUB_PAT = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.github_runner_pat.id})"

      # Repository URL from Key Vault
      REPO_URL = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.github_repository_url.id})"
    }

    # Port configuration for health monitoring (optional)
    ports {
      port     = 80
      protocol = "TCP"
    }
  }

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    Purpose     = "GitHub Runners"
    RunnerIndex = count.index + 1
    ManagedBy   = "Terraform"
  }

  # Ensure dependencies are created first
  depends_on = [
    azurerm_subnet.github_runners_subnet,
    azurerm_role_assignment.runner_kv_secrets_user,
    azurerm_key_vault_secret.github_runner_pat,
    azurerm_key_vault_secret.github_repository_url
  ]
}

# =============================================================================
# Container Instances Diagnostic Settings
# =============================================================================
# Enables logging for container groups to Log Analytics for monitoring and
# troubleshooting. Captures container logs and metrics for observability.
# =============================================================================

resource "azurerm_monitor_diagnostic_setting" "github_runner" {
  count                      = var.github_runner_count
  name                       = "github-runner-diagnostics-${count.index + 1}"
  target_resource_id         = azurerm_container_group.github_runner[count.index].id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.chatops.id

  enabled_log {
    category = "ContainerInstanceLog"
  }

  metric {
    category = "AllMetrics"
  }
}
