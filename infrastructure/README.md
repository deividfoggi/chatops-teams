# ChatOps Teams Infrastructure

This directory contains Terraform configurations for the ChatOps Teams application infrastructure on Microsoft Azure.

## Table of Contents

- [Overview](#overview)
- [Sprint 1 Status](#sprint-1-status)
- [Architecture](#architecture)
- [IP Allocation Strategy](#ip-allocation-strategy)
- [Azure Well-Architected Framework Alignment](#azure-well-architected-framework-alignment)
- [Prerequisites](#prerequisites)
- [Terraform Usage](#terraform-usage)
- [Resources](#resources)

## Overview

The ChatOps Teams infrastructure is designed to support a scalable, secure, and cost-effective deployment of the ChatOps application on Azure. The infrastructure follows Infrastructure as Code (IaC) best practices using Terraform.

## Sprint 1 Status

**Status:** ✅ **Foundation Complete**

Sprint 1 has successfully deployed the three foundational infrastructure components:

| Component | Issue | Status | Documentation |
|-----------|-------|--------|---------------|
| Azure Virtual Network | [#41](https://github.com/deividfoggi/chatops-teams/issues/41) | ✅ Deployed | [Network Architecture](../docs/network-architecture.md) |
| Azure Key Vault | [#42](https://github.com/deividfoggi/chatops-teams/issues/42) | ✅ Deployed | [Key Vault Usage](../docs/key-vault-usage.md) |
| Application Insights | [#39](https://github.com/deividfoggi/chatops-teams/issues/39) | ✅ Deployed | [App Insights Metrics](../docs/application-insights-custom-metrics.md) |

**Infrastructure Readiness:**
- ✅ Network isolation with NSGs and flow logs
- ✅ Secrets management with RBAC-enabled Key Vault
- ✅ Observability with multi-region availability tests
- ✅ Security foundation for Sprint 2 (App Service, Application Gateway)

**Sprint 2 Prerequisites:**
- GitHub App registration approval (3-5 days)
- Azure quota verification for PremiumV3 App Service
- SSL certificate procurement for Application Gateway

For detailed Sprint 1 information, see [Sprint 1 Foundation Planning](../docs/sprint-1-foundation-planning.md).

## Architecture

The infrastructure includes the following core components:

| Resource | Description |
|----------|-------------|
| Resource Group | Container for all ChatOps resources |
| Virtual Network | 10.0.0.0/16 address space for network isolation |
| Log Analytics Workspace | Centralized logging and monitoring |
| Application Insights | Application performance monitoring and telemetry |
| Key Vault | Secure storage for secrets, keys, and certificates |
| App Service Plan | PremiumV3 P1v3 (2 cores, 8GB RAM) with autoscaling |
| App Service | Linux-based web app with VNet integration |
| Azure Cache for Redis | Premium P1 (6GB) distributed caching with persistence |

## IP Allocation Strategy

The virtual network is configured with a `/16` address space providing ample room for current needs and future growth.

For the complete IP allocation strategy including subnet design, future planning, and network security group rules, see [IP Allocation Strategy](../docs/ip-allocation-strategy.md).

### Address Space Summary

| CIDR Block | Total IPs | Purpose |
|------------|-----------|---------|
| 10.0.0.0/16 | 65,536 | Virtual Network address space |

### Subnet Allocation

| Subnet Name | CIDR Block | Usable IPs | Purpose |
|-------------|------------|------------|---------|
| app-subnet | 10.0.1.0/24 | 251 | Application workloads (App Service, Container Apps) |
| gateway-subnet | 10.0.2.0/24 | 251 | API Gateway and ingress controllers |
| database-subnet | 10.0.3.0/24 | 251 | Database services (Azure SQL, CosmosDB) - Reserved for Sprint 2 |
| chatops-redis-subnet | 10.0.4.0/24 | 251 | Azure Cache for Redis with VNet injection |

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
- **Web Application Firewall:** WAF v2 with OWASP 3.2 ruleset in Prevention mode protecting against common threats
- **Rate Limiting:** Custom WAF rule limiting requests to 100 per minute per IP to prevent abuse
- **HTTPS Termination:** SSL/TLS offloading at Application Gateway with certificates stored in Key Vault
- **Private Networking:** VNet foundation enables private endpoints and service endpoints
- **No Hardcoded Secrets:** Sensitive values managed via variables and Azure Key Vault
- **Key Vault RBAC:** Azure RBAC authorization (no legacy access policies) with least-privilege role assignments
- **Comprehensive Logging:** All WAF events, access logs, and performance metrics sent to Log Analytics

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
   cd chatops-teams/infrastructure
   ```

2. **Configure the backend**
   
   The backend is configured in `main.tf`. Ensure your Azure Storage account exists:
   ```bash
   # Create storage account if needed
   az group create --name rg-terraform-state-chatops --location eastus
   az storage account create \
     --name stterraformchatops19932 \
     --resource-group rg-terraform-state-chatops \
     --location eastus \
     --sku Standard_LRS
   az storage container create \
     --name tfstate \
     --account-name stterraformchatops19932 \
     --auth-mode login
   ```

3. **Configure environment variables**
   
   Update the appropriate environment file in `environments/`:
   - `environments/dev.tfvars` for development
   - `environments/staging.tfvars` for staging
   - `environments/prod.tfvars` for production
   
   ```hcl
   environment = "prod"
   cost_center = "IT-12345"
   owner       = "chatops-team@example.com"
   # ... other variables
   ```

### Common Commands

| Command | Description |
|---------|-------------|
| `terraform init` | Initialize working directory and download providers |
| `terraform fmt -recursive` | Format configuration files |
| `terraform validate` | Validate configuration syntax |
| `terraform plan -var-file="environments/dev.tfvars" -out=tfplan` | Preview changes for dev environment |
| `terraform apply tfplan` | Apply the saved plan |
| `terraform destroy -var-file="environments/dev.tfvars"` | Destroy all resources (use with caution) |

### Workflow

```bash
# Initialize Terraform
terraform init \
  -backend-config="resource_group_name=rg-terraform-state-chatops" \
  -backend-config="storage_account_name=stterraformchatops19932" \
  -backend-config="container_name=tfstate" \
  -backend-config="key=dev.tfstate" \
  -backend-config="use_azuread_auth=true"

# Format code
terraform fmt -recursive

# Validate configuration
terraform validate

# Preview changes (Development)
terraform plan -var-file="environments/dev.tfvars" -out=tfplan

# Preview changes (Staging)
terraform plan -var-file="environments/staging.tfvars" -out=tfplan

# Preview changes (Production)
terraform plan -var-file="environments/prod.tfvars" -out=tfplan

# Apply changes
terraform apply tfplan
```

### Environment-Specific Deployments

The infrastructure supports three environments with separate state files:

| Environment | State File | Variable File | Auto-Deploy |
|-------------|-----------|---------------|-------------|
| Development | `dev.tfstate` | `environments/dev.tfvars` | On push to `develop` |
| Staging | `staging.tfstate` | `environments/staging.tfvars` | On push to `main` |
| Production | `prod.tfstate` | `environments/prod.tfvars` | On push to `main` (with approval) |

See the [Infrastructure Deployment Guide](../docs/infrastructure-deployment-guide.md) for detailed instructions.

### State Management

- State is stored remotely in Azure Storage Account
- Each environment has its own state file (dev.tfstate, staging.tfstate, prod.tfstate)
- State locking is enabled via Azure Blob leases
- Never edit state files directly; use `terraform state` commands if needed

## Resources

| Resource Type | Name | Purpose |
|---------------|------|---------|
| `azurerm_resource_group` | chatops | Resource container |
| `azurerm_virtual_network` | chatops_vnet | Network isolation |
| `azurerm_subnet` | app_subnet | App Service VNet integration |
| `azurerm_subnet` | gateway_subnet | Application Gateway subnet |
| `azurerm_subnet` | redis_subnet | Azure Cache for Redis VNet injection |
| `azurerm_log_analytics_workspace` | chatops | Monitoring and logging |
| `azurerm_application_insights` | chatops | Application performance monitoring |
| `azurerm_key_vault` | chatops | Secrets management |
| `azurerm_service_plan` | chatops | App Service Plan (PremiumV3 P1v3) |
| `azurerm_linux_web_app` | chatops | Linux web application |
| `azurerm_redis_cache` | chatops | Premium P1 Redis cache with persistence |
| `azurerm_storage_account` | redis_backup | Storage for Redis RDB backups |
| `azurerm_monitor_autoscale_setting` | chatops_app_plan | Autoscaling for App Service Plan |
| `azurerm_role_assignment` | kv_admin | Key Vault Administrator role (admin group) |
| `azurerm_role_assignment` | kv_secrets_officer | Key Vault Secrets Officer role (DevOps SP) |
| `azurerm_role_assignment` | kv_secrets_user_app_service | Key Vault Secrets User role (App Service) |

## App Service Configuration

The App Service is configured with the following features:

### Compute
- **SKU**: PremiumV3 P1v3 (2 cores, 8GB RAM)
- **OS**: Linux
- **Runtime**: Node.js 18 LTS
- **Always On**: Enabled for production workloads

### Autoscaling
- **Default instances**: 1
- **Min instances**: 1
- **Max instances**: 5
- **Scale-out triggers**:
  - CPU > 75% (5-minute average)
  - Memory > 85% (5-minute average)
- **Scale-in triggers**:
  - CPU < 25% (5-minute average)
  - Memory < 30% (5-minute average)

### Security
- **Managed Identity**: System-assigned
- **HTTPS Only**: Enabled
- **Minimum TLS**: 1.2
- **IP Restrictions**: Allow only Application Gateway subnet (10.0.2.0/24)
- **Key Vault Integration**: Secrets accessed via managed identity

### Networking
- **VNet Integration**: Connected to app-subnet
- **Outbound**: Via VNet (not direct internet)

### Monitoring
- **Health Check**: `/health` endpoint (5-minute eviction window)
- **Application Insights**: Enabled with connection string
- **Diagnostic Logs**: All categories enabled, sent to Log Analytics

## Key Vault RBAC Roles

The Key Vault uses Azure RBAC authorization (no legacy access policies) with the following roles:

| Role | Assignee | Permissions |
|------|----------|-------------|
| Key Vault Administrator | Admin Group | Full management (secrets, keys, certificates, policies) |
| Key Vault Secrets Officer | DevOps Service Principal | Create, update, delete secrets (for CI/CD) |
| Key Vault Secrets User | Application Gateway | Read SSL certificates (for HTTPS termination) |
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
| `redis-host` | Azure Cache for Redis hostname | 365 days |
| `redis-port` | Azure Cache for Redis SSL port (6380) | 365 days |
| `redis-access-key` | Azure Cache for Redis primary access key | 90 days |

> **Important:** Secrets are created with dummy/placeholder values. Update with production values during deployment.

For detailed information on Key Vault usage and secret rotation, see [Key Vault Usage Guide](../docs/key-vault-usage.md).

## Azure Cache for Redis Configuration

The Redis cache is configured for distributed caching across multiple App Service instances:

### Cache Tier
- **SKU**: Premium P1 (6GB capacity)
- **Benefits**: Data persistence, geo-replication support, VNet injection

### Security Features
- **TLS Version**: Minimum TLS 1.2
- **SSL Port**: 6380 (non-SSL port disabled)
- **Network**: VNet injection into dedicated subnet (10.0.4.0/24)
- **Access**: Only accessible from within the VNet

### Data Persistence
- **Type**: RDB (Redis Database) snapshots
- **Frequency**: Every 15 minutes
- **Storage**: Dedicated storage account with LRS replication
- **Max Snapshots**: 1 (most recent)

### Cache Configuration
- **Eviction Policy**: `allkeys-lru` (Least Recently Used)
- **Keyspace Events**: `KEx` (expired and evicted keys)

### Monitoring & Alerts
- **Server Load Alert**: Triggers when CPU > 90% for 5 minutes
- **Cache Miss Alert**: Triggers when miss rate > 50% for 10 minutes
- **Connection Errors**: Triggers when > 5 errors in 5 minutes
- **Memory Usage Alert**: Triggers when memory > 90%
- **Diagnostics**: All logs sent to Log Analytics workspace

### Environment Variables
App Service is configured with the following Redis environment variables:
- `REDIS_HOST`: Retrieved from Key Vault
- `REDIS_PORT`: Retrieved from Key Vault (6380)
- `REDIS_PASSWORD`: Retrieved from Key Vault
- `REDIS_TLS`: Set to `true`

## Contributing

1. Create a feature branch
2. Run `terraform fmt` before committing
3. Run `terraform validate` to check syntax
4. Create a pull request with a clear description
5. Ensure CI/CD pipeline passes before merging

## License

This infrastructure code is proprietary and confidential.
