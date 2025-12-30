#!/bin/bash
#
# Azure Quota Verification Script
# 
# This script verifies Azure quotas required for the ChatOps Teams Integration project.
# It checks compute, networking, and storage quotas to ensure deployment will succeed.
#
# Usage:
#   ./verify-azure-quotas.sh [region]
#
# Example:
#   ./verify-azure-quotas.sh eastus
#
# Prerequisites:
#   - Azure CLI installed and authenticated (az login)
#   - Sufficient permissions to read quota information
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default region
REGION="${1:-eastus}"

# Required quotas for the project
REQUIRED_APP_SERVICE_CORES=4        # 2 instances × 2 cores (PremiumV3 P1v3)
REQUIRED_PUBLIC_IPS=2                # App Gateway + potential load balancer
REQUIRED_APP_GATEWAYS=1              # Application Gateway v2

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Azure Quota Verification Script${NC}"
echo -e "${BLUE}ChatOps Teams Integration Project${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""
echo -e "Region: ${YELLOW}${REGION}${NC}"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}ERROR: Azure CLI is not installed${NC}"
    echo "Please install Azure CLI: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if logged in
if ! az account show &> /dev/null; then
    echo -e "${RED}ERROR: Not logged in to Azure${NC}"
    echo "Please run: az login"
    exit 1
fi

# Get subscription info
SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

echo -e "Subscription: ${GREEN}${SUBSCRIPTION_NAME}${NC}"
echo -e "Subscription ID: ${SUBSCRIPTION_ID}"
echo ""

# Function to check quota status
check_quota() {
    local resource_name="$1"
    local current="$2"
    local limit="$3"
    local required="$4"
    
    local available=$((limit - current))
    local status="✅ OK"
    local color="${GREEN}"
    
    if [ $available -lt $required ]; then
        status="❌ INSUFFICIENT"
        color="${RED}"
    elif [ $available -lt $((required * 2)) ]; then
        status="⚠️  WARNING"
        color="${YELLOW}"
    fi
    
    echo -e "${color}${status}${NC} | ${resource_name}: ${current}/${limit} (Available: ${available}, Required: ${required})"
}

# Initialize results array
declare -a results=()

echo -e "${BLUE}=== Checking App Service / Compute Quota ===${NC}"
echo ""

# Check Standard App Service Plan cores (PremiumV3)
# Note: App Service uses VM quota families. PremiumV3 P1v3 uses Dv3-series
# Check for standardDSv3Family or standardDv3Family depending on region
if az vm list-usage --location "$REGION" &> /dev/null; then
    # Try standardDSv3Family first (most common for PremiumV3)
    STANDARD_CORES=$(az vm list-usage --location "$REGION" --query "[?contains(name.value, 'standardDSv3Family') || contains(name.value, 'standardDv3Family')] | [0].currentValue" -o tsv 2>/dev/null || echo "0")
    STANDARD_LIMIT=$(az vm list-usage --location "$REGION" --query "[?contains(name.value, 'standardDSv3Family') || contains(name.value, 'standardDv3Family')] | [0].limit" -o tsv 2>/dev/null || echo "0")
    
    if [ "$STANDARD_CORES" != "0" ] && [ "$STANDARD_LIMIT" != "0" ]; then
        check_quota "App Service PremiumV3 Cores" "$STANDARD_CORES" "$STANDARD_LIMIT" "$REQUIRED_APP_SERVICE_CORES"
        
        AVAILABLE_CORES=$((STANDARD_LIMIT - STANDARD_CORES))
        if [ $AVAILABLE_CORES -lt $REQUIRED_APP_SERVICE_CORES ]; then
            results+=("INSUFFICIENT_APP_SERVICE_QUOTA")
        fi
    else
        echo -e "${YELLOW}⚠️  WARNING${NC} | Could not determine App Service quota automatically"
        echo "  Please check manually: Azure Portal > Subscriptions > Usage + quotas > Compute"
        echo "  Look for 'Standard DSv3 Family vCPUs' or 'Standard Dv3 Family vCPUs'"
        results+=("MANUAL_CHECK_REQUIRED")
    fi
else
    echo -e "${YELLOW}⚠️  WARNING${NC} | vm list-usage command failed"
    echo "  Please check App Service quota manually"
    results+=("MANUAL_CHECK_REQUIRED")
fi

echo ""
echo -e "${BLUE}=== Checking Public IP Address Quota ===${NC}"
echo ""

# Check Public IP addresses (filter by region to avoid false positives)
if az network public-ip list --query "length(@)" -o tsv &> /dev/null; then
    # Count only public IPs in the target region
    PUBLIC_IP_CURRENT=$(az network public-ip list --query "[?location=='$REGION'] | length(@)" -o tsv 2>/dev/null || echo "0")
    PUBLIC_IP_LIMIT=$(az network list-usages --location "$REGION" --query "[?name.value=='PublicIPAddresses'].limit | [0]" -o tsv 2>/dev/null || echo "0")
    
    if [ "$PUBLIC_IP_LIMIT" != "0" ]; then
        check_quota "Public IP Addresses (${REGION})" "$PUBLIC_IP_CURRENT" "$PUBLIC_IP_LIMIT" "$REQUIRED_PUBLIC_IPS"
        
        AVAILABLE_IPS=$((PUBLIC_IP_LIMIT - PUBLIC_IP_CURRENT))
        if [ $AVAILABLE_IPS -lt $REQUIRED_PUBLIC_IPS ]; then
            results+=("INSUFFICIENT_PUBLIC_IP_QUOTA")
        fi
    else
        echo -e "${YELLOW}⚠️  WARNING${NC} | Could not determine Public IP quota"
        results+=("MANUAL_CHECK_REQUIRED")
    fi
else
    echo -e "${YELLOW}⚠️  WARNING${NC} | public-ip list command failed"
    results+=("MANUAL_CHECK_REQUIRED")
fi

echo ""
echo -e "${BLUE}=== Checking Application Gateway Quota ===${NC}"
echo ""

# Check Application Gateway quota
APP_GW_CURRENT=$(az network application-gateway list --query "length(@)" -o tsv 2>/dev/null || echo "0")
APP_GW_LIMIT=$(az network list-usages --location "$REGION" --query "[?name.value=='ApplicationGateways'].limit | [0]" -o tsv 2>/dev/null || echo "25")

if [ "$APP_GW_LIMIT" != "0" ]; then
    check_quota "Application Gateways" "$APP_GW_CURRENT" "$APP_GW_LIMIT" "$REQUIRED_APP_GATEWAYS"
    
    AVAILABLE_APP_GWS=$((APP_GW_LIMIT - APP_GW_CURRENT))
    if [ $AVAILABLE_APP_GWS -lt $REQUIRED_APP_GATEWAYS ]; then
        results+=("INSUFFICIENT_APP_GATEWAY_QUOTA")
    fi
else
    echo -e "${YELLOW}⚠️  WARNING${NC} | Could not determine Application Gateway quota"
    results+=("MANUAL_CHECK_REQUIRED")
fi

echo ""
echo -e "${BLUE}=== Checking Key Vault Quota ===${NC}"
echo ""

# Check Key Vault (usually unlimited for Standard tier)
KEY_VAULT_COUNT=$(az keyvault list --query "length(@)" -o tsv 2>/dev/null || echo "0")
echo -e "${GREEN}✅ OK${NC} | Key Vaults: ${KEY_VAULT_COUNT} (Standard tier usually unlimited)"

echo ""
echo -e "${BLUE}=== Checking Virtual Network Quota ===${NC}"
echo ""

# Check Virtual Networks
VNET_CURRENT=$(az network vnet list --query "length(@)" -o tsv 2>/dev/null || echo "0")
VNET_LIMIT=$(az network list-usages --location "$REGION" --query "[?name.value=='VirtualNetworks'].limit | [0]" -o tsv 2>/dev/null || echo "1000")

check_quota "Virtual Networks" "$VNET_CURRENT" "$VNET_LIMIT" "1"

echo ""
echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Analyze results
has_failures=false
has_warnings=false

for result in "${results[@]}"; do
    case "$result" in
        INSUFFICIENT_*)
            has_failures=true
            ;;
        MANUAL_CHECK_REQUIRED)
            has_warnings=true
            ;;
    esac
done

if [ "$has_failures" = true ]; then
    echo -e "${RED}❌ FAILED: Insufficient quota detected${NC}"
    echo ""
    echo "Action Required:"
    echo "1. Request quota increases in Azure Portal:"
    echo "   Subscriptions > ${SUBSCRIPTION_NAME} > Usage + quotas"
    echo "2. Select the resource type with insufficient quota"
    echo "3. Click 'Request increase'"
    echo "4. Specify new limit (recommend current + required + 50% buffer)"
    echo "5. Submit request (typically approved in 24-48 hours)"
    echo ""
    echo "Alternative: Consider deploying to a different region with available quota"
    echo ""
    exit 1
elif [ "$has_warnings" = true ]; then
    echo -e "${YELLOW}⚠️  WARNING: Manual verification required${NC}"
    echo ""
    echo "Some quota checks could not be automated. Please verify manually:"
    echo "1. Navigate to Azure Portal"
    echo "2. Go to Subscriptions > ${SUBSCRIPTION_NAME} > Usage + quotas"
    echo "3. Filter by region: ${REGION}"
    echo "4. Verify the following:"
    echo "   - App Service PremiumV3 cores: Need ${REQUIRED_APP_SERVICE_CORES} cores available"
    echo "   - Public IP addresses: Need ${REQUIRED_PUBLIC_IPS} IPs available"
    echo "   - Application Gateways: Need ${REQUIRED_APP_GATEWAYS} instances available"
    echo ""
    exit 2
else
    echo -e "${GREEN}✅ SUCCESS: All quota checks passed${NC}"
    echo ""
    echo "Your Azure subscription has sufficient quota to deploy the ChatOps infrastructure."
    echo ""
    echo "Next Steps:"
    echo "1. Proceed with Sprint 1 infrastructure deployment"
    echo "2. Continue with other pre-sprint prerequisites"
    echo "3. Monitor quota usage during deployment"
    echo ""
    exit 0
fi
