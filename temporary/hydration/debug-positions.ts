import { Hydration } from '../../src/connectors/hydration/hydration';

async function debugPositionsOwned() {
  try {
    console.log('🔍 Debugging getPositionsOwned method...');
    
    // Test parameters
    const network = 'mainnet';
    const walletAddress = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'; // Example Polkadot address
    const tokenId = '1'; // Example token ID
    
    console.log(`📋 Test Parameters:`);
    console.log(`  Network: ${network}`);
    console.log(`  Wallet Address: ${walletAddress}`);
    console.log(`  Token ID: ${tokenId}`);
    
    // Get Hydration instance
    console.log('\n🔄 Getting Hydration instance...');
    const hydration = await Hydration.getInstance(network);
    console.log('✅ Hydration instance obtained');
    
    // Test getPositionsOwned
    console.log('\n🔍 Calling getPositionsOwned...');
    const positions = await hydration.getPositionsOwned(walletAddress, tokenId);
    
    console.log('\n📊 Results:');
    console.log(`  Total positions found: ${positions.length}`);
    
    if (positions.length > 0) {
      positions.forEach((pos, index) => {
        console.log(`  Position ${index + 1}:`);
        console.log(`    ID: ${pos.positionId}`);
        console.log(`    Asset ID: ${pos.assetId}`);
        console.log(`    Owner: ${pos.owner}`);
        console.log(`    Shares: ${pos.shares}`);
        console.log(`    Amount: ${pos.amount}`);
        console.log(`    Price: ${pos.price}`);
      });
    } else {
      console.log('  ❌ No positions found');
      console.log('\n🔍 Possible reasons:');
      console.log('  1. Wallet address has no positions for this token');
      console.log('  2. Token ID is incorrect');
      console.log('  3. Network connection issues');
      console.log('  4. Address format conversion problems');
    }
    
  } catch (error) {
    console.error('❌ Error during debug:', error);
  }
}

// Run the debug function
debugPositionsOwned().catch(console.error);
