import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename: string = fileURLToPath(import.meta.url);
const __dirname: string = dirname(__filename);

// Environment Configuration
export const ALCHEMY_API_KEY: string = process.env.ALCHEMY_API_KEY || '';

// Network and Contract Configuration
export const BSC_NETWORK: string = 'bsc';
export const TOKEN_MANAGER_V1: string = '0xEC4549caDcE5DA21Df6E6422d448034B5233bFbC';
export const TOKEN_MANAGER_V2: string = '0x5c952063c7fc8610FFDB798152D69F0B9550762b';

// Monitoring Options
export const MONITOR_TOKEN_CREATE: boolean = true;
export const MONITOR_TOKEN_PURCHASE: boolean = true;
export const MONITOR_TOKEN_SALE: boolean = true;
export const MONITOR_LIQUIDITY_ADDED: boolean = true;
export const MONITOR_TRADE_STOP: boolean = false;
export const MONITOR_TOKEN_COMPLETION: boolean = true;

// Connection Configuration
export const MAX_RECONNECT_ATTEMPTS: number = 10;
export const RECONNECT_DELAY: number = 5000; // 5 seconds
export const HEALTH_CHECK_INTERVAL: number = 30000; // 30 seconds
export const CONNECTION_TIMEOUT: number = 10000; // 10 seconds

// WebSocket Endpoints
export const ALCHEMY_WS_URL: string = `https://bnb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

// Load ABIs
export const tokenManagerV1ABI: any[] = JSON.parse(
  readFileSync(join(__dirname, '..', 'ABI', 'TokenManager.lite.abi'), 'utf8')
);
export const tokenManagerV2ABI: any[] = JSON.parse(
  readFileSync(join(__dirname, '..', 'ABI', 'TokenManager2.lite.abi'), 'utf8')
);
// Load Pair Contract ABI
export const pairContractABI: any[] = JSON.parse(
  readFileSync(join(__dirname, '..', 'ABI', 'pair contract.abi'), 'utf8')
);

// Helper constants
export const __dirname_config: string = __dirname;

export const TOKEN_RAW_CREATED = 'token.raw.created';
export const TOKEN_RAW_TRADE = 'token.raw.trade';
export const TOKEN_RAW_MIGRATED = 'token.raw.migrated';

export const KAFKA_CLIENT_ID: string = 'binance-token-monitor';
export const KAFKA_BROKER: string = 'localhost:9092';