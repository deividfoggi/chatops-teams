# OIDC Authentication Troubleshooting Guide

## Overview

This guide helps you diagnose and fix OIDC (OpenID Connect) authentication issues when GitHub Actions workflows fail to access Azure resources, specifically when you encounter authorization errors like:

```
Error: Failed to get existing workspaces: containers.Client#ListBlobs: 
Failure responding to request: StatusCode=403 -- Original Error: 
autorest/azure: Service returned an error. Status=403 
Code="AuthorizationFailure" 
Message="This request is not authorized to perform this operation."
```

## Understanding the Error

The 403 Authorization Failure typically means:
1. The service principal exists and OIDC authentication worked
2. However, the service principal lacks the necessary **permissions** to access the Azure Storage account containing the Terraform state

## Prerequisites

Before starting, ensure you have:
- Azure CLI installed and logged in: `az login`
- GitHub CLI installed (optional): `gh auth login`
- Owner or User Access Administrator role in the Azure subscription
- Admin access to the GitHub repository

## Step 1: Verify OIDC Configuration

### 1.1 Check Federated Credentials

```bash
# Set your variables
export APP_ID="<your-service-principal-app-id>"
export GITHUB_ORG="<your-github-org>"
export GITHUB_REPO="<your-repo-name>"

# List federated credentials
az ad app federated-credential list --id $APP_ID --output table
```

**What to look for:**
- You should see federated credentials for each environment (dev, staging, production)
- Subject claims should match your repository and environment:
  - `repo:${GITHUB_ORG}/${GITHUB_REPO}:environment:dev`
  - `repo:${GITHUB_ORG}/${GITHUB_REPO}:environment:staging`
  - `repo:${GITHUB_ORG}/${GITHUB_REPO}:environment:production`
  - `repo:${GITHUB_ORG}/${GITHUB_REPO}:ref:refs/heads/main`
  - `repo:${GITHUB_ORG}/${GITHUB_REPO}:ref:refs/heads/develop`

### 1.2 Verify Service Principal Details

```bash
# Get service principal details
az ad sp show --id $APP_ID --query "{displayName:displayName, appId:appId, objectId:id}" -o table

# Get the object ID (you'll need this for role assignments)
export SP_OBJECT_ID=$(az ad sp show --id $APP_ID --query id -o tsv)
echo "Service Principal Object ID: $SP_OBJECT_ID"
```

## Step 2: Check Current Permissions

### 2.1 Check Subscription-Level Permissions

```bash
# Set your subscription ID
export SUBSCRIPTION_ID="<your-subscription-id>"

# Check role assignments at subscription level
az role assignment list \
  --assignee $SP_OBJECT_ID \
  --scope "/subscriptions/$SUBSCRIPTION_ID" \
  --output table
```

**Expected:** You should see at least `Contributor` role at the subscription level.

### 2.2 Check Storage Account Permissions

```bash
# Set your Terraform backend storage details
export BACKEND_RG="<your-terraform-backend-rg>"
export BACKEND_SA="<your-terraform-backend-sa>"

# Get storage account resource ID
export STORAGE_ACCOUNT_ID=$(az storage account show \
  --name $BACKEND_SA \
  --resource-group $BACKEND_RG \
  --query id -o tsv)

echo "Storage Account ID: $STORAGE_ACCOUNT_ID"

# Check role assignments on storage account
az role assignment list \
  --assignee $SP_OBJECT_ID \
  --scope "$STORAGE_ACCOUNT_ID" \
  --output table
```

**Expected:** You should see one of these roles:
- `Storage Blob Data Contributor`
- `Storage Blob Data Owner`
- `Storage Account Contributor`

## Step 3: Grant Required Permissions

### 3.1 Grant Storage Blob Data Contributor Role

This is the **most important** step to fix the 403 error:

```bash
# Grant Storage Blob Data Contributor role on the storage account
az role assignment create \
  --assignee $SP_OBJECT_ID \
  --role "Storage Blob Data Contributor" \
  --scope "$STORAGE_ACCOUNT_ID"

# Verify the assignment
az role assignment list \
  --assignee $SP_OBJECT_ID \
  --scope "$STORAGE_ACCOUNT_ID" \
  --output table
```

### 3.2 Grant Additional Permissions (if needed)

If you need to create resources or manage the storage account itself:

```bash
# Grant Storage Account Contributor role
az role assignment create \
  --assignee $SP_OBJECT_ID \
  --role "Storage Account Contributor" \
  --scope "$STORAGE_ACCOUNT_ID"
```

### 3.3 Verify Resource Group Permissions

```bash
# Check resource group permissions
export RG_ID="/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$BACKEND_RG"

az role assignment list \
  --assignee $SP_OBJECT_ID \
  --scope "$RG_ID" \
  --output table
```

## Step 4: Configure Federated Credentials (if missing)

If federated credentials are missing or incorrect:

```bash
# For dev environment
az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "github-actions-dev",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:'$GITHUB_ORG'/'$GITHUB_REPO':environment:dev",
    "audiences": ["api://AzureADTokenExchange"],
    "description": "GitHub Actions - Dev Environment"
  }'

# For main branch (used in PR validation)
az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "github-actions-main",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:'$GITHUB_ORG'/'$GITHUB_REPO':ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"],
    "description": "GitHub Actions - Main Branch"
  }'

# For pull requests (important for PR validation workflows)
az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "github-actions-pr",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:'$GITHUB_ORG'/'$GITHUB_REPO':pull_request",
    "audiences": ["api://AzureADTokenExchange"],
    "description": "GitHub Actions - Pull Requests"
  }'
```

## Step 5: Verify GitHub Secrets

Ensure these secrets are configured in your GitHub repository:

1. Go to: **Settings** → **Secrets and variables** → **Actions** → **Secrets**
2. Verify these repository secrets exist:
   - `AZURE_CLIENT_ID` - The Application (client) ID of your service principal
   - `AZURE_TENANT_ID` - Your Azure AD tenant ID
   - `AZURE_SUBSCRIPTION_ID` - Your Azure subscription ID
   - `TERRAFORM_BACKEND_RG` - Resource group name for Terraform state
   - `TERRAFORM_BACKEND_SA` - Storage account name for Terraform state

3. Verify the environment secrets (for each environment: dev, staging, production):
   - In **Settings** → **Environments** → select environment → **Environment secrets**
   - Ensure the secrets are accessible to the environment

## Step 6: Test the Configuration

### 6.1 Test with Azure CLI

```bash
# Login with service principal using OIDC simulation
az login --service-principal \
  --username $APP_ID \
  --tenant $TENANT_ID \
  --federated-token "$(az account get-access-token --query accessToken -o tsv)"

# Try to list blobs in the tfstate container
az storage blob list \
  --container-name tfstate \
  --account-name $BACKEND_SA \
  --auth-mode login

# If successful, you should see a list of state files (or empty list if none exist)
```

### 6.2 Test with Terraform

Create a test script to verify Terraform backend access:

```bash
# Create a test directory
mkdir -p /tmp/terraform-test
cd /tmp/terraform-test

# Create a minimal Terraform configuration
cat > test.tf <<EOF
terraform {
  required_version = ">= 1.0"
  
  backend "azurerm" {
    resource_group_name  = "$BACKEND_RG"
    storage_account_name = "$BACKEND_SA"
    container_name       = "tfstate"
    key                  = "test.tfstate"
    use_azuread_auth     = true
  }
}

provider "azurerm" {
  features {}
}
EOF

# Set environment variables for OIDC
export ARM_CLIENT_ID=$APP_ID
export ARM_TENANT_ID=$TENANT_ID
export ARM_SUBSCRIPTION_ID=$SUBSCRIPTION_ID
export ARM_USE_OIDC=true

# Try to initialize (this will fail locally without GitHub OIDC token)
# But it validates the configuration
terraform init
```

## Step 7: Re-run the GitHub Actions Workflow

After applying the fixes:

1. Go to your GitHub repository
2. Navigate to **Actions** tab
3. Find the failed workflow run
4. Click **Re-run all jobs**
5. Monitor the logs to confirm the issue is resolved

## Common Issues and Solutions

### Issue 1: "No matching federated identity record found"

**Cause:** Federated credential subject doesn't match the workflow context.

**Solution:**
- For environment-based workflows, ensure the subject is: `repo:ORG/REPO:environment:ENVIRONMENT_NAME`
- For branch-based workflows, ensure the subject is: `repo:ORG/REPO:ref:refs/heads/BRANCH_NAME`
- For pull requests, ensure the subject is: `repo:ORG/REPO:pull_request`

### Issue 2: "AuthorizationFailed" even after granting permissions

**Cause:** Azure RBAC permissions can take up to 5 minutes to propagate.

**Solution:**
- Wait 5-10 minutes after granting permissions
- Re-run the workflow
- Clear any cached credentials by restarting the workflow

### Issue 3: "Storage account not found"

**Cause:** Service principal doesn't have read access to the storage account metadata.

**Solution:**
```bash
# Grant Reader role at subscription or resource group level
az role assignment create \
  --assignee $SP_OBJECT_ID \
  --role "Reader" \
  --scope "/subscriptions/$SUBSCRIPTION_ID"
```

### Issue 4: "Container does not exist"

**Cause:** The `tfstate` container hasn't been created in the storage account.

**Solution:**
```bash
# Create the container
az storage container create \
  --name tfstate \
  --account-name $BACKEND_SA \
  --auth-mode login
```

## Complete Setup Script

Here's a complete script that sets up everything:

```bash
#!/bin/bash

# Azure and GitHub Configuration
export SUBSCRIPTION_ID="<your-subscription-id>"
export GITHUB_ORG="<your-github-org>"
export GITHUB_REPO="<your-repo-name>"
export BACKEND_RG="<terraform-backend-rg>"
export BACKEND_SA="<terraform-backend-sa>"
export SP_NAME="github-actions-chatops"

# Login to Azure
az login

# Set subscription
az account set --subscription $SUBSCRIPTION_ID

# Create Service Principal
echo "Creating Service Principal..."
SP_OUTPUT=$(az ad sp create-for-rbac \
  --name "$SP_NAME" \
  --role contributor \
  --scopes "/subscriptions/$SUBSCRIPTION_ID" \
  --sdk-auth)

export APP_ID=$(echo $SP_OUTPUT | jq -r '.clientId')
export TENANT_ID=$(echo $SP_OUTPUT | jq -r '.tenantId')
export SP_OBJECT_ID=$(az ad sp show --id $APP_ID --query id -o tsv)

echo "Service Principal Created:"
echo "  App ID: $APP_ID"
echo "  Tenant ID: $TENANT_ID"
echo "  Object ID: $SP_OBJECT_ID"

# Create Federated Credentials
echo "Creating Federated Credentials..."

# For dev environment
az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "github-actions-dev",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:'$GITHUB_ORG'/'$GITHUB_REPO':environment:dev",
    "audiences": ["api://AzureADTokenExchange"],
    "description": "GitHub Actions - Dev Environment"
  }'

# For pull requests
az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "github-actions-pr",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:'$GITHUB_ORG'/'$GITHUB_REPO':pull_request",
    "audiences": ["api://AzureADTokenExchange"],
    "description": "GitHub Actions - Pull Requests"
  }'

# Grant Storage Blob Data Contributor role
echo "Granting Storage Blob Data Contributor role..."
STORAGE_ACCOUNT_ID=$(az storage account show \
  --name $BACKEND_SA \
  --resource-group $BACKEND_RG \
  --query id -o tsv)

az role assignment create \
  --assignee $SP_OBJECT_ID \
  --role "Storage Blob Data Contributor" \
  --scope "$STORAGE_ACCOUNT_ID"

# Create tfstate container if it doesn't exist
echo "Creating tfstate container..."
az storage container create \
  --name tfstate \
  --account-name $BACKEND_SA \
  --auth-mode login \
  --only-show-errors

echo ""
echo "Setup Complete! Add these secrets to GitHub:"
echo "  AZURE_CLIENT_ID: $APP_ID"
echo "  AZURE_TENANT_ID: $TENANT_ID"
echo "  AZURE_SUBSCRIPTION_ID: $SUBSCRIPTION_ID"
echo "  TERRAFORM_BACKEND_RG: $BACKEND_RG"
echo "  TERRAFORM_BACKEND_SA: $BACKEND_SA"
```

## Permission Requirements Summary

| Resource | Role | Purpose |
|----------|------|---------|
| Subscription | Contributor | Create and manage Azure resources |
| Storage Account | Storage Blob Data Contributor | Read/write Terraform state files |
| Storage Account | Reader | Read storage account metadata |

## Additional Resources

- [Azure Workload Identity Federation](https://learn.microsoft.com/en-us/azure/active-directory/workload-identities/workload-identity-federation)
- [GitHub Actions - Azure Login](https://github.com/Azure/login)
- [Terraform Azure Backend](https://www.terraform.io/language/settings/backends/azurerm)
- [Azure RBAC Documentation](https://learn.microsoft.com/en-us/azure/role-based-access-control/overview)

## Support

If you continue to experience issues after following this guide:
1. Check the GitHub Actions workflow logs for detailed error messages
2. Review Azure Activity Logs for permission-related events
3. Open an issue in the repository with the full error message and steps taken
