# Entra ID Single Sign-On (SSO) Configuration Guide

This guide provides step-by-step instructions for configuring Single Sign-On (SSO) with Microsoft Entra ID (formerly Azure AD) for the ChatOps Teams app.

## Overview

SSO enables seamless authentication for Teams users interacting with the ChatOps bot. When configured correctly:
- Users don't need to sign in separately
- Bot can access user profile information
- Actions are properly attributed to authenticated users
- Audit trails capture real user identities

## Prerequisites

- Azure subscription with Entra ID access
- Global Administrator or Application Administrator role
- Teams app manifest prepared
- Azure App Service deployed

## Step 1: Create Entra ID App Registration

### Using Azure Portal

1. Navigate to [Azure Portal](https://portal.azure.com)
2. Go to **Microsoft Entra ID** (formerly Azure Active Directory)
3. Select **App registrations** → **New registration**
4. Configure the registration:

| Field | Value | Notes |
|-------|-------|-------|
| **Name** | `ChatOps Teams SSO` | User-facing name |
| **Supported account types** | Single tenant | Accounts in your org only |
| **Redirect URI** | Web | See below |

**Redirect URI:**
```
https://<your-app-service>.azurewebsites.net/auth/callback
```

5. Click **Register**
6. **Note the Application (client) ID** - this is your `ENTRA_CLIENT_ID`

### Using Azure CLI

```bash
# Set variables
APP_NAME="ChatOps Teams SSO"
APP_SERVICE_DOMAIN="chatops-app-service.azurewebsites.net"

# Create app registration
az ad app create \
  --display-name "$APP_NAME" \
  --sign-in-audience AzureADMyOrg \
  --web-redirect-uris "https://$APP_SERVICE_DOMAIN/auth/callback"

# Get the client ID
ENTRA_CLIENT_ID=$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv)
echo "ENTRA_CLIENT_ID: $ENTRA_CLIENT_ID"
```

## Step 2: Create Client Secret

### Using Azure Portal

1. In your app registration, go to **Certificates & secrets**
2. Click **New client secret**
3. Configure:
   - **Description**: `ChatOps Teams SSO Secret`
   - **Expires**: 24 months (or per your policy)
4. Click **Add**
5. **IMPORTANT**: Copy the **Value** immediately (shown only once)

### Using Azure CLI

```bash
# Create client secret (valid for 2 years)
SECRET=$(az ad app credential reset \
  --id $ENTRA_CLIENT_ID \
  --append \
  --display-name "ChatOps Teams SSO Secret" \
  --years 2 \
  --query password -o tsv)

echo "Client Secret: $SECRET"
```

### Store in Key Vault

```bash
KEY_VAULT_NAME="chatops-keyvault-<unique>"

az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name "entra-client-id" \
  --value "$ENTRA_CLIENT_ID"

az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name "entra-client-secret" \
  --value "$SECRET"
```

## Step 3: Configure API Permissions

### Required Permissions

The ChatOps Teams app requires the following Microsoft Graph API permissions:

| Permission | Type | Purpose |
|------------|------|---------|
| `User.Read` | Delegated | Read user profile |
| `TeamSettings.Read.All` | Application | Read team settings |

### Using Azure Portal

1. In your app registration, go to **API permissions**
2. Click **Add a permission**
3. Select **Microsoft Graph** → **Delegated permissions**
4. Search and select: `User.Read`
5. Click **Add permissions**
6. Click **Add a permission** again
7. Select **Microsoft Graph** → **Application permissions**
8. Search and select: `TeamSettings.Read.All`
9. Click **Add permissions**
10. Click **Grant admin consent for [Your Org]**
11. Confirm by clicking **Yes**

### Using Azure CLI

```bash
# Microsoft Graph App ID (constant)
GRAPH_APP_ID="00000003-0000-0000-c000-000000000000"

# User.Read permission ID (delegated)
USER_READ_ID="e1fe6dd8-ba31-4d61-89e7-88639da4683d"

# TeamSettings.Read.All permission ID (application)
TEAM_SETTINGS_READ_ID="242607bd-1d2c-432c-82eb-bdb27baa23ab"

# Add delegated permission
az ad app permission add \
  --id $ENTRA_CLIENT_ID \
  --api $GRAPH_APP_ID \
  --api-permissions $USER_READ_ID=Scope

# Add application permission
az ad app permission add \
  --id $ENTRA_CLIENT_ID \
  --api $GRAPH_APP_ID \
  --api-permissions $TEAM_SETTINGS_READ_ID=Role

# Grant admin consent
az ad app permission admin-consent --id $ENTRA_CLIENT_ID
```

## Step 4: Expose an API

SSO for Teams requires exposing an API with a specific Application ID URI format.

### Using Azure Portal

1. In your app registration, go to **Expose an API**
2. Click **Add** next to Application ID URI
3. Set the Application ID URI to:
   ```
   api://<your-app-service>.azurewebsites.net/<client-id>
   ```
   Example: `api://chatops-app.azurewebsites.net/12345678-1234-1234-1234-123456789012`
4. Click **Save**

### Add a Scope

1. Click **Add a scope**
2. Configure:
   - **Scope name**: `access_as_user`
   - **Who can consent**: Admins and users
   - **Admin consent display name**: `Access ChatOps Teams as a user`
   - **Admin consent description**: `Allows Teams to access ChatOps Teams on behalf of the user`
   - **User consent display name**: `Access ChatOps Teams`
   - **User consent description**: `Allow ChatOps Teams to access your profile information`
   - **State**: Enabled
3. Click **Add scope**

### Using Azure CLI

```bash
# Set Application ID URI
APP_ID_URI="api://$APP_SERVICE_DOMAIN/$ENTRA_CLIENT_ID"

az ad app update \
  --id $ENTRA_CLIENT_ID \
  --identifier-uris "$APP_ID_URI"

# Add scope (requires JSON file)
cat > scope.json <<EOF
{
  "oauth2PermissionScopes": [{
    "adminConsentDescription": "Allows Teams to access ChatOps Teams on behalf of the user",
    "adminConsentDisplayName": "Access ChatOps Teams as a user",
    "id": "$(uuidgen)",
    "isEnabled": true,
    "type": "User",
    "userConsentDescription": "Allow ChatOps Teams to access your profile information",
    "userConsentDisplayName": "Access ChatOps Teams",
    "value": "access_as_user"
  }]
}
EOF

az ad app update --id $ENTRA_CLIENT_ID --set api=@scope.json
```

## Step 5: Configure Authentication

### Using Azure Portal

1. In your app registration, go to **Authentication**
2. Under **Platform configurations**, verify Web platform exists
3. Add additional redirect URIs for Teams SSO:
   ```
   https://<your-app-service>.azurewebsites.net/auth/callback
   https://<your-app-service>.azurewebsites.net/auth/end
   https://token.botframework.com/.auth/web/redirect
   ```
4. Under **Implicit grant and hybrid flows**:
   - ✅ Enable **Access tokens**
   - ✅ Enable **ID tokens**
5. Under **Advanced settings**:
   - Set **Allow public client flows**: No
6. Click **Save**

## Step 6: Add Authorized Client Applications

Configure Microsoft Teams as an authorized client:

### Using Azure Portal

1. In your app registration, go to **Expose an API**
2. Scroll to **Authorized client applications**
3. Click **Add a client application**
4. Add the following client IDs (Teams app IDs):
   - **Teams Desktop/Mobile**: `1fec8e78-bce4-4aaf-ab1b-5451cc387264`
   - **Teams Web**: `5e3ce6c0-2b1f-4285-8d4b-75ee78787346`
5. Select the `access_as_user` scope
6. Click **Add application**
7. Repeat for the second client ID

## Step 7: Update Teams App Manifest

Update your Teams app manifest (`teams-app/manifest.json`) with the SSO configuration:

```json
{
  "webApplicationInfo": {
    "id": "<ENTRA_CLIENT_ID>",
    "resource": "api://<your-app-service>.azurewebsites.net/<ENTRA_CLIENT_ID>"
  }
}
```

Rebuild the Teams app package:

```bash
cd teams-app
export ENTRA_CLIENT_ID="<your-client-id>"
export AZURE_APP_SERVICE_DOMAIN="<your-domain>"
export MICROSOFT_APP_ID="<your-bot-id>"
npm run package
```

## Step 8: Configure App Service

Add SSO configuration to your App Service:

```bash
APP_SERVICE_NAME="chatops-app-service"
RESOURCE_GROUP="chatops-rg"
KEY_VAULT_NAME="chatops-keyvault-<unique>"

# Configure app settings
az webapp config appsettings set \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    EntraClientId="@Microsoft.KeyVault(SecretUri=https://$KEY_VAULT_NAME.vault.azure.net/secrets/entra-client-id/)" \
    EntraClientSecret="@Microsoft.KeyVault(SecretUri=https://$KEY_VAULT_NAME.vault.azure.net/secrets/entra-client-secret/)" \
    EntraTenantId="$(az account show --query tenantId -o tsv)" \
    SsoApplicationIdUri="api://$APP_SERVICE_DOMAIN/$ENTRA_CLIENT_ID"
```

## Testing SSO

### 1. Test Authentication Endpoint

```bash
curl https://<your-app-service>.azurewebsites.net/auth/callback
```

Expected: Redirect or error message (not 404)

### 2. Test in Teams

1. Upload the updated Teams app package
2. Start a conversation with the bot
3. Trigger an action that requires authentication
4. Verify SSO prompt appears if not signed in
5. After consent, verify actions work without additional prompts

### 3. Verify Token Claims

In your bot code, log the user token claims to verify:
- User identity (name, email)
- Tenant ID
- App ID
- Scopes granted

## Troubleshooting

### "Consent Required" Error

**Cause:** Admin consent not granted for application permissions

**Solution:**
```bash
az ad app permission admin-consent --id $ENTRA_CLIENT_ID
```

### "Invalid Resource" Error

**Cause:** Application ID URI mismatch

**Solution:**
1. Verify Application ID URI format: `api://<domain>/<client-id>`
2. Ensure it matches exactly in:
   - Entra ID app registration → Expose an API
   - Teams app manifest → webApplicationInfo.resource
3. Rebuild Teams app package

### "Redirect URI Mismatch"

**Cause:** Redirect URI not configured or incorrect

**Solution:**
1. Add all redirect URIs to Entra ID app → Authentication
2. Ensure URIs are exact matches (including trailing slashes if present)
3. Include both `/auth/callback` and `/auth/end`

### SSO Prompt Appears Every Time

**Cause:** Token not being cached or permissions changed

**Solution:**
1. Verify `User.Read` permission is granted
2. Check browser is allowing cookies
3. Clear Teams cache and retry

## Security Best Practices

### Secret Rotation

Rotate client secrets regularly:

```bash
# Create new secret
NEW_SECRET=$(az ad app credential reset \
  --id $ENTRA_CLIENT_ID \
  --append \
  --years 2 \
  --query password -o tsv)

# Update Key Vault
az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name "entra-client-secret" \
  --value "$NEW_SECRET"

# Verify app still works

# Remove old secret
az ad app credential delete \
  --id $ENTRA_CLIENT_ID \
  --key-id <old-key-id>
```

### Least Privilege

Only request permissions actually needed:
- ✅ `User.Read` - required for user profile
- ✅ `TeamSettings.Read.All` - only if reading team settings
- ❌ Don't request `User.ReadWrite.All` unless modifying users

### Audit Logging

Enable sign-in logs in Entra ID:
1. Go to Entra ID → Monitoring → Sign-in logs
2. Filter by Application: ChatOps Teams SSO
3. Review for anomalies

## References

- [Teams SSO Documentation](https://docs.microsoft.com/microsoftteams/platform/tabs/how-to/authentication/auth-aad-sso)
- [Entra ID App Registration](https://docs.microsoft.com/azure/active-directory/develop/quickstart-register-app)
- [Microsoft Graph Permissions](https://docs.microsoft.com/graph/permissions-reference)
- [OAuth 2.0 in Entra ID](https://docs.microsoft.com/azure/active-directory/develop/v2-oauth2-auth-code-flow)

## Next Steps

After SSO configuration:

1. ✅ Test authentication flow in Teams
2. ✅ Verify user information is retrieved correctly
3. ✅ Implement authorization checks in bot code
4. ✅ Document SSO setup for team members
5. ✅ Set up monitoring for authentication failures
6. ✅ Create runbook for secret rotation
