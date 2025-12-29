# Secret Rotation Procedure

## GitHub Webhook Secret Rotation
1. Generate new webhook secret: `openssl rand -base64 32`
2. Update in Key Vault: `az keyvault secret set --vault-name $KV_NAME --name github-webhook-secret --value "new-value"`
3. Update in GitHub organization webhook settings
4. Verify: Trigger test webhook from GitHub
5. Monitor Application Insights for errors

## Bot App Password Rotation
1. Navigate to Azure Portal → App Registrations
2. Generate new client secret
3. Update Key Vault: `az keyvault secret set --vault-name $KV_NAME --name bot-app-password --value "new-password"`
4. Restart App Service (if not using Key Vault references)
5. Verify: Send test message in Teams

## Rotation Schedule
- GitHub secrets: Every 90 days
- Bot secrets: Every 90 days
- Entra ID secrets: Every 90 days (automatic reminder via alert)
