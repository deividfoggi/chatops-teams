# =============================================================================
# Production Environment Configuration
# =============================================================================
# This file contains Terraform variable values for the production environment.
# Update these values according to your production environment requirements.
# =============================================================================

# Environment Configuration
environment = "prod"
location    = "eastus"

# Organizational Tags
cost_center = "IT-Operations-Production"
owner       = "ChatOps-Team"

# Alert Configuration
security_alert_email = "security-team@company.com"
ops_team_email       = "ops-team@company.com"

# Key Vault RBAC Configuration
# Set these to the Object IDs from your Azure AD tenant
# To find Object IDs:
#   - Admin group: az ad group show --group "ChatOps-Admins" --query id -o tsv
#   - DevOps SP: az ad sp show --id <app-id> --query id -o tsv
# IMPORTANT: These should be set for production to ensure proper access control
admin_group_object_id = null # REQUIRED: Replace with your admin group Object ID
devops_sp_object_id   = null # REQUIRED: Replace with your DevOps service principal Object ID
