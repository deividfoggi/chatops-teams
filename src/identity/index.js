/**
 * Identity Module
 * 
 * Provides GitHub to Microsoft Entra ID user mapping functionality
 * with support for direct matching, fuzzy matching, and manual overrides.
 * 
 * @module identity
 */

const GraphClient = require('./graphClient');
const UserMapper = require('./userMapper');
const UserMappingSyncJob = require('./syncJob');

module.exports = {
  GraphClient,
  UserMapper,
  UserMappingSyncJob,
};
