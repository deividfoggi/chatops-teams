# ChatOps Teams - Network Architecture Documentation

## Overview

This document describes the network architecture for the ChatOps Teams application deployed on Microsoft Azure. The design follows Azure Well-Architected Framework principles with a focus on security, scalability, and cost optimization.

## Network Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                    Azure Cloud (East US)                        │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │          Resource Group: rg-chatops-prod                  │ │
│  │                                                           │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │   Virtual Network: chatops-vnet (10.0.0.0/16)       │ │ │
│  │  │                                                     │ │ │
│  │  │  ┌───────────────────────────────────────────────┐ │ │ │
│  │  │  │  Gateway Subnet: 10.0.2.0/24                  │ │ │ │
│  │  │  │  ┌─────────────────────────────────────────┐  │ │ │ │
│  │  │  │  │  Application Gateway (Future)            │  │ │ │ │
│  │  │  │  │  - WAF Protection                        │  │ │ │ │
│  │  │  │  │  - SSL/TLS Termination                   │  │ │ │ │
│  │  │  │  │  - HTTPS:443 from Internet               │  │ │ │ │
│  │  │  │  └─────────────────────────────────────────┘  │ │ │ │
│  │  │  │  NSG: gateway-nsg                              │ │ │ │
│  │  │  │  - Allow HTTPS (443) from Internet             │ │ │ │
│  │  │  │  - Allow Gateway Manager (65200-65535)         │ │ │ │
│  │  │  └───────────────────────────────────────────────┘ │ │ │
│  │  │                          │                          │ │ │
│  │  │                          │ HTTPS                    │ │ │
│  │  │                          ▼                          │ │ │
│  │  │  ┌───────────────────────────────────────────────┐ │ │ │
│  │  │  │  App Subnet: 10.0.1.0/24                      │ │ │ │
│  │  │  │  ┌─────────────────────────────────────────┐  │ │ │ │
│  │  │  │  │  App Service with VNet Integration       │  │ │ │ │
│  │  │  │  │  - Teams Bot Application                 │  │ │ │ │
│  │  │  │  │  - Private networking                    │  │ │ │ │
│  │  │  │  └─────────────────────────────────────────┘  │ │ │ │
│  │  │  │  NSG: app-nsg                                  │ │ │ │
│  │  │  │  - Allow inbound from Gateway subnet           │ │ │ │
│  │  │  │  - Allow outbound HTTPS to Internet            │ │ │ │
│  │  │  │  - Deny all other traffic (Priority 4096)      │ │ │ │
│  │  │  └───────────────────────────────────────────────┘ │ │ │
│  │  │                                                     │ │ │
│  │  │  Reserved for Future: 10.0.3.0 - 10.0.255.0        │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Monitoring & Logging:                                          │
│  - Log Analytics Workspace (chatops-loganalytics)               │
│  - NSG Flow Logs (90-day retention)                             │
│  - Network Watcher Traffic Analytics                            │
└─────────────────────────────────────────────────────────────────┘
```

## IP Address Allocation Strategy

### Address Space Overview

| CIDR Block | Total IPs | Purpose | Status |
|------------|-----------|---------|--------|
| 10.0.0.0/16 | 65,536 | Virtual Network | Active |

### Subnet Allocation

| Subnet Name | CIDR Block | Usable IPs | Purpose | Status |
|-------------|------------|------------|---------|--------|
| gateway-subnet | 10.0.2.0/24 | 251 | Application Gateway, VPN Gateway | Active |
| app-subnet | 10.0.1.0/24 | 251 | App Service VNet Integration, Container Apps | Active |
| **Reserved** | 10.0.3.0/24 | 251 | Database tier (Azure SQL, CosmosDB) | Reserved |
| **Reserved** | 10.0.4.0/24 | 251 | Cache tier (Redis) | Reserved |
| **Reserved** | 10.0.5.0/24 | 251 | Management/Bastion | Reserved |
| **Reserved** | 10.0.6.0 - 10.0.255.0 | ~64,000 | Future expansion | Reserved |

> **Note:** Azure reserves 5 IP addresses in each subnet:
> - `.0`: Network address
> - `.1`: Default gateway
> - `.2`, `.3`: Azure DNS
> - `.255`: Broadcast address
>
> Therefore, a /24 subnet provides 251 usable IP addresses (256 - 5).

### IP Allocation Justification

**Why /16 for VNet?**
- Provides 65,536 addresses for long-term growth
- Supports multiple environments (dev, staging, prod) in future
- Enables disaster recovery region with similar addressing scheme
- Allows for hybrid connectivity (VPN, ExpressRoute) without re-architecture

**Why /24 for Subnets?**
- 251 usable IPs sufficient for autoscaling workloads
- App Service VNet integration: ~10-50 IPs typical
- Application Gateway: 10-125 IPs depending on instance count
- Balances granularity with efficient address usage

## Network Security

### Network Security Groups (NSGs)

#### Gateway NSG (gateway-nsg)

**Purpose:** Controls traffic to/from the gateway subnet hosting Application Gateway.

| Rule Name | Priority | Direction | Action | Protocol | Source | Dest | Port | Description |
|-----------|----------|-----------|--------|----------|--------|------|------|-------------|
| AllowHTTPSInbound | 100 | Inbound | Allow | TCP | Internet | * | 443 | Public HTTPS access |
| AllowGatewayManager | 110 | Inbound | Allow | TCP | GatewayManager | * | 65200-65535 | Azure Gateway health probes |

**Rationale:**
- Port 443: Required for public HTTPS traffic to the application
- Ports 65200-65535: Required by Azure Application Gateway v2 for health monitoring and management

#### App NSG (app-nsg)

**Purpose:** Controls traffic to/from the app subnet hosting App Service workloads.

| Rule Name | Priority | Direction | Action | Protocol | Source | Dest | Port | Description |
|-----------|----------|-----------|--------|----------|--------|------|------|-------------|
| AllowGatewayInbound | 100 | Inbound | Allow | TCP | 10.0.2.0/24 | * | 443 | Traffic from gateway only |
| AllowInternetOutbound | 100 | Outbound | Allow | TCP | * | Internet | 443 | Outbound HTTPS |
| DenyAllInbound | 4096 | Inbound | Deny | * | * | * | * | Default deny (lowest priority) |

**Rationale:**
- Implements Zero Trust: deny all by default, explicitly allow required traffic
- Priority 4096: Lowest possible priority ensures explicit rules take precedence
- Gateway-only inbound: Ensures traffic must flow through Application Gateway WAF
- HTTPS outbound: Required for Teams API calls, Azure service communication

### NSG Flow Logs

**Configuration:**
- **Enabled:** Yes
- **Version:** 2 (includes flow direction and decision)
- **Storage Account:** `chatopsnsgflow[random]`
- **Retention:** 90 days
- **Traffic Analytics:** Enabled with Log Analytics integration
- **Interval:** 10 minutes

**Benefits:**
- Security incident investigation
- Network traffic pattern analysis
- Compliance reporting (SOC 2, ISO 27001)
- Cost optimization insights

## DDoS Protection

### Decision: Azure DDoS Protection Basic

**Cost Analysis:**
- **DDoS Protection Standard:** $2,944/month + data processed charges
- **DDoS Protection Basic:** Included (no additional cost)

**Decision Rationale:**

✅ **Use Basic (Current):**
1. **Cost Optimization:** Standard adds $35,328/year fixed cost
2. **Workload Profile:** Internal Teams bot with controlled access patterns
3. **Basic Coverage:** Automatic mitigation of common volumetric attacks
4. **Layer 7 Protection:** Application Gateway WAF provides app-layer DDoS protection
5. **Traffic Volume:** Expected traffic well within Basic capabilities

❌ **Not Using Standard (Current):**
- No financial transaction processing
- No public-facing e-commerce
- Limited external attack surface

**When to Reconsider Standard:**
- Application handles financial transactions
- Traffic grows beyond 1 Gbps sustained
- Compliance requirements mandate enhanced DDoS protection
- Experience DDoS attacks that impact availability
- Strict SLA requirements (99.99%+)

**Monitoring Approach:**
- Azure Monitor metrics for network traffic patterns
- Application Gateway metrics for request rates
- Quarterly security review to reassess DDoS requirements

## Network Monitoring

### Observability Stack

| Component | Purpose | Retention | Cost Estimate |
|-----------|---------|-----------|---------------|
| Log Analytics Workspace | Centralized logging | 90 days | ~$2/GB |
| NSG Flow Logs | Network traffic visibility | 90 days | ~$2/GB (~10-20 GB/month) |
| Network Watcher | Connection troubleshooting | N/A | Pay-per-use |
| Traffic Analytics | ML-based insights | Real-time | Included with flow logs |

### Key Metrics Monitored

**Network Performance:**
- Bytes in/out per subnet
- Packet drop rate
- Connection failures
- Latency between tiers

**Security Events:**
- Denied flows by NSG rules
- Port scan attempts
- Anomalous traffic patterns
- Geo-location of traffic sources

## Disaster Recovery Considerations

### Current State
- Single region deployment (East US)
- No cross-region VNet peering

### Future DR Strategy

**When implementing disaster recovery (Sprint 4+):**

1. **Secondary Region:** West US 2
2. **VNet Addressing:**
   - Primary: 10.0.0.0/16 (East US)
   - Secondary: 10.1.0.0/16 (West US 2)
3. **Connectivity:**
   - VNet peering between regions
   - Azure Traffic Manager for DNS-based failover
4. **Data Replication:**
   - Azure SQL geo-replication
   - Storage account GRS replication

## Hybrid Connectivity (Future)

Reserved for future on-premises integration:

### VPN Gateway Option
- **Gateway Subnet:** Use 10.0.5.0/27 (dedicated /27 for VPN Gateway)
- **SKU:** VpnGw2 (500 Mbps, $0.32/hour)
- **Use Case:** Secure access to on-premises identity systems

### ExpressRoute Option
- **Gateway Subnet:** Use 10.0.5.0/27 (same subnet works for both)
- **SKU:** Standard (1 Gbps, $730/month)
- **Use Case:** High-bandwidth, low-latency on-premises connectivity

## Security Best Practices Implemented

✅ **Network Segmentation**
- Dedicated subnets for gateway and application tiers
- NSGs enforcing least-privilege access

✅ **Defense in Depth**
- Application Gateway WAF (future) for Layer 7 protection
- NSG rules for Layer 4 filtering
- Private networking with VNet integration

✅ **Zero Trust Architecture**
- Default deny-all rules (Priority 4096)
- Explicit allow rules only for required traffic
- No direct internet access to app tier

✅ **Monitoring & Compliance**
- NSG flow logs with 90-day retention
- Traffic analytics for anomaly detection
- Integration with Log Analytics for SIEM

✅ **Cost Optimization**
- DDoS Basic (included) vs. Standard ($2,944/month)
- Right-sized subnets (251 IPs sufficient)
- 90-day log retention balances cost and compliance

## Compliance & Governance

### Azure Policy Alignment

The network configuration complies with common Azure Policy initiatives:

| Policy | Status | Implementation |
|--------|--------|----------------|
| NSG on subnets | ✅ Compliant | All subnets have NSG attached |
| NSG flow logs enabled | ✅ Compliant | Enabled with 90-day retention |
| VNet has DDoS protection | ✅ Compliant | Basic (included) enabled |
| Private networking | ✅ Compliant | No public IPs on app tier |

### Tagging Strategy

All network resources tagged with:
- **Environment:** Production
- **Application:** ChatOps
- **CostCenter:** IT-Operations
- **Owner:** ChatOps-Team
- **ManagedBy:** Terraform

## Operations Runbook

### Common Tasks

**View NSG Rules:**
```bash
az network nsg show --resource-group rg-chatops-prod --name app-nsg
```

**Test Connectivity:**
```bash
az network watcher test-connectivity \
  --resource-group rg-chatops-prod \
  --source-resource <app-service-id> \
  --dest-address <target-ip> \
  --dest-port 443
```

**Query Flow Logs:**
```kusto
AzureNetworkAnalytics_CL
| where SubType_s == "FlowLog"
| where TimeGenerated > ago(1h)
| where FlowStatus_s == "D" // Denied
| summarize count() by SrcIP_s, DestIP_s, DestPort_d
```

### Troubleshooting

**Issue: App Service cannot reach external API**
1. Check NSG rule `AllowInternetOutbound` is not disabled
2. Verify service endpoint or private endpoint configuration
3. Check application logs in Log Analytics

**Issue: High network latency**
1. Review Traffic Analytics for bandwidth utilization
2. Check for NSG rule conflicts causing packet drops
3. Verify Application Gateway health probes

## References

- [Azure Virtual Network documentation](https://learn.microsoft.com/azure/virtual-network/)
- [Azure NSG documentation](https://learn.microsoft.com/azure/virtual-network/network-security-groups-overview)
- [Azure DDoS Protection documentation](https://learn.microsoft.com/azure/ddos-protection/ddos-protection-overview)
- [Azure Well-Architected Framework](https://learn.microsoft.com/azure/architecture/framework/)
- [Terraform AzureRM Provider](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)

---

**Document Version:** 1.0  
**Last Updated:** 2024-12-29  
**Owner:** ChatOps Team  
**Review Cycle:** Quarterly
