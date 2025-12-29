# ChatOps Teams Integration

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
