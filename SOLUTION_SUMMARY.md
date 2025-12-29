# Solution Summary: OIDC Permission Error

## Problem Statement

You encountered a `403 AuthorizationFailure` error when GitHub Actions tried to initialize Terraform with Azure Storage backend:

```
Error: Failed to get existing workspaces: containers.Client#ListBlobs: 
Failure responding to request: StatusCode=403 -- Original Error: 
autorest/azure: Service returned an error. Status=403 
Code="AuthorizationFailure" 
Message="This request is not authorized to perform this operation."
```

## Root Cause

The error occurred because the Azure service principal used for OIDC authentication **lacks the required permission** to access the Azure Storage account containing the Terraform state files.

While OIDC authentication worked correctly (evidenced by "Azure CLI login succeeds by using OIDC" in the logs), the service principal needs an additional role assignment to perform blob operations on the storage account.

## Solution

Grant the **Storage Blob Data Contributor** role to the service principal on the Terraform state storage account.

### Quick Fix Method 1: Use the Script

```bash
./scripts/quick-fix-storage-permissions.sh
```

### Quick Fix Method 2: Manual Command

```bash
# Get the Service Principal Object ID
SP_OBJECT_ID=$(az ad sp show --id $AZURE_CLIENT_ID --query id -o tsv)

# Grant the role
az role assignment create \
  --assignee $SP_OBJECT_ID \
  --role "Storage Blob Data Contributor" \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$BACKEND_RG/providers/Microsoft.Storage/storageAccounts/$BACKEND_SA"
```

### After Applying the Fix

1. Wait 5-10 minutes for Azure RBAC permissions to propagate
2. Re-run the failed GitHub Actions workflow
3. The workflow should now succeed

## How to Confirm Permissions

### Method 1: Automated Verification (Recommended)

Run the comprehensive verification script:

```bash
./scripts/verify-oidc-permissions.sh
```

This will check:
- ✓ Service principal exists
- ✓ Federated credentials are configured
- ✓ Subscription-level permissions
- ✓ Storage account permissions ← **Most important for this issue**
- ✓ Container exists

### Method 2: Manual Verification

Check storage permissions:

```bash
# Get storage account resource ID
STORAGE_ID=$(az storage account show \
  --name $BACKEND_SA \
  --resource-group $BACKEND_RG \
  --query id -o tsv)

# Check role assignments
az role assignment list \
  --assignee $SP_OBJECT_ID \
  --scope "$STORAGE_ID" \
  --output table
```

You should see `Storage Blob Data Contributor` or `Storage Blob Data Owner` in the output.

## Understanding OIDC Permissions

### What OIDC Provides

OIDC (OpenID Connect) provides **authentication** - it proves the identity of the GitHub Actions workflow to Azure. Your logs show this worked:

```
Azure CLI login succeeds by using OIDC.
Subscription is set successfully.
```

### What OIDC Doesn't Provide

OIDC does **not** provide **authorization** (permissions). After authentication, Azure checks what the authenticated identity is allowed to do. Your service principal needs explicit role assignments for each resource it needs to access.

### Required Permissions for Terraform State

| Resource | Role | Purpose |
|----------|------|---------|
| Subscription | Contributor | Create/manage Azure resources |
| Storage Account | Storage Blob Data Contributor | Read/write Terraform state files |
| Storage Account | Reader (inherited) | Read storage account metadata |

## Complete Documentation

We've created comprehensive documentation to help you:

1. **[How to Confirm OIDC Permissions](docs/HOW_TO_CONFIRM_OIDC_PERMISSIONS.md)** - Direct answer with examples
2. **[OIDC Troubleshooting Guide](docs/OIDC_TROUBLESHOOTING.md)** - Step-by-step troubleshooting (13KB)
3. **[OIDC Checklist](docs/OIDC_CHECKLIST.md)** - Quick verification checklist (6.4KB)
4. **[Pipeline Setup](../.github/PIPELINE_SETUP.md)** - Updated with permission requirements
5. **[Scripts README](scripts/README.md)** - Information about verification scripts

## Verification Scripts

Two scripts are provided to help you:

### 1. verify-oidc-permissions.sh
Interactive script that checks everything and suggests fixes.

**Features:**
- Comprehensive checks of all OIDC components
- Colored output for easy reading
- Automatic fix suggestions
- Optional automatic fix application

**Usage:**
```bash
./scripts/verify-oidc-permissions.sh
```

### 2. quick-fix-storage-permissions.sh
Quick script that grants storage permissions immediately.

**Features:**
- Fast execution
- Focused on storage permissions only
- Clear success/error messages

**Usage:**
```bash
./scripts/quick-fix-storage-permissions.sh
```

## Permission Propagation

**Important:** After granting permissions, Azure RBAC takes 5-10 minutes to propagate changes globally. If you re-run the workflow immediately, it may still fail. Wait a few minutes and try again.

## Prevention

To prevent this issue in the future, follow the complete setup guide in [Pipeline Setup](../.github/PIPELINE_SETUP.md), which now includes:

1. Service principal creation with OIDC
2. Federated credential configuration
3. **Storage permission grant** ← This step was often missed
4. Container creation
5. GitHub secrets configuration

The setup guide now explicitly calls out the storage permission requirement as a critical step.

## Visual Flow

```
GitHub Actions Workflow
       ↓
[1] Request OIDC Token
       ↓
GitHub Token Service
       ↓
[2] Issue Token (subject: repo:org/repo:environment:dev)
       ↓
Azure Entra ID
       ↓
[3] Validate Token & Authenticate ✓
       ↓
Azure RBAC
       ↓
[4] Check Permissions
       ↓
    ┌─────────────────────┐
    │ Subscription-Level  │ ✓ Contributor role exists
    │ Permissions         │
    └─────────────────────┘
       ↓
    ┌─────────────────────┐
    │ Storage Account     │ ✗ Storage Blob Data Contributor missing
    │ Permissions         │   (This caused your error)
    └─────────────────────┘
       ↓
Terraform State Access DENIED (403)
```

## Success Criteria

After applying the fix, you should see:

1. ✓ GitHub Actions workflow completes successfully
2. ✓ Terraform init succeeds
3. ✓ Terraform plan generates without errors
4. ✓ No 403 authorization errors in logs

## Questions or Issues?

If you continue to have issues:

1. Run `./scripts/verify-oidc-permissions.sh` for comprehensive diagnostics
2. Check [OIDC Troubleshooting Guide](docs/OIDC_TROUBLESHOOTING.md) for detailed solutions
3. Review [OIDC Checklist](docs/OIDC_CHECKLIST.md) for quick verification
4. Check Azure Activity Logs for additional error details
5. Open an issue with the complete error message and verification script output

---

**Quick Links:**
- [How to Confirm Permissions](docs/HOW_TO_CONFIRM_OIDC_PERMISSIONS.md)
- [Full Troubleshooting Guide](docs/OIDC_TROUBLESHOOTING.md)
- [Quick Checklist](docs/OIDC_CHECKLIST.md)
- [Pipeline Setup](../.github/PIPELINE_SETUP.md)
