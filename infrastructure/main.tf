terraform {
  required_version = ">= 1.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.58"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  backend "azurerm" {
    # Configure Azure Storage backend for state
    # Replace [uniqueid] with a unique suffix (e.g., organization abbreviation or random string)
    # Storage account names must be globally unique, 3-24 characters, lowercase letters and numbers only
    resource_group_name  = "rg-terraform-state-chatops"
    storage_account_name = "stterraformchatops19932"
    container_name       = "tfstate"
    key                  = "chatops.tfstate"
    use_azuread_auth     = true
  }
}

provider "azurerm" {
  features {}

  # Configure storage account data plane to use Entra ID authentication
  # Required when storage accounts have shared_access_key_enabled = false
  storage_use_azuread = true
}

# Validate production environment requirements
resource "terraform_data" "validate_production_rbac" {
  lifecycle {
    precondition {
      condition     = var.environment != "prod" || (var.admin_group_object_id != null && var.devops_sp_object_id != null)
      error_message = "Production environment requires both admin_group_object_id and devops_sp_object_id to be set for proper Key Vault RBAC configuration."
    }
  }
}

data "azurerm_client_config" "current" {}

resource "azurerm_resource_group" "chatops" {
  name     = "rg-chatops-${var.environment}"
  location = var.location

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    CostCenter  = var.cost_center
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }
}

resource "azurerm_log_analytics_workspace" "chatops" {
  name                = "chatops-loganalytics"
  location            = azurerm_resource_group.chatops.location
  resource_group_name = azurerm_resource_group.chatops.name
  retention_in_days   = 90
  sku                 = "PerGB2018"

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    ManagedBy   = "Terraform"
  }
}
