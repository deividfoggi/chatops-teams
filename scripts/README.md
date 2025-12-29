# Scripts

This directory contains utility scripts for managing and troubleshooting the ChatOps Teams project.

## OIDC Troubleshooting Scripts

### verify-oidc-permissions.sh

A comprehensive interactive script that verifies all aspects of your OIDC configuration for GitHub Actions.

**Usage:**
```bash
./scripts/verify-oidc-permissions.sh
```

**What it checks:**
- Azure CLI and dependencies
- Azure login status
- Service principal existence
- Federated credentials configuration
- Subscription-level permissions
- Storage account permissions
- Terraform state container existence

**Features:**
- Interactive prompts for configuration
- Colored output for easy reading
- Automatic fix suggestions
- Optional automatic fix application

### quick-fix-storage-permissions.sh

A quick script to grant the required Storage Blob Data Contributor role to your service principal.

**Usage:**
```bash
./scripts/quick-fix-storage-permissions.sh
```

**What it does:**
- Grants Storage Blob Data Contributor role to the service principal
- Creates the tfstate container if it doesn't exist
- Provides clear success/error messages

**Use this when:**
- You've confirmed the service principal exists
- You just need to grant storage permissions
- You want a quick fix without extensive validation

## Prerequisites

Both scripts require:
- Azure CLI (`az`) installed and configured
- Appropriate permissions in Azure (Owner or User Access Administrator)
- Service principal already created with OIDC federated credentials

## Common Use Cases

### First-time setup
1. Run `verify-oidc-permissions.sh` to check everything
2. Follow the suggested fixes if issues are found
3. Re-run the script to confirm all checks pass

### Quick permission fix
1. If you know you just need storage permissions, run `quick-fix-storage-permissions.sh`
2. Wait 5-10 minutes for permissions to propagate
3. Re-run your GitHub Actions workflow

### Troubleshooting CI failures
1. Check the GitHub Actions logs for error details
2. Run `verify-oidc-permissions.sh` to diagnose the issue
3. Apply suggested fixes
4. Re-run the workflow

## Documentation

For detailed troubleshooting information, see:
- [OIDC Troubleshooting Guide](../docs/OIDC_TROUBLESHOOTING.md)
- [Pipeline Setup Guide](../.github/PIPELINE_SETUP.md)
- [Quick Reference](../.github/QUICK_REFERENCE.md)
