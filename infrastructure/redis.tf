# =============================================================================
# Azure Cache for Redis Configuration
# =============================================================================
# This file defines the Azure Cache for Redis infrastructure for the ChatOps
# Teams application following Azure Well-Architected Framework principles.
#
# Key Features:
#   - Premium P1 tier (6GB) with data persistence and geo-replication support
#   - TLS 1.2 minimum version for secure connections
#   - RDB persistence with 15-minute snapshots
#   - LRU eviction policy (allkeys-lru)
#   - VNet injection for secure, private connectivity
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
# Dedicated subnet for Azure Cache for Redis with service delegation.
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
# Azure Cache for Redis - Premium P1
# -----------------------------------------------------------------------------
# Premium tier Redis cache with:
#   - 6GB capacity
#   - Data persistence (RDB snapshots)
#   - Geo-replication support
#   - VNet injection for secure connectivity
#   - SSL/TLS encryption
# -----------------------------------------------------------------------------

resource "azurerm_redis_cache" "chatops" {
  name                = "chatops-redis-${random_string.redis_suffix.result}"
  location            = azurerm_resource_group.chatops.location
  resource_group_name = azurerm_resource_group.chatops.name
  capacity            = 1
  family              = "P"
  sku_name            = "Premium"

  # VNet injection - deploys Redis into the dedicated subnet
  # This provides network isolation without needing private endpoints
  subnet_id = azurerm_subnet.redis_subnet.id

  # Enable TLS 1.2 minimum version
  minimum_tls_version = "1.2"

  # Disable non-SSL port (SSL/TLS only)
  enable_non_ssl_port = false

  # Redis configuration
  redis_configuration {
    # Enable RDB persistence - snapshot every 15 minutes (900 seconds)
    rdb_backup_enabled            = true
    rdb_backup_frequency          = 15
    rdb_backup_max_snapshot_count = 1

    # Storage account for persistence backups
    rdb_storage_connection_string = azurerm_storage_account.redis_backup.primary_connection_string

    # Set maxmemory policy to LRU (Least Recently Used)
    maxmemory_policy = "allkeys-lru"

    # Disable AOF persistence (using RDB only)
    aof_backup_enabled = false

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
  }
}

# -----------------------------------------------------------------------------
# Storage Account for Redis Backup
# -----------------------------------------------------------------------------
# Dedicated storage account for Redis RDB persistence backups.
# This ensures backup data is stored securely and separately.
# -----------------------------------------------------------------------------

resource "azurerm_storage_account" "redis_backup" {
  name                     = "chatopsredisbkp${random_string.redis_suffix.result}"
  resource_group_name      = azurerm_resource_group.chatops.name
  location                 = azurerm_resource_group.chatops.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"

  # Redis requires connection string for RDB backups (Premium tier)
  shared_access_key_enabled = true

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    Purpose     = "RedisPersistence"
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
