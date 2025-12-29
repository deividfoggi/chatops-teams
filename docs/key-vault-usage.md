# Azure Key Vault Usage Guide

This document provides comprehensive guidance on using Azure Key Vault for secrets management in the ChatOps Teams application.

## Table of Contents

- [Overview](#overview)
- [Key Vault Architecture](#key-vault-architecture)
- [Secret Naming Conventions](#secret-naming-conventions)
- [Accessing Secrets](#accessing-secrets)
- [Secret Rotation](#secret-rotation)
- [App Service Integration](#app-service-integration)
- [Troubleshooting](#troubleshooting)
- [Security Best Practices](#security-best-practices)

---

## Overview

The ChatOps Teams application uses Azure Key Vault to securely store and manage all application secrets, credentials, and sensitive configuration values. This approach provides:

- **Centralized Management**: All secrets are stored in a single, secure location
- **Encryption at Rest**: Secrets are encrypted using Azure-managed keys
- **Access Control**: RBAC-based access ensures only authorized identities can access secrets
- **Audit Logging**: All secret access is logged for security monitoring
- **Secret Rotation**: Supports rotation without application restart

### Initial Setup

After deploying the infrastructure with Terraform, perform these post-deployment steps:

1. **Set Secret Expiration Dates**: Terraform creates secrets without expiration dates to avoid state management issues. Set expiration dates manually:

```bash
# Get the Key Vault name
KV_NAME=$(az keyvault list --resource-group rg-chatops-prod --query "[0].name" -o tsv)

# Set expiration dates for secrets (365 days for stable items)
az keyvault secret set-attributes --vault-name $KV_NAME \
  --name appinsights-connection-string \
  --expires "$(date -u -d '365 days' +%Y-%m-%dT%H:%M:%SZ)"

az keyvault secret set-attributes --vault-name $KV_NAME \
  --name github-app-id \
  --expires "$(date -u -d '365 days' +%Y-%m-%dT%H:%M:%SZ)"

az keyvault secret set-attributes --vault-name $KV_NAME \
  --name bot-app-id \
  --expires "$(date -u -d '365 days' +%Y-%m-%dT%H:%M:%SZ)"

# Set expiration dates for credentials (90 days for security)
az keyvault secret set-attributes --vault-name $KV_NAME \
  --name github-webhook-secret \
  --expires "$(date -u -d '90 days' +%Y-%m-%dT%H:%M:%SZ)"

az keyvault secret set-attributes --vault-name $KV_NAME \
  --name github-app-private-key \
  --expires "$(date -u -d '90 days' +%Y-%m-%dT%H:%M:%SZ)"

az keyvault secret set-attributes --vault-name $KV_NAME \
  --name bot-app-password \
  --expires "$(date -u -d '90 days' +%Y-%m-%dT%H:%M:%SZ)"

az keyvault secret set-attributes --vault-name $KV_NAME \
  --name entra-client-secret \
  --expires "$(date -u -d '90 days' +%Y-%m-%dT%H:%M:%SZ)"
```

2. **Replace Placeholder Values**: Update secrets with actual production values
3. **Verify RBAC Permissions**: Ensure all role assignments are correctly configured
4. **Test Secret Access**: Verify applications can retrieve secrets using managed identities

## Key Vault Architecture

### Key Vault Configuration

| Property | Value | Purpose |
|----------|-------|---------|
| Name | `chatops-kv-{random-suffix}` | Globally unique Key Vault name |
| SKU | Standard | Cost-effective tier for this workload |
| Soft Delete | 90 days | Recovery period for deleted secrets |
| Purge Protection | Enabled | Prevents permanent deletion during retention |
| Authorization | Azure RBAC | Modern authorization model |
| Network ACLs | App subnet only | Restricts access to trusted networks |

### RBAC Role Assignments

| Role | Assignee | Permissions |
|------|----------|-------------|
| Key Vault Administrator | Admin Group | Full management capabilities |
| Key Vault Secrets Officer | DevOps Service Principal | Create, update, delete secrets (CI/CD) |
| Key Vault Secrets User | App Service Managed Identity | Read secrets only (runtime access) |

---

## Secret Naming Conventions

Secrets in Key Vault follow a consistent naming pattern: `{service}-{secret-type}`

### Current Secrets

| Secret Name | Description | Rotation Period |
|-------------|-------------|-----------------|
| `appinsights-connection-string` | Application Insights connection string | 365 days |
| `github-webhook-secret` | GitHub webhook validation secret | 90 days |
| `github-app-id` | GitHub App application ID | 365 days |
| `github-app-private-key` | GitHub App authentication private key | 90 days |
| `bot-app-id` | Teams Bot application ID | 365 days |
| `bot-app-password` | Teams Bot client secret | 90 days |
| `entra-client-secret` | Entra ID client secret for SSO | 90 days |

### Naming Guidelines

- Use lowercase letters and hyphens only (no spaces or underscores)
- Start with the service name (e.g., `github`, `bot`, `entra`)
- End with the secret type (e.g., `secret`, `password`, `key`, `id`)
- Keep names concise but descriptive
- Maximum length: 127 characters

**Examples:**
- ✅ `github-webhook-secret`
- ✅ `bot-app-password`
- ✅ `database-connection-string`
- ❌ `GitHubWebhookSecret` (use lowercase and hyphens)
- ❌ `my_secret` (use hyphens, not underscores)

---

## Accessing Secrets

### Using Azure CLI

```bash
# Login to Azure
az login

# Set the subscription (if needed)
az account set --subscription "YOUR_SUBSCRIPTION_ID"

# Get the Key Vault name (it has a random suffix)
KV_NAME=$(az keyvault list --resource-group rg-chatops-prod --query "[0].name" -o tsv)

# List all secrets
az keyvault secret list --vault-name $KV_NAME --query "[].name" -o table

# Get a specific secret value
az keyvault secret show --vault-name $KV_NAME --name github-webhook-secret --query "value" -o tsv

# Set a new secret value
az keyvault secret set --vault-name $KV_NAME --name my-new-secret --value "my-secret-value"

# Set a secret with expiration date (90 days from now)
az keyvault secret set --vault-name $KV_NAME \
  --name github-webhook-secret \
  --value "new-secret-value" \
  --expires "$(date -u -d '90 days' +%Y-%m-%dT%H:%M:%SZ)"
```

### Using Azure Portal

1. Navigate to the [Azure Portal](https://portal.azure.com)
2. Search for your Key Vault: `chatops-kv-*`
3. In the left menu, select **Secrets**
4. Click on a secret name to view its properties
5. Click **Show Secret Value** to reveal the value (requires permissions)
6. To create a new secret version, click **+ New Version**

### Using Terraform

Secrets are managed in `infrastructure/keyvault-secrets.tf`:

```hcl
resource "azurerm_key_vault_secret" "my_secret" {
  name         = "my-secret"
  value        = "my-secret-value"
  key_vault_id = azurerm_key_vault.chatops.id

  # Note: Do not set expiration_date in Terraform to avoid state management issues.
  # Set expiration after deployment using Azure CLI or Portal.

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    SecretType  = "ClientSecret"
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }

  depends_on = [
    azurerm_key_vault.chatops
  ]
}
```

**Important:** After deploying with Terraform, set expiration dates using Azure CLI:

```bash
az keyvault secret set-attributes \
  --vault-name <vault-name> \
  --name my-secret \
  --expires "$(date -u -d '90 days' +%Y-%m-%dT%H:%M:%SZ)"
```

### Using Application Code (Python)

```python
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient

# Initialize the Key Vault client using managed identity
credential = DefaultAzureCredential()
vault_url = "https://chatops-kv-{suffix}.vault.azure.net"
client = SecretClient(vault_url=vault_url, credential=credential)

# Retrieve a secret
secret = client.get_secret("github-webhook-secret")
print(f"Secret value: {secret.value}")
```

---

## Secret Rotation

Secret rotation is the process of updating a secret with a new value. This is a critical security practice to limit the exposure window if a secret is compromised.

### Rotation Schedule

| Secret Type | Recommended Rotation | Reason |
|-------------|---------------------|--------|
| Client Secrets | 90 days | High risk if compromised |
| Private Keys | 90 days | High risk if compromised |
| Webhook Secrets | 90 days | Moderate risk |
| Connection Strings | 365 days | Low risk, stable infrastructure |
| Application IDs | 365 days | Not sensitive, rarely changes |

### Rotation Procedures

#### Manual Rotation (Azure Portal)

1. **Generate New Secret Value**
   - For client secrets: Generate in Azure AD App Registration
   - For webhook secrets: Generate a new random string (32+ characters)
   - For private keys: Generate a new key pair

2. **Create New Secret Version in Key Vault**
   - Navigate to the secret in Azure Portal
   - Click **+ New Version**
   - Paste the new secret value
   - Set expiration date (90 or 365 days from now)
   - Save the new version

3. **Update External Systems**
   - GitHub webhooks: Update webhook configuration with new secret
   - Azure AD apps: Note the new client secret (shown once)
   - Document the change in your change management system

4. **Verify Application Functionality**
   - Wait for applications to automatically pick up the new secret (usually within 4 hours)
   - Or restart the application to force immediate reload
   - Test the application to ensure it's working correctly

5. **Disable Old Secret Version** (after verification)
   - Navigate to the secret in Azure Portal
   - Click on the old version
   - Click **Disable**
   - Monitor for any issues

6. **Delete Old Secret Version** (after 30 days)
   - Navigate to the secret in Azure Portal
   - Click on the old version
   - Click **Delete**

#### Manual Rotation (Azure CLI)

```bash
# Set variables
KV_NAME=$(az keyvault list --resource-group rg-chatops-prod --query "[0].name" -o tsv)
SECRET_NAME="github-webhook-secret"
NEW_SECRET_VALUE="your-new-secret-value"

# Create a new secret version with expiration
az keyvault secret set \
  --vault-name $KV_NAME \
  --name $SECRET_NAME \
  --value "$NEW_SECRET_VALUE" \
  --expires "$(date -u -d '90 days' +%Y-%m-%dT%H:%M:%SZ)"

# List all versions to find the old one
az keyvault secret list-versions --vault-name $KV_NAME --name $SECRET_NAME --query "[].{Version:id, Enabled:attributes.enabled}" -o table

# Disable the old version (replace {old-version-id} with actual version)
az keyvault secret set-attributes \
  --vault-name $KV_NAME \
  --name $SECRET_NAME \
  --version {old-version-id} \
  --enabled false

# After 30 days, delete the old version
az keyvault secret delete \
  --vault-name $KV_NAME \
  --name $SECRET_NAME \
  --version {old-version-id}
```

#### Automated Rotation (Terraform)

For Terraform-managed secrets, rotation requires updating the `value` attribute and applying:

```bash
cd infrastructure

# Update the secret value in keyvault-secrets.tf
# Then apply the changes
terraform plan -out=tfplan
terraform apply tfplan
```

**Note:** For production secrets that shouldn't be in Terraform code, use external data sources or manual updates.

### Rotation Without Application Restart

The ChatOps application is designed to automatically refresh secrets from Key Vault periodically (every 4 hours). This means:

1. Update the secret in Key Vault
2. Wait up to 4 hours for automatic refresh
3. No application restart required

To force immediate refresh without waiting:
- Restart the App Service
- Or use the application's refresh endpoint (if implemented)

### Secret Rotation Checklist

- [ ] Generate new secret value
- [ ] Create new version in Key Vault with expiration date
- [ ] Update external systems (GitHub, Azure AD, etc.)
- [ ] Wait for automatic refresh or restart application
- [ ] Test application functionality
- [ ] Monitor logs for errors
- [ ] Disable old secret version after successful verification
- [ ] Delete old version after 30 days
- [ ] Document the rotation in change management system

---

## App Service Integration

### Key Vault References

App Service can directly reference secrets from Key Vault using the `@Microsoft.KeyVault()` syntax. This approach ensures secrets are never stored in application configuration.

#### Syntax

```
@Microsoft.KeyVault(SecretUri=https://chatops-kv-{suffix}.vault.azure.net/secrets/github-webhook-secret)
```

Or using the shorter version identifier:

```
@Microsoft.KeyVault(VaultName=chatops-kv-{suffix};SecretName=github-webhook-secret)
```

#### Example Configuration

In App Service Application Settings:

| Setting Name | Value |
|--------------|-------|
| `GITHUB_WEBHOOK_SECRET` | `@Microsoft.KeyVault(SecretUri=https://chatops-kv-abc123.vault.azure.net/secrets/github-webhook-secret)` |
| `GITHUB_APP_ID` | `@Microsoft.KeyVault(SecretUri=https://chatops-kv-abc123.vault.azure.net/secrets/github-app-id)` |
| `BOT_APP_PASSWORD` | `@Microsoft.KeyVault(SecretUri=https://chatops-kv-abc123.vault.azure.net/secrets/bot-app-password)` |

#### Using Azure CLI to Configure App Service

```bash
# Get Key Vault URI
KV_NAME=$(az keyvault list --resource-group rg-chatops-prod --query "[0].name" -o tsv)
KV_URI=$(az keyvault show --name $KV_NAME --query "properties.vaultUri" -o tsv)

# Set App Service setting with Key Vault reference
az webapp config appsettings set \
  --resource-group rg-chatops-prod \
  --name chatops-app \
  --settings GITHUB_WEBHOOK_SECRET="@Microsoft.KeyVault(SecretUri=${KV_URI}secrets/github-webhook-secret)"
```

#### Using Terraform

```hcl
resource "azurerm_linux_web_app" "chatops" {
  # ... other configuration ...

  app_settings = {
    "GITHUB_WEBHOOK_SECRET" = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.github_webhook_secret.id})"
    "GITHUB_APP_ID"         = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.github_app_id.id})"
    "BOT_APP_PASSWORD"      = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.bot_app_password.id})"
  }

  identity {
    type = "SystemAssigned"
  }
}

# Grant App Service managed identity access to Key Vault
resource "azurerm_role_assignment" "app_service_kv_access" {
  scope                = azurerm_key_vault.chatops.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_linux_web_app.chatops.identity[0].principal_id
}
```

### Verifying Key Vault Integration

#### Check App Service Configuration

```bash
# View application settings (Key Vault references will show as @Microsoft.KeyVault(...))
az webapp config appsettings list \
  --resource-group rg-chatops-prod \
  --name chatops-app \
  --query "[].{Name:name, Value:value}" -o table

# Check if managed identity is enabled
az webapp identity show \
  --resource-group rg-chatops-prod \
  --name chatops-app
```

#### Test Secret Resolution

In the Azure Portal:
1. Navigate to App Service → Configuration → Application settings
2. Look for the Key Vault reference icon next to settings
3. Hover over the icon to see resolution status
4. Green checkmark = Successfully resolved
5. Red X = Failed to resolve (check permissions)

---

## Troubleshooting

### Common Issues

#### Issue: "Access Denied" when retrieving secrets

**Symptoms:**
- 403 Forbidden errors in application logs
- Key Vault reference shows red X in App Service configuration

**Possible Causes:**
1. Managed identity not assigned to Key Vault
2. Network ACLs blocking access
3. Soft-deleted secret not recovered

**Resolution:**
```bash
# 1. Verify managed identity has access
APP_PRINCIPAL_ID=$(az webapp identity show --resource-group rg-chatops-prod --name chatops-app --query principalId -o tsv)

az role assignment list \
  --scope /subscriptions/{subscription-id}/resourceGroups/rg-chatops-prod/providers/Microsoft.KeyVault/vaults/chatops-kv-{suffix} \
  --assignee $APP_PRINCIPAL_ID

# If no role assignment, create one
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee $APP_PRINCIPAL_ID \
  --scope /subscriptions/{subscription-id}/resourceGroups/rg-chatops-prod/providers/Microsoft.KeyVault/vaults/chatops-kv-{suffix}

# 2. Check network ACLs
az keyvault network-rule list --name $KV_NAME

# 3. List deleted secrets and recover if needed
az keyvault secret list-deleted --vault-name $KV_NAME
az keyvault secret recover --vault-name $KV_NAME --name github-webhook-secret
```

#### Issue: Application using old secret value after rotation

**Symptoms:**
- Authentication failures after secret rotation
- Application not picking up new secret version

**Resolution:**
1. Check secret expiration and enabled status
2. Restart the application to force refresh
3. Verify Key Vault reference uses correct secret URI (without version pinning)

```bash
# Restart App Service
az webapp restart --resource-group rg-chatops-prod --name chatops-app
```

#### Issue: Secret not found

**Symptoms:**
- "Secret not found" error messages
- 404 errors when accessing Key Vault

**Resolution:**
```bash
# List all secrets to verify name
az keyvault secret list --vault-name $KV_NAME --query "[].name" -o table

# Check if secret is soft-deleted
az keyvault secret list-deleted --vault-name $KV_NAME

# Recover soft-deleted secret
az keyvault secret recover --vault-name $KV_NAME --name github-webhook-secret
```

#### Issue: Secret expired

**Symptoms:**
- "Secret expired" in logs
- Secret expiration alerts triggered

**Resolution:**
```bash
# Create a new version with updated expiration
az keyvault secret set \
  --vault-name $KV_NAME \
  --name github-webhook-secret \
  --value "new-value" \
  --expires "$(date -u -d '90 days' +%Y-%m-%dT%H:%M:%SZ)"
```

### Diagnostic Queries

#### Check Secret Access Logs

```kusto
AzureDiagnostics
| where ResourceType == "VAULTS"
| where OperationName in ("SecretGet", "SecretList", "SecretSet")
| where TimeGenerated > ago(1h)
| project TimeGenerated, OperationName, ResultSignature, CallerIPAddress, identity_claim_upn_s
| order by TimeGenerated desc
```

#### Check Failed Authentication Attempts

```kusto
AzureDiagnostics
| where ResourceType == "VAULTS"
| where ResultSignature in ("Unauthorized", "Forbidden") or httpStatusCode_d >= 400
| where TimeGenerated > ago(24h)
| project TimeGenerated, OperationName, ResultSignature, CallerIPAddress, identity_claim_upn_s
| order by TimeGenerated desc
```

#### Check Expiring Secrets

```kusto
AzureDiagnostics
| where ResourceType == "VAULTS"
| where OperationName has_any ("NearExpiry", "Expired")
| where TimeGenerated > ago(7d)
| project TimeGenerated, Resource, OperationName, id_s
| order by TimeGenerated desc
```

---

## Security Best Practices

### Access Control

1. **Use Managed Identities**: Always prefer managed identities over service principals with client secrets
2. **Principle of Least Privilege**: Grant only the minimum required permissions
   - Applications: `Key Vault Secrets User` (read-only)
   - DevOps: `Key Vault Secrets Officer` (manage secrets)
   - Admins: `Key Vault Administrator` (full access)
3. **Avoid Access Keys**: Never use access policies or access keys in application code
4. **Regular Access Reviews**: Quarterly review of RBAC assignments

### Network Security

1. **Private Endpoints**: Consider using Azure Private Link for production
2. **Network ACLs**: Restrict access to specific subnets or IP ranges
3. **Firewall Rules**: Block public access if not required
4. **VNet Integration**: Ensure App Service uses VNet integration

### Secret Management

1. **Set Expiration Dates**: All secrets should have expiration dates
2. **Rotate Regularly**: Follow the recommended rotation schedule
3. **No Hardcoded Secrets**: Never commit secrets to source control
4. **Use Placeholder Values**: Store dummy values in Terraform for initial deployment
5. **Version Control**: Leverage Key Vault's built-in versioning
6. **Disable Old Versions**: Disable old versions after successful rotation

### Monitoring and Auditing

1. **Enable Diagnostic Logging**: Send all logs to Log Analytics
2. **Configure Alerts**: Monitor for:
   - Failed authentication attempts
   - Unusual access patterns
   - Secret expiration
3. **Regular Log Reviews**: Weekly review of access logs
4. **Incident Response**: Follow the [Key Vault Alert Runbook](./key-vault-alert-runbook.md)

### Compliance

1. **Data Residency**: Ensure Key Vault is in the correct region
2. **Encryption**: Use Azure-managed encryption keys (Standard tier)
3. **Soft Delete**: Always enable soft delete and purge protection
4. **Backup and Recovery**: Document recovery procedures
5. **Audit Trail**: Maintain audit logs for compliance reporting

---

## Related Documentation

- [Key Vault Alert Runbook](./key-vault-alert-runbook.md) - Security alert response procedures
- [Azure Key Vault Best Practices](https://docs.microsoft.com/azure/key-vault/general/best-practices)
- [Managed Identities for Azure Resources](https://docs.microsoft.com/azure/active-directory/managed-identities-azure-resources/overview)
- [Azure RBAC for Key Vault](https://docs.microsoft.com/azure/key-vault/general/rbac-guide)
- [App Service Key Vault References](https://docs.microsoft.com/azure/app-service/app-service-key-vault-references)

---

## Contact and Support

| Issue Type | Contact |
|------------|---------|
| Access Issues | Platform Team: platform-team@company.com |
| Security Incidents | Security Team: security-team@company.com |
| Secret Rotation | Application Owners: Check app documentation |
| Key Vault Alerts | On-Call Engineer: Check PagerDuty |

For urgent security issues, contact the security team immediately via Slack: `#security-incidents`
