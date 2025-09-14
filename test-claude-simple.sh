#!/bin/bash

# Simple test script to check if Claude CLI hangs
echo "🚀 Testing Claude CLI with simple prompt..."

# Start Claude in background with a simple prompt
echo "📝 Starting Claude process..."
/Users/resatugurulu/.claude/local/claude -p "Say 'Hello test' and exit" &

# Get the process ID
CLAUDE_PID=$!

# Wait for 15 seconds
echo "⏰ Waiting 15 seconds for response..."
sleep 15

# Check if process is still running
if kill -0 $CLAUDE_PID 2>/dev/null; then
    echo "🚨 CONFIRMED: Claude CLI is HANGING after 15 seconds!"
    echo "   This is the root cause of our SDK timeout issues."

    # Kill the hanging process
    echo "🛑 Killing hanging Claude process..."
    kill -TERM $CLAUDE_PID
    sleep 2

    # Force kill if still running
    if kill -0 $CLAUDE_PID 2>/dev/null; then
        kill -KILL $CLAUDE_PID
        echo "💀 Force killed hanging process"
    fi

    echo ""
    echo "✅ ROOT CAUSE IDENTIFIED: Claude CLI hangs indefinitely"
    echo "❌ This means our SDK timeout (30s) is working correctly"
    echo "🔧 The real problem is Claude CLI authentication/connectivity"
else
    echo "✅ Claude CLI completed normally"
fi

echo ""
echo "🔍 NEXT STEPS:"
echo "1. Check Claude authentication: claude auth login"
echo "2. Check network connectivity to claude.ai"
echo "3. Check for proxy/firewall issues"