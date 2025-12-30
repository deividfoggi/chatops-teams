/**
 * Tests for GraphClient and UserMapper
 * 
 * These tests verify the GitHub to Entra ID user mapping functionality
 * including direct matching, fuzzy matching, caching, and validation.
 */

const GraphClient = require('./graphClient');
const UserMapper = require('./userMapper');

// Mock fetch for testing
global.fetch = async (url, options) => {
  // Mock token endpoint
  if (url.includes('login.microsoftonline.com')) {
    return {
      ok: true,
      json: async () => ({
        access_token: 'mock_access_token',
        expires_in: 3600,
      }),
    };
  }

  // Mock Graph API endpoints
  if (url.includes('graph.microsoft.com')) {
    const urlObj = new URL(url);
    
    // Mock user search by email or filter
    if (urlObj.pathname === '/v1.0/users' && urlObj.search.includes('filter')) {
      const searchQuery = decodeURIComponent(urlObj.search);
      
      if (searchQuery.includes('john.doe@example.com')) {
        return {
          ok: true,
          json: async () => ({
            value: [{
              id: 'entra-id-123',
              displayName: 'John Doe',
              mail: 'john.doe@example.com',
              userPrincipalName: 'john.doe@example.com',
            }],
          }),
        };
      } else if (searchQuery.includes('startswith')) {
        // Mock fuzzy search
        const searchTerm = searchQuery.match(/startswith\(displayName,'([^']+)'\)/)?.[1];
        if (searchTerm === 'johndoe') {
          return {
            ok: true,
            json: async () => ({
              value: [
                {
                  id: 'entra-id-123',
                  displayName: 'John Doe',
                  mail: 'john.doe@example.com',
                  userPrincipalName: 'john.doe@example.com',
                },
                {
                  id: 'entra-id-456',
                  displayName: 'Johnny Doeson',
                  mail: 'johnny.d@example.com',
                  userPrincipalName: 'johnny.d@example.com',
                },
              ],
            }),
          };
        }
      }
      
      // No match
      return {
        ok: true,
        json: async () => ({ value: [] }),
      };
    }

    // Mock get user by ID
    if (urlObj.pathname.startsWith('/v1.0/users/')) {
      const userId = urlObj.pathname.split('/').pop().split('?')[0];
      
      if (userId === 'entra-id-123') {
        return {
          ok: true,
          json: async () => ({
            id: 'entra-id-123',
            displayName: 'John Doe',
            mail: 'john.doe@example.com',
            userPrincipalName: 'john.doe@example.com',
          }),
        };
      } else if (userId === 'manual-mapping-id') {
        return {
          ok: true,
          json: async () => ({
            id: 'manual-mapping-id',
            displayName: 'Manual User',
            mail: 'manual@example.com',
            userPrincipalName: 'manual@example.com',
          }),
        };
      }
      
      // User not found
      return {
        ok: false,
        status: 404,
        text: async () => 'User not found',
      };
    }
  }

  // Default error
  return {
    ok: false,
    status: 404,
    text: async () => 'Not found',
  };
};

/**
 * Test runner
 */
async function runTests() {
  console.log('Running Identity Module Tests...\n');

  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: GraphClient - Get Access Token
  console.log('Test 1: GraphClient - Get Access Token');
  try {
    const graphClient = new GraphClient({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      tenantId: 'test-tenant-id',
    });

    const token = await graphClient.getAccessToken();
    
    if (token === 'mock_access_token') {
      console.log('✅ GraphClient.getAccessToken() works\n');
      testsPassed++;
    } else {
      throw new Error('Token does not match expected value');
    }
  } catch (error) {
    console.log('❌ GraphClient.getAccessToken() failed:', error.message, '\n');
    testsFailed++;
  }

  // Test 2: GraphClient - Find User by Email
  console.log('Test 2: GraphClient - Find User by Email');
  try {
    const graphClient = new GraphClient({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      tenantId: 'test-tenant-id',
    });

    const user = await graphClient.findUserByEmail('john.doe@example.com');
    
    if (user && user.id === 'entra-id-123' && user.displayName === 'John Doe') {
      console.log('✅ GraphClient.findUserByEmail() works\n');
      testsPassed++;
    } else {
      throw new Error('User not found or incorrect data');
    }
  } catch (error) {
    console.log('❌ GraphClient.findUserByEmail() failed:', error.message, '\n');
    testsFailed++;
  }

  // Test 3: GraphClient - Find Users by Display Name (Fuzzy)
  console.log('Test 3: GraphClient - Find Users by Display Name (Fuzzy)');
  try {
    const graphClient = new GraphClient({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      tenantId: 'test-tenant-id',
    });

    const users = await graphClient.findUsersByDisplayName('johndoe');
    
    if (users && users.length === 2 && users[0].confidence > 0 && users[0].confidence <= 1.0) {
      console.log(`✅ GraphClient.findUsersByDisplayName() works with confidence scores (first: ${users[0].confidence.toFixed(3)})\n`);
      testsPassed++;
    } else {
      throw new Error(`Fuzzy search failed: length=${users?.length}, confidence=${users?.[0]?.confidence}`);
    }
  } catch (error) {
    console.log('❌ GraphClient.findUsersByDisplayName() failed:', error.message, '\n');
    testsFailed++;
  }

  // Test 4: GraphClient - Get User by ID
  console.log('Test 4: GraphClient - Get User by ID');
  try {
    const graphClient = new GraphClient({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      tenantId: 'test-tenant-id',
    });

    const user = await graphClient.getUserById('entra-id-123');
    
    if (user && user.id === 'entra-id-123') {
      console.log('✅ GraphClient.getUserById() works\n');
      testsPassed++;
    } else {
      throw new Error('User not found by ID');
    }
  } catch (error) {
    console.log('❌ GraphClient.getUserById() failed:', error.message, '\n');
    testsFailed++;
  }

  // Test 5: GraphClient - Similarity Through Fuzzy Search
  console.log('Test 5: GraphClient - Similarity Through Fuzzy Search');
  try {
    const graphClient = new GraphClient({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      tenantId: 'test-tenant-id',
    });

    // Test similarity calculation through fuzzy search
    const users = await graphClient.findUsersByDisplayName('johndoe');
    
    // The first result should have highest confidence (exact-ish match)
    if (users && users.length > 0 && users[0].confidence > 0.8) {
      console.log('✅ Similarity calculation works through fuzzy search (confidence > 0.8)\n');
      testsPassed++;
    } else {
      throw new Error(`Expected high confidence, got ${users?.[0]?.confidence}`);
    }
  } catch (error) {
    console.log('❌ Similarity calculation test failed:', error.message, '\n');
    testsFailed++;
  }

  // Test 6: UserMapper - Map User by Email
  console.log('Test 6: UserMapper - Map User by Email');
  try {
    const graphClient = new GraphClient({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      tenantId: 'test-tenant-id',
    });

    const userMapper = new UserMapper({
      graphClient,
      redis: null, // Use in-memory storage
    });

    const mapping = await userMapper.mapUser('johndoe', 'john.doe@example.com');
    
    if (mapping && mapping.entraUserId === 'entra-id-123' && mapping.source === 'email') {
      console.log('✅ UserMapper.mapUser() by email works\n');
      testsPassed++;
    } else {
      throw new Error('Email mapping failed');
    }

    await userMapper.close();
  } catch (error) {
    console.log('❌ UserMapper.mapUser() by email failed:', error.message, '\n');
    testsFailed++;
  }

  // Test 7: UserMapper - Map User by Fuzzy Match
  console.log('Test 7: UserMapper - Map User by Fuzzy Match');
  try {
    const graphClient = new GraphClient({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      tenantId: 'test-tenant-id',
    });

    const userMapper = new UserMapper({
      graphClient,
      redis: null,
      fuzzyMatchThreshold: 0.7, // Use standard threshold
    });

    const mapping = await userMapper.mapUser('johndoe');
    
    if (mapping && mapping.entraUserId === 'entra-id-123' && mapping.source === 'fuzzy' && mapping.confidence >= 0.7) {
      console.log(`✅ UserMapper.mapUser() by fuzzy match works (confidence: ${mapping.confidence.toFixed(3)})\n`);
      testsPassed++;
    } else {
      throw new Error(`Fuzzy matching failed: mapping=${JSON.stringify(mapping)}`);
    }

    await userMapper.close();
  } catch (error) {
    console.log('❌ UserMapper.mapUser() by fuzzy match failed:', error.message, '\n');
    testsFailed++;
  }

  // Test 8: UserMapper - Manual Mapping Override
  console.log('Test 8: UserMapper - Manual Mapping Override');
  try {
    const graphClient = new GraphClient({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      tenantId: 'test-tenant-id',
    });

    const userMapper = new UserMapper({
      graphClient,
      redis: null,
      manualMappings: {
        'manual-user': {
          entraId: 'manual-mapping-id',
        },
      },
    });

    const mapping = await userMapper.mapUser('manual-user');
    
    if (mapping && mapping.entraUserId === 'manual-mapping-id' && mapping.source === 'manual') {
      console.log('✅ UserMapper manual mapping override works\n');
      testsPassed++;
    } else {
      throw new Error('Manual mapping override failed');
    }

    await userMapper.close();
  } catch (error) {
    console.log('❌ UserMapper manual mapping override failed:', error.message, '\n');
    testsFailed++;
  }

  // Test 9: UserMapper - Cache Hit
  console.log('Test 9: UserMapper - Cache Hit');
  try {
    const graphClient = new GraphClient({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      tenantId: 'test-tenant-id',
    });

    const userMapper = new UserMapper({
      graphClient,
      redis: null,
      mappingTtl: 3600, // 1 hour
    });

    // First call - should fetch from Graph API
    const mapping1 = await userMapper.mapUser('johndoe', 'john.doe@example.com');
    
    // Second call - should hit cache
    const mapping2 = await userMapper.mapUser('johndoe');
    
    if (mapping1 && mapping2 && mapping1.entraUserId === mapping2.entraUserId) {
      console.log('✅ UserMapper caching works\n');
      testsPassed++;
    } else {
      throw new Error('Cache hit failed');
    }

    await userMapper.close();
  } catch (error) {
    console.log('❌ UserMapper caching failed:', error.message, '\n');
    testsFailed++;
  }

  // Test 10: UserMapper - Fallback Recipients
  console.log('Test 10: UserMapper - Fallback Recipients');
  try {
    const graphClient = new GraphClient({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      tenantId: 'test-tenant-id',
    });

    const userMapper = new UserMapper({
      graphClient,
      redis: null,
    });

    const fallbacks = await userMapper.getFallbackRecipients('owner/repo', {
      repositoryOwners: {
        'owner/repo': ['user1', 'user2'],
      },
      defaultRecipients: ['default-user'],
    });
    
    if (fallbacks && fallbacks.length === 3 && fallbacks.includes('user1')) {
      console.log('✅ UserMapper.getFallbackRecipients() works\n');
      testsPassed++;
    } else {
      throw new Error('Fallback recipients failed');
    }

    await userMapper.close();
  } catch (error) {
    console.log('❌ UserMapper.getFallbackRecipients() failed:', error.message, '\n');
    testsFailed++;
  }

  // Test 11: UserMapper - No Match Returns Null
  console.log('Test 11: UserMapper - No Match Returns Null');
  try {
    const graphClient = new GraphClient({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      tenantId: 'test-tenant-id',
    });

    const userMapper = new UserMapper({
      graphClient,
      redis: null,
    });

    const mapping = await userMapper.mapUser('nonexistent-user', 'nobody@example.com');
    
    if (mapping === null) {
      console.log('✅ UserMapper returns null for no match\n');
      testsPassed++;
    } else {
      throw new Error('Expected null for no match');
    }

    await userMapper.close();
  } catch (error) {
    console.log('❌ UserMapper no match test failed:', error.message, '\n');
    testsFailed++;
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('Test Summary:');
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`Total: ${testsPassed + testsFailed}`);
  console.log('='.repeat(50));

  if (testsFailed > 0) {
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests };
