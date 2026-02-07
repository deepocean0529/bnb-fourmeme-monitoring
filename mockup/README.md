# Mockup Services for Four.meme Token Monitoring

This folder contains mockup services for testing and development of the four.meme token monitoring system.

## 📁 Files Overview

- **`mockup.ts`** - Event producer that generates realistic token events
- **`consumer.ts`** - Kafka consumer that displays consumed events
- **`test-integration.ts`** - Integration test running both producer and consumer

## 🚀 Usage

### Start Event Producer
Generates token creation, trade, and completion events at specified intervals:

```bash
npm run mockup
```

**Event Generation Rates:**
- Token Creation: 1 every 5 seconds
- Trade Events: 1 every 2 seconds (requires existing tokens)
- Completion Events: 1 every 30 seconds

### Start Kafka Consumer
Consumes and displays events from Kafka topics:

```bash
npm run mockup:consumer
```

**Monitored Topics:**
- `token.raw.created` - Token creation events
- `token.raw.trade` - Token purchase/sale events
- `token.raw.migrated` - Token completion events

### Run Integration Test
Runs both producer and consumer together for end-to-end testing:

```bash
npm run mockup:test
```

## 🎯 Event Schema

All generated events follow the README.md schema with these fields:

### TokenCreate Event
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

### TokenPurchase/TokenSale Events
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


## 🔧 Configuration

Events are generated with realistic mock data:
- **Token Names/Symbols**: Predefined lists (DogeCoin, ShibaInu, Pepe, etc.)
- **Wallets**: Mock Ethereum addresses
- **Amounts**: Realistic token and BNB amounts
- **Timestamps**: Current time + incremental counters

## 🧪 Testing Workflow

1. **Start Kafka**: Ensure Kafka broker is running on `localhost:9092`
2. **Run Consumer**: `npm run mockup:consumer` (in one terminal)
3. **Run Producer**: `npm run mockup` (in another terminal)
4. **Observe**: Events flow from producer → Kafka → consumer

Or use the integration test:
```bash
npm run mockup:test
```

## 📊 Monitoring

The consumer displays real-time statistics:
- Total events consumed
- Events per topic
- Events per second rate
- Runtime duration

## 🛑 Shutdown

All services handle graceful shutdown with `Ctrl+C` and display final statistics.