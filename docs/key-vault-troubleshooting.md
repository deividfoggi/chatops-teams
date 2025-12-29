# Key Vault Troubleshooting

## Issue: App Service cannot access secrets
**Symptoms:** Application throws "Unauthorized" or "Forbidden" errors

**Solution:**
1. Verify managed identity is enabled:
   ```bash
   az webapp identity show --resource-group rg-chatops-prod --name chatops-app-service
   ```
   Note the `principalId` from the output.

2. Verify RBAC role assignment:
   ```bash
   # First, get your Key Vault resource ID
   export KV_ID=$(az keyvault show --name <your-keyvault-name> --query id --output tsv)
   
   # Then check role assignments using the principal ID from step 1
   az role assignment list --scope $KV_ID --assignee <principal-id-from-step-1>
   ```
3. Verify Key Vault reference syntax in App Settings

## Issue: Secret not found
**Symptoms:** "SecretNotFound" error

**Solution:**
1. List secrets: `az keyvault secret list --vault-name $KV_NAME`
2. Check secret name spelling
3. Verify secret has not expired
4. Check RBAC permissions

## Issue: Purge protection prevents deletion
**Symptoms:** Cannot delete Key Vault

**Solution:**
- Purge protection is intentional security feature
- Soft-deleted vaults can be recovered for 90 days
- Contact Azure Support to disable purge protection if absolutely necessary
