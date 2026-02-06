#!/usr/bin/env tsx

/**
 * Integration test for mockup producer and consumer
 * This script starts both the producer and consumer to test end-to-end Kafka flow
 */

import { startMockupService } from './mockup.js';
import { startMockupConsumer } from './consumer.js';

async function runIntegrationTest(): Promise<void> {
  console.log('🧪 Starting Mockup Integration Test...');
  console.log('🚀 This will start both producer and consumer');
  console.log('📊 Producer generates events → Kafka → Consumer displays events');
  console.log('⏹️  Press Ctrl+C to stop the test');
  console.log('---');

  try {
    // Start consumer in background
    const consumerPromise = startMockupConsumer();

    // Wait a bit for consumer to connect
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Start producer
    await startMockupService();

  } catch (error) {
    console.error('❌ Integration test failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown for integration test
const shutdown = () => {
  console.log('\n🛑 Stopping integration test...');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Run integration test
runIntegrationTest().catch(console.error);