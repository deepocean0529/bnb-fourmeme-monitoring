import { ethers } from 'ethers';
import { Interface } from 'ethers';
import {
  TokenPurchaseEvent,
  TokenSaleEvent
} from '../types/events.js';
import {
  formatBNB,
  formatToken,
  generateKafkaTimestamp,
  createLogMessage
} from '../utils/helpers.js';
import {
  getRPCProvider,
  getBlockTimeManager,
  getPairReserves
} from '../rpc/index.js';
import {
  pairContractABI
} from '../../config/config.js';

// PancakeSwap trade data interface (adapted for PancakeSwap)
interface PancakeSwapTradeData {
  chain_id: number;
  direction: string;
  buyer_wallet?: string;
  seller_wallet?: string;
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

// Configuration for PancakeSwap monitoring
const PANCAKE_SWAP_PAIRS = [
  "0x473d8f4e7f63389cd7cb44837bad01b754de772a",
  "0x9Fbd9892821efE8022881427EA6f03384080F351",
  "0xfaaa87be61eb923c60de3dd19cbca7654b52eb94",
];

async function handlePancakeSwapTrade(log: ethers.Log): Promise<PancakeSwapTradeData> {
  const provider = getRPCProvider().getProvider();
  const blockTimeManager = getBlockTimeManager();

  // Parse the log
  const iface = new Interface(pairContractABI);
  const parsedLog = iface.parseLog(log);
  if (!parsedLog) {
    throw new Error('Failed to parse PancakeSwap swap log');
  }

  // Get block time
  const blockTimestamp = await blockTimeManager.getBlockTimestamp(provider, log.blockNumber);
  const blockTime = blockTimestamp ? Math.floor(blockTimestamp / 1000) : Math.floor(Date.now() / 1000);

  // Get pair reserves for liquidity calculation
  let liquidityValue = 'N/A';
  try {
    const reserves = await getPairReserves(provider, log.address);
    if (reserves) {
      // Calculate total liquidity (showing BNB amount only)
      // For token/WBNB pairs, reserve1 is usually WBNB (BNB)
      const reserve1 = parseFloat(formatBNB(reserves.reserve1));
      liquidityValue = reserve1.toFixed(4) + ' BNB';
    }
  } catch (error) {
    console.warn('⚠️ Could not fetch pair reserves:', (error as Error).message);
  }

  // Extract swap data
  const args = parsedLog.args;
  const amount0In = args.amount0In || args[1];
  const amount1In = args.amount1In || args[2];
  const amount0Out = args.amount0Out || args[3];
  const amount1Out = args.amount1Out || args[4];

  // Determine trade direction based on amounts
  let direction: string, wallet: string, tokenAddress: string, memeTokenAmount: string;

  if (amount0In > 0n && amount1Out > 0n) {
    // Selling token0 for token1 (sell direction)
    direction = 'sell';
    wallet = args.sender || args[0];
    tokenAddress = log.address; // Pair address
    memeTokenAmount = formatToken(amount0In);
  } else if (amount1In > 0n && amount0Out > 0n) {
    // Selling token1 for token0 (buy direction - buying token0)
    direction = 'buy';
    wallet = args.sender || args[0];
    tokenAddress = log.address; // Pair address
    memeTokenAmount = formatToken(amount0Out);
  } else {
    // Unknown swap pattern
    direction = 'unknown';
    wallet = args.sender || args[0];
    tokenAddress = log.address;
    memeTokenAmount = '0';
  }

  const tradeData: PancakeSwapTradeData = {
    chain_id: 0,
    direction: direction,
    ...(direction === 'buy'
      ? { buyer_wallet: wallet }
      : direction === 'sell'
      ? { seller_wallet: wallet }
      : {} // unknown direction
    ),
    token_mint: tokenAddress,
    token_amount: memeTokenAmount,
    token_decimals: 18, // Assuming 18 decimals for most tokens
    sol_amount: 'N/A', // Would need to calculate based on swap amounts
    market_cap: 0, // Market cap not applicable for PancakeSwap trades
    block_time: blockTime,
    slot: log.blockNumber,
    signature: log.transactionHash,
    kafka_timestamp: generateKafkaTimestamp()
  };

  const eventType = direction === 'buy' ? 'TokenPurchase' : direction === 'sell' ? 'TokenSale' : 'UnknownTrade';
  console.log(createLogMessage(`PancakeSwap${eventType}`, tradeData));

  return tradeData;
}

// Main PancakeSwap monitoring function
export async function startPancakeSwapMonitoring(): Promise<void> {
  console.log('🏊 Starting PancakeSwap monitoring...');

  const provider = getRPCProvider().getProvider();
  const iface = new Interface(pairContractABI);
  const swapTopic = iface.getEvent('Swap')?.topicHash;

  if (!swapTopic) {
    throw new Error('Swap event not found in PancakeSwap ABI');
  }

  console.log(`🎯 Monitoring Swap events on ${PANCAKE_SWAP_PAIRS.length} PancakeSwap pairs...`);

  const filter = {
    address: PANCAKE_SWAP_PAIRS,
    topics: [swapTopic],
  };

  provider.on(filter, async (log: ethers.Log) => {
    try {
      await handlePancakeSwapTrade(log);
    } catch (error) {
      console.error('❌ Error processing PancakeSwap swap event:', (error as Error).message);
    }
  });

  console.log('✅ PancakeSwap monitoring started successfully');
  console.log(`📊 Monitoring ${PANCAKE_SWAP_PAIRS.length} pairs for Swap events`);
}

// Get monitored pairs
export function getMonitoredPairs(): string[] {
  return [...PANCAKE_SWAP_PAIRS];
}

// Add a pair to monitor
export function addMonitoredPair(pairAddress: string): void {
  if (!PANCAKE_SWAP_PAIRS.includes(pairAddress)) {
    PANCAKE_SWAP_PAIRS.push(pairAddress);
    console.log(`✅ Added PancakeSwap pair to monitoring: ${pairAddress}`);
  }
}

// Remove a pair from monitoring
export function removeMonitoredPair(pairAddress: string): void {
  const index = PANCAKE_SWAP_PAIRS.indexOf(pairAddress);
  if (index > -1) {
    PANCAKE_SWAP_PAIRS.splice(index, 1);
    console.log(`✅ Removed PancakeSwap pair from monitoring: ${pairAddress}`);
  }
}