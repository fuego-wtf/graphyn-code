#!/bin/bash
# Compare how each agent works

echo "=== BACKEND AGENT ==="
timeout 2 fuego --backend "test query" 2>&1 | head -10
echo

echo "=== FRONTEND AGENT ==="
timeout 2 fuego --frontend "test query" 2>&1 | head -10
echo

echo "=== ARCHITECT AGENT ==="
timeout 2 fuego --architect "test query" 2>&1 | head -10