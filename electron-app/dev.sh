#!/bin/bash

# Development script for Electron app
# Sets environment variables and starts Electron in dev mode

echo "🚀 Starting MCP Figma to Code (Desktop Mode)"
echo ""

# Set environment variables
export ELECTRON_MODE=true
export ELECTRON_START_URL=http://localhost:5173
export NODE_ENV=development

# Add Python to PATH (required for electron-builder on macOS)
export PATH="/opt/homebrew/opt/python@3.14/libexec/bin:$PATH"

# Check if Figma Desktop is running
if ! curl -s http://localhost:3845/mcp > /dev/null 2>&1; then
  echo "⚠️  Warning: Figma Desktop MCP server not detected on port 3845"
  echo "   Please ensure Figma Desktop is running for full functionality"
  echo ""
fi

# Start development server
echo "📦 Installing dependencies if needed..."
npm install

echo ""
echo "🔨 Starting Vite dev server + Electron..."
echo ""

npm run dev
