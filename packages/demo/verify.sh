#!/bin/bash

# Verification script for RFetch demo
set -e

echo "🧪 RFetch Integration Verification"
echo "=================================="
echo ""

# Kill any existing server on port 3000
echo "🧹 Cleaning up port 3000..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 1

# Start the server in background
echo "🚀 Starting server..."
bun run server.ts > /tmp/rfetch-server.log 2>&1 &
SERVER_PID=$!
sleep 3

# Check if server is running
if ! curl -s http://localhost:3000/openapi.json > /dev/null; then
    echo "❌ Server failed to start"
    cat /tmp/rfetch-server.log
    exit 1
fi

echo "✅ Server started successfully"
echo ""

# Run client tests
echo "📝 Running client integration tests..."
bun run client-test.ts
echo ""

# Verify OpenAPI spec
echo "📄 Verifying OpenAPI spec..."
SPEC=$(curl -s http://localhost:3000/openapi.json)
if echo "$SPEC" | grep -q '"openapi":"3.1.0"'; then
    echo "✅ OpenAPI spec is valid"
else
    echo "❌ OpenAPI spec is invalid"
    exit 1
fi
echo ""

# Verify docs endpoint
echo "📚 Verifying docs endpoint..."
DOCS=$(curl -s http://localhost:3000/docs)
if echo "$DOCS" | grep -q "Users API Documentation"; then
    echo "✅ Docs endpoint is working"
else
    echo "❌ Docs endpoint failed"
    exit 1
fi
echo ""

# Cleanup
echo "🧹 Cleaning up..."
kill $SERVER_PID 2>/dev/null || true
sleep 1

echo ""
echo "✨ All verifications passed!"
echo ""
echo "To run E2E tests with Playwright:"
echo "  bun run test:e2e"
echo ""
echo "Note: Playwright tests will start their own server."

