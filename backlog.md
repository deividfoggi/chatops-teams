# Product Backlog - ChatOps Teams Integration

**Last Updated:** January 6, 2026
**Total Epics:** 8
**Total Stories:** 43

---

## Table of Contents
- [Epic 1: GitHub Integration & Webhook Management](#epic-1-github-integration--webhook-management)
- [Epic 2: Code Scanning Alert Processing](#epic-2-code-scanning-alert-processing)
- [Epic 3: Dependabot Alert Processing](#epic-3-dependabot-alert-processing)
- [Epic 4: Deployment Review Workflow](#epic-4-deployment-review-workflow)
- [Epic 5: Microsoft Teams Integration](#epic-5-microsoft-teams-integration)
- [Epic 6: Azure Infrastructure & Security](#epic-6-azure-infrastructure--security)
- [Epic 7: CI/CD Pipeline & Application Deployment](#epic-7-cicd-pipeline--application-deployment)
- [Epic 8: Self-Hosted GitHub Runners in VNet](#epic-8-self-hosted-github-runners-in-vnet)

---

# Epic 1: GitHub Integration & Webhook Management

## Overview
Establish secure integration with GitHub Cloud to receive and process webhook events for code scanning alerts, Dependabot alerts, and deployment reviews. This epic provides the foundation for all ChatOps automation workflows.

## Goals
- Enable real-time webhook reception from GitHub Cloud
- Authenticate and validate incoming webhook payloads
- Route webhook events to appropriate bot handlers
- Provide GitHub API integration for retrieving repository and user data

## Success Metrics
- 100% of GitHub webhooks successfully received and validated
- < 500ms latency from webhook trigger to bot processing
- Zero unauthorized webhook access attempts successful
- API rate limits never exceeded

## Estimated Effort
**Size:** Large

---

### Story 1.1: Configure GitHub Webhook Endpoints

**Priority:** High | **Story Points:** 5

#### User Story
As a **DevOps Engineer**
I want **to configure webhook endpoints in the Azure app service**
So that **GitHub can send real-time events to our ChatOps system**

#### Acceptance Criteria
- [ ] Given a deployed Azure app service, when GitHub sends a webhook event, then the endpoint receives and logs the payload
- [ ] Given an incoming webhook, when the signature is validated, then only authentic GitHub requests are processed
- [ ] Given multiple webhook event types, when they arrive, then each is routed to the correct bot handler
- [ ] Given webhook failures, when they occur, then errors are logged and alerts are sent to the operations team

#### Technical Notes
- Implement webhook validation using GitHub's X-Hub-Signature-256 header
- Support webhook events: `code_scanning_alert`, `dependabot_alert`, `deployment_review`
- Use Azure Application Gateway with WAF for DDoS protection
- Store webhook secret in Azure Key Vault

#### Labels
`backend` `api` `github` `security` `infrastructure`

#### Dependencies
- Azure app service must be deployed with HTTPS endpoint
- Azure Key Vault configured with webhook secrets

---

### Story 1.2: Implement GitHub API Client

**Priority:** High | **Story Points:** 5

#### User Story
As a **Backend Developer**
I want **to create a GitHub API client library**
So that **the bot can query repository metadata, users, and configurations**

#### Acceptance Criteria
- [ ] Given a GitHub repository, when queried via API, then repository owners are returned
- [ ] Given a commit SHA, when queried, then the commit author information is retrieved
- [ ] Given a repository, when queried, then Security champion metadata is retrieved
- [ ] Given API rate limits, when approaching threshold, then requests are throttled and queued
- [ ] Given authentication, when using GitHub Apps, then proper JWT tokens are generated

#### Technical Notes
- Use GitHub REST API v3 and GraphQL API where appropriate
- Implement OAuth 2.0 authentication with GitHub Apps
- Use in-memory caching for frequently accessed data (repository metadata, user lists) with 5-minute TTL
- Handle pagination for large result sets
- Implement exponential backoff for rate limit handling

#### Labels
`backend` `api` `github` `integration`

#### Dependencies
- GitHub App must be created and installed on target repositories
- Service must have access to GitHub App credentials

---

### Story 1.3: Map GitHub Users to Microsoft Entra ID

**Priority:** Medium | **Story Points:** 8

#### User Story
As a **System Administrator**
I want **to map GitHub usernames to Microsoft Entra ID identities**
So that **notifications are sent to the correct Teams users**

#### Acceptance Criteria
- [ ] Given a GitHub username, when looked up, then the corresponding Entra ID user is returned
- [ ] Given a GitHub email address, when matched, then the Entra ID user is found by email
- [ ] Given no direct match, when fuzzy matching is attempted, then suggested matches are returned with confidence scores
- [ ] Given mapping configuration, when updated, then changes are synchronized without service restart
- [ ] Given mapping failures, when they occur, then fallback notification mechanisms are used

#### Technical Notes
- Implement mapping database table: `github_username`, `entra_id_user_id`, `email`, `last_verified`
- Use Microsoft Graph API to query Entra ID users
- Support manual mapping overrides via configuration file
- Implement periodic sync job to validate mappings (weekly)
- Consider using custom GitHub organization SAML attributes if available

#### Labels
`backend` `integration` `identity` `database`

#### Dependencies
- Microsoft Graph API access configured
- Entra ID application registration with User.Read.All permission

---

### Story 1.4: Create Repository Metadata Cache

**Priority:** Low (Post-MVP) | **Story Points:** 5

**Status:** ⏸️ **DEFERRED - Post-MVP Enhancement**

#### User Story
As a **Backend Developer**
I want **to cache repository metadata locally**
So that **repeated API calls to GitHub are minimized and performance is optimized**

#### Acceptance Criteria
- [ ] Given a repository query, when cache is hit, then data is returned in < 50ms
- [ ] Given a repository query, when cache is stale, then data is refreshed from GitHub API
- [ ] Given repository metadata, when updated in GitHub, then cache invalidation occurs within 5 minutes
- [ ] Given cache storage, when full, then LRU eviction policy is applied
- [ ] Given cache metrics, when monitored, then hit/miss ratio is > 80%

#### Technical Notes
**MVP Approach:**
- Use in-memory caching only for MVP (simple Map-based cache with TTL)
- Cache TTL: 5 minutes for repository metadata, 1 hour for user lists
- No persistence required for single-instance deployment
- Built-in fallback mechanisms already implemented in code

**Post-MVP Enhancement (when needed):**
- Upgrade to Redis/Azure Cache for Redis for distributed caching
- Enable when scaling to multiple app service instances
- Add cache warming on application startup for active repositories
- Implement cache bypass header for troubleshooting

#### Labels
`backend` `performance` `caching` `post-mvp`

#### Dependencies
- None for MVP (in-memory cache works out-of-box)
- For distributed: Azure Cache for Redis provisioned (Story 6.5)

---

# Epic 2: Code Scanning Alert Processing

## Overview
Automate the processing and notification workflow for GitHub code scanning alerts marked as critical or high severity. This epic ensures that security vulnerabilities are immediately escalated to the right stakeholders through Microsoft Teams.

## Goals
- Detect critical and high severity code scanning alerts in real-time
- Identify responsible developers and security stakeholders
- Send actionable notifications to Microsoft Teams
- Track alert resolution and escalation

## Success Metrics
- 100% of critical/high alerts result in Teams notification within 30 seconds
- 95% of alerts have correctly identified responsible parties
- < 5% false positive rate for severity classification
- Alert resolution time reduced by 40%

## Estimated Effort
**Size:** X-Large

---

### Story 2.1: Filter Code Scanning Alerts by Severity

**Priority:** High | **Story Points:** 3

#### User Story
As a **Security Engineer**
I want **to filter code scanning alerts by severity level**
So that **only critical and high severity issues trigger immediate notifications**

#### Acceptance Criteria
- [ ] Given a code scanning webhook, when severity is "critical", then the alert is processed
- [ ] Given a code scanning webhook, when severity is "high", then the alert is processed
- [ ] Given a code scanning webhook, when severity is "medium" or lower, then the alert is logged but not escalated
- [ ] Given alert metadata, when parsed, then CWE/CVE identifiers are extracted
- [ ] Given filtering rules, when configured, then custom severity mappings can override defaults

#### Technical Notes
- Parse `alert.rule.severity` from webhook payload
- Support GitHub Security Advisory severity levels: critical, high, medium, low
- Log all alerts to Azure Log Analytics regardless of severity
- Allow repository-specific severity override configuration
- Extract vulnerability details: CWE ID, CVSS score, affected file paths

#### Labels
`backend` `security` `bot-handlers` `filtering`

#### Dependencies
- Code scanning webhook endpoint configured (Story 1.1)

---

### Story 2.2: Identify Commit Author from Alert

**Priority:** High | **Story Points:** 3

#### User Story
As a **Security Engineer**
I want **to identify who made the commit that triggered the alert**
So that **the responsible developer can be notified and take immediate action**

#### Acceptance Criteria
- [ ] Given a code scanning alert, when the commit SHA is available, then the author is retrieved from GitHub API
- [ ] Given a commit author, when their GitHub username is known, then their Entra ID identity is resolved
- [ ] Given multiple commits, when they contributed to the vulnerability, then all authors are identified
- [ ] Given a bot commit, when detected, then the human who triggered the bot is identified
- [ ] Given identification failure, when it occurs, then repository owners are notified as fallback

#### Technical Notes
- Use `alert.most_recent_instance.commit_sha` from webhook payload
- Query GitHub Commits API: `GET /repos/{owner}/{repo}/commits/{sha}`
- Handle merge commits by identifying the PR author
- Map GitHub committer vs author (use author for responsibility)
- Support GitHub Enterprise Server if needed

#### Labels
`backend` `github` `bot-handlers` `user-mapping`

#### Dependencies
- GitHub API client implemented (Story 1.2)
- User mapping service available (Story 1.3)

---

### Story 2.3: Retrieve Repository Owners

**Priority:** High | **Story Points:** 3

#### User Story
As a **Repository Administrator**
I want **to automatically retrieve the 2 designated repository owners**
So that **they are included in critical security notifications**

#### Acceptance Criteria
- [ ] Given a repository, when queried, then exactly 2 owners are returned (if configured)
- [ ] Given repository metadata, when owners are stored in CODEOWNERS file, then they are parsed correctly
- [ ] Given repository metadata, when owners are stored in custom properties, then they are retrieved
- [ ] Given fewer than 2 owners, when this occurs, then available owners plus admins are used
- [ ] Given owner resolution failure, when it happens, then organization admins are notified

#### Technical Notes
- Check GitHub repository custom properties: `owner_1`, `owner_2`
- Parse CODEOWNERS file: look for `* @owner1 @owner2` default rule
- Fall back to repository "Admin" role members if owners not defined
- Use in-memory cache for owner information (TTL: 1 hour)
- Support email-based owner definition for non-GitHub users

#### Labels
`backend` `github` `bot-handlers` `governance`

#### Dependencies
- GitHub API client implemented (Story 1.2)
- In-memory repository metadata cache (built-in)

---

### Story 2.4: Identify Security Champion

**Priority:** High | **Story Points:** 5

#### User Story
As a **Security Team Lead**
I want **to retrieve the designated Security Champion for each repository**
So that **security expertise is immediately available for critical vulnerabilities**

#### Acceptance Criteria
- [ ] Given a repository, when queried, then the Security Champion is identified
- [ ] Given repository metadata, when Security Champion is defined in custom properties, then it is retrieved
- [ ] Given repository topics, when "security-champion:username" is present, then it is parsed
- [ ] Given no Security Champion defined, when this occurs, then organization security team is notified
- [ ] Given Security Champion mapping, when updated, then changes reflect within 5 minutes

#### Technical Notes
- Check GitHub repository custom properties: `security_champion`
- Check repository topics for `security-champion:@username` pattern
- Maintain fallback list in configuration: default Security Champions per organization/team
- Validate Security Champion has necessary repository access
- Log Security Champion assignments to audit trail

#### Labels
`backend` `github` `security` `bot-handlers`

#### Dependencies
- GitHub API client implemented (Story 1.2)
- In-memory repository metadata cache (built-in)

---

### Story 2.5: Retrieve Teams Users for Notification

**Priority:** High | **Story Points:** 3

#### User Story
As a **Integration Developer**
I want **to retrieve Teams users corresponding to GitHub stakeholders**
So that **notifications can be sent to the correct Teams channels and users**

#### Acceptance Criteria
- [ ] Given GitHub usernames, when mapped to Entra ID, then Teams user IDs are retrieved
- [ ] Given Teams users, when they don't exist in tenant, then fallback notifications are used
- [ ] Given Teams presence, when available, then notification urgency is adjusted
- [ ] Given multiple users, when retrieved in batch, then API calls are optimized
- [ ] Given user retrieval failure, when it occurs, then errors are logged and retried

#### Technical Notes
- Use Microsoft Graph API: `GET /users/{id}`
- Batch user lookups: `POST /$batch` (max 20 per request)
- Use in-memory cache for Teams user objects (TTL: 1 hour)
- Retrieve user presence: `GET /users/{id}/presence` for urgency handling
- Handle guest users and external collaborators

#### Labels
`backend` `microsoft-graph` `teams` `bot-handlers`

#### Dependencies
- User mapping service (Story 1.3)
- Microsoft Graph API access configured

---

### Story 2.6: Send Code Scanning Alert Notification to Teams

**Priority:** High | **Story Points:** 5

#### User Story
As a **Developer**
I want **to receive actionable code scanning alerts in Microsoft Teams**
So that **I can quickly understand and remediate critical vulnerabilities**

#### Acceptance Criteria
- [ ] Given a critical alert, when processed, then an Adaptive Card is sent to Teams within 30 seconds
- [ ] Given the notification, when displayed, then it includes alert severity, description, affected file, commit author, and remediation link
- [ ] Given the notification, when clicked, then it opens the GitHub alert page
- [ ] Given the notification, when "Acknowledge" is clicked, then the user is recorded and alert is tracked
- [ ] Given multiple stakeholders, when notified, then each receives a personalized message

#### Technical Notes
- Use Microsoft Teams Incoming Webhook or Bot Framework
- Design Adaptive Card with:
  - Alert title and severity badge
  - Vulnerability description (CWE/CVE)
  - Affected file path and line numbers
  - Commit author and SHA (short)
  - Repository owners and Security Champion tags
  - Action buttons: "View in GitHub", "Acknowledge", "Escalate"
- Send to: commit author (1-on-1), repository owners (1-on-1), Security Champion (1-on-1), team channel
- Implement message threading for related alerts
- Store notification status in database

#### Labels
`backend` `teams` `notifications` `ux` `bot-handlers`

#### Dependencies
- Teams integration configured (Epic 5)
- All stakeholder identification stories completed (2.2, 2.3, 2.4, 2.5)

---

# Epic 3: Dependabot Alert Processing

## Overview
Automate the processing and notification workflow for Dependabot security alerts. This epic ensures that dependency vulnerabilities are communicated to Security Champions and repository members with optional flag to include all members.

## Goals
- Detect Dependabot security alerts in real-time
- Identify Security Champions and repository members
- Send contextual notifications to Microsoft Teams
- Track alert acknowledgment and resolution

## Success Metrics
- 100% of Dependabot alerts result in Teams notification within 60 seconds
- 90% of Security Champions acknowledge alerts within 2 hours
- Dependency update rate increases by 50%
- Mean time to remediation reduced by 30%

## Estimated Effort
**Size:** Large

---

### Story 3.1: Receive and Parse Dependabot Webhooks

**Priority:** High | **Story Points:** 3

#### User Story
As a **Backend Developer**
I want **to receive and parse Dependabot alert webhooks**
So that **dependency vulnerabilities can be processed and routed for notification**

#### Acceptance Criteria
- [ ] Given a Dependabot webhook, when received, then the payload is validated and parsed
- [ ] Given alert metadata, when extracted, then package name, vulnerability severity, and affected versions are captured
- [ ] Given advisory information, when available, then CVE/GHSA IDs and CVSS scores are extracted
- [ ] Given alert state changes, when they occur, then only "created" and "reopened" states trigger notifications
- [ ] Given malformed payloads, when received, then errors are logged and alerts sent to operations

#### Technical Notes
- Parse webhook action: `created`, `dismissed`, `fixed`, `reopened`
- Extract: `alert.security_advisory`, `alert.security_vulnerability`, `alert.dependency`
- Extract CVSS score and severity: `alert.security_advisory.severity`
- Validate webhook signature using GitHub webhook secret
- Log all Dependabot alerts to Azure Log Analytics for trend analysis

#### Labels
`backend` `github` `security` `bot-handlers`

#### Dependencies
- GitHub webhook endpoint configured (Story 1.1)

---

### Story 3.2: Identify Security Champion for Dependabot Alerts

**Priority:** High | **Story Points:** 2

#### User Story
As a **Security Team Lead**
I want **to identify the Security Champion when Dependabot alerts occur**
So that **the right security expert is immediately notified**

#### Acceptance Criteria
- [ ] Given a repository with Dependabot alert, when Security Champion is queried, then the designated person is identified
- [ ] Given Security Champion identification, when it uses the same logic as code scanning, then implementation is reused
- [ ] Given no Security Champion, when this occurs, then organization security team is used as fallback
- [ ] Given Security Champion retrieval, when it completes, then response time is < 200ms

#### Technical Notes
- Reuse Security Champion identification logic from Story 2.4
- Ensure consistent behavior across alert types
- Log Security Champion assignments for audit purposes

#### Labels
`backend` `security` `bot-handlers` `reuse`

#### Dependencies
- Security Champion identification implemented (Story 2.4)

---

### Story 3.3: Retrieve Repository Members with Flag Support

**Priority:** High | **Story Points:** 5

#### User Story
As a **Repository Administrator**
I want **to retrieve all repository members with optional inclusion flag**
So that **Dependabot notifications can be sent to all members when configured**

#### Acceptance Criteria
- [ ] Given a repository, when members are queried, then all collaborators with write/admin access are returned
- [ ] Given a repository configuration, when "notify_all_members" flag is true, then all members are included in notifications
- [ ] Given a repository configuration, when "notify_all_members" flag is false, then only Security Champion is notified
- [ ] Given large repositories, when member lists exceed 50 users, then pagination is handled correctly
- [ ] Given member retrieval, when using in-memory cache, then cache invalidation occurs every 6 hours

#### Technical Notes
- Query GitHub API: `GET /repos/{owner}/{repo}/collaborators`
- Filter by permission level: `admin`, `write` (exclude `read` unless configured)
- Check repository custom property: `dependabot_notify_all_members` (boolean)
- Default behavior: notify Security Champion only
- Store flag configuration in database with repository ID
- Support team-based notifications: if repository is owned by a team, notify team members

#### Labels
`backend` `github` `bot-handlers` `configuration`

#### Dependencies
- GitHub API client implemented (Story 1.2)
- In-memory repository metadata cache (built-in)

---

### Story 3.4: Map Repository Members to Teams Users

**Priority:** High | **Story Points:** 3

#### User Story
As a **Integration Developer**
I want **to map repository members to Teams users**
So that **Dependabot notifications reach the correct people in Teams**

#### Acceptance Criteria
- [ ] Given repository members list, when mapped, then Teams user IDs are resolved for all members
- [ ] Given unmapped users, when they exist, then warnings are logged and admins are notified
- [ ] Given batch mapping, when performed, then API calls are optimized using Graph API $batch
- [ ] Given in-memory mapping cache, when used, then stale data is refreshed every hour

#### Technical Notes
- Reuse user mapping logic from Story 1.3
- Batch process: chunk repository members into groups of 20 for Graph API batch requests
- Handle mapping failures gracefully: continue with successfully mapped users
- Log unmapped users for manual review

#### Labels
`backend` `microsoft-graph` `teams` `bot-handlers`

#### Dependencies
- User mapping service (Story 1.3)
- Repository members retrieval (Story 3.3)

---

### Story 3.5: Send Dependabot Alert Notification to Teams

**Priority:** High | **Story Points:** 5

#### User Story
As a **Developer**
I want **to receive Dependabot alerts in Microsoft Teams**
So that **I can quickly assess and update vulnerable dependencies**

#### Acceptance Criteria
- [ ] Given a Dependabot alert, when processed, then an Adaptive Card is sent to Teams within 60 seconds
- [ ] Given the notification, when displayed, then it includes package name, vulnerability severity, CVSS score, advisory link, and recommended version
- [ ] Given "notify_all_members" flag is true, when alert is sent, then all repository members receive notification
- [ ] Given "notify_all_members" flag is false, when alert is sent, then only Security Champion receives notification
- [ ] Given the notification, when "View Advisory" is clicked, then the GitHub Security Advisory opens
- [ ] Given the notification, when "Create PR" is clicked, then Dependabot is triggered to create update PR

#### Technical Notes
- Design Adaptive Card with:
  - Vulnerability title and severity badge (color-coded)
  - Package name and affected version range
  - CVE/GHSA identifiers and CVSS score
  - Description and impact summary
  - Recommended fix version
  - Action buttons: "View Advisory", "Create PR", "Dismiss"
- Send to: Security Champion (1-on-1), optionally all members (1-on-1 or channel), security team channel
- Group related alerts: if multiple Dependabot alerts in short time, batch into single notification
- Store notification delivery status

#### Labels
`backend` `teams` `notifications` `security` `ux` `bot-handlers`

#### Dependencies
- Teams integration configured (Epic 5)
- Security Champion identification (Story 3.2)
- Repository members retrieval and mapping (Stories 3.3, 3.4)

---

# Epic 4: Deployment Review Workflow

## Overview
Implement automated deployment approval workflow that integrates GitHub deployment protection rules with Microsoft Teams for interactive approval requests. This epic enables compliant and auditable deployment processes.

## Goals
- Receive deployment review requests from GitHub Actions
- Identify designated approvers from deployment protection rules
- Send interactive approval requests to Teams
- Process approvals/rejections and update GitHub deployment status
- Maintain audit trail of all deployment decisions

## Success Metrics
- 100% of deployment reviews require explicit approval
- Average approval response time < 15 minutes
- Zero deployments proceed without proper approval
- 100% audit trail coverage for compliance

## Estimated Effort
**Size:** X-Large

---

### Story 4.1: Receive Deployment Review Webhooks

**Priority:** High | **Story Points:** 3

#### User Story
As a **DevOps Engineer**
I want **to receive deployment review webhooks from GitHub**
So that **approval workflows can be initiated automatically**

#### Acceptance Criteria
- [ ] Given a deployment protection rule, when triggered, then the `deployment_status` webhook is received
- [ ] Given the webhook payload, when parsed, then environment name, deployment ID, and requestor are extracted
- [ ] Given deployment metadata, when available, then commit SHA, branch, and PR information are captured
- [ ] Given webhook validation, when performed, then only authentic GitHub requests are processed
- [ ] Given webhook processing, when it completes, then GitHub is notified of receipt within 10 seconds

#### Technical Notes
- Parse webhook action: `deployment_protection_rule.requested`
- Extract: `deployment.environment`, `deployment.id`, `deployment.sha`, `deployment.ref`
- Extract requestor: `deployment.creator.login`
- Extract reviewers from: `deployment_protection_rule.reviewers`
- Respond to GitHub with HTTP 200 to acknowledge receipt
- Store deployment request in database with status "pending"

#### Labels
`backend` `github` `deployments` `bot-handlers`

#### Dependencies
- GitHub webhook endpoint configured (Story 1.1)

---

### Story 4.2: Retrieve Deployment Approvers from Rules

**Priority:** High | **Story Points:** 5

#### User Story
As a **Release Manager**
I want **to retrieve the configured deployment approvers from GitHub protection rules**
So that **only authorized individuals can approve production deployments**

#### Acceptance Criteria
- [ ] Given a deployment environment, when queried, then all configured reviewers are returned
- [ ] Given protection rules, when they specify teams, then all team members are retrieved
- [ ] Given protection rules, when they specify individuals, then those users are identified
- [ ] Given multiple protection rules, when they exist, then all approvers are consolidated (union)
- [ ] Given approver requirements, when defined, then minimum number of approvals is captured

#### Technical Notes
- Query GitHub API: `GET /repos/{owner}/{repo}/environments/{environment_name}`
- Parse `protection_rules.reviewers`: can be users or teams
- For teams: query `GET /teams/{team_id}/members`
- Extract: `required_reviewers.type` (User or Team), `required_reviewers.id`
- Extract: `protection_rules.required_reviewers.count` for minimum approvals needed
- Use in-memory cache for environment protection rules (TTL: 10 minutes)

#### Labels
`backend` `github` `deployments` `authorization` `bot-handlers`

#### Dependencies
- GitHub API client implemented (Story 1.2)
- Deployment review webhook received (Story 4.1)

---

### Story 4.3: Map Approvers to Teams Users

**Priority:** High | **Story Points:** 3

#### User Story
As a **Integration Developer**
I want **to map GitHub deployment approvers to Teams users**
So that **approval requests can be sent to the correct Teams users**

#### Acceptance Criteria
- [ ] Given GitHub approvers list, when mapped, then all Teams user IDs are resolved
- [ ] Given unmapped approvers, when they exist, then fallback notifications are sent to admins
- [ ] Given approver mapping, when using in-memory cache, then TTL is 30 minutes
- [ ] Given batch processing, when needed, then Graph API batch requests are used

#### Technical Notes
- Reuse user mapping logic from Story 1.3
- Batch process approvers (max 20 per Graph API batch request)
- Handle external collaborators: send email notification if not in Teams tenant
- Log mapping statistics for audit

#### Labels
`backend` `microsoft-graph` `teams` `bot-handlers`

#### Dependencies
- User mapping service (Story 1.3)
- Deployment approvers retrieved (Story 4.2)

---

### Story 4.4: Send Deployment Approval Request to Teams

**Priority:** High | **Story Points:** 8

#### User Story
As a **Release Manager**
I want **to receive interactive deployment approval requests in Teams**
So that **I can review deployment details and approve or reject from within Teams**

#### Acceptance Criteria
- [ ] Given a deployment review, when initiated, then all approvers receive an Adaptive Card in Teams within 30 seconds
- [ ] Given the Adaptive Card, when displayed, then it shows environment, branch, commit, requestor, changes summary, and approval buttons
- [ ] Given the "Approve" button, when clicked, then approval is recorded and sent to GitHub
- [ ] Given the "Reject" button, when clicked, then rejection reason modal appears and deployment is blocked
- [ ] Given required approvals count, when met, then deployment proceeds automatically
- [ ] Given approval timeout, when exceeded, then deployment is auto-rejected and requestor is notified

#### Technical Notes
- Design Adaptive Card with:
  - Deployment environment name (e.g., "Production")
  - Target branch and commit SHA (short)
  - Requestor name and timestamp
  - Changes summary: list of commits or PR title
  - Links: "View Deployment", "View Changes", "View Environment"
  - Action buttons: "Approve", "Reject", "View Details"
  - Status indicator: "X of Y approvals required"
- Send to: each approver (1-on-1), deployment channel (informational)
- Use Teams Bot Framework for interactive buttons
- Implement approval expiration: 4 hours default (configurable)
- Update card in real-time as approvals are received
- Store approval decisions in database with timestamp and approver ID

#### Labels
`backend` `teams` `notifications` `deployments` `ux` `bot-handlers`

#### Dependencies
- Teams Bot Framework configured (Epic 5)
- Approvers mapped to Teams users (Story 4.3)

---

### Story 4.5: Process Approval and Update GitHub

**Priority:** High | **Story Points:** 5

#### User Story
As a **DevOps Engineer**
I want **Teams approval actions to update GitHub deployment status**
So that **deployments proceed or are blocked based on Teams approvals**

#### Acceptance Criteria
- [ ] Given an "Approve" action, when clicked in Teams, then approval is recorded and GitHub is notified via API
- [ ] Given a "Reject" action, when clicked in Teams, then rejection is recorded with reason and GitHub is notified
- [ ] Given required approvals count, when reached, then GitHub deployment status is set to "approved"
- [ ] Given any rejection, when recorded, then GitHub deployment status is set to "rejected" immediately
- [ ] Given approval/rejection, when processed, then audit log entry is created
- [ ] Given GitHub notification failure, when it occurs, then retry logic is triggered (max 3 attempts)

#### Technical Notes
- Use GitHub API: `POST /repos/{owner}/{repo}/actions/runs/{run_id}/deployment_protection_rule`
- Send approval: `{"environment_name": "...", "state": "approved", "comment": "Approved by @user via Teams"}`
- Send rejection: `{"environment_name": "...", "state": "rejected", "comment": "Rejected by @user: [reason]"}`
- Update Teams card to show approval status in real-time
- Disable action buttons after sufficient approvals or any rejection
- Send confirmation message to approver: "Your approval has been recorded"
- Notify deployment requestor of approval/rejection

#### Labels
`backend` `github` `teams` `deployments` `bot-handlers`

#### Dependencies
- Deployment approval request sent (Story 4.4)
- Teams Bot messaging configured

---

### Story 4.6: Implement Deployment Approval Audit Trail

**Priority:** Medium | **Story Points:** 5

#### User Story
As a **Compliance Officer**
I want **complete audit trail of all deployment approvals and rejections**
So that **compliance requirements are met and deployment decisions are traceable**

#### Acceptance Criteria
- [ ] Given any deployment review, when initiated, then audit log entry is created with timestamp and requestor
- [ ] Given approval/rejection actions, when performed, then audit log captures approver identity, timestamp, and reason
- [ ] Given audit logs, when queried, then they are immutable and tamper-proof
- [ ] Given audit reports, when generated, then they include all deployment activities for a time range
- [ ] Given compliance requirements, when audited, then logs are retained for minimum 7 years

#### Technical Notes
- Store audit logs in dedicated Azure SQL table: `deployment_audit`
- Columns: `id`, `deployment_id`, `environment`, `event_type`, `actor_github`, `actor_entra_id`, `timestamp`, `details_json`, `source_ip`
- Implement write-only pattern: no updates or deletes allowed
- Consider Azure Immutable Blob Storage for long-term retention
- Generate monthly audit reports in PDF format
- Integrate with SIEM for real-time monitoring

#### Labels
`backend` `compliance` `audit` `database` `security`

#### Dependencies
- Database schema defined
- Deployment workflow implemented (Stories 4.1-4.5)

---

# Epic 5: Microsoft Teams Integration

## Overview
Build comprehensive Microsoft Teams integration including bot framework, adaptive card rendering, user authentication, and notification delivery. This epic provides the Teams-facing components for all ChatOps workflows.

## Goals
- Deploy Teams app with bot capabilities
- Implement user authentication via Entra ID
- Design and render adaptive cards for all alert types
- Enable interactive button actions and callbacks
- Provide notification delivery with retry logic

## Success Metrics
- Teams app successfully installed in target tenants
- 99.9% notification delivery success rate
- < 1 second adaptive card render time
- 100% interactive button success rate
- User satisfaction score > 4.5/5

## Estimated Effort
**Size:** X-Large

---

### Story 5.1: Create Teams App Manifest and Registration

**Priority:** High | **Story Points:** 5

#### User Story
As a **Teams Administrator**
I want **to create and register the ChatOps Teams app**
So that **it can be installed in the organization tenant**

#### Acceptance Criteria
- [ ] Given Teams App Studio, when app manifest is created, then it includes all required capabilities
- [ ] Given app manifest, when validated, then it passes all Teams app validation rules
- [ ] Given bot registration, when completed in Azure, then bot ID and secret are generated
- [ ] Given app package, when created, then it includes manifest, icons, and localization files
- [ ] Given app submission, when uploaded to Teams, then it is available for installation

#### Technical Notes
- Create Teams app manifest v1.16 (latest schema)
- Register bot in Azure Bot Service with Microsoft App ID
- Configure bot capabilities: `bot`, `messageExtension`, `connectors`
- Set scopes: `personal`, `team`, `groupchat`
- Define valid domains: Azure app service domain
- Create app icons: 192x192 color, 32x32 outline
- Configure Single Sign-On (SSO) with Entra ID
- Package as .zip: manifest.json, color.png, outline.png

#### Labels
`teams` `bot` `infrastructure` `azure`

#### Dependencies
- Azure Bot Service resource created
- Entra ID app registration completed

---

### Story 5.2: Implement Teams Bot Framework Service

**Priority:** High | **Story Points:** 8

#### User Story
As a **Backend Developer**
I want **to implement the Teams Bot Framework service**
So that **the bot can receive messages, handle interactions, and send notifications**

#### Acceptance Criteria
- [ ] Given Teams bot, when messages are sent to it, then they are received by the bot service
- [ ] Given adaptive card actions, when clicked, then the bot receives and processes callbacks
- [ ] Given bot authentication, when required, then OAuth 2.0 flow with Entra ID is initiated
- [ ] Given bot conversations, when managed, then conversation references are stored for proactive messaging
- [ ] Given bot errors, when they occur, then graceful error messages are sent to users

#### Technical Notes
- Use Bot Framework SDK v4 (Node.js or C#)
- Implement ActivityHandler for message processing
- Handle activity types: `message`, `invoke`, `conversationUpdate`
- Store conversation references in database for proactive notifications
- Implement OAuth connection for Entra ID authentication
- Use Bot Connector service for sending messages
- Implement rate limiting per Teams API limits
- Use Application Insights for bot telemetry

#### Labels
`backend` `teams` `bot` `nodejs` `csharp`

#### Dependencies
- Teams app registered (Story 5.1)
- Azure Bot Service configured

---

### Story 5.3: Design Adaptive Card Templates

**Priority:** High | **Story Points:** 5

#### User Story
As a **UX Designer**
I want **to design adaptive card templates for all alert types**
So that **users receive consistent, professional, and actionable notifications**

#### Acceptance Criteria
- [ ] Given code scanning alert, when rendered, then adaptive card includes all required information with clear visual hierarchy
- [ ] Given Dependabot alert, when rendered, then adaptive card highlights vulnerability severity and recommended actions
- [ ] Given deployment approval, when rendered, then adaptive card presents clear approve/reject options with deployment context
- [ ] Given card designs, when reviewed, then they follow Microsoft Teams design guidelines
- [ ] Given cards, when displayed on mobile, then they are responsive and readable

#### Technical Notes
- Use Adaptive Cards schema v1.5
- Create three templates:
  1. Code Scanning Alert Card
  2. Dependabot Alert Card
  3. Deployment Approval Card
- Design system:
  - Color coding: Red (critical), Orange (high), Yellow (medium)
  - Consistent header with icon and title
  - Fact sets for metadata
  - Action buttons in footer
- Test with Adaptive Cards Designer tool
- Support dark mode theme
- Include fallback text for unsupported clients

#### Labels
`ux` `teams` `design` `adaptive-cards`

#### Dependencies
- None (design work)

---

### Story 5.4: Implement Adaptive Card Rendering Service

**Priority:** High | **Story Points:** 5

#### User Story
As a **Backend Developer**
I want **to implement a service that dynamically renders adaptive cards**
So that **alert data can be transformed into Teams notifications**

#### Acceptance Criteria
- [ ] Given alert data, when passed to service, then appropriate adaptive card JSON is generated
- [ ] Given card templates, when variables are substituted, then all placeholders are replaced with actual data
- [ ] Given card generation, when it completes, then output is valid Adaptive Cards schema
- [ ] Given rendering errors, when they occur, then fallback plain text message is generated
- [ ] Given card size, when it exceeds limits, then content is truncated intelligently

#### Technical Notes
- Create card rendering service with template engine (Handlebars or similar)
- Implement template selection logic based on alert type
- Variable substitution: replace `{{variableName}}` with actual values
- Validate generated JSON against Adaptive Cards schema
- Implement content truncation: max card size 28 KB
- Sanitize user-generated content to prevent XSS
- Use in-memory cache for rendered cards for identical alerts (TTL: 5 minutes)

#### Labels
`backend` `teams` `adaptive-cards` `templating`

#### Dependencies
- Adaptive card templates designed (Story 5.3)

---

### Story 5.5: Implement Proactive Notification Delivery

**Priority:** High | **Story Points:** 8

#### User Story
As a **Integration Developer**
I want **to send proactive notifications to Teams users**
So that **alerts can be delivered without requiring user interaction**

#### Acceptance Criteria
- [ ] Given a Teams user ID, when notification is sent, then it appears in the user's personal chat with the bot
- [ ] Given a Teams channel, when notification is sent, then it appears in the channel feed
- [ ] Given notification delivery, when it fails, then retry logic is triggered (exponential backoff, max 5 attempts)
- [ ] Given rate limits, when approached, then sending is throttled to stay within limits
- [ ] Given notification status, when tracked, then delivery success/failure is logged

#### Technical Notes
- Use Bot Connector API for proactive messaging
- Retrieve conversation reference from database (stored during bot installation)
- For 1-on-1: use `POST /v3/conversations` with user ID
- For channels: use conversation ID stored during team installation
- Implement retry logic: exponential backoff (1s, 2s, 4s, 8s, 16s)
- Handle rate limits: 30 messages per minute per conversation
- Use message batching for multiple recipients
- Track delivery in database: `notification_id`, `recipient_id`, `status`, `attempts`, `delivered_at`

#### Labels
`backend` `teams` `notifications` `bot`

#### Dependencies
- Teams Bot Framework service implemented (Story 5.2)
- Adaptive card rendering service (Story 5.4)

---

### Story 5.6: Implement Interactive Action Handling

**Priority:** High | **Story Points:** 8

#### User Story
As a **Backend Developer**
I want **to handle interactive actions from adaptive card buttons**
So that **users can acknowledge alerts, approve deployments, and take actions directly from Teams**

#### Acceptance Criteria
- [ ] Given "Approve" button click, when received, then approval is processed and GitHub is updated
- [ ] Given "Reject" button click, when received, then rejection modal is shown for reason input
- [ ] Given "Acknowledge" button click, when received, then alert status is updated and user is recorded
- [ ] Given action processing, when completed, then adaptive card is updated to reflect new state
- [ ] Given concurrent actions, when multiple users click, then race conditions are handled correctly

#### Technical Notes
- Handle `invoke` activity type from Bot Framework
- Parse action data from `activity.value`
- Implement action handlers:
  - `approve_deployment`: call GitHub API to approve
  - `reject_deployment`: show Task Module for rejection reason, then call GitHub API
  - `acknowledge_alert`: update database with acknowledger and timestamp
  - `view_details`: send detailed card with more information
- Update original card with Bot Connector: `PUT /v3/conversations/{conversationId}/activities/{activityId}`
- Implement optimistic locking to prevent duplicate actions
- Send confirmation message to user: "Action processed successfully"
- Log all actions to audit trail

#### Labels
`backend` `teams` `bot` `interactive` `ux`

#### Dependencies
- Teams Bot Framework service (Story 5.2)
- Proactive notification delivery (Story 5.5)

---

### Story 5.7: Implement User Authentication with Entra ID

**Priority:** Medium | **Story Points:** 8

#### User Story
As a **Security Engineer**
I want **users to authenticate with Entra ID when using the Teams bot**
So that **actions are properly authorized and audit trails capture authenticated identities**

#### Acceptance Criteria
- [ ] Given unauthenticated user, when they interact with bot, then they are prompted to sign in
- [ ] Given sign-in prompt, when user completes OAuth flow, then authentication token is stored
- [ ] Given authenticated user, when they take actions, then their Entra ID identity is used for authorization
- [ ] Given token expiration, when it occurs, then user is prompted to re-authenticate
- [ ] Given authorization check, when permissions are insufficient, then user is informed and action is denied

#### Technical Notes
- Implement OAuth 2.0 Authorization Code flow with Entra ID
- Configure Teams SSO (Single Sign-On) for seamless auth
- Request Microsoft Graph scopes: `User.Read`, `TeamSettings.Read.All`
- Store tokens securely: use Azure Key Vault or encrypted database column
- Implement token refresh logic
- Check user permissions before processing actions:
  - Deployment approvals: verify user is in approvers list
  - Alert acknowledgment: verify user has repository access
- Handle authentication errors gracefully

#### Labels
`backend` `teams` `security` `authentication` `entra-id`

#### Dependencies
- Entra ID app registration with OAuth configured
- Teams Bot Framework service (Story 5.2)

---

# Epic 6: Azure Infrastructure & Security

## Overview
Deploy secure, scalable, and monitored Azure infrastructure to host the ChatOps application. This epic covers networking, application hosting, secrets management, monitoring, and security hardening.

## Goals
- Deploy Azure app service with VNet integration and WAF protection
- Implement secrets management with Azure Key Vault
- Configure monitoring and logging with Application Insights and Log Analytics
- Secure all Azure resources with managed identities and RBAC
- Implement disaster recovery and high availability

## Success Metrics
- 99.9% application uptime
- All secrets stored in Key Vault (zero secrets in code)
- < 500ms average response time for webhook processing
- Zero security vulnerabilities in infrastructure
- RTO < 1 hour, RPO < 15 minutes

## Estimated Effort
**Size:** X-Large

---

### Story 6.1: Deploy Azure Virtual Network with Subnets

**Priority:** High | **Story Points:** 5

#### User Story
As a **Cloud Architect**
I want **to deploy Azure Virtual Network with isolated subnets**
So that **application components are network-isolated and secure**

#### Acceptance Criteria
- [ ] Given Azure subscription, when VNet is created, then it has CIDR block with sufficient IP addresses (e.g., 10.0.0.0/16)
- [ ] Given VNet, when subnets are created, then at least two subnets exist: app subnet and gateway subnet
- [ ] Given subnets, when configured, then network security groups (NSGs) are attached
- [ ] Given NSGs, when rules are defined, then only required ports are open (443 for HTTPS, app-specific ports)
- [ ] Given VNet, when deployed, then it supports future expansion for additional components

#### Technical Notes
- Create VNet: `chatops-vnet` with address space `10.0.0.0/16`
- Create subnets:
  - `app-subnet`: 10.0.1.0/24 (for App Service VNet integration)
  - `gateway-subnet`: 10.0.2.0/24 (for Application Gateway)
- Create NSGs:
  - `app-nsg`: allow inbound from gateway subnet on app port, allow outbound to internet
  - `gateway-nsg`: allow inbound 443 from internet, allow outbound to app subnet
- Enable DDoS Protection Standard (optional, based on budget)
- Tag resources: `Environment: Production`, `Application: ChatOps`

#### Labels
`infrastructure` `azure` `networking` `security`

#### Dependencies
- Azure subscription with sufficient quota

---

### Story 6.2: Deploy Azure Application Gateway with WAF

**Priority:** High | **Story Points:** 8

#### User Story
As a **Security Engineer**
I want **to deploy Azure Application Gateway with Web Application Firewall**
So that **the application is protected from common web vulnerabilities and DDoS attacks**

#### Acceptance Criteria
- [ ] Given Application Gateway, when deployed, then it is SKU WAF_v2 with autoscaling enabled
- [ ] Given WAF, when configured, then it uses OWASP ruleset 3.2 or later in Prevention mode
- [ ] Given Application Gateway, when receiving requests, then it terminates HTTPS and forwards to backend app service
- [ ] Given custom domain, when configured, then SSL certificate is installed and HTTPS is enforced
- [ ] Given backend health probes, when configured, then unhealthy backends are automatically removed from pool

#### Technical Notes
- Deploy Application Gateway v2 in `gateway-subnet`
- SKU: WAF_v2 with autoscaling (min 2, max 10 instances)
- Configure WAF policy:
  - Mode: Prevention
  - Ruleset: OWASP 3.2
  - Custom rules: rate limiting (max 100 requests/minute per IP)
- Configure backend pool: Azure App Service
- Configure HTTP settings: backend protocol HTTPS, cookie-based affinity disabled
- Configure listeners: HTTPS on port 443 with SSL certificate
- Configure health probe: path `/health`, interval 30s, timeout 30s
- Enable request/response logging

#### Labels
`infrastructure` `azure` `security` `waf` `networking`

#### Dependencies
- VNet and subnets deployed (Story 6.1)
- SSL certificate obtained (Azure App Service Certificate or custom)

---

### Story 6.3: Deploy Azure App Service with VNet Integration

**Priority:** High | **Story Points:** 5

#### User Story
As a **DevOps Engineer**
I want **to deploy Azure App Service integrated with VNet**
So that **the application runs in isolated network and can access Azure services securely**

#### Acceptance Criteria
- [ ] Given App Service, when created, then it is on PremiumV3 or higher tier to support VNet integration
- [ ] Given App Service, when VNet integrated, then it is connected to app-subnet
- [ ] Given App Service, when configured, then it uses managed identity for Azure service authentication
- [ ] Given App Service, when accessed, then it only accepts traffic from Application Gateway
- [ ] Given App Service, when scaled, then it can autoscale based on CPU and memory metrics

#### Technical Notes
- Create App Service Plan: PremiumV3 P1v3 (2 cores, 8 GB RAM) with autoscaling
- Create App Service: `chatops-app-service` (Linux or Windows based on runtime)
- Enable VNet integration: connect to `app-subnet`
- Enable managed identity: system-assigned
- Configure access restrictions: allow only from Application Gateway subnet (10.0.2.0/24)
- Configure health check endpoint: `/health`
- Enable Application Insights integration
- Set environment variables:
  - `GITHUB_WEBHOOK_SECRET`: from Key Vault
  - `BOT_APP_ID`, `BOT_APP_PASSWORD`: from Key Vault
  - `AZURE_CLIENT_ID`: managed identity client ID

#### Labels
`infrastructure` `azure` `app-service` `networking`

#### Dependencies
- VNet and subnets deployed (Story 6.1)
- Application Gateway deployed (Story 6.2)

---

### Story 6.4: Deploy Azure Key Vault for Secrets Management

**Priority:** High | **Story Points:** 5

#### User Story
As a **Security Engineer**
I want **to store all application secrets in Azure Key Vault**
So that **secrets are centrally managed, encrypted, and never stored in code**

#### Acceptance Criteria
- [ ] Given Key Vault, when created, then it is configured with soft-delete and purge protection enabled
- [ ] Given Key Vault, when accessed, then only authorized services and users can retrieve secrets
- [ ] Given App Service, when it retrieves secrets, then it uses managed identity (no keys in configuration)
- [ ] Given secrets rotation, when needed, then it can be performed without application restart
- [ ] Given audit logs, when enabled, then all secret access is logged to Log Analytics

#### Technical Notes
- Create Azure Key Vault: `chatops-keyvault-{unique-suffix}`
- Enable soft-delete: 90 days retention
- Enable purge protection: prevent accidental deletion
- Configure access policies:
  - App Service managed identity: Get, List secrets
  - DevOps pipeline service principal: Get, List, Set secrets
  - Admin group: All permissions
- Store secrets:
  - `github-webhook-secret`
  - `github-app-id`, `github-app-private-key`
  - `bot-app-id`, `bot-app-password`
  - `entra-client-secret`
- Enable diagnostic logging to Log Analytics
- Use Key Vault references in App Service: `@Microsoft.KeyVault(SecretUri=...)`

#### Labels
`infrastructure` `azure` `security` `key-vault`

#### Dependencies
- App Service with managed identity deployed (Story 6.3)

---

### Story 6.5: Provision Azure Cache for Redis

**Priority:** Low (Post-MVP) | **Story Points:** 5

**Status:** ⏸️ **DEFERRED - Not Required for MVP**

#### User Story
As a **Backend Developer**
I want **Azure Cache for Redis provisioned and configured**
So that **distributed caching works across multiple App Service instances for repository metadata, conversation references, and rate limiting**

#### Rationale for Deferral
- **MVP uses single App Service instance** - distributed cache not needed
- **In-memory caching sufficient** - application has built-in fallback
- **Cost optimization** - Premium P1 Redis (~$184/month) expensive for dev/test
- **Deployment complexity** - Redis creation takes 45-60 minutes, causing pipeline timeouts
- **Enable when needed:** Multi-instance scaling or production deployment

#### Acceptance Criteria
- [ ] Given Redis cache, when provisioned, then it uses Premium tier with persistence and geo-replication enabled
- [ ] Given Redis connection, when App Service accesses it, then TLS encryption is enforced
- [ ] Given cache eviction, when memory limit reached, then LRU (allkeys-lru) policy is applied
- [ ] Given cache metrics, when monitored, then hit/miss ratio, memory usage, and connection count are tracked in Application Insights
- [ ] Given Redis credentials, when stored, then they are retrieved from Key Vault using managed identity

#### Technical Notes
**When to Enable:**
- Scaling to 2+ App Service instances (horizontal scaling required)
- Production environment deployment
- GitHub API rate limits becoming a concern
- Need for persistent cache across deployments

**Implementation Details:**
- Create Azure Cache for Redis: `chatops-redis-{unique-suffix}`
- SKU: Premium P1 (6GB) or higher for production
  - Supports data persistence (RDB and AOF)
  - Supports geo-replication for disaster recovery
  - Provides VNet integration
- Configuration:
  - Enable TLS 1.2 minimum version
  - Enable persistence: RDB snapshot every 15 minutes
  - Set maxmemory-policy: `allkeys-lru`
  - Configure firewall: allow App Service subnet only
- Integrate with VNet:
  - Deploy Redis into dedicated subnet: `chatops-redis-subnet` (10.0.4.0/24)
  - Configure private endpoint for secure connectivity
- Store connection details in Key Vault:
  - `redis-host`: `{cache-name}.redis.cache.windows.net`
  - `redis-port`: `6380`
  - `redis-access-key`: Primary access key
- Configure App Service environment variables:
  - `REDIS_HOST`: Reference Key Vault secret
  - `REDIS_PORT`: `6380`
  - `REDIS_PASSWORD`: Reference Key Vault secret
  - `REDIS_TLS`: `true`
- Enable diagnostic logs: send to Log Analytics workspace
- Create cache performance alerts:
  - Server load > 90% for 5 minutes
  - Cache misses > 50% for 10 minutes
  - Connection errors > 5 in 5 minutes

#### Labels
`infrastructure` `azure` `redis` `caching` `performance` `post-mvp`

#### Dependencies
- VNet and subnets deployed (Story 6.1)
- App Service with managed identity deployed (Story 6.3)
- Key Vault deployed (Story 6.4)
- Application code already supports Redis with fallback (built-in)

---

### Story 6.6: Configure Application Insights and Logging

**Priority:** High | **Story Points:** 5

#### User Story
As a **DevOps Engineer**
I want **comprehensive monitoring and logging with Application Insights**
So that **application performance and errors are tracked and alerted**

#### Acceptance Criteria
- [ ] Given Application Insights, when configured, then all application logs, traces, and telemetry are collected
- [ ] Given custom metrics, when defined, then webhook processing time, notification delivery rate, and error rates are tracked
- [ ] Given alerts, when configured, then operations team is notified of high error rates, slow responses, or service outages
- [ ] Given dashboards, when created, then they provide real-time visibility into application health
- [ ] Given log retention, when set, then logs are retained for minimum 90 days

#### Technical Notes
- Create Application Insights: `chatops-appinsights`
- Connect to Log Analytics workspace for long-term retention
- Configure App Service to send logs to Application Insights
- Configure Bot Service to send telemetry to Application Insights
- Create custom metrics:
  - `webhook_processing_duration_ms`
  - `notification_delivery_success_rate`
  - `github_api_call_duration_ms`
  - `teams_api_call_duration_ms`
- Create alerts:
  - Availability < 99% for 5 minutes
  - Error rate > 5% for 5 minutes
  - Avg response time > 2 seconds for 5 minutes
  - Failed dependencies > 10% for 5 minutes
- Create Azure Dashboard with:
  - Request rate and response time
  - Failure rate by type
  - Dependency call rates (GitHub, Teams, Graph API)
  - Webhook processing funnel

#### Labels
`infrastructure` `azure` `monitoring` `observability`

#### Dependencies
- App Service deployed (Story 6.3)
- Azure Cache for Redis deployed (Story 6.5)
- Application code instrumented with Application Insights SDK

---

### Story 6.7: Implement Database for State and Audit

**Priority:** High | **Story Points:** 5

#### User Story
As a **Backend Developer**
I want **a database to store application state, audit logs, and configuration**
So that **data is persisted reliably and can be queried for reporting**

#### Acceptance Criteria
- [ ] Given database, when deployed, then it is Azure SQL Database or PostgreSQL with geo-replication
- [ ] Given database schema, when designed, then it includes tables for: deployment requests, approvals, audit logs, user mappings, notifications
- [ ] Given database access, when from App Service, then managed identity is used for authentication
- [ ] Given backups, when configured, then automated daily backups with 35-day retention are enabled
- [ ] Given connection pooling, when implemented, then it optimizes database connections under load

#### Technical Notes
- Create Azure SQL Database: `chatops-db` (S2 Standard tier or higher)
- Or create Azure Database for PostgreSQL: Flexible Server
- Enable geo-replication: secondary region for disaster recovery
- Enable Transparent Data Encryption (TDE)
- Create tables:
  - `deployment_requests`: id, repo, environment, sha, requestor, status, created_at
  - `deployment_approvals`: id, deployment_id, approver, action, reason, created_at
  - `audit_logs`: id, event_type, actor, details, created_at
  - `user_mappings`: github_username, entra_id, email, last_verified
  - `notifications`: id, type, recipient, status, attempts, delivered_at
  - `repository_config`: repo_id, notify_all_members, security_champion
- Configure firewall: allow App Service subnet
- Enable managed identity authentication
- Implement connection pooling in application

#### Labels
`infrastructure` `azure` `database` `data`

#### Dependencies
- VNet deployed (Story 6.1)
- App Service with managed identity (Story 6.3)

---

### Story 6.8: Implement Infrastructure as Code with Bicep/Terraform

**Priority:** Medium | **Story Points:** 8

#### User Story
As a **DevOps Engineer**
I want **all Azure infrastructure defined as code**
So that **deployments are repeatable, version-controlled, and automated**

#### Acceptance Criteria
- [ ] Given IaC templates, when executed, then all Azure resources are deployed consistently
- [ ] Given parameter files, when provided, then different environments (dev, staging, prod) can be deployed
- [ ] Given CI/CD pipeline, when triggered, then infrastructure changes are validated and deployed automatically
- [ ] Given state management, when used, then infrastructure drift is detected and corrected
- [ ] Given documentation, when provided, then deployment process is clearly explained

#### Technical Notes
- Choose IaC tool: Azure Bicep (recommended) or Terraform
- Create modules for:
  - Networking (VNet, subnets, NSGs)
  - Application Gateway with WAF
  - App Service Plan and App Service
  - Key Vault
  - Azure Cache for Redis
  - Application Insights
  - Database
  - Bot Service
- Create parameter files: `dev.parameters.json`, `staging.parameters.json`, `prod.parameters.json`
- Implement GitHub Actions workflow:
  - Lint IaC templates
  - Validate templates with `what-if` preview
  - Deploy to dev on PR merge to `develop`
  - Deploy to prod on PR merge to `main` (with manual approval)
- Store state in Azure Storage Account (if using Terraform)
- Tag all resources consistently

#### Labels
`infrastructure` `azure` `iac` `devops` `automation`

#### Dependencies
- All infrastructure stories completed (6.1-6.7)
- GitHub repository created

---

### Story 6.9: Implement Disaster Recovery and High Availability

**Priority:** Medium | **Story Points:** 8

#### User Story
As a **Cloud Architect**
I want **disaster recovery and high availability mechanisms**
So that **the application remains available during regional outages or failures**

#### Acceptance Criteria
- [ ] Given regional outage, when detected, then traffic is automatically routed to secondary region
- [ ] Given database, when replicated, then changes are synchronized to secondary region with < 5 second lag
- [ ] Given RTO requirement, when failover occurs, then service is restored within 1 hour
- [ ] Given RPO requirement, when disaster occurs, then data loss is < 15 minutes
- [ ] Given DR testing, when performed quarterly, then documented runbooks are followed and validated

#### Technical Notes
- Deploy multi-region architecture:
  - Primary region: e.g., East US
  - Secondary region: e.g., West US
- Use Azure Front Door or Traffic Manager for global load balancing
- Configure health probes: failover to secondary if primary unhealthy for 1 minute
- Enable database geo-replication: primary → secondary (read replica)
- Synchronize Key Vault secrets to secondary region
- Create DR runbook:
  1. Detect outage (monitoring alerts)
  2. Verify secondary region health
  3. Initiate failover: promote secondary database to primary
  4. Update DNS/Traffic Manager to route to secondary
  5. Monitor and validate traffic flow
  6. Document incident
- Implement backup strategies:
  - Database: automated backups, point-in-time restore enabled
  - Application configuration: stored in Git repository
  - Secrets: Key Vault with soft-delete

#### Labels
`infrastructure` `azure` `disaster-recovery` `high-availability`

#### Dependencies
- All infrastructure deployed in primary region (Stories 6.1-6.8)

---

### Story 6.9: Parameterize Resource Group Name with Environment Variable

**Priority:** High | **Story Points:** 2

#### User Story
As a **DevOps Engineer**
I want **the resource group name to include the environment variable**
So that **infrastructure for different environments (dev, staging, prod) is properly isolated**

#### Acceptance Criteria
- [ ] Given Terraform configuration, when resource group is defined, then it uses the `var.environment` variable in the name
- [ ] Given environment is "dev", when deployed, then resource group is named `rg-chatops-dev`
- [ ] Given environment is "prod", when deployed, then resource group is named `rg-chatops-prod`
- [ ] Given multiple environments, when deployed simultaneously, then each has its own isolated resource group
- [ ] Given existing infrastructure, when updated, then Terraform handles the resource group rename gracefully

#### Technical Notes
- Update `infrastructure/main.tf`:
  - Change `name = "rg-chatops-prod"` to `name = "rg-chatops-${var.environment}"`
- Verify `var.environment` is defined in `variables.tf` with appropriate validation
- Update workflow files (`.github/workflows/infra-deploy-dev.yml`) to ensure `TF_VAR_environment` is set correctly
- If resource already exists with old name, consider:
  - Option 1: Manual migration (export/import resources)
  - Option 2: Allow Terraform to recreate (destroys and creates)
  - Option 3: Use `terraform state mv` to update state without recreating

#### Labels
`infrastructure` `terraform` `azure` `devops`

#### Dependencies
- Terraform infrastructure exists (Story 6.7)
- Environment variable defined in `variables.tf`

---

# Epic 8: Self-Hosted GitHub Runners in VNet

## Overview
Deploy GitHub Actions self-hosted runners within a dedicated subnet in the Azure VNet to enable secure infrastructure deployments without requiring public access to Azure resources. This epic eliminates the need for public endpoints while maintaining full CI/CD automation capabilities.

## Goals
- Deploy self-hosted GitHub Actions runners in a secure VNet subnet
- Enable private connectivity to all Azure resources (Key Vault, App Service, Redis, etc.)
- Remove dependency on public access for infrastructure deployments
- Implement automatic runner scaling based on workload
- Ensure secure runner configuration with secrets management

## Success Metrics
- 100% of infrastructure deployments execute via self-hosted runners
- Zero public access endpoints required for CI/CD operations
- Runner provisioning time < 5 minutes
- 99.5% runner availability during business hours
- < 2 minute delay from workflow trigger to runner assignment

## User Stories
- [Story 8.1: Create Dedicated Subnet for GitHub Runners](#story-81-create-dedicated-subnet-for-github-runners)
- [Story 8.2: Deploy Azure Container Instances for Runners](#story-82-deploy-azure-container-instances-for-runners)
- [Story 8.3: Configure Runner Authentication and Registration](#story-83-configure-runner-authentication-and-registration)
- [Story 8.4: Implement Private Network Connectivity](#story-84-implement-private-network-connectivity)
- [Story 8.5: Create GitHub Actions Workflows for Runner-Based Deployment](#story-85-create-github-actions-workflows-for-runner-based-deployment)
- [Story 8.6: Implement Runner Auto-Scaling](#story-86-implement-runner-auto-scaling)
- [Story 8.7: Configure Monitoring and Alerts for Runners](#story-87-configure-monitoring-and-alerts-for-runners)

## Dependencies
- Azure VNet and subnets configured (Epic 6)
- Key Vault with private endpoint (Story 6.4)
- Network security groups and routing configured

## Estimated Effort
**Size:** X-Large

---

### Story 8.1: Create Dedicated Subnet for GitHub Runners

**Priority:** High | **Story Points:** 5

#### User Story
As a **DevOps Engineer**
I want **to create a dedicated subnet within the VNet for GitHub Actions runners**
So that **runners have isolated network resources and proper security boundaries**

#### Acceptance Criteria
- [ ] Given the existing VNet, when the runner subnet is created, then it has a /27 CIDR block (32 addresses)
- [ ] Given the runner subnet, when NSG rules are applied, then outbound HTTPS (443) to GitHub is allowed
- [ ] Given the runner subnet, when NSG rules are applied, then inbound traffic is denied except from Application Gateway subnet
- [ ] Given the runner subnet, when created, then it has service endpoints for Key Vault, Storage, and SQL
- [ ] Given the runner subnet, when delegated, then Azure Container Instances can deploy resources

#### Technical Notes
- Subnet naming: `snet-github-runners-{environment}`
- Address space: Use next available /27 from VNet address space
- NSG rules required:
  - Outbound: Allow 443 to GitHub (`api.github.com`, `github.com`, `*.actions.githubusercontent.com`)
  - Outbound: Allow 443 to Azure services (Key Vault, Storage, Container Registry)
  - Outbound: Allow DNS (53) to Azure DNS
  - Inbound: Deny all
- Service endpoints: `Microsoft.KeyVault`, `Microsoft.Storage`, `Microsoft.Sql`
- Subnet delegation: `Microsoft.ContainerInstance/containerGroups`
- Add route to route table for Application Gateway subnet access

#### Labels
`infrastructure` `terraform` `azure` `networking`

#### Dependencies
- VNet and base network infrastructure deployed (Story 6.1)

#### Definition of Done
- [ ] Terraform code for runner subnet created
- [ ] NSG rules configured and associated with subnet
- [ ] Service endpoints enabled
- [ ] Subnet delegation configured
- [ ] Documentation updated with IP allocation

---

### Story 8.2: Deploy Azure Container Instances for Runners

**Priority:** High | **Story Points:** 8

#### User Story
As a **DevOps Engineer**
I want **to deploy GitHub Actions runners as Azure Container Instances**
So that **I have ephemeral, scalable runners that execute in the secure VNet**

#### Acceptance Criteria
- [ ] Given the runner subnet, when ACI is deployed, then it launches successfully with GitHub runner image
- [ ] Given the container instance, when started, then it registers with GitHub Actions as a self-hosted runner
- [ ] Given the runner, when idle for > 30 minutes, then the container is automatically terminated
- [ ] Given runner deployment, when it fails, then alerts are sent and automatic retry occurs
- [ ] Given multiple environments (dev/staging/prod), when deployed, then runners are properly isolated by labels

#### Technical Notes
- Base image: `ghcr.io/actions/actions-runner:latest` or custom image
- Container specs:
  - CPU: 2 cores
  - Memory: 4 GB
  - OS: Linux (Ubuntu 22.04)
- Environment variables:
  - `GITHUB_REPOSITORY`: Target repository
  - `RUNNER_NAME`: Unique runner identifier
  - `RUNNER_LABELS`: Environment labels (e.g., `self-hosted,azure,vnet,dev`)
  - `RUNNER_GROUP`: Default or custom runner group
- Startup script: Register runner with GitHub using registration token
- Managed Identity: Assign identity for accessing Key Vault secrets
- Network profile: Attach to runner subnet
- Restart policy: Never (ephemeral runners)

#### Labels
`infrastructure` `terraform` `azure` `containers` `devops`

#### Dependencies
- Runner subnet created (Story 7.1)
- Container Registry with runner image
- GitHub App or PAT for runner registration in Key Vault

#### Definition of Done
- [ ] Terraform module for ACI runner deployment created
- [ ] Container successfully registers with GitHub
- [ ] Runner executes test workflow successfully
- [ ] Managed Identity configured for Key Vault access
- [ ] Documentation with troubleshooting guide created

---

### Story 8.3: Configure Runner Authentication and Registration

**Priority:** High | **Story Points:** 5

#### User Story
As a **Security Engineer**
I want **to securely manage GitHub runner registration tokens and authentication**
So that **runners authenticate properly without exposing credentials in code or logs**

#### Acceptance Criteria
- [ ] Given runner registration, when token is needed, then it is retrieved from Key Vault via Managed Identity
- [ ] Given GitHub App authentication, when configured, then runners use app-based registration tokens
- [ ] Given registration tokens, when expired, then automatic token refresh occurs
- [ ] Given runner logs, when reviewed, then no secrets or tokens are visible
- [ ] Given token rotation, when performed, then active runners are not impacted

#### Technical Notes
- Preferred: Use GitHub App with `administration:write` permission for runner management
- Alternative: Store GitHub PAT with `repo`, `workflow`, `admin:org` scopes in Key Vault
- Key Vault secrets:
  - `github-runner-app-id`: GitHub App ID
  - `github-runner-app-private-key`: GitHub App private key
  - `github-runner-token`: Fallback PAT (if not using GitHub App)
- Registration token API: `POST /repos/{owner}/{repo}/actions/runners/registration-token`
- Token lifetime: 1 hour (refresh before expiration)
- Implement token caching to avoid rate limits
- Use Managed Identity for ACI to access Key Vault (no connection strings needed)

#### Labels
`security` `azure` `github` `key-vault` `devops`

#### Dependencies
- Key Vault deployed with private endpoint (Story 6.4)
- GitHub App created and installed, or PAT generated
- Managed Identity configured for ACI

#### Definition of Done
- [ ] GitHub App configured for runner registration
- [ ] Secrets stored in Key Vault
- [ ] Token retrieval and refresh logic implemented
- [ ] Managed Identity permissions configured
- [ ] Security audit completed (no hardcoded secrets)

---

### Story 8.4: Implement Private Network Connectivity

**Priority:** High | **Story Points:** 5

#### User Story
As a **Network Engineer**
I want **runners to access Azure resources via private endpoints only**
So that **no public access is required for infrastructure deployments**

#### Acceptance Criteria
- [ ] Given a runner, when accessing Key Vault, then connection uses private endpoint (no public IP)
- [ ] Given a runner, when accessing App Service, then deployment uses private endpoint or VNet integration
- [ ] Given a runner, when accessing Redis, then connection uses private endpoint
- [ ] Given a runner, when accessing Storage Account, then connection uses private endpoint
- [ ] Given network traffic, when analyzed, then zero connections to public Azure endpoints occur

#### Technical Notes
- Verify private endpoints exist for:
  - Key Vault (`privatelink.vaultcore.azure.net`)
  - App Service (`privatelink.azurewebsites.net`)
  - Redis Cache (`privatelink.redis.cache.windows.net`)
  - Storage Account (`privatelink.blob.core.windows.net`)
  - Container Registry (`privatelink.azurecr.io`)
- Configure Azure Private DNS zones in VNet
- Link DNS zones to VNet for automatic resolution
- Update Terraform modules to disable public network access:
  - Key Vault: `public_network_access_enabled = false`
  - App Service: `public_network_access_enabled = false`
  - Redis: `public_network_access_enabled = false`
  - Storage: `allow_blob_public_access = false`
- Test connectivity from runner subnet using `nslookup` and `curl`

#### Labels
`infrastructure` `networking` `security` `azure` `private-endpoints`

#### Dependencies
- Private endpoints deployed for all services (Epic 6)
- Private DNS zones configured
- Runner subnet with service endpoints (Story 7.1)

#### Definition of Done
- [ ] All services have public access disabled
- [ ] Private DNS resolution verified
- [ ] Test deployments succeed using only private connectivity
- [ ] Network flow logs confirm no public endpoint usage
- [ ] Documentation updated with network architecture

---

### Story 8.5: Create GitHub Actions Workflows for Runner-Based Deployment

**Priority:** High | **Story Points:** 8

#### User Story
As a **DevOps Engineer**
I want **to create GitHub Actions workflows that use self-hosted runners**
So that **infrastructure and application deployments execute within the secure VNet**

#### Acceptance Criteria
- [ ] Given a workflow, when triggered, then it runs on self-hosted runners with correct labels
- [ ] Given Terraform workflows, when executed, then infrastructure is deployed without public access
- [ ] Given application workflows, when executed, then code is deployed to App Service via private endpoint
- [ ] Given workflow runs, when completed, then runners are properly cleaned up
- [ ] Given workflow failures, when they occur, then proper error handling and notifications are triggered

#### Technical Notes
Create workflows for:

1. **Infrastructure Deployment** (`.github/workflows/deploy-infrastructure.yml`)
```yaml
runs-on: [self-hosted, azure, vnet, '${{ matrix.environment }}']
```
- Checkout code
- Configure Azure credentials (Managed Identity or Service Principal from Key Vault)
- Run Terraform init/plan/apply
- Access Key Vault for secrets via private endpoint
- Deploy to Azure resources via private endpoints

2. **Application Deployment** (`.github/workflows/deploy-app.yml`)
- Build Node.js application
- Run tests
- Deploy to App Service using Azure CLI with VNet integration
- Verify deployment health

3. **Runner Provisioning** (`.github/workflows/provision-runner.yml`)
- Trigger on workflow_dispatch or schedule
- Deploy new ACI runner instances as needed
- Register runners with appropriate labels

Workflow considerations:
- Use `concurrency` to prevent parallel runs
- Implement proper secret handling
- Add timeout limits (60 minutes max)
- Include deployment approval gates for production
- Store runner labels in repository variables

#### Labels
`devops` `github-actions` `ci-cd` `automation`

#### Dependencies
- Runners deployed and registered (Story 7.2, 7.3)
- Private network connectivity verified (Story 7.4)
- Terraform code ready for deployment

#### Definition of Done
- [ ] Infrastructure deployment workflow created and tested
- [ ] Application deployment workflow created and tested
- [ ] Runner provisioning workflow created
- [ ] All workflows use self-hosted runners
- [ ] Documentation with workflow examples created
- [ ] Workflows successfully deploy to dev environment

---

### Story 8.6: Implement Runner Auto-Scaling

**Priority:** Medium | **Story Points:** 8

#### User Story
As a **Platform Engineer**
I want **runners to automatically scale based on GitHub Actions queue depth**
So that **workflows execute promptly without wasting resources on idle runners**

#### Acceptance Criteria
- [ ] Given high workflow queue depth, when detected, then additional runners are automatically provisioned
- [ ] Given low queue depth, when detected, then excess runners are automatically terminated
- [ ] Given scaling thresholds, when configured, then min (2) and max (10) runner counts are respected
- [ ] Given scaling operations, when executed, then new runners register within 5 minutes
- [ ] Given cost metrics, when reviewed, then runner costs are optimized with minimal idle time

#### Technical Notes
Options for auto-scaling implementation:

**Option 1: GitHub Actions Auto-Scaling with Azure Functions**
- Deploy Azure Function triggered by GitHub Actions webhook events
- Monitor workflow queue: `GET /repos/{owner}/{repo}/actions/runs?status=queued`
- Scaling logic:
  - If queued jobs > available runners for > 2 min → provision +1 runner
  - If idle runners > 1 for > 30 min → terminate oldest idle runner
  - Respect min/max runner limits
- Function triggered every 1-2 minutes

**Option 2: Azure Container Instances with KEDA (Event-Driven)**
- Use KEDA scaler for GitHub Actions runner queue
- Automatic scaling based on webhook events
- More complex setup but fully event-driven

**Option 3: Manual scaling via scheduled workflow**
- Less sophisticated but simpler
- Scale runners based on schedule (business hours vs. off-hours)

Recommended: Option 1 (Azure Function) for balance of simplicity and effectiveness

Configuration:
- Min runners: 2 (always available)
- Max runners: 10 (cost control)
- Scale-up trigger: > 3 queued jobs
- Scale-down trigger: > 30 min idle time
- Cooldown period: 5 minutes between scaling actions

#### Labels
`infrastructure` `automation` `azure-functions` `scaling` `cost-optimization`

#### Dependencies
- Runners deployed (Story 7.2)
- GitHub API client available
- Azure Functions deployed (or alternative scaling mechanism)

#### Definition of Done
- [ ] Auto-scaling logic implemented and tested
- [ ] Scaling triggers verified with load testing
- [ ] Min/max runner limits enforced
- [ ] Cost metrics tracked in Azure Monitor
- [ ] Documentation with scaling configuration guide

---

### Story 8.7: Configure Monitoring and Alerts for Runners

**Priority:** Medium | **Story Points:** 5

#### User Story
As a **DevOps Engineer**
I want **comprehensive monitoring and alerting for self-hosted runners**
So that **runner issues are detected and resolved before impacting deployments**

#### Acceptance Criteria
- [ ] Given runner health, when monitored, then CPU, memory, and network metrics are collected
- [ ] Given runner failures, when they occur, then alerts are sent to Teams and on-call engineer
- [ ] Given workflow failures on runners, when detected, then logs are centralized in Log Analytics
- [ ] Given runner registration failures, when they happen, then alerts trigger automatic retry
- [ ] Given dashboards, when viewed, then runner status, utilization, and trends are visible

#### Technical Notes
Implement monitoring for:

1. **Container Instance Metrics**
   - CPU utilization (alert if > 80% for 10 min)
   - Memory utilization (alert if > 85%)
   - Network bytes sent/received
   - Container restart count (alert if > 2 restarts in 1 hour)

2. **GitHub Runner Metrics**
   - Runner online/offline status
   - Number of active runners
   - Workflow queue depth
   - Job execution time (P50, P95, P99)
   - Registration failures

3. **Deployment Metrics**
   - Deployment success/failure rate
   - Time from commit to deployment
   - Failed deployment reasons

Implement alerts:
- Critical: All runners offline
- Critical: Runner registration failures > 3 in 10 min
- Warning: Average runner utilization > 80% (scale up needed)
- Warning: Workflow queue > 5 jobs for > 5 min
- Info: Runner auto-scaling events

Create Application Insights dashboard:
- Runner availability over time
- Workflow execution metrics
- Cost tracking (ACI spend per day/month)
- Error rate and failure analysis

Log collection:
- Stream runner logs to Log Analytics workspace
- Parse workflow logs for error patterns
- Retain logs for 90 days

#### Labels
`monitoring` `observability` `azure-monitor` `alerts` `dashboards`

#### Dependencies
- Application Insights configured (Story 6.9)
- Runners deployed (Story 7.2)
- Alert action groups created

#### Definition of Done
- [ ] All metrics collected in Azure Monitor
- [ ] Alert rules configured and tested
- [ ] Application Insights dashboard created
- [ ] Log Analytics workspace ingesting runner logs
- [ ] Alert notification sent to Teams channel
- [ ] Runbook documentation for common alerts created

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-3)
- Epic 1: GitHub Integration & Webhook Management
- Epic 6: Azure Infrastructure & Security (Stories 6.1-6.7)

### Phase 2: Alert Processing (Weeks 4-6)
- Epic 2: Code Scanning Alert Processing
- Epic 3: Dependabot Alert Processing
- Epic 5: Microsoft Teams Integration (Stories 5.1-5.4)

### Phase 3: Interactive Workflows (Weeks 7-9)
- Epic 4: Deployment Review Workflow
- Epic 5: Microsoft Teams Integration (Stories 5.5-5.7)

### Phase 4: Production Hardening (Weeks 10-11)
- Epic 6: Azure Infrastructure & Security (Stories 6.8-6.9)
- End-to-end testing
- Performance optimization
- Security hardening

### Phase 5: Secure CI/CD with Self-Hosted Runners (Weeks 12-13)
- Epic 7: CI/CD Pipeline & Application Deployment
- Epic 8: Self-Hosted GitHub Runners in VNet
- Remove public access from all Azure resources
- Migrate deployment workflows to self-hosted runners
- Load testing and scaling validation

### Phase 6: Launch & Iteration (Week 14+)
- Production deployment
- User training
- Monitoring and incident response
- Continuous improvement

---

## Summary Statistics

**Total Epics:** 8
**Total User Stories:** 43

**Story Points by Epic:**
- Epic 1: 26 points
- Epic 2: 22 points
- Epic 3: 18 points
- Epic 4: 34 points
- Epic 5: 47 points
- Epic 6: 49 points
- Epic 7: 44 points (CI/CD Pipeline)
- Epic 8: 44 points (Self-Hosted Runners)

**Total Story Points:** 284 points

**Estimated Timeline:** 16-18 weeks (assuming team velocity of 15-20 points per week)

**Priority Breakdown:**
- High Priority: 34 stories
- Medium Priority: 9 stories
- Low Priority: 0 stories
