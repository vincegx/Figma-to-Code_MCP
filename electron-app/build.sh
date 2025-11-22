#!/bin/bash

# Build script for Electron app
# Builds production-ready installers for current platform

echo "🏗️  Building MCP Figma to Code (Desktop)"
echo ""

# Set environment variables
export ELECTRON_MODE=true
export NODE_ENV=production

# Add Python to PATH (required for electron-builder DMG creation on macOS)
export PATH="/opt/homebrew/opt/python@3.14/libexec/bin:$PATH"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo ""
echo "🔨 Building application..."
echo "   1. Vite production bundle (with ELECTRON=true)"
echo "   2. Electron packaging"
echo ""

npm run build

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Build completed successfully!"
  echo ""
  echo "📂 Output directory: dist-electron/"
  ls -lh dist-electron/
else
  echo "❌ Build failed"
  exit 1
fi
