#!/bin/bash

# OIDC Permission Verification Script
# This script helps verify that the service principal has correct permissions for GitHub Actions OIDC

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if required commands are available
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    if ! command -v az &> /dev/null; then
        print_error "Azure CLI (az) is not installed"
        echo "Install from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
        exit 1
    fi
    print_success "Azure CLI is installed"
    
    if ! command -v jq &> /dev/null; then
        print_warning "jq is not installed (optional but recommended)"
        echo "Install with: sudo apt-get install jq"
    else
        print_success "jq is installed"
    fi
}

# Get configuration from user
get_configuration() {
    print_header "Configuration"
    
    echo "Please provide the following information:"
    echo ""
    
    read -p "Service Principal App ID (AZURE_CLIENT_ID): " APP_ID
    read -p "Azure Subscription ID: " SUBSCRIPTION_ID
    read -p "Terraform Backend Resource Group: " BACKEND_RG
    read -p "Terraform Backend Storage Account: " BACKEND_SA
    read -p "GitHub Organization: " GITHUB_ORG
    read -p "GitHub Repository: " GITHUB_REPO
    
    export APP_ID
    export SUBSCRIPTION_ID
    export BACKEND_RG
    export BACKEND_SA
    export GITHUB_ORG
    export GITHUB_REPO
    
    echo ""
    print_info "Configuration saved"
}

# Check if logged in to Azure
check_azure_login() {
    print_header "Checking Azure Login"
    
    if ! az account show &> /dev/null; then
        print_error "Not logged in to Azure"
        echo "Please run: az login"
        exit 1
    fi
    
    CURRENT_SUB=$(az account show --query id -o tsv)
    CURRENT_SUB_NAME=$(az account show --query name -o tsv)
    
    print_success "Logged in to Azure"
    print_info "Current subscription: $CURRENT_SUB_NAME ($CURRENT_SUB)"
    
    if [ "$CURRENT_SUB" != "$SUBSCRIPTION_ID" ]; then
        print_warning "Current subscription doesn't match provided subscription ID"
        read -p "Do you want to switch to $SUBSCRIPTION_ID? (y/n): " SWITCH
        if [ "$SWITCH" = "y" ]; then
            az account set --subscription $SUBSCRIPTION_ID
            print_success "Switched to subscription $SUBSCRIPTION_ID"
        fi
    fi
}

# Verify service principal exists
verify_service_principal() {
    print_header "Verifying Service Principal"
    
    if ! SP_INFO=$(az ad sp show --id $APP_ID 2>&1); then
        print_error "Service principal not found with App ID: $APP_ID"
        return 1
    fi
    
    SP_DISPLAY_NAME=$(echo $SP_INFO | jq -r '.displayName' 2>/dev/null || echo "N/A")
    SP_OBJECT_ID=$(echo $SP_INFO | jq -r '.id' 2>/dev/null || az ad sp show --id $APP_ID --query id -o tsv)
    
    export SP_OBJECT_ID
    
    print_success "Service Principal found"
    print_info "Display Name: $SP_DISPLAY_NAME"
    print_info "Object ID: $SP_OBJECT_ID"
    print_info "App ID: $APP_ID"
}

# Check federated credentials
check_federated_credentials() {
    print_header "Checking Federated Credentials"
    
    if ! FED_CREDS=$(az ad app federated-credential list --id $APP_ID 2>&1); then
        print_error "Failed to list federated credentials"
        return 1
    fi
    
    CRED_COUNT=$(echo $FED_CREDS | jq '. | length' 2>/dev/null || echo "0")
    
    if [ "$CRED_COUNT" -eq "0" ]; then
        print_error "No federated credentials found"
        print_warning "You need to configure federated credentials for OIDC"
        return 1
    fi
    
    print_success "Found $CRED_COUNT federated credential(s)"
    
    # Check for expected credentials
    EXPECTED_SUBJECTS=(
        "repo:${GITHUB_ORG}/${GITHUB_REPO}:environment:dev"
        "repo:${GITHUB_ORG}/${GITHUB_REPO}:pull_request"
        "repo:${GITHUB_ORG}/${GITHUB_REPO}:ref:refs/heads/main"
    )
    
    echo ""
    print_info "Checking for expected subjects:"
    
    for SUBJECT in "${EXPECTED_SUBJECTS[@]}"; do
        if echo $FED_CREDS | jq -e ".[] | select(.subject == \"$SUBJECT\")" > /dev/null 2>&1; then
            print_success "Found: $SUBJECT"
        else
            print_warning "Missing: $SUBJECT"
        fi
    done
}

# Check subscription-level permissions
check_subscription_permissions() {
    print_header "Checking Subscription-Level Permissions"
    
    ROLE_ASSIGNMENTS=$(az role assignment list \
        --assignee $SP_OBJECT_ID \
        --scope "/subscriptions/$SUBSCRIPTION_ID" \
        --query "[].{role:roleDefinitionName,scope:scope}" \
        -o json 2>&1)
    
    if [ $? -ne 0 ]; then
        print_error "Failed to list role assignments"
        return 1
    fi
    
    ROLE_COUNT=$(echo $ROLE_ASSIGNMENTS | jq '. | length' 2>/dev/null || echo "0")
    
    if [ "$ROLE_COUNT" -eq "0" ]; then
        print_warning "No subscription-level role assignments found"
    else
        print_success "Found $ROLE_COUNT subscription-level role assignment(s)"
        echo $ROLE_ASSIGNMENTS | jq -r '.[] | "  - \(.role)"' 2>/dev/null || echo "$ROLE_ASSIGNMENTS"
    fi
    
    # Check for Contributor role
    if echo $ROLE_ASSIGNMENTS | jq -e '.[] | select(.role == "Contributor")' > /dev/null 2>&1; then
        print_success "Service principal has Contributor role"
    else
        print_warning "Service principal does not have Contributor role"
    fi
}

# Check storage account permissions
check_storage_permissions() {
    print_header "Checking Storage Account Permissions"
    
    # Check if storage account exists
    if ! STORAGE_ACCOUNT=$(az storage account show \
        --name $BACKEND_SA \
        --resource-group $BACKEND_RG 2>&1); then
        print_error "Storage account not found: $BACKEND_SA"
        print_info "Resource Group: $BACKEND_RG"
        return 1
    fi
    
    print_success "Storage account found: $BACKEND_SA"
    
    STORAGE_ACCOUNT_ID=$(echo $STORAGE_ACCOUNT | jq -r '.id' 2>/dev/null || az storage account show \
        --name $BACKEND_SA \
        --resource-group $BACKEND_RG \
        --query id -o tsv)
    
    # Check role assignments on storage account
    STORAGE_ROLES=$(az role assignment list \
        --assignee $SP_OBJECT_ID \
        --scope "$STORAGE_ACCOUNT_ID" \
        --query "[].{role:roleDefinitionName}" \
        -o json 2>&1)
    
    if [ $? -ne 0 ]; then
        print_error "Failed to check storage account permissions"
        return 1
    fi
    
    STORAGE_ROLE_COUNT=$(echo $STORAGE_ROLES | jq '. | length' 2>/dev/null || echo "0")
    
    if [ "$STORAGE_ROLE_COUNT" -eq "0" ]; then
        print_error "No role assignments found on storage account"
        print_warning "Service principal needs 'Storage Blob Data Contributor' role"
        MISSING_PERMISSIONS=true
    else
        print_success "Found $STORAGE_ROLE_COUNT role assignment(s) on storage account:"
        echo $STORAGE_ROLES | jq -r '.[] | "  - \(.role)"' 2>/dev/null || echo "$STORAGE_ROLES"
    fi
    
    # Check for required roles
    REQUIRED_ROLES=("Storage Blob Data Contributor" "Storage Blob Data Owner")
    HAS_REQUIRED_ROLE=false
    
    for ROLE in "${REQUIRED_ROLES[@]}"; do
        if echo $STORAGE_ROLES | jq -e ".[] | select(.role == \"$ROLE\")" > /dev/null 2>&1; then
            print_success "Service principal has required role: $ROLE"
            HAS_REQUIRED_ROLE=true
            break
        fi
    done
    
    if [ "$HAS_REQUIRED_ROLE" = false ]; then
        print_error "Service principal is missing required storage role"
        print_warning "Required: Storage Blob Data Contributor or Storage Blob Data Owner"
        MISSING_PERMISSIONS=true
    fi
}

# Check if tfstate container exists
check_tfstate_container() {
    print_header "Checking tfstate Container"
    
    if az storage container exists \
        --name tfstate \
        --account-name $BACKEND_SA \
        --auth-mode login \
        --only-show-errors &> /dev/null; then
        print_success "tfstate container exists"
    else
        print_warning "tfstate container does not exist or is not accessible"
        print_info "You may need to create it with:"
        echo "  az storage container create --name tfstate --account-name $BACKEND_SA --auth-mode login"
    fi
}

# Generate fix commands
generate_fix_commands() {
    if [ "$MISSING_PERMISSIONS" = true ]; then
        print_header "Suggested Fix Commands"
        
        echo "Run the following commands to grant required permissions:"
        echo ""
        echo "# Grant Storage Blob Data Contributor role"
        echo "az role assignment create \\"
        echo "  --assignee $SP_OBJECT_ID \\"
        echo "  --role \"Storage Blob Data Contributor\" \\"
        echo "  --scope \"/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$BACKEND_RG/providers/Microsoft.Storage/storageAccounts/$BACKEND_SA\""
        echo ""
        echo "# Create tfstate container (if needed)"
        echo "az storage container create \\"
        echo "  --name tfstate \\"
        echo "  --account-name $BACKEND_SA \\"
        echo "  --auth-mode login"
        echo ""
        
        read -p "Do you want to apply these fixes now? (y/n): " APPLY_FIXES
        if [ "$APPLY_FIXES" = "y" ]; then
            apply_fixes
        fi
    fi
}

# Apply fixes
apply_fixes() {
    print_header "Applying Fixes"
    
    echo "Granting Storage Blob Data Contributor role..."
    if az role assignment create \
        --assignee $SP_OBJECT_ID \
        --role "Storage Blob Data Contributor" \
        --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$BACKEND_RG/providers/Microsoft.Storage/storageAccounts/$BACKEND_SA" \
        --only-show-errors; then
        print_success "Role assignment created"
    else
        print_error "Failed to create role assignment"
    fi
    
    echo ""
    echo "Creating tfstate container..."
    if az storage container create \
        --name tfstate \
        --account-name $BACKEND_SA \
        --auth-mode login \
        --only-show-errors; then
        print_success "Container created"
    else
        print_warning "Failed to create container (may already exist)"
    fi
    
    echo ""
    print_info "Changes may take 5-10 minutes to propagate"
}

# Print summary
print_summary() {
    print_header "Verification Summary"
    
    if [ "$MISSING_PERMISSIONS" = true ]; then
        print_error "Issues found - action required"
        echo "Review the output above and apply suggested fixes"
    else
        print_success "All checks passed!"
        echo "Your OIDC configuration appears to be correct"
    fi
    
    echo ""
    print_info "GitHub Secrets to verify:"
    echo "  AZURE_CLIENT_ID: $APP_ID"
    echo "  AZURE_TENANT_ID: (your tenant ID)"
    echo "  AZURE_SUBSCRIPTION_ID: $SUBSCRIPTION_ID"
    echo "  TERRAFORM_BACKEND_RG: $BACKEND_RG"
    echo "  TERRAFORM_BACKEND_SA: $BACKEND_SA"
}

# Main execution
main() {
    echo "OIDC Permission Verification Script"
    echo "===================================="
    
    check_prerequisites
    get_configuration
    check_azure_login
    verify_service_principal
    check_federated_credentials
    check_subscription_permissions
    check_storage_permissions
    check_tfstate_container
    generate_fix_commands
    print_summary
    
    echo ""
    print_info "For more details, see: docs/OIDC_TROUBLESHOOTING.md"
}

# Initialize variables
MISSING_PERMISSIONS=false

# Run main function
main
