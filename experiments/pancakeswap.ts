import { ethers } from 'ethers';
import {
    ALCHEMY_API_KEY,
    ALCHEMY_WS_URL,
    pairContractABI,
} from '../config/config.js';
import { Interface } from 'ethers';
import { WebSocketProvider } from 'ethers';

// Types
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

// Helper functions
function formatBNB(value: ethers.BigNumberish): string {
  return ethers.formatEther(value);
}

function formatToken(value: ethers.BigNumberish, decimals: number = 18): string {
  return ethers.formatUnits(value, decimals);
}

// Cache for block timestamps
const blockTimestamps = new Map<number, number>();

// Function to get block timestamp with caching and retry logic
const getCachedBlockTimestamp = async (provider: ethers.Provider, blockNumber: number, maxRetries: number = 3): Promise<number | null> => {
  // Check cache first
  if (blockTimestamps.has(blockNumber)) {
    return blockTimestamps.get(blockNumber)!;
  }

  // Fetch from blockchain with retry logic
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const block = await provider.getBlock(blockNumber);

      // Check if block exists
      if (!block) {
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        } else {
          return null;
        }
      }

      // Block found, cache and return
      const timestamp = block.timestamp * 1000;
      blockTimestamps.set(blockNumber, timestamp);

      // Clean up old blocks (keep last 100 blocks)
      if (blockTimestamps.size > 100) {
        const oldestBlock = Math.min(...blockTimestamps.keys());
        blockTimestamps.delete(oldestBlock);
      }

      return timestamp;

    } catch (error) {
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        return null;
      }
    }
  }

  return null;
};

export async function startPancakeSwapMonitoring(): Promise<void> {
  console.log('🏊 Starting PancakeSwap monitoring...');

  const provider = new WebSocketProvider(ALCHEMY_WS_URL);

  // Initialize connection
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000);
    provider.once('block', () => {
      clearTimeout(timeout);
      resolve();
    });
  });

  console.log('✅ Connected to BSC network');

  const iface = new Interface(pairContractABI);
  const swapEvent = iface.getEvent('Swap');
  if (!swapEvent) {
    throw new Error('Swap event not found in ABI');
  }
  const swapTopic = swapEvent.topicHash;

  const pairAddresses: string[] = [
    "0x473d8f4e7f63389cd7cb44837bad01b754de772a",
    "0x9Fbd9892821efE8022881427EA6f03384080F351",
    "0xfaaa87be61eb923c60de3dd19cbca7654b52eb94",
  ];

  console.log(`🎯 Monitoring Swap events on ${pairAddresses.length} PancakeSwap pairs...`);

  const filter = {
    address: pairAddresses,
    topics: [swapTopic],
  };

  provider.on(filter, async (log: ethers.Log) => {
    try {
      // Parse the log
      const parsedLog = iface.parseLog(log);
      if (!parsedLog) {
        console.error('❌ Failed to parse swap log');
        return;
      }

      // Get block time
      const blockTimestamp = await getCachedBlockTimestamp(provider, log.blockNumber);
      const blockTime = blockTimestamp
        ? new Date(blockTimestamp).toISOString()
        : 'Block timestamp fetch failed';

      // Get pair reserves for liquidity calculation
      let liquidityValue = 'N/A';
      try {
        const pairContract = new ethers.Contract(log.address, pairContractABI, provider);
        const reserves = await pairContract.getReserves!();

        // Calculate total liquidity (showing BNB amount only)
        // For token/WBNB pairs, reserve1 is usually WBNB (BNB)
        const reserve1 = parseFloat(formatBNB(reserves[1])); // BNB amount in the pair

        // Total liquidity in BNB value
        liquidityValue = reserve1.toFixed(4) + ' BNB';
      } catch (error) {
        console.warn('⚠️ Could not fetch pair reserves:', (error as Error).message);
        liquidityValue = 'N/A';
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
        block_time: parseInt(blockTime),
        slot: log.blockNumber,
        signature: log.transactionHash,
        kafka_timestamp: new Date().toISOString(),
      };

      console.log(`🏊 PancakeSwap Trade Event (${direction.toUpperCase()}):`);
      console.log('Chain ID:', tradeData.chain_id);
      console.log(`${direction === 'buy' ? 'Buyer' : direction === 'sell' ? 'Seller' : 'Unknown'} Wallet:`, 'buyer_wallet' in tradeData ? tradeData.buyer_wallet : 'seller_wallet' in tradeData ? tradeData.seller_wallet : wallet);
      console.log('Token Mint:', tradeData.token_mint);
      console.log('Token Amount:', tradeData.token_amount);
      console.log('Token Decimals:', tradeData.token_decimals);
      console.log('Sol Amount:', tradeData.sol_amount);
      console.log('Market Cap:', tradeData.market_cap);
      console.log('Block Time:', tradeData.block_time);
      console.log('Slot:', tradeData.slot);
      console.log('Signature:', tradeData.signature);
      console.log('Kafka Timestamp:', tradeData.kafka_timestamp);
      console.log('---');

    } catch (error) {
      console.error('❌ Error processing PancakeSwap swap event:', (error as Error).message);
    }
  });

  console.log('✅ PancakeSwap monitoring started successfully');
  console.log(`📊 Monitoring ${pairAddresses.length} pairs for Swap events`);

  // Keep the process alive
  process.on('SIGINT', () => {
    console.log('🛑 Shutting down PancakeSwap monitoring...');
    provider.destroy();
    process.exit(0);
  });
}

startPancakeSwapMonitoring();