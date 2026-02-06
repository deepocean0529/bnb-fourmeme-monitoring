# Four.meme Token Monitoring

This project monitors token events on the Binance Smart Chain (BSC) for four.meme tokens.

## Event Types

### TokenCreate Event

Emitted when a new token is created on four.meme.

```json
{
  "chain_id": 0,
  "token_mint": "string",
  "token_name": "string",
  "token_symbol": "string",
  "creator_wallet": "string",
  "metadata_uri": "string",
  "initial_supply": "string",
  "block_time": "number",
  "slot": "number",
  "signature": "string",
  "kafka_timestamp": "string"
}
```

### Buy Event

Emitted when a user buys tokens.

```json
{
  "chain_id": 0,
  "direction": "string",
  "buyer_wallet": "string",
  "token_mint": "string",
  "token_amount": "string",
  "token_decimals": "number",
  "sol_amount": "string",
  "market_cap": "number",
  "block_time": "number",
  "slot": "number",
  "signature": "string",
  "kafka_timestamp": "string"
}
```

### TokenSale Event

Emitted when a user sells tokens.

```json
{
  "chain_id": 0,
  "direction": "string",
  "buyer_wallet": "string",
  "token_mint": "string",
  "token_amount": "string",
  "token_decimals": "number",
  "sol_amount": "string",
  "market_cap": "number",
  "block_time": "number",
  "slot": "number",
  "signature": "string",
  "kafka_timestamp": "string"
}
```

### CompleteFourMemeMigrationEvent

Emitted when a token completes its four.meme launch phase.

```json
{
  "chain_id": 0,
  "token_mint": "string",
  "migrator_wallet": "string",
  "liquidity_pool": "string",
  "migration_fee": "string",
  "block_time": "number",
  "slot": "number",
  "signature": "string",
  "kafka_timestamp": "string"
}
```

### TokenComplete Event

Emitted when a token completes its four.meme launch phase.

```json
{
  "chain_id": 0,
  "token_mint": "string",
  "migrator_wallet": "string",
  "liquidity_pool": "string",
  "migration_fee": "string",
  "block_time": "number",
  "slot": "number",
  "signature": "string",
  "kafka_timestamp": "string"
}
```