# CW721 Marketplace API Reference

Complete API documentation for the CW721 Marketplace smart contracts.

## Table of Contents

- [Instantiate Messages](#instantiate-messages)
- [Execute Messages](#execute-messages)
- [Query Messages](#query-messages)
- [Data Types](#data-types)
- [Error Codes](#error-codes)

## Instantiate Messages

### Open Marketplace

```json
{
  "admin": "xion1...",
  "denom": "uxion",
  "fee_percentage": 2
}
```

| Field | Type | Description |
|-------|------|-------------|
| `admin` | String | Admin address with special privileges |
| `denom` | String | Native token denomination (e.g., "uxion") |
| `fee_percentage` | u64 | Marketplace fee (0-30%) |

### Single Collection Marketplace

```json
{
  "admin": "xion1...",
  "denom": "uxion",
  "cw721": "xion1...",
  "fee_percentage": 2
}
```

| Field | Type | Description |
|-------|------|-------------|
| `cw721` | String | Single NFT collection address |

### Permissioned Marketplace

```json
{
  "admin": "xion1...",
  "denom": "uxion",
  "cw721": ["xion1...", "xion2..."],
  "fee_percentage": 2
}
```

| Field | Type | Description |
|-------|------|-------------|
| `cw721` | String[] | Array of whitelisted NFT collections |

## Execute Messages

### Create Listing

Create a new NFT listing (sale or offer).

```json
{
  "create": {
    "id": "unique-listing-id",
    "cw721": "xion1...",
    "payment_token": null,
    "token_id": "1",
    "expires": {
      "at_height": 1000000
    },
    "price": "1000000",
    "swap_type": "sale"
  }
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | String | Yes | Unique listing identifier |
| `cw721` | String | Yes | NFT contract address |
| `payment_token` | String? | No | CW20 token address (null for native) |
| `token_id` | String | Yes | NFT token ID |
| `expires` | Expiration | Yes | When listing expires |
| `price` | Uint128 | Yes | Price in smallest unit |
| `swap_type` | SwapType | Yes | "sale" or "offer" |

**Requirements:**
- For sales: Sender must own the NFT
- For offers: Payment token must be specified if using CW20
- ID must be unique

### Finish Swap

Complete a listing (buy NFT or accept offer).

```json
{
  "finish": {
    "id": "listing-id"
  }
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | String | Yes | Listing ID to complete |

**Requirements:**
- For sales: Buyer must send exact payment
- For offers: NFT owner must be sender
- Listing must not be expired

### Finish Swap For (Crossmint)

Purchase NFT on behalf of another user.

```json
{
  "finish_for": {
    "id": "listing-id",
    "recipient": "xion1..."
  }
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | String | Yes | Listing ID to complete |
| `recipient` | String | Yes | Address to receive the NFT |

**Requirements:**
- Only works for sales, not offers
- Sender pays, recipient receives NFT
- Must include exact payment amount

### Cancel Listing

Cancel an active listing.

```json
{
  "cancel": {
    "id": "listing-id"
  }
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | String | Yes | Listing ID to cancel |

**Requirements:**
- Only listing creator can cancel
- Listing must exist

### Update Listing

Update price and expiration of a listing.

```json
{
  "update": {
    "id": "listing-id",
    "expires": {
      "at_height": 2000000
    },
    "price": "2000000"
  }
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | String | Yes | Listing ID to update |
| `expires` | Expiration | Yes | New expiration |
| `price` | Uint128 | Yes | New price |

**Requirements:**
- Only listing creator can update
- Cannot change NFT, token, or type

### Update Config (Admin)

Update marketplace configuration.

```json
{
  "update_config": {
    "config": {
      "admin": "xion1...",
      "denom": "uxion",
      "fees": 3
    }
  }
}
```

**Requirements:**
- Only admin can execute
- Fee percentage must be 0-30

### Withdraw Fees (Admin)

Withdraw collected marketplace fees.

```json
{
  "withdraw": {
    "amount": "1000000",
    "denom": "uxion",
    "payment_token": null
  }
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | Uint128 | Yes | Amount to withdraw |
| `denom` | String | Yes | Token denomination |
| `payment_token` | String? | No | CW20 address if withdrawing CW20 |

### Add NFT (Permissioned Only)

Add NFT collection to whitelist.

```json
{
  "add_nft": {
    "nft": "xion1..."
  }
}
```

### Remove NFT (Permissioned Only)

Remove NFT collection from whitelist.

```json
{
  "remove_nft": {
    "nft": "xion1..."
  }
}
```

## Query Messages

### List All Swaps

Get all swaps with pagination.

```json
{
  "list": {
    "start_after": "optional-id",
    "limit": 30
  }
}
```

**Response:** `ListResponse`

### Get Listing Details

Get details of a specific listing.

```json
{
  "details": {
    "id": "listing-id"
  }
}
```

**Response:** `DetailsResponse`

### Get Total Count

Count total listings by type.

```json
{
  "get_total": {
    "swap_type": "sale"
  }
}
```

**Response:** `u64`

### Get Listings (Sales)

Get all sale listings.

```json
{
  "get_listings": {
    "page": 0,
    "limit": 30
  }
}
```

**Response:** `ListResponse`

### Get Offers

Get all offer listings.

```json
{
  "get_offers": {
    "page": 0,
    "limit": 30
  }
}
```

**Response:** `ListResponse`

### Listings of Token

Get all listings for a specific NFT.

```json
{
  "listings_of_token": {
    "token_id": "1",
    "cw721": "xion1...",
    "swap_type": "sale",
    "page": 0,
    "limit": 30
  }
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token_id` | String | Yes | NFT token ID |
| `cw721` | String | Yes | NFT contract address |
| `swap_type` | SwapType? | No | Filter by type |
| `page` | u32? | No | Page number (0-based) |
| `limit` | u32? | No | Results per page |

### Swaps Of Address

Get all listings created by an address.

```json
{
  "swaps_of": {
    "address": "xion1...",
    "swap_type": "sale",
    "cw721": null,
    "page": 0,
    "limit": 30
  }
}
```

### Swaps By Price

Find listings within a price range.

```json
{
  "swaps_by_price": {
    "min": "1000000",
    "max": "10000000",
    "swap_type": "sale",
    "cw721": null,
    "page": 0,
    "limit": 30
  }
}
```

### Swaps By Denom

Find listings by payment token.

```json
{
  "swaps_by_denom": {
    "payment_token": null,
    "swap_type": "sale",
    "cw721": null,
    "page": 0,
    "limit": 30
  }
}
```

**Note:** `payment_token: null` returns native token listings.

### Swaps By Payment Type

Filter by CW20 or native payments.

```json
{
  "swaps_by_payment_type": {
    "cw20": false,
    "swap_type": "sale",
    "cw721": null,
    "page": 0,
    "limit": 30
  }
}
```

### Get Config

Query marketplace configuration.

```json
{
  "config": {}
}
```

**Response:**

```json
{
  "admin": "xion1...",
  "denom": "uxion",
  "fees": 2
}
```

## Data Types

### SwapType

```rust
enum SwapType {
  Sale,  // NFT owner selling
  Offer  // Buyer making offer
}
```

### Expiration

```rust
enum Expiration {
  AtHeight(u64),        // Block height
  AtTime(Timestamp),    // Unix timestamp (nanoseconds)
  Never {}              // Never expires
}
```

### Swap

```rust
struct Swap {
  id: String,
  creator: Addr,
  nft_contract: Addr,
  payment_token: Option<Addr>,
  token_id: String,
  expires: Expiration,
  price: Uint128,
  swap_type: SwapType
}
```

### ListResponse

```rust
struct ListResponse {
  swaps: Vec<Swap>
}
```

### DetailsResponse

Same as `Swap` structure.

### Config

```rust
struct Config {
  admin: Addr,
  denom: String,
  fees: u64
}
```

## Error Codes

| Error | Description | Solution |
|-------|-------------|----------|
| `Unauthorized` | Sender lacks permission | Check ownership/admin status |
| `AlreadyExists` | Listing ID already used | Use different ID |
| `InvalidInput` | Invalid parameters | Check message format |
| `Expired` | Listing has expired | Create new listing |
| `InvalidPaymentToken` | Invalid payment token | Check token address |
| `InsufficientFunds` | Payment amount incorrect | Send exact price |
| `NotFound` | Listing doesn't exist | Check listing ID |
| `InvalidPrice` | Price is zero or invalid | Set valid price |
| `InvalidExpiration` | Expiration in past | Set future expiration |

## Gas Estimates

| Operation | Estimated Gas | Recommended |
|-----------|---------------|-------------|
| Create Listing | 150,000 | 200,000 |
| Finish Swap | 250,000 | 300,000 |
| Cancel | 100,000 | 150,000 |
| Update | 120,000 | 150,000 |
| Query | 50,000 | 75,000 |

## Usage Examples

### Create Sale with TypeScript

```typescript
const msg = {
  create: {
    id: `sale-${Date.now()}`,
    cw721: nftContract,
    payment_token: null,
    token_id: "1",
    expires: {
      at_height: currentHeight + 100000
    },
    price: "1000000", // 1 XION
    swap_type: "sale"
  }
};

await client.execute(
  sender,
  marketplace,
  msg,
  "auto"
);
```

### Query with TypeScript

```typescript
const listings = await client.queryContractSmart(
  marketplace,
  {
    get_listings: {
      page: 0,
      limit: 20
    }
  }
);
```

## Rate Limits

- Maximum 100 results per query
- Pagination required for large datasets
- No hard limits on number of listings per user

## Security Considerations

1. **Always validate recipient addresses** in FinishFor
2. **Check expiration** before executing swaps
3. **Verify payment amounts** match listing price
4. **Approve NFT transfers** before creating sales
5. **Use unique IDs** to prevent overwrites
6. **Set reasonable fees** (recommended 1-5%)
7. **Monitor for expired listings** and clean up
8. **Validate NFT ownership** before operations