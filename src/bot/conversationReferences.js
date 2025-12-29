/**
 * Conversation References Storage Service
 * 
 * This module manages conversation references for proactive messaging.
 * It stores conversation information that allows the bot to send messages
 * to users without them initiating the conversation first.
 * 
 * @module bot/conversationReferences
 */

/**
 * In-memory storage for conversation references
 * 
 * NOTE: This is a simple in-memory implementation suitable for development and testing.
 * For production deployments, replace with a persistent storage solution.
 * 
 * Recommended production alternatives:
 * 1. Azure SQL Database:
 *    - Store conversation references in a table with conversation ID as primary key
 *    - Include indexes on userId and tenantId for efficient filtering
 *    - Schema: conversationId, userId, serviceUrl, channelId, tenantId, referenceJson, lastUpdated
 * 
 * 2. Azure Cosmos DB:
 *    - Use conversation ID as partition key for optimal performance
 *    - Enable TTL (Time To Live) for automatic cleanup of stale references
 *    - Store entire conversation reference as JSON document
 * 
 * 3. Azure Table Storage:
 *    - Low-cost option for simple key-value storage
 *    - Use conversation ID as RowKey, tenantId as PartitionKey
 *    - Good for high-volume scenarios with simple query patterns
 * 
 * Migration considerations:
 * - Implement the same interface (get, set, delete, has, getAll, getByUserId, getByTenantId)
 * - Handle connection failures and implement retry logic
 * - Consider caching for frequently accessed conversation references
 * - Implement cleanup strategy for inactive conversations (e.g., delete after 90 days)
 */
class ConversationReferences {
  constructor() {
    // Map of conversationId -> conversationReference
    this.references = new Map();
  }

  /**
   * Stores a conversation reference
   * 
   * @param {string} conversationId - Unique conversation identifier
   * @param {Object} conversationReference - The conversation reference object
   * @param {string} conversationReference.conversationId - Conversation ID
   * @param {string} conversationReference.userId - User ID
   * @param {string} conversationReference.serviceUrl - Service URL
   * @param {string} conversationReference.channelId - Channel ID
   * @param {Object} conversationReference.bot - Bot information
   * @param {Object} conversationReference.conversation - Conversation information
   * @param {string} conversationReference.activityId - Activity ID
   * @param {string} [conversationReference.tenantId] - Tenant ID (for Teams)
   */
  set(conversationId, conversationReference) {
    if (!conversationId) {
      throw new Error('conversationId is required');
    }
    if (!conversationReference) {
      throw new Error('conversationReference is required');
    }

    this.references.set(conversationId, {
      ...conversationReference,
      lastUpdated: new Date().toISOString(),
    });
  }

  /**
   * Retrieves a conversation reference
   * 
   * @param {string} conversationId - Unique conversation identifier
   * @returns {Object|null} The conversation reference or null if not found
   */
  get(conversationId) {
    return this.references.get(conversationId) || null;
  }

  /**
   * Deletes a conversation reference
   * 
   * @param {string} conversationId - Unique conversation identifier
   * @returns {boolean} True if the reference was deleted, false otherwise
   */
  delete(conversationId) {
    return this.references.delete(conversationId);
  }

  /**
   * Checks if a conversation reference exists
   * 
   * @param {string} conversationId - Unique conversation identifier
   * @returns {boolean} True if the reference exists, false otherwise
   */
  has(conversationId) {
    return this.references.has(conversationId);
  }

  /**
   * Gets all conversation references
   * 
   * @returns {Array<Object>} Array of all conversation references
   */
  getAll() {
    return Array.from(this.references.values());
  }

  /**
   * Gets conversation references for a specific user
   * 
   * @param {string} userId - User ID to filter by
   * @returns {Array<Object>} Array of conversation references for the user
   */
  getByUserId(userId) {
    return Array.from(this.references.values()).filter(
      (ref) => ref.userId === userId
    );
  }

  /**
   * Gets conversation references for a specific tenant
   * 
   * @param {string} tenantId - Tenant ID to filter by
   * @returns {Array<Object>} Array of conversation references for the tenant
   */
  getByTenantId(tenantId) {
    return Array.from(this.references.values()).filter(
      (ref) => ref.tenantId === tenantId
    );
  }

  /**
   * Clears all conversation references
   */
  clear() {
    this.references.clear();
  }

  /**
   * Gets the count of stored conversation references
   * 
   * @returns {number} Number of stored references
   */
  size() {
    return this.references.size;
  }
}

module.exports = ConversationReferences;
