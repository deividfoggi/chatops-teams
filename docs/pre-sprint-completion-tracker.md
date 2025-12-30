# Pre-Sprint Prerequisites - Completion Tracker

**Project:** ChatOps Teams Integration  
**Target Completion:** November 29, 2025  
**Sprint 1 Start:** December 2, 2025

---

## How to Use This Tracker

1. Update checkboxes as tasks are completed
2. Update status and notes for each action
3. Post daily updates in Teams #chatops-project channel
4. Escalate blockers immediately to project manager

---

## Critical Actions (Start Immediately)

### 1. GitHub App Registration ⚠️ URGENT

**Deadline:** November 29, 2025  
**Owner:** DevOps Engineer

- [ ] Navigate to GitHub Organization Settings
- [ ] Create new GitHub App
- [ ] Configure basic information (name, homepage, webhook URL)
- [ ] Configure webhook events (code_scanning_alert, dependabot_alert, deployment_protection_rule)
- [ ] Configure permissions (Actions, Code scanning, Dependabot, Contents, Deployments, Metadata, Members)
- [ ] Generate credentials (App ID, private key, webhook secret)
- [ ] Store credentials securely (temporary password manager)
- [ ] Request installation approval from org admins
- [ ] Monitor approval status (daily follow-up)

**Status:** [ ] Not Started [ ] In Progress [ ] Waiting for Approval [ ] Complete

**Notes:**
```
App Name: _________________
App ID: _________________
Approval Status: _________________
Expected Completion: _________________
```

**Blocks:** Issues #2, #3, and all webhook-dependent stories

---

### 2. Azure Quota Verification ⚠️ HIGH PRIORITY

**Deadline:** November 28, 2025  
**Owner:** Cloud Architect

- [ ] Run quota verification script (`./docs/scripts/verify-azure-quotas.sh`)
- [ ] Verify App Service PremiumV3 cores (need 4 minimum)
- [ ] Verify Public IP addresses (need 2 minimum)
- [ ] Verify Application Gateway v2 instances (need 1 minimum)
- [ ] Verify Key Vault quota (Standard tier)
- [ ] Document current quota in `docs/azure-quota-report.txt`
- [ ] Submit quota increase requests (if needed)
- [ ] Monitor quota increase approval status

**Status:** [ ] Not Started [ ] In Progress [ ] Quota Sufficient [ ] Increase Requested [ ] Complete

**Quota Status:**
```
Region: _________________

App Service Cores: ___ / ___ (Need: 4)
Public IPs: ___ / ___ (Need: 2)
Application Gateway: ___ / ___ (Need: 1)
Key Vault: ___ (Usually unlimited)

Increase Requests: [ ] Not Needed [ ] Submitted [ ] Approved
```

**Blocks:** Sprint 1 infrastructure deployment, Issues #37, #35

---

### 3. SSL Certificate Procurement

**Deadline:** December 5, 2025  
**Owner:** Security Engineer

- [ ] Determine certificate type (Azure App Service Cert / Let's Encrypt / Corporate CA)
- [ ] Document decision and rationale
- [ ] Acquire custom domain (if not already owned)
- [ ] Order certificate
- [ ] Complete domain verification
- [ ] Wait for certificate issuance
- [ ] Store certificate securely (temporary storage)
- [ ] Document certificate information in `docs/ssl-certificate-info.txt`
- [ ] Plan certificate installation (Sprint 2)

**Status:** [ ] Not Started [ ] In Progress [ ] Ordered [ ] Issued [ ] Complete

**Certificate Details:**
```
Type: [ ] Azure App Service [ ] Let's Encrypt [ ] Corporate CA
Domain: _________________
Issuer: _________________
Expiration: _________________
Storage Location: _________________
```

**Blocks:** Issue #37 (Application Gateway with SSL)

---

### 4. User Mapping Strategy Documentation

**Deadline:** December 2, 2025  
**Owner:** Integration Developer

- [ ] Define mapping approach (email-based, proxy, manual)
- [ ] Create `docs/user-mapping-strategy.md` document
- [ ] Design database schema for user_mappings table
- [ ] Identify pilot repositories for testing
- [ ] Document fallback strategy for unmapped users
- [ ] Plan sync frequency (real-time + daily background)
- [ ] Review strategy with security team
- [ ] Review strategy with compliance team
- [ ] Get stakeholder approval

**Status:** [ ] Not Started [ ] In Progress [ ] Review [ ] Approved [ ] Complete

**Strategy Summary:**
```
Primary Method: _________________
Secondary Method: _________________
Tertiary Method: _________________
Fallback: _________________
Sync Frequency: _________________
```

**Blocks:** Issue #4 (User Mapping), all notification workflows

---

## Standard Prerequisites

### 5. Azure Subscription Setup

**Deadline:** November 28, 2025  
**Owner:** Cloud Architect

- [ ] Verify Azure subscription access (Owner or Contributor role)
- [ ] Run `az login` and verify authentication
- [ ] Create resource group: `rg-chatops-prod` in eastus
- [ ] Apply tags to resource group
- [ ] Create Log Analytics workspace: `chatops-loganalytics`
- [ ] Configure 90-day retention for Log Analytics
- [ ] Document subscription ID and tenant ID
- [ ] Document Log Analytics workspace ID

**Status:** [ ] Not Started [ ] In Progress [ ] Complete

**Azure Details:**
```
Subscription Name: _________________
Subscription ID: _________________
Tenant ID: _________________
Resource Group: rg-chatops-prod
Log Analytics Workspace: chatops-loganalytics
Workspace ID: _________________
```

---

### 6. Naming Convention & Tagging Strategy

**Deadline:** November 28, 2025  
**Owner:** Cloud Architect

- [ ] Define naming convention pattern
- [ ] Create `docs/naming-conventions.md` document
- [ ] Define required tags (Environment, Application, CostCenter, Owner, ManagedBy)
- [ ] Define optional tags
- [ ] Document abbreviations and examples
- [ ] Review with team
- [ ] Get stakeholder approval
- [ ] Update team wiki or README

**Status:** [ ] Not Started [ ] In Progress [ ] Review [ ] Approved [ ] Complete

**Naming Pattern:** `chatops-{resource-type}-{environment}`

**Required Tags:**
- Environment: _________________
- Application: ChatOps
- CostCenter: _________________
- Owner: _________________
- ManagedBy: Terraform

---

### 7. Azure CLI and Access Setup

**Deadline:** November 29, 2025  
**Owner:** All team members

**Per Team Member:**

- [ ] Install Azure CLI (version ≥ 2.50.0)
- [ ] Verify installation: `az --version`
- [ ] Configure authentication: `az login`
- [ ] Verify subscription access: `az account show`
- [ ] Install application-insights extension
- [ ] Install log-analytics extension
- [ ] Configure default resource group (optional)
- [ ] Configure default location (optional)
- [ ] Test access to rg-chatops-prod

**Team Status:**

| Team Member | Installed | Authenticated | Extensions | Tested | Complete |
|-------------|-----------|---------------|------------|--------|----------|
| Member 1    | [ ]       | [ ]           | [ ]        | [ ]    | [ ]      |
| Member 2    | [ ]       | [ ]           | [ ]        | [ ]    | [ ]      |
| Member 3    | [ ]       | [ ]           | [ ]        | [ ]    | [ ]      |
| Member 4    | [ ]       | [ ]           | [ ]        | [ ]    | [ ]      |

---

### 8. Microsoft Graph API Permissions

**Deadline:** December 2, 2025  
**Owner:** Identity Administrator

- [ ] Create Entra ID app registration
- [ ] Name: "ChatOps Teams Integration"
- [ ] Configure redirect URI
- [ ] Grant `User.Read.All` permission (Application)
- [ ] Grant `TeamSettings.Read.All` permission (Application)
- [ ] Request admin consent from Entra ID administrator
- [ ] Wait for admin consent approval
- [ ] Generate client secret (valid 24 months)
- [ ] Document Application (client) ID
- [ ] Document Directory (tenant) ID
- [ ] Store credentials securely
- [ ] Test API access with sample queries

**Status:** [ ] Not Started [ ] In Progress [ ] Waiting for Consent [ ] Complete

**Entra ID App Details:**
```
Application Name: ChatOps Teams Integration
Application (client) ID: _________________
Directory (tenant) ID: _________________
Client Secret Expiry: _________________
Admin Consent Status: [ ] Pending [ ] Granted
```

**Blocks:** Issue #4 (User Mapping), Issue #31 (Teams integration)

---

## Validation Checklist

Before Sprint 1 begins, verify:

### Critical Actions
- [ ] GitHub App created and approval pending/granted
- [ ] Azure quota verified and sufficient
- [ ] SSL certificate ordered or procurement plan documented
- [ ] User mapping strategy documented and reviewed

### Standard Prerequisites
- [ ] Azure subscription accessible with correct permissions
- [ ] Naming and tagging conventions agreed upon
- [ ] Azure CLI installed and authenticated on all machines
- [ ] Entra ID app registration created with Graph API permissions
- [ ] Log Analytics workspace created
- [ ] Team trained on Azure fundamentals (if needed)

### Documentation
- [ ] All required documentation created
- [ ] Documentation reviewed and approved
- [ ] Team wiki updated
- [ ] Credentials securely stored

### Sprint Readiness
- [ ] No critical blockers remain
- [ ] Sprint 1 team confirms readiness
- [ ] Sprint Planning meeting scheduled

---

## Risk Status

| Risk | Status | Mitigation |
|------|--------|------------|
| GitHub App approval delayed | [ ] Green [ ] Yellow [ ] Red | ___________________ |
| Azure quota insufficient | [ ] Green [ ] Yellow [ ] Red | ___________________ |
| SSL certificate delays | [ ] Green [ ] Yellow [ ] Red | ___________________ |
| Graph API permissions delayed | [ ] Green [ ] Yellow [ ] Red | ___________________ |

**Legend:**
- 🟢 Green: On track, no issues
- 🟡 Yellow: Minor issues, being addressed
- 🔴 Red: Critical blocker, requires escalation

---

## Daily Status Updates

### [Date] - Day 1
**Completed:**
- 

**In Progress:**
- 

**Blockers:**
- 

**Next 24 Hours:**
- 

---

### [Date] - Day 2
**Completed:**
- 

**In Progress:**
- 

**Blockers:**
- 

**Next 24 Hours:**
- 

---

### [Date] - Day 3 (Final Day)
**Completed:**
- 

**In Progress:**
- 

**Blockers:**
- 

**Sprint 1 Readiness:** [ ] Ready [ ] Delayed

---

## Success Criteria

Prerequisites phase is complete when:

- [ ] All 4 critical actions complete or have documented mitigation plans
- [ ] All 4 standard prerequisites are complete
- [ ] Validation checklist 100% complete (or exceptions documented)
- [ ] Risk assessment shows all risks at green or yellow status
- [ ] Sprint 1 team confirms readiness to begin
- [ ] Sprint Planning meeting scheduled for December 2, 2025

---

## Final Sign-Off

**Prerequisites Complete:** [ ] Yes [ ] No (with exceptions)

**Approved By:**

- Project Manager: _________________ Date: _________
- Cloud Architect: _________________ Date: _________
- DevOps Engineer: _________________ Date: _________
- Security Engineer: _________________ Date: _________

**Sprint 1 Start Date Confirmed:** December 2, 2025

**Next Steps:**
1. Sprint Planning meeting
2. Sprint 1 kickoff
3. Begin infrastructure deployment

---

**Document Version:** 1.0  
**Last Updated:** [Current Date]  
**Status:** 📋 Active Tracking
