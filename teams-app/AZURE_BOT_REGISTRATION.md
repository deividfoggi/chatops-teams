# Azure Bot Service Registration Guide

This guide provides step-by-step instructions for registering the ChatOps Teams bot in Azure Bot Service.

## Prerequisites

- Azure subscription with appropriate permissions
- Azure CLI installed and authenticated (`az login`)
- Teams app manifest prepared (see README.md)

## Option 1: Azure Portal Registration (Recommended)

### Step 1: Create Azure Bot Resource

1. Navigate to [Azure Portal](https://portal.azure.com)
2. Click **Create a resource**
3. Search for **Azure Bot** and select it
4. Click **Create**

### Step 2: Configure Bot Settings

Fill in the following details:

| Field | Value | Notes |
|-------|-------|-------|
| **Bot handle** | `chatops-teams-bot` | Globally unique name |
| **Subscription** | Your subscription | Select appropriate subscription |
| **Resource group** | `chatops-rg` | Use existing or create new |
| **Location** | Same as App Service | e.g., East US |
| **Pricing tier** | Free (F0) or Standard (S1) | Free tier: 10k messages/month |
| **Microsoft App ID** | Create new | Select "Multi-tenant" |
| **App type** | Multi-tenant | Allow any organization |

### Step 3: Create and Configure App ID

1. After bot creation, go to **Configuration**
2. Note the **Microsoft App ID** (save this value)
3. Click **Manage** next to Microsoft App ID
4. Go to **Certificates & secrets**
5. Click **New client secret**
6. Configure:
   - **Description**: `ChatOps Teams Bot Secret`
   - **Expires**: 24 months (or per your policy)
7. **IMPORTANT**: Copy the secret **Value** immediately (it won't be shown again)

### Step 4: Configure Messaging Endpoint

1. Return to the bot's **Configuration** page
2. Set **Messaging endpoint**:
   ```
   https://<your-app-service>.azurewebsites.net/api/messages
   ```
3. Click **Apply**

### Step 5: Configure Channels

1. Go to **Channels** in the bot resource
2. Click **Microsoft Teams** channel
3. Configure:
   - **Messaging**: Enable
   - **Calling**: Disable (unless needed)
4. Click **Apply**
5. **Important**: Click **Agree** to the Teams terms of service

### Step 6: Store Credentials in Key Vault

Store the bot credentials securely:

```bash
# Set variables
BOT_APP_ID="<your-microsoft-app-id>"
BOT_APP_PASSWORD="<your-client-secret>"
KEY_VAULT_NAME="chatops-keyvault-<unique>"

# Store in Key Vault
az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name "bot-app-id" \
  --value "$BOT_APP_ID"

az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name "bot-app-password" \
  --value "$BOT_APP_PASSWORD"
```

## Option 2: Azure CLI Registration

### Create Bot Resource

```bash
# Set variables
RESOURCE_GROUP="chatops-rg"
BOT_NAME="chatops-teams-bot"
LOCATION="eastus"
APP_SERVICE_DOMAIN="chatops-app-service.azurewebsites.net"
MICROSOFT_APP_ID="<generate-or-use-existing>"

# Create the bot
az bot create \
  --resource-group $RESOURCE_GROUP \
  --name $BOT_NAME \
  --kind registration \
  --location global \
  --sku F0 \
  --app-type MultiTenant \
  --appid $MICROSOFT_APP_ID \
  --endpoint "https://$APP_SERVICE_DOMAIN/api/messages"

# Enable Teams channel
az bot teams create \
  --resource-group $RESOURCE_GROUP \
  --name $BOT_NAME \
  --enable-messaging
```

## App Service Configuration

After bot registration, configure your Azure App Service with the credentials:

### Using Key Vault References (Recommended)

Update App Service configuration to reference Key Vault secrets:

```bash
APP_SERVICE_NAME="chatops-app-service"
KEY_VAULT_NAME="chatops-keyvault-<unique>"

# Configure app settings with Key Vault references
az webapp config appsettings set \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    MicrosoftAppId="@Microsoft.KeyVault(SecretUri=https://$KEY_VAULT_NAME.vault.azure.net/secrets/bot-app-id/)" \
    MicrosoftAppPassword="@Microsoft.KeyVault(SecretUri=https://$KEY_VAULT_NAME.vault.azure.net/secrets/bot-app-password/)"
```

### Direct Configuration (Not Recommended for Production)

Alternatively, set environment variables directly:

```bash
az webapp config appsettings set \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    MicrosoftAppId="$BOT_APP_ID" \
    MicrosoftAppPassword="$BOT_APP_PASSWORD"
```

## Testing the Bot

### 1. Test Bot Endpoint

Test that your bot endpoint is accessible:

```bash
curl -X POST https://<your-app-service>.azurewebsites.net/api/messages \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: HTTP 400 or 401 (not 404, which means endpoint doesn't exist)

### 2. Test in Bot Framework Emulator

1. Download [Bot Framework Emulator](https://github.com/Microsoft/BotFramework-Emulator/releases)
2. Open the emulator
3. Click **Open Bot**
4. Configure:
   - **Bot URL**: `https://<your-app-service>.azurewebsites.net/api/messages`
   - **Microsoft App ID**: Your bot app ID
   - **Microsoft App Password**: Your bot app password
5. Send a test message

### 3. Test in Microsoft Teams

1. Package your Teams app with the bot App ID (see main README.md)
2. Upload to Teams (sideload or admin center)
3. Start a chat with the bot
4. Send a test message like "help"

## Troubleshooting

### Bot not responding in Teams

**Check:**
1. Bot endpoint is correct in Azure Bot Configuration
2. App Service is running and healthy
3. Bot credentials match between Azure Bot and App Service
4. Teams channel is enabled in Azure Bot
5. Check App Service logs for errors

**Verify credentials:**
```bash
# Check what's configured in App Service
az webapp config appsettings list \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "[?name=='MicrosoftAppId' || name=='MicrosoftAppPassword']"
```

### "Unauthorized" or 401 errors

**Common causes:**
- Bot App ID mismatch
- Bot App Password incorrect or expired
- Managed identity not configured properly

**Solution:**
1. Verify App ID in Azure Bot matches manifest
2. Regenerate bot app password if needed
3. Update Key Vault secret with new password
4. Restart App Service

### "Could not reach bot" error in Teams

**Check:**
1. Messaging endpoint is HTTPS (not HTTP)
2. Endpoint returns 200 for POST requests
3. App Service is not in "Stopped" state
4. Firewall/NSG allows inbound traffic

### Token validation errors

**Verify:**
1. Bot is registered as "Multi-tenant"
2. App ID matches exactly (no typos)
3. No special characters in password causing parsing issues

## Security Best Practices

### 1. Secret Management

- ✅ Store all secrets in Azure Key Vault
- ✅ Use Key Vault references in App Service
- ✅ Enable soft-delete and purge protection on Key Vault
- ❌ Never commit secrets to source control
- ❌ Never hardcode secrets in application code

### 2. Authentication

- ✅ Use Bot Framework authentication middleware
- ✅ Validate incoming activity signatures
- ✅ Implement rate limiting
- ✅ Log all authentication attempts

### 3. Network Security

- ✅ Use HTTPS only for bot endpoint
- ✅ Configure Application Gateway with WAF
- ✅ Restrict App Service to only accept traffic from Application Gateway
- ✅ Enable DDoS protection on VNet

### 4. Secret Rotation

Rotate bot app password periodically:

1. Create new client secret in Entra ID app
2. Update Key Vault with new secret
3. Verify bot still works with new secret
4. Delete old client secret
5. Document rotation in audit log

## Next Steps

After bot registration:

1. ✅ Store credentials in Azure Key Vault
2. ✅ Configure App Service with bot credentials
3. ✅ Update Teams app manifest with Microsoft App ID
4. ✅ Package Teams app (.zip)
5. ✅ Test bot locally with Bot Framework Emulator
6. ✅ Deploy bot code to App Service
7. ✅ Upload Teams app to Teams Admin Center
8. ✅ Test end-to-end in Microsoft Teams

## References

- [Azure Bot Service Documentation](https://docs.microsoft.com/azure/bot-service/)
- [Bot Framework SDK](https://github.com/microsoft/botframework-sdk)
- [Teams Bot Documentation](https://docs.microsoft.com/microsoftteams/platform/bots/what-are-bots)
- [Bot Framework Emulator](https://github.com/Microsoft/BotFramework-Emulator)

## Support

For issues:
1. Check Azure Bot Service logs in Azure Portal
2. Review App Service Application Insights logs
3. Use Bot Framework Emulator for local debugging
4. Consult [Bot Service troubleshooting guide](https://docs.microsoft.com/azure/bot-service/bot-service-troubleshoot-general-problems)
