# Key Vault Alert Runbook

This document provides response procedures for Azure Key Vault security alerts in the ChatOps Teams application. Each section outlines the alert details, investigation steps, and remediation actions.

## Table of Contents

- [Failed Authentication Alert](#failed-authentication-alert)
- [Secret Access Anomaly Alert](#secret-access-anomaly-alert)
- [Secret Expiration Alert](#secret-expiration-alert)

---

## Failed Authentication Alert

### Alert Details

| Property | Value |
|----------|-------|
| Alert Name | kv-failed-authentication-alert |
| Severity | 2 (Warning) |
| Threshold | >5 failed attempts in 15 minutes |
| Evaluation Frequency | Every 5 minutes |

### Description

This alert triggers when multiple failed authentication attempts are detected against the Key Vault. This pattern may indicate:

- Brute-force attacks attempting to guess credentials
- Credential stuffing attacks using compromised credentials
- Misconfigured applications with incorrect credentials
- Expired or revoked service principal credentials

### Investigation Steps

1. **Identify the Source**
   - Navigate to Azure Portal > Log Analytics workspace
   - Run the following query to identify the source IP and identity:
     ```kusto
     AzureDiagnostics
     | where ResourceType == "VAULTS"
     | where ResultSignature == "Unauthorized" or ResultSignature == "Forbidden" or httpStatusCode_d >= 400
     | where TimeGenerated > ago(1h)
     | project TimeGenerated, CallerIPAddress, identity_claim_upn_s, identity_claim_oid_g, OperationName, ResultSignature
     | order by TimeGenerated desc
     ```

2. **Correlate with Known Sources**
   - Compare the source IP addresses with known application IPs
   - Check if the identity matches legitimate service principals or users
   - Review recent changes to application configurations

3. **Assess Impact**
   - Determine if any successful authentications followed the failed attempts
   - Check if the failing identity has elevated permissions

### Remediation Actions

| Scenario | Action |
|----------|--------|
| Unknown external IP | Block IP in network security groups and Key Vault firewall |
| Legitimate application with wrong credentials | Update the application with correct credentials |
| Compromised service principal | Rotate service principal credentials immediately |
| Expired credentials | Renew credentials and update applications |
| Brute-force attack confirmed | Enable conditional access policies, consider Azure AD Identity Protection |

### Post-Incident Actions

1. Document the incident in the security incident log
2. Update Key Vault network ACLs if necessary
3. Review and strengthen access policies
4. Consider enabling Azure Defender for Key Vault for advanced threat detection

---

## Secret Access Anomaly Alert

### Alert Details

| Property | Value |
|----------|-------|
| Alert Name | kv-secret-access-anomaly-alert |
| Severity | 1 (Error) |
| Threshold | >100 accesses from single IP in 1 hour |
| Evaluation Frequency | Every 1 hour |

### Description

This alert triggers when an unusually high number of secret access operations are detected from a single IP address. This pattern may indicate:

- Data exfiltration attempts
- Compromised application credentials
- Malicious insider activity
- Automated scanning or enumeration

### Investigation Steps

1. **Identify the Accessor**
   - Navigate to Azure Portal > Log Analytics workspace
   - Run the following query:
     ```kusto
     AzureDiagnostics
     | where ResourceType == "VAULTS"
     | where OperationName in ("SecretGet", "SecretList")
     | where TimeGenerated > ago(2h)
     | summarize AccessCount = count(), Secrets = make_set(id_s) by CallerIPAddress, identity_claim_upn_s
     | order by AccessCount desc
     ```

2. **Review Access Patterns**
   - Determine which specific secrets were accessed
   - Compare with normal baseline access patterns
   - Check if the accessor has legitimate need for this access level

3. **Cross-Reference with Application Logs**
   - Review Application Insights for corresponding application activity
   - Check if there are deployment events that could explain increased access

### Remediation Actions

| Scenario | Action |
|----------|--------|
| Compromised credentials | Immediately rotate the affected secrets and revoke access |
| Malicious actor | Block the IP address, rotate all accessed secrets |
| Application bug causing excessive calls | Fix the application and implement caching |
| Legitimate automation | Update alert threshold or add exception |

### Immediate Response Checklist

- [ ] Identify the source IP and identity
- [ ] Determine if access is authorized
- [ ] If unauthorized, block the IP immediately
- [ ] Rotate any potentially compromised secrets
- [ ] Notify affected application owners
- [ ] Preserve logs for forensic analysis

### Post-Incident Actions

1. Conduct a thorough security review
2. Implement additional access controls (Just-In-Time access)
3. Consider implementing Azure Private Link for Key Vault
4. Review and implement secret access quotas

---

## Secret Expiration Alert

### Alert Details

| Property | Value |
|----------|-------|
| Alert Name | kv-secret-expiration-alert |
| Severity | 3 (Informational) |
| Threshold | Any near-expiry or expired item events detected |
| Evaluation Frequency | Daily |

### Description

This alert triggers when Azure Key Vault emits SecretNearExpiry, SecretExpired, KeyNearExpiry, KeyExpired, CertificateNearExpiry, or CertificateExpired events. These events are automatically generated by Key Vault when items approach their configured expiration dates.

**Note:** For this alert to function, secrets, keys, and certificates must have expiration dates configured. Azure Key Vault typically emits "NearExpiry" events 30 days before expiration.

### Investigation Steps

1. **Identify Expiring Items**
   - Navigate to Azure Portal > Key Vault > Secrets/Keys/Certificates
   - Filter by expiration date to identify items expiring soon
   - Alternatively, use Azure CLI:
     ```bash
     az keyvault secret list --vault-name <vault-name> --query "[?attributes.expires != null]" --output table
     ```

2. **Determine Item Owners**
   - Review item metadata and tags for owner information
   - Cross-reference with application documentation
   - Check recent access logs to identify consuming applications

3. **Assess Impact**
   - Identify all applications using the expiring secrets
   - Determine criticality of affected applications
   - Plan rotation schedule based on business impact

### Remediation Actions

#### For Secrets with Defined Owners

1. Notify the secret owner 30 days before expiration
2. Coordinate rotation with the application team
3. Generate new secret value
4. Update all consuming applications
5. Verify application functionality
6. Remove old secret version after confirmation

#### For Secrets Without Defined Owners

1. Review access logs to identify consuming applications
2. Contact application teams to determine ownership
3. Update secret metadata with owner information
4. Follow standard rotation procedure

### Secret Rotation Checklist

- [ ] Identify all applications using the secret
- [ ] Generate new secret value
- [ ] Create new secret version in Key Vault
- [ ] Update application configurations (in order of criticality)
- [ ] Verify each application is using the new secret
- [ ] Monitor for errors after rotation
- [ ] Disable old secret version
- [ ] Update expiration date on new version
- [ ] Document the rotation in change management system

### Best Practices for Secret Management

1. **Automate Rotation**: Use Azure Key Vault's automatic rotation feature where supported
2. **Set Expiration Dates**: Always set expiration dates on secrets
3. **Use Managed Identities**: Prefer managed identities over secrets where possible
4. **Tag Secrets**: Add owner and application tags to all secrets
5. **Monitor Access**: Regularly review secret access patterns
6. **Document Dependencies**: Maintain documentation of secret-to-application mappings

---

## Contact Information

| Role | Contact |
|------|---------|
| Security Team | security-team@company.com |
| Platform Team | platform-team@company.com |
| On-Call Engineer | Check PagerDuty escalation policy |

## Related Documentation

- [Azure Key Vault Best Practices](https://docs.microsoft.com/azure/key-vault/general/best-practices)
- [Azure Monitor Alerts](https://docs.microsoft.com/azure/azure-monitor/alerts/alerts-overview)
- [Key Vault Logging](https://docs.microsoft.com/azure/key-vault/general/logging)
