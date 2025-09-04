// Type definitions for marketplace contracts

export enum SwapType {
  Sale = 'Sale',
  Offer = 'Offer',
}

export interface Expiration {
  at_height?: number;
  at_time?: string;
  never?: {};
}

export interface CreateListingMsg {
  create: {
    id: string;
    cw721: string;
    payment_token?: string;
    token_id: string;
    expires: Expiration;
    price: string;
    swap_type: SwapType;
  };
}

export interface FinishSwapMsg {
  finish: {
    id: string;
  };
}

export interface FinishSwapForMsg {
  finish_for: {
    id: string;
    recipient: string;
  };
}

export interface CancelMsg {
  cancel: {
    id: string;
  };
}

export interface UpdateMsg {
  update: {
    id: string;
    expires: Expiration;
    price: string;
  };
}

export interface WithdrawMsg {
  withdraw: {
    amount: string;
    denom: string;
    payment_token?: string;
  };
}

export interface Swap {
  id: string;
  creator: string;
  nft_contract: string;
  payment_token?: string;
  token_id: string;
  expires: Expiration;
  price: string;
  swap_type: SwapType;
}

export interface ListResponse {
  swaps: Swap[];
}

export interface DetailsResponse {
  id: string;
  creator: string;
  nft_contract: string;
  payment_token?: string;
  token_id: string;
  expires: Expiration;
  price: string;
  swap_type: SwapType;
}

export interface Config {
  admin: string;
  denom: string;
  fees: number;
}

export interface GetListingsQuery {
  get_listings: {
    page?: number;
    limit?: number;
  };
}

export interface GetOffersQuery {
  get_offers: {
    page?: number;
    limit?: number;
  };
}

export interface DetailsQuery {
  details: {
    id: string;
  };
}

export interface SwapsOfQuery {
  swaps_of: {
    address: string;
    swap_type?: SwapType;
    cw721?: string;
    page?: number;
    limit?: number;
  };
}

export interface ListingsOfTokenQuery {
  listings_of_token: {
    token_id: string;
    cw721: string;
    swap_type?: SwapType;
    page?: number;
    limit?: number;
  };
}

export interface SwapsByPriceQuery {
  swaps_by_price: {
    min?: string;
    max?: string;
    swap_type?: SwapType;
    cw721?: string;
    page?: number;
    limit?: number;
  };
}

export interface SwapsByDenomQuery {
  swaps_by_denom: {
    payment_token?: string;
    swap_type?: SwapType;
    cw721?: string;
    page?: number;
    limit?: number;
  };
}

export interface ConfigQuery {
  config: {};
}

// NFT Types
export interface ApproveMsg {
  approve: {
    spender: string;
    token_id: string;
    expires?: Expiration;
  };
}

export interface TransferNftMsg {
  transfer_nft: {
    recipient: string;
    token_id: string;
  };
}

export interface OwnerOfQuery {
  owner_of: {
    token_id: string;
    include_expired?: boolean;
  };
}

export interface OwnerOfResponse {
  owner: string;
  approvals: Approval[];
}

export interface Approval {
  spender: string;
  expires: Expiration;
}