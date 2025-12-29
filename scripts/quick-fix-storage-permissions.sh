#!/bin/bash

# Quick Fix Script for OIDC Storage Permissions
# This script quickly grants the required Storage Blob Data Contributor role to the service principal

set -e

echo "=========================================="
echo "Quick Fix: Grant Storage Permissions"
echo "=========================================="
echo ""

# Get required information
read -p "Service Principal Object ID: " SP_OBJECT_ID
read -p "Azure Subscription ID: " SUBSCRIPTION_ID
read -p "Terraform Backend Resource Group: " BACKEND_RG
read -p "Terraform Backend Storage Account: " BACKEND_SA

echo ""
echo "Validating inputs..."

# Login check
if ! az account show &> /dev/null; then
    echo "❌ Not logged in to Azure. Please run: az login"
    exit 1
fi

# Set subscription
az account set --subscription $SUBSCRIPTION_ID

# Get storage account ID
echo "Getting storage account details..."
STORAGE_ACCOUNT_ID=$(az storage account show \
    --name $BACKEND_SA \
    --resource-group $BACKEND_RG \
    --query id -o tsv 2>/dev/null)

if [ -z "$STORAGE_ACCOUNT_ID" ]; then
    echo "❌ Storage account not found: $BACKEND_SA in resource group $BACKEND_RG"
    exit 1
fi

echo "✓ Storage account found: $STORAGE_ACCOUNT_ID"
echo ""

# Grant Storage Blob Data Contributor role
echo "Granting Storage Blob Data Contributor role..."
if az role assignment create \
    --assignee $SP_OBJECT_ID \
    --role "Storage Blob Data Contributor" \
    --scope "$STORAGE_ACCOUNT_ID" 2>/dev/null; then
    echo "✓ Role assigned successfully"
else
    echo "⚠ Role assignment may already exist or failed"
fi

echo ""

# Create tfstate container
echo "Ensuring tfstate container exists..."
if az storage container create \
    --name tfstate \
    --account-name $BACKEND_SA \
    --auth-mode login \
    --only-show-errors 2>/dev/null; then
    echo "✓ Container created"
else
    echo "⚠ Container already exists or creation failed"
fi

echo ""
echo "=========================================="
echo "✓ Setup Complete!"
echo "=========================================="
echo ""
echo "Important:"
echo "  - Role propagation may take 5-10 minutes"
echo "  - Re-run your GitHub Actions workflow after waiting"
echo ""
echo "Next steps:"
echo "  1. Wait 5-10 minutes for permissions to propagate"
echo "  2. Go to your GitHub repository"
echo "  3. Navigate to Actions tab"
echo "  4. Re-run the failed workflow"
echo ""
