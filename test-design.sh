#!/bin/bash

echo "Testing Graphyn Design Command"
echo "=============================="
echo ""

# Test help
echo "1. Testing help output:"
npm run dev -- design --help
echo ""

# Test setup command
echo "2. Testing setup command help:"
npm run dev -- design setup --help
echo ""

# Test with a dummy URL (will fail but shows flow)
echo "3. Testing with dummy Figma URL:"
echo "   (This will fail without a valid token, which is expected)"
npm run dev -- design "https://www.figma.com/proto/ABC123/Test-Design?node-id=1%3A2" --no-launch
echo ""

echo "Test complete!"