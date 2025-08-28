import { Hydration } from '../../src/connectors/hydration/hydration';

async function testPoolInfo() {
  try {
    console.log('🚀 Testing Hydration Pool Info...\n');
    
    // Initialize Hydration for mainnet
    const hydration = await Hydration.getInstance('mainnet');
    console.log('✅ Hydration initialized successfully');
    
    // Test pool address
    const poolAddress = '7L53bUTBbfuj14UpdCNPwmgzzHSsrsTWBHX5pys32mVWM3C1';
    console.log(`🔍 Testing pool: ${poolAddress}\n`);
    
    // Get pool info
    console.log('📊 Getting pool info...');
    const poolInfo = await hydration.getPoolInfo(poolAddress);
    
    if (poolInfo) {
      console.log('✅ Pool found!');
      console.log('📋 Pool Details:');
      console.log(`   Address: ${poolInfo.address}`);
      console.log(`   ID: ${poolInfo.id}`);
      console.log(`   Type: ${poolInfo.poolType}`);
      console.log(`   Base Token: ${poolInfo.baseTokenAddress}`);
      console.log(`   Quote Token: ${poolInfo.quoteTokenAddress}`);
      console.log(`   Fee: ${poolInfo.feePct * 100}%`);
      console.log(`   Price: ${poolInfo.price}`);
      console.log(`   Base Amount: ${poolInfo.baseTokenAmount}`);
      console.log(`   Quote Amount: ${poolInfo.quoteTokenAmount}`);
      
      if (poolInfo.tokens && poolInfo.tokens.length > 0) {
        console.log(`   Tokens: ${poolInfo.tokens.join(', ')}`);
      }
    } else {
      console.log('❌ Pool not found');
    }
    
    // Get detailed pool info
    console.log('\n🔍 Getting detailed pool info...');
    const detailedPoolInfo = await hydration.getPoolDetails(poolAddress);
    
    if (detailedPoolInfo) {
      console.log('✅ Detailed pool info retrieved!');
      console.log('📋 Detailed Pool Details:');
      console.log(`   Address: ${detailedPoolInfo.address}`);
      console.log(`   Base Token: ${detailedPoolInfo.baseTokenAddress}`);
      console.log(`   Quote Token: ${detailedPoolInfo.quoteTokenAddress}`);
      console.log(`   Fee: ${detailedPoolInfo.feePct * 100}%`);
      console.log(`   Price: ${detailedPoolInfo.price}`);
      console.log(`   Pool Type: ${detailedPoolInfo.poolType}`);
      
      if (detailedPoolInfo.lpMint) {
        console.log(`   LP Mint Address: ${detailedPoolInfo.lpMint.address}`);
        console.log(`   LP Decimals: ${detailedPoolInfo.lpMint.decimals}`);
      }
      
      if (detailedPoolInfo.tokens && detailedPoolInfo.tokens.length > 0) {
        console.log(`   Tokens: ${detailedPoolInfo.tokens.join(', ')}`);
      }
    } else {
      console.log('❌ Detailed pool info not available');
    }
    
    // Test position info for a wallet (optional)
    console.log('\n👛 Testing position info...');
    const walletAddress = '5HKTQCEWuuA9bJEqFbAEsbwFQfEe5tXrbZXWj7yQpuxVSHKt';
    
    try {
      const positionInfo = await hydration.getPositionInfo(
        walletAddress,
        poolAddress,
        undefined, // baseToken
        undefined  // quoteToken
      );
      
      if (positionInfo) {
        console.log('✅ Position info retrieved!');
        console.log('📋 Position Details:');
        console.log(`   Pool Address: ${positionInfo.poolAddress}`);
        console.log(`   Wallet Address: ${positionInfo.walletAddress}`);
        console.log(`   LP Token Amount: ${positionInfo.lpTokenAmount}`);
        console.log(`   Base Token Amount: ${positionInfo.baseTokenAmount}`);
        console.log(`   Quote Token Amount: ${positionInfo.quoteTokenAmount}`);
        console.log(`   Price: ${positionInfo.price}`);
      } else {
        console.log('ℹ️  No position found for this wallet in this pool');
      }
    } catch (error) {
      console.log('⚠️  Error getting position info:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the test
testPoolInfo().then(() => {
  console.log('\n🏁 Test completed!');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});
