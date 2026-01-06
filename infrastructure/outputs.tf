output "resource_group_name" {
  description = "The name of the resource group"
  value       = azurerm_resource_group.chatops.name
}

output "log_analytics_workspace_id" {
  description = "The resource ID of the Log Analytics workspace"
  value       = azurerm_log_analytics_workspace.chatops.id
}

output "log_analytics_workspace_customer_id" {
  description = "The workspace (customer) ID of the Log Analytics workspace"
  value       = azurerm_log_analytics_workspace.chatops.workspace_id
  sensitive   = true
}

# =============================================================================
# Virtual Network Outputs
# =============================================================================

output "vnet_name" {
  description = "The name of the virtual network"
  value       = azurerm_virtual_network.chatops_vnet.name
}

output "vnet_id" {
  description = "The resource ID of the virtual network"
  value       = azurerm_virtual_network.chatops_vnet.id
}

output "vnet_address_space" {
  description = "The address space of the virtual network"
  value       = azurerm_virtual_network.chatops_vnet.address_space
}

# =============================================================================
# Gateway Subnet Outputs
# =============================================================================

output "gateway_subnet_id" {
  description = "The resource ID of the gateway subnet"
  value       = azurerm_subnet.gateway_subnet.id
}

output "gateway_subnet_name" {
  description = "The name of the gateway subnet"
  value       = azurerm_subnet.gateway_subnet.name
}

output "gateway_subnet_address_prefixes" {
  description = "The address prefixes of the gateway subnet"
  value       = azurerm_subnet.gateway_subnet.address_prefixes
}

# =============================================================================
# App Subnet Outputs
# =============================================================================

output "app_subnet_id" {
  description = "The resource ID of the app subnet"
  value       = azurerm_subnet.app_subnet.id
}

output "app_subnet_name" {
  description = "The name of the app subnet"
  value       = azurerm_subnet.app_subnet.name
}

output "app_subnet_address_prefixes" {
  description = "The address prefixes of the app subnet"
  value       = azurerm_subnet.app_subnet.address_prefixes
}

# =============================================================================
# GitHub Runners Subnet Outputs
# =============================================================================

output "github_runners_subnet_id" {
  description = "The resource ID of the GitHub runners subnet"
  value       = azurerm_subnet.github_runners_subnet.id
}

output "github_runners_subnet_name" {
  description = "The name of the GitHub runners subnet"
  value       = azurerm_subnet.github_runners_subnet.name
}

output "github_runners_subnet_address_prefixes" {
  description = "The address prefixes of the GitHub runners subnet"
  value       = azurerm_subnet.github_runners_subnet.address_prefixes
}

# =============================================================================
# Network Security Group Outputs
# =============================================================================

output "gateway_nsg_id" {
  description = "The resource ID of the gateway network security group"
  value       = azurerm_network_security_group.gateway_nsg.id
}

output "gateway_nsg_name" {
  description = "The name of the gateway network security group"
  value       = azurerm_network_security_group.gateway_nsg.name
}

output "app_nsg_id" {
  description = "The resource ID of the app network security group"
  value       = azurerm_network_security_group.app_nsg.id
}

output "app_nsg_name" {
  description = "The name of the app network security group"
  value       = azurerm_network_security_group.app_nsg.name
}

output "github_runners_nsg_id" {
  description = "The resource ID of the GitHub runners network security group"
  value       = azurerm_network_security_group.github_runners_nsg.id
}

output "github_runners_nsg_name" {
  description = "The name of the GitHub runners network security group"
  value       = azurerm_network_security_group.github_runners_nsg.name
}

# =============================================================================
# Application Insights Outputs
# =============================================================================

output "application_insights_instrumentation_key" {
  description = "The instrumentation key for Application Insights"
  value       = azurerm_application_insights.chatops.instrumentation_key
  sensitive   = true
}

output "application_insights_connection_string" {
  description = "The connection string for Application Insights"
  value       = azurerm_application_insights.chatops.connection_string
  sensitive   = true
}

output "application_insights_id" {
  description = "The resource ID of Application Insights"
  value       = azurerm_application_insights.chatops.id
}

output "application_insights_app_id" {
  description = "The App ID of Application Insights"
  value       = azurerm_application_insights.chatops.app_id
}

# =============================================================================
# Key Vault Outputs
# =============================================================================

output "key_vault_id" {
  description = "The resource ID of the Key Vault"
  value       = azurerm_key_vault.chatops.id
}

output "key_vault_name" {
  description = "The name of the Key Vault"
  value       = azurerm_key_vault.chatops.name
}

output "key_vault_uri" {
  description = "The URI of the Key Vault"
  value       = azurerm_key_vault.chatops.vault_uri
}

# =============================================================================
# Key Vault RBAC Role Assignment Outputs
# =============================================================================

output "key_vault_admin_role_assignment_id" {
  description = "The resource ID of the Key Vault Administrator role assignment (null if not created)"
  value       = length(azurerm_role_assignment.kv_admin) > 0 ? azurerm_role_assignment.kv_admin[0].id : null
}

output "key_vault_secrets_officer_role_assignment_id" {
  description = "The resource ID of the Key Vault Secrets Officer role assignment (null if not created)"
  value       = length(azurerm_role_assignment.kv_secrets_officer) > 0 ? azurerm_role_assignment.kv_secrets_officer[0].id : null
}

# =============================================================================
# Key Vault Alerting Outputs
# =============================================================================

output "security_alerts_action_group_id" {
  description = "The resource ID of the security alerts action group"
  value       = azurerm_monitor_action_group.security_alerts.id
}

output "kv_failed_auth_alert_id" {
  description = "The resource ID of the Key Vault failed authentication alert"
  value       = azurerm_monitor_scheduled_query_rules_alert_v2.kv_failed_auth.id
}

output "kv_secret_access_anomaly_alert_id" {
  description = "The resource ID of the Key Vault secret access anomaly alert"
  value       = azurerm_monitor_scheduled_query_rules_alert_v2.kv_secret_access_anomaly.id
}

output "kv_secret_expiration_alert_id" {
  description = "The resource ID of the Key Vault secret expiration alert"
  value       = azurerm_monitor_scheduled_query_rules_alert_v2.kv_secret_expiration.id
}

# =============================================================================
# Application Insights Availability Test Outputs
# =============================================================================

output "availability_test_eastus_id" {
  description = "The resource ID of the East US availability test"
  value       = azurerm_application_insights_standard_web_test.chatops_eastus.id
}

output "availability_test_westus_id" {
  description = "The resource ID of the West US availability test"
  value       = azurerm_application_insights_standard_web_test.chatops_westus.id
}

output "availability_test_northeurope_id" {
  description = "The resource ID of the North Europe availability test"
  value       = azurerm_application_insights_standard_web_test.chatops_northeurope.id
}

output "availability_test_southeastasia_id" {
  description = "The resource ID of the Southeast Asia availability test"
  value       = azurerm_application_insights_standard_web_test.chatops_southeastasia.id
}

output "availability_test_australiaeast_id" {
  description = "The resource ID of the Australia East availability test"
  value       = azurerm_application_insights_standard_web_test.chatops_australiaeast.id
}

output "availability_test_failure_alert_id" {
  description = "The resource ID of the availability test failure alert"
  value       = azurerm_monitor_scheduled_query_rules_alert_v2.availability_test_failure.id
}

# =============================================================================
# Application Gateway Outputs
# =============================================================================

output "application_gateway_id" {
  description = "The resource ID of the Application Gateway"
  value       = azurerm_application_gateway.chatops.id
}

output "application_gateway_name" {
  description = "The name of the Application Gateway"
  value       = azurerm_application_gateway.chatops.name
}

output "application_gateway_public_ip_address" {
  description = "The public IP address of the Application Gateway"
  value       = azurerm_public_ip.appgw.ip_address
}

output "application_gateway_public_ip_fqdn" {
  description = "The fully qualified domain name of the Application Gateway public IP"
  value       = azurerm_public_ip.appgw.fqdn
}

output "application_gateway_backend_pool_id" {
  description = "The ID of the Application Gateway backend address pool"
  value       = length(azurerm_application_gateway.chatops.backend_address_pool) > 0 ? tolist(azurerm_application_gateway.chatops.backend_address_pool)[0].id : null
}

# =============================================================================
# WAF Policy Outputs
# =============================================================================

output "waf_policy_id" {
  description = "The resource ID of the Web Application Firewall policy"
  value       = azurerm_web_application_firewall_policy.chatops.id
}

output "waf_policy_name" {
  description = "The name of the Web Application Firewall policy"
  value       = azurerm_web_application_firewall_policy.chatops.name
}

# =============================================================================
# Key Vault Secrets Outputs
# =============================================================================
# These outputs provide references to secrets stored in Key Vault.
# Secret IDs can be used in App Service configuration for Key Vault references.
# =============================================================================

output "appinsights_connection_string_secret_id" {
  description = "The Key Vault secret ID for Application Insights connection string"
  value       = azurerm_key_vault_secret.appinsights_connection_string.id
}

output "github_webhook_secret_id" {
  description = "The Key Vault secret ID for GitHub webhook secret"
  value       = azurerm_key_vault_secret.github_webhook_secret.id
}

output "github_app_id_secret_id" {
  description = "The Key Vault secret ID for GitHub App ID"
  value       = azurerm_key_vault_secret.github_app_id.id
}

output "github_app_private_key_secret_id" {
  description = "The Key Vault secret ID for GitHub App private key"
  value       = azurerm_key_vault_secret.github_app_private_key.id
}

output "bot_app_id_secret_id" {
  description = "The Key Vault secret ID for Bot Application ID"
  value       = azurerm_key_vault_secret.bot_app_id.id
}

output "bot_app_password_secret_id" {
  description = "The Key Vault secret ID for Bot Application Password"
  value       = azurerm_key_vault_secret.bot_app_password.id
}

output "entra_client_secret_secret_id" {
  description = "The Key Vault secret ID for Entra ID client secret"
  value       = azurerm_key_vault_secret.entra_client_secret.id
}

# =============================================================================
# Redis Cache Outputs
# =============================================================================

output "redis_cache_id" {
  description = "The resource ID of the Azure Cache for Redis"
  value       = azurerm_redis_cache.chatops.id
}

output "redis_cache_name" {
  description = "The name of the Azure Cache for Redis"
  value       = azurerm_redis_cache.chatops.name
}

output "redis_cache_hostname" {
  description = "The hostname of the Azure Cache for Redis"
  value       = azurerm_redis_cache.chatops.hostname
}

output "redis_cache_ssl_port" {
  description = "The SSL port of the Azure Cache for Redis"
  value       = azurerm_redis_cache.chatops.ssl_port
}

output "redis_cache_primary_access_key" {
  description = "The primary access key for the Azure Cache for Redis"
  value       = azurerm_redis_cache.chatops.primary_access_key
  sensitive   = true
}

output "redis_subnet_id" {
  description = "The resource ID of the Redis subnet"
  value       = azurerm_subnet.redis_subnet.id
}

output "redis_host_secret_id" {
  description = "The Key Vault secret ID for Redis host"
  value       = azurerm_key_vault_secret.redis_host.id
}

output "redis_port_secret_id" {
  description = "The Key Vault secret ID for Redis port"
  value       = azurerm_key_vault_secret.redis_port.id
}

output "redis_access_key_secret_id" {
  description = "The Key Vault secret ID for Redis access key"
  value       = azurerm_key_vault_secret.redis_access_key.id
}

# =============================================================================
# App Service Plan Outputs
# =============================================================================

output "app_service_plan_id" {
  description = "The resource ID of the App Service Plan"
  value       = azurerm_service_plan.chatops.id
}

output "app_service_plan_name" {
  description = "The name of the App Service Plan"
  value       = azurerm_service_plan.chatops.name
}

# =============================================================================
# App Service Outputs
# =============================================================================

output "app_service_id" {
  description = "The resource ID of the App Service"
  value       = azurerm_linux_web_app.chatops.id
}

output "app_service_name" {
  description = "The name of the App Service"
  value       = azurerm_linux_web_app.chatops.name
}

output "app_service_default_hostname" {
  description = "The default hostname of the App Service"
  value       = azurerm_linux_web_app.chatops.default_hostname
}

output "app_service_url" {
  description = "The full URL of the App Service"
  value       = "https://${azurerm_linux_web_app.chatops.default_hostname}"
}

output "app_service_identity_principal_id" {
  description = "The principal ID of the App Service managed identity"
  # Using try() to safely access identity block in case the identity configuration is changed
  # or the App Service is recreated without identity during deployment
  value = try(azurerm_linux_web_app.chatops.identity[0].principal_id, null)
}

output "app_service_identity_tenant_id" {
  description = "The tenant ID of the App Service managed identity"
  # Using try() to safely access identity block in case the identity configuration is changed
  # or the App Service is recreated without identity during deployment
  value = try(azurerm_linux_web_app.chatops.identity[0].tenant_id, null)
}
