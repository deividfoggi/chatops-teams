/**
 * Application Insights Telemetry Module
 *
 * This module provides a comprehensive telemetry solution for the ChatOps
 * Teams application, including custom metrics, dependency tracking, and
 * distributed tracing.
 *
 * @module telemetry
 *
 * @example
 * // Initialize the telemetry client
 * const { getTelemetryClient, createTracingMiddleware } = require('./telemetry');
 *
 * const telemetry = getTelemetryClient({
 *   connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
 *   environment: 'production',
 *   version: '1.0.0',
 * }).initialize();
 *
 * // Use with Express
 * app.use(createTracingMiddleware(telemetry));
 *
 * // Track custom metrics
 * telemetry.trackWebhookProcessingTime(150, {
 *   webhookType: 'code_scanning_alert',
 *   repository: 'owner/repo',
 *   severity: 'critical',
 * });
 */

const {
  TelemetryClient,
  getTelemetryClient,
  createTracingMiddleware,
} = require('./telemetryClient');

module.exports = {
  TelemetryClient,
  getTelemetryClient,
  createTracingMiddleware,
};
