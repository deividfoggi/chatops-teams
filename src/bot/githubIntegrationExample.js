/**
 * Example: Integrating GitHub API Client with Webhook Handlers
 * 
 * This example demonstrates how to use the GitHub API client
 * to enrich webhook data with additional information from GitHub,
 * including commit author identification.
 */

const { GitHubClient, identifyCommitAuthor } = require('../github');
const { routeWebhookEvent } = require('./webhookHandlers');

/**
 * Enhanced webhook handler that enriches webhook data with GitHub API calls
 */
async function handleWebhookWithEnrichment(eventType, payload, telemetryClient, githubClient) {
  // First, process the webhook event normally (now includes commit author identification)
  const result = await routeWebhookEvent(eventType, payload, telemetryClient, githubClient);
  
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
      
      // Commit author is now automatically identified by the handler
      // It's available in result.authorIdentification
      if (result.authorIdentification?.success) {
        console.log(`✓ Commit author: ${result.authorIdentification.primaryAuthor?.githubLogin}`);
        
        // TODO: Map GitHub username to Entra ID when Story 1.3 is implemented
        // const entraIdUser = await userMappingService.mapGitHubToEntraId(
        //   result.authorIdentification.primaryAuthor.githubLogin
        // );
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
  
  console.log('Step 2: Process webhook event with automatic commit author identification');
  console.log('  const result = await routeWebhookEvent(');
  console.log('    eventType, payload, telemetry, githubClient');
  console.log('  );\n');
  
  console.log('Step 3: Access commit author information');
  console.log('  if (result.authorIdentification?.success) {');
  console.log('    const author = result.authorIdentification.primaryAuthor;');
  console.log('    console.log(`Author: ${author.githubLogin}`);');
  console.log('    console.log(`Email: ${author.gitEmail}`);');
  console.log('    console.log(`Is Bot: ${result.authorIdentification.isBotCommit}`);');
  console.log('    console.log(`Is Merge: ${result.authorIdentification.isMergeCommit}`);');
  console.log('  }\n');
  
  console.log('Step 4: Enrich with additional GitHub API data');
  console.log('  const repoInfo = await githubClient.getRepository(owner, repo);');
  console.log('  const champion = await githubClient.getSecurityChampion(owner, repo);\n');
  
  console.log('Step 5: Map GitHub user to Entra ID (when Story 1.3 is implemented)');
  console.log('  // const entraIdUser = await userMappingService.mapGitHubToEntraId(');
  console.log('  //   author.githubLogin');
  console.log('  // );\n');
  
  console.log('Benefits:');
  console.log('✓ Automatic commit author identification from alerts');
  console.log('✓ Bot commit detection');
  console.log('✓ Merge commit handling');
  console.log('✓ Rate limiting and retry logic');
  console.log('✓ Caching reduces API calls');
  console.log('✓ Exponential backoff prevents overwhelming GitHub');
  console.log('✓ Telemetry tracking for all operations');
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
