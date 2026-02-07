# Experiment Scripts for Four.meme Token Monitoring

This folder contains experimental scripts for testing and development purposes.

## 📁 Files Overview

- **`monitor.ts`** - Original monitoring script (deprecated)
- **`testing.ts`** - Event testing script
- **`pancakeswap.ts`** - PancakeSwap monitoring script
- **`transaction-details.ts`** - Transaction analysis tool

## 🚀 Available Experiments

### Transaction Details Analyzer
Analyzes a specific transaction by its hash and provides detailed information:

```bash
npm run tx:analyze
```

**Features:**
- Fetches complete transaction details from blockchain
- Displays formatted transaction information
- Provides additional analysis (gas efficiency, estimated costs)
- Shows contract interaction details

**Configuration:**
- Update `TRANSACTION_ID` constant with the desired transaction hash
- Requires active RPC connection (uses Alchemy)

**Sample Output:**
```
🔍 Analyzing Transaction Details...
📋 Transaction ID: 0x1234...
---
📄 Transaction Details:
==================================================
🔗 Hash: 0x1234...
📍 Block: 12345678
🏗️  Block Hash: 0xabcd...
👤 From: 0x742d...
🏠 To: 0x9Fbd...
💰 Value: 0.1 BNB
⚙️  Gas Limit: 21000
💨 Gas Price: 5000000000 wei
🔥 Gas Used: 21000
💸 Transaction Fee: 0.000105 BNB
📊 Status: Success
🕒 Timestamp: 2024-01-15T10:30:00.000Z
📄 Logs Count: 0

🔍 Additional Analysis:
==============================
🔄 Contract Interaction: Yes
🏢 Contract Address: 0x9Fbd...
⚡ Gas Efficiency: 100.00%
💵 Estimated Fee (USD): $0.03 (at $300/BNB)
```

## 🔧 Configuration

### Transaction Details
- **TRANSACTION_ID**: Update this constant with your target transaction hash
- **RPC Connection**: Uses Alchemy WebSocket endpoint
- **Analysis Features**:
  - Gas efficiency calculation
  - USD cost estimation (requires manual BNB price update)
  - Contract interaction detection
  - Transaction status validation

## 🧪 Development Usage

These experimental scripts help with:
- Testing individual components
- Analyzing blockchain data
- Debugging transaction flows
- Understanding event structures

## 📝 Notes

- Experimental scripts may use different configurations than production code
- Some scripts may require active blockchain connections
- Results are for development/testing purposes only