# ChatOps Teams Infrastructure

This directory contains Terraform configurations for the ChatOps Teams application infrastructure on Microsoft Azure.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [IP Allocation Strategy](#ip-allocation-strategy)
- [Azure Well-Architected Framework Alignment](#azure-well-architected-framework-alignment)
- [Prerequisites](#prerequisites)
- [Terraform Usage](#terraform-usage)
- [Resources](#resources)

## Overview

The ChatOps Teams infrastructure is designed to support a scalable, secure, and cost-effective deployment of the ChatOps application on Azure. The infrastructure follows Infrastructure as Code (IaC) best practices using Terraform.

## Architecture

The infrastructure includes the following core components:

| Resource | Description |
|----------|-------------|
| Resource Group | Container for all ChatOps resources |
| Virtual Network | 10.0.0.0/16 address space for network isolation |
| Log Analytics Workspace | Centralized logging and monitoring |

## IP Allocation Strategy

The virtual network is configured with a `/16` address space providing ample room for current needs and future growth.

### Address Space Summary

| CIDR Block | Total IPs | Purpose |
|------------|-----------|---------|
| 10.0.0.0/16 | 65,536 | Virtual Network address space |

### Subnet Allocation

| Subnet Name | CIDR Block | Usable IPs | Purpose |
|-------------|------------|------------|---------|
| app-subnet | 10.0.1.0/24 | 251 | Application workloads (App Service, Container Apps) |
| gateway-subnet | 10.0.2.0/24 | 251 | API Gateway and ingress controllers |
| database-subnet | 10.0.3.0/24 | 251 | Database services (Azure SQL, CosmosDB) |

> **Note:** Azure reserves 5 IP addresses in each subnet (first 4 and last 1), reducing the usable count from 256 to 251 per /24 subnet.

### Future Expansion

| CIDR Range | Available IPs | Status |
|------------|---------------|--------|
| 10.0.4.0 - 10.0.255.0 | ~64,000 | Reserved for future use |

The remaining address space (10.0.4.0/22 through 10.0.252.0/22) is available for:
- Additional application tiers
- Development/staging environments
- Peered virtual networks
- Azure Kubernetes Service (AKS) node pools
- Azure Container Instances

## Azure Well-Architected Framework Alignment

This infrastructure is designed following the [Azure Well-Architected Framework](https://docs.microsoft.com/azure/architecture/framework/) five pillars:

### 1. Cost Optimization

- **DDoS Protection:** Using Azure DDoS Basic (included) instead of Standard ($2,944/month) based on current risk assessment
- **Right-sizing:** Resources are sized appropriately for workload requirements
- **Tagging Strategy:** All resources are tagged with `CostCenter` for cost allocation and tracking
- **Log Retention:** 90-day retention in Log Analytics balances cost with compliance needs

### 2. Operational Excellence

- **Infrastructure as Code:** All resources managed via Terraform for reproducibility
- **Consistent Tagging:** All resources tagged with Environment, Application, CostCenter, Owner, and ManagedBy
- **Remote State:** State stored in Azure Storage for team collaboration and state locking
- **Documentation:** Comprehensive README and inline comments

### 3. Performance Efficiency

- **Address Space Planning:** /16 address space provides room for scaling without re-architecture
- **Regional Deployment:** Resources deployed to East US for optimal latency
- **Subnet Isolation:** Dedicated subnets for different workload types

### 4. Reliability

- **Log Analytics:** Centralized monitoring for proactive issue detection
- **Network Isolation:** Subnet segmentation for fault isolation
- **Future Planning:** Address space reserved for disaster recovery scenarios

### 5. Security

- **Network Segmentation:** Separate subnets for app, gateway, and database tiers
- **DDoS Protection:** Basic protection enabled by default with Standard available for upgrade
- **Private Networking:** VNet foundation enables private endpoints and service endpoints
- **No Hardcoded Secrets:** Sensitive values managed via variables and Azure Key Vault
- **Key Vault RBAC:** Azure RBAC authorization (no legacy access policies) with least-privilege role assignments

## Prerequisites

Before using this Terraform configuration, ensure you have:

1. **Azure CLI** installed and authenticated
   ```bash
   az login
   az account set --subscription "YOUR_SUBSCRIPTION_ID"
   ```

2. **Terraform** installed (version >= 1.0)
   ```bash
   terraform --version
   ```

3. **Azure Storage Account** for Terraform state backend
   - Create a resource group: `terraform-state-rg`
   - Create a storage account with a globally unique name
   - Create a container named `tfstate`

4. **Required Permissions**
   - Contributor role on the target subscription
   - Storage Blob Data Contributor on the state storage account

## Terraform Usage

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd chatops-teams/terraform
   ```

2. **Configure the backend**
   
   Update `main.tf` with your Azure Storage account details:
   ```hcl
   backend "azurerm" {
     resource_group_name  = "terraform-state-rg"
     storage_account_name = "your-unique-storage-account"
     container_name       = "tfstate"
     key                  = "chatops.tfstate"
   }
   ```

3. **Create a terraform.tfvars file**
   ```hcl
   environment = "Production"
   cost_center = "IT-12345"
   owner       = "chatops-team@example.com"
   ```

### Common Commands

| Command | Description |
|---------|-------------|
| `terraform init` | Initialize working directory and download providers |
| `terraform fmt` | Format configuration files |
| `terraform validate` | Validate configuration syntax |
| `terraform plan -out=tfplan` | Preview changes and save plan |
| `terraform apply tfplan` | Apply the saved plan |
| `terraform destroy` | Destroy all resources (use with caution) |

### Workflow

```bash
# Initialize Terraform
terraform init

# Format code
terraform fmt -recursive

# Validate configuration
terraform validate

# Preview changes
terraform plan -out=tfplan

# Apply changes
terraform apply tfplan
```

### State Management

- State is stored remotely in Azure Storage Account
- State locking is enabled via Azure Blob leases
- Never edit state files directly; use `terraform state` commands if needed

## Resources

| Resource Type | Name | Purpose |
|---------------|------|---------|
| `azurerm_resource_group` | chatops | Resource container |
| `azurerm_virtual_network` | chatops_vnet | Network isolation |
| `azurerm_log_analytics_workspace` | chatops | Monitoring and logging |
| `azurerm_application_insights` | chatops | Application performance monitoring |
| `azurerm_key_vault` | chatops | Secrets management |
| `azurerm_key_vault_secret` | Various | Initial application secrets (7 secrets) |
| `azurerm_role_assignment` | kv_admin | Key Vault Administrator role (admin group) |
| `azurerm_role_assignment` | kv_secrets_officer | Key Vault Secrets Officer role (DevOps SP) |
| `azurerm_monitor_action_group` | security_alerts | Security alert notifications |
| `azurerm_monitor_scheduled_query_rules_alert_v2` | Various | Key Vault security alerts (3 alerts) |

## Key Vault RBAC Roles

The Key Vault uses Azure RBAC authorization (no legacy access policies) with the following roles:

| Role | Assignee | Permissions |
|------|----------|-------------|
| Key Vault Administrator | Admin Group | Full management (secrets, keys, certificates, policies) |
| Key Vault Secrets Officer | DevOps Service Principal | Create, update, delete secrets (for CI/CD) |
| Key Vault Secrets User | App Service (Sprint 2) | Read secrets only (for applications) |

> **Note:** Role assignments are conditionally created only when the corresponding object IDs are provided via Terraform variables.

## Key Vault Secrets

The following secrets are stored in Key Vault with placeholder values for Sprint 1:

| Secret Name | Description | Rotation Period |
|-------------|-------------|-----------------|
| `appinsights-connection-string` | Application Insights connection string | 365 days |
| `github-webhook-secret` | GitHub webhook validation secret | 90 days |
| `github-app-id` | GitHub App application ID | 365 days |
| `github-app-private-key` | GitHub App authentication private key | 90 days |
| `bot-app-id` | Teams Bot application ID | 365 days |
| `bot-app-password` | Teams Bot client secret | 90 days |
| `entra-client-secret` | Entra ID client secret for SSO | 90 days |

> **Important:** Secrets are created with dummy/placeholder values. Update with production values during deployment.

For detailed information on Key Vault usage and secret rotation, see [Key Vault Usage Guide](../docs/key-vault-usage.md).

## Contributing

1. Create a feature branch
2. Run `terraform fmt` before committing
3. Run `terraform validate` to check syntax
4. Create a pull request with a clear description
5. Ensure CI/CD pipeline passes before merging

## License

This infrastructure code is proprietary and confidential.
