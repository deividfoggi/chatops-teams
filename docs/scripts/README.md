# Pre-Sprint Helper Scripts

This directory contains helper scripts for completing pre-sprint prerequisites.

## Available Scripts

### verify-azure-quotas.sh

Verifies Azure subscription quotas to ensure sufficient resources are available for the ChatOps infrastructure deployment.

**Usage:**
```bash
# Check quotas in default region (eastus)
./verify-azure-quotas.sh

# Check quotas in specific region
./verify-azure-quotas.sh westus
```

**Prerequisites:**
- Azure CLI installed and authenticated (`az login`)
- Read permissions on Azure subscription

**What it checks:**
- App Service PremiumV3 cores (minimum 4 cores required)
- Public IP addresses (minimum 2 required)
- Application Gateway v2 instances (minimum 1 required)
- Key Vault instances
- Virtual Networks

**Exit Codes:**
- `0` - All quota checks passed
- `1` - Insufficient quota detected
- `2` - Manual verification required

**Example Output:**
```
======================================
Azure Quota Verification Script
ChatOps Teams Integration Project
======================================

Region: eastus

Subscription: My Azure Subscription
Subscription ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

=== Checking App Service / Compute Quota ===

✅ OK | App Service PremiumV3 Cores: 2/20 (Available: 18, Required: 4)

=== Checking Public IP Address Quota ===

✅ OK | Public IP Addresses: 3/10 (Available: 7, Required: 2)

=== Checking Application Gateway Quota ===

✅ OK | Application Gateways: 0/25 (Available: 25, Required: 1)

=== Checking Key Vault Quota ===

✅ OK | Key Vaults: 1 (Standard tier usually unlimited)

=== Checking Virtual Network Quota ===

✅ OK | Virtual Networks: 2/1000 (Available: 998, Required: 1)

======================================
Summary
======================================

✅ SUCCESS: All quota checks passed

Your Azure subscription has sufficient quota to deploy the ChatOps infrastructure.

Next Steps:
1. Proceed with Sprint 1 infrastructure deployment
2. Continue with other pre-sprint prerequisites
3. Monitor quota usage during deployment
```

## Adding New Scripts

When adding new helper scripts to this directory:

1. Add a shebang line (`#!/bin/bash` or `#!/usr/bin/env python3`)
2. Include descriptive comments at the top
3. Document usage, prerequisites, and example output
4. Make the script executable: `chmod +x script-name.sh`
5. Update this README with script documentation
6. Test the script thoroughly before committing

## Related Documentation

- [Pre-Sprint Prerequisites](../pre-sprint-prerequisites.md)
- [Sprint 1 Foundation Planning](../sprint-1-foundation-planning.md)
- [Infrastructure README](../../infrastructure/README.md)
