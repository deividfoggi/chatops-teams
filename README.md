# ChatOps Teams Integration

A secure, scalable Microsoft Teams integration for GitHub security alerts and deployment approvals. This application enables DevOps teams to receive real-time notifications about code scanning alerts, Dependabot vulnerabilities, and manage deployment approvals directly within Microsoft Teams.

## Features

- **GitHub Security Alerts**: Receive real-time notifications for code scanning and Dependabot alerts
- **Deployment Approvals**: Manage GitHub deployment approvals through interactive Teams cards
- **Proactive Messaging**: Send notifications to specific users or channels
- **Azure Integration**: Fully integrated with Azure services for security and monitoring
- **Single Sign-On**: Seamless authentication with Microsoft Entra ID

## Architecture

The application is built on Azure cloud infrastructure with the following components:

- **Azure App Service**: Hosts the Node.js bot application
- **Azure Key Vault**: Secure secrets management for API keys and credentials
- **Azure Application Insights**: Monitoring, logging, and telemetry
- **Azure Virtual Network**: Network isolation and security
- **Microsoft Teams Bot**: Interactive bot for notifications and commands

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- Azure subscription
- Microsoft Teams tenant
- GitHub organization/repositories
- Azure CLI installed and configured

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/deividfoggi/chatops-teams.git
   cd chatops-teams
   ```

2. **Install dependencies**
   ```bash
   cd src
   npm install
   ```

3. **Configure environment variables**
   ```bash
   export BOT_APP_ID="<your-bot-app-id>"
   export BOT_APP_PASSWORD="<your-bot-app-password>"
   export AZURE_KEYVAULT_URL="<your-keyvault-url>"
   export APPLICATIONINSIGHTS_CONNECTION_STRING="<your-app-insights-connection-string>"
   ```

4. **Start the bot server**
   ```bash
   node src/bot/server.js
   ```

## Secrets Management

All secrets are stored in Azure Key Vault. See:
- [Key Vault Usage Guide](docs/key-vault-usage.md)
- [Secret Rotation Procedure](docs/key-vault-secret-rotation.md)
- [Troubleshooting](docs/key-vault-troubleshooting.md)

**Never commit secrets to Git!**

## Documentation

### Application Setup
- [Teams App Configuration](teams-app/README.md) - Microsoft Teams app manifest and deployment
- [Bot Service Implementation](src/bot/README.md) - Teams Bot Framework integration
- [Azure Bot Registration](teams-app/AZURE_BOT_REGISTRATION.md) - Bot service setup
- [Entra ID SSO Configuration](teams-app/ENTRA_SSO_CONFIG.md) - Single Sign-On setup

### Infrastructure
- [Infrastructure Overview](infrastructure/README.md) - Terraform configuration and architecture
- [Network Architecture](docs/network-architecture.md) - Network design and IP allocation

### Operations & Monitoring
- [Application Insights Custom Metrics](docs/application-insights-custom-metrics.md) - Telemetry and metrics
- [Application Insights Alert Runbook](docs/application-insights-alert-runbook.md) - Alert response procedures
- [Key Vault Alert Runbook](docs/key-vault-alert-runbook.md) - Security alert procedures

### Key Vault & Security
- [Key Vault Usage Guide](docs/key-vault-usage.md) - Secret naming and access patterns
- [Secret Rotation Procedure](docs/key-vault-secret-rotation.md) - Step-by-step rotation guide
- [Key Vault Troubleshooting](docs/key-vault-troubleshooting.md) - Common issues and solutions

### CI/CD
- [GitHub Actions Workflows](.github/workflows/README.md) - Pipeline documentation
- [Pipeline Setup Guide](.github/PIPELINE_SETUP.md) - CI/CD configuration

## Project Structure

```
chatops-teams/
├── src/                        # Source code
│   └── bot/                    # Teams Bot Framework service
├── teams-app/                  # Microsoft Teams app manifest
├── infrastructure/             # Terraform infrastructure as code
├── docs/                       # Documentation
├── .github/                    # GitHub workflows and configurations
├── requirements/               # Requirements and specifications
└── README.md                   # This file
```

## Development

### Running Tests
```bash
cd src
npm test
```

### Linting
```bash
cd src
npm run lint
```

### Building for Production
```bash
cd src
npm run build
```

## Deployment

### Infrastructure Deployment

Deploy Azure infrastructure using Terraform:

```bash
cd infrastructure
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

See [Infrastructure README](infrastructure/README.md) for detailed instructions.

### Application Deployment

Deploy the application using GitHub Actions workflows. See [Pipeline Setup Guide](.github/PIPELINE_SETUP.md).

### Teams App Deployment

Package and deploy the Teams app:

```bash
cd teams-app
npm install
npm run package
```

Upload the generated `chatops-teams.zip` to Microsoft Teams Admin Center.

## Security

### Best Practices

- All secrets stored in Azure Key Vault
- Managed identities for Azure service authentication
- Network isolation with Virtual Network
- HTTPS/TLS encryption for all communications
- RBAC for access control
- Regular secret rotation (90-day cycle)

### Security Alerts

The application includes monitoring for:
- Key Vault access anomalies
- Failed authentication attempts
- Secret expiration warnings
- Application errors and exceptions

See [Key Vault Alert Runbook](docs/key-vault-alert-runbook.md) for incident response procedures.

## Monitoring

Application Insights provides comprehensive monitoring:

- **Custom Metrics**: Message processing times, API calls, rate limiting
- **Custom Events**: Bot activities, alert acknowledgments, deployment approvals
- **Exception Tracking**: Error logging with context
- **Performance**: Request/response times and dependencies

See [Application Insights Custom Metrics](docs/application-insights-custom-metrics.md) for details.

## Contributing

1. Create a feature branch from `main`
2. Make your changes following the coding standards
3. Run tests and linting
4. Submit a pull request with a clear description
5. Ensure all CI/CD checks pass

## Support

For issues or questions:

1. Check the documentation in the `docs/` directory
2. Review the [troubleshooting guides](docs/key-vault-troubleshooting.md)
3. Check Application Insights logs for errors
4. Contact the platform team

## License

This project is proprietary and confidential.

## Azure Well-Architected Framework

This application follows the [Azure Well-Architected Framework](https://docs.microsoft.com/azure/architecture/framework/) principles:

- **Cost Optimization**: Right-sized resources, efficient monitoring retention
- **Operational Excellence**: Infrastructure as Code, comprehensive logging
- **Performance Efficiency**: Scalable architecture, efficient resource allocation
- **Reliability**: Monitoring, alerting, and proactive issue detection
- **Security**: Defense in depth, least privilege access, secret management

See [Infrastructure README](infrastructure/README.md) for detailed alignment documentation.
