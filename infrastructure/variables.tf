variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "location" {
  description = "Azure region for all resources"
  type        = string
  default     = "eastus2"

  validation {
    condition     = can(regex("^[a-z0-9]+$", var.location))
    error_message = "Location must be a valid Azure region name (e.g., eastus, westus2, eastus2)."
  }
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
  description = "The Object ID of the admin Entra ID group. When provided, grants the 'Key Vault Administrator' role for full Key Vault management capabilities. REQUIRED for production environment."
  type        = string
  default     = null

  validation {
    condition     = var.admin_group_object_id == null || can(regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", var.admin_group_object_id))
    error_message = "The admin_group_object_id must be a valid GUID format (e.g., 00000000-0000-0000-0000-000000000000)."
  }
}

variable "devops_sp_object_id" {
  description = "The Object ID of the DevOps service principal. When provided, grants the 'Key Vault Secrets Officer' role for managing secrets in CI/CD pipelines. REQUIRED for production environment."
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

# =============================================================================
# GitHub Actions Runner Variables
# =============================================================================

variable "github_repository" {
  description = "GitHub repository for runners (format: owner/repo)"
  type        = string
  default     = "your-org/chatops-teams"

  validation {
    condition     = can(regex("^[a-zA-Z0-9-]+/[a-zA-Z0-9-_.]+$", var.github_repository))
    error_message = "GitHub repository must be in format: owner/repo"
  }
}

variable "github_runner_cpu" {
  description = "CPU cores allocated to each GitHub runner container"
  type        = number
  default     = 2

  validation {
    condition     = var.github_runner_cpu >= 1 && var.github_runner_cpu <= 4
    error_message = "GitHub runner CPU must be between 1 and 4 cores"
  }
}

variable "github_runner_memory" {
  description = "Memory in GB allocated to each GitHub runner container"
  type        = number
  default     = 4

  validation {
    condition     = var.github_runner_memory >= 2 && var.github_runner_memory <= 16
    error_message = "GitHub runner memory must be between 2 and 16 GB"
  }
}

variable "github_runner_count" {
  description = "Number of GitHub runner instances to deploy"
  type        = number
  default     = 1

  validation {
    condition     = var.github_runner_count >= 0 && var.github_runner_count <= 10
    error_message = "GitHub runner count must be between 0 and 10"
  }
}

variable "github_runner_group" {
  description = "GitHub runner group name for organization-level runner grouping"
  type        = string
  default     = "Default"
}
