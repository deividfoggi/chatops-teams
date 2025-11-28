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

# =============================================================================
# App Subnet Configuration
# =============================================================================
# This subnet hosts the App Service with VNet integration for the ChatOps
# application. It includes delegation for Microsoft.Web/serverFarms.
# =============================================================================

resource "azurerm_subnet" "app_subnet" {
  name                 = "app-subnet"
  resource_group_name  = azurerm_resource_group.chatops.name
  virtual_network_name = azurerm_virtual_network.chatops_vnet.name
  address_prefixes     = ["10.0.1.0/24"]

  delegation {
    name = "app-service-delegation"

    service_delegation {
      name = "Microsoft.Web/serverFarms"
      actions = [
        "Microsoft.Network/virtualNetworks/subnets/action"
      ]
    }
  }
}

# =============================================================================
# Network Security Group for App Subnet
# =============================================================================
# This NSG controls traffic to and from the app subnet following the principle
# of least privilege. It allows inbound traffic only from the gateway subnet
# and outbound HTTPS to the internet, with a default deny rule.
# =============================================================================

resource "azurerm_network_security_group" "app_nsg" {
  name                = "app-nsg"
  location            = azurerm_resource_group.chatops.location
  resource_group_name = azurerm_resource_group.chatops.name

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    ManagedBy   = "Terraform"
  }
}

# -----------------------------------------------------------------------------
# NSG Security Rules
# -----------------------------------------------------------------------------
# Note: The gateway subnet (10.0.2.0/24) referenced below will be created
# in a future story (Story 6.2: Deploy Azure Application Gateway with WAF).
# This rule allows inbound HTTPS traffic only from the Application Gateway.
# -----------------------------------------------------------------------------

resource "azurerm_network_security_rule" "allow_gateway_inbound" {
  name                        = "AllowGatewayInbound"
  priority                    = 100
  direction                   = "Inbound"
  access                      = "Allow"
  protocol                    = "Tcp"
  source_port_range           = "*"
  destination_port_range      = "443"
  source_address_prefix       = "10.0.2.0/24"
  destination_address_prefix  = "*"
  resource_group_name         = azurerm_resource_group.chatops.name
  network_security_group_name = azurerm_network_security_group.app_nsg.name
}

resource "azurerm_network_security_rule" "allow_internet_outbound" {
  name                        = "AllowInternetOutbound"
  priority                    = 100
  direction                   = "Outbound"
  access                      = "Allow"
  protocol                    = "Tcp"
  source_port_range           = "*"
  destination_port_range      = "443"
  source_address_prefix       = "*"
  destination_address_prefix  = "Internet"
  resource_group_name         = azurerm_resource_group.chatops.name
  network_security_group_name = azurerm_network_security_group.app_nsg.name
}

resource "azurerm_network_security_rule" "deny_all_inbound" {
  name                        = "DenyAllInbound"
  priority                    = 4096
  direction                   = "Inbound"
  access                      = "Deny"
  protocol                    = "*"
  source_port_range           = "*"
  destination_port_range      = "*"
  source_address_prefix       = "*"
  destination_address_prefix  = "*"
  resource_group_name         = azurerm_resource_group.chatops.name
  network_security_group_name = azurerm_network_security_group.app_nsg.name
}

# -----------------------------------------------------------------------------
# Subnet-NSG Association
# -----------------------------------------------------------------------------

resource "azurerm_subnet_network_security_group_association" "app_nsg_assoc" {
  subnet_id                 = azurerm_subnet.app_subnet.id
  network_security_group_id = azurerm_network_security_group.app_nsg.id
}

# =============================================================================
# NSG Flow Logs Configuration
# =============================================================================
# Flow logs provide visibility into network traffic patterns for security
# monitoring and troubleshooting. Traffic analytics enables advanced insights
# through integration with Log Analytics.
# =============================================================================

resource "random_string" "storage_suffix" {
  length  = 8
  special = false
  upper   = false
}

resource "azurerm_storage_account" "nsg_flow_logs" {
  name                     = "chatopsnsgflow${random_string.storage_suffix.result}"
  resource_group_name      = azurerm_resource_group.chatops.name
  location                 = azurerm_resource_group.chatops.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    Purpose     = "NSG Flow Logs"
    ManagedBy   = "Terraform"
  }
}

# -----------------------------------------------------------------------------
# Network Watcher Resource Group
# -----------------------------------------------------------------------------
# Azure automatically creates a Network Watcher in a resource group named
# NetworkWatcherRG when you first use Network Watcher features. If that
# resource group doesn't exist yet, we create our own Network Watcher
# in the ChatOps resource group.
# -----------------------------------------------------------------------------

resource "azurerm_network_watcher" "chatops" {
  name                = "chatops-network-watcher"
  location            = azurerm_resource_group.chatops.location
  resource_group_name = azurerm_resource_group.chatops.name

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    ManagedBy   = "Terraform"
  }
}

resource "azurerm_network_watcher_flow_log" "app_nsg_flow_log" {
  name                      = "app-nsg-flow-log"
  network_watcher_name      = azurerm_network_watcher.chatops.name
  resource_group_name       = azurerm_resource_group.chatops.name
  network_security_group_id = azurerm_network_security_group.app_nsg.id
  storage_account_id        = azurerm_storage_account.nsg_flow_logs.id
  enabled                   = true
  version                   = 2

  retention_policy {
    enabled = true
    days    = 90
  }

  traffic_analytics {
    enabled               = true
    workspace_id          = azurerm_log_analytics_workspace.chatops.workspace_id
    workspace_region      = azurerm_log_analytics_workspace.chatops.location
    workspace_resource_id = azurerm_log_analytics_workspace.chatops.id
    interval_in_minutes   = 10
  }
}
