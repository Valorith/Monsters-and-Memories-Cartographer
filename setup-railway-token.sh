#!/bin/bash

# Railway Token Setup Script
# 
# To use this script:
# 1. Go to your Railway project dashboard
# 2. Click on Settings
# 3. Generate a project token
# 4. Run: source ./setup-railway-token.sh
# 5. Enter your token when prompted

echo "Railway Project Token Setup"
echo "=========================="
echo ""
echo "To get your project token:"
echo "1. Go to https://railway.app/dashboard"
echo "2. Select your project"
echo "3. Go to Settings > General"
echo "4. Click 'Generate Token' under Project Tokens"
echo ""
read -p "Enter your Railway project token: " RAILWAY_TOKEN

if [ -z "$RAILWAY_TOKEN" ]; then
    echo "Error: No token provided"
    exit 1
fi

# Export for current session
export RAILWAY_TOKEN=$RAILWAY_TOKEN

# Add to bashrc for persistence
echo "" >> ~/.bashrc
echo "# Railway Project Token" >> ~/.bashrc
echo "export RAILWAY_TOKEN='$RAILWAY_TOKEN'" >> ~/.bashrc

echo ""
echo "✅ Token set successfully!"
echo "You can now use Railway CLI commands in this project."
echo ""
echo "To test, run: railway run node test-db.js"