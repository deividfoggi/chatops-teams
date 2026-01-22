# =============================================================================
# Development Environment Configuration
# =============================================================================
# This file contains Terraform variable values for the development environment.
# Update these values according to your development environment requirements.
# =============================================================================

# Environment Configuration
environment = "dev"
location    = "eastus2"

# Organizational Tags
cost_center = "IT-Operations-Dev"
owner       = "ChatOps-DevTeam"

# Alert Configuration
security_alert_email = "security-team-dev@company.com"
ops_team_email       = "ops-team-dev@company.com"

# Key Vault RBAC Configuration
# Set these to the Object IDs from your Azure AD tenant
# To find Object IDs:
#   - Admin group: az ad group show --group "ChatOps-Admins-Dev" --query id -o tsv
#   - DevOps SP: az ad sp show --id <app-id> --query id -o tsv
admin_group_object_id = null # Replace with your admin group Object ID
devops_sp_object_id   = null # Replace with your DevOps service principal Object ID
