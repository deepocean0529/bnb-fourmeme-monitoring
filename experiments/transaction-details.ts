import { getRPCProvider, getTransactionDetails } from '../src/rpc/index.js';
import { initializeRPC } from '../src/rpc/index.js';
import { ALCHEMY_WS_URL } from '../config/config.js';

// Transaction ID to analyze (replace with actual transaction hash)
const TRANSACTION_ID = '0xb36286622aa22716757b14c399c595c595931944852d163982f29bf3ae136c3f';

async function analyzeTransaction() {
  console.log('🔍 Analyzing Transaction Details...');
  console.log('📋 Transaction ID:', TRANSACTION_ID);
  console.log('---');

  try {
    // Initialize RPC connection
    console.log('🔗 Initializing RPC connection...');
    await initializeRPC(ALCHEMY_WS_URL);
    console.log('✅ RPC connection established');

    const provider = getRPCProvider().getProvider();

    // Get transaction details
    console.log('📊 Fetching transaction details...');
    const txDetails = await getTransactionDetails(provider, TRANSACTION_ID);

    if (!txDetails) {
      console.log('❌ Transaction not found or failed to fetch details');
      return;
    }

    // Display transaction information
    console.log('\n📄 Transaction Details:');
    console.log('='.repeat(50));
    console.log(`🔗 Hash: ${txDetails.hash}`);
    console.log(`📍 Block: ${txDetails.blockNumber}`);
    console.log(`🏗️  Block Hash: ${txDetails.blockHash}`);
    console.log(`👤 From: ${txDetails.from}`);
    console.log(`🏠 To: ${txDetails.to}`);
    console.log(`💰 Value: ${txDetails.value} BNB`);
    console.log(`⚙️  Gas Limit: ${txDetails.gasLimit}`);
    console.log(`💨 Gas Price: ${txDetails.gasPrice} wei`);
    console.log(`🔥 Gas Used: ${txDetails.gasUsed}`);
    console.log(`💸 Transaction Fee: ${txDetails.transactionFee} BNB`);
    console.log(`📊 Status: ${txDetails.status}`);
    console.log(`🕒 Timestamp: ${txDetails.timestamp}`);
    console.log(`📄 Logs Count: ${txDetails.logs}`);

    // Additional analysis
    console.log('\n🔍 Additional Analysis:');
    console.log('='.repeat(30));

    // Check if it's a contract interaction
    if (txDetails.to && txDetails.to.toLowerCase() !== txDetails.from.toLowerCase()) {
      console.log('🔄 Contract Interaction: Yes');
      console.log(`🏢 Contract Address: ${txDetails.to}`);
    } else {
      console.log('🔄 Contract Interaction: No (likely contract deployment or self-transfer)');
    }

    // Calculate gas efficiency
    if (txDetails.gasUsed && txDetails.gasLimit) {
      const gasEfficiency = ((parseInt(txDetails.gasUsed) / parseInt(txDetails.gasLimit)) * 100).toFixed(2);
      console.log(`⚡ Gas Efficiency: ${gasEfficiency}%`);
    }

    // Estimate transaction cost in USD (rough estimate)
    if (txDetails.transactionFee) {
      const feeBNB = parseFloat(txDetails.transactionFee);
      // Rough BNB to USD conversion (this would need to be updated with real price)
      const bnbPriceUSD = 300; // Example price
      const feeUSD = (feeBNB * bnbPriceUSD).toFixed(2);
      console.log(`💵 Estimated Fee (USD): $${feeUSD} (at $${bnbPriceUSD}/BNB)`);
    }

    console.log('\n✅ Transaction analysis complete!');

  } catch (error) {
    console.error('❌ Error analyzing transaction:', (error as Error).message);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down transaction analyzer...');
  process.exit(0);
});

// Run the analysis
analyzeTransaction().catch(console.error);