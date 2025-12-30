# GitHub Actions Workflows

This directory contains all CI/CD pipeline workflows for the ChatOps Teams Integration project.

## 📁 Workflow Structure

### Infrastructure Workflows
These workflows manage Azure infrastructure using Terraform:

- **`infra-pr-validation.yml`** - Validates Terraform changes in pull requests
  - Runs on: PR to `main` or `develop` with changes in `infrastructure/`
  - Actions: Format check, validate, plan, security scan (tfsec)
  
- **`infra-deploy-dev.yml`** - Deploys infrastructure to development
  - Runs on: Push to `develop` with changes in `infrastructure/`
  - Actions: Plan, apply, health checks
  
- **`infra-deploy-prod.yml`** - Deploys infrastructure to production
  - Runs on: Push to `main` with changes in `infrastructure/`
  - Actions: Plan, manual approval, apply, smoke tests, rollback capability

### Application Workflows
These workflows build, test, and deploy the application:

- **`app-ci.yml`** - Continuous Integration for application code
  - Runs on: PR to `main` or `develop` with changes in `src/` or `tests/`
  - Actions: 
    - Auto-detect runtime (Node.js or .NET)
    - Build and compile
    - Run unit tests with coverage
    - Run integration tests
    - CodeQL security analysis
    - Dependency scanning (OWASP)
    - Secret scanning (TruffleHog)
    - Code quality analysis (SonarCloud)

- **`app-cd-dev.yml`** - Deploy application to development
  - Runs on: Push to `develop`
  - Actions: Build, test, deploy to Azure App Service, smoke tests

- **`app-cd-staging.yml`** - Deploy application to staging
  - Runs on: Push to `main`
  - Actions: Build, test, deploy to Azure App Service, integration tests, E2E tests

- **`app-cd-prod.yml`** - Deploy application to production
  - Runs on: Manual trigger or release published
  - Actions:
    - Pre-deployment validation
    - Full test suite
    - Manual approval gate
    - Blue-green deployment (zero downtime)
    - Post-deployment validation
    - Automatic rollback on failure
    - Deployment notifications

### Reusable Workflows
These workflows are called by other workflows to reduce duplication:

- **`reusable-terraform.yml`** - Reusable Terraform operations
  - Inputs: environment, action (plan/apply), working_directory
  - Outputs: Terraform outputs (app service name, URL, Key Vault name)

- **`reusable-azure-deploy.yml`** - Reusable Azure App Service deployment
  - Inputs: environment, app_service_name, resource_group, deployment_package_path, health_check_url, notification_webhook_url
  - Outputs: deployment_status, health_check_result, deployment_url
  - Features:
    - Azure login with OIDC
    - App Service deployment
    - Health checks with 3 retries (10s delay)
    - Teams notifications with adaptive cards
    - Comprehensive error handling

## 🔐 Required Secrets

Configure these in **Settings → Secrets and variables → Actions**:

### Repository Secrets
```
AZURE_CLIENT_ID              # Azure service principal client ID
AZURE_TENANT_ID              # Azure tenant ID
AZURE_SUBSCRIPTION_ID        # Azure subscription ID
TERRAFORM_BACKEND_RG         # Terraform state storage resource group
TERRAFORM_BACKEND_SA         # Terraform state storage account
```

### Environment-Specific Secrets
```
# Dev Environment
DEV_APP_SERVICE_NAME         # Optional: Dev App Service name

# Staging Environment  
STAGING_APP_SERVICE_NAME     # Optional: Staging App Service name

# Production Environment
PROD_APP_SERVICE_NAME        # Production App Service name
PROD_RESOURCE_GROUP          # Production resource group name
```

### Optional Secrets
```
SONAR_TOKEN                  # SonarCloud authentication
CODECOV_TOKEN                # Code coverage reporting
```

## 🌍 Required Environments

Create these GitHub Environments in **Settings → Environments**:

1. **dev**
   - No protection rules
   - Auto-deploys on push to `develop`

2. **staging**
   - Optional: Require reviewers
   - Auto-deploys on push to `main`

3. **production**
   - ✅ Required reviewers (2+ recommended)
   - ✅ Deployment branch: `main` only
   - ✅ Optional: Wait timer (5 minutes)
   - Deploys only on manual approval

## 🚀 Workflow Execution Flow

### Infrastructure Deployment Flow
```
PR Created (infra changes)
  ↓
infra-pr-validation.yml
  ├── Terraform format check
  ├── Terraform validate
  ├── Terraform plan (commented on PR)
  └── tfsec security scan
  ↓
Merge to develop
  ↓
infra-deploy-dev.yml
  ├── Terraform plan
  ├── Terraform apply (auto-approved)
  └── Health checks
  ↓
Merge to main
  ↓
infra-deploy-prod.yml
  ├── Terraform plan
  ├── Manual approval ⏸️
  ├── Terraform apply
  ├── Smoke tests
  └── Rollback on failure
```

### Application Deployment Flow
```
PR Created (app changes)
  ↓
app-ci.yml
  ├── Detect runtime (Node.js/.NET)
  ├── Build
  ├── Unit tests
  ├── Integration tests
  ├── CodeQL scan
  ├── Dependency scan
  ├── Secret scan
  └── Code quality
  ↓
Merge to develop
  ↓
app-cd-dev.yml
  ├── Build & test
  ├── Deploy to Dev App Service
  └── Smoke tests
  ↓
Merge to main
  ↓
app-cd-staging.yml
  ├── Build & test
  ├── Deploy to Staging App Service
  ├── Integration tests
  └── E2E tests
  ↓
Manual trigger (v1.0.0)
  ↓
app-cd-prod.yml
  ├── Pre-deployment validation
  ├── Build & full test suite
  ├── Manual approval ⏸️
  ├── Deploy to staging slot
  ├── Health check staging slot
  ├── Swap to production (blue-green)
  ├── Post-deployment validation
  └── Rollback on failure
```

## 📝 Workflow Naming Convention

All workflows follow this naming pattern:
```
{type}-{action}-{environment}.yml

Examples:
infra-pr-validation.yml       # Infrastructure PR validation
infra-deploy-dev.yml          # Infrastructure deployment to dev
app-ci.yml                    # Application continuous integration
app-cd-prod.yml               # Application continuous delivery to prod
reusable-terraform.yml        # Reusable Terraform workflow
```

## 🎯 Key Features

### Multi-Runtime Support
- Auto-detects Node.js or .NET applications
- Configures appropriate build tools and test frameworks
- Supports both runtimes in the same repository

### Security-First Approach
- ✅ CodeQL static analysis
- ✅ Dependency vulnerability scanning (OWASP Dependency Check)
- ✅ Secret scanning (TruffleHog)
- ✅ Infrastructure security (tfsec)
- ✅ OIDC authentication (no long-lived secrets)

### Zero-Downtime Deployments
- Blue-green deployment using Azure App Service slots
- Automatic health checks before traffic swap
- Instant rollback on validation failure

### Comprehensive Testing
- Unit tests with code coverage
- Integration tests with service dependencies
- End-to-end tests (Playwright)
- Smoke tests post-deployment

### Observability
- GitHub Action summaries
- Microsoft Teams notifications
- Azure Application Insights integration
- Deployment audit trail

## 🔍 Monitoring Workflows

### Via GitHub UI
1. Go to **Actions** tab
2. Select a workflow from the left sidebar
3. View run history and logs

### Via GitHub CLI
```bash
# List recent workflow runs
gh run list --limit 10

# View specific workflow runs
gh run list --workflow=app-cd-prod.yml

# View detailed run information
gh run view {RUN_ID}

# Watch a running workflow
gh run watch {RUN_ID}

# Download logs
gh run download {RUN_ID}
```

### Via API
```bash
# Get workflow runs
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/{owner}/{repo}/actions/runs

# Get specific workflow
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/{owner}/{repo}/actions/workflows/app-ci.yml
```

## 🛠️ Customization

### Modify Terraform Version
Edit the `TERRAFORM_VERSION` environment variable in infrastructure workflows:
```yaml
env:
  TERRAFORM_VERSION: '1.6.0'  # Change this
```

### Modify Runtime Versions
Edit the version environment variables in application workflows:
```yaml
env:
  NODE_VERSION: '20.x'        # Change Node.js version
  DOTNET_VERSION: '8.0.x'     # Change .NET version
```

### Add New Environments
1. Create environment in GitHub (Settings → Environments)
2. Copy an existing CD workflow
3. Update environment name throughout
4. Configure environment-specific secrets

### Customize Notification Format
Edit the Teams webhook payload in the notification steps:
```yaml
- name: Send Teams Notification
  run: |
    curl -H "Content-Type: application/json" -d '{
      # Modify Adaptive Card JSON here
    }' ${{ vars.TEAMS_WEBHOOK_URL }}
```

### Using Reusable Workflows

#### Example: Call the Azure Deployment Workflow
```yaml
name: Deploy Application

on:
  push:
    branches: [main]

permissions:
  id-token: write
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build app
        run: |
          # Build your application
          zip -r deployment.zip .
      - uses: actions/upload-artifact@v4
        with:
          name: deployment-package
          path: deployment.zip

  deploy:
    needs: build
    uses: ./.github/workflows/reusable-azure-deploy.yml
    with:
      environment: production
      app_service_name: my-app-service
      resource_group: my-resource-group
      deployment_package_path: deployment.zip
      health_check_url: https://my-app-service.azurewebsites.net/health
      notification_webhook_url: ${{ vars.TEAMS_WEBHOOK_URL }}
    secrets: inherit
```

## 📚 Additional Documentation

- **[Pipeline Setup Guide](../PIPELINE_SETUP.md)** - Complete setup instructions
- **[Quick Reference](../QUICK_REFERENCE.md)** - Commands and checklists
- **[Backlog](../../backlog.md)** - Project requirements and user stories

## 🆘 Troubleshooting

### Workflow Not Triggering
1. Check branch name matches trigger conditions
2. Verify file paths match the `paths:` filter
3. Check workflow file syntax with YAML validator

### Permission Denied Errors
1. Verify `permissions:` block includes required scopes
2. Check service principal has correct Azure RBAC roles
3. Ensure environment protection rules allow the deployment

### Terraform State Lock
```bash
# Release lock manually
az storage blob lease break \
  --container-name tfstate \
  --blob-name {environment}.tfstate \
  --account-name {STORAGE_ACCOUNT_NAME}
```

### Deployment Failures
1. Review workflow logs in the Actions tab
2. Check Azure Portal for resource status
3. Review Application Insights for application errors
4. Check App Service logs with `az webapp log tail`

## 🔗 Useful Links

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Azure CLI Reference](https://docs.microsoft.com/en-us/cli/azure/)
- [Terraform Documentation](https://www.terraform.io/docs)
- [Azure DevOps Best Practices](https://docs.microsoft.com/en-us/azure/architecture/checklist/dev-ops)

---

**Last Updated:** 2025-11-27  
**Maintained by:** DevOps Team
