/**
 * GitHub Integration Module
 * 
 * Exports GitHub API client and related utilities.
 * 
 * @module github
 */

const { GitHubClient, Cache, RateLimiter } = require('./githubClient');
const { identifyCommitAuthor, identifyMultipleCommitAuthors, isBot } = require('./commitAuthorService');

module.exports = {
  GitHubClient,
  Cache,
  RateLimiter,
  identifyCommitAuthor,
  identifyMultipleCommitAuthors,
  isBot,
};
