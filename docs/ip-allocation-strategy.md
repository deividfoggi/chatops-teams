# IP Allocation Strategy

## Overview

This document defines the IP address allocation strategy for the ChatOps Teams application infrastructure. The strategy is designed to provide ample address space for current needs while allowing for future growth and expansion.

---

## Virtual Network Address Space

**VNet Name:** `chatops-vnet`  
**Address Space:** `10.0.0.0/16`  
**Total Available IPs:** 65,536  
**Region:** East US

### Design Rationale

The `/16` CIDR block was chosen for the following reasons:

1. **Sufficient Capacity:** Provides 65,536 IP addresses, far exceeding current and near-term future requirements
2. **Future Expansion:** Allows for multiple environments (dev, staging, prod) within the same address space
3. **Private Range:** Uses RFC 1918 private address space, suitable for Azure VNet
4. **Subnet Flexibility:** Enables creation of multiple `/24` subnets (256 IPs each) as needed

---

## Subnet Allocation

### Current Subnets (Sprint 1)

| Subnet Name | CIDR Block | Total IPs | Usable IPs | Purpose | Status |
|-------------|------------|-----------|------------|---------|--------|
| app-subnet | 10.0.1.0/24 | 256 | 251 | App Service VNet integration, Container Apps | ✅ Deployed |
| gateway-subnet | 10.0.2.0/24 | 256 | 251 | Application Gateway, API Gateway | ✅ Deployed |

**Note:** Azure reserves 5 IP addresses in each subnet (first 4 and last 1), reducing usable addresses from 256 to 251 per `/24` subnet.

### Reserved for Future Use

| CIDR Range | Total IPs | Reserved For | Planned Sprint |
|------------|-----------|--------------|----------------|
| 10.0.3.0/24 | 256 | Database subnet (Azure SQL, CosmosDB) | Sprint 2 |
| 10.0.4.0/24 | 256 | Private endpoints subnet | Sprint 3 |
| 10.0.5.0/24 | 256 | Management subnet (Bastion, monitoring tools) | Future |
| 10.0.10.0/24 | 256 | Dev environment - app tier | Future |
| 10.0.11.0/24 | 256 | Dev environment - gateway tier | Future |
| 10.0.12.0/24 | 256 | Dev environment - database tier | Future |
| 10.0.20.0/24 | 256 | Staging environment - app tier | Future |
| 10.0.21.0/24 | 256 | Staging environment - gateway tier | Future |
| 10.0.22.0/24 | 256 | Staging environment - database tier | Future |
| 10.0.100.0/22 | 1,024 | Azure Kubernetes Service (AKS) nodes | Future (if needed) |
| 10.0.104.0/22 | 1,024 | AKS pods (delegated subnet) | Future (if needed) |
| 10.0.108.0 - 10.0.255.255 | ~37,000 | Available for future expansion | Future |

---

## Subnet Details

### 1. App Subnet (10.0.1.0/24)

**Purpose:** Hosts application workloads that require VNet integration

**Resources:**
- Azure App Service with VNet integration (Sprint 2)
- Azure Container Apps (Future)
- Azure Functions with VNet integration (Future)

**IP Allocation:**
- App Service instances: Dynamic allocation from subnet
- Each App Service worker requires 1 IP address
- Autoscaling considerations: Plan for up to 30 instances (120 IPs with redundancy)

**Subnet Delegation:**
- `Microsoft.Web/serverFarms` - Allows App Service VNet integration

**Service Endpoints:**
- `Microsoft.KeyVault` - Direct connection to Key Vault
- Additional endpoints can be added as needed

**Network Security Group:** `app-nsg`
- Restricts inbound traffic to gateway subnet only
- Allows outbound HTTPS to Internet
- Deny-all rule at lowest priority

---

### 2. Gateway Subnet (10.0.2.0/24)

**Purpose:** Hosts ingress and API gateway resources

**Resources:**
- Azure Application Gateway v2 (Sprint 2)
- WAF v2 with OWASP 3.2 ruleset (Sprint 2)

**IP Allocation:**
- Application Gateway frontend: 1 static IP (public)
- Application Gateway backend: Dynamic allocation for instances
- Gateway autoscaling: Up to 10 instances (reservation: 20 IPs)

**Subnet Requirements:**
- Dedicated subnet required for Application Gateway v2
- No other resources can be deployed to this subnet
- Minimum subnet size: `/27` (32 IPs) - we allocated `/24` for future growth

**Network Security Group:** `gateway-nsg`
- Allows HTTPS (443) from Internet
- Allows Azure Gateway Manager on ports 65200-65535
- Restricts outbound to app subnet only

---

### 3. Database Subnet (10.0.3.0/24) - Future

**Purpose:** Hosts database resources with private endpoints

**Resources (Planned for Sprint 2):**
- Azure SQL Database with private endpoint
- Azure CosmosDB with private endpoint (if needed)
- Redis Cache with private endpoint (if needed)

**IP Allocation:**
- Private endpoints: 1 IP per service
- Estimated usage: 10-20 IPs maximum

**Security:**
- No public endpoint access
- Access only from app subnet
- Encrypted connections required (TLS 1.2+)

---

### 4. Private Endpoints Subnet (10.0.4.0/24) - Future

**Purpose:** Centralized subnet for all private endpoints

**Resources (Planned for Sprint 3):**
- Key Vault private endpoint
- Storage Account private endpoints
- Service Bus private endpoint
- Any other Azure PaaS services requiring private connectivity

**IP Allocation:**
- 1 IP per private endpoint
- Estimated usage: 20-50 IPs

**Benefits:**
- Centralized management of private endpoints
- Simplified NSG rules
- Clear separation from application workloads

---

## IP Address Utilization

### Current Usage (Sprint 1)

| Resource Type | Subnet | Estimated IPs | Status |
|--------------|--------|---------------|--------|
| App Service (Planned) | app-subnet | 30-50 | Sprint 2 |
| Application Gateway (Planned) | gateway-subnet | 10-20 | Sprint 2 |
| **Total Current** | | **40-70** | |
| **Available (Current Subnets)** | | **~430** | |

### Growth Projection

| Timeframe | Estimated Total IPs | Available Capacity | Notes |
|-----------|-------------------|-------------------|-------|
| Sprint 2 (Current) | 70 | 65,400+ | Plenty of headroom |
| 6 months | 200 | 65,200+ | Add dev environment |
| 1 year | 500 | 65,000+ | Add staging, increase scaling |
| 2 years | 1,500 | 64,000+ | Add AKS cluster (if needed) |
| 5 years | 5,000 | 60,000+ | Multi-region expansion |

**Conclusion:** The `/16` address space provides sufficient capacity for at least 5 years of growth without re-architecting.

---

## Service Endpoints vs Private Endpoints

### Service Endpoints (Currently Deployed)

**Configured:**
- `Microsoft.KeyVault` on app-subnet

**Characteristics:**
- Traffic stays on Microsoft backbone network
- Source IP preserved (important for Key Vault firewall rules)
- No additional IP consumption
- Subnet-level configuration
- Free (no additional cost)

**Use Cases:**
- Key Vault access from App Service
- Storage Account access (if needed)
- SQL Database access (if public endpoint enabled)

### Private Endpoints (Future)

**Planned:**
- Key Vault private endpoint (Sprint 3)
- Database private endpoints (Sprint 2)
- Storage Account private endpoints (Sprint 3)

**Characteristics:**
- Consumes 1 IP address per private endpoint
- Completely private connectivity (no public endpoint)
- Requires Private DNS Zone for name resolution
- Additional cost (~$7/month per endpoint)

**Use Cases:**
- Complete isolation from public internet
- Compliance requirements (HIPAA, PCI-DSS)
- Enhanced security for sensitive data

---

## Network Security Groups (NSGs)

### App Subnet NSG Rules

| Priority | Name | Direction | Action | Source | Destination | Port | Purpose |
|----------|------|-----------|--------|--------|-------------|------|---------|
| 100 | AllowGatewayInbound | Inbound | Allow | 10.0.2.0/24 | 10.0.1.0/24 | 443 | HTTPS from Application Gateway |
| 4096 | DenyAllInbound | Inbound | Deny | * | * | * | Default deny |
| 100 | AllowInternetOutbound | Outbound | Allow | 10.0.1.0/24 | Internet | 443 | HTTPS to external APIs |

### Gateway Subnet NSG Rules

| Priority | Name | Direction | Action | Source | Destination | Port | Purpose |
|----------|------|-----------|--------|--------|-------------|------|---------|
| 100 | AllowHTTPSInbound | Inbound | Allow | Internet | * | 443 | HTTPS from clients |
| 110 | AllowGatewayManager | Inbound | Allow | GatewayManager | * | 65200-65535 | Azure Gateway health probes |

---

## DNS Configuration

### Azure DNS Integration

**Current:**
- Default Azure-provided DNS (168.63.129.16)
- Automatic resolution for Azure resources

**Future (Sprint 3):**
- Private DNS Zones for private endpoints
- Custom DNS conditional forwarding (if needed)

**Private DNS Zones Required:**
- `privatelink.vaultcore.azure.net` - Key Vault
- `privatelink.database.windows.net` - Azure SQL
- `privatelink.blob.core.windows.net` - Storage Account
- `privatelink.servicebus.windows.net` - Service Bus

---

## VNet Peering (Future Consideration)

### Hub-Spoke Topology (Optional)

If the application scales to multiple VNets or requires shared services:

**Hub VNet:** `10.0.0.0/16` (Current VNet)
- Shared services (monitoring, logging, bastion)
- Centralized security appliances (if needed)

**Spoke VNets:**
- Dev: `10.1.0.0/16`
- Staging: `10.2.0.0/16`
- Additional workloads: `10.3.0.0/16` and beyond

**Benefits:**
- Isolated environments
- Centralized management
- Traffic inspection (if needed)

**Considerations:**
- Peering costs (~$0.01/GB)
- Additional complexity
- Not needed for current scale

---

## Multi-Region Strategy (Future)

### Disaster Recovery Region

**Primary Region:** East US (`10.0.0.0/16`)  
**DR Region:** West US 2 (`10.10.0.0/16`)

**Traffic Management:**
- Azure Front Door or Traffic Manager
- Active-passive or active-active depending on RTO/RPO

**Cross-Region Considerations:**
- Separate VNets per region (no peering required)
- Global VNet peering if needed (~$0.035/GB)
- Database replication (Azure SQL geo-replication, CosmosDB multi-region)

---

## Best Practices

### IP Allocation Guidelines

1. **Always use private IP ranges** (RFC 1918):
   - `10.0.0.0/8`
   - `172.16.0.0/12`
   - `192.168.0.0/16`

2. **Plan for growth:**
   - Allocate larger subnets than immediately needed
   - Reserve address blocks for future use
   - Document IP allocation strategy

3. **Subnet sizing:**
   - Use `/24` for most application subnets (251 usable IPs)
   - Use `/27` to `/24` for gateway subnets
   - Use `/22` or larger for AKS clusters (if needed)

4. **Avoid fragmentation:**
   - Allocate contiguous address blocks
   - Reserve blocks for specific purposes
   - Don't allocate random `/24` blocks throughout the space

5. **Document everything:**
   - Maintain this IP allocation strategy document
   - Update as changes are made
   - Include rationale for decisions

### Security Guidelines

1. **Least privilege:**
   - NSG rules allow only required traffic
   - Deny-all as default rule
   - Service endpoints instead of public endpoints when possible

2. **Network segmentation:**
   - Separate subnets for different tiers (app, gateway, database)
   - NSGs on every subnet
   - Traffic flows are well-defined and documented

3. **Monitoring:**
   - Enable NSG flow logs (currently enabled)
   - Traffic Analytics for pattern detection
   - Alert on unusual traffic patterns

---

## Changes and Approvals

| Date | Change | Requested By | Approved By | Notes |
|------|--------|-------------|-------------|-------|
| 2025-12-29 | Initial IP allocation strategy | Infrastructure Team | Architecture Team | Sprint 1 deployment |

---

## Related Documentation

- [Sprint 1 Foundation Planning](./sprint-1-foundation-planning.md)
- [Network Architecture](./network-architecture.md)
- [Infrastructure README](../infrastructure/README.md)
- [Network Troubleshooting](./network-troubleshooting.md)

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-29  
**Owner:** Infrastructure Team  
**Review Cycle:** Quarterly or upon significant changes
