#!/usr/bin/env bash
#
# Validation test suite for Graphyn Code CLI
# Run this to ensure all components are working correctly

set -euo pipefail

# Test configuration
readonly TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly ROOT_DIR="$(cd "${TEST_DIR}/.." && pwd)"
readonly GRAPHYN_CMD="${ROOT_DIR}/scripts/graphyn"

# Colors
readonly GREEN='\033[0;32m'
readonly RED='\033[0;31m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test functions
test_start() {
    echo -n "Testing $1... "
    ((TESTS_RUN++))
}

test_pass() {
    echo -e "${GREEN}✓ PASSED${NC}"
    ((TESTS_PASSED++))
}

test_fail() {
    echo -e "${RED}✗ FAILED${NC}"
    echo "  Error: $1"
    ((TESTS_FAILED++))
}

# Test: Check if graphyn script exists and is executable
test_executable() {
    test_start "graphyn executable"
    if [[ -x "$GRAPHYN_CMD" ]]; then
        test_pass
    else
        test_fail "graphyn script not found or not executable"
    fi
}

# Test: Check directory structure
test_directory_structure() {
    test_start "directory structure"
    local required_dirs=(
        "$ROOT_DIR/scripts"
        "$ROOT_DIR/prompts"
        "$ROOT_DIR/config"
        "$ROOT_DIR/templates"
        "$ROOT_DIR/docs"
    )
    
    local all_exist=true
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            all_exist=false
            break
        fi
    done
    
    if [[ "$all_exist" == true ]]; then
        test_pass
    else
        test_fail "Missing required directories"
    fi
}

# Test: Check prompt files
test_prompt_files() {
    test_start "prompt files"
    local required_prompts=(
        "$ROOT_DIR/prompts/backend.md"
        "$ROOT_DIR/prompts/frontend.md"
        "$ROOT_DIR/prompts/architect.md"
    )
    
    local all_exist=true
    for file in "${required_prompts[@]}"; do
        if [[ ! -f "$file" ]]; then
            all_exist=false
            break
        fi
    done
    
    if [[ "$all_exist" == true ]]; then
        test_pass
    else
        test_fail "Missing prompt files"
    fi
}

# Test: Check help command
test_help_command() {
    test_start "help command"
    if "$GRAPHYN_CMD" --help &>/dev/null; then
        test_pass
    else
        test_fail "Help command failed"
    fi
}

# Test: Check version command
test_version_command() {
    test_start "version command"
    if "$GRAPHYN_CMD" --version | grep -q "2.0.0"; then
        test_pass
    else
        test_fail "Version command failed or incorrect version"
    fi
}

# Test: Check list command
test_list_command() {
    test_start "list command"
    local output=$("$GRAPHYN_CMD" --list 2>&1)
    if echo "$output" | grep -q "backend" && echo "$output" | grep -q "frontend" && echo "$output" | grep -q "architect"; then
        test_pass
    else
        test_fail "List command doesn't show all contexts"
    fi
}

# Test: Check authentication flow (without real API key)
test_auth_check() {
    test_start "authentication check"
    local output=$("$GRAPHYN_CMD" whoami 2>&1 || true)
    if echo "$output" | grep -q "Not authenticated"; then
        test_pass
    else
        test_fail "Authentication check failed"
    fi
}

# Test: Check context detection simulation
test_context_detection() {
    test_start "context detection"
    # This would need to be in a backend directory to work
    # For now, just check if the command runs
    if "$GRAPHYN_CMD" --context &>/dev/null; then
        test_pass
    else
        test_fail "Context detection command failed"
    fi
}

# Test: Check installation script
test_install_script() {
    test_start "installation script"
    if [[ -x "$ROOT_DIR/scripts/install.sh" ]]; then
        test_pass
    else
        test_fail "Installation script not found or not executable"
    fi
}

# Test: Check template file
test_template_file() {
    test_start "agent template"
    if [[ -f "$ROOT_DIR/templates/agent-template.md" ]]; then
        test_pass
    else
        test_fail "Agent template file not found"
    fi
}

# Test: Syntax check all bash scripts
test_bash_syntax() {
    test_start "bash syntax"
    local has_errors=false
    
    for script in "$ROOT_DIR/scripts"/*.sh "$GRAPHYN_CMD"; do
        if [[ -f "$script" ]]; then
            if ! bash -n "$script" 2>/dev/null; then
                has_errors=true
                break
            fi
        fi
    done
    
    if [[ "$has_errors" == false ]]; then
        test_pass
    else
        test_fail "Bash syntax errors found"
    fi
}

# Test: Check for required dependencies in main script
test_dependencies() {
    test_start "dependency checks"
    if grep -q "check_dependencies" "$GRAPHYN_CMD"; then
        test_pass
    else
        test_fail "No dependency checking found in main script"
    fi
}

# Main test execution
main() {
    echo "╔══════════════════════════════════════╗"
    echo "║     Graphyn Code CLI Test Suite      ║"
    echo "╚══════════════════════════════════════╝"
    echo
    
    # Run all tests
    test_executable
    test_directory_structure
    test_prompt_files
    test_help_command
    test_version_command
    test_list_command
    test_auth_check
    test_context_detection
    test_install_script
    test_template_file
    test_bash_syntax
    test_dependencies
    
    # Summary
    echo
    echo "══════════════════════════════════════"
    echo "Test Summary:"
    echo "  Total:  $TESTS_RUN"
    echo -e "  ${GREEN}Passed: $TESTS_PASSED${NC}"
    echo -e "  ${RED}Failed: $TESTS_FAILED${NC}"
    echo "══════════════════════════════════════"
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "\n${GREEN}All tests passed! ✨${NC}"
        exit 0
    else
        echo -e "\n${RED}Some tests failed. Please fix the issues above.${NC}"
        exit 1
    fi
}

# Run tests
main "$@"