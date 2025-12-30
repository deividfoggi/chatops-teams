/**
 * Commit Author Identification Service
 * 
 * Identifies commit authors from GitHub code scanning alerts.
 * Handles various scenarios including merge commits, bot commits,
 * and fallback to repository owners.
 * 
 * @module github/commitAuthorService
 */

/**
 * Known bot account patterns
 */
const BOT_PATTERNS = [
  /\[bot\]$/i,
  /^dependabot/i,
  /^renovate/i,
  /^github-actions/i,
  /^greenkeeper/i,
  /^snyk-bot/i,
];

/**
 * Determines if a GitHub user is a bot
 * 
 * @param {Object} user - GitHub user object with login and type
 * @returns {boolean} True if user is a bot
 */
function isBot(user) {
  if (!user) return false;
  
  // Check user type
  if (user.type === 'Bot') return true;
  
  // Check username patterns
  const login = user.login || '';
  return BOT_PATTERNS.some(pattern => pattern.test(login));
}

/**
 * Identifies commit authors from a code scanning alert
 * 
 * @param {Object} alert - Code scanning alert from webhook payload
 * @param {Object} repository - Repository information from webhook payload
 * @param {Object} githubClient - GitHub API client instance
 * @param {Object} telemetryClient - Application Insights client (optional)
 * @returns {Promise<Object>} Author identification result
 */
async function identifyCommitAuthor(alert, repository, githubClient, telemetryClient) {
  const startTime = Date.now();
  
  try {
    // Extract commit SHA from alert
    const commitSha = alert.most_recent_instance?.commit_sha;
    
    if (!commitSha) {
      console.warn('No commit SHA available in alert');
      
      if (telemetryClient) {
        telemetryClient.trackEvent('CommitAuthorIdentification', {
          result: 'no_commit_sha',
          repository: repository?.full_name || 'unknown',
          alertNumber: String(alert?.number || 'unknown'),
        });
      }
      
      return {
        success: false,
        reason: 'no_commit_sha',
        message: 'No commit SHA available in alert',
        authors: [],
      };
    }
    
    // Extract owner and repo from repository
    const [owner, repo] = repository.full_name.split('/');
    
    // Fetch commit information from GitHub API
    const commit = await githubClient.getCommit(owner, repo, commitSha);
    
    // Prefer author over committer for responsibility
    // - author: the person who wrote the code
    // - committer: the person who committed it (may be different for merge commits)
    // We use author as fallback to committer if author is null
    const primaryUser = commit.author || commit.committer;
    const gitAuthor = commit.commit.author;
    
    // Check if this is a bot commit
    const botDetected = isBot(primaryUser);
    
    let result = {
      success: true,
      commitSha: commit.sha,
      authors: [],
      primaryAuthor: null,
      isBotCommit: botDetected,
      isMergeCommit: commit.parents.length > 1,
    };
    
    if (botDetected && commit.parents.length === 1) {
      // Single-parent bot commit - try to find the human who triggered it
      // Note: Bot commits with multiple parents are handled as merge commits below
      console.log(`Bot commit detected: ${primaryUser?.login}`);
      
      // For now, mark as bot commit and suggest using PR author as fallback
      result.message = `Bot commit by ${primaryUser?.login}. Consider identifying PR author.`;
      result.authors.push({
        githubLogin: primaryUser?.login || 'unknown',
        githubId: primaryUser?.id,
        gitName: gitAuthor.name,
        gitEmail: gitAuthor.email,
        isBot: true,
      });
    } else if (commit.parents.length > 1) {
      // Merge commit - multiple parents
      console.log(`Merge commit detected with ${commit.parents.length} parents`);
      
      result.message = `Merge commit with ${commit.parents.length} parents detected. Consider identifying PR author.`;
      
      // Add the merge commit author
      if (primaryUser) {
        result.primaryAuthor = {
          githubLogin: primaryUser.login,
          githubId: primaryUser.id,
          gitName: gitAuthor.name,
          gitEmail: gitAuthor.email,
          isBot: botDetected,
          role: 'merger',
        };
        result.authors.push(result.primaryAuthor);
      }
    } else {
      // Regular single-author commit
      if (primaryUser) {
        result.primaryAuthor = {
          githubLogin: primaryUser.login,
          githubId: primaryUser.id,
          gitName: gitAuthor.name,
          gitEmail: gitAuthor.email,
          isBot: false,
          role: 'author',
        };
        result.authors.push(result.primaryAuthor);
        result.message = `Identified commit author: ${primaryUser.login}`;
      } else {
        // No GitHub user linked to the commit
        result.success = false;
        result.reason = 'no_github_user';
        result.message = `Commit author not linked to GitHub account: ${gitAuthor.email}`;
        result.authors.push({
          githubLogin: null,
          githubId: null,
          gitName: gitAuthor.name,
          gitEmail: gitAuthor.email,
          isBot: false,
        });
      }
    }
    
    const duration = Date.now() - startTime;
    
    // Track telemetry
    if (telemetryClient) {
      telemetryClient.trackEvent('CommitAuthorIdentification', {
        result: result.success ? 'success' : result.reason,
        repository: repository?.full_name || 'unknown',
        alertNumber: String(alert?.number || 'unknown'),
        commitSha: commitSha,
        isBot: String(botDetected),
        isMergeCommit: String(result.isMergeCommit),
        authorCount: String(result.authors.length),
      });
      
      telemetryClient.trackMetric('CommitAuthorIdentificationDuration', duration, {
        repository: repository?.full_name,
        success: String(result.success),
      });
    }
    
    console.log(`Commit author identification completed: ${result.message}`);
    
    return result;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('Error identifying commit author:', error.message);
    
    if (telemetryClient) {
      telemetryClient.trackException(error, {
        operation: 'identifyCommitAuthor',
        repository: repository?.full_name,
        alertNumber: String(alert?.number),
      });
      
      telemetryClient.trackMetric('CommitAuthorIdentificationDuration', duration, {
        repository: repository?.full_name,
        success: 'false',
        error: 'true',
      });
    }
    
    return {
      success: false,
      reason: 'api_error',
      message: `Failed to identify commit author: ${error.message}`,
      error: error.message,
      authors: [],
    };
  }
}

/**
 * Identifies authors from multiple commits that contributed to a vulnerability
 * 
 * @param {Array<string>} commitShas - Array of commit SHAs
 * @param {Object} repository - Repository information from webhook payload
 * @param {Object} githubClient - GitHub API client instance
 * @param {Object} telemetryClient - Application Insights client (optional)
 * @returns {Promise<Object>} Combined author identification result
 */
async function identifyMultipleCommitAuthors(commitShas, repository, githubClient, telemetryClient) {
  const startTime = Date.now();
  
  try {
    if (!commitShas || commitShas.length === 0) {
      return {
        success: false,
        reason: 'no_commits',
        message: 'No commit SHAs provided',
        authors: [],
      };
    }
    
    const [owner, repo] = repository.full_name.split('/');
    const allAuthors = [];
    const seenLogins = new Set();
    
    // Fetch all commits in parallel (with rate limiting handled by client)
    const commitPromises = commitShas.map(sha => 
      githubClient.getCommit(owner, repo, sha).catch(error => {
        console.warn(`Failed to fetch commit ${sha}:`, error.message);
        return null;
      })
    );
    
    const commits = await Promise.all(commitPromises);
    
    // Extract unique authors
    for (const commit of commits) {
      if (!commit) continue;
      
      const primaryUser = commit.author || commit.committer;
      const gitAuthor = commit.commit.author;
      
      if (primaryUser && !seenLogins.has(primaryUser.login)) {
        seenLogins.add(primaryUser.login);
        allAuthors.push({
          githubLogin: primaryUser.login,
          githubId: primaryUser.id,
          gitName: gitAuthor.name,
          gitEmail: gitAuthor.email,
          isBot: isBot(primaryUser),
        });
      } else if (!primaryUser && gitAuthor && !seenLogins.has(gitAuthor.email)) {
        // No GitHub user, use email as identifier
        seenLogins.add(gitAuthor.email);
        allAuthors.push({
          githubLogin: null,
          githubId: null,
          gitName: gitAuthor.name,
          gitEmail: gitAuthor.email,
          isBot: false,
        });
      }
    }
    
    const duration = Date.now() - startTime;
    
    if (telemetryClient) {
      telemetryClient.trackEvent('MultipleCommitAuthorsIdentification', {
        repository: repository?.full_name || 'unknown',
        commitCount: String(commitShas.length),
        authorCount: String(allAuthors.length),
      });
      
      telemetryClient.trackMetric('MultipleCommitAuthorsIdentificationDuration', duration, {
        repository: repository?.full_name,
        commitCount: String(commitShas.length),
      });
    }
    
    return {
      success: true,
      commitCount: commitShas.length,
      authors: allAuthors,
      message: `Identified ${allAuthors.length} unique author(s) from ${commitShas.length} commit(s)`,
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('Error identifying multiple commit authors:', error.message);
    
    if (telemetryClient) {
      telemetryClient.trackException(error, {
        operation: 'identifyMultipleCommitAuthors',
        repository: repository?.full_name,
        commitCount: String(commitShas?.length || 0),
      });
      
      telemetryClient.trackMetric('MultipleCommitAuthorsIdentificationDuration', duration, {
        repository: repository?.full_name,
        success: 'false',
      });
    }
    
    return {
      success: false,
      reason: 'api_error',
      message: `Failed to identify commit authors: ${error.message}`,
      error: error.message,
      authors: [],
    };
  }
}

module.exports = {
  identifyCommitAuthor,
  identifyMultipleCommitAuthors,
  isBot,
};
