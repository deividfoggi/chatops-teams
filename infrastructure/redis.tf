# =============================================================================
# Azure Cache for Redis Configuration
# =============================================================================
# This file defines the Azure Cache for Redis infrastructure for the ChatOps
# Teams application for POC/Development purposes with private connectivity.
#
# Key Features:
#   - Standard C1 tier (2.5GB) - suitable for POC with private connectivity
#   - TLS 1.2 minimum version for secure connections
#   - Private Endpoint for secure VNet connectivity
#   - Public network access disabled
#   - Faster provisioning than Premium (~10 minutes vs 20-30)
# =============================================================================

# -----------------------------------------------------------------------------
# Random String for Redis Cache Name Uniqueness
# -----------------------------------------------------------------------------
# Redis cache names must be globally unique. This random suffix ensures
# uniqueness across deployments.
# -----------------------------------------------------------------------------

resource "random_string" "redis_suffix" {
  length  = 8
  special = false
  upper   = false
}

# -----------------------------------------------------------------------------
# Redis Subnet Configuration
# -----------------------------------------------------------------------------
# Dedicated subnet for Redis Private Endpoint.
# This subnet provides network isolation for the Redis cache instance.
# -----------------------------------------------------------------------------

resource "azurerm_subnet" "redis_subnet" {
  name                 = "chatops-redis-subnet"
  resource_group_name  = azurerm_resource_group.chatops.name
  virtual_network_name = azurerm_virtual_network.chatops_vnet.name
  address_prefixes     = ["10.0.4.0/24"]

  # Service endpoints for secure connectivity
  service_endpoints = ["Microsoft.Storage"]
}

# -----------------------------------------------------------------------------
# Azure Cache for Redis - Standard C1
# -----------------------------------------------------------------------------
# Standard tier Redis cache with:
#   - 2.5GB capacity (sufficient for POC)
#   - SSL/TLS encryption
#   - Private Endpoint connectivity
#   - Public network access disabled
# -----------------------------------------------------------------------------

resource "azurerm_redis_cache" "chatops" {
  name                = "chatops-redis-${random_string.redis_suffix.result}"
  location            = azurerm_resource_group.chatops.location
  resource_group_name = azurerm_resource_group.chatops.name
  capacity            = 1
  family              = "C"
  sku_name            = "Standard"

  # TODO: Set to false after GitHub self-hosted runners are deployed
  # Temporarily allow public access for initial deployment and configuration
  public_network_access_enabled = true

  # Enable TLS 1.2 minimum version
  minimum_tls_version = "1.2"

  # Disable non-SSL port (SSL/TLS only)
  enable_non_ssl_port = false

  # Redis configuration for Standard tier
  redis_configuration {
    # Set maxmemory policy to LRU (Least Recently Used)
    maxmemory_policy = "allkeys-lru"

    # Notify keyspace events for cache monitoring
    notify_keyspace_events = "KEx"
  }

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    CostCenter  = var.cost_center
    Owner       = var.owner
    ManagedBy   = "Terraform"
    Purpose     = "DistributedCache"
    Tier        = "POC"
  }
}

# -----------------------------------------------------------------------------
# Private Endpoint for Redis
# -----------------------------------------------------------------------------
# Creates a private endpoint for secure, private connectivity to Redis cache.
# This eliminates public internet exposure.
# -----------------------------------------------------------------------------

resource "azurerm_private_endpoint" "redis" {
  name                = "chatops-redis-pe"
  location            = azurerm_resource_group.chatops.location
  resource_group_name = azurerm_resource_group.chatops.name
  subnet_id           = azurerm_subnet.redis_subnet.id

  private_service_connection {
    name                           = "chatops-redis-psc"
    private_connection_resource_id = azurerm_redis_cache.chatops.id
    is_manual_connection           = false
    subresource_names              = ["redisCache"]
  }

  private_dns_zone_group {
    name                 = "redis-dns-zone-group"
    private_dns_zone_ids = [azurerm_private_dns_zone.redis.id]
  }

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    ManagedBy   = "Terraform"
  }
}

# -----------------------------------------------------------------------------
# Private DNS Zone for Redis
# -----------------------------------------------------------------------------
# DNS zone for private endpoint name resolution.
# -----------------------------------------------------------------------------

resource "azurerm_private_dns_zone" "redis" {
  name                = "privatelink.redis.cache.windows.net"
  resource_group_name = azurerm_resource_group.chatops.name

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    ManagedBy   = "Terraform"
  }
}

# -----------------------------------------------------------------------------
# Link Private DNS Zone to VNet
# -----------------------------------------------------------------------------

resource "azurerm_private_dns_zone_virtual_network_link" "redis" {
  name                  = "chatops-redis-dns-link"
  resource_group_name   = azurerm_resource_group.chatops.name
  private_dns_zone_name = azurerm_private_dns_zone.redis.name
  virtual_network_id    = azurerm_virtual_network.chatops_vnet.id
  registration_enabled  = false

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    ManagedBy   = "Terraform"
  }
}

# -----------------------------------------------------------------------------
# Redis Diagnostic Settings
# -----------------------------------------------------------------------------
# Enables comprehensive logging and monitoring for Redis cache.
# Logs are sent to Log Analytics for centralized analysis.
# -----------------------------------------------------------------------------

resource "azurerm_monitor_diagnostic_setting" "redis" {
  name                       = "redis-diagnostics"
  target_resource_id         = azurerm_redis_cache.chatops.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.chatops.id

  # Note: Azure Cache for Redis diagnostic log categories
  # ConnectedClientList is the primary log category for Premium tier
  enabled_log {
    category = "ConnectedClientList"
  }

  # Metrics
  metric {
    category = "AllMetrics"
    enabled  = true
  }
}
