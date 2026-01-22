# GitHub Actions Runner Troubleshooting Guide

This guide provides troubleshooting steps and solutions for common issues with Azure Container Instances (ACI) based GitHub Actions self-hosted runners.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Common Issues](#common-issues)
4. [Monitoring and Diagnostics](#monitoring-and-diagnostics)
5. [Resolution Steps](#resolution-steps)
6. [Best Practices](#best-practices)

---

## Overview

The ChatOps GitHub Actions runners are deployed as Azure Container Instances in a VNet-integrated subnet. They use managed identities to access Azure Key Vault for secure credential management and are configured as ephemeral runners.

### Architecture Components

- **Container Image**: `ghcr.io/actions/actions-runner:latest`
- **Network**: Private subnet with NSG rules
- **Authentication**: Managed Identity for Key Vault access
- **Secrets**: GitHub PAT and repository URL stored in Key Vault
- **Restart Policy**: Never (ephemeral runners)

---

## Prerequisites

Before troubleshooting, ensure you have:

- Azure CLI installed and authenticated
- Access to the Azure Portal with appropriate RBAC permissions
- GitHub repository admin access
- kubectl or az container tools

### Required Azure Permissions

- `Contributor` or `Container Instance Contributor` on the resource group
- `Key Vault Secrets User` on the Key Vault
- `Log Analytics Reader` on the workspace

---

## Common Issues

### 1. Container Fails to Start

**Symptoms:**
- Container group shows "Failed" provisioning state
- Container restarts continuously
- No runner appears in GitHub Actions settings

**Common Causes:**
- Image pull failures
- Network connectivity issues
- Insufficient CPU/memory resources
- Key Vault access denied

**Diagnostic Commands:**
```bash
# Check container group status
az container show \
  --resource-group rg-chatops-<environment> \
  --name github-runner-<environment>-<suffix> \
  --query "{status:instanceView.state, events:instanceView.events}" \
  --output table

# View container logs
az container logs \
  --resource-group rg-chatops-<environment> \
  --name github-runner-<environment>-<suffix> \
  --container-name github-runner

# Check container group events
az monitor activity-log list \
  --resource-group rg-chatops-<environment> \
  --max-events 20 \
  --query "[?contains(resourceId, 'github-runner')]" \
  --output table
```

**Resolution Steps:**
1. Verify network connectivity from runner subnet
2. Check NSG rules allow outbound HTTPS to GitHub and Azure services
3. Verify managed identity has Key Vault Secrets User role
4. Review container logs for specific error messages
5. Ensure sufficient vCPU quota in the region

---

### 2. Runner Registration Fails

**Symptoms:**
- Container starts but runner doesn't appear in GitHub
- Registration errors in container logs
- Authentication failures

**Common Causes:**
- Invalid or expired GitHub PAT
- Incorrect repository URL
- PAT missing required permissions
- Network blocked to api.github.com

**Diagnostic Commands:**
```bash
# Check Key Vault secrets
az keyvault secret show \
  --vault-name <keyvault-name> \
  --name github-runner-pat \
  --query "value" \
  --output tsv

# Test GitHub API connectivity from runner subnet
az container exec \
  --resource-group rg-chatops-<environment> \
  --name github-runner-<environment>-<suffix> \
  --container-name github-runner \
  --exec-command "curl -I https://api.github.com"

# View registration logs
az container logs \
  --resource-group rg-chatops-<environment> \
  --name github-runner-<environment>-<suffix> \
  --container-name github-runner \
  | grep -i "registration\|token\|auth"
```

**Resolution Steps:**
1. Generate a new GitHub PAT with required scopes:
   - `repo` (Full control of private repositories)
   - `admin:org` (for organization runners)
   - `workflow` (Update GitHub Action workflows)
2. Update the Key Vault secret:
   ```bash
   az keyvault secret set \
     --vault-name <keyvault-name> \
     --name github-runner-pat \
     --value "ghp_newtoken..."
   ```
3. Restart the container group:
   ```bash
   az container restart \
     --resource-group rg-chatops-<environment> \
     --name github-runner-<environment>-<suffix>
   ```
4. Verify repository URL format: `https://github.com/owner/repo`

---

### 3. Key Vault Access Denied

**Symptoms:**
- "Access denied" errors in container logs
- Unable to retrieve secrets
- Managed identity authentication failures

**Common Causes:**
- Managed identity not assigned to container
- Missing RBAC role assignment
- Key Vault firewall blocking access
- Secret not found or deleted

**Diagnostic Commands:**
```bash
# Check managed identity assignment
az container show \
  --resource-group rg-chatops-<environment> \
  --name github-runner-<environment>-<suffix> \
  --query "identity" \
  --output json

# Verify RBAC role assignment
az role assignment list \
  --scope /subscriptions/<subscription-id>/resourceGroups/rg-chatops-<environment>/providers/Microsoft.KeyVault/vaults/<keyvault-name> \
  --query "[?principalType=='ServicePrincipal']" \
  --output table

# Check Key Vault network rules
az keyvault show \
  --name <keyvault-name> \
  --query "networkAcls" \
  --output json
```

**Resolution Steps:**
1. Verify managed identity is assigned:
   ```bash
   az container show \
     --resource-group rg-chatops-<environment> \
     --name github-runner-<environment>-<suffix> \
     --query "identity.userAssignedIdentities" \
     --output json
   ```
2. Grant Key Vault Secrets User role:
   ```bash
   # Get managed identity principal ID
   IDENTITY_ID=$(az container show \
     --resource-group rg-chatops-<environment> \
     --name github-runner-<environment>-<suffix> \
     --query "identity.userAssignedIdentities.*.principalId" \
     --output tsv)
   
   # Assign role
   az role assignment create \
     --assignee $IDENTITY_ID \
     --role "Key Vault Secrets User" \
     --scope /subscriptions/<subscription-id>/resourceGroups/rg-chatops-<environment>/providers/Microsoft.KeyVault/vaults/<keyvault-name>
   ```
3. Add runner subnet to Key Vault network rules if firewall is enabled
4. Verify secrets exist in Key Vault

---

### 4. Runner Jobs Fail or Timeout

**Symptoms:**
- Jobs start but fail during execution
- Timeout errors
- Resource exhaustion
- Network connectivity issues during job execution

**Common Causes:**
- Insufficient CPU/memory for workload
- Network connectivity issues
- Missing dependencies in container
- Job requires access to blocked resources

**Diagnostic Commands:**
```bash
# Check container resource utilization
az monitor metrics list \
  --resource /subscriptions/<subscription-id>/resourceGroups/rg-chatops-<environment>/providers/Microsoft.ContainerInstance/containerGroups/github-runner-<environment>-<suffix> \
  --metric "CpuUsage,MemoryUsage" \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --output table

# View job execution logs
az container logs \
  --resource-group rg-chatops-<environment> \
  --name github-runner-<environment>-<suffix> \
  --container-name github-runner \
  --tail 100
```

**Resolution Steps:**
1. Increase CPU/memory in Terraform variables:
   ```hcl
   github_runner_cpu    = 4    # Increase from 2
   github_runner_memory = 8    # Increase from 4
   ```
2. Review NSG rules for required outbound connectivity
3. Use custom container image with pre-installed dependencies
4. Add timeout settings in workflow files
5. Enable runner diagnostic logging

---

### 5. Network Connectivity Issues

**Symptoms:**
- Cannot reach GitHub API
- Cannot pull Docker images
- Cannot access Azure services
- DNS resolution failures

**Common Causes:**
- NSG rules blocking required traffic
- Subnet delegation issues
- DNS configuration problems
- Service endpoint connectivity

**Diagnostic Commands:**
```bash
# Check NSG rules
az network nsg rule list \
  --resource-group rg-chatops-<environment> \
  --nsg-name github-runners-nsg-<environment> \
  --output table

# Test DNS resolution
az container exec \
  --resource-group rg-chatops-<environment> \
  --name github-runner-<environment>-<suffix> \
  --container-name github-runner \
  --exec-command "nslookup api.github.com"

# Test outbound connectivity
az container exec \
  --resource-group rg-chatops-<environment> \
  --name github-runner-<environment>-<suffix> \
  --container-name github-runner \
  --exec-command "curl -v https://api.github.com"
```

**Resolution Steps:**
1. Verify NSG allows outbound HTTPS (port 443)
2. Check subnet delegation for `Microsoft.ContainerInstance/containerGroups`
3. Verify service endpoints are configured:
   - Microsoft.KeyVault
   - Microsoft.Storage
4. Test connectivity from Azure Portal's Network Watcher

---

## Monitoring and Diagnostics

### Log Analytics Queries

Use these KQL queries in Log Analytics to monitor runner health:

```kusto
// Container startup errors
ContainerInstanceLog_CL
| where ResourceGroup == "rg-chatops-<environment>"
| where ContainerGroup_s startswith "github-runner"
| where Message contains "error" or Message contains "failed"
| project TimeGenerated, ContainerGroup_s, Message
| order by TimeGenerated desc

// Registration failures
ContainerInstanceLog_CL
| where ContainerGroup_s startswith "github-runner"
| where Message contains "registration"
| project TimeGenerated, ContainerGroup_s, Message
| order by TimeGenerated desc

// Resource usage over time
Perf
| where ObjectName == "Container"
| where CounterName in ("% Processor Time", "Available MBytes")
| summarize avg(CounterValue) by bin(TimeGenerated, 5m), CounterName
| render timechart
```

### Azure Monitor Alerts

The following alerts are configured for runner monitoring:

1. **runner-container-startup-failure** (Severity 1)
   - Triggers on container startup failures
   - Immediate attention required

2. **runner-registration-failure** (Severity 2)
   - Triggers on GitHub registration failures
   - Check credentials and network

3. **runner-job-failure-rate** (Severity 2)
   - Triggers on high job failure rate
   - Review runner capacity and stability

---

## Resolution Steps

### Quick Recovery Procedure

1. **Check runner status in GitHub:**
   ```
   Settings → Actions → Runners
   ```

2. **Verify container is running:**
   ```bash
   az container show \
     --resource-group rg-chatops-<environment> \
     --name github-runner-<environment>-<suffix> \
     --query "instanceView.state"
   ```

3. **Review recent logs:**
   ```bash
   az container logs \
     --resource-group rg-chatops-<environment> \
     --name github-runner-<environment>-<suffix> \
     --tail 50
   ```

4. **Restart container if needed:**
   ```bash
   az container restart \
     --resource-group rg-chatops-<environment> \
     --name github-runner-<environment>-<suffix>
   ```

5. **Re-deploy if restart doesn't help:**
   ```bash
   cd infrastructure
   terraform apply -target=azurerm_container_group.github_runner
   ```

### Complete Re-deployment

If runners are consistently failing:

```bash
# Destroy and recreate runners
cd infrastructure
terraform destroy -target=azurerm_container_group.github_runner
terraform apply -target=azurerm_container_group.github_runner

# Verify deployment
az container show \
  --resource-group rg-chatops-<environment> \
  --name github-runner-<environment>-<suffix> \
  --query "{state:instanceView.state, provisioningState:provisioningState}"
```

---

## Best Practices

### 1. Runner Configuration

- **Use ephemeral runners** (restart_policy = "Never") to ensure clean state
- **Label runners appropriately** for workflow targeting
- **Set resource limits** based on workload requirements
- **Enable diagnostic logs** for troubleshooting

### 2. Security

- **Never store secrets in environment variables**
- **Use managed identities** for Azure resource access
- **Rotate GitHub PATs regularly** (every 90 days)
- **Restrict NSG rules** to minimum required connectivity
- **Enable Key Vault soft delete** and purge protection

### 3. Monitoring

- **Review alert notifications** promptly
- **Set up Log Analytics dashboards** for runner metrics
- **Track runner job success rate** in GitHub
- **Monitor container resource usage** for capacity planning

### 4. Maintenance

- **Update runner image** regularly for security patches
- **Test changes in dev** before deploying to production
- **Document custom configurations** for team reference
- **Maintain runbooks** for common scenarios

### 5. Cost Optimization

- **Use count=0** in dev when runners not needed
- **Right-size CPU/memory** based on actual usage
- **Consider spot instances** for non-critical workloads
- **Clean up orphaned runners** in GitHub settings

---

## Additional Resources

- [GitHub Actions Self-Hosted Runners Documentation](https://docs.github.com/en/actions/hosting-your-own-runners)
- [Azure Container Instances Documentation](https://docs.microsoft.com/en-us/azure/container-instances/)
- [Azure Key Vault Managed Identity](https://docs.microsoft.com/en-us/azure/key-vault/general/authentication)
- [Network Architecture Documentation](./network-architecture.md)
- [Key Vault Usage Guide](./key-vault-usage.md)

---

## Support

For issues not covered in this guide:

1. Check Azure Monitor alerts and Log Analytics
2. Review container logs and events
3. Consult the operations team via `ops-team@company.com`
4. Open a support ticket with Azure Support if needed

**Last Updated:** 2026-01-06
