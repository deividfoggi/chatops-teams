/**
 * Teams User Service Usage Examples
 * 
 * Demonstrates how to use TeamsUserService for retrieving Teams users
 * for notifications with batch optimization and presence information.
 */

const { TeamsUserService, UserMapper } = require('./index');

/**
 * Example 1: Basic user retrieval with presence
 */
async function example1() {
  console.log('Example 1: Basic user retrieval with presence\n');

  const service = new TeamsUserService({
    clientId: process.env.ENTRA_CLIENT_ID,
    clientSecret: process.env.ENTRA_CLIENT_SECRET,
    tenantId: process.env.ENTRA_TENANT_ID,
    redis: {
      url: process.env.REDIS_URL,
    },
  });

  try {
    // Retrieve a single user with presence
    const user = await service.getUser('user-entra-id-here', {
      includePresence: true,
    });

    if (user) {
      console.log('User:', user.displayName);
      console.log('Email:', user.mail);
      console.log('User Type:', user.userType);
      
      if (user.presence) {
        console.log('Availability:', user.presence.availability);
        console.log('Activity:', user.presence.activity);
        
        const urgency = service.determineNotificationUrgency(user.presence);
        console.log('Notification Urgency:', urgency);
      }
      
      console.log('Is Guest:', service.isGuestUser(user));
    } else {
      console.log('User not found');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');
}

/**
 * Example 2: Batch user retrieval with optimization
 */
async function example2() {
  console.log('Example 2: Batch user retrieval with optimization\n');

  const service = new TeamsUserService({
    clientId: process.env.ENTRA_CLIENT_ID,
    clientSecret: process.env.ENTRA_CLIENT_SECRET,
    tenantId: process.env.ENTRA_TENANT_ID,
    redis: {
      url: process.env.REDIS_URL,
    },
  });

  try {
    const userIds = [
      'entra-id-1',
      'entra-id-2',
      'entra-id-3',
      // ... up to hundreds of users
    ];

    // Automatically batches into groups of 20 and uses cache
    const users = await service.getUsers(userIds, {
      includePresence: true,
      useCache: true,
    });

    console.log(`Retrieved ${users.length} users`);
    
    users.forEach(user => {
      console.log(`- ${user.displayName} (${user.mail})`);
      if (user.presence) {
        const urgency = service.determineNotificationUrgency(user.presence);
        console.log(`  Presence: ${user.presence.availability}, Urgency: ${urgency}`);
      }
    });
  } catch (error) {
    console.error('Error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');
}

/**
 * Example 3: Complete workflow - GitHub users to Teams notifications
 */
async function example3() {
  console.log('Example 3: Complete workflow - GitHub to Teams\n');

  // Step 1: Map GitHub users to Entra ID
  const userMapper = new UserMapper({
    clientId: process.env.ENTRA_CLIENT_ID,
    clientSecret: process.env.ENTRA_CLIENT_SECRET,
    tenantId: process.env.ENTRA_TENANT_ID,
    redis: {
      url: process.env.REDIS_URL,
    },
  });

  // Step 2: Initialize Teams user service
  const teamsService = new TeamsUserService({
    clientId: process.env.ENTRA_CLIENT_ID,
    clientSecret: process.env.ENTRA_CLIENT_SECRET,
    tenantId: process.env.ENTRA_TENANT_ID,
    redis: {
      url: process.env.REDIS_URL,
    },
  });

  try {
    // GitHub alert stakeholders
    const githubUsers = [
      { username: 'alice', email: 'alice@example.com' },
      { username: 'bob', email: 'bob@example.com' },
      { username: 'charlie', email: 'charlie@example.com' },
    ];

    console.log('Mapping GitHub users to Entra ID...');
    
    // Map GitHub users to Entra ID
    const mappings = [];
    for (const githubUser of githubUsers) {
      const mapping = await userMapper.mapUser(githubUser.username, githubUser.email);
      if (mapping) {
        mappings.push(mapping);
        console.log(`✓ Mapped ${githubUser.username} → ${mapping.displayName}`);
      } else {
        console.log(`✗ No mapping found for ${githubUser.username}`);
      }
    }

    if (mappings.length === 0) {
      console.log('No users mapped, using fallback recipients');
      const fallbacks = await userMapper.getFallbackRecipients('owner/repo', {
        defaultRecipients: ['default-entra-id'],
      });
      console.log('Fallback recipients:', fallbacks);
      return;
    }

    console.log('\nRetrieving Teams user objects...');
    
    // Get Teams user objects with presence
    const entraIds = mappings.map(m => m.entraUserId);
    const teamsUsers = await teamsService.getUsersWithRetry(entraIds, {
      includePresence: true,
    });

    console.log(`\nRetrieved ${teamsUsers.length} Teams users:`);
    
    // Determine notification strategy based on presence
    teamsUsers.forEach(user => {
      const urgency = service.determineNotificationUrgency(user.presence);
      const isGuest = teamsService.isGuestUser(user);
      
      console.log(`\n- ${user.displayName} (${user.mail})`);
      console.log(`  Type: ${isGuest ? 'Guest' : 'Member'}`);
      
      if (user.presence) {
        console.log(`  Presence: ${user.presence.availability}`);
        console.log(`  Notification Urgency: ${urgency}`);
      } else {
        console.log(`  Presence: Not available`);
        console.log(`  Notification Urgency: normal (default)`);
      }
    });

    // Example notification logic based on urgency
    console.log('\nNotification Strategy:');
    const highUrgencyUsers = teamsUsers.filter(u => 
      teamsService.determineNotificationUrgency(u.presence) === 'high'
    );
    const lowUrgencyUsers = teamsUsers.filter(u => 
      teamsService.determineNotificationUrgency(u.presence) === 'low'
    );

    if (highUrgencyUsers.length > 0) {
      console.log('High urgency notifications (send immediately):');
      highUrgencyUsers.forEach(u => console.log(`  - ${u.displayName}`));
    }

    if (lowUrgencyUsers.length > 0) {
      console.log('Low urgency notifications (can be delayed):');
      lowUrgencyUsers.forEach(u => console.log(`  - ${u.displayName}`));
    }

  } catch (error) {
    console.error('Error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');
}

/**
 * Example 4: Error handling and retry logic
 */
async function example4() {
  console.log('Example 4: Error handling and retry logic\n');

  const service = new TeamsUserService({
    clientId: process.env.ENTRA_CLIENT_ID,
    clientSecret: process.env.ENTRA_CLIENT_SECRET,
    tenantId: process.env.ENTRA_TENANT_ID,
    maxRetries: 3, // Retry up to 3 times
  });

  try {
    const userIds = ['user-id-1', 'user-id-2'];

    // Use retry logic for resilience
    const users = await service.getUsersWithRetry(userIds, {
      includePresence: true,
      throwOnError: false, // Return partial results on failure
    });

    console.log(`Successfully retrieved ${users.length}/${userIds.length} users`);
  } catch (error) {
    console.error('All retry attempts failed:', error.message);
    
    // Fallback: Use default recipients or alert system admins
    console.log('Falling back to default notification strategy');
  }

  console.log('\n' + '='.repeat(50) + '\n');
}

/**
 * Example 5: Cache management
 */
async function example5() {
  console.log('Example 5: Cache management\n');

  const service = new TeamsUserService({
    clientId: process.env.ENTRA_CLIENT_ID,
    clientSecret: process.env.ENTRA_CLIENT_SECRET,
    tenantId: process.env.ENTRA_TENANT_ID,
    redis: {
      url: process.env.REDIS_URL,
    },
    userCacheTtl: 3600, // 1 hour cache
  });

  try {
    // First call - fetches from API
    console.log('First call (from API):');
    const users1 = await service.getUsers(['user-id-1'], {
      useCache: false,
    });
    console.log(`Retrieved ${users1.length} users`);

    // Second call - uses cache
    console.log('\nSecond call (from cache):');
    const users2 = await service.getUsers(['user-id-1'], {
      useCache: true,
    });
    console.log(`Retrieved ${users2.length} users (cached)`);

    // Clear specific user cache
    console.log('\nClearing cache for user-id-1...');
    await service.clearCache('user-id-1');

    // Clear all user caches
    console.log('Clearing all user caches...');
    await service.clearCache();

  } catch (error) {
    console.error('Error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');
}

/**
 * Run examples
 */
async function runExamples() {
  console.log('Teams User Service Examples\n');
  console.log('='.repeat(50) + '\n');

  // Check for required environment variables
  if (!process.env.ENTRA_CLIENT_ID || !process.env.ENTRA_CLIENT_SECRET || !process.env.ENTRA_TENANT_ID) {
    console.log('⚠ Missing required environment variables:');
    console.log('  - ENTRA_CLIENT_ID');
    console.log('  - ENTRA_CLIENT_SECRET');
    console.log('  - ENTRA_TENANT_ID');
    console.log('\nExamples will show structure but not execute API calls.\n');
  }

  // Note: In production, you would run these examples with real credentials
  console.log('Note: These examples demonstrate the API structure.');
  console.log('To run with real data, configure environment variables:\n');
  console.log('  export ENTRA_CLIENT_ID=<your-client-id>');
  console.log('  export ENTRA_CLIENT_SECRET=<your-client-secret>');
  console.log('  export ENTRA_TENANT_ID=<your-tenant-id>');
  console.log('  export REDIS_URL=<your-redis-url>\n');
  console.log('='.repeat(50) + '\n');

  // Uncomment to run examples with real credentials
  // await example1();
  // await example2();
  // await example3();
  // await example4();
  // await example5();
}

// Export examples for use in other files
module.exports = {
  example1,
  example2,
  example3,
  example4,
  example5,
};

// Run if called directly
if (require.main === module) {
  runExamples().catch(error => {
    console.error('Examples failed:', error);
    process.exit(1);
  });
}
