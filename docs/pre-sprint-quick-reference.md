# Pre-Sprint Prerequisites - Quick Reference

**Target Completion:** November 29, 2025  
**Sprint 1 Start:** December 2, 2025

## Critical Actions (Start Immediately)

### 1. GitHub App Registration ⚠️ URGENT
- **Deadline:** November 29, 2025
- **Owner:** DevOps Engineer
- **Time:** 30 min + 3-5 days approval

**Quick Steps:**
```bash
# 1. Navigate to: https://github.com/organizations/[YOUR-ORG]/settings/apps
# 2. Create new GitHub App
# 3. Configure webhook events: code_scanning_alert, dependabot_alert, deployment_protection_rule
# 4. Generate App ID, private key, webhook secret
# 5. Request installation approval from org admins
```

**Blocks:** Issues #2, #3, and all webhook-dependent stories

---

### 2. Azure Quota Verification ⚠️ HIGH PRIORITY
- **Deadline:** November 28, 2025
- **Owner:** Cloud Architect
- **Time:** 1-2 hours

**Quick Check:**
```bash
# Run automated verification script
cd docs/scripts
./verify-azure-quotas.sh eastus

# Or check manually
az vm list-usage --location eastus --output table
az network public-ip list-usage --location eastus --output table
```

**Requirements:**
- App Service PremiumV3: 4 cores minimum
- Public IP addresses: 2 minimum
- Application Gateway v2: 1 instance minimum

**Blocks:** Sprint 1 infrastructure deployment, Issues #37, #35

---

### 3. SSL Certificate Procurement
- **Deadline:** December 5, 2025
- **Owner:** Security Engineer
- **Time:** 1-2 hours

**Options:**
- **Azure App Service Certificate:** $69.99/year (recommended)
- **Let's Encrypt:** Free, 90-day renewal
- **Corporate CA:** Follow org process

**Quick Steps:**
```bash
# Option A: Azure Portal > App Service Certificates > Create
# Option B: Use certbot for Let's Encrypt
# Option C: Submit corporate certificate request
```

**Blocks:** Issue #37 (Application Gateway with SSL)

---

### 4. User Mapping Strategy
- **Deadline:** December 2, 2025
- **Owner:** Integration Developer
- **Time:** 3-4 hours

**Recommended Approach:**
1. Primary: Match GitHub email → Entra ID UserPrincipalName
2. Secondary: Match GitHub email → Entra ID proxyAddresses
3. Tertiary: Manual mapping table in database
4. Fallback: Alert admins for unmapped users

**Document:** Create `docs/user-mapping-strategy.md` with database schema

**Blocks:** Issue #4 (User Mapping), all notification workflows

---

## Standard Prerequisites

### 5. Azure Subscription Setup
- **Deadline:** November 28, 2025
- **Time:** 30 minutes

```bash
# Verify access
az login
az account show

# Create resource group
az group create --name rg-chatops-prod --location eastus \
  --tags Environment=Production Application=ChatOps

# Create Log Analytics workspace
az monitor log-analytics workspace create \
  --resource-group rg-chatops-prod \
  --workspace-name chatops-loganalytics \
  --location eastus --retention-time 90
```

---

### 6. Naming Conventions & Tagging
- **Deadline:** November 28, 2025
- **Time:** 1 hour

**Pattern:** `chatops-{resource-type}-{environment}`

**Required Tags:**
- `Environment`: Production, Staging, Development
- `Application`: ChatOps
- `CostCenter`: [Your cost center]
- `Owner`: [Team email]
- `ManagedBy`: Terraform

**Document:** Create `docs/naming-conventions.md`

---

### 7. Azure CLI Setup
- **Deadline:** November 29, 2025
- **Time:** 30 minutes per team member

```bash
# Install Azure CLI
# Windows: winget install -e --id Microsoft.AzureCLI
# macOS: brew install azure-cli
# Linux: curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Verify installation
az --version
az login
az account show

# Install extensions
az extension add --name application-insights
az extension add --name log-analytics
```

---

### 8. Microsoft Graph API Permissions
- **Deadline:** December 2, 2025
- **Time:** 1-2 hours

```bash
# Create Entra ID App Registration
az ad app create --display-name "ChatOps Teams Integration" \
  --sign-in-audience AzureADMyOrg

# Note Application (client) ID and Tenant ID
# Grant permissions (via Azure Portal):
# - User.Read.All (Application permission)
# - TeamSettings.Read.All (Application permission)

# Request admin consent from Entra ID administrator
```

**Blocks:** Issue #4 (User Mapping), Issue #31 (Teams integration)

---

## Validation Checklist

Before Sprint 1, verify:

### Critical Actions
- [ ] GitHub App created and approval pending/granted
- [ ] Azure quota verified and sufficient (or increase requested)
- [ ] SSL certificate ordered or procurement plan documented
- [ ] User mapping strategy documented and reviewed

### Standard Prerequisites
- [ ] Azure subscription accessible (Owner or Contributor role)
- [ ] Resource group `rg-chatops-prod` created
- [ ] Log Analytics workspace `chatops-loganalytics` created
- [ ] Naming and tagging conventions agreed upon
- [ ] Azure CLI installed and authenticated on all machines
- [ ] Entra ID app registration created with Graph API permissions
- [ ] Admin consent granted for Graph API permissions

---

## Risk Assessment

| Risk | Priority | Action |
|------|----------|--------|
| GitHub App approval delayed | HIGH | Submit by Nov 27 |
| Azure quota insufficient | HIGH | Check by Nov 28 |
| SSL certificate delays | MEDIUM | Order by Nov 28 |
| Graph API permissions delayed | LOW | Sprint 2 dependency |

---

## Daily Updates Template

```
Pre-Sprint Update - [Date]

✅ Completed:
- [List completed tasks]

🔄 In Progress:
- [List in-progress tasks with % complete]

⚠️ Blockers:
- [List blockers with escalation status]

📅 Next 24 Hours:
- [List planned tasks]
```

Post updates in: **Microsoft Teams #chatops-project channel**

---

## Escalation Path

1. **Team Lead** - Same day escalation
2. **Project Manager** - Within 24 hours if unresolved
3. **Executive Sponsor** - Within 48 hours if critical

---

## Success Criteria

Prerequisites complete when:
- [ ] All 8 prerequisite checkboxes marked
- [ ] All critical actions complete or have mitigation plans
- [ ] Sprint 1 team confirms readiness
- [ ] Sprint Planning meeting scheduled

---

## Timeline

**Day 1 (Nov 27):** GitHub App, quota check, subscription setup, naming conventions, Azure CLI  
**Day 2 (Nov 28):** SSL cert, Entra ID app, user mapping strategy, approvals  
**Day 3 (Nov 29):** Final validation, admin consents, team readiness  
**Dec 2:** Sprint 1 starts

---

## Related Documentation

- **Full Guide:** [Pre-Sprint Prerequisites](./pre-sprint-prerequisites.md)
- **Sprint 1 Plan:** [Sprint 1 Foundation Planning](./sprint-1-foundation-planning.md)
- **Backlog:** [Product Backlog](../backlog.md)
- **Quota Script:** [docs/scripts/verify-azure-quotas.sh](./scripts/verify-azure-quotas.sh)

---

**Last Updated:** [Current Date]  
**Status:** 📋 Active
