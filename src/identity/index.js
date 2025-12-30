/**
 * Identity Module
 * 
 * Provides GitHub to Microsoft Entra ID user mapping functionality
 * with support for direct matching, fuzzy matching, and manual overrides.
 * Includes Teams user retrieval with batch operations and presence information.
 * 
 * @module identity
 */

const GraphClient = require('./graphClient');
const UserMapper = require('./userMapper');
const UserMappingSyncJob = require('./syncJob');
const TeamsUserService = require('./teamsUserService');

module.exports = {
  GraphClient,
  UserMapper,
  UserMappingSyncJob,
  TeamsUserService,
};
