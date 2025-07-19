#!/bin/bash

# Test npm package installation in isolation
# This prevents issues like the postinstall dependency bug

set -e

echo "🧪 Testing npm package installation..."

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Track errors
ERRORS=0

# Get the project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# 1. Build the project
echo "📦 Building project..."
npm run build

# 2. Create a test package
echo "📦 Creating test package..."
npm pack

# Get the package filename
PACKAGE_FILE=$(ls -t *.tgz | head -1)
PACKAGE_PATH="$PROJECT_ROOT/$PACKAGE_FILE"

# 3. Create isolated test environment
TEST_DIR="/tmp/graphyn-test-$$"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

echo "🔧 Testing in isolated environment: $TEST_DIR"

# 4. Initialize fresh npm project
npm init -y --silent

# 5. Test installation
echo "📥 Installing package..."
if npm install "$PACKAGE_PATH" --loglevel=error; then
    echo -e "${GREEN}✅ Package installed successfully${NC}"
else
    echo -e "${RED}❌ Package installation failed${NC}"
    exit 1
fi

# 6. Test that graphyn command exists
echo "🔍 Checking graphyn command..."
if npx graphyn --version; then
    echo -e "${GREEN}✅ CLI command works${NC}"
else
    echo -e "${RED}❌ CLI command not found${NC}"
    exit 1
fi

# 7. Test basic functionality
echo "🚀 Testing basic commands..."
if npx graphyn --help > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Help command works${NC}"
else
    echo -e "${RED}❌ Help command failed${NC}"
    exit 1
fi

# 8. Check postinstall ran
echo "📋 Checking postinstall execution..."
if [ -d "$HOME/.graphyn" ]; then
    echo -e "${GREEN}✅ Postinstall created .graphyn directory${NC}"
else
    echo -e "${YELLOW}⚠️  .graphyn directory not found (may already exist)${NC}"
fi

# Cleanup
cd "$PROJECT_ROOT"
rm -rf "$TEST_DIR"
rm -f "$PACKAGE_FILE"

echo -e "${GREEN}✨ All tests passed!${NC}"
echo ""
echo "Ready to publish with: npm publish"