# =============================================================================
# Azure Web Application Firewall (WAF) Policy Configuration
# =============================================================================
# This file defines the WAF policy for Application Gateway following Azure
# Well-Architected Framework security best practices.
#
# Key Security Features:
#   - Prevention Mode: Actively blocks malicious traffic
#   - OWASP 3.2 Ruleset: Industry-standard protection against common threats
#   - Custom Rate Limiting: Protects against DDoS and brute-force attacks
# =============================================================================

# -----------------------------------------------------------------------------
# WAF Policy Resource
# -----------------------------------------------------------------------------
# Defines the Web Application Firewall policy that will be associated with
# the Application Gateway to protect against OWASP Top 10 vulnerabilities
# and implement custom security rules.
# -----------------------------------------------------------------------------

resource "azurerm_web_application_firewall_policy" "chatops" {
  name                = "chatops-waf-policy"
  location            = azurerm_resource_group.chatops.location
  resource_group_name = azurerm_resource_group.chatops.name

  # =============================================================================
  # Custom Rules - Rate Limiting
  # =============================================================================
  # Custom rule to protect against DDoS and brute-force attacks by limiting
  # the number of requests per IP address to 100 requests per minute.
  # =============================================================================

  custom_rules {
    name      = "RateLimitRule"
    priority  = 1
    rule_type = "RateLimitRule"
    action    = "Block"

    rate_limit_duration             = "OneMin"
    rate_limit_threshold            = 100
    group_by_user_session {
      group_by_variables {
        variable_name = "ClientAddr"
      }
    }

    match_conditions {
      match_variables {
        variable_name = "RemoteAddr"
      }

      operator           = "IPMatch"
      negation_condition = false
      match_values       = ["0.0.0.0/0", "::/0"]
    }
  }

  # =============================================================================
  # Policy Settings
  # =============================================================================
  # Global WAF policy settings:
  #   - Prevention Mode: Actively blocks detected threats
  #   - Request Body Inspection: Enabled for POST requests
  #   - Max Request Body Size: 128KB (Azure default)
  #   - File Upload Limit: 100MB (Azure default)
  # =============================================================================

  policy_settings {
    enabled                     = true
    mode                        = "Prevention"
    request_body_check          = true
    max_request_body_size_in_kb = 128
    file_upload_limit_in_mb     = 100
  }

  # =============================================================================
  # Managed Ruleset - OWASP 3.2
  # =============================================================================
  # OWASP (Open Web Application Security Project) Core Rule Set provides
  # protection against:
  #   - SQL Injection
  #   - Cross-Site Scripting (XSS)
  #   - Remote Code Execution
  #   - Local File Inclusion
  #   - Remote File Inclusion
  #   - Session Fixation
  #   - And other OWASP Top 10 vulnerabilities
  # =============================================================================

  managed_rules {
    managed_rule_set {
      type    = "OWASP"
      version = "3.2"
    }
  }

  tags = {
    Environment = var.environment
    Application = "ChatOps"
    CostCenter  = var.cost_center
    Owner       = var.owner
    ManagedBy   = "Terraform"
    Purpose     = "WAF Protection"
  }
}
