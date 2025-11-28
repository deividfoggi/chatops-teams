# ChatOps Teams Network Architecture

This document provides comprehensive network architecture documentation for the ChatOps Teams application deployed on Microsoft Azure.

## Table of Contents

- [Virtual Network Overview](#virtual-network-overview)
- [Subnet Allocation](#subnet-allocation)
- [Network Security Groups](#network-security-groups)
- [Traffic Flow](#traffic-flow)
- [Disaster Recovery](#disaster-recovery)
- [Related Documentation](#related-documentation)

---

## Virtual Network Overview

The ChatOps Teams application uses a single Virtual Network (VNet) deployed in Azure East US region with a `/16` address space providing 65,536 IP addresses.

### VNet Configuration

| Property | Value |
|----------|-------|
| **Name** | chatops-vnet |
| **Region** | East US |
| **Address Space** | 10.0.0.0/16 |
| **Total IPs** | 65,536 |
| **DDoS Protection** | Basic (included with Azure) |

### Address Space Design Rationale

The `/16` address space was selected to:
1. Provide sufficient capacity for current workloads
2. Allow for future expansion without re-architecting
3. Enable disaster recovery with non-overlapping ranges in secondary regions
4. Support VNet peering with partner networks

---

## Subnet Allocation

Azure reserves 5 IP addresses in each subnet (first 4 and last 1), reducing usable IPs from 256 to 251 per /24 subnet.

### Current Subnet Configuration

| Subnet | CIDR | Usable IPs | Purpose | Status | Delegation |
|--------|------|------------|---------|--------|------------|
| app-subnet | 10.0.1.0/24 | 251 | App Service VNet integration | Deployed | Microsoft.Web/serverFarms |
| gateway-subnet | 10.0.2.0/24 | 251 | Application Gateway | Deployed | None |
| database-subnet | 10.0.3.0/24 | 251 | Azure SQL/PostgreSQL Private Endpoints | Reserved | None |
| cache-subnet | 10.0.4.0/24 | 251 | Azure Cache for Redis | Reserved | None |

### Future Expansion

| CIDR Range | Available IPs | Status | Potential Use Cases |
|------------|---------------|--------|---------------------|
| 10.0.5.0 - 10.0.255.0 | ~64,000 | Available | AKS node pools, additional tiers, dev/staging environments |

### IP Address Allocation Guidelines

1. **Production Subnets**: 10.0.1.0 - 10.0.10.0/24
2. **Development/Staging**: 10.0.20.0 - 10.0.30.0/24 (future)
3. **Management**: 10.0.100.0/24 (future bastion, jump servers)
4. **Reserved**: 10.0.200.0 - 10.0.255.0/24 (peering, expansion)

---

## Network Security Groups

Network Security Groups (NSGs) enforce security boundaries at the subnet level using a deny-by-default approach.

### App NSG (app-nsg)

Applied to: `app-subnet` (10.0.1.0/24)

| Priority | Name | Direction | Access | Protocol | Source | Destination Port | Justification |
|----------|------|-----------|--------|----------|--------|------------------|---------------|
| 100 | AllowGatewayInbound | Inbound | Allow | TCP | 10.0.2.0/24 | 443 | Allow HTTPS traffic only from Application Gateway subnet - implements zero-trust architecture |
| 100 | AllowInternetOutbound | Outbound | Allow | TCP | * | 443 | Allow outbound HTTPS for external API calls (Microsoft Graph, Teams, Bot Framework) |
| 4096 | DenyAllInbound | Inbound | Deny | * | * | * | Default deny rule - blocks all traffic not explicitly allowed |

**Security Notes:**
- App subnet only accepts traffic from the gateway subnet, not directly from the internet
- Outbound access is limited to HTTPS (port 443) for API communication
- All other inbound traffic is denied by the default deny rule

### Gateway NSG (gateway-nsg)

Applied to: `gateway-subnet` (10.0.2.0/24)

| Priority | Name | Direction | Access | Protocol | Source | Destination Port | Justification |
|----------|------|-----------|--------|----------|--------|------------------|---------------|
| 100 | AllowHTTPSInbound | Inbound | Allow | TCP | Internet | 443 | Allow public HTTPS access for user traffic - required for web application access |
| 110 | AllowGatewayManager | Inbound | Allow | TCP | GatewayManager | 65200-65535 | **Azure Requirement** - Application Gateway v2 requires these ports for management and health probes |

**Security Notes:**
- GatewayManager service tag is required for Application Gateway v2 health probes
- Port range 65200-65535 is mandated by Azure; blocking these ports causes Application Gateway deployment failure
- HTTPS-only access ensures all traffic is encrypted in transit

### NSG Flow Logs

Flow logs are enabled for traffic visibility and security monitoring:

| Configuration | Value |
|---------------|-------|
| **Storage Account** | chatopsnsgflow[random] |
| **Retention** | 90 days |
| **Version** | 2 (includes additional metrics) |
| **Traffic Analytics** | Enabled (10-minute interval) |
| **Log Analytics Workspace** | chatops-loganalytics |

---

## Traffic Flow

### Inbound Traffic Flow

```
                    ┌─────────────────────────────────────────────────┐
                    │                   INTERNET                      │
                    └─────────────────────┬───────────────────────────┘
                                          │ HTTPS (443)
                                          ▼
                    ┌─────────────────────────────────────────────────┐
                    │              Azure DDoS Protection              │
                    │                   (Basic)                       │
                    └─────────────────────┬───────────────────────────┘
                                          │
                                          ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                         chatops-vnet (10.0.0.0/16)                      │
    │                                                                         │
    │  ┌───────────────────────────────────────────────────────────────────┐  │
    │  │              gateway-subnet (10.0.2.0/24)                         │  │
    │  │                     gateway-nsg                                   │  │
    │  │  ┌─────────────────────────────────────────────────────────────┐  │  │
    │  │  │              Application Gateway                            │  │  │
    │  │  │              (WAF enabled - future)                         │  │  │
    │  │  └──────────────────────────┬──────────────────────────────────┘  │  │
    │  └─────────────────────────────┼─────────────────────────────────────┘  │
    │                                │ HTTPS (443)                            │
    │                                ▼                                        │
    │  ┌───────────────────────────────────────────────────────────────────┐  │
    │  │                app-subnet (10.0.1.0/24)                           │  │
    │  │                       app-nsg                                     │  │
    │  │  ┌─────────────────────────────────────────────────────────────┐  │  │
    │  │  │              Azure App Service                              │  │  │
    │  │  │              (ChatOps Bot Application)                      │  │  │
    │  │  └──────────────────────────┬──────────────────────────────────┘  │  │
    │  └─────────────────────────────┼─────────────────────────────────────┘  │
    │                                │                                        │
    └────────────────────────────────┼────────────────────────────────────────┘
                                     │ Private Endpoint (future)
                                     ▼
                    ┌─────────────────────────────────────────────────┐
                    │              Azure SQL / Key Vault              │
                    │              (Private Endpoints)                │
                    └─────────────────────────────────────────────────┘
```

### Outbound Traffic Flow

```
    ┌─────────────────────────────────────────────────────────────────┐
    │                    Azure App Service                            │
    │                  (app-subnet 10.0.1.0/24)                       │
    └───────────────────────────┬─────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
    ┌───────────────────────┐   ┌───────────────────────────┐
    │   Private Endpoints   │   │   Internet (HTTPS/443)    │
    │   - Key Vault         │   │   - Microsoft Graph API   │
    │   - SQL Database      │   │   - Teams Bot Framework   │
    │   - Storage           │   │   - Azure AD              │
    └───────────────────────┘   └───────────────────────────┘
```

---

## Disaster Recovery

### Primary and Secondary Region Strategy

| Property | Primary Region | Secondary Region |
|----------|----------------|------------------|
| **Region** | East US | West US |
| **VNet Address Space** | 10.0.0.0/16 | 10.1.0.0/16 |
| **Subnet Range** | 10.0.x.0/24 | 10.1.x.0/24 |

### Non-Overlapping Address Design

The secondary region uses 10.1.0.0/16 to enable:
- VNet peering between regions without IP conflicts
- Cross-region private endpoint connectivity
- Failover without re-IP addressing

### Secondary Region Subnet Mapping

| Primary Subnet | Primary CIDR | Secondary Subnet | Secondary CIDR |
|----------------|--------------|------------------|----------------|
| app-subnet | 10.0.1.0/24 | app-subnet | 10.1.1.0/24 |
| gateway-subnet | 10.0.2.0/24 | gateway-subnet | 10.1.2.0/24 |
| database-subnet | 10.0.3.0/24 | database-subnet | 10.1.3.0/24 |
| cache-subnet | 10.0.4.0/24 | cache-subnet | 10.1.4.0/24 |

### VNet Peering Strategy

```
    ┌────────────────────────────────┐       ┌────────────────────────────────┐
    │       East US (Primary)        │       │      West US (Secondary)       │
    │      chatops-vnet-eastus       │       │      chatops-vnet-westus       │
    │         10.0.0.0/16            │◄─────►│         10.1.0.0/16            │
    │                                │ Peering│                                │
    │  ┌──────────────────────────┐  │       │  ┌──────────────────────────┐  │
    │  │ app-subnet  10.0.1.0/24  │  │       │  │ app-subnet  10.1.1.0/24  │  │
    │  └──────────────────────────┘  │       │  └──────────────────────────┘  │
    │  ┌──────────────────────────┐  │       │  ┌──────────────────────────┐  │
    │  │ gateway     10.0.2.0/24  │  │       │  │ gateway     10.1.2.0/24  │  │
    │  └──────────────────────────┘  │       │  └──────────────────────────┘  │
    │  ┌──────────────────────────┐  │       │  ┌──────────────────────────┐  │
    │  │ database    10.0.3.0/24  │  │       │  │ database    10.1.3.0/24  │  │
    │  └──────────────────────────┘  │       │  └──────────────────────────┘  │
    └────────────────────────────────┘       └────────────────────────────────┘
```

### Failover DNS Configuration

| Component | Strategy | Notes |
|-----------|----------|-------|
| **Azure Traffic Manager** | Priority routing | Primary region first, automatic failover |
| **DNS TTL** | 60 seconds | Minimize propagation delay during failover |
| **Health Probes** | HTTPS /health | Automatic failover on 3 consecutive failures |
| **Failback** | Manual | Requires validation before returning to primary |

### Recovery Time Objectives

| Metric | Target | Notes |
|--------|--------|-------|
| **RTO** (Recovery Time Objective) | 15 minutes | DNS failover + warm standby |
| **RPO** (Recovery Point Objective) | 1 hour | Database geo-replication |
| **Failover Trigger** | Automatic | Via Traffic Manager health probes |

---

## Related Documentation

- [Network Troubleshooting Guide](./network-troubleshooting.md) - Common issues and Log Analytics queries
- [Infrastructure README](../infrastructure/README.md) - Terraform configuration and deployment
- [CI/CD Workflows](../.github/workflows/README.md) - Deployment pipelines

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-28  
**Maintained by:** Cloud Architecture Team  
**Review Frequency:** Quarterly
