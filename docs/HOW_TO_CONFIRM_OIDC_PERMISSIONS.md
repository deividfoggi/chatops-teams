# How to Confirm OIDC Identity Permissions

## Quick Answer

The error you're seeing (`Status=403 Code="AuthorizationFailure"`) indicates that while OIDC authentication succeeded, the service principal **lacks permission to access the Azure Storage account** containing the Terraform state.

## Immediate Fix

Run this command to grant the required permission:

```bash
# Set your values
SP_OBJECT_ID="<your-service-principal-object-id>"
SUBSCRIPTION_ID="<your-subscription-id>"
BACKEND_RG="<terraform-backend-resource-group>"
BACKEND_SA="<terraform-backend-storage-account>"

# Grant the role
az role assignment create \
  --assignee $SP_OBJECT_ID \
  --role "Storage Blob Data Contributor" \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$BACKEND_RG/providers/Microsoft.Storage/storageAccounts/$BACKEND_SA"
```

**Or use our quick-fix script:**
```bash
./scripts/quick-fix-storage-permissions.sh
```

## How to Get Service Principal Object ID

```bash
# If you have the App (Client) ID
az ad sp show --id <AZURE_CLIENT_ID> --query id -o tsv
```

## Verify Permissions

### Option 1: Use Our Verification Script (Recommended)

```bash
./scripts/verify-oidc-permissions.sh
```

This interactive script will:
- Check if service principal exists
- Verify federated credentials
- Check all required permissions
- Suggest fixes for any issues found
- Optionally apply fixes automatically

### Option 2: Manual Verification

#### 1. Check if OIDC authentication works
From the logs, you can see:
```
✓ Azure CLI login succeeds by using OIDC.
```
This means OIDC is configured correctly.

#### 2. Check storage permissions
```bash
# Get storage account ID
STORAGE_ID=$(az storage account show \
  --name <STORAGE_ACCOUNT> \
  --resource-group <RESOURCE_GROUP> \
  --query id -o tsv)

# Check role assignments
az role assignment list \
  --assignee <SERVICE_PRINCIPAL_OBJECT_ID> \
  --scope "$STORAGE_ID" \
  --output table
```

**Expected result:** You should see `Storage Blob Data Contributor` or `Storage Blob Data Owner` role.

#### 3. Check federated credentials
```bash
az ad app federated-credential list \
  --id <AZURE_CLIENT_ID> \
  --output table
```

**Expected results:** You should see entries with subjects like:
- `repo:deividfoggi/chatops-teams:environment:dev`
- `repo:deividfoggi/chatops-teams:pull_request`

## Understanding the Error

Looking at your CI logs:

1. ✅ **OIDC login succeeded**: `Azure CLI login succeeds by using OIDC.`
2. ✅ **Federated token was issued**: Subject claim shows `repo:deividfoggi/chatops-teams:environment:dev`
3. ❌ **Storage access failed**: `Status=403 Code="AuthorizationFailure"`

This pattern indicates:
- Service principal exists ✓
- Federated credentials are configured ✓
- OIDC authentication works ✓
- **Storage permissions are missing** ✗ ← This is the problem

## What Permission is Needed

The service principal needs the **Storage Blob Data Contributor** role on the storage account because:

1. Terraform needs to **read** the state file (`*.tfstate`)
2. Terraform needs to **write** updates to the state file
3. Terraform needs to **list** workspace blobs (this is what failed in your case)

The error message specifically says:
```
Failed to get existing workspaces: containers.Client#ListBlobs
```

This is a blob listing operation that requires the Storage Blob Data Contributor role.

## Complete Verification Checklist

Use our [OIDC Quick Checklist](OIDC_CHECKLIST.md) for a comprehensive verification.

### Essential Checks:

- [ ] Service principal has Contributor role at subscription level
- [ ] Service principal has Storage Blob Data Contributor role on storage account ← **Most important**
- [ ] Federated credential exists for the environment (`dev`)
- [ ] Federated credential subject matches: `repo:deividfoggi/chatops-teams:environment:dev`
- [ ] tfstate container exists in storage account
- [ ] GitHub secrets are configured correctly

## After Applying the Fix

1. **Wait 5-10 minutes** for Azure RBAC permissions to propagate
2. Go to your GitHub repository → **Actions** tab
3. Find the failed workflow run
4. Click **Re-run all jobs**
5. The workflow should now succeed

## Additional Resources

- **Comprehensive Guide**: [OIDC Troubleshooting Guide](OIDC_TROUBLESHOOTING.md)
- **Quick Checklist**: [OIDC Checklist](OIDC_CHECKLIST.md)
- **Setup Guide**: [Pipeline Setup](../.github/PIPELINE_SETUP.md)
- **Scripts**: [Scripts README](../scripts/README.md)

## Still Having Issues?

If the problem persists after granting permissions and waiting:

1. Check Azure Activity Logs for the service principal
2. Verify the storage account firewall rules (if any)
3. Confirm the storage account is in the same subscription
4. Check if there are any Azure policies blocking the access
5. Run the comprehensive verification: `./scripts/verify-oidc-permissions.sh`

## Summary

**Your specific issue:** Service principal lacks `Storage Blob Data Contributor` role on the Terraform state storage account.

**Quick fix:** Grant the role using the command or script above, wait 5-10 minutes, then re-run the workflow.

**Prevention:** Follow the complete setup guide in [PIPELINE_SETUP.md](../.github/PIPELINE_SETUP.md) which now includes this critical permission step.
