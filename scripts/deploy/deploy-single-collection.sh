#!/bin/bash

# Deploy CW721 Single Collection Marketplace Contract to XION
# This script deploys a marketplace for a specific NFT collection

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
    echo "Please create a .env file with required variables"
    exit 1
fi

# Check for required NFT collection address
if [ -z "$1" ]; then
    echo -e "${RED}Error: NFT collection address required${NC}"
    echo "Usage: $0 <nft_collection_address>"
    exit 1
fi

NFT_COLLECTION=$1

# Default values
RPC_URL=${XION_RPC_URL:-"https://rpc.xion-testnet-1.burnt.com:443"}
CHAIN_ID=${XION_CHAIN_ID:-"xion-testnet-1"}
WALLET=${WALLET_NAME:-"deployer"}
ADMIN=${ADMIN_ADDRESS:-$WALLET}
FEE_PERCENTAGE=${FEE_PERCENTAGE:-2}
DENOM="uxion"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deploying Single Collection Marketplace${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Network: $CHAIN_ID"
echo "NFT Collection: $NFT_COLLECTION"
echo "Admin: $ADMIN"
echo "Fee: $FEE_PERCENTAGE%"
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

if [ ! -f "artifacts/cw721_marketplace_single_collection.wasm" ]; then
    echo -e "${RED}Error: Optimized WASM not found${NC}"
    exit 1
fi

echo -e "${GREEN}Contract optimized successfully!${NC}"

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
npx ts-node deploy/deploy-marketplace.ts single-collection "$NFT_COLLECTION"

exit 0

# Old code below (keeping for reference but won't execute)
if false; then
    TX_HASH=$(xiond tx wasm store artifacts/cw721_marketplace_single_collection.wasm \
        --from $WALLET \
        --chain-id $CHAIN_ID \
        --node $RPC_URL \
        --gas auto \
        --gas-adjustment 1.3 \
        --fees 50000$DENOM \
        --broadcast-mode block \
        --output json \
        -y | jq -r '.txhash')
    
    CODE_ID=$(xiond query tx $TX_HASH --node $RPC_URL --output json | \
        jq -r '.logs[0].events[] | select(.type=="store_code") | .attributes[] | select(.key=="code_id") | .value')
else
    echo -e "${RED}xiond not found. Please install or use TypeScript deployment.${NC}"
    exit 1
fi

echo -e "${GREEN}Contract stored with Code ID: $CODE_ID${NC}"

# Step 3: Instantiate the contract
echo -e "${YELLOW}Step 3: Instantiating contract...${NC}"

INIT_MSG=$(cat <<EOF
{
  "admin": "$ADMIN",
  "denom": "$DENOM",
  "cw721": "$NFT_COLLECTION",
  "fee_percentage": $FEE_PERCENTAGE
}
EOF
)

echo "Instantiation message:"
echo "$INIT_MSG" | jq '.'

CONTRACT_ADDRESS=$(xiond tx wasm instantiate $CODE_ID "$INIT_MSG" \
    --from $WALLET \
    --label "Single Collection Marketplace - $NFT_COLLECTION" \
    --chain-id $CHAIN_ID \
    --node $RPC_URL \
    --gas auto \
    --gas-adjustment 1.3 \
    --fees 50000$DENOM \
    --broadcast-mode block \
    --output json \
    -y | jq -r '.logs[0].events[] | select(.type=="instantiate") | .attributes[] | select(.key=="_contract_address") | .value')

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment Successful!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Contract Address: $CONTRACT_ADDRESS"
echo "Code ID: $CODE_ID"
echo "NFT Collection: $NFT_COLLECTION"

# Save deployment info
DEPLOYMENT_FILE="../deployments/single-collection-$(date +%Y%m%d-%H%M%S).json"
mkdir -p ../deployments

cat <<EOF > $DEPLOYMENT_FILE
{
  "network": "$CHAIN_ID",
  "contract_type": "cw721-marketplace-single-collection",
  "code_id": $CODE_ID,
  "contract_address": "$CONTRACT_ADDRESS",
  "nft_collection": "$NFT_COLLECTION",
  "admin": "$ADMIN",
  "denom": "$DENOM",
  "fee_percentage": $FEE_PERCENTAGE,
  "deployed_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

echo "Deployment info saved to: $DEPLOYMENT_FILE"
fi # end of old code block