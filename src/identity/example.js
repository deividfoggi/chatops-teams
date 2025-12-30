/**
 * Example: Using the Identity Module for GitHub to Entra ID User Mapping
 * 
 * This example demonstrates how to integrate the user mapping functionality
 * into your ChatOps application for targeted Teams notifications.
 */

const { UserMapper, UserMappingSyncJob } = require('./index');

/**
 * Example 1: Basic User Mapping
 */
async function basicMapping() {
  console.log('\n=== Example 1: Basic User Mapping ===\n');

  // Initialize the mapper
  const userMapper = new UserMapper({
    redis: {
      url: process.env.REDIS_URL,
    },
  });

  try {
    // Map a GitHub user with email
    console.log('Mapping GitHub user "johndoe" with email...');
    const mapping = await userMapper.mapUser('johndoe', 'john.doe@example.com');

    if (mapping) {
      console.log('✅ User mapped successfully:');
      console.log('  - Entra ID User ID:', mapping.entraUserId);
      console.log('  - Display Name:', mapping.displayName);
      console.log('  - Email:', mapping.email);
      console.log('  - Confidence:', mapping.confidence);
      console.log('  - Source:', mapping.source);
    } else {
      console.log('❌ No mapping found');
    }

    // Map a GitHub user without email (fuzzy match)
    console.log('\nMapping GitHub user "janedoe" without email...');
    const fuzzyMapping = await userMapper.mapUser('janedoe');

    if (fuzzyMapping) {
      console.log('✅ User mapped via fuzzy matching:');
      console.log('  - Display Name:', fuzzyMapping.displayName);
      console.log('  - Confidence:', fuzzyMapping.confidence);
    } else {
      console.log('❌ No mapping found');
    }
  } catch (error) {
    console.error('Error mapping users:', error);
  } finally {
    await userMapper.close();
  }
}

/**
 * Example 2: Manual Mapping Overrides
 */
async function manualMappings() {
  console.log('\n=== Example 2: Manual Mapping Overrides ===\n');

  // Initialize with manual mappings
  const userMapper = new UserMapper({
    redis: {
      url: process.env.REDIS_URL,
    },
    manualMappings: {
      // Map GitHub bots or special accounts to their owners
      'dependabot[bot]': {
        entraId: 'security-team-user-id',
      },
      'github-actions[bot]': {
        entraId: 'devops-team-user-id',
      },
      // Override automatic mapping for specific users
      'contractor-john': {
        entraId: 'john-contractor-entra-id',
      },
    },
  });

  try {
    console.log('Mapping bot account with manual override...');
    const botMapping = await userMapper.mapUser('dependabot[bot]');

    if (botMapping) {
      console.log('✅ Bot mapped to owner:');
      console.log('  - Source:', botMapping.source); // 'manual'
      console.log('  - Confidence:', botMapping.confidence); // 1.0
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await userMapper.close();
  }
}

/**
 * Example 3: Fallback Recipients for Notifications
 */
async function fallbackRecipients() {
  console.log('\n=== Example 3: Fallback Recipients ===\n');

  const userMapper = new UserMapper({
    redis: {
      url: process.env.REDIS_URL,
    },
  });

  try {
    // Try to map a user
    const mapping = await userMapper.mapUser('unknown-user');

    let recipients = [];
    
    if (mapping) {
      // User found - send to them
      recipients.push(mapping.entraUserId);
      console.log('✅ Notification will be sent to:', mapping.displayName);
    } else {
      // User not found - use fallbacks
      console.log('❌ User not found, using fallback recipients...');
      
      const fallbacks = await userMapper.getFallbackRecipients('owner/repo', {
        repositoryOwners: {
          'owner/repo': ['repo-owner-entra-id-1', 'repo-owner-entra-id-2'],
        },
        defaultRecipients: ['security-team-entra-id'],
      });

      recipients = fallbacks;
      console.log('✅ Notification will be sent to fallback recipients:');
      fallbacks.forEach(id => console.log('  -', id));
    }

    // Send notification to recipients (pseudo-code)
    console.log('\nSending notification to', recipients.length, 'recipient(s)...');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await userMapper.close();
  }
}

/**
 * Example 4: Integrating with Webhook Handler
 */
async function webhookIntegration() {
  console.log('\n=== Example 4: Webhook Integration ===\n');

  const userMapper = new UserMapper({
    redis: {
      url: process.env.REDIS_URL,
    },
    manualMappings: {
      'dependabot[bot]': { entraId: 'security-team-id' },
    },
  });

  try {
    // Simulate a GitHub webhook payload
    const webhookPayload = {
      alert: {
        number: 123,
        state: 'open',
        severity: 'critical',
      },
      repository: {
        full_name: 'owner/repo',
      },
      sender: {
        login: 'johndoe',
        email: 'john.doe@example.com',
      },
    };

    console.log('Processing security alert from webhook...');
    console.log('Alert:', webhookPayload.alert.number, '-', webhookPayload.alert.severity);
    console.log('Sender:', webhookPayload.sender.login);

    // Map the sender to Entra ID
    const mapping = await userMapper.mapUser(
      webhookPayload.sender.login,
      webhookPayload.sender.email
    );

    if (mapping) {
      console.log('✅ Mapped to Entra ID user:', mapping.displayName);
      console.log('   Notification will be personalized for this user');
    } else {
      console.log('❌ Could not map user, using repository owners as fallback');
      const fallbacks = await userMapper.getFallbackRecipients(
        webhookPayload.repository.full_name,
        {
          repositoryOwners: {
            'owner/repo': ['owner-entra-id'],
          },
        }
      );
      console.log('   Fallback recipients:', fallbacks);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await userMapper.close();
  }
}

/**
 * Example 5: Periodic Sync Job
 */
async function syncJobExample() {
  console.log('\n=== Example 5: Periodic Sync Job ===\n');

  // Create sync job that runs weekly
  const syncJob = new UserMappingSyncJob({
    intervalMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    runOnStart: false, // Don't run immediately
  });

  // Start the job
  console.log('Starting weekly sync job...');
  syncJob.start();

  // Manually trigger a sync (for demonstration)
  console.log('\nTriggering manual sync...');
  const results = await syncJob.runSync();

  console.log('✅ Sync completed:');
  console.log('  - Validated:', results.validated, 'mappings');
  console.log('  - Refreshed:', results.refreshed, 'mappings');
  console.log('  - Removed:', results.removed, 'invalid mappings');
  console.log('  - Errors:', results.errors);

  // Stop the job
  console.log('\nStopping sync job...');
  syncJob.stop();
  await syncJob.close();
}

/**
 * Example 6: With Application Insights Telemetry
 */
async function withTelemetry() {
  console.log('\n=== Example 6: With Telemetry ===\n');

  // Initialize Application Insights (if available)
  let telemetryClient;
  try {
    const appInsights = require('applicationinsights');
    if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
      appInsights.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING).start();
      telemetryClient = appInsights.defaultClient;
      console.log('✅ Application Insights enabled');
    }
  } catch (error) {
    console.log('ℹ️  Application Insights not available');
  }

  const userMapper = new UserMapper({
    redis: {
      url: process.env.REDIS_URL,
    },
    telemetryClient,
  });

  try {
    console.log('\nMapping user with telemetry tracking...');
    const mapping = await userMapper.mapUser('johndoe', 'john.doe@example.com');

    if (mapping) {
      console.log('✅ Mapped successfully');
      console.log('   Check Application Insights for:');
      console.log('   - UserMapper.MapUser.Duration metric');
      console.log('   - UserMapper.MapUser.Success event');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await userMapper.close();
  }
}

/**
 * Run all examples (for demonstration only)
 */
async function runAllExamples() {
  console.log('='.repeat(60));
  console.log('User Mapping Examples');
  console.log('='.repeat(60));

  // Note: These examples use mock data and won't actually connect to services
  // unless you have the environment variables configured

  if (!process.env.ENTRA_CLIENT_ID) {
    console.log('\n⚠️  Environment variables not set. Examples will use mock mode.');
    console.log('   Set ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET, and ENTRA_TENANT_ID');
    console.log('   to test with real Entra ID API.\n');
  }

  try {
    await basicMapping();
    await manualMappings();
    await fallbackRecipients();
    await webhookIntegration();
    await syncJobExample();
    await withTelemetry();
  } catch (error) {
    console.error('Error running examples:', error);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Examples completed');
  console.log('='.repeat(60) + '\n');
}

// Export functions for individual use
module.exports = {
  basicMapping,
  manualMappings,
  fallbackRecipients,
  webhookIntegration,
  syncJobExample,
  withTelemetry,
  runAllExamples,
};

// Run all examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
