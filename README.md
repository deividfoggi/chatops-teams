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
A comprehensive ChatOps solution that integrates GitHub security alerts, deployment workflows, and Dependabot notifications with Microsoft Teams, enabling real-time collaboration and incident response.

## Overview

This application provides automated workflows for:
- **Code Scanning Alerts**: Real-time notifications and acknowledgment workflows for GitHub Advanced Security alerts
- **Dependabot Alerts**: Dependency vulnerability tracking and remediation workflows
- **Deployment Reviews**: Interactive deployment approval workflows in Microsoft Teams
- **User Mapping**: Automatic GitHub to Entra ID user mapping for targeted notifications

## Features

- **Real-time Webhooks**: Receive and process GitHub webhook events
- **Adaptive Cards**: Rich, interactive notifications in Microsoft Teams
- **Distributed Tracing**: End-to-end transaction correlation for troubleshooting
- **Security**: Azure Key Vault integration, HTTPS endpoints, webhook signature validation
- **Monitoring**: Comprehensive Application Insights telemetry and dashboards
- **Scalability**: Azure App Service with auto-scaling capabilities

## Architecture

The solution consists of:
- **Bot Service**: Microsoft Teams bot built on Bot Framework SDK
- **Webhook Endpoints**: Azure App Service endpoints for GitHub webhooks
- **Logic Apps**: Workflow orchestration for alert processing
- **Application Insights**: Telemetry and monitoring
- **Azure Key Vault**: Secure credential storage
- **Virtual Network**: Network isolation and security

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
   
   Create a `.env` file in the `src` directory (use `.env.example` as a template):
   ```bash
   export BOT_APP_ID="<your-bot-app-id>"
   export BOT_APP_PASSWORD="<your-bot-app-password>"
   export AZURE_KEYVAULT_URL="<your-keyvault-url>"
   export APPLICATIONINSIGHTS_CONNECTION_STRING="<your-app-insights-connection-string>"
   ```

4. **Start the bot server**
   ```bash
   npm start
   ```

## Secrets Management

All secrets are stored in Azure Key Vault. See:
- [Key Vault Usage Guide](docs/key-vault-usage.md)
- [Secret Rotation Procedure](docs/key-vault-secret-rotation.md)
- [Troubleshooting](docs/key-vault-troubleshooting.md)

**Never commit secrets to Git!**

## Documentation

### Getting Started
- [Pre-Sprint Prerequisites](docs/pre-sprint-prerequisites.md) - Critical actions and setup required before Sprint 1
- [Pre-Sprint Quick Reference](docs/pre-sprint-quick-reference.md) - Quick reference guide for pre-sprint tasks
- [Sprint 1 Foundation Planning](docs/sprint-1-foundation-planning.md) - Sprint 1 infrastructure deployment guide

### Application Setup
- [Teams App Configuration](teams-app/README.md) - Microsoft Teams app manifest and deployment
- [Bot Service Implementation](src/bot/README.md) - Teams Bot Framework integration
- [Azure Bot Registration](teams-app/AZURE_BOT_REGISTRATION.md) - Bot service setup
- [Entra ID SSO Configuration](teams-app/ENTRA_SSO_CONFIG.md) - Single Sign-On setup
- [GitHub Webhook Configuration](docs/github-webhook-configuration.md) - Webhook setup and security

### Infrastructure
- [Infrastructure Overview](infrastructure/README.md) - Terraform configuration and architecture
- [Infrastructure Deployment Guide](docs/infrastructure-deployment-guide.md) - Complete deployment instructions
- [Environment Configurations](infrastructure/environments/README.md) - Environment-specific variable files
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

**Note:** Linting is not yet configured. The lint script currently displays a placeholder message.

### Starting Development Server
```bash
cd src
npm run start:dev
```

## Deployment

### Infrastructure Deployment

Deploy Azure infrastructure using Terraform with environment-specific configurations:

```bash
cd infrastructure

# Development
terraform init \
  -backend-config="resource_group_name=rg-terraform-state-chatops" \
  -backend-config="storage_account_name=stterraformchatops19932" \
  -backend-config="container_name=tfstate" \
  -backend-config="key=dev.tfstate"
terraform plan -var-file="environments/dev.tfvars" -out=tfplan
terraform apply tfplan

# Staging
terraform plan -var-file="environments/staging.tfvars" -out=tfplan
terraform apply tfplan

# Production
terraform plan -var-file="environments/prod.tfvars" -out=tfplan
terraform apply tfplan
```

**Automated Deployment:**
- **Dev**: Automatically deploys on push to `develop` branch
- **Staging**: Automatically deploys on push to `main` branch
- **Production**: Deploys on push to `main` with manual approval

See [Infrastructure Deployment Guide](docs/infrastructure-deployment-guide.md) for detailed instructions.

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
- Node.js 18+ or later
- Azure subscription
- GitHub organization with Advanced Security enabled
- Microsoft Teams tenant
- Azure CLI

### Installation

```bash
# Clone the repository
git clone https://github.com/deividfoggi/chatops-teams.git
cd chatops-teams

# Install dependencies
cd src
npm install
```

### Configuration

Set the following environment variables:

```bash
# Bot Configuration
BOT_APP_ID=<your-microsoft-app-id>
BOT_APP_PASSWORD=<your-microsoft-app-password>

# Application Insights
APPLICATIONINSIGHTS_CONNECTION_STRING=<your-app-insights-connection-string>

# GitHub Configuration
GITHUB_WEBHOOK_SECRET=<your-webhook-secret>

# Optional
NODE_ENV=production
PORT=3978
```

### Running Locally

```bash
# Start the bot server
node src/bot/server.js
```

## Monitoring and Observability

Application telemetry is tracked with Azure Application Insights, providing comprehensive monitoring of performance, business metrics, and security events.

### Documentation

- **[KQL Query Examples](docs/application-insights-kql-queries.md)** - Collection of Kusto queries for monitoring and analysis
- **[Operational Dashboards](docs/application-insights-dashboards.md)** - Dashboard templates and visualization guides
- **[Troubleshooting Guide](docs/application-insights-troubleshooting.md)** - Common issues and solutions
- **[Custom Metrics](docs/application-insights-custom-metrics.md)** - Business metrics and telemetry implementation

### Quick Access

Access your Application Insights resources:
- **Application Insights Portal**: [Azure Portal](https://portal.azure.com) → Monitor → Application Insights → chatops-appinsights
- **Live Metrics**: Real-time telemetry stream for immediate diagnostics
- **Application Map**: Visual dependency graph showing service interactions
- **Workbooks**: Pre-built operational dashboards (import from [workbook template](docs/application-insights-workbook.json))

### Key Metrics

The application tracks:
- **Performance**: Request duration, response times, dependency latency
- **Business Metrics**: Webhook processing, notifications sent, deployment approvals
- **Security**: Failed authentication, rate limits, suspicious activity
- **Dependencies**: GitHub API, Microsoft Graph, Teams Bot API health

## Infrastructure

The infrastructure is defined using Terraform and includes:
- Azure App Service with VNet integration
- Application Insights for monitoring
- Key Vault for secrets management
- Virtual Network with private endpoints
- Network Security Groups and firewalls

See [infrastructure/README.md](infrastructure/README.md) for deployment details.

## Development

### Project Structure

```
.
├── docs/                           # Documentation
│   ├── application-insights-*.md   # Monitoring documentation
│   └── network-architecture.md     # Network design
├── infrastructure/                 # Terraform configurations
├── src/
│   ├── bot/                       # Teams Bot Framework service
│   └── telemetry/                 # Application Insights client
├── teams-app/                     # Teams app manifest
└── backlog.md                     # Product backlog
```

### Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Test with Bot Framework Emulator
# Download from: https://github.com/Microsoft/BotFramework-Emulator
```

### Linting and Code Quality

```bash
# Run linter
npm run lint

# Fix linting issues
npm run lint:fix
```

## Deployment

### Azure Deployment

```bash
# Deploy infrastructure
cd infrastructure
terraform init
terraform plan
terraform apply

# Deploy application code
# (Handled by GitHub Actions CI/CD pipeline)
```

### CI/CD Pipeline

The project uses GitHub Actions for continuous integration and deployment:
- **Build**: Lint, test, and build on every push
- **Deploy**: Automatic deployment to Azure App Service on main branch
- **Infrastructure**: Terraform plan and apply for infrastructure changes

See [.github/workflows/README.md](.github/workflows/README.md) for pipeline details.

## Security

- **Webhook Validation**: All GitHub webhooks validated using HMAC signatures
- **Key Vault**: Credentials stored in Azure Key Vault
- **Network Isolation**: VNet integration with private endpoints
- **HTTPS Only**: All endpoints require TLS 1.2+
- **Bot Authentication**: OAuth 2.0 with Entra ID

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

- **Documentation**: Check the [docs/](docs/) directory
- **Issues**: Report bugs via [GitHub Issues](https://github.com/deividfoggi/chatops-teams/issues)
- **Monitoring**: Check Application Insights dashboards for operational issues

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Additional Resources

- [Microsoft Teams Bot Framework](https://docs.microsoft.com/azure/bot-service/)
- [GitHub Webhooks Documentation](https://docs.github.com/webhooks)
- [Azure Application Insights](https://docs.microsoft.com/azure/azure-monitor/app/app-insights-overview)
- [GitHub Advanced Security](https://docs.github.com/get-started/learning-about-github/about-github-advanced-security)
