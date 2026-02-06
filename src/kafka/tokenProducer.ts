import { kafkaClient } from './client';

const TOKEN_TOPIC = 'solana-token-events';

let producerInstance: ReturnType<typeof kafkaClient.producer> | null = null;

/**
 * Get or create Kafka producer instance
 */
async function getProducer() {
  if (!producerInstance) {
    producerInstance = kafkaClient.producer();
    await producerInstance.connect();
    console.log('✅ Kafka producer connected');
  }
  return producerInstance;
}

/**
 * Send raw token event to Kafka with specific topic
 * @param topic - Kafka topic name
 * @param eventData - The formatted event data
 */
export async function sendRawTokenEvent(
  topic: string,
  eventData: Record<string, any>
): Promise<void> {
  try {
    const producer = await getProducer();
    
    await producer.send({
      topic: topic,
      messages: [
        {
          key: eventData.signature || `${topic}-${Date.now()}`,
          value: JSON.stringify(eventData),
        },
      ],
    });

    console.log(`📤 Sent event to Kafka topic ${topic}:`, eventData.signature);
  } catch (error) {
    console.error(`❌ Error sending event to Kafka topic ${topic}:`, error);
    // Don't throw - we don't want to break the main flow if Kafka fails
  }
}

/**
 * Disconnect producer (for graceful shutdown)
 */
export async function disconnectProducer(): Promise<void> {
  if (producerInstance) {
    await producerInstance.disconnect();
    producerInstance = null;
    console.log('✅ Kafka producer disconnected');
  }
}

