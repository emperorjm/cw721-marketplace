#!/bin/bash

# Deploy CW721 Open Marketplace Contract to XION
# This script deploys the open marketplace that supports any CW721 NFT

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env ]; then
    source .env
else
    echo -e "${RED}Error: .env file not found${NC}"
    echo "Please create a .env file with the following variables:"
    echo "  XION_RPC_URL"
    echo "  XION_CHAIN_ID"
    echo "  WALLET_NAME"
    echo "  ADMIN_ADDRESS"
    echo "  FEE_PERCENTAGE"
    exit 1
fi

# Default values
RPC_URL=${XION_RPC_URL:-"https://rpc.xion-testnet-1.burnt.com:443"}
CHAIN_ID=${XION_CHAIN_ID:-"xion-testnet-1"}
WALLET=${WALLET_NAME:-"deployer"}
ADMIN=${ADMIN_ADDRESS:-$WALLET}
FEE_PERCENTAGE=${FEE_PERCENTAGE:-2}  # 2% marketplace fee
DENOM="uxion"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deploying CW721 Open Marketplace${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Network: $CHAIN_ID"
echo "RPC URL: $RPC_URL"
echo "Admin: $ADMIN"
echo "Fee: $FEE_PERCENTAGE%"
echo "Denom: $DENOM"
echo ""

# Step 1: Build and optimize the contract
echo -e "${YELLOW}Step 1: Building and optimizing contract...${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running. Please start Docker and try again.${NC}"
    echo "On macOS: Open Docker Desktop application"
    echo "On Linux: Run 'sudo systemctl start docker'"
    exit 1
fi

# Navigate to project root for workspace build
cd ..

# Optimize the contract (this also builds it)
echo -e "${YELLOW}Building and optimizing WASM with Docker...${NC}"
docker run --rm -v "$(pwd)":/code \
  --mount type=volume,source="$(basename "$(pwd)")_cache",target=/code/target \
  --mount type=volume,source=registry_cache,target=/usr/local/cargo/registry \
  cosmwasm/rust-optimizer:0.16.0

# Check if the optimized wasm exists
if [ ! -f "artifacts/cw721_marketplace.wasm" ]; then
    echo -e "${RED}Error: Optimized WASM not found at artifacts/cw721_marketplace.wasm${NC}"
    exit 1
fi

echo -e "${GREEN}Contract optimized successfully!${NC}"
WASM_SIZE=$(du -h artifacts/cw721_marketplace.wasm | cut -f1)
echo "Optimized size: $WASM_SIZE"

# Step 2: Deploy contract using TypeScript
echo -e "${YELLOW}Step 2: Deploying contract to chain...${NC}"

# Change back to scripts directory for TypeScript deployment
cd scripts

# Check if npm dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing npm dependencies...${NC}"
    npm install
fi

# Run TypeScript deployment script
echo -e "${YELLOW}Running TypeScript deployment...${NC}"
npx ts-node deploy/deploy-marketplace.ts marketplace