/**
 * Example: Integrating GitHub API Client with Webhook Handlers
 * 
 * This example demonstrates how to use the GitHub API client
 * to enrich webhook data with additional information from GitHub.
 */

const { GitHubClient } = require('../github');
const { routeWebhookEvent } = require('./webhookHandlers');

/**
 * Enhanced webhook handler that enriches webhook data with GitHub API calls
 */
async function handleWebhookWithEnrichment(eventType, payload, telemetryClient, githubClient) {
  // First, process the webhook event normally
  const result = await routeWebhookEvent(eventType, payload, telemetryClient);
  
  // Then enrich with additional data from GitHub API
  if (eventType === 'code_scanning_alert' && payload.repository && payload.alert) {
    const { repository, alert } = payload;
    const [owner, repo] = repository.full_name.split('/');
    
    try {
      // Get repository information
      const repoInfo = await githubClient.getRepository(owner, repo);
      result.enrichment = {
        repositoryOwner: repoInfo.owner,
        repositoryDescription: repoInfo.description,
      };
      
      // Get security champion information
      const champion = await githubClient.getSecurityChampion(owner, repo);
      if (champion.found) {
        result.enrichment.securityChampions = champion.champions;
        result.enrichment.securityChampionSource = champion.source;
      }
      
      // If there's a commit SHA in the alert, get commit author
      if (alert.most_recent_instance?.location?.start_line) {
        // This would need the actual commit SHA from the alert
        // For demonstration purposes
        result.enrichment.note = 'Commit author information can be retrieved if SHA is available';
      }
      
    } catch (error) {
      console.error('Error enriching webhook data:', error.message);
      result.enrichmentError = error.message;
    }
  }
  
  return result;
}

/**
 * Example usage
 */
async function example() {
  console.log('GitHub API Client Integration Example\n');
  
  console.log('This example shows how to integrate the GitHub API client');
  console.log('with webhook handlers to enrich webhook data.\n');
  
  console.log('Step 1: Initialize GitHub client');
  console.log('  const githubClient = new GitHubClient({');
  console.log('    token: process.env.GITHUB_TOKEN');
  console.log('  });\n');
  
  console.log('Step 2: Process webhook event');
  console.log('  const result = await routeWebhookEvent(eventType, payload, telemetry);\n');
  
  console.log('Step 3: Enrich with GitHub API data');
  console.log('  const repoInfo = await githubClient.getRepository(owner, repo);');
  console.log('  const champion = await githubClient.getSecurityChampion(owner, repo);');
  console.log('  const commit = await githubClient.getCommit(owner, repo, sha);\n');
  
  console.log('Step 4: Add enriched data to result');
  console.log('  result.enrichment = {');
  console.log('    repositoryOwner: repoInfo.owner,');
  console.log('    securityChampions: champion.champions,');
  console.log('    commitAuthor: commit.author');
  console.log('  };\n');
  
  console.log('Benefits:');
  console.log('✓ Automatic rate limiting and retry logic');
  console.log('✓ Caching reduces API calls');
  console.log('✓ Exponential backoff prevents overwhelming GitHub');
  console.log('✓ Telemetry tracking for all API calls');
  console.log('✓ Support for both token and GitHub App authentication\n');
  
  console.log('Example complete! See githubIntegrationExample.js for implementation details.');
}

// Export for use in other modules
module.exports = {
  handleWebhookWithEnrichment,
};

// Run example if called directly
if (require.main === module) {
  example().catch(console.error);
}
