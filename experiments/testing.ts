import { ethers } from 'ethers';
import {
    ALCHEMY_API_KEY,
    ALCHEMY_WS_URL,
    pairContractABI,
    tokenManagerV2ABI,
    TOKEN_MANAGER_V2
} from '../config/config.js';
import { Interface } from 'ethers';
import { WebSocketProvider } from 'ethers';

// Types
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
  block_time: string;
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


export async function test(): Promise<void> {
  console.log('Starting TokenCreate event monitoring...');

  const provider = new WebSocketProvider(ALCHEMY_WS_URL);

  // Cache for block timestamps (blockNumber -> timestamp)
  const blockTimestamps = new Map<number, number>();

  // Function to get block timestamp with caching and retry logic
  const getCachedBlockTimestamp = async (blockNumber: number, maxRetries: number = 3): Promise<number | null> => {
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
            // Wait before retry (exponential backoff)
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Max 5 seconds
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          } else {;
            return null;
          }
        }

        // Block found, cache and return
        const timestamp = block.timestamp * 1000; // Convert to milliseconds
        blockTimestamps.set(blockNumber, timestamp);

        // Clean up old blocks (keep last 100 blocks)
        if (blockTimestamps.size > 100) {
          const oldestBlock = Math.min(...blockTimestamps.keys());
            blockTimestamps.delete(oldestBlock);
        }

        console.log(`📦 Successfully fetched and cached timestamp for block ${blockNumber}: ${new Date(timestamp).toISOString()}`);
        return timestamp;

      } catch (error) {
        console.error(`❌ Error fetching block ${blockNumber} (attempt ${attempt}/${maxRetries}):`, (error as Error).message);

        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Max 5 seconds
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error(`❌ Failed to fetch block ${blockNumber} after ${maxRetries} attempts`);
          return null;
        }
      }
    }

    return null; // Should never reach here, but just in case
  };

  // Create contract instances
  const tokenManagerV2 = new ethers.Contract(TOKEN_MANAGER_V2, tokenManagerV2ABI, provider);

  // Monitor TokenCreate events on V2 contract
  tokenManagerV2.on('TokenCreate', async (...args: any[]) => {
    const event = args[args.length - 1];
    try {
      // Get block time with caching (fetches if needed)
      const blockTimestamp = await getCachedBlockTimestamp(event.log.blockNumber);
      const blockTime = blockTimestamp
        ? new Date(blockTimestamp).toISOString()
        : 'Block timestamp fetch failed';

      // Extract required fields from note.txt
      const tokenData: TokenCreateData = {
        chain_id: 0,
        token_mint: event.args.token || event.args[1],
        token_name: event.args.name || event.args[3],
        token_symbol: event.args.symbol || event.args[4],
        creator_wallet: event.args.creator || event.args[0],
        metadata_uri: 'N/A', // Metadata URI not directly available in TokenCreate event
        initial_supply: formatToken(event.args.totalSupply || event.args[5]),
        block_time: parseInt(blockTime),
        slot: event.log.blockNumber,
        signature: event.log.transactionHash,
        kafka_timestamp: new Date().toISOString(),
      };

      console.log('🎯 TokenCreate Event (V2):');
      console.log('Token Mint:', tokenData.token_mint);
      console.log('Token Name:', tokenData.token_name);
      console.log('Token Symbol:', tokenData.token_symbol);
      console.log('Creator Wallet:', tokenData.creator_wallet);
      console.log('Metadata URI:', tokenData.metadata_uri);
      console.log('Initial Supply:', tokenData.initial_supply);
      console.log('Block Time:', tokenData.block_time);
      console.log('Slot:', tokenData.slot);
      console.log('Signature:', tokenData.signature);
      console.log('Kafka Timestamp:', tokenData.kafka_timestamp);
      console.log('---');

    } catch (error) {
      console.error('Error handling TokenCreate event (V2):', (error as Error).message);
    }
  });

  // Combined handler for both TokenPurchase (BUY) and TokenSale (SELL) events
  const handleTradeEvent = (direction: string, emoji: string) => async (...args: any[]) => {
    const event = args[args.length - 1];
    try {
      // Get block time with caching (fetches if needed)
      const blockTimestamp = await getCachedBlockTimestamp(event.log.blockNumber);
      const blockTime = blockTimestamp
        ? new Date(blockTimestamp).toISOString()
        : 'Block timestamp fetch failed';

      // Calculate market cap for bonding curve phase
      // Market Cap = Price × Initial Supply
      // Using typical four.meme initial supply of 1,000,000 tokens
      const INITIAL_SUPPLY = 1000000000; // 1 billion tokens (typical four.meme value)
      const price = parseFloat(formatToken(event.args.price || event.args[2] || '0'));
      const marketCapValue = price > 0 ? price * INITIAL_SUPPLY : 0;

      // Extract required fields from note.txt
      const tradeData: TokenPurchaseData | TokenSaleData = {
        chain_id: 0,
        direction: direction,
        buyer_wallet: event.args.account || event.args[1],
        token_mint: event.args.token || event.args[0],
        token_amount: formatToken(event.args.amount || event.args[3]),
        token_decimals: 18, // Assuming 18 decimals for most tokens
        sol_amount: formatBNB(event.args.cost || event.args[4] || '0'),
        market_cap: marketCapValue,
        block_time: parseInt(blockTime),
        slot: event.log.blockNumber,
        signature: event.log.transactionHash,
        kafka_timestamp: new Date().toISOString(),
      };

      console.log(`${emoji} Trade Event (${direction.toUpperCase()}):`);
      console.log(`${direction === 'buy' ? 'Buyer' : 'Seller'} Wallet:`, tradeData.buyer_wallet);
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
      console.error(`Error handling ${direction} trade event:`, (error as Error).message);
    }
  };

  // Register combined handler for both BUY and SELL events
  tokenManagerV2.on('TokenPurchase', handleTradeEvent('buy', '💰'));
  tokenManagerV2.on('TokenSale', handleTradeEvent('sell', '💸'));

  // Monitor LiquidityAdded events (token completion)
  tokenManagerV2.on('LiquidityAdded', async (...args: any[]) => {
    const event = args[args.length - 1];
    try {
      // Get block time with caching (fetches if needed)
      const blockTimestamp = await getCachedBlockTimestamp(event.log.blockNumber);
      const blockTime = blockTimestamp
        ? new Date(blockTimestamp).toISOString()
        : 'Block timestamp fetch failed';

      // Extract completion data as specified in note.txt
      const completionData: TokenCompleteData = {
        chain_id: 0,
        token_mint: event.args.base || event.args[0],
        migrator_wallet: 'N/A', // Would need additional logic to get migrator wallet
        liquidity_pool: 'N/A', // Would need additional logic to get liquidity pool
        migration_fee: 'N/A', // Would need additional logic to get migration fee
        block_time: blockTime,
        slot: event.log.blockNumber,
        signature: event.log.transactionHash,
        kafka_timestamp: new Date().toISOString(),
      };

      console.log('✅ Complete Event:');
      console.log('Chain ID:', completionData.chain_id);
      console.log('Token Mint:', completionData.token_mint);
      console.log('Migrator Wallet:', completionData.migrator_wallet);
      console.log('Liquidity Pool:', completionData.liquidity_pool);
      console.log('Migration Fee:', completionData.migration_fee);
      console.log('Block Time:', completionData.block_time);
      console.log('Slot:', completionData.slot);
      console.log('Signature:', completionData.signature);
      console.log('Kafka Timestamp:', completionData.kafka_timestamp);
      console.log('---');

    } catch (error) {
      console.error('Error handling LiquidityAdded (Complete) event:', (error as Error).message);
    }
  });

  console.log('✅ Event monitoring started for V2 contract');
  console.log('Monitoring: TokenCreate, TokenPurchase (BUY), TokenSale (SELL), LiquidityAdded (Complete)');
  console.log('Listening on contract:', TOKEN_MANAGER_V2);

  /*
  const iface = new Interface(pairContractABI);

  const pairAddresses = [
    "0xd4c5F2F3BbBDBde865Adc138B8A928c829f479B0",
  ]

  const swapTopic = iface.getEvent('Swap').topicHash;

  console.log('Swap topic:', swapTopic);

  const filter = {
    address: pairAddresses,
    topics: [swapTopic],
  };

  provider.on(filter, (event) => {
    // console.log('Swap event detected:', event);
    console.log('Transaction hash:', event.transactionHash);
    let parsed = iface.parseLog(event);
    // console.log('parsed: ', parsed);
    console.log(parsed.fragment.inputs[0].name + ": " + parsed.args[0])
    console.log(parsed.fragment.inputs[1].name + ": " + parsed.args[1])
    console.log(parsed.fragment.inputs[2].name + ": " + parsed.args[2])
    console.log(parsed.fragment.inputs[3].name + ": " + parsed.args[3])
    console.log(parsed.fragment.inputs[4].name + ": " + parsed.args[4])
    console.log(parsed.fragment.inputs[5].name + ": " + parsed.args[5])
  });
  */


}

test();