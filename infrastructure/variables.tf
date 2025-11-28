variable "environment" {
  description = "Environment name"
  type        = string
  default     = "Production"
}

variable "cost_center" {
  description = "Cost center for billing"
  type        = string
}

variable "owner" {
  description = "Team owner"
  type        = string
}

variable "security_alert_email" {
  description = "Email address for security alerts notifications"
  type        = string
  default     = "security-team@company.com"
}
