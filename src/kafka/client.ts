import { Kafka, KafkaConfig } from 'kafkajs';
import {
  TOKEN_RAW_CREATED,
  TOKEN_RAW_TRADE,
  TOKEN_RAW_MIGRATED,
  KAFKA_CLIENT_ID,
  KAFKA_BROKER,
} from '../../config/config';


/**
 * Kafka client configuration
 */
const kafkaConfig: KafkaConfig = {
  clientId: KAFKA_CLIENT_ID,
  brokers: [KAFKA_BROKER],
};

/**
 * Create and configure Kafka client instance
 */

export const kafkaClient = new Kafka(kafkaConfig);

/**
 * Connect to Kafka server and verify connection
 * @returns Promise that resolves if connection is successful
 */
const REQUIRED_TOPICS = [
  TOKEN_RAW_CREATED,
  TOKEN_RAW_TRADE,
  TOKEN_RAW_MIGRATED,
];

export async function connectToKafka(): Promise<void> {
  const admin = kafkaClient.admin();
  
  try {
    await admin.connect();
    console.log('✅ Connected to Kafka admin');

    // Check existing topics
    const existingTopics = await admin.listTopics();
    
    // Create topics that don't exist
    const topicsToCreate = REQUIRED_TOPICS.filter(
      (topic) => !existingTopics.includes(topic)
    );

    if (topicsToCreate.length > 0) {
      console.log(`Creating topics: ${topicsToCreate.join(', ')}...`);
      await admin.createTopics({
        topics: topicsToCreate.map((topic) => ({
          topic: topic,
          numPartitions: 1,
          replicationFactor: 1,
        })),
      });
      console.log(`✅ Created ${topicsToCreate.length} topic(s) successfully`);
    }

    // Log status of all required topics
    for (const topic of REQUIRED_TOPICS) {
      if (existingTopics.includes(topic) || topicsToCreate.includes(topic)) {
        console.log(`✅ Topic '${topic}' is ready`);
      }
    }

    await admin.disconnect();
  } catch (error) {
    console.error('❌ Error connecting to Kafka:', error);
    await admin.disconnect().catch(() => {});
    throw error;
  }
}

