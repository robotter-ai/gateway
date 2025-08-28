#!/bin/bash

echo "🚀 Running Hydration Pool Info Test..."
echo "======================================"

# Check if we're in the right directory
if [ ! -f "../../src/connectors/hydration/hydration.ts" ]; then
    echo "❌ Error: Please run this script from the temporary/playground directory"
    echo "   Current directory: $(pwd)"
    echo "   Expected to find: ../../src/connectors/hydration/hydration.ts"
    exit 1
fi

# Check if ts-node is available
if ! command -v ts-node &> /dev/null; then
    echo "📦 Installing ts-node..."
    npm install -g ts-node typescript
fi

# Run the test
echo "🔧 Executing test..."
ts-node pool-info-test.ts

echo "✅ Test completed!"
