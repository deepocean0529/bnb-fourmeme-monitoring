import { kafkaClient } from '../src/kafka/client.js';
import {
  TOKEN_RAW_CREATED,
  TOKEN_RAW_TRADE,
  TOKEN_RAW_MIGRATED
} from '../config/config.js';

// Consumer configuration
const CONSUMER_GROUP_ID = 'mockup-consumer-group';

// Event counters for statistics
interface EventStats {
  [key: string]: number;
}

let eventStats: EventStats = {
  [TOKEN_RAW_CREATED]: 0,
  [TOKEN_RAW_TRADE]: 0,
  [TOKEN_RAW_MIGRATED]: 0
};

let totalEvents = 0;
let startTime = Date.now();

// Format event for display
function formatEvent(event: any): string {
  try {
    const parsed = typeof event === 'string' ? JSON.parse(event) : event;

    if (parsed.token_mint && parsed.token_name) {
      // Token creation event
      return `🎯 Token: ${parsed.token_name} (${parsed.token_symbol}) by ${parsed.creator_wallet.substring(0, 10)}...`;
    } else if (parsed.direction && parsed.token_mint) {
      // Trade event
      const action = parsed.direction === 'buy' ? 'bought' : 'sold';
      return `💰 ${parsed.buyer_wallet.substring(0, 10)}... ${action} ${parsed.token_amount} tokens`;
    } else if (parsed.token_mint && parsed.final_supply) {
      // Completion event
      return `✅ Token ${parsed.token_mint.substring(0, 10)}... completed`;
    }

    return `📄 ${JSON.stringify(parsed).substring(0, 100)}...`;
  } catch (error) {
    return `❌ Failed to parse event: ${event}`;
  }
}

// Display statistics
function displayStats(): void {
  const runtime = Math.floor((Date.now() - startTime) / 1000);
  console.log('\n📊 Consumer Statistics:');
  console.log(`⏱️  Runtime: ${runtime}s`);
  console.log(`📈 Total Events: ${totalEvents}`);
  console.log(`🎯 Token Created: ${eventStats[TOKEN_RAW_CREATED]}`);
  console.log(`💰 Trades: ${eventStats[TOKEN_RAW_TRADE]}`);
  console.log(`✅ Completions: ${eventStats[TOKEN_RAW_MIGRATED]}`);
  console.log(`📊 Events/sec: ${(totalEvents / Math.max(runtime, 1)).toFixed(2)}`);
}

// Main consumer function
export async function startMockupConsumer(): Promise<void> {
  console.log('🔍 Starting Mockup Kafka Consumer...');
  console.log('📡 Listening to topics:');
  console.log(`  • ${TOKEN_RAW_CREATED}`);
  console.log(`  • ${TOKEN_RAW_TRADE}`);
  console.log(`  • ${TOKEN_RAW_MIGRATED}`);
  console.log('---');

  const consumer = kafkaClient.consumer({
    groupId: CONSUMER_GROUP_ID,
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
  });

  try {
    // Connect to Kafka
    await consumer.connect();
    console.log('✅ Kafka consumer connected');

    // Subscribe to topics
    await consumer.subscribe({
      topics: [TOKEN_RAW_CREATED, TOKEN_RAW_TRADE, TOKEN_RAW_MIGRATED],
      fromBeginning: false // Only consume new messages
    });
    console.log('✅ Subscribed to topics');

    // Start consuming
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const eventData = message.value?.toString();
          if (!eventData) return;

          totalEvents++;
          eventStats[topic]++;

          const formattedEvent = formatEvent(eventData);
          const timestamp = new Date().toLocaleTimeString();

          console.log(`[${timestamp}] ${topic}: ${formattedEvent}`);

          // Display stats every 10 events
          if (totalEvents % 10 === 0) {
            displayStats();
          }

        } catch (error) {
          console.error('❌ Error processing message:', error);
        }
      },
    });

    console.log('🎧 Consumer is now listening for events...');
    console.log('💡 Press Ctrl+C to stop and view final statistics');

  } catch (error) {
    console.error('❌ Error starting consumer:', error);
    await consumer.disconnect().catch(() => {});
    throw error;
  }

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('\n🛑 Shutting down Kafka Consumer...');

    try {
      await consumer.disconnect();
      console.log('✅ Kafka consumer disconnected');
    } catch (error) {
      console.error('❌ Error disconnecting consumer:', error);
    }

    displayStats();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Run the consumer if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startMockupConsumer().catch(console.error);
}