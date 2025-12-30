/**
 * Code Scanning Alert Adaptive Card Template
 * 
 * Creates adaptive cards for GitHub code scanning alerts with severity indicators,
 * vulnerability details, and action buttons.
 * 
 * @module cards/codeScanningAlertCard
 */

/**
 * Gets severity color for adaptive card
 * @param {string} severity - Alert severity level
 * @returns {string} Color code
 */
function getSeverityColor(severity) {
  const colors = {
    critical: 'attention', // Red
    high: 'warning', // Orange/Yellow
    medium: 'good', // Green
    low: 'default', // Gray
    warning: 'warning',
    note: 'default',
    error: 'attention',
  };

  return colors[severity?.toLowerCase()] || 'default';
}

/**
 * Gets severity emoji for visual indication
 * @param {string} severity - Alert severity level
 * @returns {string} Emoji character
 */
function getSeverityEmoji(severity) {
  const emojis = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '⚪',
    warning: '⚠️',
    note: 'ℹ️',
    error: '❌',
  };

  return emojis[severity?.toLowerCase()] || '⚪';
}

/**
 * Creates an adaptive card for a code scanning alert
 * 
 * @param {Object} alert - Alert data
 * @param {Object} alert.alert - GitHub alert object
 * @param {Object} alert.repository - Repository information
 * @param {Object} alert.metadata - Alert metadata (CWE, CVE, etc.)
 * @param {Object} [alert.authorInfo] - Commit author information
 * @param {Array<Object>} [alert.owners] - Repository owners
 * @param {Object} [alert.securityChampion] - Security champion
 * @returns {Object} Adaptive card JSON
 */
function createCodeScanningAlertCard({
  alert,
  repository,
  metadata,
  authorInfo,
  owners,
  securityChampion,
}) {
  const severityColor = getSeverityColor(metadata.severity);
  const severityEmoji = getSeverityEmoji(metadata.severity);
  const alertUrl = alert.html_url || `https://github.com/${repository.full_name}/security/code-scanning/${alert.number}`;

  // Build stakeholders text
  const stakeholders = [];
  if (authorInfo?.primaryAuthor) {
    stakeholders.push(`**Author:** @${authorInfo.primaryAuthor.githubLogin}`);
  }
  if (owners && owners.length > 0) {
    const ownersList = owners.map(o => `@${o.github_login}`).join(', ');
    stakeholders.push(`**Owners:** ${ownersList}`);
  }
  if (securityChampion) {
    stakeholders.push(`**Security Champion:** @${securityChampion.github_login}`);
  }

  // Build vulnerability identifiers
  const vulnIdentifiers = [];
  if (metadata.cweIds && metadata.cweIds.length > 0) {
    vulnIdentifiers.push(`**CWE:** ${metadata.cweIds.join(', ')}`);
  }
  if (metadata.cveIds && metadata.cveIds.length > 0) {
    vulnIdentifiers.push(`**CVE:** ${metadata.cveIds.join(', ')}`);
  }
  if (metadata.cvssScore) {
    vulnIdentifiers.push(`**CVSS Score:** ${metadata.cvssScore}`);
  }

  // Build affected files text
  let affectedFilesText = 'No location information';
  if (metadata.affectedFiles && metadata.affectedFiles.length > 0) {
    const file = metadata.affectedFiles[0];
    affectedFilesText = file.path;
    if (file.startLine) {
      affectedFilesText += ` (line ${file.startLine}`;
      if (file.endLine && file.endLine !== file.startLine) {
        affectedFilesText += `-${file.endLine}`;
      }
      affectedFilesText += ')';
    }
  }

  const card = {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [
      {
        type: 'Container',
        style: severityColor,
        items: [
          {
            type: 'ColumnSet',
            columns: [
              {
                type: 'Column',
                width: 'auto',
                items: [
                  {
                    type: 'TextBlock',
                    text: severityEmoji,
                    size: 'ExtraLarge',
                    spacing: 'None',
                  },
                ],
              },
              {
                type: 'Column',
                width: 'stretch',
                items: [
                  {
                    type: 'TextBlock',
                    text: `${metadata.severity?.toUpperCase() || 'UNKNOWN'} Severity Alert`,
                    weight: 'Bolder',
                    size: 'Large',
                    wrap: true,
                  },
                  {
                    type: 'TextBlock',
                    text: metadata.ruleName || 'Unknown Rule',
                    size: 'Medium',
                    weight: 'Bolder',
                    wrap: true,
                    spacing: 'Small',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: 'Container',
        items: [
          {
            type: 'FactSet',
            facts: [
              {
                title: 'Repository',
                value: repository.full_name || 'Unknown',
              },
              {
                title: 'Alert #',
                value: String(alert.number || 'N/A'),
              },
              {
                title: 'State',
                value: alert.state || 'unknown',
              },
              {
                title: 'Rule ID',
                value: metadata.ruleId || 'unknown',
              },
            ],
          },
        ],
      },
      {
        type: 'TextBlock',
        text: '**Description**',
        weight: 'Bolder',
        spacing: 'Medium',
      },
      {
        type: 'TextBlock',
        text: metadata.description || 'No description available',
        wrap: true,
        spacing: 'Small',
      },
    ],
  };

  // Add vulnerability identifiers if any
  if (vulnIdentifiers.length > 0) {
    card.body.push({
      type: 'TextBlock',
      text: '**Vulnerability Identifiers**',
      weight: 'Bolder',
      spacing: 'Medium',
    });
    card.body.push({
      type: 'TextBlock',
      text: vulnIdentifiers.join('\n\n'),
      wrap: true,
      spacing: 'Small',
    });
  }

  // Add affected files
  card.body.push({
    type: 'TextBlock',
    text: '**Affected File**',
    weight: 'Bolder',
    spacing: 'Medium',
  });
  card.body.push({
    type: 'TextBlock',
    text: affectedFilesText,
    wrap: true,
    spacing: 'Small',
    fontType: 'Monospace',
  });

  // Add stakeholders if any
  if (stakeholders.length > 0) {
    card.body.push({
      type: 'TextBlock',
      text: '**Stakeholders**',
      weight: 'Bolder',
      spacing: 'Medium',
    });
    card.body.push({
      type: 'TextBlock',
      text: stakeholders.join('\n\n'),
      wrap: true,
      spacing: 'Small',
    });
  }

  // Add action buttons
  card.actions = [
    {
      type: 'Action.OpenUrl',
      title: 'View in GitHub',
      url: alertUrl,
    },
    {
      type: 'Action.Submit',
      title: 'Acknowledge',
      data: {
        action: 'acknowledge_alert',
        alertNumber: alert.number,
        repository: repository.full_name,
      },
    },
  ];

  return card;
}

module.exports = {
  createCodeScanningAlertCard,
  getSeverityColor,
  getSeverityEmoji,
};
