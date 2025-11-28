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
