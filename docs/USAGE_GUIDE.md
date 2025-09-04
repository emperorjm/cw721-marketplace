# CW721 Marketplace Usage Guide

Complete guide for deploying and using the CW721 Marketplace contracts on XION.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Deployment](#deployment)
5. [Creating Listings](#creating-listings)
6. [Buying NFTs](#buying-nfts)
7. [Querying Marketplace](#querying-marketplace)
8. [Admin Operations](#admin-operations)
9. [Crossmint Integration](#crossmint-integration)
10. [Troubleshooting](#troubleshooting)

## Quick Start

### Complete NFT Marketplace Setup

Get a marketplace running with NFTs in 10 minutes:

```bash
# 1. Clone and setup
git clone https://github.com/emperorjm/cw721-marketplace
cd cw721-marketplace/scripts
npm install
cp .env.example .env
# Edit .env with your mnemonic

# 2. Deploy marketplace contract
./deploy/deploy-marketplace.sh

# 3. Deploy NFT contract (requires CW721_CODE_ID in .env)
npm run deploy:nft -- --name "My Collection" --symbol "MYCOL"

# 4. Mint an NFT
npm run mint-nft -- --token-id "1" --token-uri "ipfs://metadata"

# 5. Create a listing (use one of these methods):
# Option A: Use the NFT address from .env automatically
npm run create-listing -- --token-id 1 --price 10

# Option B: Specify the NFT address directly  
npm run create-listing -- --nft xion1c9udax... --token-id 1 --price 10

# Option C: Use environment variable (Linux/Mac)
export NFT_CONTRACT_ADDRESS=xion1c9udax...
npm run create-listing -- --nft $NFT_CONTRACT_ADDRESS --token-id 1 --price 10

# 6. Purchase on behalf of someone else using the `FinishFor` function:
npm run buy-for-user -- \
  --id <listing_id> \
  --recipient <recipient_address>

# What happens:
1. **You (or Crossmint) pay** the listing price in XION
2. **The recipient receives** the NFT directly
3. **The seller gets** the payment (minus marketplace fees)
```

### Basic Setup (Without NFTs)

Get just the marketplace running in 5 minutes:

```bash
# 1. Clone the repository
git clone https://github.com/emperorjm/cw721-marketplace
cd cw721-marketplace

# 2. Install dependencies
cd scripts && npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your wallet mnemonic and settings

# 4. Deploy marketplace
./deploy/deploy-marketplace.sh

# 5. Create your first listing
npm run create-listing -- --nft <nft_address> --token-id 1 --price 10
```

## Installation

### Prerequisites

- **Rust** 1.70+ with `wasm32-unknown-unknown` target
- **Docker** for contract optimization
- **Node.js** 16+ and npm
- **XION Wallet** with testnet/mainnet funds

### Setup Steps

1. **Install Rust and Cargo**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown
```

2. **Install Docker**
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

3. **Install Node.js**
```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

4. **Clone and Setup Repository**
```bash
git clone https://github.com/your-repo/cw721-marketplace
cd cw721-marketplace
cd scripts && npm install
```

## Configuration

### Environment Variables

Create a `.env` file in the `scripts` directory:

```env
# Network Configuration
XION_RPC_URL=https://rpc.xion-testnet-1.burnt.com:443
XION_CHAIN_ID=xion-testnet-1

# Wallet (NEVER commit real mnemonics!)
MNEMONIC="your twelve word mnemonic phrase here"
WALLET_NAME=deployer

# Contract Addresses (filled after deployment)
MARKETPLACE_ADDRESS=xion1abc...
SINGLE_COLLECTION_ADDRESS=xion1def...
PERMISSIONED_ADDRESS=xion1ghi...
NFT_CONTRACT_ADDRESS=xion1jkl...

# Admin Settings
ADMIN_ADDRESS=xion1admin...
FEE_PERCENTAGE=2

# Gas Settings
DEFAULT_GAS_PRICE=0.025uxion
DEFAULT_GAS_LIMIT=500000
```

### Network Configurations

**Testnet:**
- RPC: `https://rpc.xion-testnet-2.burnt.com:443`
- Chain ID: `xion-testnet-1`
- Explorer: `https://explorer.xion-testnet-2.burnt.com`

**Mainnet:**
- RPC: `https://rpc.xion.burnt.com:443`
- Chain ID: `xion-mainnet-1`
- Explorer: `https://explorer.xion.burnt.com`

## Setting Up an NFT Contract

Before you can list NFTs on the marketplace, you need a CW721 NFT contract. Here's how to set one up:

### Option 1: Deploy Your Own NFT Contract

#### Step 1: Get a CW721 Code ID

First, you need a CW721 contract code on the chain. You have two options:

1. **Use an existing CW721-base code ID** (check chain explorer)
2. **Upload your own CW721 contract** (recommended for production)

To upload your own:
```bash
# Download or build a CW721 contract WASM
# For example, using cw721-base from CosmWasm
git clone https://github.com/CosmWasm/cw-nfts
cd cw-nfts/contracts/cw721-base
cargo build --release --target wasm32-unknown-unknown
docker run --rm -v "$(pwd)":/code \
  --mount type=volume,source="$(basename "$(pwd)")_cache",target=/code/target \
  --mount type=volume,source=registry_cache,target=/usr/local/cargo/registry \
  cosmwasm/rust-optimizer:0.16.0
```

#### Step 2: Deploy the NFT Contract

Add the code ID to your `.env` file:
```env
CW721_CODE_ID=<your_code_id>
```

Deploy the NFT contract:
```bash
npm run deploy:nft -- --name "My NFT Collection" --symbol "MNFT"
```

Options:
- `--name`: Collection name (default: "Test NFT Collection")
- `--symbol`: Collection symbol (default: "TNFT")
- `--minter`: Address that can mint (defaults to deployer)

This will:
- Deploy a new NFT contract
- Save the address to `NFT_CONTRACT_ADDRESS` in your `.env`
- Create a deployment record in `deployments/`

### Option 2: Use an Existing NFT Contract

If you already have a CW721 NFT contract deployed, simply add its address to your `.env`:

```env
NFT_CONTRACT_ADDRESS=xion1abc...
```

### Minting NFTs

Once you have an NFT contract, mint some NFTs:

```bash
npm run mint-nft -- --token-id "1" --token-uri "ipfs://QmXxx..."
```

Options:
- `--nft`: NFT contract address (uses `.env` if not provided)
- `--token-id`: Unique token ID (required)
- `--owner`: Owner address (defaults to minter)
- `--token-uri`: Metadata URI (optional)
- `--extension`: Additional metadata as JSON (optional)

Examples:
```bash
# Mint a basic NFT
npm run mint-nft -- --token-id "1"

# Mint with metadata
npm run mint-nft -- --token-id "2" --token-uri "https://example.com/metadata/2.json"

# Mint for someone else
npm run mint-nft -- --token-id "3" --owner "xion1recipient..."

# Mint with extension data
npm run mint-nft -- --token-id "4" --extension '{"rarity":"rare","level":5}'
```

### Verifying NFT Ownership

Before listing, verify you own the NFT:

```bash
# Query NFT owner (you'll need to implement this query)
# Or check in the blockchain explorer
```

## Deployment

### Deploy Open Marketplace

Accepts any CW721 NFT:

```bash
cd scripts
./deploy/deploy-marketplace.sh
```

### Deploy Single Collection Marketplace

For a specific NFT collection:

```bash
./deploy/deploy-single-collection.sh <nft_collection_address>
```

### Deploy Permissioned Marketplace

With whitelisted collections:

```bash
./deploy/deploy-permissioned.sh <collection1> <collection2> <collection3>
```

### Deployment Output

Each deployment creates a JSON file in `deployments/` with:
- Contract address
- Code ID
- Configuration
- Timestamp

## Creating Listings

### Prerequisites

Before creating a listing, you need:
1. **A deployed CW721 NFT contract** (see [Setting Up an NFT Contract](#setting-up-an-nft-contract) above)
2. **Ownership of the NFT you want to list** (mint one using `npm run mint-nft`)
3. **The marketplace contract deployed** and its address in your .env file

### Basic Sale Listing

List an NFT for sale:

```bash
npm run create-listing -- \
  --nft <nft_contract> \     # Must be a CW721 NFT contract, NOT the marketplace
  --token-id <token_id> \
  --price "10 XION" \
  --duration 168  # 7 days in hours
```

### Create an Offer

Make an offer to buy an NFT:

```bash
npm run create-listing -- \
  --nft <nft_contract> \
  --token-id <token_id> \
  --price "5 XION" \
  --type offer \
  --duration 24
```

### Using CW20 Tokens

List with CW20 token payment:

```bash
npm run create-listing -- \
  --nft <nft_contract> \
  --token-id <token_id> \
  --price "1000" \
  --payment-token <cw20_address>
```

### Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `--nft` | NFT contract address | Required |
| `--token-id` | NFT token ID | Required |
| `--price` | Price (e.g., "10", "10 XION", "10000000 uxion") | Required |
| `--duration` | Listing duration in hours | 168 (7 days) |
| `--type` | "sale" or "offer" | "sale" |
| `--payment-token` | CW20 token address | Native XION |
| `--id` | Custom listing ID | Auto-generated |
| `--marketplace` | "open", "single", "permissioned", or address | "open" |

## Buying NFTs

### Direct Purchase

Buy an NFT listing:

```bash
npm run buy-nft -- --id <listing_id>
```

### Buy for Another User (Crossmint-style)

Purchase on behalf of someone else using the `FinishFor` function:

```bash
npm run buy-for-user -- \
  --id <listing_id> \
  --recipient <recipient_address>
```

**Example with actual values:**
```bash
# Crossmint purchases NFT for end user
npm run buy-for-user -- \
  --id "listing-1234567890-abc123" \
  --recipient "xion1enduser5y93dkemf6cq2gzy82kmjxy8y0z6gck4"
```

**What happens:**
1. **You (or Crossmint) pay** the listing price in XION
2. **The recipient receives** the NFT directly
3. **The seller gets** the payment (minus marketplace fees)

**Example output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Purchasing NFT for Another User (Crossmint-style)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 Purchase Details:
├─ Marketplace: xion1al70d...
├─ Listing ID: listing-1234567890-abc123
└─ Recipient: xion1enduser5y93dkemf6cq2gzy82kmjxy8y0z6gck4

💰 Executing purchase for recipient...
Payer (you): Paying 10.000000 XION
Recipient: xion1enduser... (receives NFT)

🎉 Purchase successful!
├─ NFT: xion1nftcontract... #42
├─ Price Paid: 10.000000 XION
├─ Paid By: You
├─ NFT Sent To: xion1enduser5y93dkemf6cq2gzy82kmjxy8y0z6gck4
├─ Seller: xion1seller...
└─ Status: Completed

✅ The NFT has been transferred to xion1enduser...!
```

This is the exact function that **Crossmint will call** when processing credit card payments for NFT purchases.

## Querying Marketplace

### View All Listings

```bash
npm run get-listings
```

With pagination:
```bash
npm run get-listings -- --page 1 --limit 50
```

### Get Listing Details

```bash
npm run get-listing -- --id <listing_id>
```

### Search by Price Range

```bash
npm run search-by-price -- --min "1 XION" --max "100 XION"
```

### Get User's Listings

```bash
npm run get-user-listings -- --address <user_address>
```

### Filter by NFT

```bash
npm run get-listings -- --nft <nft_contract>
```

## Admin Operations

### Update Marketplace Configuration

```typescript
// Update fee percentage
const msg = {
  update_config: {
    config: {
      admin: "xion1...",
      denom: "uxion",
      fees: 3  // 3% fee
    }
  }
};
```

### Withdraw Collected Fees

```bash
npm run withdraw-fees -- --amount "100 XION"
```

### Add NFT to Permissioned List

For permissioned marketplace only:

```typescript
const msg = {
  add_nft: {
    nft: "xion1..."
  }
};
```

### Remove NFT from Permissioned List

```typescript
const msg = {
  remove_nft: {
    nft: "xion1..."
  }
};
```

## Crossmint Integration

### Overview

The marketplace fully supports Crossmint payment processing through the `FinishFor` function. This allows Crossmint to purchase NFTs on behalf of users who pay with credit cards, enabling Web2-style purchasing for Web3 NFTs.

### How It Works

The marketplace implements a special `FinishFor` function that allows one address (Crossmint) to pay while sending the NFT to a different address (the end customer). This is crucial for:
- Credit card payments
- Fiat-to-NFT purchases
- Corporate purchasing on behalf of employees
- Gift purchases

### Integration Flow

1. **Customer browses NFTs** on Crossmint's platform or a marketplace using Crossmint
2. **Customer pays with credit card** through Crossmint's payment system
3. **Crossmint calls `FinishFor`** with the customer's wallet address
4. **Crossmint pays in XION** from their operational wallet
5. **NFT transfers directly to customer**, not to Crossmint
6. **Seller receives payment** (minus marketplace fees)

### Complete Example Walkthrough

#### Step 1: NFT Owner Lists Their NFT

```bash
# NFT owner creates a listing
npm run create-listing -- --token-id 42 --price 10

# Output:
# Listing created with ID: listing-1234567890-abc123
```

#### Step 2: Customer Discovers NFT on Crossmint Platform

The customer sees the NFT listed for $XX USD (converted from 10 XION) and decides to purchase with their credit card.

#### Step 3: Crossmint Executes the Purchase

When the credit card payment is confirmed, Crossmint executes:

```bash
# Crossmint's automated system calls:
npm run buy-for-user -- \
  --id "listing-1234567890-abc123" \
  --recipient "xion1customer5y93dkemf6cq2gzy82kmjxy8y0z6gck4"
```

#### Step 4: Transaction Result

```
💰 Executing purchase for recipient...
Payer: xion1crossmint... (Paying 10.000000 XION)
Recipient: xion1customer... (receives NFT)

🎉 Purchase successful!
├─ NFT #42 transferred to: xion1customer...
├─ Payment made by: Crossmint
├─ Seller received: 9.8 XION (after 2% fee)
└─ Marketplace fee: 0.2 XION
```

### Implementation Code

```typescript
// This is what Crossmint's backend executes
async function crossmintPurchase(
  listingId: string,
  customerWalletAddress: string,
  price: string
) {
  const msg = {
    finish_for: {
      id: listingId,
      recipient: customerWalletAddress  // Customer gets the NFT
    }
  };

  const funds = [{
    denom: "uxion",
    amount: price
  }];

  return await client.execute(
    crossmintOperationalWallet,  // Crossmint pays
    marketplaceAddress,
    msg,
    "auto",
    "Crossmint purchase for customer",
    funds
  );
}
```

### Testing Crossmint Integration

#### Local Testing Setup

To test the Crossmint flow locally, you need two different wallets:

1. **Create a "Crossmint" test wallet** (the payer)
2. **Create a "Customer" test wallet** (the recipient)

#### Testing Steps

```bash
# 1. First, create a listing as the NFT owner
npm run create-listing -- --token-id 1 --price 5

# Note the listing ID, e.g., "listing-1757007764628-k980p6px2"

# 2. Simulate Crossmint purchasing for a customer
# (Make sure your .env has the "Crossmint" wallet mnemonic)
npm run buy-for-user -- \
  --id "listing-1757007764628-k980p6px2" \
  --recipient "xion1customer_wallet_address_here"

# 3. Verify the NFT ownership
# The NFT should now be owned by the customer wallet, not the Crossmint wallet
```

#### Testing with Different Scenarios

```bash
# Test 1: Regular purchase (buyer receives NFT)
npm run buy-nft -- --id "listing-123"
# Result: Buyer pays and receives NFT

# Test 2: Crossmint-style purchase (recipient receives NFT)
npm run buy-for-user -- --id "listing-456" --recipient "xion1recipient..."
# Result: You pay, recipient receives NFT

# Test 3: Gift purchase (friend receives NFT)
npm run buy-for-user -- --id "listing-789" --recipient "xion1friend..."
# Result: You pay, friend receives NFT
```

### Key Benefits for Crossmint

1. **No custody required**: NFTs go directly to customers
2. **Clean separation**: Payment wallet vs recipient wallet
3. **Audit trail**: Clear on-chain record of who paid and who received
4. **Compliance friendly**: Supports KYC/AML requirements
5. **Scalable**: Can process multiple purchases from single operational wallet

### API Endpoint for Crossmint

When integrating with Crossmint's API, they would call your marketplace like this:

```javascript
POST /api/purchase-nft
{
  "listing_id": "listing-1234567890-abc123",
  "recipient_wallet": "xion1customer...",
  "payment_confirmation": "stripe_payment_id_xyz"
}

// Your backend then executes the FinishFor transaction
```

## Common Workflows

### Complete NFT Sale Flow

1. **Seller lists NFT:**
```bash
npm run create-listing -- --nft <nft> --token-id 1 --price "10 XION"
```

2. **Buyer views listings:**
```bash
npm run get-listings
```

3. **Buyer purchases:**
```bash
npm run buy-nft -- --id <listing_id>
```

### Cancel a Listing

```bash
npm run cancel-listing -- --id <listing_id>
```

### Update Listing Price

```bash
npm run update-listing -- --id <listing_id> --price "15 XION"
```

## Troubleshooting

### Common Issues

**"Insufficient funds" error:**
- Ensure wallet has enough XION for purchase + gas
- Check balance: `xiond query bank balances <address>`

**"Unauthorized" error:**
- For sales: Ensure you own the NFT
- For cancellation: Only creator can cancel
- For admin functions: Only admin can execute

**"AlreadyExists" error:**
- Listing ID already used
- Use different ID or let it auto-generate

**"Expired" error:**
- Listing has expired
- Creator needs to create new listing

**NFT transfer not approved:**
- Marketplace needs approval to transfer NFT
- Use `--approve` flag when creating listing

### Debug Commands

Check transaction details:
```bash
xiond query tx <tx_hash> --node <rpc_url>
```

Query contract state:
```bash
xiond query wasm contract-state smart <contract> '{"config":{}}' --node <rpc_url>
```

## Best Practices

1. **Always verify listing details** before purchasing
2. **Use unique IDs** for listings or auto-generate
3. **Set reasonable expiration times** (not too short)
4. **Approve NFT transfer** before creating sale listings
5. **Test on testnet first** before mainnet deployment
6. **Keep private keys secure** - never commit `.env`
7. **Monitor gas prices** and adjust as needed
8. **Implement proper error handling** in production code