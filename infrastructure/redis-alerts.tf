# =============================================================================
# Azure Cache for Redis Alert Rules Configuration
# =============================================================================
# This file defines Azure Monitor alert rules for Redis cache performance
# and health monitoring following Azure Well-Architected Framework principles.
#
# Alerts Included:
#   - High Server Load: Detects when server CPU exceeds 90%
#   - High Cache Miss Rate: Monitors cache efficiency
#   - Connection Errors: Detects connection failures
# =============================================================================

# -----------------------------------------------------------------------------
# High Server Load Alert
# -----------------------------------------------------------------------------
# Monitors Redis server CPU usage.
# Triggers when server load exceeds 90% for 5 minutes.
# Severity: 2 (Warning) - Indicates potential performance degradation
# -----------------------------------------------------------------------------

resource "azurerm_monitor_metric_alert" "redis_high_server_load" {
  name                = "redis-high-server-load"
  resource_group_name = azurerm_resource_group.chatops.name
  scopes              = [azurerm_redis_cache.chatops.id]
  description         = "Alert when Redis server load exceeds 90% for 5 minutes, indicating potential performance issues."
  severity            = 2
  enabled             = true
  frequency           = "PT1M"
  window_size         = "PT5M"

  criteria {
    metric_namespace = "Microsoft.Cache/redis"
    metric_name      = "serverLoad"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 90
  }

  action {
    action_group_id = azurerm_monitor_action_group.ops_alerts.id
  }

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    CostCenter  = var.cost_center
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }
}

# -----------------------------------------------------------------------------
# High Cache Miss Rate Alert
# -----------------------------------------------------------------------------
# Monitors Redis cache hit/miss ratio.
# Triggers when cache miss rate exceeds 50% for 10 minutes.
# Severity: 2 (Warning) - Indicates inefficient caching
# -----------------------------------------------------------------------------

resource "azurerm_monitor_metric_alert" "redis_high_cache_miss_rate" {
  name                = "redis-high-cache-miss-rate"
  resource_group_name = azurerm_resource_group.chatops.name
  scopes              = [azurerm_redis_cache.chatops.id]
  description         = "Alert when cache miss rate exceeds 50% for 10 minutes, indicating inefficient caching patterns."
  severity            = 2
  enabled             = true
  frequency           = "PT5M"
  window_size         = "PT5M"

  criteria {
    metric_namespace = "Microsoft.Cache/redis"
    metric_name      = "cachemissrate"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 50
  }

  action {
    action_group_id = azurerm_monitor_action_group.ops_alerts.id
  }

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    CostCenter  = var.cost_center
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }
}

# -----------------------------------------------------------------------------
# Connection Errors Alert
# -----------------------------------------------------------------------------
# Monitors Redis connection errors.
# Triggers when more than 5 connection errors occur within 5 minutes.
# Severity: 1 (Error) - Indicates connectivity issues
# -----------------------------------------------------------------------------

resource "azurerm_monitor_metric_alert" "redis_connection_errors" {
  name                = "redis-connection-errors"
  resource_group_name = azurerm_resource_group.chatops.name
  scopes              = [azurerm_redis_cache.chatops.id]
  description         = "Alert when more than 5 connection errors occur within 5 minutes, indicating potential connectivity issues."
  severity            = 1
  enabled             = true
  frequency           = "PT1M"
  window_size         = "PT5M"

  criteria {
    metric_namespace = "Microsoft.Cache/redis"
    metric_name      = "errors"
    aggregation      = "Total"
    operator         = "GreaterThan"
    threshold        = 5

    dimension {
      name     = "ErrorType"
      operator = "Include"
      values   = ["ConnectionError"]
    }
  }

  action {
    action_group_id = azurerm_monitor_action_group.ops_alerts.id
  }

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    CostCenter  = var.cost_center
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }
}

# -----------------------------------------------------------------------------
# High Memory Usage Alert
# -----------------------------------------------------------------------------
# Monitors Redis memory usage.
# Triggers when used memory exceeds 90% of available memory.
# Severity: 2 (Warning) - Indicates potential memory pressure
# -----------------------------------------------------------------------------

resource "azurerm_monitor_metric_alert" "redis_high_memory_usage" {
  name                = "redis-high-memory-usage"
  resource_group_name = azurerm_resource_group.chatops.name
  scopes              = [azurerm_redis_cache.chatops.id]
  description         = "Alert when Redis memory usage exceeds 90%, indicating potential memory pressure."
  severity            = 2
  enabled             = true
  frequency           = "PT1M"
  window_size         = "PT5M"

  criteria {
    metric_namespace = "Microsoft.Cache/redis"
    metric_name      = "usedmemorypercentage"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 90
  }

  action {
    action_group_id = azurerm_monitor_action_group.ops_alerts.id
  }

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    CostCenter  = var.cost_center
    Owner       = var.owner
    ManagedBy   = "Terraform"
  }
}
