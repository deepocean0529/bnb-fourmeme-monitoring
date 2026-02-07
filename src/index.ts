import { initializeRPC, shutdownRPC } from './rpc/index.js';
import { startFourMemeMonitoring } from './monitor/fourmeme.js';
import { startPancakeSwapMonitoring } from './monitor/pancakeswap.js';
import { connectToKafka } from './kafka/client.js';
import { ALCHEMY_WS_URL } from '../config/config.js';

// Main application entry point
async function startApplication(): Promise<void> {
  console.log('🚀 Starting Binance Token Monitor...');

  try {
    // Initialize RPC connection
    console.log('🔗 Initializing RPC connection...');
    await initializeRPC(ALCHEMY_WS_URL);

    // Initialize Kafka connection
    console.log('📡 Initializing Kafka connection...');
    await connectToKafka();

    // Start monitoring services
    console.log('📊 Starting monitoring services...');

    // Start Four.meme monitoring
    await startFourMemeMonitoring();

    // Start PancakeSwap monitoring
    await startPancakeSwapMonitoring();

    console.log('✅ All monitoring services started successfully!');
    console.log('🎯 Application is now monitoring blockchain events...');

  } catch (error) {
    console.error('❌ Failed to start application:', (error as Error).message);
    process.exit(1);
  }
}

// Graceful shutdown handling
async function shutdownApplication(): Promise<void> {
  console.log('\n🛑 Shutting down application...');

  try {
    await shutdownRPC();
    console.log('✅ Application shutdown complete');
  } catch (error) {
    console.error('❌ Error during shutdown:', (error as Error).message);
  }

  process.exit(0);
}

// Handle shutdown signals
process.on('SIGINT', shutdownApplication);
process.on('SIGTERM', shutdownApplication);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  shutdownApplication();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
  shutdownApplication();
});

// Start the application
startApplication().catch((error) => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});