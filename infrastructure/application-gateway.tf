# =============================================================================
# Azure Application Gateway Configuration
# =============================================================================
# This file defines the Application Gateway v2 with WAF for the ChatOps
# Teams application following Azure Well-Architected Framework principles.
#
# Key Features:
#   - WAF_v2 SKU: Integrated Web Application Firewall protection
#   - Autoscaling: Automatically scales from 2 to 10 instances based on load
#   - HTTPS Termination: SSL/TLS offloading at the gateway
#   - Health Probes: Automatic detection and removal of unhealthy backends
#   - Diagnostic Logging: Comprehensive logging to Log Analytics
# =============================================================================

# -----------------------------------------------------------------------------
# Public IP Address for Application Gateway
# -----------------------------------------------------------------------------
# Standard SKU public IP with static allocation for Application Gateway.
# Static allocation ensures the IP address remains consistent across restarts.
# -----------------------------------------------------------------------------

resource "azurerm_public_ip" "appgw" {
  name                = "chatops-appgw-pip"
  location            = azurerm_resource_group.chatops.location
  resource_group_name = azurerm_resource_group.chatops.name
  allocation_method   = "Static"
  sku                 = "Standard"
  domain_name_label   = "chatops-appgw-${random_string.appgw_suffix.result}"

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    CostCenter  = var.cost_center
    Owner       = var.owner
    ManagedBy   = "Terraform"
    Purpose     = "Application Gateway Public IP"
  }
}

# -----------------------------------------------------------------------------
# Random String for DNS Label Uniqueness
# -----------------------------------------------------------------------------
# Ensures the domain name label for the public IP is globally unique.
# -----------------------------------------------------------------------------

resource "random_string" "appgw_suffix" {
  length  = 8
  special = false
  upper   = false
}

# -----------------------------------------------------------------------------
# User Assigned Managed Identity for Application Gateway
# -----------------------------------------------------------------------------
# Managed identity allows Application Gateway to access Key Vault for
# SSL certificates without storing credentials in configuration.
# -----------------------------------------------------------------------------

resource "azurerm_user_assigned_identity" "appgw" {
  name                = "chatops-appgw-identity"
  location            = azurerm_resource_group.chatops.location
  resource_group_name = azurerm_resource_group.chatops.name

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    ManagedBy   = "Terraform"
  }
}

# -----------------------------------------------------------------------------
# Key Vault Secrets User Role for Application Gateway Identity
# -----------------------------------------------------------------------------
# Grants the Application Gateway managed identity permission to read
# certificates and secrets from Key Vault for SSL termination.
# -----------------------------------------------------------------------------

resource "azurerm_role_assignment" "appgw_kv_secrets_user" {
  scope                = azurerm_key_vault.chatops.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.appgw.principal_id

  description = "Application Gateway managed identity access for reading SSL certificates"
}

# -----------------------------------------------------------------------------
# Self-Signed SSL Certificate in Key Vault
# -----------------------------------------------------------------------------
# TODO: Replace with proper SSL certificate from Azure App Service Certificate
# or custom certificate authority before production deployment.
#
# This self-signed certificate is for development and testing only.
# For production, use a certificate from a trusted CA:
#   - Azure App Service Certificate (automated renewal)
#   - Let's Encrypt (free, automated)
#   - Commercial CA (DigiCert, GlobalSign, etc.)
# -----------------------------------------------------------------------------

resource "azurerm_key_vault_certificate" "appgw_ssl" {
  name         = "appgw-ssl-cert"
  key_vault_id = azurerm_key_vault.chatops.id

  certificate_policy {
    issuer_parameters {
      name = "Self"
    }

    key_properties {
      exportable = true
      key_size   = 2048
      key_type   = "RSA"
      reuse_key  = true
    }

    lifetime_action {
      action {
        action_type = "AutoRenew"
      }

      trigger {
        days_before_expiry = 30
      }
    }

    secret_properties {
      content_type = "application/x-pkcs12"
    }

    x509_certificate_properties {
      # Subject for the self-signed certificate
      subject = "CN=chatops.example.com"

      # TODO: Update with actual domain names before production
      subject_alternative_names {
        dns_names = ["chatops.example.com", "*.chatops.example.com"]
      }

      # Key usage for SSL/TLS server authentication
      key_usage = [
        "cRLSign",
        "dataEncipherment",
        "digitalSignature",
        "keyAgreement",
        "keyCertSign",
        "keyEncipherment",
      ]

      extended_key_usage = ["1.3.6.1.5.5.7.3.1"] # Server Authentication

      validity_in_months = 12
    }
  }

  # Depends on the role assignment to ensure Application Gateway can access the certificate
  depends_on = [azurerm_role_assignment.appgw_kv_secrets_user]

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    ManagedBy   = "Terraform"
    Purpose     = "Self-Signed SSL Certificate for Testing"
    Warning     = "Replace with proper certificate before production"
  }
}

# -----------------------------------------------------------------------------
# Application Gateway v2 with WAF
# -----------------------------------------------------------------------------
# Application Gateway provides:
#   - Layer 7 load balancing
#   - SSL/TLS termination
#   - Web Application Firewall (WAF)
#   - URL-based routing
#   - Health monitoring
#   - Autoscaling
# -----------------------------------------------------------------------------

resource "azurerm_application_gateway" "chatops" {
  name                = "chatops-appgw"
  location            = azurerm_resource_group.chatops.location
  resource_group_name = azurerm_resource_group.chatops.name

  # Enable WAF policy
  firewall_policy_id = azurerm_web_application_firewall_policy.chatops.id

  # =============================================================================
  # SKU Configuration - WAF_v2 with Autoscaling
  # =============================================================================
  # WAF_v2 SKU provides:
  #   - Integrated Web Application Firewall
  #   - Autoscaling capabilities
  #   - Zone redundancy support
  #   - Better performance and features compared to v1
  # =============================================================================

  sku {
    name = "WAF_v2"
    tier = "WAF_v2"
  }

  # Autoscaling configuration: min 2 instances (for HA), max 10 instances
  autoscale_configuration {
    min_capacity = 2
    max_capacity = 10
  }

  # =============================================================================
  # Managed Identity Configuration
  # =============================================================================
  # Enables the Application Gateway to access Key Vault for SSL certificates.
  # =============================================================================

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.appgw.id]
  }

  # =============================================================================
  # Gateway IP Configuration
  # =============================================================================
  # Associates the Application Gateway with the gateway subnet.
  # =============================================================================

  gateway_ip_configuration {
    name      = "gateway-ip-config"
    subnet_id = azurerm_subnet.gateway_subnet.id
  }

  # =============================================================================
  # Frontend Configuration
  # =============================================================================
  # Defines the public-facing IP address and port for incoming traffic.
  # =============================================================================

  frontend_ip_configuration {
    name                 = "frontend-ip-config"
    public_ip_address_id = azurerm_public_ip.appgw.id
  }

  frontend_port {
    name = "https-port"
    port = 443
  }

  # =============================================================================
  # SSL Certificate Configuration
  # =============================================================================
  # References the SSL certificate stored in Key Vault for HTTPS termination.
  # =============================================================================

  ssl_certificate {
    name                = "appgw-ssl-cert"
    key_vault_secret_id = azurerm_key_vault_certificate.appgw_ssl.secret_id
  }

  # =============================================================================
  # Backend Pool Configuration
  # =============================================================================
  # Backend pool for App Service instances.
  # Currently empty - will be populated when App Service is deployed in future stories.
  # =============================================================================

  backend_address_pool {
    name = "backend-pool"
    # fqdns will be added when App Service is deployed
    # Example: fqdns = [azurerm_linux_web_app.chatops.default_hostname]
  }

  # =============================================================================
  # Backend HTTP Settings
  # =============================================================================
  # Configures how Application Gateway communicates with backend App Service:
  #   - Protocol: HTTPS (secure communication with backend)
  #   - Port: 443 (standard HTTPS port)
  #   - Cookie Affinity: Disabled (stateless application)
  #   - Timeout: 30 seconds
  #   - Probe: Custom health probe
  #   - Host Override: Uses hostname from backend for SNI
  # =============================================================================

  backend_http_settings {
    name                                = "backend-http-settings"
    cookie_based_affinity               = "Disabled"
    port                                = 443
    protocol                            = "Https"
    request_timeout                     = 30
    probe_name                          = "health-probe"
    pick_host_name_from_backend_address = true
  }

  # =============================================================================
  # Health Probe Configuration
  # =============================================================================
  # Custom health probe to monitor backend health:
  #   - Path: /health (application health endpoint)
  #   - Protocol: HTTPS
  #   - Interval: 30 seconds (how often to check)
  #   - Timeout: 30 seconds (how long to wait for response)
  #   - Unhealthy Threshold: 3 (consecutive failures before marking unhealthy)
  # =============================================================================

  probe {
    name                                      = "health-probe"
    protocol                                  = "Https"
    path                                      = "/health"
    interval                                  = 30
    timeout                                   = 30
    unhealthy_threshold                       = 3
    pick_host_name_from_backend_http_settings = true

    match {
      status_code = ["200-399"]
    }
  }

  # =============================================================================
  # HTTPS Listener Configuration
  # =============================================================================
  # Listener that accepts HTTPS traffic on port 443 with SSL certificate.
  # =============================================================================

  http_listener {
    name                           = "https-listener"
    frontend_ip_configuration_name = "frontend-ip-config"
    frontend_port_name             = "https-port"
    protocol                       = "Https"
    ssl_certificate_name           = "appgw-ssl-cert"
    require_sni                    = false
  }

  # =============================================================================
  # Request Routing Rule
  # =============================================================================
  # Basic routing rule that forwards all HTTPS traffic from the listener
  # to the backend pool.
  # =============================================================================

  request_routing_rule {
    name                       = "routing-rule"
    rule_type                  = "Basic"
    http_listener_name         = "https-listener"
    backend_address_pool_name  = "backend-pool"
    backend_http_settings_name = "backend-http-settings"
    priority                   = 100
  }

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    CostCenter  = var.cost_center
    Owner       = var.owner
    ManagedBy   = "Terraform"
    Purpose     = "Application Gateway with WAF"
  }

  # Ensure the certificate is fully created and accessible before creating the gateway
  depends_on = [
    azurerm_key_vault_certificate.appgw_ssl,
    azurerm_role_assignment.appgw_kv_secrets_user
  ]
}

# =============================================================================
# Diagnostic Settings for Application Gateway
# =============================================================================
# Enables comprehensive logging and monitoring for security and troubleshooting:
#   - ApplicationGatewayAccessLog: Request/response logs
#   - ApplicationGatewayPerformanceLog: Performance metrics
#   - ApplicationGatewayFirewallLog: WAF detection and blocking events
# =============================================================================

resource "azurerm_monitor_diagnostic_setting" "appgw_diagnostics" {
  name                       = "appgw-diagnostics"
  target_resource_id         = azurerm_application_gateway.chatops.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.chatops.id

  # Access logs for request/response tracking
  enabled_log {
    category = "ApplicationGatewayAccessLog"
  }

  # Performance logs for monitoring gateway performance
  enabled_log {
    category = "ApplicationGatewayPerformanceLog"
  }

  # Firewall logs for WAF events (blocks, detections)
  enabled_log {
    category = "ApplicationGatewayFirewallLog"
  }

  # All metrics for comprehensive monitoring
  metric {
    category = "AllMetrics"
  }
}
