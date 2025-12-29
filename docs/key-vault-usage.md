# Azure Key Vault Usage Guide

## Secret Naming Convention
Format: `{service}-{secret-type}`

Examples:
- `github-webhook-secret`
- `github-app-id`
- `github-app-private-key`
- `bot-app-id`
- `bot-app-password`
- `entra-client-id`
- `entra-client-secret`

## Key Vault Reference Syntax
Use in App Service Application Settings:
```
GITHUB_WEBHOOK_SECRET=@Microsoft.KeyVault(SecretUri=https://chatops-kv-xxxx.vault.azure.net/secrets/github-webhook-secret/)
```

**Note:** Replace `chatops-kv-xxxx` with your actual Key Vault name. You can find your Key Vault URL by running:
```bash
az keyvault show --name <your-keyvault-name> --query properties.vaultUri --output tsv
```

## Secret Access from Code
```javascript
const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');

const credential = new DefaultAzureCredential();
const vaultUrl = process.env.AZURE_KEYVAULT_URL;
const client = new SecretClient(vaultUrl, credential);

async function getSecret(secretName) {
  const secret = await client.getSecret(secretName);
  return secret.value;
}
```
