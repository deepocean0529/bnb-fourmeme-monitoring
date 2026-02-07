import { ethers } from 'ethers';
import { kafkaClient } from '../kafka/client.js';
import {
  TokenCreateEvent,
  TokenPurchaseEvent,
  TokenSaleEvent,
  CompleteFourMemeMigrationEvent,
  CreatedToken,
  LiquidityData,
  TradeStopData,
  CompletionData,
  FourMemeEvent
} from '../types/events.js';
import {
  formatBNB,
  formatToken,
  generateKafkaTimestamp,
  createLogMessage,
  calculateMarketCap
} from '../utils/helpers.js';
import {
  getRPCProvider,
  getBlockTimeManager,
  getTokenTotalSupply,
  getTransactionDetails
} from '../rpc/index.js';
import {
  MONITOR_TOKEN_CREATE,
  MONITOR_TOKEN_PURCHASE,
  MONITOR_TOKEN_SALE,
  MONITOR_LIQUIDITY_ADDED,
  MONITOR_TRADE_STOP,
  tokenManagerV1ABI,
  tokenManagerV2ABI,
  TOKEN_MANAGER_V1,
  TOKEN_MANAGER_V2,
  TOKEN_RAW_CREATED,
  TOKEN_RAW_TRADE,
  TOKEN_RAW_MIGRATED
} from '../../config/config.js';

// Track created tokens
let createdTokens: CreatedToken[] = [];

// Kafka producer
let kafkaProducer: any = null;

// Initialize Kafka producer
async function initializeKafkaProducer() {
  try {
    kafkaProducer = kafkaClient.producer();
    await kafkaProducer.connect();
    console.log('✅ Four.meme Kafka producer connected');
  } catch (error) {
    console.error('❌ Failed to connect Four.meme Kafka producer:', error);
    kafkaProducer = null;
  }
}

// Send event to Kafka
async function sendToKafka(topic: string, event: FourMemeEvent) {
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
    console.log(`📤 Sent ${topic} event to Kafka`);
  } catch (error) {
    console.error(`❌ Failed to send event to Kafka topic ${topic}:`, error);
  }
}

// Event handlers
async function handleTokenCreate(contractVersion: string, event: any): Promise<TokenCreateEvent> {
  const args = event.args;
  const provider = getRPCProvider().getProvider();
  const blockTimeManager = getBlockTimeManager();

  const blockTimestamp = await blockTimeManager.getBlockTimestamp(provider, event.log.blockNumber);
  const blockTime = blockTimestamp ? Math.floor(blockTimestamp / 1000) : Math.floor(Date.now() / 1000);

  const tokenData: TokenCreateEvent = {
    chain_id: 0,
    token_mint: args.token || args[1],
    token_name: args.name || args[3],
    token_symbol: args.symbol || args[4],
    creator_wallet: args.creator || args[0],
    metadata_uri: 'N/A', // Metadata URI not directly available in TokenCreate event
    initial_supply: formatToken(args.totalSupply || args[5]),
    block_time: blockTime,
    slot: event.log.blockNumber,
    signature: event.log.transactionHash,
    kafka_timestamp: generateKafkaTimestamp()
  };

  // Add to created tokens list
  createdTokens.push({
    token_mint: tokenData.token_mint,
    created_at: Date.now()
  });

  console.log(createLogMessage('TokenCreate', tokenData));

  // Send to Kafka
  await sendToKafka(TOKEN_RAW_CREATED, tokenData);

  return tokenData;
}

async function handleTokenPurchase(contractVersion: string, event: any): Promise<TokenPurchaseEvent> {
  const args = event.args;
  const provider = getRPCProvider().getProvider();
  const blockTimeManager = getBlockTimeManager();

  const blockTimestamp = await blockTimeManager.getBlockTimestamp(provider, event.log.blockNumber);
  const blockTime = blockTimestamp ? Math.floor(blockTimestamp / 1000) : Math.floor(Date.now() / 1000);

  // Calculate market cap (price * total supply)
  let marketCapValue = 0;
  let price = 0;

  if (contractVersion === 'V2') {
    price = parseFloat(formatToken(args.price || args[2]));

    if (price > 0) {
      try {
        // const totalSupply = await getTokenTotalSupply(provider, args.token || args[0]);
        const totalSupply = 1000000000; // 1 billion tokens is default for four.meme and this saves API calls
        if (totalSupply) {
          const supply = parseFloat(formatToken(totalSupply));
          marketCapValue = calculateMarketCap(price, supply);
        }
      } catch (error) {
        console.warn('⚠️ Could not calculate market cap:', (error as Error).message);
      }
    }
  }

  const tradeData: TokenPurchaseEvent = {
    chain_id: 0,
    direction: 'buy',
    buyer_wallet: args.account || args[1],
    token_mint: args.token || args[0],
    token_amount: contractVersion === 'V2'
      ? formatToken(args.amount || args[3])
      : formatToken(args.tokenAmount || args[2]),
    token_decimals: 18,
    sol_amount: contractVersion === 'V2'
      ? formatBNB(args.cost || args[4])
      : formatBNB(args.etherAmount || args[3]),
    market_cap: marketCapValue,
    block_time: blockTime,
    slot: event.log.blockNumber,
    signature: event.log.transactionHash,
    kafka_timestamp: generateKafkaTimestamp()
  };

  console.log(createLogMessage('TokenPurchase', tradeData));

  // Send to Kafka
  await sendToKafka(TOKEN_RAW_TRADE, tradeData);

  return tradeData;
}

async function handleTokenSale(contractVersion: string, event: any): Promise<TokenSaleEvent> {
  const args = event.args;
  const provider = getRPCProvider().getProvider();
  const blockTimeManager = getBlockTimeManager();

  const blockTimestamp = await blockTimeManager.getBlockTimestamp(provider, event.log.blockNumber);
  const blockTime = blockTimestamp ? Math.floor(blockTimestamp / 1000) : Math.floor(Date.now() / 1000);

  // Calculate market cap (price * total supply)
  let marketCapValue = 0;
  let price = 0;

  if (contractVersion === 'V2') {
    price = parseFloat(formatToken(args.price || args[2]));

    if (price > 0) {
      try {
        const totalSupply = await getTokenTotalSupply(provider, args.token || args[0]);
        if (totalSupply) {
          const supply = parseFloat(formatToken(totalSupply));
          marketCapValue = calculateMarketCap(price, supply);
        }
      } catch (error) {
        console.warn('⚠️ Could not calculate market cap:', (error as Error).message);
      }
    }
  }

  const tradeData: TokenSaleEvent = {
    chain_id: 0,
    direction: 'sell',
    buyer_wallet: args.account || args[1],
    token_mint: args.token || args[0],
    token_amount: contractVersion === 'V2'
      ? formatToken(args.amount || args[3])
      : formatToken(args.tokenAmount || args[2]),
    token_decimals: 18,
    sol_amount: contractVersion === 'V2'
      ? formatBNB(args.cost || args[4])
      : formatBNB(args.etherAmount || args[3]),
    market_cap: marketCapValue,
    block_time: blockTime,
    slot: event.log.blockNumber,
    signature: event.log.transactionHash,
    kafka_timestamp: generateKafkaTimestamp()
  };

  console.log(createLogMessage('TokenSale', tradeData));

  // Send to Kafka
  await sendToKafka(TOKEN_RAW_TRADE, tradeData);

  return tradeData;
}

async function handleLiquidityAdded(contractVersion: string, event: any): Promise<CompleteFourMemeMigrationEvent> {
  const args = event.args;
  const provider = getRPCProvider().getProvider();
  const blockTimeManager = getBlockTimeManager();

  const blockTimestamp = await blockTimeManager.getBlockTimestamp(provider, event.log.blockNumber);
  const blockTime = blockTimestamp ? Math.floor(blockTimestamp / 1000) : Math.floor(Date.now() / 1000);

  const tokenAddress = args.base || args[0];

  // Read migrator_wallet and liquidity_pool from token contract
  let migratorWallet = 'N/A';
  let liquidityPool = 'N/A';

  try {
    const tokenContract = new ethers.Contract(
      tokenAddress,
      [
        'function founder() view returns (address)',
        'function pair() view returns (address)'
      ],
      provider
    );

    const [founderAddress, pairAddress] = await Promise.all([
      tokenContract.founder!(),
      tokenContract.pair!()
    ]);

    migratorWallet = founderAddress;
    liquidityPool = pairAddress;
  } catch (error) {
    console.warn(`⚠️ Could not read contract data for token ${tokenAddress}:`, (error as Error).message);
  }

  const liquidityData: CompleteFourMemeMigrationEvent = {
    chain_id: 0,
    token_mint: tokenAddress,
    migrator_wallet: migratorWallet,
    liquidity_pool: liquidityPool,
    migration_fee: formatBNB(args.funds || args[3]),
    block_time: blockTime,
    slot: event.log.blockNumber,
    signature: event.log.transactionHash,
    kafka_timestamp: generateKafkaTimestamp()
  };

  console.log(createLogMessage('CompleteFourMemeMigration', liquidityData));

  // Send to Kafka
  await sendToKafka(TOKEN_RAW_MIGRATED, liquidityData);

  return liquidityData;
}

async function handleTradeStop(event: any): Promise<TradeStopData> {
  const args = event.args;

  const tradeStopData: TradeStopData = {
    event: 'TradeStop',
    token: args.token || args[0]
  };

  console.log(createLogMessage('TradeStop', tradeStopData));
  return tradeStopData;
}


// Setup event listeners for a contract
function setupEventListeners(
  contract: ethers.Contract,
  contractAddress: string,
  contractVersion: string
): void {
  if (MONITOR_TOKEN_CREATE) {
    contract.on('TokenCreate', async (...args: any[]) => {
      const event = args[args.length - 1];
      try {
        await handleTokenCreate(contractVersion, event);
      } catch (error) {
        console.error(`Error handling TokenCreate event:`, (error as Error).message);
      }
    });
  }

  if (MONITOR_TOKEN_PURCHASE) {
    contract.on('TokenPurchase', async (...args: any[]) => {
      const event = args[args.length - 1];
      try {
        await handleTokenPurchase(contractVersion, event);
      } catch (error) {
        console.error(`Error handling TokenPurchase event:`, (error as Error).message);
      }
    });
  }

  if (MONITOR_TOKEN_SALE) {
    contract.on('TokenSale', async (...args: any[]) => {
      const event = args[args.length - 1];
      try {
        await handleTokenSale(contractVersion, event);
      } catch (error) {
        console.error(`Error handling TokenSale event:`, (error as Error).message);
      }
    });
  }

  if (MONITOR_LIQUIDITY_ADDED && contractVersion === 'V2') {
    contract.on('LiquidityAdded', async (...args: any[]) => {
      const event = args[args.length - 1];
      try {
        await handleLiquidityAdded(contractVersion, event);
      } catch (error) {
        console.error(`Error handling LiquidityAdded event:`, (error as Error).message);
      }
    });
  }

  if (MONITOR_TRADE_STOP && contractVersion === 'V2') {
    contract.on('TradeStop', async (...args: any[]) => {
      const event = args[args.length - 1];
      try {
        await handleTradeStop(event);
      } catch (error) {
        console.error(`Error handling TradeStop event:`, (error as Error).message);
      }
    });
  }
}

// Main monitoring function
export async function startFourMemeMonitoring(): Promise<void> {
  console.log('🎯 Starting Four.meme Token Monitoring...');

  // Initialize Kafka producer
  await initializeKafkaProducer();

  const provider = getRPCProvider().getProvider();

  // Setup contracts
  const tokenManagerV1 = new ethers.Contract(
    TOKEN_MANAGER_V1,
    tokenManagerV1ABI,
    provider
  );

  const tokenManagerV2 = new ethers.Contract(
    TOKEN_MANAGER_V2,
    tokenManagerV2ABI,
    provider
  );

  // Setup event listeners
  setupEventListeners(tokenManagerV1, TOKEN_MANAGER_V1, 'V1');
  setupEventListeners(tokenManagerV2, TOKEN_MANAGER_V2, 'V2');

  console.log('✅ Four.meme monitoring started successfully');
  console.log(`📊 Monitoring contracts: ${TOKEN_MANAGER_V1} (V1), ${TOKEN_MANAGER_V2} (V2)`);
}

// Cleanup function
export function clearCreatedTokens(): void {
  createdTokens = [];
}

// Get current created tokens count
export function getCreatedTokensCount(): number {
  return createdTokens.length;
}