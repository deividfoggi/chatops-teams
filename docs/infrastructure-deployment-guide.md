# Infrastructure Deployment Guide

This guide provides step-by-step instructions for deploying the ChatOps Teams infrastructure using Terraform.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Deployment Workflows](#deployment-workflows)
- [Manual Deployment](#manual-deployment)
- [State Management](#state-management)
- [Troubleshooting](#troubleshooting)

## Overview

The ChatOps Teams infrastructure is managed using Terraform with separate state files for each environment (dev, staging, prod). Infrastructure changes are automatically validated and deployed through GitHub Actions workflows.

### Infrastructure Components

- **Networking**: Virtual Network, Subnets, Network Security Groups
- **Application Gateway**: With WAF v2 and OWASP 3.2 ruleset
- **App Service**: Linux-based Node.js app with VNet integration
- **Key Vault**: Secrets management with RBAC
- **Application Insights**: Monitoring and telemetry
- **Monitoring**: Log Analytics workspace, alerts, and dashboards

## Prerequisites

Before deploying the infrastructure, ensure you have:

1. **Azure Subscription**
   - Active Azure subscription with Contributor access
   - Sufficient quota for Premium V3 App Service Plan

2. **Azure CLI** (for manual deployment)
   ```bash
   az --version  # Should be 2.50.0 or higher (2.60.0+ recommended for Terraform azurerm provider ~> 3.58)
   az login
   az account set --subscription "YOUR_SUBSCRIPTION_ID"
   ```
   
   > **Note**: Azure CLI 2.60.0 or later is recommended for full compatibility with Terraform azurerm provider 3.58+. While 2.50.0 is the minimum supported version, newer versions provide better error handling and feature support.

3. **Terraform** (for manual deployment)
   ```bash
   terraform --version  # Should be 1.6.0 or higher
   ```

4. **Terraform State Backend**
   - Azure Storage Account for storing Terraform state
   - Container named `tfstate`
   - Configured with RBAC access (no shared keys)

5. **GitHub Secrets** (for automated deployment)
   - `AZURE_CLIENT_ID` - Service principal client ID
   - `AZURE_TENANT_ID` - Azure tenant ID
   - `AZURE_SUBSCRIPTION_ID` - Azure subscription ID
   - `TERRAFORM_BACKEND_RG` - Resource group for state storage
   - `TERRAFORM_BACKEND_SA` - Storage account name for state

6. **GitHub Environments**
   - `dev` - Development environment (no approvals)
   - `staging` - Staging environment (optional approvals)
   - `prod` - Production environment (required approvals from 2+ reviewers)

## Environment Setup

### 1. Configure Environment Variables

Each environment has its own configuration file in `infrastructure/environments/`:

- `dev.tfvars` - Development settings
- `staging.tfvars` - Staging settings
- `prod.tfvars` - Production settings

Update these files with your organization's values:

```hcl
# Example: infrastructure/environments/prod.tfvars
environment = "prod"
location    = "eastus"
cost_center = "IT-Operations-Production"
owner       = "ChatOps-Team"
security_alert_email = "security@company.com"
ops_team_email       = "ops@company.com"
admin_group_object_id = "12345678-1234-1234-1234-123456789abc"
devops_sp_object_id   = "87654321-4321-4321-4321-cba987654321"
```

### 2. Find Azure AD Object IDs

To configure Key Vault RBAC, you need Object IDs for:

```bash
# Admin Group Object ID
az ad group show --group "ChatOps-Admins" --query id -o tsv

# DevOps Service Principal Object ID (using app ID)
az ad sp show --id <application-id> --query id -o tsv

# Current User Object ID (for testing)
az ad signed-in-user show --query id -o tsv
```

### 3. Configure State Backend

If you haven't created the state backend yet:

```bash
# Create resource group
az group create \
  --name rg-terraform-state-chatops \
  --location eastus

# Create storage account (name must be globally unique)
az storage account create \
  --name stterraformchatops19932 \
  --resource-group rg-terraform-state-chatops \
  --location eastus \
  --sku Standard_LRS \
  --encryption-services blob \
  --allow-blob-public-access false

# Create container
az storage container create \
  --name tfstate \
  --account-name stterraformchatops19932 \
  --auth-mode login

# Grant access to service principal
az role assignment create \
  --role "Storage Blob Data Contributor" \
  --assignee <service-principal-object-id> \
  --scope "/subscriptions/<subscription-id>/resourceGroups/rg-terraform-state-chatops/providers/Microsoft.Storage/storageAccounts/stterraformchatops19932"
```

## Deployment Workflows

The infrastructure uses automated GitHub Actions workflows for deployment.

### Development Environment

**Trigger**: Automatic on push to `develop` branch

```yaml
Workflow: .github/workflows/infra-deploy-dev.yml
Trigger: push to develop branch
Approval: None required
```

**Process**:
1. Terraform format check
2. Terraform validate
3. Terraform plan
4. Terraform apply (auto-approved)
5. Health checks
6. Deployment notification

### Staging Environment

**Trigger**: Automatic on push to `main` branch

```yaml
Workflow: .github/workflows/infra-deploy-staging.yml
Trigger: push to main branch
Approval: Optional (configure in GitHub)
```

**Process**:
1. Terraform plan
2. Terraform apply (auto-approved)
3. Health checks
4. Deployment notification

### Production Environment

**Trigger**: Automatic on push to `main` branch (with manual approval)

```yaml
Workflow: .github/workflows/infra-deploy-prod.yml
Trigger: push to main branch
Approval: Required (2+ reviewers)
```

**Process**:
1. Terraform plan
2. **Manual approval gate** ⏸️
3. Terraform apply
4. Smoke tests
5. Rollback on failure (manual)
6. Deployment notification

### Pull Request Validation

**Trigger**: Automatic on PR to `main` or `develop`

```yaml
Workflow: .github/workflows/infra-pr-validation.yml
Trigger: PR to main or develop
```

**Process**:
1. Terraform format check
2. Terraform validate
3. Terraform plan (posted as PR comment)
4. Security scan (tfsec)

## Manual Deployment

For manual deployments or local testing:

### 1. Initialize Terraform

```bash
cd infrastructure

terraform init \
  -backend-config="resource_group_name=rg-terraform-state-chatops" \
  -backend-config="storage_account_name=stterraformchatops19932" \
  -backend-config="container_name=tfstate" \
  -backend-config="key=dev.tfstate" \
  -backend-config="use_azuread_auth=true"
```

### 2. Validate Configuration

```bash
# Format code
terraform fmt -recursive

# Validate syntax
terraform validate
```

### 3. Plan Changes

```bash
# Development
terraform plan -var-file="environments/dev.tfvars" -out=tfplan

# Staging
terraform plan -var-file="environments/staging.tfvars" -out=tfplan

# Production
terraform plan -var-file="environments/prod.tfvars" -out=tfplan
```

### 4. Review and Apply

```bash
# Review the plan carefully
terraform show tfplan

# Apply changes
terraform apply tfplan
```

### 5. Verify Deployment

```bash
# Get outputs
terraform output

# Test App Service
APP_URL=$(terraform output -raw app_service_url)
curl "$APP_URL/health"

# Test Key Vault access
KV_NAME=$(terraform output -raw key_vault_name)
az keyvault secret list --vault-name "$KV_NAME"
```

## State Management

### State Files

Each environment has its own state file stored in Azure Storage:

- `dev.tfstate` - Development state
- `staging.tfstate` - Staging state
- `prod.tfstate` - Production state

### State Operations

```bash
# List state resources
terraform state list

# Show specific resource
terraform state show azurerm_linux_web_app.chatops

# Refresh state from Azure
terraform refresh -var-file="environments/dev.tfvars"

# Import existing resource
terraform import azurerm_resource_group.chatops /subscriptions/.../resourceGroups/rg-chatops-dev
```

### State Locking

State is automatically locked during operations using Azure Blob leases.

If a lock gets stuck:

```bash
# Release lock manually
az storage blob lease break \
  --container-name tfstate \
  --blob-name dev.tfstate \
  --account-name stterraformchatops19932
```

### Drift Detection

To detect infrastructure drift:

```bash
# Run plan to detect drift
terraform plan -var-file="environments/prod.tfvars"

# If drift is detected, review and reconcile
terraform apply -var-file="environments/prod.tfvars"
```

## Troubleshooting

### Common Issues

#### 1. Authentication Failures

**Symptom**: `Error: building account: could not acquire access token`

**Solution**:
```bash
# Re-authenticate
az login
az account set --subscription "YOUR_SUBSCRIPTION_ID"

# Verify authentication
az account show
```

#### 2. State Lock Timeout

**Symptom**: `Error acquiring the state lock`

**Solution**:
```bash
# Wait for lock to release (timeout: 20 minutes)
# Or force release if stuck:
az storage blob lease break \
  --container-name tfstate \
  --blob-name <environment>.tfstate \
  --account-name stterraformchatops19932
```

#### 3. Resource Already Exists

**Symptom**: `Error: A resource with the ID ... already exists`

**Solution**:
```bash
# Import existing resource
terraform import <resource_type>.<resource_name> <azure_resource_id>

# Or remove from Azure and let Terraform recreate
az resource delete --ids <azure_resource_id>
```

#### 4. Insufficient Quota

**Symptom**: `Error: quota exceeded for resource`

**Solution**:
- Request quota increase in Azure Portal
- Or change to a lower SKU in variables.tf

#### 5. Workflow Authentication Failed

**Symptom**: GitHub Actions workflow fails with authentication error

**Solution**:
1. Verify GitHub secrets are correctly set
2. Ensure service principal has correct permissions
3. Check OIDC federation is configured
4. Verify environment protection rules

#### 6. Plan Shows Unexpected Changes

**Symptom**: Terraform plan shows changes to resources that shouldn't change

**Solution**:
```bash
# Check for drift
terraform plan -var-file="environments/prod.tfvars" -detailed-exitcode

# Review state
terraform state show <resource>

# If needed, refresh state
terraform refresh -var-file="environments/prod.tfvars"
```

### Getting Help

1. **Check Workflow Logs**
   - Go to Actions tab in GitHub
   - Click on failed workflow
   - Review logs for error messages

2. **Review Azure Portal**
   - Check resource status
   - Review Activity Log
   - Check diagnostics logs

3. **Terraform Debug Mode**
   ```bash
   export TF_LOG=DEBUG
   terraform plan -var-file="environments/dev.tfvars"
   ```

4. **Contact Team**
   - Create issue in GitHub repository
   - Tag with `infrastructure` and `help-wanted`
   - Include error messages and workflow run URL

## Best Practices

1. **Always Review Plans**
   - Never apply without reviewing the plan
   - Pay attention to resource deletions
   - Verify outputs match expectations

2. **Use Environment Files**
   - Don't pass variables via command line
   - Keep environment configs in version control
   - Use descriptive names and comments

3. **Test in Dev First**
   - Deploy to dev environment first
   - Validate changes thoroughly
   - Only promote to staging/prod after verification

4. **Maintain State Hygiene**
   - Never edit state files directly
   - Use `terraform state` commands
   - Keep state backend secure

5. **Document Changes**
   - Update documentation when changing infrastructure
   - Use clear commit messages
   - Link to related issues/PRs

6. **Monitor Deployments**
   - Check health endpoints after deployment
   - Review Application Insights metrics
   - Monitor alerts for issues

## Additional Resources

- [Terraform Documentation](https://www.terraform.io/docs)
- [Azure Provider Documentation](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [Infrastructure README](../infrastructure/README.md)
- [GitHub Actions Workflows](./.github/workflows/README.md)
- [Azure Well-Architected Framework](https://docs.microsoft.com/azure/architecture/framework/)
