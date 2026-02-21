#!/bin/bash

# Firebase Hosting Deployment Script
# This script builds the app and deploys it to Firebase Hosting

set -e

echo "🚀 Starting Firebase deployment..."
echo ""

# Check if firebase-tools is installed
if ! command -v firebase &> /dev/null; then
  echo "❌ Firebase CLI not found. Install with: npm install -g firebase-tools"
  exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "firebase.json" ]; then
  echo "❌ Must run from project root (where package.json and firebase.json are located)"
  exit 1
fi

# Build the app
echo "📦 Building app..."
npm run build
if [ ! -d "dist" ]; then
  echo "❌ Build failed. dist/ directory not created."
  exit 1
fi
echo "✅ Build successful!"
echo ""

# Deploy to Firebase
echo "📤 Deploying to Firebase Hosting..."
firebase deploy --only hosting

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📍 Your app is now live at:"
firebase hosting:channel:list 2>/dev/null | grep -E "^\s*live" || echo "https://global-travel-hub-9feaf.web.app"
