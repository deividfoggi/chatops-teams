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
# Network Security Group Outputs
# =============================================================================

output "app_nsg_id" {
  description = "The resource ID of the app network security group"
  value       = azurerm_network_security_group.app_nsg.id
}

output "app_nsg_name" {
  description = "The name of the app network security group"
  value       = azurerm_network_security_group.app_nsg.name
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
