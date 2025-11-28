# Pipeline Quick Reference

## 🚀 Quick Setup Checklist

### 1. GitHub Environments
- [ ] Create `dev` environment (no protection)
- [ ] Create `staging` environment (optional reviewers)
- [ ] Create `production` environment (required reviewers)

### 2. Repository Secrets
```bash
# Required for all workflows
AZURE_CLIENT_ID           # Service principal client ID
AZURE_TENANT_ID           # Azure tenant ID
AZURE_SUBSCRIPTION_ID     # Azure subscription ID
TERRAFORM_BACKEND_RG      # Terraform state resource group
TERRAFORM_BACKEND_SA      # Terraform state storage account
```

### 3. Optional Secrets
```bash
SONAR_TOKEN              # SonarCloud analysis
INFRACOST_API_KEY        # Cost estimation
CODECOV_TOKEN            # Code coverage
```

### 4. Repository Variables
```bash
TEAMS_WEBHOOK_URL        # Microsoft Teams notifications
```

---

## 📋 Workflow Triggers

| Workflow | Automatic Trigger | Manual Trigger |
|----------|------------------|----------------|
| Infrastructure PR Validation | PR to `main`/`develop` | ✅ |
| Infrastructure Deploy Dev | Push to `develop` | ✅ |
| Infrastructure Deploy Prod | Push to `main` | ✅ |
| Application CI | PR to `main`/`develop` | ✅ |
| Application CD Dev | Push to `develop` | ✅ |
| Application CD Staging | Push to `main` | ✅ |
| Application CD Production | ❌ | ✅ (requires approval) |

---

## 🔄 Deployment Process

### Infrastructure

```
1. Create PR → Validate & Plan
2. Merge to develop → Deploy to Dev
3. Merge to main → Manual Approval → Deploy to Production
```

### Application

```
1. Create PR → CI Checks (build, test, scan)
2. Merge to develop → Deploy to Dev
3. Merge to main → Deploy to Staging
4. Manual Trigger → Approval → Blue-Green Deploy to Production
```

---

## 🎯 Common Commands

### Run Production Deployment
```yaml
# Go to: Actions → Application - CD to Production
- Branch: main
- Release version: v1.0.0
- Confirmation: DEPLOY
```

### Tag a Release
```bash
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

### Check Workflow Status
```bash
gh run list --workflow=app-cd-prod.yml
gh run view {RUN_ID}
```

---

## 🔧 Azure CLI Setup

### Create Service Principal with OIDC
```bash
# Create SP
SP_OUTPUT=$(az ad sp create-for-rbac \
  --name "github-actions-chatops" \
  --role contributor \
  --scopes /subscriptions/{SUBSCRIPTION_ID})

# Extract values
CLIENT_ID=$(echo $SP_OUTPUT | jq -r '.appId')
TENANT_ID=$(echo $SP_OUTPUT | jq -r '.tenant')

# Configure OIDC
az ad app federated-credential create \
  --id $CLIENT_ID \
  --parameters '{
    "name": "github-actions-main",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:{ORG}/{REPO}:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

### Create Terraform Backend
```bash
RG_NAME="rg-terraform-state"
SA_NAME="sttfstate$(openssl rand -hex 4)"

az group create --name $RG_NAME --location eastus
az storage account create \
  --name $SA_NAME \
  --resource-group $RG_NAME \
  --sku Standard_LRS
az storage container create \
  --name tfstate \
  --account-name $SA_NAME
```

---

## 🛡️ Security Checks

Each PR runs:
- ✅ Terraform validation (if infra changes)
- ✅ tfsec security scan
- ✅ CodeQL analysis
- ✅ Dependency scanning
- ✅ Secret scanning
- ✅ Unit & integration tests
- ✅ Code quality (SonarCloud)

---

## 📊 Monitoring

### View Logs
- GitHub Actions: Repository → Actions tab
- Azure: Portal → App Service → Log stream
- Application Insights: Portal → Monitoring

### Health Check Endpoints
```
Dev:        https://{app-name}-dev.azurewebsites.net/health
Staging:    https://{app-name}-staging.azurewebsites.net/health
Production: https://{app-name}.azurewebsites.net/health
```

---

## 🚨 Troubleshooting

### Deployment Failed
1. Check workflow logs in Actions tab
2. Review Azure Portal for resource status
3. Check Application Insights for errors
4. Review rollback options

### Terraform State Lock
```bash
az storage blob lease break \
  --container-name tfstate \
  --blob-name {env}.tfstate \
  --account-name {storage-account}
```

### Failed Health Check
1. Check app logs: `az webapp log tail --name {app-name}`
2. Verify health endpoint: `curl https://{app-url}/health`
3. Check environment variables in Azure Portal
4. Review App Service configuration

---

## 📞 Quick Links

- [Full Documentation](./.github/PIPELINE_SETUP.md)
- [GitHub Actions Logs](../../actions)
- [Azure Portal](https://portal.azure.com)
- [Backlog](../../backlog.md)

---

## 💡 Pro Tips

1. **Always test in dev first** - Merge to `develop` before `main`
2. **Use semantic versioning** - v{MAJOR}.{MINOR}.{PATCH}
3. **Monitor after deployment** - Check logs and metrics for 15 minutes
4. **Write good commit messages** - They appear in deployment logs
5. **Tag important releases** - Makes rollback easier

---

**Need Help?** Check the full [PIPELINE_SETUP.md](./PIPELINE_SETUP.md) documentation.
