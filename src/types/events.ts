// Event schema type definitions matching README.md

export interface BaseEvent {
  chain_id: number;
  kafka_timestamp: string;
}

export interface TokenCreateEvent extends BaseEvent {
  token_mint: string;
  token_name: string;
  token_symbol: string;
  creator_wallet: string;
  metadata_uri: string;
  initial_supply: string;
  block_time: number;
  slot: number;
  signature: string;
}

export interface TokenPurchaseEvent extends BaseEvent {
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
}

export interface TokenSaleEvent extends BaseEvent {
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
}

export interface CompleteFourMemeMigrationEvent extends BaseEvent {
  token_mint: string;
  migrator_wallet: string;
  liquidity_pool: string;
  migration_fee: string;
  block_time: number;
  slot: number;
  signature: string;
}


// Union type for all possible events
export type FourMemeEvent =
  | TokenCreateEvent
  | TokenPurchaseEvent
  | TokenSaleEvent
  | CompleteFourMemeMigrationEvent;

// Internal data structures for processing
export interface TransactionDetails {
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

export interface CreatedToken {
  token_mint: string;
  created_at: number;
}

export interface LiquidityData {
  event: string;
  contractVersion: string;
  base: string;
  offers: string;
  quote: string;
  funds: string;
}

export interface TradeStopData {
  event: string;
  token: string;
}

export interface CompletionData {
  event: string;
  contractVersion: string;
  token: string;
  timestamp: string;
}

// Event handler function types
export type EventHandler<T> = (event: T) => Promise<void>;
export type RawEventHandler = (...args: any[]) => Promise<void>;