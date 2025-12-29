# =============================================================================
# Azure Key Vault Secrets Configuration
# =============================================================================
# This file defines initial secrets stored in Azure Key Vault for the ChatOps
# Teams application. Secrets are created with dummy/placeholder values for
# Sprint 1 and will be updated with real values in production deployment.
#
# Security Note: These Terraform resources create secrets with placeholder
# values. In production, secrets should be rotated and updated through secure
# CI/CD pipelines or manual updates via Azure Portal/CLI.
# =============================================================================

# -----------------------------------------------------------------------------
# Application Insights Connection String
# -----------------------------------------------------------------------------
# Stores the Application Insights connection string for secure access by
# applications. This secret is automatically populated from the Application
# Insights resource.
# -----------------------------------------------------------------------------

resource "azurerm_key_vault_secret" "appinsights_connection_string" {
  name         = "appinsights-connection-string"
  value        = azurerm_application_insights.chatops.connection_string
  key_vault_id = azurerm_key_vault.chatops.id

  # Set expiration to 1 year from creation (recommended practice)
  expiration_date = timeadd(timestamp(), "8760h") # 365 days

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    SecretType  = "ConnectionString"
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }

  # Ensure Key Vault RBAC roles are assigned before creating secrets
  depends_on = [
    azurerm_role_assignment.kv_admin,
    azurerm_role_assignment.kv_secrets_officer
  ]
}

# -----------------------------------------------------------------------------
# GitHub Webhook Secret
# -----------------------------------------------------------------------------
# Secret used to validate webhook requests from GitHub. This ensures that
# only legitimate GitHub webhook calls are processed by the application.
#
# Production Update: Generate a secure random string (32+ characters) and
# configure it in GitHub webhook settings.
# -----------------------------------------------------------------------------

resource "azurerm_key_vault_secret" "github_webhook_secret" {
  name         = "github-webhook-secret"
  value        = "PLACEHOLDER-REPLACE-IN-PRODUCTION"
  key_vault_id = azurerm_key_vault.chatops.id

  # Set expiration to 90 days (recommended rotation period)
  expiration_date = timeadd(timestamp(), "2160h") # 90 days

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    SecretType  = "WebhookSecret"
    Service     = "GitHub"
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }

  depends_on = [
    azurerm_role_assignment.kv_admin,
    azurerm_role_assignment.kv_secrets_officer
  ]
}

# -----------------------------------------------------------------------------
# GitHub App ID
# -----------------------------------------------------------------------------
# The Application ID for the GitHub App used by ChatOps.
#
# Production Update: Replace with the actual GitHub App ID from GitHub App
# settings page.
# -----------------------------------------------------------------------------

resource "azurerm_key_vault_secret" "github_app_id" {
  name         = "github-app-id"
  value        = "000000"
  key_vault_id = azurerm_key_vault.chatops.id

  # App IDs typically don't expire, but set a long expiration for monitoring
  expiration_date = timeadd(timestamp(), "8760h") # 365 days

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    SecretType  = "AppIdentifier"
    Service     = "GitHub"
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }

  depends_on = [
    azurerm_role_assignment.kv_admin,
    azurerm_role_assignment.kv_secrets_officer
  ]
}

# -----------------------------------------------------------------------------
# GitHub App Private Key
# -----------------------------------------------------------------------------
# The private key (PEM format) for authenticating as the GitHub App.
#
# Production Update: Replace with the actual private key downloaded from
# GitHub App settings. The key should be in PEM format as a single-line
# string with newlines replaced by \n.
# -----------------------------------------------------------------------------

resource "azurerm_key_vault_secret" "github_app_private_key" {
  name         = "github-app-private-key"
  value        = "-----BEGIN RSA PRIVATE KEY-----\nPLACEHOLDER\n-----END RSA PRIVATE KEY-----"
  key_vault_id = azurerm_key_vault.chatops.id

  # Private keys should be rotated every 90 days
  expiration_date = timeadd(timestamp(), "2160h") # 90 days

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    SecretType  = "PrivateKey"
    Service     = "GitHub"
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }

  depends_on = [
    azurerm_role_assignment.kv_admin,
    azurerm_role_assignment.kv_secrets_officer
  ]
}

# -----------------------------------------------------------------------------
# Bot Application ID
# -----------------------------------------------------------------------------
# The Application (Client) ID for the Microsoft Teams Bot.
#
# Production Update: Replace with the actual Bot App ID from Azure Bot
# Service registration.
# -----------------------------------------------------------------------------

resource "azurerm_key_vault_secret" "bot_app_id" {
  name         = "bot-app-id"
  value        = "00000000-0000-0000-0000-000000000000"
  key_vault_id = azurerm_key_vault.chatops.id

  # App IDs typically don't expire, but set a long expiration for monitoring
  expiration_date = timeadd(timestamp(), "8760h") # 365 days

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    SecretType  = "AppIdentifier"
    Service     = "TeamsBot"
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }

  depends_on = [
    azurerm_role_assignment.kv_admin,
    azurerm_role_assignment.kv_secrets_officer
  ]
}

# -----------------------------------------------------------------------------
# Bot Application Password
# -----------------------------------------------------------------------------
# The client secret (password) for the Microsoft Teams Bot application.
#
# Production Update: Replace with the actual client secret generated in
# Azure AD App Registration for the bot.
# -----------------------------------------------------------------------------

resource "azurerm_key_vault_secret" "bot_app_password" {
  name         = "bot-app-password"
  value        = "PLACEHOLDER-REPLACE-IN-PRODUCTION"
  key_vault_id = azurerm_key_vault.chatops.id

  # Client secrets should be rotated every 90 days
  expiration_date = timeadd(timestamp(), "2160h") # 90 days

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    SecretType  = "ClientSecret"
    Service     = "TeamsBot"
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }

  depends_on = [
    azurerm_role_assignment.kv_admin,
    azurerm_role_assignment.kv_secrets_officer
  ]
}

# -----------------------------------------------------------------------------
# Entra ID Client Secret
# -----------------------------------------------------------------------------
# The client secret for Azure AD (Entra ID) authentication.
#
# Production Update: Replace with the actual client secret from Azure AD
# App Registration used for SSO/authentication.
# -----------------------------------------------------------------------------

resource "azurerm_key_vault_secret" "entra_client_secret" {
  name         = "entra-client-secret"
  value        = "PLACEHOLDER-REPLACE-IN-PRODUCTION"
  key_vault_id = azurerm_key_vault.chatops.id

  # Client secrets should be rotated every 90 days
  expiration_date = timeadd(timestamp(), "2160h") # 90 days

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    SecretType  = "ClientSecret"
    Service     = "EntraID"
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }

  depends_on = [
    azurerm_role_assignment.kv_admin,
    azurerm_role_assignment.kv_secrets_officer
  ]
}
