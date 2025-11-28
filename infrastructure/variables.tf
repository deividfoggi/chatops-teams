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
