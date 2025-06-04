#!/bin/bash
# Test script to debug the architect issue

echo "Testing Graphyn contexts..."
echo

echo "1. Testing backend:"
graphyn --backend "test backend query" 2>&1 | grep -E "(Backend Developer Agent|Query:|ERROR|not found)" | head -5
echo

echo "2. Testing frontend:"
graphyn --frontend "test frontend query" 2>&1 | grep -E "(Frontend Developer Agent|Query:|ERROR|not found)" | head -5
echo

echo "3. Testing architect:"
graphyn --architect "test architect query" 2>&1 | grep -E "(Software Architect Agent|Query:|ERROR|not found)" | head -5
echo

echo "4. Current context:"
graphyn --context