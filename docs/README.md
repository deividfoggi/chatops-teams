# Documentation

This directory contains documentation for the ChatOps Teams project.

## OIDC and Authentication

### Quick Start
- **[How to Confirm OIDC Permissions](HOW_TO_CONFIRM_OIDC_PERMISSIONS.md)** - Immediate answer to "How do I confirm the identity has appropriate permissions?"

### Comprehensive Guides
- **[OIDC Troubleshooting Guide](OIDC_TROUBLESHOOTING.md)** - Complete step-by-step guide for diagnosing and fixing OIDC authentication issues
- **[OIDC Checklist](OIDC_CHECKLIST.md)** - Quick checklist for verifying OIDC configuration

### Common Issues

#### 403 Authorization Failure
**Error:** `Status=403 Code="AuthorizationFailure" Message="This request is not authorized to perform this operation"`

**Quick Fix:**
```bash
# Grant storage permissions
./scripts/quick-fix-storage-permissions.sh

# Or manually:
az role assignment create \
  --assignee <SP_OBJECT_ID> \
  --role "Storage Blob Data Contributor" \
  --scope "/subscriptions/<SUB_ID>/resourceGroups/<RG>/providers/Microsoft.Storage/storageAccounts/<SA>"
```

See [How to Confirm OIDC Permissions](HOW_TO_CONFIRM_OIDC_PERMISSIONS.md) for details.

#### No Matching Federated Identity
**Error:** `AADSTS70021: No matching federated identity record found`

**Fix:** Configure federated credentials. See [OIDC Troubleshooting Guide](OIDC_TROUBLESHOOTING.md#step-4-configure-federated-credentials-if-missing).

## Azure Resources

- **[Application Insights Custom Metrics](application-insights-custom-metrics.md)** - Guide for implementing custom metrics tracking
- **[Key Vault Alert Runbook](key-vault-alert-runbook.md)** - Procedures for responding to Key Vault alerts

## Pipeline Documentation

- **[Pipeline Setup](../.github/PIPELINE_SETUP.md)** - Complete pipeline configuration guide
- **[Quick Reference](../.github/QUICK_REFERENCE.md)** - Quick reference for common tasks
- **[Scripts Documentation](../scripts/README.md)** - Information about utility scripts

## Getting Help

1. **For OIDC/Permission Issues:**
   - Start with [How to Confirm OIDC Permissions](HOW_TO_CONFIRM_OIDC_PERMISSIONS.md)
   - Run verification script: `./scripts/verify-oidc-permissions.sh`
   - Check [OIDC Checklist](OIDC_CHECKLIST.md)

2. **For Pipeline Issues:**
   - Check [Pipeline Setup](../.github/PIPELINE_SETUP.md)
   - Review [Quick Reference](../.github/QUICK_REFERENCE.md)

3. **For Application Issues:**
   - Review [Application Insights Custom Metrics](application-insights-custom-metrics.md)
   - Check [Key Vault Alert Runbook](key-vault-alert-runbook.md)

## Contributing to Documentation

When adding new documentation:
1. Use clear, descriptive titles
2. Include code examples where applicable
3. Update this README with a link to your new document
4. Keep the table of contents organized by topic
