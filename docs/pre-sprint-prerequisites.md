# Pre-Sprint 1: Prerequisites and Immediate Actions

**Target Completion:** November 29, 2025 (2 days before Sprint 1)  
**Sprint 1 Start Date:** December 2, 2025

---

## Overview

This document outlines all prerequisites that must be completed before Sprint 1 can begin. These prerequisites address critical dependencies, infrastructure requirements, and security configurations that will unblock development work in Sprint 1 and beyond.

---

## Table of Contents

1. [Critical Actions (Start Immediately)](#critical-actions-start-immediately)
2. [Standard Prerequisites](#standard-prerequisites)
3. [Validation Checklist](#validation-checklist)
4. [Risk Assessment](#risk-assessment)
5. [Communication Plan](#communication-plan)
6. [Success Criteria](#success-criteria)

---

## Critical Actions (Start Immediately)

### 1. GitHub App Registration Approval ⚠️ URGENT

**Priority:** URGENT  
**Deadline:** November 29, 2025  
**Owner:** DevOps Engineer  
**Estimated Time:** 30 minutes setup + 3-5 business days approval

**Why This Matters:**
GitHub App registration can take 3-5 business days for approval. This blocks Epics 1-4 (GitHub Integration, Code Scanning Alerts, Dependabot Alerts, and Deployment Reviews). Starting this immediately is critical to maintaining the project timeline.

**Actions Required:**

- [ ] **Step 1:** Navigate to GitHub Organization Settings
  - Go to `https://github.com/organizations/[YOUR-ORG]/settings/apps`
  - Click "New GitHub App"

- [ ] **Step 2:** Configure Basic Information
  - **App Name:** `ChatOps Teams Integration` (or preferred name)
  - **Homepage URL:** `https://chatops.yourdomain.com` (or temporary URL)
  - **Webhook URL:** `https://chatops.yourdomain.com/api/github/webhooks` (will be updated after App Service deployment)
  - **Webhook Secret:** Generate strong secret (store in password manager)
  - **Description:** "Automated Teams notifications for GitHub security alerts and deployment approvals"

- [ ] **Step 3:** Configure Webhook Events
  Enable the following webhook events:
  - `code_scanning_alert` - For code scanning notifications (Epic 2)
  - `dependabot_alert` - For Dependabot notifications (Epic 3)
  - `deployment_protection_rule` - For deployment approvals (Epic 4)
  - `deployment_status` - For deployment tracking
  - `repository` - For repository lifecycle events

- [ ] **Step 4:** Configure Permissions
  Repository permissions:
  - **Actions:** Read (for deployment workflows)
  - **Code scanning alerts:** Read & write (for alert management)
  - **Dependabot alerts:** Read & write (for alert management)
  - **Contents:** Read (for commit information)
  - **Deployments:** Read & write (for deployment approvals)
  - **Metadata:** Read (mandatory, for repository info)

  Organization permissions:
  - **Members:** Read (for user lookups)

- [ ] **Step 5:** Generate Credentials
  - Generate and download **private key** (PEM format)
  - Note the **App ID** (shown on app settings page)
  - Copy the **Webhook Secret** you created

- [ ] **Step 6:** Store Credentials Securely
  - **Temporarily:** Store in secure password manager or encrypted vault
  - **Permanently (Sprint 1):** Will be moved to Azure Key Vault in Issue #42

  ```bash
  # Example: Store in temporary secure location
  # DO NOT commit these to Git!
  # App ID: 123456
  # Private Key: github-app-private-key.pem
  # Webhook Secret: [generated-secret]
  ```

- [ ] **Step 7:** Request Installation Approval
  - Submit app for organization approval
  - Contact organization admins with justification
  - Provide app details and security review documentation

- [ ] **Step 8:** Monitor Approval Status
  - Check email for approval notifications
  - Follow up daily if no response within 48 hours
  - Escalate to project manager if approval delayed beyond 3 days

**Blocks:**
- Issue #2: Configure GitHub Webhook Endpoints
- Issue #3: Implement GitHub API Client
- All webhook-dependent stories in Epics 1-4

**Documentation:**
See [GitHub Webhook Configuration](./github-webhook-configuration.md) for detailed setup instructions.

---

### 2. Azure Quota Verification ⚠️ HIGH PRIORITY

**Priority:** HIGH  
**Deadline:** November 28, 2025  
**Owner:** Cloud Architect  
**Estimated Time:** 1-2 hours

**Why This Matters:**
Quota issues discovered mid-sprint cause significant delays. Azure subscriptions have default quotas that may be insufficient for our infrastructure requirements. Verifying and requesting increases now prevents deployment failures in Sprint 1 and Sprint 2.

**Actions Required:**

- [ ] **Step 1:** Check Current Quota and Usage

  ```bash
  # Set your Azure region (adjust as needed)
  LOCATION="eastus"
  
  # Check VM/App Service quota (includes App Service Plans)
  echo "=== App Service / Compute Quota ==="
  az vm list-usage --location $LOCATION --query "[?contains(name.value, 'standard')]" --output table
  
  # Check Public IP addresses quota
  echo "=== Public IP Addresses Quota ==="
  az network public-ip list-usage --location $LOCATION --output table
  
  # Check Application Gateway quota
  echo "=== Application Gateway Quota ==="
  az network application-gateway list --output table
  az network list-usages --location $LOCATION --query "[?contains(name.value, 'ApplicationGateways')]" --output table
  
  # Check Key Vault quota (usually unlimited for Standard tier)
  echo "=== Key Vault Resources ==="
  az keyvault list --output table
  ```

- [ ] **Step 2:** Verify Required Quotas

  **Minimum Requirements:**
  
  | Resource | Required | Default Quota | Notes |
  |----------|----------|---------------|-------|
  | App Service PremiumV3 cores | 4 cores (2 instances × 2 cores) | 10-20 cores | For Issue #35 (App Service) |
  | Application Gateway v2 instances | 1 instance | 10 instances | For Issue #37 (App Gateway) |
  | Public IP addresses (Standard) | 2 (App Gateway + Load Balancer) | 10 IPs | For Issues #37, #35 |
  | Key Vault (Standard tier) | 1 instance | Usually unlimited | For Issue #42 (Already deployed) |
  | Virtual Network | 1 VNet | 50-1000 VNets | For Issue #41 (Already deployed) |

- [ ] **Step 3:** Request Quota Increases (If Needed)

  If any quota is insufficient:

  ```bash
  # Example: Request App Service quota increase
  # Navigate to Azure Portal > Subscriptions > [Your Subscription] > Usage + quotas
  # Or use Azure CLI (requires Support plan)
  
  # Create support request for quota increase
  # Specify:
  # - Resource type: Compute / App Service
  # - Region: East US (or your region)
  # - New quota limit: [Your required amount + 20% buffer]
  # - Justification: "ChatOps Teams Integration project - production deployment"
  ```

  **Note:** Quota increase requests typically take 24-48 hours for approval.

- [ ] **Step 4:** Document Current Quota

  Create a file `docs/azure-quota-report.txt` with current quota status:

  ```
  Azure Quota Report - [Date]
  Region: [Your Region]
  Subscription: [Subscription ID]
  
  Resource                          | Current Usage | Quota | Buffer | Status
  ----------------------------------|---------------|-------|--------|--------
  App Service PremiumV3 cores       | X / Y         | Y     | Z%     | ✅ OK / ⚠️ REQUEST
  Application Gateway v2 instances  | X / Y         | Y     | Z%     | ✅ OK
  Public IP addresses (Standard)    | X / Y         | Y     | Z%     | ✅ OK
  Key Vault instances               | X / Unlimited | ∞     | N/A    | ✅ OK
  
  Actions Required:
  - [List any quota increase requests needed]
  
  Request Status:
  - [Track quota increase request status]
  ```

- [ ] **Step 5:** Validate Quota Increases

  After quota increase approval, re-run verification scripts to confirm new limits.

**Blocks:**
- Sprint 1 infrastructure deployment (if quota insufficient)
- Issue #37: Deploy Application Gateway with WAF (Sprint 2)
- Issue #35: Deploy Azure App Service (Sprint 2)

**Escalation:**
If quota increases cannot be obtained in time:
- Consider alternative regions (West US, West US 2, Central US)
- Reduce instance sizes as temporary workaround
- Escalate to Azure account manager for expedited approval

---

### 3. SSL Certificate Procurement

**Priority:** MEDIUM-HIGH  
**Deadline:** December 5, 2025  
**Owner:** Security Engineer  
**Estimated Time:** 1-2 hours (varies by certificate type)

**Why This Matters:**
SSL certificate is required for Application Gateway (Sprint 2, Issue #37) to enable HTTPS termination. Certificate procurement can take days to weeks depending on the type and approval process.

**Actions Required:**

- [ ] **Step 1:** Determine Certificate Type

  **Option A: Azure App Service Certificate** (Recommended for simplicity)
  - **Cost:** $69.99/year
  - **Pros:** Managed by Azure, automatic renewal, easy integration with Key Vault
  - **Cons:** Requires custom domain ownership verification
  - **Procurement Time:** 1-4 hours

  **Option B: Let's Encrypt (Free)**
  - **Cost:** Free
  - **Pros:** No cost, widely trusted
  - **Cons:** 90-day validity (requires automation), more complex setup
  - **Procurement Time:** 1-2 hours (plus automation setup)

  **Option C: Corporate/Commercial CA**
  - **Cost:** Varies ($50-$500+/year)
  - **Pros:** Corporate compliance, extended validation options
  - **Cons:** Procurement process, may require approvals
  - **Procurement Time:** 1-10 business days

  **Decision:** [ ] Select certificate option and document rationale

- [ ] **Step 2:** Acquire Custom Domain (If Not Already Owned)

  - Register domain: `chatops.yourdomain.com` or similar
  - Configure DNS to point to Azure resources (will be updated in Sprint 2)

- [ ] **Step 3:** Order Certificate (Based on Selection)

  **For Azure App Service Certificate:**
  ```bash
  # Navigate to Azure Portal
  # Search for "App Service Certificates"
  # Click "Create"
  # Specify:
  # - Domain: chatops.yourdomain.com
  # - Certificate type: Standard (S1)
  # - Resource group: rg-chatops-prod
  # Complete domain verification (email or DNS TXT record)
  # Wait for certificate issuance (1-4 hours)
  ```

  **For Let's Encrypt:**
  - Use certbot or ACME client
  - Complete domain validation (HTTP-01 or DNS-01 challenge)
  - Export certificate and private key
  - Plan automation for 90-day renewal

  **For Corporate CA:**
  - Follow organization's certificate request process
  - Provide CSR (Certificate Signing Request)
  - Complete domain validation
  - Download certificate chain and private key

- [ ] **Step 4:** Store Certificate Securely

  - **Temporarily:** Store in secure password manager or encrypted storage
  - **Permanently (Sprint 2):** Will be imported to Azure Key Vault in Issue #37

  ```bash
  # Do NOT commit certificate files to Git!
  # Store files securely:
  # - certificate.crt (public certificate)
  # - certificate.key (private key)
  # - ca-bundle.crt (intermediate certificates, if applicable)
  ```

- [ ] **Step 5:** Document Certificate Information

  Create `docs/ssl-certificate-info.txt`:
  ```
  SSL Certificate Information
  ---------------------------
  Domain: chatops.yourdomain.com
  Certificate Type: [Azure App Service Certificate / Let's Encrypt / Corporate CA]
  Issued By: [CA Name]
  Issue Date: [Date]
  Expiration Date: [Date]
  Renewal Process: [Manual / Automated]
  Storage Location: [Azure Key Vault (planned) / Temporary secure storage]
  
  Renewal Reminders:
  - 90 days before expiration: Begin renewal process
  - 30 days before expiration: Escalate if not renewed
  - 7 days before expiration: Emergency escalation
  ```

- [ ] **Step 6:** Plan Certificate Installation

  Certificate will be installed in Sprint 2 (Issue #37) when Application Gateway is deployed.

**Blocks:**
- Issue #37: Deploy Application Gateway with WAF (Sprint 2)

**Notes:**
- Certificate procurement can proceed in parallel with Sprint 1
- If using Let's Encrypt, plan automation for renewal in Sprint 3-4

---

### 4. User Mapping Strategy Documentation

**Priority:** HIGH  
**Deadline:** December 2, 2025  
**Owner:** Integration Developer  
**Estimated Time:** 3-4 hours

**Why This Matters:**
GitHub username → Entra ID mapping affects all notification workflows (Epics 2, 3, 4). A clear strategy prevents notification delivery failures and ensures the right people are notified for security alerts and deployment approvals.

**Actions Required:**

- [ ] **Step 1:** Document Mapping Approach

  Create `docs/user-mapping-strategy.md`:

  ```markdown
  # GitHub to Entra ID User Mapping Strategy
  
  ## Overview
  
  This strategy defines how GitHub usernames are mapped to Microsoft Entra ID (Azure AD) identities for Teams notifications.
  
  ## Mapping Hierarchy
  
  ### Primary: Email-Based Matching
  Match GitHub user email to Entra ID UserPrincipalName (UPN):
  - Query GitHub API for user's primary email: `GET /users/{username}`
  - Query Microsoft Graph API for Entra ID user by UPN: `GET /users/{email}`
  - **Success Rate:** ~80-90% (if users have consistent emails)
  
  ### Secondary: Proxy Addresses Matching
  If primary match fails, check Entra ID proxyAddresses:
  - Query Entra ID: `GET /users?$filter=proxyAddresses/any(x:x eq 'smtp:{email}')`
  - **Success Rate:** ~5-10% additional matches
  
  ### Tertiary: Manual Mapping Table
  Maintain manual mapping table in database:
  - Table: `user_mappings` (github_username, entra_id_user_id, mapping_type, last_verified)
  - Allow manual overrides for special cases
  - **Success Rate:** Covers remaining 5-10% of users
  
  ### Fallback: Alert to Admins
  For unmapped users:
  - Log unmapped user to Application Insights
  - Send notification to admin channel: "Unmapped user detected: @{github_username}"
  - Provide self-service mapping form (future enhancement)
  
  ## Implementation Details
  
  ### Caching Strategy
  - Cache successful mappings for 1 hour (TTL: 3600 seconds)
  - Invalidate cache on manual mapping updates
  - Store in Redis or in-memory cache
  
  ### Sync Frequency
  - Real-time lookup on first notification
  - Background sync job: Daily at 2 AM UTC
  - Sync validates existing mappings and flags stale entries
  
  ### Error Handling
  - Mapping failures logged with context (username, email, reason)
  - Retry logic: 3 attempts with exponential backoff
  - Admin dashboard shows mapping success rate metrics
  
  ## Database Schema
  
  ```sql
  CREATE TABLE user_mappings (
    id BIGINT PRIMARY KEY IDENTITY(1,1),
    github_username NVARCHAR(255) NOT NULL UNIQUE,
    entra_id_user_id UNIQUEIDENTIFIER NOT NULL,
    email NVARCHAR(255) NOT NULL,
    mapping_type NVARCHAR(50) NOT NULL, -- 'email', 'proxy', 'manual'
    last_verified DATETIME2 NOT NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    INDEX idx_github_username (github_username),
    INDEX idx_entra_id (entra_id_user_id)
  );
  ```
  
  ## Testing Strategy
  
  ### Pilot Repositories
  1. Select 3-5 pilot repositories with diverse teams
  2. Test mapping accuracy with pilot users
  3. Gather feedback and iterate before org-wide rollout
  
  ### Success Metrics
  - Mapping success rate > 95%
  - Average lookup time < 200ms
  - Zero false positive mappings
  
  ## Compliance and Privacy
  - User email addresses stored encrypted in database
  - Mapping data retained for 90 days after user removal
  - Users can request mapping removal via support
  ```

- [ ] **Step 2:** Identify Pilot Repositories and Users

  Create list of pilot repositories for testing:
  - Select repositories with active development
  - Ensure diverse user base (employees, contractors, external collaborators)
  - Contact repository owners for participation

  Document in `docs/user-mapping-pilot.md`:
  ```
  Pilot Repository: [repo-name]
  Owner: [owner-name]
  Active Users: [count]
  Expected Mapping Challenges: [any known issues]
  ```

- [ ] **Step 3:** Create Mapping Database Schema

  Prepare SQL schema for database deployment in Sprint 1 or 2:
  - Include in infrastructure setup (Issue #40: Database deployment)
  - Review schema with database administrator

- [ ] **Step 4:** Document Fallback Strategy

  Define what happens when users cannot be mapped:
  - Notification sent to default admin channel
  - Email notification as alternative (if email available)
  - Teams notification to repository owner
  - Logging and alerting for unmapped users

- [ ] **Step 5:** Plan Sync Frequency

  Determine how often to refresh user mappings:
  - **Real-time:** On first notification (with caching)
  - **Daily:** Background sync at 2 AM UTC
  - **Weekly:** Full validation of all mappings

- [ ] **Step 6:** Review and Approve Strategy

  - Review strategy with security team
  - Review with compliance/privacy team
  - Get approval from project stakeholders
  - Document any modifications or exceptions

**Blocks:**
- Issue #4: Map GitHub Users to Microsoft Entra ID (Sprint 2+)
- All notification stories in Epics 2, 3, 4

**Related:**
- Issue #3: Implement GitHub API Client
- Microsoft Graph API permissions (see Standard Prerequisites #8)

---

## Standard Prerequisites

### 5. Azure Subscription Setup

**Priority:** HIGH  
**Deadline:** November 28, 2025  
**Owner:** Cloud Architect  
**Estimated Time:** 30 minutes

**Actions Required:**

- [ ] **Confirm Azure Subscription Access**
  ```bash
  # Verify you have access
  az login
  az account show
  
  # Verify your role
  az role assignment list --assignee $(az account show --query user.name -o tsv) --all --query "[?contains(roleDefinitionName, 'Owner') || contains(roleDefinitionName, 'Contributor')]" --output table
  ```

  Required role: **Owner** or **Contributor** (minimum)

- [ ] **Create Resource Group**
  ```bash
  # Create resource group for production environment
  az group create \
    --name rg-chatops-prod \
    --location eastus \
    --tags Environment=Production Application=ChatOps CostCenter=[Your-CostCenter] Owner=[Your-Team] ManagedBy=Terraform
  ```

- [ ] **Create Log Analytics Workspace**
  ```bash
  # Create Log Analytics workspace (required for Sprint 1)
  az monitor log-analytics workspace create \
    --resource-group rg-chatops-prod \
    --workspace-name chatops-loganalytics \
    --location eastus \
    --retention-time 90 \
    --tags Environment=Production Application=ChatOps
  
  # Get workspace ID (needed for Application Insights)
  az monitor log-analytics workspace show \
    --resource-group rg-chatops-prod \
    --workspace-name chatops-loganalytics \
    --query id -o tsv
  ```

- [ ] **Document Subscription Information**

  Create `docs/azure-subscription-info.txt`:
  ```
  Azure Subscription Information
  ------------------------------
  Subscription Name: [Name]
  Subscription ID: [ID]
  Tenant ID: [Tenant ID]
  Primary Region: eastus
  Secondary Region: westus (for DR)
  
  Resource Group: rg-chatops-prod
  Log Analytics Workspace: chatops-loganalytics
  Log Analytics Workspace ID: [Workspace ID]
  
  Administrators:
  - [Name 1] - Owner
  - [Name 2] - Contributor
  
  Cost Center: [Your Cost Center]
  Budget: [Monthly budget]
  ```

**Validation:**
```bash
# Verify resource group exists
az group show --name rg-chatops-prod

# Verify Log Analytics workspace
az monitor log-analytics workspace show --resource-group rg-chatops-prod --workspace-name chatops-loganalytics
```

---

### 6. Naming Convention & Tagging Strategy

**Priority:** MEDIUM  
**Deadline:** November 28, 2025  
**Owner:** Cloud Architect  
**Estimated Time:** 1 hour

**Actions Required:**

- [ ] **Define Naming Convention**

  Create `docs/naming-conventions.md`:

  ```markdown
  # Azure Resource Naming Conventions
  
  ## Pattern
  `{application}-{resource-type}-{environment}-{region}-{instance}`
  
  **Simplified Pattern (for most resources):**
  `chatops-{resource-type}-{environment}`
  
  ## Examples
  
  | Resource Type | Example Name | Pattern |
  |---------------|--------------|---------|
  | Resource Group | `rg-chatops-prod` | `rg-{app}-{env}` |
  | Virtual Network | `chatops-vnet-prod` | `{app}-vnet-{env}` |
  | App Service Plan | `chatops-asp-prod` | `{app}-asp-{env}` |
  | App Service | `chatops-app-prod` | `{app}-app-{env}` |
  | Key Vault | `chatops-kv-prod-xyz` | `{app}-kv-{env}-{random}` * |
  | Application Insights | `chatops-appinsights-prod` | `{app}-appinsights-{env}` |
  | Application Gateway | `chatops-agw-prod` | `{app}-agw-{env}` |
  | SQL Database | `chatops-db-prod` | `{app}-db-{env}` |
  | Storage Account | `chatopsstgprod` | `{app}stg{env}` ** |
  | Network Security Group | `chatops-app-nsg-prod` | `{app}-{subnet}-nsg-{env}` |
  | Public IP | `chatops-agw-pip-prod` | `{app}-{resource}-pip-{env}` |
  
  *Key Vault names must be globally unique; append random suffix if needed
  **Storage Account names must be lowercase, no hyphens, globally unique
  
  ## Abbreviations
  - `rg` - Resource Group
  - `vnet` - Virtual Network
  - `asp` - App Service Plan
  - `app` - App Service
  - `kv` - Key Vault
  - `agw` - Application Gateway
  - `db` - Database
  - `stg` - Storage Account
  - `nsg` - Network Security Group
  - `pip` - Public IP
  - `nic` - Network Interface
  - `vm` - Virtual Machine
  
  ## Environment Abbreviations
  - `prod` - Production
  - `stg` - Staging
  - `dev` - Development
  - `test` - Testing
  ```

- [ ] **Define Tagging Strategy**

  Add to `docs/naming-conventions.md`:

  ```markdown
  # Azure Resource Tagging Strategy
  
  ## Required Tags (All Resources)
  
  | Tag Name | Description | Values | Example |
  |----------|-------------|--------|---------|
  | `Environment` | Deployment environment | Production, Staging, Development, Test | Production |
  | `Application` | Application name | ChatOps | ChatOps |
  | `CostCenter` | Cost allocation | [Your org structure] | Engineering |
  | `Owner` | Resource owner | Team or individual email | devops-team@company.com |
  | `ManagedBy` | Management method | Terraform, Bicep, Manual, GitHub-Actions | Terraform |
  
  ## Optional Tags
  
  | Tag Name | Description | Example |
  |----------|-------------|---------|
  | `Project` | Project identifier | chatops-teams |
  | `Version` | Application version | 1.0.0 |
  | `Criticality` | Business criticality | High, Medium, Low |
  | `DataClassification` | Data sensitivity | Public, Internal, Confidential |
  | `ComplianceRequirement` | Compliance standards | SOC2, ISO27001, GDPR |
  | `BackupPolicy` | Backup requirements | Daily, Weekly, None |
  | `DRTier` | Disaster recovery tier | Tier1 (< 1 hour), Tier2 (< 4 hours), Tier3 (< 24 hours) |
  
  ## Terraform Example
  
  ```hcl
  locals {
    common_tags = {
      Environment         = "Production"
      Application         = "ChatOps"
      CostCenter         = "Engineering"
      Owner              = "devops-team@company.com"
      ManagedBy          = "Terraform"
      Project            = "chatops-teams"
      Criticality        = "High"
      DataClassification = "Internal"
    }
  }
  
  resource "azurerm_resource_group" "main" {
    name     = "rg-chatops-prod"
    location = "eastus"
    tags     = local.common_tags
  }
  ```
  
  ## Tag Governance
  
  - Tags applied via Azure Policy (enforce)
  - Cost reports generated by `CostCenter` and `Application` tags
  - Quarterly tag compliance audit
  - Resources without required tags: deployment blocked or flagged
  ```

- [ ] **Document in Team Wiki or README**

  - Add naming conventions to team wiki
  - Link from main README.md
  - Share with all team members

- [ ] **Get Approval from Stakeholders**

  - Cloud Architect review
  - Finance team approval (for cost tracking)
  - Governance team approval

**Validation:**
- All team members acknowledge naming conventions
- Sample resources created follow conventions
- Tags align with organization's governance policies

---

### 7. Azure CLI and Access Setup

**Priority:** HIGH  
**Deadline:** November 29, 2025  
**Owner:** All team members  
**Estimated Time:** 30 minutes per team member

**Actions Required:**

- [ ] **Install Azure CLI**

  **Windows:**
  ```powershell
  # Download and run MSI installer
  # https://aka.ms/installazurecliwindows
  
  # Or use winget
  winget install -e --id Microsoft.AzureCLI
  ```

  **macOS:**
  ```bash
  brew update && brew install azure-cli
  ```

  **Linux (Ubuntu/Debian):**
  ```bash
  curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
  ```

- [ ] **Verify Installation**

  ```bash
  # Check Azure CLI version
  az --version
  # Should show version 2.50.0 or later
  
  # Check for updates
  az upgrade
  ```

- [ ] **Configure Azure CLI Authentication**

  ```bash
  # Interactive login (browser-based)
  az login
  
  # Verify access
  az account show
  
  # List available subscriptions
  az account list --output table
  
  # Set default subscription (if you have multiple)
  az account set --subscription "[Your Subscription Name or ID]"
  ```

- [ ] **Install Azure CLI Extensions**

  ```bash
  # Install Application Insights extension
  az extension add --name application-insights
  
  # Install Log Analytics extension
  az extension add --name log-analytics
  
  # Verify extensions
  az extension list --output table
  ```

- [ ] **Configure Azure CLI Defaults (Optional but Recommended)**

  ```bash
  # Set default resource group
  az config set defaults.group=rg-chatops-prod
  
  # Set default location
  az config set defaults.location=eastus
  
  # Set default output format (table is more readable)
  az config set core.output=table
  
  # View all defaults
  az config get
  ```

- [ ] **Test Access to Resources**

  ```bash
  # List resource groups (should see rg-chatops-prod)
  az group list
  
  # List resources in resource group
  az resource list --resource-group rg-chatops-prod
  
  # Test Log Analytics workspace access
  az monitor log-analytics workspace show \
    --resource-group rg-chatops-prod \
    --workspace-name chatops-loganalytics
  ```

**Validation:**
- [ ] Azure CLI installed and version ≥ 2.50.0
- [ ] Authentication successful (can run `az account show`)
- [ ] Access to subscription verified
- [ ] Required extensions installed
- [ ] Can list resources in rg-chatops-prod

**Troubleshooting:**
```bash
# If authentication fails, try device code flow
az login --use-device-code

# If you have MFA/Conditional Access, ensure compliance
az login --tenant [Your-Tenant-ID]

# Clear token cache if experiencing issues
az account clear
az login
```

---

### 8. Microsoft Graph API Permissions

**Priority:** HIGH  
**Deadline:** December 2, 2025  
**Owner:** Identity Administrator  
**Estimated Time:** 1-2 hours

**Why This Matters:**
Required for Entra ID user lookups (Issue #4, user mapping) and Teams integration (Issue #31). Admin consent is required and may take 1-2 days depending on organizational approval processes.

**Actions Required:**

- [ ] **Step 1: Create Entra ID App Registration**

  ```bash
  # Create app registration via Azure CLI
  az ad app create \
    --display-name "ChatOps Teams Integration" \
    --sign-in-audience AzureADMyOrg \
    --web-redirect-uris "https://chatops.yourdomain.com/auth/callback"
  
  # Note the Application (client) ID
  APP_ID=$(az ad app list --display-name "ChatOps Teams Integration" --query "[0].appId" -o tsv)
  echo "Application ID: $APP_ID"
  
  # Note the Directory (tenant) ID
  TENANT_ID=$(az account show --query tenantId -o tsv)
  echo "Tenant ID: $TENANT_ID"
  ```

  **Or via Azure Portal:**
  1. Navigate to Azure Portal → Azure Active Directory → App registrations
  2. Click "New registration"
  3. Name: "ChatOps Teams Integration"
  4. Supported account types: "Accounts in this organizational directory only"
  5. Redirect URI: "https://chatops.yourdomain.com/auth/callback" (will update later)
  6. Click "Register"

- [ ] **Step 2: Grant Microsoft Graph API Permissions**

  **Required Application Permissions:**

  | Permission | Type | Justification |
  |------------|------|---------------|
  | `User.Read.All` | Application | Read all user profiles for GitHub → Entra ID mapping |
  | `TeamSettings.Read.All` | Application | Read Teams settings for notification delivery |

  **Via Azure Portal:**
  1. App registration → API permissions → Add a permission
  2. Microsoft Graph → Application permissions
  3. Select `User.Read.All`
  4. Add permission
  5. Repeat for `TeamSettings.Read.All`

  **Via Azure CLI:**
  ```bash
  # Grant User.Read.All permission (Graph API)
  az ad app permission add \
    --id $APP_ID \
    --api 00000003-0000-0000-c000-000000000000 \
    --api-permissions df021288-bdef-4463-88db-98f22de89214=Role
  
  # Grant TeamSettings.Read.All permission
  az ad app permission add \
    --id $APP_ID \
    --api 00000003-0000-0000-c000-000000000000 \
    --api-permissions ab888eed-b5c4-4c96-ac6e-29c9f4c1c37c=Role
  ```

- [ ] **Step 3: Request Admin Consent**

  **Via Azure Portal:**
  1. App registration → API permissions
  2. Click "Grant admin consent for [Your Organization]"
  3. Confirm consent

  **Via Azure CLI:**
  ```bash
  # Admin consent (requires Global Administrator or Privileged Role Administrator)
  az ad app permission admin-consent --id $APP_ID
  ```

  **If you don't have admin rights:**
  - Request consent from your Entra ID administrator
  - Provide justification: "Required for ChatOps Teams Integration to map GitHub users to Entra ID and send Teams notifications"
  - Escalate to project manager if approval delayed

- [ ] **Step 4: Generate Client Secret**

  ```bash
  # Create client secret (valid for 2 years)
  az ad app credential reset \
    --id $APP_ID \
    --append \
    --credential-description "ChatOps Teams Integration Secret" \
    --years 2
  
  # Save the output - you won't be able to view it again!
  # Copy the "password" field immediately
  ```

  **Or via Azure Portal:**
  1. App registration → Certificates & secrets
  2. Click "New client secret"
  3. Description: "ChatOps Teams Integration Secret"
  4. Expires: 24 months
  5. Click "Add"
  6. **COPY THE SECRET VALUE IMMEDIATELY** (you can't view it again)

- [ ] **Step 5: Store Credentials Securely**

  **Document the following (temporarily in secure password manager):**
  ```
  Entra ID App Registration
  -------------------------
  Application (client) ID: [Client ID]
  Directory (tenant) ID: [Tenant ID]
  Client Secret: [Secret Value]
  Client Secret Expiry: [Expiry Date]
  
  Redirect URI: https://chatops.yourdomain.com/auth/callback
  
  Permissions:
  - User.Read.All (Application)
  - TeamSettings.Read.All (Application)
  
  Admin Consent Status: [Granted / Pending]
  ```

  **Permanently store in Azure Key Vault (Sprint 1, Issue #42):**
  - Secret name: `entra-client-id` → [Client ID]
  - Secret name: `entra-client-secret` → [Client Secret]
  - Secret name: `entra-tenant-id` → [Tenant ID]

- [ ] **Step 6: Test API Access (After Admin Consent)**

  ```bash
  # Install jq for JSON parsing (optional)
  # sudo apt-get install jq  # Linux
  # brew install jq          # macOS
  
  # Get access token
  ACCESS_TOKEN=$(curl -s -X POST \
    "https://login.microsoftonline.com/$TENANT_ID/oauth2/v2.0/token" \
    -d "client_id=$APP_ID" \
    -d "scope=https://graph.microsoft.com/.default" \
    -d "client_secret=$CLIENT_SECRET" \
    -d "grant_type=client_credentials" \
    | jq -r '.access_token')
  
  # Test User.Read.All permission
  curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
    "https://graph.microsoft.com/v1.0/users?$top=5" \
    | jq '.value[] | {displayName, userPrincipalName}'
  
  # Test TeamSettings.Read.All permission (requires Teams license)
  curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
    "https://graph.microsoft.com/v1.0/teams" \
    | jq '.value[] | {displayName, id}'
  ```

  **Expected Result:** Should return user list and Teams list (if you have Teams)

**Blocks:**
- Issue #4: Map GitHub Users to Microsoft Entra ID
- Issue #31: Teams App Manifest and Registration (Teams integration)
- All notification workflows

**Escalation:**
If admin consent is delayed:
- Escalate to Identity/IT administrator
- Provide security justification and impact analysis
- Request expedited approval with project manager support

---

## Validation Checklist

Before Sprint 1 begins, verify all prerequisites are complete:

### Critical Actions
- [ ] **GitHub App created** and approval pending/granted
  - App ID and private key generated
  - Webhook events configured
  - Credentials stored securely
  - Installation approval requested/received

- [ ] **Azure quota verified** and sufficient
  - App Service PremiumV3: ≥ 4 cores available
  - Application Gateway v2: ≥ 1 instance available
  - Public IP addresses: ≥ 2 available
  - Quota increase requests submitted if needed

- [ ] **SSL certificate ordered** or procurement plan documented
  - Certificate type selected
  - Domain ownership verified (if applicable)
  - Certificate ordered or acquisition in progress
  - Storage plan documented

- [ ] **User mapping strategy documented** and reviewed
  - Mapping approach defined (email-based, proxy, manual)
  - Database schema designed
  - Fallback strategy documented
  - Stakeholder approval obtained

### Standard Prerequisites
- [ ] **Azure subscription accessible** with correct permissions
  - Owner or Contributor role confirmed
  - Resource group created: `rg-chatops-prod`
  - Log Analytics workspace created: `chatops-loganalytics`
  - Subscription info documented

- [ ] **Naming and tagging conventions agreed upon**
  - Naming convention documented
  - Tagging strategy defined
  - Team acknowledgment received
  - Wiki/README updated

- [ ] **Azure CLI installed and authenticated** on all machines
  - CLI version ≥ 2.50.0
  - Authentication successful
  - Required extensions installed
  - Resource access verified

- [ ] **Entra ID app registration created** with Graph API permissions
  - App registration created
  - `User.Read.All` permission granted
  - `TeamSettings.Read.All` permission granted
  - Admin consent obtained
  - Client secret generated and stored
  - API access tested

- [ ] **Log Analytics workspace created**
  - Workspace ID documented
  - 90-day retention configured
  - Access verified

- [ ] **Team trained on Azure fundamentals** (if needed)
  - Azure fundamentals training completed (if required)
  - Key Vault usage training completed
  - Terraform basics reviewed

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation Status | Action Required |
|------|-------------|--------|-------------------|-----------------|
| **GitHub App approval delayed** | High | High | ⚠️ Start immediately | Submit app registration by Nov 27 |
| **Azure quota insufficient** | Medium | High | ⚠️ Check ASAP | Verify quota by Nov 28 |
| **SSL certificate delays** | Medium | Medium | ⚠️ Order now | Start procurement by Nov 28 |
| **Graph API permissions delayed** | Low | Medium | ✅ Can proceed with Sprint 1 | Request by Dec 1 (Sprint 2 dependency) |
| **Team lacks Azure knowledge** | Low | Low | ✅ Training available | On-demand training, documentation |
| **Naming convention conflicts** | Low | Low | ✅ Review with stakeholders | Finalize by Nov 28 |
| **Budget overrun concerns** | Low | Medium | ✅ Cost estimates provided | Monthly cost reviews |

### Risk Mitigation Actions

**For GitHub App Approval Delays:**
- Submit registration 5 business days before Sprint 1
- Escalate to organization admins immediately
- Have project manager engage with approval stakeholders
- Prepare fallback: manual webhook configuration (less secure)

**For Azure Quota Issues:**
- Verify quota 1 week before Sprint 1
- Submit increase requests with 48-hour lead time
- Identify alternative regions if quota unavailable
- Consider temporary instance size reduction

**For SSL Certificate Delays:**
- Order certificate 2 weeks before needed (Sprint 2)
- Use Let's Encrypt as temporary solution if needed
- Escalate to procurement if corporate CA delays

---

## Communication Plan

### Daily Updates
- **Channel:** Microsoft Teams - #chatops-project
- **Frequency:** Daily standup (9:00 AM)
- **Format:** 
  ```
  Pre-Sprint Prerequisite Update - [Date]
  
  ✅ Completed:
  - [List completed tasks]
  
  🔄 In Progress:
  - [List in-progress tasks with % complete]
  
  ⚠️ Blockers:
  - [List any blockers with escalation status]
  
  📅 Next 24 Hours:
  - [List planned tasks]
  ```

### Status Updates
- Update this issue with checkbox progress daily
- Tag project manager on critical blockers
- Post summary in Teams channel every evening

### Blockers and Escalations
- **Immediate escalation:** Any item cannot be completed by deadline
- **Escalation path:**
  1. Team Lead (same day)
  2. Project Manager (within 24 hours)
  3. Executive Sponsor (within 48 hours if unresolved)

### Questions and Support
- **Technical questions:** Post in Teams #chatops-project channel
- **Approval questions:** Direct message to appropriate stakeholder
- **Urgent issues:** Tag @project-manager in Teams

### Weekly Sync Meeting
- **Frequency:** Weekly (Mondays at 10:00 AM)
- **Attendees:** All prerequisite owners + Project Manager
- **Agenda:**
  - Review completion status
  - Identify blockers
  - Adjust timeline if needed
  - Assign action items

---

## Success Criteria

This prerequisite phase is complete when:

### Critical Actions Complete
- [ ] All 4 critical actions have checkboxes marked complete or have documented mitigation plans:
  1. ✅ GitHub App registration submitted and approval received/pending with tracking
  2. ✅ Azure quota verified as sufficient OR increase requests submitted
  3. ✅ SSL certificate ordered OR procurement plan documented
  4. ✅ User mapping strategy documented and reviewed

### Standard Prerequisites Complete
- [ ] All 4 standard prerequisites are complete:
  5. ✅ Azure subscription accessible with resource group and Log Analytics
  6. ✅ Naming and tagging conventions agreed and documented
  7. ✅ Azure CLI installed on all team members' machines
  8. ✅ Entra ID app registration created with Graph API permissions

### Validation and Approval
- [ ] Validation checklist completed (all items checked or exceptions documented)
- [ ] Risk assessment reviewed and mitigation plans in place
- [ ] Sprint 1 team confirms readiness to begin
- [ ] Sprint Planning meeting scheduled

### Documentation Complete
- [ ] All required documentation created and reviewed
- [ ] Team wiki updated with prerequisite information
- [ ] Credentials securely stored (temporary storage documented)
- [ ] Stakeholder approvals obtained

### Sprint 1 Unblocked
- [ ] No critical blockers remain that would prevent Sprint 1 start
- [ ] All Sprint 1 dependencies are ready or have fallback plans
- [ ] Team velocity and capacity confirmed for Sprint 1

---

## Timeline

```
Day 1 (November 27, 2025):
├─ Submit GitHub App registration (Action 1)
├─ Verify Azure quotas (Action 2)
├─ Create Azure subscription setup (Action 5)
├─ Define naming conventions (Action 6)
└─ Install Azure CLI (Action 7)

Day 2 (November 28, 2025):
├─ Order SSL certificate (Action 3)
├─ Create Entra ID app registration (Action 8)
├─ Document user mapping strategy (Action 4)
├─ Complete naming convention approval
└─ Complete validation checklist

Day 3 (November 29, 2025):
├─ Verify all actions complete
├─ Request admin consents (as needed)
├─ Test API access
├─ Final validation
└─ Sprint 1 team readiness confirmation

Sprint 1 Start (December 2, 2025):
└─ Sprint Planning meeting and kickoff
```

---

## Related Documentation

- [Sprint 1 Foundation Planning](./sprint-1-foundation-planning.md)
- [Product Backlog](../backlog.md)
- [Infrastructure README](../infrastructure/README.md)
- [GitHub Webhook Configuration](./github-webhook-configuration.md)
- [Key Vault Usage Guide](./key-vault-usage.md)
- [Network Architecture](./network-architecture.md)

---

**Document Owner:** Project Manager  
**Last Updated:** [Current Date]  
**Next Review:** Pre-Sprint 1 (December 1, 2025)  
**Status:** 📋 Active - Prerequisites In Progress
