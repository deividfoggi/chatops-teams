# =============================================================================
# Azure Virtual Network Configuration
# =============================================================================
# This file defines the virtual network infrastructure for the ChatOps
# Teams application following Azure Well-Architected Framework principles.
# =============================================================================

# -----------------------------------------------------------------------------
# DDoS Protection Standard Evaluation
# -----------------------------------------------------------------------------
# Azure DDoS Protection Standard was evaluated for this deployment.
# 
# Cost Analysis:
#   - DDoS Protection Standard: $2,944/month (fixed cost per plan)
#   - DDoS Protection Basic: Included by default (no additional cost)
#
# Decision: Use DDoS Protection Basic (included by default)
#
# Rationale:
#   1. Cost Optimization: The $2,944/month cost is significant for this
#      workload and cannot be justified at the current scale.
#   2. Basic Protection Coverage: Azure's DDoS Basic protection provides
#      always-on traffic monitoring and automatic mitigation of common
#      network-layer attacks.
#   3. Future Consideration: DDoS Protection Standard should be evaluated
#      when the application handles sensitive financial data, has strict
#      SLA requirements, or experiences significant traffic growth.
#   4. Monitoring: We will monitor network traffic patterns and revisit
#      this decision during quarterly security reviews.
#
# To enable DDoS Protection Standard in the future, uncomment the ddos block
# and create the corresponding azurerm_network_ddos_protection_plan resource.
# ---------------------------------------------------------------------------

resource "azurerm_virtual_network" "chatops_vnet" {
  name                = "chatops-vnet"
  location            = azurerm_resource_group.chatops.location
  resource_group_name = azurerm_resource_group.chatops.name
  address_space       = ["10.0.0.0/16"]

  # DDoS Protection Standard (disabled - see rationale above)
  # ddos_protection_plan {
  #   id     = azurerm_network_ddos_protection_plan.chatops.id
  #   enable = true
  # }

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    CostCenter  = var.cost_center
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }
}

# =============================================================================
# Future DDoS Protection Standard Resource (commented out)
# =============================================================================
# Uncomment when DDoS Protection Standard is required:
#
# resource "azurerm_network_ddos_protection_plan" "chatops" {
#   name                = "chatops-ddos-plan"
#   location            = azurerm_resource_group.chatops.location
#   resource_group_name = azurerm_resource_group.chatops.name
#
#   tags = {
#     Environment = var.environment
#     Application = "ChatOps"
#     CostCenter  = var.cost_center
#     Owner       = var.owner
#     ManagedBy   = "Terraform"
#   }
# }
# =============================================================================
