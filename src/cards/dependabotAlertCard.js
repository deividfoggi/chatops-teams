/**
 * Dependabot Alert Adaptive Card Template
 *
 * Creates adaptive cards for GitHub Dependabot alerts with severity indicators,
 * vulnerability details, and action buttons.
 *
 * @module cards/dependabotAlertCard
 */

/**
 * Gets severity color for adaptive card
 * @param {string} severity - Alert severity level
 * @returns {string} Color code
 */
function getSeverityColor(severity) {
  const colors = {
    critical: 'attention', // Red
    high: 'warning',       // Orange/Yellow
    medium: 'accent',      // Blue (neutral/caution)
    low: 'default',        // Gray
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
  };

  return emojis[severity?.toLowerCase()] || '⚪';
}

/**
 * Extracts vulnerability metadata from a Dependabot alert
 *
 * @param {Object} alert - Dependabot alert object from GitHub webhook
 * @returns {Object} Extracted metadata
 */
function extractDependabotMetadata(alert) {
  const advisory = alert?.security_advisory || {};
  const vulnerability = alert?.security_vulnerability || {};
  const pkg = vulnerability?.package || alert?.dependency?.package || {};

  const ghsaId = advisory.ghsa_id || null;
  const cveId = advisory.cve_id || null;
  const cvssScore = advisory.cvss?.score ?? null;

  const identifiers = (advisory.identifiers || []).map((id) => id.value);

  return {
    packageName: pkg.name || 'unknown',
    packageEcosystem: pkg.ecosystem || 'unknown',
    manifestPath: alert?.dependency?.manifest_path || null,
    severity: advisory.severity || vulnerability.severity || 'unknown',
    summary: advisory.summary || 'No summary available',
    description: advisory.description || 'No description available',
    ghsaId,
    cveId,
    cvssScore,
    identifiers,
    vulnerableVersionRange: vulnerability.vulnerable_version_range || null,
    firstPatchedVersion: vulnerability.first_patched_version?.identifier || null,
    advisoryUrl: ghsaId
      ? `https://github.com/advisories/${ghsaId}`
      : null,
    alertUrl: alert?.html_url || null,
    state: alert?.state || 'unknown',
    alertNumber: alert?.number || null,
  };
}

/**
 * Creates an adaptive card for a Dependabot alert
 *
 * @param {Object} params - Card parameters
 * @param {Object} params.alert - GitHub Dependabot alert object
 * @param {Object} params.repository - Repository information
 * @param {Object} [params.securityChampion] - Security champion object
 * @returns {Object} Adaptive card JSON
 */
function createDependabotAlertCard({ alert, repository, securityChampion }) {
  const metadata = extractDependabotMetadata(alert);
  const severityColor = getSeverityColor(metadata.severity);
  const severityEmoji = getSeverityEmoji(metadata.severity);

  const alertUrl =
    metadata.alertUrl ||
    `https://github.com/${repository.full_name}/security/dependabot/${metadata.alertNumber}`;

  // Build FactSet rows
  const facts = [
    { title: 'Repository', value: repository.full_name || 'Unknown' },
    { title: 'Alert #', value: String(metadata.alertNumber || 'N/A') },
    { title: 'Package', value: `${metadata.packageName} (${metadata.packageEcosystem})` },
    { title: 'State', value: metadata.state },
  ];

  if (metadata.vulnerableVersionRange) {
    facts.push({ title: 'Vulnerable Range', value: metadata.vulnerableVersionRange });
  }

  if (metadata.firstPatchedVersion) {
    facts.push({ title: 'Fix Version', value: metadata.firstPatchedVersion });
  }

  if (metadata.manifestPath) {
    facts.push({ title: 'Manifest', value: metadata.manifestPath });
  }

  // Build identifier text
  const identifierParts = [];
  if (metadata.ghsaId) {
    identifierParts.push(`**GHSA:** ${metadata.ghsaId}`);
  }
  if (metadata.cveId) {
    identifierParts.push(`**CVE:** ${metadata.cveId}`);
  }
  if (metadata.cvssScore !== null) {
    identifierParts.push(`**CVSS Score:** ${metadata.cvssScore}`);
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
                    text: `${metadata.severity?.toUpperCase() || 'UNKNOWN'} Severity Dependency`,
                    weight: 'Bolder',
                    size: 'Large',
                    wrap: true,
                  },
                  {
                    type: 'TextBlock',
                    text: metadata.summary,
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
            facts,
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
        text: metadata.description,
        wrap: true,
        spacing: 'Small',
      },
    ],
  };

  // Add vulnerability identifiers if any
  if (identifierParts.length > 0) {
    card.body.push({
      type: 'TextBlock',
      text: '**Vulnerability Identifiers**',
      weight: 'Bolder',
      spacing: 'Medium',
    });
    card.body.push({
      type: 'TextBlock',
      text: identifierParts.join('\n\n'),
      wrap: true,
      spacing: 'Small',
    });
  }

  // Add security champion if provided
  if (securityChampion?.github_login) {
    card.body.push({
      type: 'TextBlock',
      text: '**Security Champion**',
      weight: 'Bolder',
      spacing: 'Medium',
    });
    card.body.push({
      type: 'TextBlock',
      text: `@${securityChampion.github_login}`,
      wrap: true,
      spacing: 'Small',
    });
  }

  // Build action buttons
  card.actions = [];

  // "View Advisory" opens the GitHub Security Advisory
  if (metadata.advisoryUrl) {
    card.actions.push({
      type: 'Action.OpenUrl',
      title: 'View Advisory',
      url: metadata.advisoryUrl,
    });
  }

  // "View Alert" opens the Dependabot alert in GitHub
  card.actions.push({
    type: 'Action.OpenUrl',
    title: 'View Alert',
    url: alertUrl,
  });

  // "Create PR" triggers Dependabot to create an update PR via Action.Submit
  card.actions.push({
    type: 'Action.Submit',
    title: 'Create PR',
    data: {
      action: 'dependabot_create_pr',
      alertNumber: metadata.alertNumber,
      repository: repository.full_name,
      packageName: metadata.packageName,
      fixVersion: metadata.firstPatchedVersion,
    },
  });

  // "Dismiss" action
  card.actions.push({
    type: 'Action.Submit',
    title: 'Dismiss',
    data: {
      action: 'dependabot_dismiss',
      alertNumber: metadata.alertNumber,
      repository: repository.full_name,
    },
  });

  return card;
}

module.exports = {
  createDependabotAlertCard,
  extractDependabotMetadata,
  getSeverityColor,
  getSeverityEmoji,
};
