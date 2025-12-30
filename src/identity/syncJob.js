/**
 * User Mapping Sync Job
 * 
 * Periodic job that validates and refreshes GitHub to Entra ID user mappings.
 * Intended to run weekly to ensure mapping accuracy.
 * 
 * @module identity/syncJob
 */

const UserMapper = require('./userMapper');
const GraphClient = require('./graphClient');

/**
 * Sync job scheduler for user mapping validation
 */
class UserMappingSyncJob {
  /**
   * Creates a new sync job instance
   * @param {Object} config - Configuration object
   * @param {UserMapper} [config.userMapper] - UserMapper instance
   * @param {number} [config.intervalMs] - Sync interval in milliseconds (default: 7 days)
   * @param {boolean} [config.runOnStart] - Run sync immediately on start (default: false)
   * @param {Object} [config.telemetryClient] - Optional Application Insights client
   */
  constructor(config = {}) {
    this.config = {
      intervalMs: config.intervalMs || 7 * 24 * 60 * 60 * 1000, // 7 days
      runOnStart: config.runOnStart || false,
      ...config,
    };

    this.userMapper = config.userMapper || new UserMapper(config);
    this.telemetryClient = config.telemetryClient;
    this.intervalId = null;
    this.isRunning = false;
  }

  /**
   * Starts the sync job scheduler
   */
  start() {
    if (this.intervalId) {
      console.log('Sync job is already running');
      return;
    }

    console.log(`Starting user mapping sync job (interval: ${this.config.intervalMs / 1000 / 60 / 60 / 24} days)`);

    // Run immediately if configured
    if (this.config.runOnStart) {
      this.runSync().catch(error => {
        console.error('Error in initial sync run:', error);
      });
    }

    // Schedule periodic runs
    this.intervalId = setInterval(() => {
      this.runSync().catch(error => {
        console.error('Error in scheduled sync run:', error);
      });
    }, this.config.intervalMs);

    // Track start event
    if (this.telemetryClient) {
      this.telemetryClient.trackEvent({
        name: 'UserMappingSyncJob.Started',
        properties: {
          intervalMs: this.config.intervalMs,
          runOnStart: this.config.runOnStart,
        },
      });
    }
  }

  /**
   * Stops the sync job scheduler
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Sync job stopped');

      // Track stop event
      if (this.telemetryClient) {
        this.telemetryClient.trackEvent({
          name: 'UserMappingSyncJob.Stopped',
        });
      }
    }
  }

  /**
   * Runs the sync job manually
   * @returns {Promise<Object>} Sync results
   */
  async runSync() {
    if (this.isRunning) {
      console.log('Sync job is already running, skipping this run');
      return { skipped: true };
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('Starting user mapping validation and sync...');

      const results = await this.userMapper.validateMappings();

      const duration = Date.now() - startTime;
      console.log(`Sync completed in ${duration}ms:`, results);

      // Track metrics
      if (this.telemetryClient) {
        this.telemetryClient.trackMetric({
          name: 'UserMappingSyncJob.Duration',
          value: duration,
        });
        this.telemetryClient.trackEvent({
          name: 'UserMappingSyncJob.Completed',
          properties: {
            ...results,
            durationMs: duration,
          },
        });
      }

      return results;
    } catch (error) {
      console.error('Sync job failed:', error);

      // Track error
      if (this.telemetryClient) {
        this.telemetryClient.trackException({
          exception: error,
          properties: {
            operation: 'UserMappingSyncJob.RunSync',
          },
        });
      }

      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Closes the sync job and releases resources
   */
  async close() {
    this.stop();
    if (this.userMapper) {
      await this.userMapper.close();
    }
  }
}

module.exports = UserMappingSyncJob;
