# Sprint 1: Foundation Infrastructure Planning

## Overview

**Goal:** Deploy secure infrastructure foundation that unblocks all application development work

**Duration:** 2 weeks (estimated)  
**Total Story Points:** 15  
**Team Velocity:** 15-20 points/sprint (typical)

**Sprint Start Date:** December 15, 2025 (estimated)  
**Sprint End Date:** December 29, 2025 (completed)

---

## Sprint 1 Stories

| Issue | Story | Points | Status | Owner |
|-------|-------|--------|--------|-------|
| [#41](https://github.com/deividfoggi/chatops-teams/issues/41) | Deploy Azure Virtual Network | 5 | ✅ Deployed | Infrastructure Team |
| [#42](https://github.com/deividfoggi/chatops-teams/issues/42) | Deploy Azure Key Vault | 5 | ✅ Deployed | Infrastructure Team |
| [#39](https://github.com/deividfoggi/chatops-teams/issues/39) | Configure Application Insights | 5 | ✅ Deployed | Infrastructure Team |

**Current Status:** Infrastructure deployed via Terraform. Post-deployment validation in progress.

---

## Why These Three Stories?

### ✅ Zero Dependencies
All three stories can start immediately with no blockers.

### ✅ Parallel Execution
No resource conflicts - team can work on all three simultaneously.

### ✅ Unlock Downstream Work
Completing these three stories unblocks **15+ stories** in Sprint 2:
- **#41 (VNet)** unlocks: #37 (App Gateway), #35 (App Service), #40 (Database)
- **#42 (Key Vault)** unlocks: #2 (Webhooks), #31 (Teams App), #35 (App Service)
- **#39 (App Insights)** unlocks: #35 (App Service), #27 (Bot Framework), #29 (Cards)

### ✅ Security Foundation
Establishes secure infrastructure from day 1:
- Network isolation with NSGs
- Secrets management with Key Vault
- Observability with Application Insights

### ✅ Low Risk
All three are standard Azure services with well-documented patterns.

---

## Infrastructure Components Deployed

### 1. Azure Virtual Network (Issue #41)
**Resource:** `chatops-vnet`  
**Address Space:** `10.0.0.0/16`  
**Status:** ✅ Deployed

**Subnets:**
- **app-subnet** (`10.0.1.0/24`) - App Service VNet integration
- **gateway-subnet** (`10.0.2.0/24`) - Application Gateway (future Sprint 2)

**Network Security Groups:**
- **app-nsg** - App subnet protection with least-privilege rules
- **gateway-nsg** - Gateway subnet protection

**Features:**
- NSG flow logs enabled (90-day retention)
- Traffic Analytics integration with Log Analytics
- Service endpoints for Microsoft.KeyVault
- DDoS Protection Basic (included by default)

**Documentation:**
- [Network Architecture](./network-architecture.md)
- [Network Troubleshooting](./network-troubleshooting.md)

---

### 2. Azure Key Vault (Issue #42)
**Resource:** `chatops-kv-{random}`  
**SKU:** Standard  
**Status:** ✅ Deployed

**Security Features:**
- RBAC Authorization enabled
- Soft delete (90-day retention)
- Purge protection enabled
- Network ACLs restricting access to app subnet
- Audit logging to Log Analytics

**RBAC Roles:**
- Key Vault Administrator (for admin group)
- Key Vault Secrets Officer (for DevOps SP)
- Key Vault Secrets User (for App Service managed identity)

**Secrets Stored:**
- Application Insights connection string
- (Additional secrets to be added as needed)

**Documentation:**
- [Key Vault Usage Guide](./key-vault-usage.md)
- [Secret Rotation Procedure](./key-vault-secret-rotation.md)
- [Key Vault Troubleshooting](./key-vault-troubleshooting.md)
- [Key Vault Alert Runbook](./key-vault-alert-runbook.md)

---

### 3. Application Insights (Issue #39)
**Resource:** `chatops-appinsights`  
**Type:** Web Application  
**Status:** ✅ Deployed

**Configuration:**
- Workspace-based (connected to Log Analytics)
- 90% sampling rate for cost optimization
- Connection string stored in Key Vault

**Availability Tests:**
Multi-region health monitoring from 5 locations:
- East US (Primary)
- West US
- North Europe
- Southeast Asia
- Australia East

**Test Configuration:**
- Frequency: 5 minutes
- Timeout: 30 seconds
- SSL certificate validation (7-day expiration warning)
- Expected status: 200
- Content match: "healthy"

**Alerts Configured:**
- High exception rate
- Slow response times
- Availability degradation
- Failed dependency calls

**Documentation:**
- [Application Insights Custom Metrics](./application-insights-custom-metrics.md)
- [Application Insights KQL Queries](./application-insights-kql-queries.md)
- [Application Insights Dashboards](./application-insights-dashboards.md)
- [Application Insights Alert Runbook](./application-insights-alert-runbook.md)
- [Application Insights Troubleshooting](./application-insights-troubleshooting.md)
- [Application Insights Workbook](./application-insights-workbook.json)

---

## Critical Path Analysis

```
Sprint 1: Foundation (COMPLETED)
├── #41 VNet ──────────┐
├── #42 Key Vault ─────┼──► Sprint 2: Integration Layer
└── #39 App Insights ──┘
                 │
                 ├──► #37 App Gateway
                 ├──► #35 App Service
                 ├──► #3 GitHub API Client
                 └──► #31 Teams App Manifest
                      │
                      ├──► Sprint 3: Application Logic
                      ├──► #2 Webhook Endpoints
                      └──► #27 Bot Framework
                           │
                           └──► Sprint 4: End-to-End Workflows
```

---

## Pre-Sprint Checklist

### Immediate Actions (Completed)
- [x] Create resource group - `rg-chatops-prod` in East US
- [x] Deploy Log Analytics workspace for monitoring
- [x] Configure naming convention: `chatops-{service}-{env}`
- [x] Apply tagging strategy: `Environment`, `Application`, `CostCenter`, `Owner`, `ManagedBy`

### Sprint 1 Prerequisites (Completed)
- [x] Azure subscription with Contributor role
- [x] Azure CLI installed and authenticated
- [x] Log Analytics workspace created
- [x] Terraform state backend configured
- [x] CI/CD pipeline configured with OIDC authentication

### Outstanding Actions
- [ ] **GitHub App registration** - Approval process (3-5 days) - Required for Sprint 2
- [ ] **Azure quota verification** - Check PremiumV3 App Service availability for Sprint 2
- [ ] **SSL certificate procurement** - For App Gateway (Sprint 2, Issue #37)
- [ ] **User mapping strategy** - Document GitHub username → Entra ID mapping (Issue #4)

---

## Sprint 1 Success Criteria

### ✅ Infrastructure Deployed
- [x] VNet with app-subnet and gateway-subnet operational
- [x] Key Vault with soft-delete and purge protection enabled
- [x] Application Insights collecting telemetry

### ✅ Security Validated
- [x] Zero secrets in code or configuration files
- [x] NSG rules configured with least-privilege principle
- [x] Key Vault access policies follow least-privilege (RBAC)
- [x] Soft delete and purge protection enabled

### ⚠️ Observability Enabled
- [x] Application Insights resource created
- [x] Availability tests configured for 5 regions
- [x] Alert rules created and configured
- [x] NSG flow logs enabled
- [ ] **App Service health validation** (In Progress - see Known Issues)

### ✅ Documentation Complete
- [x] IP allocation strategy documented
- [x] Key Vault secret naming convention established
- [x] Custom metrics documented
- [x] Comprehensive documentation for all services
- [x] KQL queries provided for Application Insights

### ✅ Sprint 2 Ready
- [x] 15+ downstream stories unblocked
- [x] Infrastructure validated and ready for App Service deployment
- [x] Security foundation established

---

## Azure Well-Architected Framework Alignment

### Sprint 1 Pillars Emphasis

**🔒 Security (PRIMARY)**
- ✅ Network isolation: VNet with NSGs
- ✅ Secrets management: Key Vault with managed identity
- ✅ Monitoring: Application Insights with security alerts
- ✅ RBAC: Least-privilege access control
- ✅ Audit logging: All operations logged to Log Analytics

**🛡️ Reliability**
- ✅ Soft-delete protection for Key Vault
- ✅ Sufficient IP space for scaling (65,536 addresses)
- ✅ Availability tests for multi-region monitoring
- ✅ DDoS Protection Basic

**📊 Operational Excellence**
- ✅ Infrastructure as Code (Terraform)
- ✅ Comprehensive logging from day 1
- ✅ Dashboards and workbooks for visibility
- ✅ Consistent tagging for governance
- ✅ CI/CD pipeline with validation

**⚡ Performance Efficiency**
- ✅ Network segmentation for optimized traffic flow
- ✅ Application Insights sampling strategy (90%)
- ✅ Log Analytics for centralized queries

**💰 Cost Optimization**
- ✅ Standard tier services (sufficient for workload)
- ✅ DDoS Basic instead of Standard ($2,944/month savings)
- ✅ 90-day log retention balances cost and compliance
- ✅ Application Insights sampling reduces data ingestion

---

## Known Issues and Resolutions

### Issue: CI/CD Post-Deployment Validation Failure
**Status:** In Progress  
**Impact:** Pipeline shows "failure" status, but infrastructure is deployed successfully

**Details:**
The `Post-Deployment Validation` step in the CI/CD pipeline fails when attempting to validate App Service health because:
1. App Service resources are planned for Sprint 2 (Issue #35)
2. The validation step runs before App Service deployment
3. Health endpoint `/health` does not exist yet

**Resolution:**
- Infrastructure (VNet, Key Vault, App Insights) is successfully deployed
- Validation failure is expected and acceptable for Sprint 1
- App Service deployment and health validation will be addressed in Sprint 2 (Issue #35)
- No action required at this time

**Related:**
- Issue #35: Deploy Azure App Service (Sprint 2)
- Issue #37: Deploy Application Gateway with WAF (Sprint 2)

---

## Risk Management

| Risk | Probability | Impact | Mitigation | Status |
|------|-------------|--------|------------|--------|
| Azure quota limits | Medium | High | Pre-check quota before Sprint 2 | ⚠️ Action Required (Sprint 2) |
| GitHub App approval delays | High | High | Start approval process immediately | ⚠️ Action Required |
| SSL certificate delays | Medium | Medium | Order certificate now for Sprint 2 | ⚠️ Action Required |
| Team unfamiliar with Key Vault | Low | Low | Documentation provided | ✅ Completed |
| Network configuration errors | Low | Medium | Peer review all NSG rules | ✅ Completed |

---

## Daily Standup Focus

**Questions for each story:**
1. ✅ Is the resource deployed and operational? **YES - All three resources deployed**
2. ✅ Have you validated with Azure Security Center? **YES - Security best practices followed**
3. ✅ Are there any blockers with quota or permissions? **NO - All permissions configured**
4. ✅ Is documentation updated? **YES - Comprehensive documentation provided**

---

## Sprint 1 Definition of Done

For each story to be considered "Done":
- [x] Infrastructure deployed via Terraform (IaC)
- [x] Configuration validated against acceptance criteria
- [x] Security best practices implemented (RBAC, NSGs, encryption)
- [x] All resources tagged according to governance policy
- [x] Documentation updated (IP ranges, secrets, metrics)
- [x] Comprehensive operational guides provided
- [ ] Post-deployment validation passing (Pending Sprint 2 App Service)
- [x] Downstream dependencies verified (Sprint 2 stories can proceed)

**Overall Status:** ✅ **SPRINT 1 FOUNDATION COMPLETE** (with expected validation pending App Service deployment)

---

## Sprint 2 Preview

After Sprint 1 completes, Sprint 2 will focus on:
- **Issue #37:** Application Gateway with WAF (depends on #41)
- **Issue #35:** App Service with VNet integration (depends on #41, #37, #42)
- **Issue #3:** GitHub API Client (depends on #42)
- **Issue #31:** Teams App Manifest (independent)
- **Issue #40:** Database deployment (depends on #41, #35)

**Estimated Sprint 2:** 23-28 story points

**Sprint 2 Prerequisites:**
- Complete GitHub App registration approval
- Verify Azure quota for PremiumV3 App Service
- Obtain SSL certificate for Application Gateway
- Document user mapping strategy (GitHub → Entra ID)

---

## Questions & Clarifications

**Q: Can we start application development in Sprint 1?**  
A: No. Application logic requires App Service (#35) which depends on VNet (#41) and App Gateway (#37). Sprint 1 focused on infrastructure foundation. Application development begins in Sprint 3.

**Q: What if we encounter quota issues in Sprint 2?**  
A: Submit quota increase request immediately. Typical approval: 24-48 hours. Have backup region ready (e.g., West US 2).

**Q: Do we need all three stories for Sprint 2?**  
A: Yes. App Service requires all three: VNet for networking, Key Vault for secrets, Application Insights for monitoring.

**Q: Can we skip Application Insights initially?**  
A: Not recommended. Observability from day 1 prevents troubleshooting issues later. App Insights is deployed and provides immediate value.

---

## Resources

### Azure Documentation
- [Azure Well-Architected Framework](https://learn.microsoft.com/en-us/azure/architecture/framework/)
- [Azure VNet Best Practices](https://learn.microsoft.com/en-us/azure/virtual-network/virtual-network-vnet-plan-design-arm)
- [Azure Key Vault Best Practices](https://learn.microsoft.com/en-us/azure/key-vault/general/best-practices)
- [Application Insights Overview](https://learn.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview)

### Repository Documentation
- [Infrastructure README](../infrastructure/README.md)
- [Network Architecture](./network-architecture.md)
- [Key Vault Usage Guide](./key-vault-usage.md)
- [Application Insights Custom Metrics](./application-insights-custom-metrics.md)
- [CI/CD Pipeline Documentation](../.github/workflows/README.md)

---

## Sprint Retrospective

**Sprint Review:** Completed December 29, 2025  
**Sprint Retrospective:** Scheduled for early Sprint 2

### What Went Well
- All three infrastructure components deployed successfully via Terraform
- Security best practices implemented from day 1
- Comprehensive documentation created
- CI/CD pipeline with OIDC authentication configured

### What Could Be Improved
- Earlier identification of Sprint 2 prerequisites (GitHub App, SSL cert)
- Post-deployment validation should account for future dependencies

### Action Items
1. Begin GitHub App registration approval process immediately
2. Verify Azure quotas before Sprint 2 planning
3. Order SSL certificate for Application Gateway
4. Document user mapping strategy for Sprint 2
5. Address post-deployment validation to handle partial deployments

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-29  
**Status:** Sprint 1 Foundation Complete ✅
