import { ethers } from 'ethers';
import {
  TokenCreateEvent,
  TokenPurchaseEvent,
  TokenSaleEvent,
  CompleteFourMemeMigrationEvent,
  TokenCompleteEvent,
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
  MONITOR_TOKEN_COMPLETION,
  tokenManagerV1ABI,
  tokenManagerV2ABI,
  TOKEN_MANAGER_V1,
  TOKEN_MANAGER_V2
} from '../../config/config.js';

// Track created tokens
let createdTokens: CreatedToken[] = [];

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
  return tradeData;
}

async function handleLiquidityAdded(contractVersion: string, event: any): Promise<CompleteFourMemeMigrationEvent> {
  const args = event.args;
  const provider = getRPCProvider().getProvider();
  const blockTimeManager = getBlockTimeManager();

  const blockTimestamp = await blockTimeManager.getBlockTimestamp(provider, event.log.blockNumber);
  const blockTime = blockTimestamp ? Math.floor(blockTimestamp / 1000) : Math.floor(Date.now() / 1000);

  const liquidityData: CompleteFourMemeMigrationEvent = {
    chain_id: 0,
    token_mint: args.base || args[0],
    migrator_wallet: 'N/A', // Would need additional logic to get migrator wallet
    liquidity_pool: 'N/A', // Would need additional logic to derive actual pool address
    migration_fee: formatBNB(args.funds || args[3]),
    block_time: blockTime,
    slot: event.log.blockNumber,
    signature: event.log.transactionHash,
    kafka_timestamp: generateKafkaTimestamp()
  };

  console.log(createLogMessage('CompleteFourMemeMigration', liquidityData));

  // Also trigger completion handler when liquidity is added (token is completed)
  if (MONITOR_TOKEN_COMPLETION) {
    try {
      await handleTokenCompletion(contractVersion, args.base || args[0], event.log.transactionHash);
    } catch (error) {
      console.error(`Error handling TokenCompletion event:`, (error as Error).message);
    }
  }

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

async function handleTokenCompletion(contractVersion: string, tokenAddress: string, txHash: string): Promise<TokenCompleteEvent> {
  const provider = getRPCProvider().getProvider();

  const completionData: TokenCompleteEvent = {
    chain_id: 0,
    token_mint: tokenAddress,
    completion_wallet: 'N/A', // Would need additional logic to get completion wallet
    final_supply: 'N/A', // Would need additional logic to get final supply
    total_raised: 'N/A', // Would need additional logic to get total raised
    block_time: Math.floor(Date.now() / 1000),
    slot: 0, // Would need to get from transaction
    signature: txHash,
    kafka_timestamp: generateKafkaTimestamp()
  };

  console.log(createLogMessage('TokenCompleted', completionData));
  return completionData;
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