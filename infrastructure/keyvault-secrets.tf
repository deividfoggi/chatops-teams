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
#
# Expiration Dates: Secrets are created without expiration dates initially.
# Set expiration dates after deployment using Azure CLI or Portal to avoid
# Terraform state management issues with timestamp() function.
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

  # Note: Expiration date should be set after deployment using Azure CLI/Portal
  # to avoid Terraform state issues. Recommended: 365 days for connection strings.
  # Example: az keyvault secret set-attributes --vault-name <vault> --name appinsights-connection-string --expires "$(date -u -d '365 days' +%Y-%m-%dT%H:%M:%SZ)"

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    SecretType  = "ConnectionString"
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }

  # Depend on Key Vault resource to ensure vault exists before creating secrets
  depends_on = [
    azurerm_key_vault.chatops
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
# Recommended expiration: 90 days
# -----------------------------------------------------------------------------

resource "azurerm_key_vault_secret" "github_webhook_secret" {
  name         = "github-webhook-secret"
  value        = "PLACEHOLDER-REPLACE-IN-PRODUCTION"
  key_vault_id = azurerm_key_vault.chatops.id

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    SecretType  = "WebhookSecret"
    Service     = "GitHub"
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }

  depends_on = [
    azurerm_key_vault.chatops
  ]
}

# -----------------------------------------------------------------------------
# GitHub App ID
# -----------------------------------------------------------------------------
# The Application ID for the GitHub App used by ChatOps.
#
# Production Update: Replace with the actual GitHub App ID from GitHub App
# settings page.
# Recommended expiration: 365 days
# -----------------------------------------------------------------------------

resource "azurerm_key_vault_secret" "github_app_id" {
  name         = "github-app-id"
  value        = "000000"
  key_vault_id = azurerm_key_vault.chatops.id

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    SecretType  = "AppIdentifier"
    Service     = "GitHub"
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }

  depends_on = [
    azurerm_key_vault.chatops
  ]
}

# -----------------------------------------------------------------------------
# GitHub App Private Key
# -----------------------------------------------------------------------------
# The private key for authenticating as the GitHub App.
#
# Production Update: Replace with the actual private key downloaded from
# GitHub App settings. GitHub Apps support both RSA and PKCS#8 formats:
#   - RSA format: -----BEGIN RSA PRIVATE KEY-----
#   - PKCS#8 format: -----BEGIN PRIVATE KEY-----
# The key should be stored as a single-line string with newlines replaced by \n.
# Recommended expiration: 90 days
# -----------------------------------------------------------------------------

resource "azurerm_key_vault_secret" "github_app_private_key" {
  name         = "github-app-private-key"
  value        = "-----BEGIN PRIVATE KEY-----\nPLACEHOLDER\n-----END PRIVATE KEY-----"
  key_vault_id = azurerm_key_vault.chatops.id

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    SecretType  = "PrivateKey"
    Service     = "GitHub"
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }

  depends_on = [
    azurerm_key_vault.chatops
  ]
}

# -----------------------------------------------------------------------------
# Bot Application ID
# -----------------------------------------------------------------------------
# The Application (Client) ID for the Microsoft Teams Bot.
#
# Production Update: Replace with the actual Bot App ID from Azure Bot
# Service registration.
# Recommended expiration: 365 days
# -----------------------------------------------------------------------------

resource "azurerm_key_vault_secret" "bot_app_id" {
  name         = "bot-app-id"
  value        = "00000000-0000-0000-0000-000000000000"
  key_vault_id = azurerm_key_vault.chatops.id

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    SecretType  = "AppIdentifier"
    Service     = "TeamsBot"
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }

  depends_on = [
    azurerm_key_vault.chatops
  ]
}

# -----------------------------------------------------------------------------
# Bot Application Password
# -----------------------------------------------------------------------------
# The client secret (password) for the Microsoft Teams Bot application.
#
# Production Update: Replace with the actual client secret generated in
# Azure AD App Registration for the bot.
# Recommended expiration: 90 days
# -----------------------------------------------------------------------------

resource "azurerm_key_vault_secret" "bot_app_password" {
  name         = "bot-app-password"
  value        = "PLACEHOLDER-REPLACE-IN-PRODUCTION"
  key_vault_id = azurerm_key_vault.chatops.id

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    SecretType  = "ClientSecret"
    Service     = "TeamsBot"
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }

  depends_on = [
    azurerm_key_vault.chatops
  ]
}

# -----------------------------------------------------------------------------
# Entra ID Client Secret
# -----------------------------------------------------------------------------
# The client secret for Azure AD (Entra ID) authentication.
#
# Production Update: Replace with the actual client secret from Azure AD
# App Registration used for SSO/authentication.
# Recommended expiration: 90 days
# -----------------------------------------------------------------------------

resource "azurerm_key_vault_secret" "entra_client_secret" {
  name         = "entra-client-secret"
  value        = "PLACEHOLDER-REPLACE-IN-PRODUCTION"
  key_vault_id = azurerm_key_vault.chatops.id

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    SecretType  = "ClientSecret"
    Service     = "EntraID"
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }

  depends_on = [
    azurerm_key_vault.chatops
  ]
}
