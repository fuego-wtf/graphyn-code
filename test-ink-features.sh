#!/bin/bash

# Graphyn Ink Version Test Script
# This script helps test all features of the new Ink-based CLI

set -e

echo "🧪 Testing Graphyn Ink Features"
echo "=============================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to run test
run_test() {
    local test_name="$1"
    local command="$2"
    
    echo -e "${YELLOW}📍 Testing: $test_name${NC}"
    echo "Command: $command"
    echo "---"
    
    # Run command and capture exit code
    if eval "$command"; then
        echo -e "${GREEN}✓ PASSED${NC}"
    else
        echo -e "${RED}✗ FAILED${NC}"
    fi
    
    echo ""
    sleep 1
}

# Build the project first
echo -e "${YELLOW}🔨 Building project...${NC}"
npm run build
echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# Test 1: Version check
run_test "Version Check" "node dist/ink/cli.js --version"

# Test 2: Help command
run_test "Help Command" "node dist/ink/cli.js --help"

# Test 3: Interactive mode (with timeout)
echo -e "${YELLOW}📍 Testing: Interactive Mode${NC}"
echo "Command: node dist/ink/cli.js"
echo "---"
echo "Manual test required - Launch with 'graphyn' and test:"
echo "  - Arrow key navigation"
echo "  - Menu selection"
echo "  - ESC to go back"
echo "  - Ctrl+C to exit"
echo ""

# Test 4: Direct agent commands
echo -e "${YELLOW}📝 Direct Agent Commands:${NC}"
echo ""

echo "Backend agent:"
echo "  graphyn backend \"add user authentication\""
echo ""

echo "Frontend agent:"
echo "  graphyn frontend \"create responsive navbar\""
echo ""

echo "Architect agent:"
echo "  graphyn architect \"design microservices\""
echo ""

echo "Design agent:"
echo "  graphyn design \"https://figma.com/file/test\""
echo ""

echo "CLI agent:"
echo "  graphyn cli \"add progress bar\""
echo ""

# Test 5: Thread management
echo -e "${YELLOW}📝 Thread Management:${NC}"
echo "  graphyn threads"
echo "  - Test create, view, delete threads"
echo "  - Test participant management"
echo ""

# Test 6: Authentication
echo -e "${YELLOW}📝 Authentication:${NC}"
echo "  graphyn whoami     # Check status"
echo "  graphyn auth       # Interactive OAuth"
echo "  graphyn logout     # Remove auth"
echo ""

# Test 7: Other commands
echo -e "${YELLOW}📝 Other Commands:${NC}"
echo "  graphyn doctor     # System diagnostics"
echo "  graphyn status     # Project status"
echo "  graphyn history    # View history"
echo "  graphyn monitor    # System monitor"
echo ""

# Test 8: Error handling
echo -e "${YELLOW}📝 Error Handling:${NC}"
echo "  graphyn invalid    # Should show error"
echo "  graphyn backend    # Missing query error"
echo ""

# Test 9: Package simulation
echo -e "${YELLOW}📦 Package Test:${NC}"
echo "Run: npm run test:package"
echo "This tests the full npm install experience"
echo ""

# Test 10: Unit tests
echo -e "${YELLOW}🧪 Unit Tests:${NC}"
echo "Run: npm test"
echo "This runs the Vitest test suite"
echo ""

echo -e "${GREEN}🎉 Test script complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Run 'npm link' to test globally"
echo "2. Test each command manually"
echo "3. Check error recovery with network off"
echo "4. Verify OAuth flows"
echo "5. Test on different terminals"
echo ""
echo "Happy testing! 🚀"