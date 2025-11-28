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
