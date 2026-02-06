import { ethers } from 'ethers';
import { kafkaClient } from '../src/kafka/client.js';
import {
  TOKEN_RAW_CREATED,
  TOKEN_RAW_TRADE,
  TOKEN_RAW_MIGRATED
} from '../config/config.js';

// Event Interfaces matching the README.md schema
interface TokenCreateData {
  chain_id: number;
  token_mint: string;
  token_name: string;
  token_symbol: string;
  creator_wallet: string;
  metadata_uri: string;
  initial_supply: string;
  block_time: number;
  slot: number;
  signature: string;
  kafka_timestamp: string;
}

interface TokenPurchaseData {
  chain_id: number;
  direction: string;
  buyer_wallet: string;
  token_mint: string;
  token_amount: string;
  token_decimals: number;
  sol_amount: string;
  market_cap: number;
  block_time: number;
  slot: number;
  signature: string;
  kafka_timestamp: string;
}

interface TokenSaleData {
  chain_id: number;
  direction: string;
  buyer_wallet: string;
  token_mint: string;
  token_amount: string;
  token_decimals: number;
  sol_amount: string;
  market_cap: number;
  block_time: number;
  slot: number;
  signature: string;
  kafka_timestamp: string;
}

interface TokenCompleteData {
  chain_id: number;
  token_mint: string;
  migrator_wallet: string;
  liquidity_pool: string;
  migration_fee: string;
  block_time: number;
  slot: number;
  signature: string;
  kafka_timestamp: string;
}

// Mock data generators
const MOCK_NAMES = ['DogeCoin', 'ShibaInu', 'Pepe', 'Floki', 'BabyDoge', 'Kishu', 'Samoyed', 'Pitbull', 'Astro', 'Poodl'];
const MOCK_SYMBOLS = ['DOGE', 'SHIB', 'PEPE', 'FLOKI', 'BABYDOGE', 'KISHU', 'SAMO', 'PIT', 'ASTRO', 'POODL'];
const MOCK_WALLETS = [
  '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  '0x742d35Cc6634C0532925a3b844Bc454e4438f44f',
  '0x742d35Cc6634C0532925a3b844Bc454e4438f44g',
  '0x742d35Cc6634C0532925a3b844Bc454e4438f44h',
  '0x742d35Cc6634C0532925a3b844Bc454e4438f44i'
];

// Track created tokens and their creation time
interface CreatedToken {
  token_mint: string;
  created_at: number;
}

let createdTokens: CreatedToken[] = [];
let tokenCounter = 0;
let slotCounter = 1000000;
let kafkaProducer: any = null;

// Initialize Kafka producer
async function initializeKafkaProducer() {
  try {
    kafkaProducer = kafkaClient.producer();
    await kafkaProducer.connect();
    console.log('✅ Kafka producer connected');
  } catch (error) {
    console.error('❌ Failed to connect Kafka producer:', error);
    kafkaProducer = null;
  }
}

// Send event to Kafka
async function sendToKafka(topic: string, event: any) {
  if (!kafkaProducer) {
    console.log('⚠️ Kafka producer not available, skipping Kafka send');
    return;
  }

  try {
    await kafkaProducer.send({
      topic,
      messages: [
        {
          key: event.token_mint || event.signature || Math.random().toString(),
          value: JSON.stringify(event),
        },
      ],
    });
    console.log(`📤 Sent event to Kafka topic: ${topic}`);
  } catch (error) {
    console.error(`❌ Failed to send event to Kafka topic ${topic}:`, error);
  }
}

// Helper functions
function generateRandomWallet(): string {
  return MOCK_WALLETS[Math.floor(Math.random() * MOCK_WALLETS.length)]!;
}

function generateTokenAddress(index: number): string {
  return `0x${(index + 1000).toString(16).padStart(40, '0')}`;
}

function generateTransactionHash(): string {
  return `0x${Math.random().toString(16).substr(2, 64)}`;
}

// Event generators
export function generateTokenCreateEvent(): TokenCreateData {
  const tokenIndex = tokenCounter++;
  const tokenMint = generateTokenAddress(tokenIndex);
  const tokenName = MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)]!;
  const tokenSymbol = MOCK_SYMBOLS[Math.floor(Math.random() * MOCK_SYMBOLS.length)]!;
  const initialSupply = (Math.random() * 1000000 + 100000).toFixed(0);

  const event: TokenCreateData = {
    chain_id: 0,
    token_mint: tokenMint,
    token_name: tokenName,
    token_symbol: tokenSymbol,
    creator_wallet: generateRandomWallet(),
    metadata_uri: "",
    initial_supply: initialSupply,
    block_time: Math.floor(Date.now() / 1000),
    slot: slotCounter++,
    signature: generateTransactionHash(),
    kafka_timestamp: new Date().toISOString()
  };

  // Add to created tokens list
  createdTokens.push({
    token_mint: tokenMint,
    created_at: Date.now()
  });

  return event;
}

export function generateTradeEvent(): TokenPurchaseData | TokenSaleData | null {
  if (createdTokens.length === 0) {
    return null; // No tokens created yet
  }

  // Pick a random created token
  const randomIndex = Math.floor(Math.random() * createdTokens.length);
  const randomToken = createdTokens[randomIndex];
  if (!randomToken) {
    return null;
  }

  const direction = Math.random() > 0.5 ? 'buy' : 'sell';
  const tokenAmount = (Math.random() * 1000 + 10).toFixed(2);
  const solAmount = (Math.random() * 0.1 + 0.01).toFixed(8);
  const marketCap = (Math.random() * 10000 + 1000).toFixed(2);

  const tradeEvent = {
    chain_id: 0,
    direction: direction,
    buyer_wallet: generateRandomWallet(),
    token_mint: randomToken.token_mint,
    token_amount: tokenAmount,
    token_decimals: 18,
    sol_amount: solAmount,
    market_cap: parseFloat(marketCap),
    block_time: Math.floor(Date.now() / 1000),
    slot: slotCounter++,
    signature: generateTransactionHash(),
    kafka_timestamp: new Date().toISOString()
  };

  return tradeEvent as TokenPurchaseData | TokenSaleData;
}

export function generateCompletionEvent(): TokenCompleteData | null {
  if (createdTokens.length === 0) {
    return null; // No tokens created yet
  }

  // Pick a random created token
  const randomIndex = Math.floor(Math.random() * createdTokens.length);
  const randomToken = createdTokens[randomIndex];
  if (!randomToken) {
    return null;
  }

  const migrationFee = (Math.random() * 0.1 + 0.01).toFixed(8); // Small BNB fee

  const event: TokenCompleteData = {
    chain_id: 0,
    token_mint: randomToken.token_mint,
    migrator_wallet: generateRandomWallet(),
    liquidity_pool: generateTokenAddress(Math.floor(Math.random() * 1000)), // Random pool address
    migration_fee: migrationFee,
    block_time: Math.floor(Date.now() / 1000),
    slot: slotCounter++,
    signature: generateTransactionHash(),
    kafka_timestamp: new Date().toISOString()
  };

  return event;
}

// Event emission functions
async function emitTokenCreateEvent() {
  const event = generateTokenCreateEvent();
  console.log('🎯 TokenCreate Event:');
  console.log(JSON.stringify(event, null, 2));
  console.log('---');

  // Send to Kafka
  await sendToKafka(TOKEN_RAW_CREATED, event);
}

async function emitTradeEvent() {
  const event = generateTradeEvent();
  if (event) {
    const eventType = event.direction === 'buy' ? 'TokenPurchase' : 'TokenSale';
    console.log(`💰 ${eventType} Event (${event.direction.toUpperCase()}):`);
    console.log(JSON.stringify(event, null, 2));
    console.log('---');

    // Send to Kafka
    await sendToKafka(TOKEN_RAW_TRADE, event);
  }
}

async function emitCompletionEvent() {
  const event = generateCompletionEvent();
  if (event) {
    console.log('✅ TokenComplete Event:');
    console.log(JSON.stringify(event, null, 2));
    console.log('---');

    // Send to Kafka
    await sendToKafka(TOKEN_RAW_MIGRATED, event);
  }
}

// Main mockup service
export async function startMockupService(): Promise<void> {
  console.log('🚀 Starting Four.meme Mockup Event Service...');

  // Initialize Kafka producer
  await initializeKafkaProducer();

  console.log('📊 Event Generation Rates:');
  console.log('  • Token Creation: 1 every 5 seconds');
  console.log('  • Trade Events: 1 every 2 seconds per token');
  console.log('  • Completion Events: 1 every 30 seconds');
  console.log('---');

  // Start token creation events (every 5 seconds)
  setInterval(async () => {
    try {
      await emitTokenCreateEvent();
    } catch (error) {
      console.error('❌ Error emitting token create event:', error);
    }
  }, 5000);

  // Start trade events (every 2 seconds)
  setInterval(async () => {
    try {
      await emitTradeEvent();
    } catch (error) {
      console.error('❌ Error emitting trade event:', error);
    }
  }, 2000);

  // Start completion events (every 30 seconds)
  setInterval(async () => {
    try {
      await emitCompletionEvent();
    } catch (error) {
      console.error('❌ Error emitting completion event:', error);
    }
  }, 30000);

  // Keep the process alive
  const shutdown = async () => {
    console.log('\n🛑 Shutting down Mockup Event Service...');
    console.log(`📈 Total tokens created: ${createdTokens.length}`);

    // Disconnect Kafka producer
    if (kafkaProducer) {
      try {
        await kafkaProducer.disconnect();
        console.log('✅ Kafka producer disconnected');
      } catch (error) {
        console.error('❌ Error disconnecting Kafka producer:', error);
      }
    }

    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log('✅ Mockup service started successfully');
}

// Run the service if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startMockupService().catch(console.error);
}