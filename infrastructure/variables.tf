variable "environment" {
  description = "Environment name"
  type        = string
  default     = "Production"
}

variable "cost_center" {
  description = "Cost center for billing"
  type        = string
  default     = "IT-Operations"
}

variable "owner" {
  description = "Team owner"
  type        = string
  default     = "ChatOps-Team"
}

variable "security_alert_email" {
  description = "Email address for security alerts notifications"
  type        = string
  default     = "security-team@company.com"
}

# =============================================================================
# Key Vault RBAC Variables
# =============================================================================

variable "admin_group_object_id" {
  description = "The Object ID of the admin Entra ID group. When provided, grants the 'Key Vault Administrator' role for full Key Vault management capabilities."
  type        = string
  default     = null

  validation {
    condition     = var.admin_group_object_id == null || can(regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", var.admin_group_object_id))
    error_message = "The admin_group_object_id must be a valid GUID format (e.g., 00000000-0000-0000-0000-000000000000)."
  }
}

variable "devops_sp_object_id" {
  description = "The Object ID of the DevOps service principal. When provided, grants the 'Key Vault Secrets Officer' role for managing secrets in CI/CD pipelines."
  type        = string
  default     = null

  validation {
    condition     = var.devops_sp_object_id == null || can(regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", var.devops_sp_object_id))
    error_message = "The devops_sp_object_id must be a valid GUID format (e.g., 00000000-0000-0000-0000-000000000000)."
  }
}

variable "ops_team_email" {
  description = "Email address for operations team alert notifications"
  type        = string
  default     = "ops-team@company.com"
}
