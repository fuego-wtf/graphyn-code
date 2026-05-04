#!/bin/bash

# Enhanced test for package installation
# Comprehensive validation to prevent installation issues

set -e

echo "🧪 Testing package installation (Enhanced)..."

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

# 0. Run package validation
echo "🔍 Validating package structure..."
if node scripts/validate-package.cjs; then
    echo -e "${GREEN}✅ Package validation passed${NC}"
else
    echo -e "${RED}❌ Package validation failed${NC}"
    exit 1
fi

# Skip build - should already be built before running this test

# 2. Create a test package
echo "📦 Creating test package..."
bun pm pack

# Get the package filename
PACKAGE_FILE=$(ls -t *.tgz | head -1)
PACKAGE_PATH="$PROJECT_ROOT/$PACKAGE_FILE"

# 3. Create isolated test environment
TEST_DIR="/tmp/graphyn-test-$$"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

echo "🔧 Testing in isolated environment: $TEST_DIR"

# 4. Initialize fresh Bun project
bun init -y >/dev/null

# 5. Test installation with various scenarios
echo "📥 Testing package installation..."

# Test 5a: Normal installation
echo -e "${BLUE}  → Testing normal install...${NC}"
if bun add "$PACKAGE_PATH"; then
    echo -e "${GREEN}    ✅ Normal install passed${NC}"
else
    echo -e "${RED}    ❌ Normal install failed${NC}"
    ((ERRORS++))
fi

# Test 5b: Installation with CI flag (should skip postinstall)
echo -e "${BLUE}  → Testing CI install...${NC}"
rm -rf node_modules bun.lock
CI=true bun add "$PACKAGE_PATH"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}    ✅ CI install passed${NC}"
else
    echo -e "${RED}    ❌ CI install failed${NC}"
    ((ERRORS++))
fi

# Test 5c: Installation with minimal flag
echo -e "${BLUE}  → Testing minimal install...${NC}"
rm -rf node_modules bun.lock
GRAPHYN_MINIMAL_INSTALL=true bun add "$PACKAGE_PATH"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}    ✅ Minimal install passed${NC}"
else
    echo -e "${RED}    ❌ Minimal install failed${NC}"
    ((ERRORS++))
fi

# 6. Test that graphyn command exists
echo "🔍 Checking graphyn command..."
if ./node_modules/.bin/graphyn --version; then
    echo -e "${GREEN}✅ CLI command works${NC}"
else
    echo -e "${RED}❌ CLI command not found${NC}"
    ((ERRORS++))
fi

# 7. Test CLI commands
echo "🚀 Testing CLI commands..."

# Test help
if ./node_modules/.bin/graphyn --help > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Help command works${NC}"
else
    echo -e "${RED}❌ Help command failed${NC}"
    ((ERRORS++))
fi

# Init command removed in v0.1.60 - CLI is now zero-config

# Test design command availability
if ./node_modules/.bin/graphyn --help | grep -q "graphyn design"; then
    echo -e "${GREEN}✅ Design command documented${NC}"
else
    echo -e "${RED}❌ Design command not found in help${NC}"
    ((ERRORS++))
fi

# 8. Check postinstall ran (in normal install)
echo "📋 Checking postinstall execution..."
if [ -d "$HOME/.graphyn" ]; then
    echo -e "${GREEN}✅ Postinstall created .graphyn directory${NC}"
else
    echo -e "${YELLOW}⚠️  .graphyn directory not found (may already exist)${NC}"
fi

# 9. Test package size
echo "📏 Checking package size..."
if [ -f "$PACKAGE_PATH" ]; then
    PACKAGE_SIZE=$(stat -f%z "$PACKAGE_PATH" 2>/dev/null || stat -c%s "$PACKAGE_PATH" 2>/dev/null || echo "0")
    PACKAGE_SIZE_MB=$(echo "scale=2; $PACKAGE_SIZE / 1024 / 1024" | bc 2>/dev/null || echo "0")
    
    echo -e "${GREEN}✅ Package size: ${PACKAGE_SIZE_MB}MB${NC}"
    
    # Warn if package is too large
    if [ "$PACKAGE_SIZE" -gt 10485760 ]; then  # 10MB
        echo -e "${YELLOW}⚠️  Package larger than 10MB - consider optimizing${NC}"
    fi
fi

# 10. Test package integrity
echo "🔐 Testing package integrity..."

# Check if all required files are accessible
REQUIRED_COMMANDS=(
    "./node_modules/.bin/graphyn --version"
    "./node_modules/.bin/graphyn --help"
)

for cmd in "${REQUIRED_COMMANDS[@]}"; do
    if $cmd > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Command works: $cmd${NC}"
    else
        echo -e "${RED}❌ Command failed: $cmd${NC}"
        ((ERRORS++))
    fi
done

# Cleanup
cd "$PROJECT_ROOT"
rm -rf "$TEST_DIR"
rm -f "$PACKAGE_FILE"

# Final report
echo ""
echo "═══════════════════════════════════"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✨ All tests passed!${NC}"
    echo ""
    echo "Package is ready for publishing:"
    echo "  bun publish"
    echo ""
    echo "Or test locally with:"
    echo "  bun link"
    echo "  graphyn init"
    exit 0
else
    echo -e "${RED}❌ Found $ERRORS error(s)${NC}"
    echo ""
    echo "Please fix the errors before publishing."
    echo "Run individual tests with:"
    echo "  node scripts/validate-package.js"
    echo "  bun run build"
    echo "  bun pm pack --dry-run"
    exit 1
fi
