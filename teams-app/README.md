# ChatOps Teams App

This directory contains the Microsoft Teams app manifest and packaging scripts for the ChatOps Teams integration.

## Overview

The ChatOps Teams app enables GitHub security alerts (code scanning, Dependabot) and deployment approval workflows to be delivered directly into Microsoft Teams. The app includes:

- **Bot capabilities**: Receive notifications and interact with alerts
- **Message extensions**: Search for security alerts and deployments
- **Connectors**: Channel-level integrations
- **Single Sign-On (SSO)**: Seamless authentication with Entra ID

## Directory Structure

```
teams-app/
├── manifest.json           # Teams app manifest (v1.16 schema)
├── icons/
│   ├── color.png          # 192x192 color icon
│   └── outline.png        # 32x32 outline icon
├── locales/
│   └── en-us.json         # English localization
├── package.json           # Node.js dependencies and scripts
├── create-icons.js        # Script to generate placeholder icons
├── package-app.js         # Script to build the .zip package
├── validate-manifest.js   # Manifest validation script
└── README.md             # This file
```

## Prerequisites

Before deploying the Teams app, you must complete the following Azure registrations:

### 1. Azure Bot Service Registration

Register a bot in Azure Bot Service to get the Microsoft App ID and App Password:

1. Navigate to [Azure Portal](https://portal.azure.com)
2. Search for "Azure Bot" and create a new resource
3. Configure the bot:
   - **Bot handle**: `chatops-teams-bot`
   - **Pricing tier**: Free or Standard
   - **Microsoft App ID**: Create new (Microsoft-managed identity recommended)
   - **App type**: Multi-tenant
4. After creation, note the **Microsoft App ID** (this is your `MICROSOFT_APP_ID`)
5. Go to Configuration → Manage Password to create a client secret
6. Note the **Client Secret** (store this in Azure Key Vault as `bot-app-password`)

**Store in Key Vault:**
```bash
az keyvault secret set --vault-name <your-keyvault> --name "bot-app-id" --value "<MICROSOFT_APP_ID>"
az keyvault secret set --vault-name <your-keyvault> --name "bot-app-password" --value "<CLIENT_SECRET>"
```

### 2. Entra ID App Registration (for SSO)

Register an application in Microsoft Entra ID for Single Sign-On:

1. Navigate to [Azure Portal](https://portal.azure.com) → Entra ID
2. Go to **App registrations** → **New registration**
3. Configure the app:
   - **Name**: `ChatOps Teams SSO`
   - **Supported account types**: Accounts in this organizational directory only (single tenant)
   - **Redirect URI**: Web → `https://<your-domain>.azurewebsites.net/auth/callback`
4. After creation, note the **Application (client) ID** (this is your `ENTRA_CLIENT_ID`)
5. Go to **Certificates & secrets** → New client secret
6. Note the **Client Secret** value (store in Azure Key Vault as `entra-client-secret`)
7. Configure **API permissions**:
   - Add Microsoft Graph permissions: `User.Read`, `TeamSettings.Read.All`
   - Grant admin consent
8. Configure **Expose an API**:
   - Add Application ID URI: `api://<your-domain>.azurewebsites.net/<ENTRA_CLIENT_ID>`
   - Add a scope: `access_as_user` (admins and users)
9. Configure **Authentication**:
   - Enable "Access tokens" and "ID tokens"
   - Add redirect URIs for Teams SSO

**Store in Key Vault:**
```bash
az keyvault secret set --vault-name <your-keyvault> --name "entra-client-id" --value "<ENTRA_CLIENT_ID>"
az keyvault secret set --vault-name <your-keyvault> --name "entra-client-secret" --value "<CLIENT_SECRET>"
```

### 3. Azure App Service Domain

Deploy your Azure App Service and note the domain:

```
AZURE_APP_SERVICE_DOMAIN=chatops-app-service-<unique>.azurewebsites.net
```

## Building the Teams App Package

### Step 1: Install Dependencies

```bash
cd teams-app
npm install
```

### Step 2: Create Icons (First Time Only)

Generate placeholder icons (replace with branded icons before production):

```bash
npm run create-icons
```

**Note:** Replace the placeholder icons in `icons/` with your branded icons:
- `color.png`: 192x192 pixels, full color, transparent background (PNG)
- `outline.png`: 32x32 pixels, monochrome/white, transparent background (PNG)

### Step 3: Validate Manifest

Validate the manifest against Teams schema:

```bash
npm run validate
```

### Step 4: Package the App

#### Option A: Development Package (with placeholders)

```bash
npm run package
```

This creates `chatops-teams.zip` with placeholder values.

#### Option B: Production Package (with environment variables)

Set environment variables and build:

```bash
export MICROSOFT_APP_ID="<your-bot-app-id>"
export AZURE_APP_SERVICE_DOMAIN="<your-app-service-domain>"
export ENTRA_CLIENT_ID="<your-entra-client-id>"

npm run package
```

Or use the dev script:

```bash
MICROSOFT_APP_ID="xxx" AZURE_APP_SERVICE_DOMAIN="yyy.azurewebsites.net" ENTRA_CLIENT_ID="zzz" npm run package:dev
```

## Deploying to Microsoft Teams

### Option 1: Upload to Teams Admin Center (Recommended for Production)

1. Go to [Teams Admin Center](https://admin.teams.microsoft.com)
2. Navigate to **Teams apps** → **Manage apps**
3. Click **Upload new app** → **Upload**
4. Select the `chatops-teams.zip` file
5. Review app details and click **Publish**
6. The app will be available in your organization's app catalog

### Option 2: Upload via Teams App Studio (for Development)

1. Open Microsoft Teams
2. Search for "App Studio" or "Developer Portal" in the Teams app store
3. Install and open the app
4. Go to **Apps** → **Import an existing app**
5. Upload the `chatops-teams.zip` file
6. Review and test the app
7. Click **Install** to install in your tenant

### Option 3: Sideload for Personal Testing

1. Open Microsoft Teams
2. Click **Apps** → **Manage your apps** → **Upload an app**
3. Select **Upload a custom app**
4. Choose the `chatops-teams.zip` file
5. Click **Add** to install the app

**Note:** Sideloading must be enabled in your tenant. Contact your Teams admin if unavailable.

## Manifest Configuration

The manifest includes the following capabilities:

### Bot Capabilities

- **Scopes**: Personal, team, group chat
- **Commands**:
  - `help`: Get help with ChatOps Teams commands
  - `status`: Check repository and alert status
  - `subscribe`: Subscribe to repository alerts
  - `unsubscribe`: Unsubscribe from alerts

### Message Extensions

- **Search Security Alerts**: Query GitHub security alerts by repository, severity, or type
- **Search Deployments**: Find pending deployment approvals by environment

### Connectors

- Team-level webhooks for channel notifications

### Permissions

- **identity**: Required for SSO authentication
- **messageTeamMembers**: Send proactive messages to team members

### Valid Domains

The app is configured to communicate with:
- Your Azure App Service domain
- `token.botframework.com` (for Bot Framework authentication)
- `github.com` (for GitHub links in adaptive cards)

## Customization

### Updating App Details

Edit `manifest.json` to customize:

- **name**: Short and full app names
- **description**: Short and full descriptions
- **accentColor**: Brand color (hex format)
- **developer**: Your organization details

### Adding Localization

1. Create a new locale file in `locales/` (e.g., `pt-br.json`)
2. Update `manifest.json` → `localizationInfo.additionalLanguages`
3. Rebuild the package

### Modifying Bot Commands

Update `bots[0].commandLists[0].commands` in `manifest.json` to add/remove commands.

## Troubleshooting

### "App validation failed"

Run the validation script to identify issues:

```bash
npm run validate
```

Common issues:
- Invalid JSON syntax
- Missing required fields
- Icon files not found
- Invalid URL formats
- Missing placeholder substitutions

### "Invalid manifest schema"

Ensure you're using manifest version 1.16. Update the schema URL if needed:

```json
"$schema": "https://developer.microsoft.com/en-us/json-schemas/teams/v1.16/MicrosoftTeams.schema.json"
```

### "Bot not responding"

Verify:
1. Azure Bot Service is configured with correct messaging endpoint
2. App Service is deployed and running
3. Bot credentials (App ID and Password) are correctly configured
4. Azure App Service has the correct environment variables

### "SSO not working"

Check:
1. Entra ID app registration is configured correctly
2. Application ID URI matches the format: `api://<domain>/<client-id>`
3. Redirect URIs are configured for Teams SSO
4. Required Graph API permissions are granted

## Security Considerations

### Secrets Management

- **Never commit secrets** to version control
- Store all secrets in Azure Key Vault:
  - `bot-app-id`
  - `bot-app-password`
  - `entra-client-id`
  - `entra-client-secret`
- Use managed identities for Azure service authentication

### Valid Domains

Only add trusted domains to `validDomains` in the manifest. This prevents the app from loading content from untrusted sources.

### Permissions

Request only the minimum permissions required:
- `identity`: For user authentication
- `messageTeamMembers`: For proactive notifications

## Compliance

This Teams app handles:
- Security alert data from GitHub
- User identity information
- Deployment approval decisions

Ensure compliance with:
- Your organization's data handling policies
- GDPR (if processing EU user data)
- SOC 2 requirements (audit logging)
- Industry-specific regulations (HIPAA, PCI-DSS, etc.)

## Testing Checklist

Before deploying to production:

- [ ] Replace placeholder icons with branded icons
- [ ] Test bot responds to messages in personal, team, and group chat
- [ ] Test SSO authentication flow
- [ ] Verify security alert notifications are delivered
- [ ] Test deployment approval workflow
- [ ] Verify message extensions search functionality
- [ ] Test on desktop, web, and mobile Teams clients
- [ ] Validate all links and URLs work correctly
- [ ] Review and test error handling
- [ ] Perform security review

## Support

For issues or questions:

1. Check the [Microsoft Teams developer documentation](https://docs.microsoft.com/microsoftteams/platform/)
2. Review [Bot Framework documentation](https://docs.microsoft.com/azure/bot-service/)
3. Consult your internal DevOps team
4. Review Azure App Service logs for errors

## References

- [Teams App Manifest Schema v1.16](https://developer.microsoft.com/en-us/json-schemas/teams/v1.16/MicrosoftTeams.schema.json)
- [Teams App Design Guidelines](https://docs.microsoft.com/microsoftteams/platform/concepts/design/design-teams-app-overview)
- [Azure Bot Service Documentation](https://docs.microsoft.com/azure/bot-service/)
- [Microsoft Entra ID Documentation](https://docs.microsoft.com/azure/active-directory/)
- [Adaptive Cards Designer](https://adaptivecards.io/designer/)

## License

This Teams app manifest and scripts are proprietary and confidential.
