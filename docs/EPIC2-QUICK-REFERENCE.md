# Epic 2: Code Scanning Alert Processing - Quick Reference

**Quick access guide for Epic 2 implementation**

---

## 🎯 What Does This Epic Do?

Automates the end-to-end workflow for critical and high severity code scanning alerts:
1. ✅ Filters alerts by severity
2. ✅ Identifies commit author
3. ✅ Finds repository owners
4. ✅ Identifies security champion
5. ✅ Maps GitHub users to Teams users
6. ✅ Sends rich adaptive card notifications to Teams

---

## 📦 Key Components

### 1. Repository Stakeholder Service
**File:** `src/github/repositoryStakeholderService.js`

```javascript
const service = new RepositoryStakeholderService({
  githubClient: githubClient,
  cache: cache,
});

// Get owners
const owners = await service.getRepositoryOwners('org', 'repo');

// Get security champion
const champion = await service.getSecurityChampion('org', 'repo');

// Get all stakeholders
const all = await service.getAllStakeholders('org', 'repo');
```

**Owner Sources (priority):**
1. Custom properties (`owner_1`, `owner_2`)
2. CODEOWNERS file
3. Repository admins

**Champion Sources (priority):**
1. Custom property (`security_champion`)
2. Repository topic (`security-champion:@username`)
3. Null (fallback to org team)

---

### 2. Adaptive Card Template
**File:** `src/cards/codeScanningAlertCard.js`

```javascript
const card = createCodeScanningAlertCard({
  alert: githubAlert,
  repository: { full_name: 'org/repo' },
  metadata: {
    severity: 'high',
    ruleName: 'SQL Injection',
    description: 'Vulnerability description',
    cweIds: ['CWE-89'],
    cveIds: ['CVE-2021-12345'],
    cvssScore: 9.8,
    affectedFiles: [{ path: 'src/db.js', startLine: 42 }],
  },
  authorInfo: { primaryAuthor: { githubLogin: 'alice' } },
  owners: [{ github_login: 'bob' }],
  securityChampion: { github_login: 'security-team' },
});
```

**Card Features:**
- 🎨 Color-coded by severity
- 🔍 Shows CWE/CVE/CVSS details
- 👥 Lists all stakeholders
- 📂 Shows affected files
- 🔘 "View in GitHub" and "Acknowledge" buttons

---

### 3. Notification Service
**File:** `src/bot/codeScanningNotificationService.js`

```javascript
const notificationService = new CodeScanningNotificationService({
  repositoryStakeholderService: stakeholderService,
  userMapper: userMapper,
  teamsUserService: teamsUserService,
  proactiveMessagingService: messagingService,
});

const result = await notificationService.processAndNotify({
  alert: webhookAlert,
  repository: webhookRepository,
  metadata: alertMetadata,
  authorInfo: commitAuthorInfo,
});
```

**What it does:**
1. Identifies all stakeholders
2. Maps GitHub users → Teams users
3. Creates adaptive card
4. Sends to all stakeholders
5. Tracks delivery metrics

---

## 🔧 Configuration

### Repository Configuration

**Option 1: Custom Properties** (Recommended)
```yaml
# Set on repository
owner_1: alice
owner_2: bob
security_champion: security-dave
```

**Option 2: CODEOWNERS File**
```
# .github/CODEOWNERS or CODEOWNERS
* @alice @bob
/security/* @security-dave
```

**Option 3: Repository Topics**
```
# Add topic to repository
security-champion:@security-dave
```

### Severity Configuration

```javascript
const { setConfiguration } = require('./bot/alertSeverityFilter');

setConfiguration({
  minEscalationSeverity: 'high',  // Default threshold
  repositoryOverrides: {
    'org/critical-repo': { minEscalationSeverity: 'medium' },
  },
});
```

---

## 🚀 Usage

### Complete Setup

```javascript
// 1. Initialize services
const githubClient = new GitHubClient({ token: process.env.GITHUB_TOKEN });
const cache = new RepositoryMetadataCache({ redis: redisConfig });

const stakeholderService = new RepositoryStakeholderService({
  githubClient,
  cache,
  telemetryClient,
});

const notificationService = new CodeScanningNotificationService({
  repositoryStakeholderService: stakeholderService,
  userMapper: userMapper,
  teamsUserService: teamsUserService,
  proactiveMessagingService: messagingService,
  telemetryClient,
});

// 2. Handle webhook
const { routeWebhookEvent } = require('./bot/webhookHandlers');

app.post('/api/github/webhooks', async (req, res) => {
  const result = await routeWebhookEvent(
    req.headers['x-github-event'],
    req.body,
    telemetryClient,
    githubClient,
    notificationService  // ← Pass notification service
  );
  
  res.status(200).json(result);
});
```

---

## 📊 Monitoring

### Key Metrics

```kusto
// Notification success rate
customEvents
| where name == "CodeScanningAlertNotificationComplete"
| summarize SuccessRate = 100.0 * countif(customDimensions.success == "true") / count()

// Average delivery time
customMetrics
| where name == "CodeScanningAlertNotificationDuration"
| summarize avg(value), percentile(value, 95)

// Stakeholder identification sources
customEvents
| where name == "RepositoryOwnersRetrieved"
| summarize count() by tostring(customDimensions.sources)
```

### Dashboard Tiles

1. **Notification Success Rate** - Target: 100%
2. **Average Notification Time** - Target: < 30s
3. **Stakeholders Found Rate** - Target: 95%
4. **Teams User Mapping Rate** - Target: 90%

---

## 🧪 Testing

### Run All Tests

```bash
cd src

# Component tests
node github/repositoryStakeholderService.test.js  # 7 tests
node cards/codeScanningAlertCard.test.js          # 5 tests
node bot/alertSeverityFilter.test.js              # 21 tests
node github/commitAuthorService.test.js           # 10 tests
node identity/teamsUserService.test.js            # 17 tests

# Integration test
node bot/webhookHandlers.test.js                  # 8 tests
```

### Manual Testing

```bash
# Send test webhook
curl -X POST http://localhost:3978/api/github/webhooks \
  -H "X-GitHub-Event: code_scanning_alert" \
  -H "Content-Type: application/json" \
  -d @test/fixtures/code-scanning-alert.json
```

---

## 🔍 Troubleshooting

### Common Issues

**1. No owners found**
- ✅ Check custom properties are set
- ✅ Verify CODEOWNERS file exists and is valid
- ✅ Ensure repository has admin users

**2. Security champion not found**
- ✅ Check custom property `security_champion`
- ✅ Verify topic format: `security-champion:@username`
- ✅ Fallback to org team is expected behavior

**3. Teams notification not delivered**
- ✅ Verify user has conversation reference (must have talked to bot)
- ✅ Check user mapping (GitHub → Entra ID)
- ✅ Verify proactive messaging service is configured
- ✅ Check Application Insights for errors

**4. Alert not escalating**
- ✅ Check severity level (default: high and critical only)
- ✅ Verify severity filter configuration
- ✅ Check Application Insights for `shouldEscalate` metric

### Debug Logging

```javascript
// Enable verbose logging
process.env.DEBUG = 'chatops:*';

// Check specific components
console.log('Owners:', await stakeholderService.getRepositoryOwners('org', 'repo'));
console.log('Champion:', await stakeholderService.getSecurityChampion('org', 'repo'));
```

---

## 📚 API Reference

### GitHubClient Extensions

```javascript
// Get custom properties
await githubClient.getRepositoryCustomProperties('org', 'repo');

// Get file content (for CODEOWNERS)
await githubClient.getFileContent('org', 'repo', 'CODEOWNERS');

// Get repository admins
await githubClient.getRepositoryAdmins('org', 'repo');

// Get repository topics
await githubClient.getRepositoryTopics('org', 'repo');
```

### Adaptive Card Helper Functions

```javascript
const { getSeverityColor, getSeverityEmoji } = require('./cards/codeScanningAlertCard');

getSeverityColor('critical');  // 'attention' (red)
getSeverityColor('high');      // 'warning' (orange)
getSeverityEmoji('critical');  // '🔴'
getSeverityEmoji('high');      // '🟠'
```

---

## 📁 File Structure

```
src/
├── bot/
│   ├── alertSeverityFilter.js               # Severity filtering
│   ├── codeScanningNotificationService.js   # Notification orchestration
│   ├── proactiveMessaging.js                # Teams messaging
│   └── webhookHandlers.js                   # Webhook routing
├── cards/
│   └── codeScanningAlertCard.js             # Adaptive card template
├── github/
│   ├── githubClient.js                      # GitHub API client
│   ├── commitAuthorService.js               # Author identification
│   └── repositoryStakeholderService.js      # Owner/champion identification
└── identity/
    ├── userMapper.js                        # GitHub → Entra ID mapping
    └── teamsUserService.js                  # Teams user lookup
```

---

## 🎓 Best Practices

### 1. Repository Configuration
- ✅ Use custom properties for explicit ownership
- ✅ Keep CODEOWNERS file as backup
- ✅ Document security champions in team wiki

### 2. Testing
- ✅ Test with real webhooks in dev environment
- ✅ Verify stakeholder identification accuracy
- ✅ Monitor notification delivery rate

### 3. Monitoring
- ✅ Set up Application Insights alerts
- ✅ Track notification success rate
- ✅ Monitor response time (target: < 30s)

### 4. Maintenance
- ✅ Review stakeholder configurations quarterly
- ✅ Update security champions as needed
- ✅ Audit notification delivery logs

---

## 🔗 Related Documentation

- [Full Implementation Summary](./EPIC2-IMPLEMENTATION-SUMMARY.md)
- [Epic 1 Quick Reference](./EPIC1-QUICK-REFERENCE.md)
- [GitHub Webhook Configuration](./github-webhook-configuration.md)
- [Alert Severity Filter Configuration](./alert-severity-filter-configuration.md)

---

## 🆘 Support

**Issues?**
1. Check Application Insights logs
2. Review test output
3. Verify configuration
4. Check this guide

**Still stuck?**
- Review full implementation summary
- Check webhook handler logs
- Verify GitHub API connectivity
- Test individual components

---

**Last Updated:** 2025-12-30  
**Status:** ✅ Complete and Production-Ready
