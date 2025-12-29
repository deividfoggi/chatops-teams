# OIDC Permission Quick Checklist

Use this checklist to quickly verify your OIDC setup is correct. This is especially useful when troubleshooting `AuthorizationFailure` errors.

## ✅ Pre-Flight Checklist

### Azure Service Principal

- [ ] Service principal exists in Azure AD
- [ ] You have the App (Client) ID
- [ ] You have the Tenant ID
- [ ] You have the Subscription ID
- [ ] You have the Service Principal Object ID

**How to verify:**
```bash
az ad sp show --id <APP_ID> --query "{displayName:displayName,appId:appId,objectId:id}"
```

### Federated Credentials

- [ ] Federated credential for `dev` environment exists
- [ ] Federated credential for pull requests exists
- [ ] Federated credential for `main` branch exists (if using branch-based workflows)
- [ ] Subject claims match your repository: `repo:ORG/REPO:environment:ENV`
- [ ] Issuer is: `https://token.actions.githubusercontent.com`
- [ ] Audience is: `api://AzureADTokenExchange`

**How to verify:**
```bash
az ad app federated-credential list --id <APP_ID> --output table
```

### Subscription Permissions

- [ ] Service principal has `Contributor` role at subscription level (or resource group level)

**How to verify:**
```bash
az role assignment list --assignee <SP_OBJECT_ID> --scope "/subscriptions/<SUBSCRIPTION_ID>" --output table
```

### Storage Account Permissions (CRITICAL ⚠️)

- [ ] Storage account exists
- [ ] Storage account resource group exists
- [ ] Service principal has `Storage Blob Data Contributor` role on storage account
- [ ] `tfstate` container exists in storage account

**How to verify:**
```bash
# Check storage account exists
az storage account show --name <STORAGE_ACCOUNT> --resource-group <RG_NAME>

# Check permissions
STORAGE_ID=$(az storage account show --name <STORAGE_ACCOUNT> --resource-group <RG_NAME> --query id -o tsv)
az role assignment list --assignee <SP_OBJECT_ID> --scope "$STORAGE_ID" --output table

# Check container exists
az storage container exists --name tfstate --account-name <STORAGE_ACCOUNT> --auth-mode login
```

### GitHub Configuration

- [ ] `AZURE_CLIENT_ID` secret is set in repository or environment
- [ ] `AZURE_TENANT_ID` secret is set in repository or environment
- [ ] `AZURE_SUBSCRIPTION_ID` secret is set in repository or environment
- [ ] `TERRAFORM_BACKEND_RG` secret is set in repository
- [ ] `TERRAFORM_BACKEND_SA` secret is set in repository
- [ ] GitHub Environment `dev` exists (if using environments)
- [ ] Workflow has `id-token: write` permission

**How to verify:**
- Go to **Settings** → **Secrets and variables** → **Actions**
- Check **Repository secrets** tab
- Check **Environments** → select environment → **Environment secrets**

### Workflow Configuration

- [ ] Workflow uses `azure/login@v2` with OIDC
- [ ] Workflow has `permissions: id-token: write`
- [ ] Workflow specifies environment (e.g., `environment: dev`)
- [ ] Terraform init uses `use_azuread_auth=true`
- [ ] Environment variables include `ARM_USE_OIDC=true`

## 🔧 Quick Fix Commands

### Grant Storage Permissions (Most Common Fix)

```bash
# Set variables
export SP_OBJECT_ID="<service-principal-object-id>"
export SUBSCRIPTION_ID="<subscription-id>"
export BACKEND_RG="<terraform-backend-rg>"
export BACKEND_SA="<terraform-backend-sa>"

# Get storage account ID
STORAGE_ACCOUNT_ID=$(az storage account show \
  --name $BACKEND_SA \
  --resource-group $BACKEND_RG \
  --query id -o tsv)

# Grant role
az role assignment create \
  --assignee $SP_OBJECT_ID \
  --role "Storage Blob Data Contributor" \
  --scope "$STORAGE_ACCOUNT_ID"

# Create container if needed
az storage container create \
  --name tfstate \
  --account-name $BACKEND_SA \
  --auth-mode login
```

### Add Missing Federated Credential

```bash
export APP_ID="<app-id>"
export GITHUB_ORG="<org>"
export GITHUB_REPO="<repo>"

# For dev environment
az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "github-actions-dev",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:'$GITHUB_ORG'/'$GITHUB_REPO':environment:dev",
    "audiences": ["api://AzureADTokenExchange"]
  }'

# For pull requests
az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "github-actions-pr",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:'$GITHUB_ORG'/'$GITHUB_REPO':pull_request",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

## 🚦 Error-to-Fix Mapping

| Error Message | Most Likely Cause | Quick Fix |
|---------------|-------------------|-----------|
| `AuthorizationFailure` (403) | Missing storage permissions | Grant `Storage Blob Data Contributor` role |
| `No matching federated identity` | Missing/incorrect federated credential | Add or fix federated credential |
| `Storage account not found` | Wrong storage account name in secrets | Update `TERRAFORM_BACKEND_SA` secret |
| `Container does not exist` | tfstate container not created | Create `tfstate` container |
| `Invalid client secret` | Using client secret instead of OIDC | Remove client secret, ensure OIDC setup |

## 🎯 Automated Tools

Instead of manual verification, use our scripts:

### Full Verification
```bash
./scripts/verify-oidc-permissions.sh
```

### Quick Fix (Storage Only)
```bash
./scripts/quick-fix-storage-permissions.sh
```

## 📝 Important Notes

1. **Permission Propagation**: After granting permissions, wait 5-10 minutes for Azure RBAC to propagate
2. **Environment Secrets**: If using GitHub Environments, secrets can be set at both repository and environment level
3. **Subject Claims**: For environment-based workflows, use `environment:ENV_NAME`. For branch-based, use `ref:refs/heads/BRANCH_NAME`
4. **Multiple Environments**: You need separate federated credentials for each environment

## 📚 Related Documentation

- [OIDC Troubleshooting Guide](OIDC_TROUBLESHOOTING.md) - Full troubleshooting documentation
- [Pipeline Setup Guide](../.github/PIPELINE_SETUP.md) - Complete pipeline configuration
- [Scripts README](../scripts/README.md) - Information about verification scripts

## 🆘 Still Having Issues?

1. Run the comprehensive verification script: `./scripts/verify-oidc-permissions.sh`
2. Check the [OIDC Troubleshooting Guide](OIDC_TROUBLESHOOTING.md) for detailed explanations
3. Review GitHub Actions workflow logs for specific error messages
4. Check Azure Activity Logs for permission-related events
5. Create an issue in the repository with full error details
