import { Hydration } from '../../src/connectors/hydration/hydration';

async function simpleTest() {
  try {
    console.log('🔍 Simple Pool Info Test');
    console.log('========================\n');
    
    const poolAddress = '7L53bUTBbfuj14UpdCNPwmgzzHSsrsTWBHX5pys32mVWM3C1';
    console.log(`Pool Address: ${poolAddress}\n`);
    
    // Initialize Hydration
    console.log('1️⃣ Initializing Hydration...');
    const hydration = await Hydration.getInstance('mainnet');
    console.log('✅ Hydration ready\n');
    
    // Get basic pool info
    console.log('2️⃣ Getting pool info...');
    const poolInfo = await hydration.getPoolInfo(poolAddress);
    
    if (poolInfo) {
      console.log('✅ Pool found!');
      console.log(`   Type: ${poolInfo.poolType}`);
      console.log(`   Base Token: ${poolInfo.baseTokenAddress}`);
      console.log(`   Quote Token: ${poolInfo.quoteTokenAddress}`);
      console.log(`   Tokens: ${poolInfo.tokens?.join(', ') || 'N/A'}`);
      console.log(`   Fee: ${poolInfo.feePct * 100}%`);
    } else {
      console.log('❌ Pool not found');
      return;
    }
    
    // Test the specific pairs that are failing
    console.log('\n3️⃣ Testing problematic pairs...');
    
    const testPairs = [
      ['DOT', 'ASTR'],
      ['ASTR', 'DOT'],
      ['HDX', 'DOT'],
      ['DOT', 'HDX']
    ];
    
    for (const [base, quote] of testPairs) {
      console.log(`\n   Testing pair: ${base}-${quote}`);
      
      try {
        // Try to get position info with this pair
        const positionInfo = await hydration.getPositionInfo(
          '5HKTQCEWuuA9bJEqFbAEsbwFQfEe5tXrbZXWj7yQpuxVSHKt', // wallet
          poolAddress, // pool address
          base, // base token
          quote  // quote token
        );
        
        if (positionInfo) {
          console.log(`   ✅ SUCCESS: Position found for ${base}-${quote}`);
          console.log(`      LP Amount: ${positionInfo.lpTokenAmount}`);
        } else {
          console.log(`   ℹ️  No position found for ${base}-${quote}`);
        }
        
      } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
      }
    }
    
    console.log('\n🏁 Test completed!');
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Run the test
simpleTest();
