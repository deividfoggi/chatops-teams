# Network Troubleshooting Guide

This document provides guidance for troubleshooting common network connectivity issues in the ChatOps Teams Azure infrastructure.

## Table of Contents

- [Common Connectivity Issues](#common-connectivity-issues)
- [NSG Flow Log Queries](#nsg-flow-log-queries)
- [Health Check Validation](#health-check-validation)
- [Diagnostic Tools](#diagnostic-tools)
- [Escalation Procedures](#escalation-procedures)

---

## Common Connectivity Issues

### Issue 1: Application Gateway Cannot Reach App Service

**Symptoms:**
- 502 Bad Gateway errors
- Health probe failures in Application Gateway
- Users unable to access the application

**Diagnostic Steps:**

1. **Verify NSG rules are correctly applied:**
   ```bash
   # Check NSG rules on app-subnet
   az network nsg rule list \
     --resource-group rg-chatops-prod \
     --nsg-name app-nsg \
     --output table
   ```

2. **Confirm the gateway subnet is allowed:**
   ```bash
   # Look for AllowGatewayInbound rule with source 10.0.2.0/24
   az network nsg rule show \
     --resource-group rg-chatops-prod \
     --nsg-name app-nsg \
     --name AllowGatewayInbound
   ```

3. **Check App Service VNet integration:**
   ```bash
   az webapp vnet-integration list \
     --resource-group rg-chatops-prod \
     --name <app-service-name>
   ```

**Resolution:**
- Ensure `AllowGatewayInbound` rule exists with source `10.0.2.0/24` and destination port `443`
- Verify App Service is integrated with `app-subnet`
- Check App Service is running and responding to health probes

---

### Issue 2: Application Gateway Health Probe Failures

**Symptoms:**
- Application Gateway shows unhealthy backend pool
- GatewayManager ports blocked error in Activity Log

**Diagnostic Steps:**

1. **Verify Gateway Manager rule exists:**
   ```bash
   az network nsg rule show \
     --resource-group rg-chatops-prod \
     --nsg-name gateway-nsg \
     --name AllowGatewayManager
   ```

2. **Check Application Gateway health:**
   ```bash
   az network application-gateway show-backend-health \
     --resource-group rg-chatops-prod \
     --name <app-gateway-name>
   ```

**Resolution:**
- Ensure `AllowGatewayManager` rule allows ports `65200-65535` from service tag `GatewayManager`
- This is an Azure requirement for Application Gateway v2

---

### Issue 3: App Service Cannot Connect to External APIs

**Symptoms:**
- Microsoft Graph API calls failing
- Teams Bot Framework connectivity errors
- Timeout errors in application logs

**Diagnostic Steps:**

1. **Check outbound NSG rules:**
   ```bash
   az network nsg rule list \
     --resource-group rg-chatops-prod \
     --nsg-name app-nsg \
     --query "[?direction=='Outbound']" \
     --output table
   ```

2. **Verify outbound connectivity from App Service:**
   ```bash
   # Using App Service Kudu console
   curl -I https://graph.microsoft.com/v1.0
   curl -I https://login.microsoftonline.com
   ```

**Resolution:**
- Verify `AllowInternetOutbound` rule exists with destination `Internet` and port `443`
- Check if any Azure Firewall or UDR is blocking outbound traffic

---

### Issue 4: VNet Peering Connectivity (DR Scenario)

**Symptoms:**
- Cannot reach resources in peered VNet
- Cross-region private endpoint resolution failing

**Diagnostic Steps:**

1. **Check peering status:**
   ```bash
   az network vnet peering list \
     --resource-group rg-chatops-prod \
     --vnet-name chatops-vnet \
     --output table
   ```

2. **Verify peering state is "Connected":**
   ```bash
   az network vnet peering show \
     --resource-group rg-chatops-prod \
     --vnet-name chatops-vnet \
     --name <peering-name> \
     --query "peeringState"
   ```

**Resolution:**
- Ensure peering is initiated from both VNets
- Verify address spaces don't overlap (10.0.0.0/16 vs 10.1.0.0/16)
- Check that "Allow Gateway Transit" and "Use Remote Gateways" are configured correctly

---

## NSG Flow Log Queries

Use these Kusto queries in Azure Log Analytics to analyze network traffic.

### Query 1: Denied Traffic Analysis

Identify blocked traffic to troubleshoot connectivity issues:

```kusto
AzureNetworkAnalytics_CL
| where TimeGenerated > ago(1h)
| where FlowStatus_s == "D"  // Denied
| summarize Count=count() by 
    SrcIP_s, 
    DestIP_s, 
    DestPort_d, 
    NSGRule_s
| order by Count desc
| take 20
```

### Query 2: Traffic from Gateway to App Subnet

Verify Application Gateway traffic is flowing correctly:

```kusto
AzureNetworkAnalytics_CL
| where TimeGenerated > ago(1h)
| where SrcIP_s startswith "10.0.2."  // Gateway subnet
| where DestIP_s startswith "10.0.1." // App subnet
| summarize 
    AllowedCount = countif(FlowStatus_s == "A"),
    DeniedCount = countif(FlowStatus_s == "D")
    by bin(TimeGenerated, 5m)
| render timechart
```

### Query 3: Internet Inbound Traffic to Gateway

Monitor public traffic reaching the Application Gateway:

```kusto
AzureNetworkAnalytics_CL
| where TimeGenerated > ago(24h)
| where FlowDirection_s == "I"  // Inbound
| where DestIP_s startswith "10.0.2."  // Gateway subnet
| where DestPort_d == 443
| summarize RequestCount = count() by bin(TimeGenerated, 1h)
| render timechart
```

### Query 4: Outbound API Traffic from App Subnet

Monitor external API calls from the application:

```kusto
AzureNetworkAnalytics_CL
| where TimeGenerated > ago(1h)
| where SrcIP_s startswith "10.0.1."  // App subnet
| where FlowDirection_s == "O"  // Outbound
| summarize 
    TotalRequests = count(),
    AllowedRequests = countif(FlowStatus_s == "A"),
    DeniedRequests = countif(FlowStatus_s == "D")
    by DestPort_d
| order by TotalRequests desc
```

### Query 5: Top Denied Source IPs (Security Monitoring)

Identify potential threats or misconfigurations:

```kusto
AzureNetworkAnalytics_CL
| where TimeGenerated > ago(24h)
| where FlowStatus_s == "D"
| summarize 
    DeniedAttempts = count(),
    TargetPorts = make_set(DestPort_d)
    by SrcIP_s
| order by DeniedAttempts desc
| take 10
```

### Query 6: NSG Rule Hit Count

Verify NSG rules are being matched as expected:

```kusto
AzureNetworkAnalytics_CL
| where TimeGenerated > ago(7d)
| summarize HitCount = count() by NSGRule_s, FlowStatus_s
| order by HitCount desc
```

---

## Health Check Validation

### Application Gateway Health Check

1. **Check backend health status:**
   ```bash
   az network application-gateway show-backend-health \
     --resource-group rg-chatops-prod \
     --name <app-gateway-name> \
     --output table
   ```

2. **Expected output:**
   - Backend server status: `Healthy`
   - HTTP response code: `200-399`

### App Service Health Check

1. **Test application health endpoint:**
   ```bash
   # Direct App Service endpoint (requires VNet access)
   curl -v https://<app-service-name>.azurewebsites.net/health
   
   # Via Application Gateway (public)
   curl -v https://<public-domain>/health
   ```

2. **Check App Service diagnostics:**
   ```bash
   az webapp log tail \
     --resource-group rg-chatops-prod \
     --name <app-service-name>
   ```

### Network Watcher Connectivity Check

Use Network Watcher to test connectivity between resources:

```bash
# Test connectivity from App Service to external endpoint
az network watcher test-connectivity \
  --resource-group rg-chatops-prod \
  --source-resource <app-service-resource-id> \
  --dest-address graph.microsoft.com \
  --dest-port 443
```

### DNS Resolution Check

Verify private DNS resolution for private endpoints:

```bash
# From within the VNet (e.g., via Cloud Shell or jump server)
nslookup <storage-account>.blob.core.windows.net
nslookup <key-vault>.vault.azure.net
nslookup <sql-server>.database.windows.net
```

---

## Diagnostic Tools

### Azure Network Watcher

| Tool | Use Case |
|------|----------|
| **IP Flow Verify** | Check if traffic is allowed/denied by NSG |
| **Next Hop** | Determine routing path for packets |
| **Connection Troubleshoot** | Test TCP connectivity between resources |
| **NSG Flow Logs** | Analyze historical traffic patterns |
| **Traffic Analytics** | Visual network traffic analysis |

### Example: IP Flow Verify

```bash
az network watcher test-ip-flow \
  --resource-group rg-chatops-prod \
  --vm <vm-name> \
  --direction Inbound \
  --protocol TCP \
  --local "10.0.1.4:443" \
  --remote "10.0.2.5:50000"
```

### Azure CLI Network Commands

```bash
# List all NSGs in resource group
az network nsg list \
  --resource-group rg-chatops-prod \
  --output table

# Show effective security rules for a NIC
az network nic list-effective-nsg \
  --resource-group rg-chatops-prod \
  --name <nic-name>

# Show route table entries
az network route-table list \
  --resource-group rg-chatops-prod \
  --output table
```

---

## Escalation Procedures

### Level 1: Self-Service Troubleshooting

1. Check NSG rules using Azure Portal or CLI
2. Review NSG flow logs in Log Analytics
3. Verify Application Gateway health
4. Check App Service VNet integration

### Level 2: Cloud Operations Team

Escalate to Cloud Ops if:
- NSG rules appear correct but traffic is still blocked
- Application Gateway shows intermittent failures
- VNet peering connectivity issues
- Performance degradation issues

**Required Information:**
- Time range of the issue
- Source and destination IPs
- Relevant Log Analytics query results
- Screenshot of Application Gateway backend health

### Level 3: Azure Support

Open Azure Support ticket if:
- Azure service outage suspected
- Network Watcher tools show unexpected behavior
- DDoS attack suspected
- Issues persist after Cloud Ops troubleshooting

**Support Ticket Information:**
- Subscription ID
- Resource group name
- Affected resource names
- Correlation IDs from Azure Activity Log
- NSG flow log exports

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-28  
**Maintained by:** Cloud Operations Team  
**Review Frequency:** Quarterly
