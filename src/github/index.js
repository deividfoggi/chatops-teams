/**
 * GitHub Integration Module
 * 
 * Exports GitHub API client and related utilities.
 * 
 * @module github
 */

const { GitHubClient, Cache, RateLimiter } = require('./githubClient');

module.exports = {
  GitHubClient,
  Cache,
  RateLimiter,
};
