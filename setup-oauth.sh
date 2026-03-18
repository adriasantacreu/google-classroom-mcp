#!/bin/bash
# Google Classroom OAuth Setup Script
# This will guide you through getting OAuth credentials

set -e

echo "📋 Google Classroom OAuth Credentials Setup"
echo "============================================"
echo ""

# Step 1: Authenticate with gcloud
echo "Step 1: Authenticate with gcloud"
echo "---------------------------------"
echo "Opening browser for authentication..."
gcloud auth login

echo ""
echo "✅ Authenticated!"
echo ""

# Step 2: List and select project
echo "Step 2: Select or create GCP project"
echo "-------------------------------------"
echo ""
echo "Your available projects:"
gcloud projects list --format="table(projectId,name)"
echo ""

read -p "Enter project ID to use (or press Enter to use current: $(gcloud config get-value project 2>/dev/null)): " PROJECT_ID

if [ -z "$PROJECT_ID" ]; then
  PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
fi

echo ""
echo "Using project: $PROJECT_ID"
gcloud config set project $PROJECT_ID

echo ""
echo "✅ Project set!"
echo ""

# Step 3: Enable Classroom API
echo "Step 3: Enable Google Classroom API"
echo "------------------------------------"
echo "Enabling classroom.googleapis.com..."
gcloud services enable classroom.googleapis.com

echo ""
echo "✅ Classroom API enabled!"
echo ""

# Step 4: Create OAuth consent screen (if needed)
echo "Step 4: OAuth Consent Screen"
echo "----------------------------"
echo ""
echo "⚠️  You need to configure the OAuth consent screen in the Cloud Console."
echo ""
echo "Opening: https://console.cloud.google.com/apis/credentials/consent?project=$PROJECT_ID"
echo ""
echo "In the browser:"
echo "  1. Choose 'Internal' if using Google Workspace, or 'External' for personal accounts"
echo "  2. Fill in:"
echo "     - App name: classroom-mcp"
echo "     - User support email: [your email]"
echo "     - Developer contact: [your email]"
echo "  3. Click 'Save and Continue'"
echo "  4. On 'Scopes' page, click 'Save and Continue'"
echo "  5. On 'Test users' page (External only), add your email, click 'Save and Continue'"
echo "  6. Click 'Back to Dashboard'"
echo ""
read -p "Press Enter after completing OAuth consent screen setup..."

echo ""
echo "✅ OAuth consent screen configured!"
echo ""

# Step 5: Create OAuth credentials
echo "Step 5: Create OAuth Client ID"
echo "-------------------------------"
echo ""
echo "Opening credentials page..."
echo "https://console.cloud.google.com/apis/credentials?project=$PROJECT_ID"
echo ""
echo "In the browser:"
echo "  1. Click 'Create Credentials' → 'OAuth client ID'"
echo "  2. Application type: Desktop app"
echo "  3. Name: classroom-mcp"
echo "  4. Click 'Create'"
echo "  5. Click 'Download JSON'"
echo "  6. Save the file as: ~/GitHub/classroom-mcp/credentials.json"
echo ""
read -p "Press Enter after downloading credentials.json..."

# Check if credentials.json exists
CREDS_PATH="$HOME/GitHub/classroom-mcp/credentials.json"
if [ ! -f "$CREDS_PATH" ]; then
  echo ""
  echo "⚠️  Warning: credentials.json not found at $CREDS_PATH"
  echo "Please make sure you saved the file to the correct location."
  echo ""
  read -p "Press Enter to continue anyway, or Ctrl+C to exit..."
else
  echo ""
  echo "✅ credentials.json found!"
fi

echo ""
echo "Step 6: Generate token"
echo "----------------------"
echo "Running authentication script..."
cd ~/GitHub/classroom-mcp
node auth.js

echo ""
echo "============================================"
echo "✅ Setup Complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Quit and reopen Cursor"
echo "  2. Test by asking: 'List my Google Classroom courses'"
echo ""
echo "Documentation:"
echo "  ~/GitHub/classroom-mcp/QUICKSTART.md"
echo ""
