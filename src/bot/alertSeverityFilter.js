/**
 * Code Scanning Alert Severity Filter
 * 
 * Filters code scanning alerts based on severity level and extracts
 * vulnerability metadata (CWE, CVE, CVSS scores).
 * 
 * @module bot/alertSeverityFilter
 */

/**
 * Severity levels supported by GitHub Code Scanning
 * Ordered from most to least severe
 */
const SEVERITY_LEVELS = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  warning: 1,
  note: 0,
  error: 3, // Map 'error' to 'high' severity
};

/**
 * Default configuration for severity filtering
 */
const DEFAULT_CONFIG = {
  // Minimum severity level that triggers escalation
  minEscalationSeverity: 'high',
  
  // Repository-specific overrides
  // Format: { 'owner/repo': { minEscalationSeverity: 'medium' } }
  repositoryOverrides: {},
};

/**
 * Configuration storage (can be overridden via setConfiguration)
 */
let currentConfig = { ...DEFAULT_CONFIG };

/**
 * Set custom configuration for severity filtering
 * 
 * @param {Object} config - Configuration object
 * @param {string} [config.minEscalationSeverity] - Minimum severity for escalation
 * @param {Object} [config.repositoryOverrides] - Repository-specific overrides
 */
function setConfiguration(config) {
  currentConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    repositoryOverrides: {
      ...DEFAULT_CONFIG.repositoryOverrides,
      ...(config.repositoryOverrides || {}),
    },
  };
}

/**
 * Get current configuration
 * 
 * @returns {Object} Current configuration
 */
function getConfiguration() {
  return { ...currentConfig };
}

/**
 * Reset configuration to defaults
 */
function resetConfiguration() {
  currentConfig = { ...DEFAULT_CONFIG };
}

/**
 * Get severity level for a repository, considering overrides
 * 
 * @param {string} repository - Repository full name (owner/repo)
 * @returns {string} Minimum escalation severity for the repository
 */
function getRepositorySeverityThreshold(repository) {
  if (repository && currentConfig.repositoryOverrides[repository]) {
    return currentConfig.repositoryOverrides[repository].minEscalationSeverity;
  }
  return currentConfig.minEscalationSeverity;
}

/**
 * Check if an alert should be escalated based on severity
 * 
 * @param {string} severity - Alert severity level
 * @param {string} [repository] - Repository full name for override check
 * @returns {boolean} True if alert should be escalated
 */
function shouldEscalateAlert(severity, repository) {
  if (!severity) {
    // If severity is not specified, don't escalate but log warning
    console.warn('Alert severity not specified, defaulting to no escalation');
    return false;
  }

  const normalizedSeverity = severity.toLowerCase();
  const severityLevel = SEVERITY_LEVELS[normalizedSeverity];

  if (severityLevel === undefined) {
    console.warn(`Unknown severity level: ${severity}, defaulting to no escalation`);
    return false;
  }

  const threshold = getRepositorySeverityThreshold(repository);
  const thresholdLevel = SEVERITY_LEVELS[threshold.toLowerCase()] || SEVERITY_LEVELS.high;

  return severityLevel >= thresholdLevel;
}

/**
 * Extract CWE (Common Weakness Enumeration) IDs from alert
 * 
 * @param {Object} alert - Code scanning alert object
 * @returns {string[]} Array of CWE IDs (e.g., ['CWE-89', 'CWE-79'])
 */
function extractCWEIds(alert) {
  const cweIds = [];

  // Check rule.tags for CWE identifiers
  if (alert?.rule?.tags && Array.isArray(alert.rule.tags)) {
    alert.rule.tags.forEach((tag) => {
      // CWE tags are typically in format: 'external/cwe/cwe-89' or just 'CWE-89'
      const cweMatch = tag.match(/cwe[-/](\d+)/i);
      if (cweMatch) {
        cweIds.push(`CWE-${cweMatch[1]}`);
      }
    });
  }

  // Check rule.help for CWE mentions
  if (alert?.rule?.help && typeof alert.rule.help === 'string') {
    const helpCweMatches = alert.rule.help.match(/CWE[-\s](\d+)/gi);
    if (helpCweMatches) {
      helpCweMatches.forEach((match) => {
        const cweId = match.replace(/[-\s]/g, '-').toUpperCase();
        if (!cweIds.includes(cweId)) {
          cweIds.push(cweId);
        }
      });
    }
  }

  return cweIds;
}

/**
 * Extract CVE (Common Vulnerabilities and Exposures) IDs from alert
 * 
 * @param {Object} alert - Code scanning alert object
 * @returns {string[]} Array of CVE IDs (e.g., ['CVE-2021-44228', 'CVE-2022-12345'])
 */
function extractCVEIds(alert) {
  const cveIds = [];

  // Check rule.tags for CVE identifiers
  if (alert?.rule?.tags && Array.isArray(alert.rule.tags)) {
    alert.rule.tags.forEach((tag) => {
      const cveMatch = tag.match(/cve[-/](\d{4}[-/]\d+)/i);
      if (cveMatch) {
        cveIds.push(`CVE-${cveMatch[1].replace('/', '-')}`);
      }
    });
  }

  // Check rule.help and description for CVE mentions
  const searchFields = [
    alert?.rule?.help,
    alert?.rule?.description,
    alert?.rule?.full_description,
  ];

  searchFields.forEach((field) => {
    if (field && typeof field === 'string') {
      const cveMatches = field.match(/CVE[-\s](\d{4}[-\s]\d+)/gi);
      if (cveMatches) {
        cveMatches.forEach((match) => {
          const cveId = match.replace(/\s/g, '-').toUpperCase();
          if (!cveIds.includes(cveId)) {
            cveIds.push(cveId);
          }
        });
      }
    }
  });

  return cveIds;
}

/**
 * Extract CVSS (Common Vulnerability Scoring System) score from alert
 * 
 * @param {Object} alert - Code scanning alert object
 * @returns {number|null} CVSS score (0-10) or null if not available
 */
function extractCVSSScore(alert) {
  // Check rule.security_severity_level (GitHub's CVSS-like score)
  if (alert?.rule?.security_severity_level) {
    const score = parseFloat(alert.rule.security_severity_level);
    if (!isNaN(score)) {
      return score;
    }
  }

  // Check for CVSS in tags
  if (alert?.rule?.tags && Array.isArray(alert.rule.tags)) {
    for (const tag of alert.rule.tags) {
      const cvssMatch = tag.match(/cvss[:\s]*([\d.]+)/i);
      if (cvssMatch) {
        const score = parseFloat(cvssMatch[1]);
        if (!isNaN(score)) {
          return score;
        }
      }
    }
  }

  return null;
}

/**
 * Extract affected file paths from alert
 * 
 * @param {Object} alert - Code scanning alert object
 * @returns {Array<Object>} Array of affected file information
 */
function extractAffectedFiles(alert) {
  const files = [];

  // Get most recent instance location
  if (alert?.most_recent_instance?.location) {
    const location = alert.most_recent_instance.location;
    files.push({
      path: location.path || 'unknown',
      startLine: location.start_line || null,
      endLine: location.end_line || null,
      startColumn: location.start_column || null,
      endColumn: location.end_column || null,
    });
  }

  // Get locations from instances array if available
  if (alert?.instances && Array.isArray(alert.instances)) {
    alert.instances.forEach((instance) => {
      if (instance?.location?.path) {
        const existingFile = files.find((f) => f.path === instance.location.path);
        if (!existingFile) {
          files.push({
            path: instance.location.path,
            startLine: instance.location.start_line || null,
            endLine: instance.location.end_line || null,
            startColumn: instance.location.start_column || null,
            endColumn: instance.location.end_column || null,
          });
        }
      }
    });
  }

  return files;
}

/**
 * Extract comprehensive vulnerability metadata from alert
 * 
 * @param {Object} alert - Code scanning alert object
 * @returns {Object} Extracted metadata
 */
function extractAlertMetadata(alert) {
  return {
    cweIds: extractCWEIds(alert),
    cveIds: extractCVEIds(alert),
    cvssScore: extractCVSSScore(alert),
    affectedFiles: extractAffectedFiles(alert),
    severity: alert?.rule?.severity || 'unknown',
    description: alert?.rule?.description || 'No description',
    ruleId: alert?.rule?.id || 'unknown',
    ruleName: alert?.rule?.name || 'unknown',
    state: alert?.state || 'unknown',
  };
}

/**
 * Process a code scanning alert and determine handling
 * 
 * @param {Object} alert - Code scanning alert object
 * @param {string} repository - Repository full name
 * @returns {Object} Processing result with escalation decision and metadata
 */
function processCodeScanningAlert(alert, repository) {
  const severity = alert?.rule?.severity;
  const shouldEscalate = shouldEscalateAlert(severity, repository);
  const metadata = extractAlertMetadata(alert);

  return {
    shouldEscalate,
    severity,
    repository,
    metadata,
    reason: shouldEscalate
      ? `Alert severity '${severity}' meets or exceeds threshold '${getRepositorySeverityThreshold(repository)}'`
      : `Alert severity '${severity}' below threshold '${getRepositorySeverityThreshold(repository)}'`,
  };
}

module.exports = {
  shouldEscalateAlert,
  extractCWEIds,
  extractCVEIds,
  extractCVSSScore,
  extractAffectedFiles,
  extractAlertMetadata,
  processCodeScanningAlert,
  setConfiguration,
  getConfiguration,
  resetConfiguration,
  getRepositorySeverityThreshold,
  SEVERITY_LEVELS,
};
