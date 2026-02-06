import { ethers } from 'ethers';
import {
  ALCHEMY_API_KEY,
  ALCHEMY_WS_URL,
  TOKEN_MANAGER_V1,
  TOKEN_MANAGER_V2,
  MONITOR_TOKEN_CREATE,
  MONITOR_TOKEN_PURCHASE,
  MONITOR_TOKEN_SALE,
  MONITOR_LIQUIDITY_ADDED,
  MONITOR_TRADE_STOP,
  MONITOR_TOKEN_COMPLETION,
  tokenManagerV1ABI,
  tokenManagerV2ABI,
  MAX_RECONNECT_ATTEMPTS,
  RECONNECT_DELAY,
  HEALTH_CHECK_INTERVAL,
  CONNECTION_TIMEOUT
} from '../config/config.js';

// Types
interface TransactionDetails {
  hash: string;
  blockNumber: number;
  blockHash: string;
  from: string;
  to: string;
  value: string;
  gasLimit: string;
  gasPrice: string;
  gasUsed: string;
  transactionFee: string;
  status: string;
  timestamp: string;
  logs: number;
}

interface TokenCreateData {
  event: string;
  contractVersion: string;
  creator: string;
  token: string;
  requestId?: string;
  name: string;
  symbol: string;
  totalSupply: string;
  launchTime: string;
  launchFee: string;
}

interface TradeData {
  type: string;
  event: string;
  contractVersion: string;
  token: string;
  account: string;
  amount: string;
  cost: string;
  price?: string | null;
  fee: string;
  marketCap: string;
  offers?: string;
  funds?: string;
}

interface LiquidityData {
  event: string;
  contractVersion: string;
  base: string;
  offers: string;
  quote: string;
  funds: string;
}

interface TradeStopData {
  event: string;
  token: string;
}

interface CompletionData {
  event: string;
  contractVersion: string;
  token: string;
  timestamp: string;
}

// Helper function to format BNB value
function formatBNB(value: ethers.BigNumberish): string {
  return ethers.formatEther(value);
}

// Helper function to format token amount
function formatToken(value: ethers.BigNumberish, decimals: number = 18): string {
  return ethers.formatUnits(value, decimals);
}

// Helper function to get transaction details
async function getTransactionDetails(provider: ethers.Provider, txHash: string): Promise<TransactionDetails | null> {
  try {
    const [tx, receipt, block] = await Promise.all([
      provider.getTransaction(txHash),
      provider.getTransactionReceipt(txHash),
      provider.getBlock(receipt!.blockNumber)
    ]);

    return {
      hash: tx!.hash,
      blockNumber: tx!.blockNumber,
      blockHash: tx!.blockHash,
      from: tx!.from,
      to: tx!.to || '',
      value: formatBNB(tx!.value),
      gasLimit: tx!.gasLimit.toString(),
      gasPrice: tx!.gasPrice ? formatBNB(tx!.gasPrice) : '0',
      gasUsed: receipt!.gasUsed.toString(),
      transactionFee: tx!.gasPrice && receipt!.gasUsed
        ? formatBNB(tx!.gasPrice * receipt!.gasUsed)
        : '0',
      status: receipt!.status === 1 ? 'Success' : 'Failed',
      timestamp: new Date(block!.timestamp * 1000).toISOString(),
      logs: receipt!.logs.length
    };
  } catch (error) {
    // console.error(`Error fetching transaction details for ${txHash}:`, error.message);
    return null;
  }
}

// Event handlers
async function handleTokenCreate(provider: ethers.Provider, contractVersion: string, event: ethers.Log): Promise<TokenCreateData> {
  const args = event.args;
  const txDetails = await getTransactionDetails(provider, event.transactionHash);

  const tokenData: TokenCreateData = {
    event: 'TokenCreate',
    contractVersion,
    creator: args.creator || args[0],
    token: args.token || args[1],
    requestId: args.requestId?.toString() || args[2]?.toString(),
    name: args.name || args[3],
    symbol: args.symbol || args[4],
    totalSupply: formatToken(args.totalSupply || args[5]),
    launchTime: new Date(Number(args.launchTime || args[6]) * 1000).toISOString(),
    launchFee: contractVersion === 'V2'
      ? formatBNB(args.launchFee || args[7])
      : 'N/A',
    // transaction: txDetails
  };

  console.log('TokenCreate event');
  console.log(JSON.stringify(tokenData, null, 2));


  return tokenData;
}

async function handleTokenPurchase(provider: ethers.Provider, contractVersion: string, event: ethers.Log): Promise<TradeData> {
  const args = event.args;
  const txDetails = await getTransactionDetails(provider, event.transactionHash);

  // Calculate market cap (price * total supply)
  let marketCap = 'N/A';
  let price: string | null = null;
  let amount: string | null = null;
  let cost: string | null = null;

  if (contractVersion === 'V2') {
    price = formatToken(args.price || args[2]);
    amount = formatToken(args.amount || args[3]);
    cost = formatBNB(args.cost || args[4]);

    if (price) {
      try {
        const tokenContract = new ethers.Contract(
          args.token || args[0],
          ['function totalSupply() view returns (uint256)'],
          provider
        );
        const totalSupply = await tokenContract.totalSupply();
        const priceBNB = parseFloat(price);
        const supply = parseFloat(formatToken(totalSupply));
        marketCap = (priceBNB * supply).toFixed(8) + ' BNB';
      } catch (error) {
        // If we can't get total supply, leave as N/A
      }
    }
  }

  // Normalized trade data structure
  const tradeData: TradeData = {
    type: 'buy',
    event: 'TokenPurchase',
    contractVersion,
    token: args.token || args[0],
    account: args.account || args[1],
    amount: contractVersion === 'V2'
      ? amount!
      : formatToken(args.tokenAmount || args[2]),
    cost: contractVersion === 'V2'
      ? cost!
      : formatBNB(args.etherAmount || args[3]),
    price: contractVersion === 'V2' ? price : null,
    fee: contractVersion === 'V2'
      ? formatBNB(args.fee || args[5])
      : formatBNB(args.fee || args[4]),
    marketCap: contractVersion === 'V2' ? marketCap : 'N/A',
    ...(contractVersion === 'V2' ? {
      offers: formatToken(args.offers || args[6]),
      funds: formatBNB(args.funds || args[7])
    } : {}),
    // transaction: txDetails
  };

  console.log('TokenPurchase event');
  console.log(JSON.stringify(tradeData, null, 2));


  return tradeData;
}

async function handleTokenSale(provider: ethers.Provider, contractVersion: string, event: ethers.Log): Promise<TradeData> {
  const args = event.args;
  const txDetails = await getTransactionDetails(provider, event.transactionHash);

  // Calculate market cap (price * total supply)
  let marketCap = 'N/A';
  let price: string | null = null;
  let amount: string | null = null;
  let cost: string | null = null;

  if (contractVersion === 'V2') {
    price = formatToken(args.price || args[2]);
    amount = formatToken(args.amount || args[3]);
    cost = formatBNB(args.cost || args[4]);

    if (price) {
      try {
        const tokenContract = new ethers.Contract(
          args.token || args[0],
          ['function totalSupply() view returns (uint256)'],
          provider
        );
        const totalSupply = await tokenContract.totalSupply();
        const priceBNB = parseFloat(price);
        const supply = parseFloat(formatToken(totalSupply));
        marketCap = (priceBNB * supply).toFixed(8) + ' BNB';
      } catch (error) {
        // If we can't get total supply, leave as N/A
      }
    }
  }

  // Normalized trade data structure (same as purchase)
  const tradeData: TradeData = {
    type: 'sell',
    event: 'TokenSale',
    contractVersion,
    token: args.token || args[0],
    account: args.account || args[1],
    amount: contractVersion === 'V2'
      ? amount!
      : formatToken(args.tokenAmount || args[2]),
    cost: contractVersion === 'V2'
      ? cost!
      : formatBNB(args.etherAmount || args[3]),
    price: contractVersion === 'V2' ? price : null,
    fee: contractVersion === 'V2'
      ? formatBNB(args.fee || args[5])
      : formatBNB(args.fee || args[4]),
    marketCap: contractVersion === 'V2' ? marketCap : 'N/A',
    ...(contractVersion === 'V2' ? {
      offers: formatToken(args.offers || args[6]),
      funds: formatBNB(args.funds || args[7])
    } : {}),
    // transaction: txDetails
  };

  console.log('TokenSale event');
  console.log(JSON.stringify(tradeData, null, 2));


  return tradeData;
}

async function handleLiquidityAdded(provider: ethers.Provider, contractVersion: string, event: ethers.Log): Promise<LiquidityData> {
  const args = event.args;
  const txDetails = await getTransactionDetails(provider, event.transactionHash);
  const tokenAddress = args.base || args[0];

  const liquidityData: LiquidityData = {
    event: 'LiquidityAdded',
    contractVersion,
    base: tokenAddress,
    offers: formatToken(args.offers || args[1]),
    quote: args.quote || args[2],
    funds: formatBNB(args.funds || args[3]),
    // transaction: txDetails
  };

  console.log('LiquidityAdded event');
  console.log(JSON.stringify(liquidityData, null, 2));

  // Also trigger completion handler when liquidity is added (token is completed)
  if (MONITOR_TOKEN_COMPLETION) {
    try {
      await handleTokenCompletion(provider, contractVersion, tokenAddress, event.transactionHash);
    } catch (error) {
      console.error(`Error handling TokenCompletion event:`, error.message);
    }
  }

  return liquidityData;
}

async function handleTradeStop(provider: ethers.Provider, event: ethers.Log): Promise<TradeStopData> {
  const args = event.args;
  const txDetails = await getTransactionDetails(provider, event.transactionHash);

  const tradeStopData: TradeStopData = {
    event: 'TradeStop',
    token: args.token || args[0],
    // transaction: txDetails
  };


  return tradeStopData;
}

async function handleTokenCompletion(provider: ethers.Provider, contractVersion: string, tokenAddress: string, txHash: string): Promise<CompletionData> {
  const txDetails = await getTransactionDetails(provider, txHash);

  const completionData: CompletionData = {
    event: 'TokenCompleted',
    contractVersion,
    token: tokenAddress,
    timestamp: new Date().toISOString(),
    // transaction: txDetails
  };


  return completionData;
}

// Setup event listeners for a contract
function setupEventListeners(provider: ethers.Provider, contract: ethers.Contract, contractAddress: string, contractVersion: string): void {
  if (MONITOR_TOKEN_CREATE) {
    contract.on('TokenCreate', async (...args: any[]) => {
      const event = args[args.length - 1];
      try {
        await handleTokenCreate(provider, contractVersion, event);
      } catch (error) {
        console.error(`Error handling TokenCreate event:`, error.message);
      }
    });
  }

  if (MONITOR_TOKEN_PURCHASE) {
    contract.on('TokenPurchase', async (...args: any[]) => {
      const event = args[args.length - 1];
      try {
        await handleTokenPurchase(provider, contractVersion, event);
      } catch (error) {
        console.error(`Error handling TokenPurchase event:`, error.message);
      }
    });
  }

  if (MONITOR_TOKEN_SALE) {
    contract.on('TokenSale', async (...args: any[]) => {
      const event = args[args.length - 1];
      try {
        await handleTokenSale(provider, contractVersion, event);
      } catch (error) {
        console.error(`Error handling TokenSale event:`, error.message);
      }
    });
  }

  if (MONITOR_LIQUIDITY_ADDED && contractVersion === 'V2') {
    contract.on('LiquidityAdded', async (...args: any[]) => {
      const event = args[args.length - 1];
      try {
        await handleLiquidityAdded(provider, contractVersion, event);
      } catch (error) {
        console.error(`Error handling LiquidityAdded event:`, error.message);
      }
    });
  }

  if (MONITOR_TRADE_STOP && contractVersion === 'V2') {
    contract.on('TradeStop', async (...args: any[]) => {
      const event = args[args.length - 1];
      try {
        await handleTradeStop(provider, event);
      } catch (error) {
        console.error(`Error handling TradeStop event:`, error.message);
      }
    });
  }
}

// Main monitoring function
export async function startMonitoring(): Promise<void> {
  if (!ALCHEMY_API_KEY) {
    console.error('❌ Error: ALCHEMY_API_KEY is not set in .env file');
    console.error('Please get your free API key from https://alchemy.com/');
    process.exit(1);
  }


  let provider: ethers.WebSocketProvider | undefined;
  let healthCheckInterval: NodeJS.Timeout | undefined;
  let reconnectAttempts = 0;

  async function connect(): Promise<void> {
    try {
      provider = new ethers.WebSocketProvider(ALCHEMY_WS_URL);

      // Handle errors and connection issues
      provider.on('error', (error: Error) => {
        console.error('❌ Provider error:', error.message);
        if (healthCheckInterval) {
          clearInterval(healthCheckInterval);
        }
        reconnect();
      });

      // Monitor connection health with periodic checks
      healthCheckInterval = setInterval(async () => {
        try {
          await provider!.getBlockNumber();
        } catch (error) {
          if (healthCheckInterval) {
            clearInterval(healthCheckInterval);
          }
          reconnect();
        }
      }, HEALTH_CHECK_INTERVAL);

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, CONNECTION_TIMEOUT);

        provider!.once('block', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      reconnectAttempts = 0;

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
      setupEventListeners(provider, tokenManagerV1, TOKEN_MANAGER_V1, 'V1');
      setupEventListeners(provider, tokenManagerV2, TOKEN_MANAGER_V2, 'V2');

    } catch (error) {
      console.error('❌ Connection error:', error.message);
      reconnect();
    }
  }

  async function reconnect(): Promise<void> {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(`❌ Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Exiting...`);
      process.exit(1);
    }

    reconnectAttempts++;

    // Clear health check interval
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
      healthCheckInterval = undefined;
    }

    if (provider) {
      try {
        await provider.destroy();
      } catch (e) {
        // Ignore destroy errors
      }
    }

    setTimeout(() => {
      connect();
    }, RECONNECT_DELAY);
  }

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    // Clear intervals
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
    }

    if (provider) {
      try {
        await provider.destroy();
      } catch (e) {
        // Ignore destroy errors
      }
    }
    process.exit(0);
  });

  // Start connection
  await connect();
}