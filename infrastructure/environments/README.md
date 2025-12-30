# Environment Configuration Files

This directory contains environment-specific Terraform variable files for the ChatOps Teams infrastructure.

## Files

- **`dev.tfvars`** - Development environment configuration
- **`staging.tfvars`** - Staging environment configuration  
- **`prod.tfvars`** - Production environment configuration

## Usage

When running Terraform commands, specify the appropriate variable file for your target environment:

```bash
# Development
terraform plan -var-file="environments/dev.tfvars" -out=tfplan
terraform apply tfplan

# Staging
terraform plan -var-file="environments/staging.tfvars" -out=tfplan
terraform apply tfplan

# Production
terraform plan -var-file="environments/prod.tfvars" -out=tfplan
terraform apply tfplan
```

## Configuration

Each environment file contains the following variables:

- **`environment`** - Environment name (dev, staging, prod)
- **`location`** - Azure region for resource deployment
- **`cost_center`** - Cost center tag for billing allocation
- **`owner`** - Team owner tag
- **`security_alert_email`** - Email for security alert notifications
- **`ops_team_email`** - Email for operations team notifications
- **`admin_group_object_id`** - Object ID of admin Azure AD group for Key Vault access
- **`devops_sp_object_id`** - Object ID of DevOps service principal for Key Vault access

## Finding Object IDs

To find Object IDs for Azure AD resources:

```bash
# Admin group Object ID
az ad group show --group "ChatOps-Admins" --query id -o tsv

# Service Principal Object ID (using application/client ID)
az ad sp show --id <application-id> --query id -o tsv
```

## Security Notes

- These files are tracked in Git but should NOT contain sensitive values
- Object IDs are safe to store in Git (they're not secrets)
- Update the placeholder email addresses with your actual team emails
- For production, ensure all Object IDs are configured before deployment
