#!/bin/bash
# Compare how each agent works

echo "=== BACKEND AGENT ==="
timeout 2 graphyn --backend "test query" 2>&1 | head -10
echo

echo "=== FRONTEND AGENT ==="
timeout 2 graphyn --frontend "test query" 2>&1 | head -10
echo

echo "=== ARCHITECT AGENT ==="
timeout 2 graphyn --architect "test query" 2>&1 | head -10