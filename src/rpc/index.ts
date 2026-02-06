import { ethers } from 'ethers';
import { TransactionDetails } from '../types/events.js';
import { formatBNB, sleep, calculateBackoffDelay, generateTransactionHash } from '../utils/helpers.js';

// RPC Provider and connection management
export class RPCProvider {
  private provider: ethers.WebSocketProvider | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private isConnected = false;

  constructor(
    private wsUrl: string,
    private maxReconnectAttempts: number = 10,
    private reconnectDelay: number = 5000,
    private healthCheckIntervalMs: number = 30000,
    private connectionTimeout: number = 10000
  ) {}

  async connect(): Promise<void> {
    try {
      this.provider = new ethers.WebSocketProvider(this.wsUrl);

      // Handle errors and connection issues
      this.provider.on('error', (error: Error) => {
        console.error('❌ Provider error:', error.message);
        if (this.healthCheckInterval) {
          clearInterval(this.healthCheckInterval);
        }
        this.reconnect();
      });

      // Monitor connection health with periodic checks
      this.healthCheckInterval = setInterval(async () => {
        try {
          await this.provider!.getBlockNumber();
        } catch (error) {
          if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
          }
          this.reconnect();
        }
      }, this.healthCheckIntervalMs);

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, this.connectionTimeout);

        this.provider!.once('block', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.reconnectAttempts = 0;
      this.isConnected = true;
      console.log('✅ Connected to BSC network');

    } catch (error) {
      console.error('❌ Connection error:', (error as Error).message);
      this.reconnect();
    }
  }

  private async reconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`❌ Max reconnection attempts (${this.maxReconnectAttempts}) reached. Exiting...`);
      process.exit(1);
    }

    this.reconnectAttempts++;
    this.isConnected = false;

    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.provider) {
      try {
        await this.provider.destroy();
      } catch (e) {
        // Ignore destroy errors
      }
      this.provider = null;
    }

    console.log(`🔄 Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    await sleep(this.reconnectDelay);
    await this.connect();
  }

  getProvider(): ethers.WebSocketProvider {
    if (!this.provider || !this.isConnected) {
      throw new Error('Provider not connected');
    }
    return this.provider;
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.provider) {
      try {
        await this.provider.destroy();
      } catch (e) {
        // Ignore destroy errors
      }
      this.provider = null;
    }
  }

  isHealthy(): boolean {
    return this.isConnected && this.provider !== null;
  }
}

// Block timestamp caching and management
export class BlockTimeManager {
  private blockTimestamps = new Map<number, number>();
  private maxCacheSize = 100;

  async getBlockTimestamp(provider: ethers.Provider, blockNumber: number, maxRetries: number = 3): Promise<number | null> {
    // Check cache first
    if (this.blockTimestamps.has(blockNumber)) {
      return this.blockTimestamps.get(blockNumber)!;
    }

    // Fetch from blockchain with retry logic
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const block = await provider.getBlock(blockNumber);

        // Check if block exists
        if (!block) {
          if (attempt < maxRetries) {
            const delay = calculateBackoffDelay(attempt);
            await sleep(delay);
            continue;
          } else {
            return null;
          }
        }

        // Block found, cache and return
        const timestamp = block.timestamp * 1000; // Convert to milliseconds
        this.blockTimestamps.set(blockNumber, timestamp);

        // Clean up old blocks (keep last N blocks)
        if (this.blockTimestamps.size > this.maxCacheSize) {
          const oldestBlock = Math.min(...this.blockTimestamps.keys());
          this.blockTimestamps.delete(oldestBlock);
        }

        console.log(`📦 Successfully fetched and cached timestamp for block ${blockNumber}: ${new Date(timestamp).toISOString()}`);
        return timestamp;

      } catch (error) {
        console.error(`❌ Error fetching block ${blockNumber} (attempt ${attempt}/${maxRetries}):`, (error as Error).message);

        if (attempt < maxRetries) {
          const delay = calculateBackoffDelay(attempt);
          console.log(`⏳ Retrying in ${delay}ms...`);
          await sleep(delay);
        } else {
          console.error(`❌ Failed to fetch block ${blockNumber} after ${maxRetries} attempts`);
          return null;
        }
      }
    }

    return null;
  }

  clearCache(): void {
    this.blockTimestamps.clear();
  }

  getCacheSize(): number {
    return this.blockTimestamps.size;
  }
}

// Transaction details fetching
export async function getTransactionDetails(
  provider: ethers.Provider,
  txHash: string
): Promise<TransactionDetails | null> {
  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return null;
    }

    const [tx, block] = await Promise.all([
      provider.getTransaction(txHash),
      provider.getBlock(receipt.blockNumber)
    ]);

    if (!tx || !block) {
      return null;
    }

    return {
      hash: tx.hash,
      blockNumber: tx.blockNumber || 0,
      blockHash: tx.blockHash || '',
      from: tx.from,
      to: tx.to || '',
      value: formatBNB(tx.value),
      gasLimit: tx.gasLimit?.toString() || '0',
      gasPrice: tx.gasPrice ? formatBNB(tx.gasPrice) : '0',
      gasUsed: receipt.gasUsed.toString(),
      transactionFee: tx.gasPrice && receipt.gasUsed
        ? formatBNB(tx.gasPrice * receipt.gasUsed)
        : '0',
      status: receipt.status === 1 ? 'Success' : 'Failed',
      timestamp: new Date(block.timestamp * 1000).toISOString(),
      logs: receipt.logs.length
    };
  } catch (error) {
    console.error(`Error fetching transaction details for ${txHash}:`, (error as Error).message);
    return null;
  }
}

// Contract interaction helpers
export async function getTokenTotalSupply(
  provider: ethers.Provider,
  tokenAddress: string
): Promise<bigint | null> {
  try {
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function totalSupply() view returns (uint256)'],
      provider
    );
    return await tokenContract.totalSupply();
  } catch (error) {
    console.warn(`⚠️ Could not fetch total supply for ${tokenAddress}:`, (error as Error).message);
    return null;
  }
}

export async function getPairReserves(
  provider: ethers.Provider,
  pairAddress: string
): Promise<{ reserve0: bigint; reserve1: bigint } | null> {
  try {
    const pairContract = new ethers.Contract(
      pairAddress,
      ['function getReserves() view returns (uint112, uint112, uint32)'],
      provider
    );
    const reserves = await (pairContract as any).getReserves();
    return {
      reserve0: reserves[0],
      reserve1: reserves[1]
    };
  } catch (error) {
    console.warn(`⚠️ Could not fetch pair reserves for ${pairAddress}:`, (error as Error).message);
    return null;
  }
}

// Global instances
let rpcProvider: RPCProvider | null = null;
let blockTimeManager: BlockTimeManager | null = null;

export function getRPCProvider(): RPCProvider {
  if (!rpcProvider) {
    throw new Error('RPC provider not initialized. Call initializeRPC() first.');
  }
  return rpcProvider;
}

export function getBlockTimeManager(): BlockTimeManager {
  if (!blockTimeManager) {
    blockTimeManager = new BlockTimeManager();
  }
  return blockTimeManager;
}

export async function initializeRPC(wsUrl: string): Promise<void> {
  rpcProvider = new RPCProvider(wsUrl);
  await rpcProvider.connect();
}

export async function shutdownRPC(): Promise<void> {
  if (rpcProvider) {
    await rpcProvider.disconnect();
  }
  if (blockTimeManager) {
    blockTimeManager.clearCache();
  }
}