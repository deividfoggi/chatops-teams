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
# ----------------------------------------------------------------------------

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

# =============================================================================
# Gateway Subnet Configuration
# =============================================================================
# This subnet is used for Application Gateway or VPN Gateway resources.
# The /24 CIDR provides 256 addresses which is sufficient for gateway scaling.
# =============================================================================

resource "azurerm_subnet" "gateway_subnet" {
  name                 = "gateway-subnet"
  resource_group_name  = azurerm_resource_group.chatops.name
  virtual_network_name = azurerm_virtual_network.chatops_vnet.name
  address_prefixes     = ["10.0.2.0/24"]
}

# =============================================================================
# Gateway Network Security Group
# =============================================================================
# NSG for gateway subnet to control inbound and outbound traffic.
# =============================================================================

resource "azurerm_network_security_group" "gateway_nsg" {
  name                = "gateway-nsg"
  location            = azurerm_resource_group.chatops.location
  resource_group_name = azurerm_resource_group.chatops.name

  tags = {
    Environment = "Production"
    Application = "ChatOps"
    ManagedBy   = "Terraform"
  }
}

# -----------------------------------------------------------------------------
# NSG Rule: Allow HTTPS Inbound
# -----------------------------------------------------------------------------
# Allows HTTPS traffic from the internet for secure web access.
# -----------------------------------------------------------------------------

resource "azurerm_network_security_rule" "allow_https_inbound" {
  name                        = "AllowHTTPSInbound"
  priority                    = 100
  direction                   = "Inbound"
  access                      = "Allow"
  protocol                    = "Tcp"
  source_port_range           = "*"
  destination_port_range      = "443"
  source_address_prefix       = "Internet"
  destination_address_prefix  = "*"
  resource_group_name         = azurerm_resource_group.chatops.name
  network_security_group_name = azurerm_network_security_group.gateway_nsg.name
}

# -----------------------------------------------------------------------------
# NSG Rule: Allow Gateway Manager
# -----------------------------------------------------------------------------
# Required for Azure Application Gateway v2 health probes and management.
# Azure Gateway Manager service tag requires access to ports 65200-65535.
# -----------------------------------------------------------------------------

resource "azurerm_network_security_rule" "allow_gateway_manager" {
  name                        = "AllowGatewayManager"
  priority                    = 110
  direction                   = "Inbound"
  access                      = "Allow"
  protocol                    = "Tcp"
  source_port_range           = "*"
  destination_port_range      = "65200-65535"
  source_address_prefix       = "GatewayManager"
  destination_address_prefix  = "*"
  resource_group_name         = azurerm_resource_group.chatops.name
  network_security_group_name = azurerm_network_security_group.gateway_nsg.name
}

# -----------------------------------------------------------------------------
# Gateway Subnet - NSG Association
# -----------------------------------------------------------------------------
# Associates the gateway NSG with the gateway subnet.
# -----------------------------------------------------------------------------

resource "azurerm_subnet_network_security_group_association" "gateway_nsg_assoc" {
  subnet_id                 = azurerm_subnet.gateway_subnet.id
  network_security_group_id = azurerm_network_security_group.gateway_nsg.id
}
