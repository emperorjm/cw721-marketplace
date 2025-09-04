import * as dotenv from 'dotenv';
import { GasPrice } from '@cosmjs/stargate';

// Load environment variables
dotenv.config();

export interface NetworkConfig {
  rpcUrl: string;
  chainId: string;
  gasPrice: GasPrice;
  prefix: string;
}

export interface ContractAddresses {
  marketplace?: string;
  singleCollection?: string;
  permissioned?: string;
  nftContract?: string;
}

// Network configurations
export const networks: Record<string, NetworkConfig> = {
  testnet: {
    rpcUrl: process.env.XION_RPC_URL || 'https://rpc.xion-testnet-1.burnt.com:443',
    chainId: process.env.XION_CHAIN_ID || 'xion-testnet-1',
    gasPrice: GasPrice.fromString(process.env.DEFAULT_GAS_PRICE || '0.025uxion'),
    prefix: 'xion',
  },
  mainnet: {
    rpcUrl: 'https://rpc.xion.burnt.com:443',
    chainId: 'xion-mainnet-1',
    gasPrice: GasPrice.fromString('0.025uxion'),
    prefix: 'xion',
  },
};

// Get current network from environment or default to testnet
export const currentNetwork = process.env.NETWORK || 'testnet';
export const networkConfig = networks[currentNetwork];

if (!networkConfig) {
  throw new Error(`Invalid network: ${currentNetwork}`);
}

// Contract addresses from environment
export const contractAddresses: ContractAddresses = {
  marketplace: process.env.MARKETPLACE_ADDRESS,
  singleCollection: process.env.SINGLE_COLLECTION_ADDRESS,
  permissioned: process.env.PERMISSIONED_ADDRESS,
  nftContract: process.env.NFT_CONTRACT_ADDRESS,
};

// Wallet configuration
export const walletConfig = {
  mnemonic: process.env.MNEMONIC,
  walletName: process.env.WALLET_NAME || 'deployer',
};

// Default transaction options
export const defaultTxOptions = {
  gas: process.env.DEFAULT_GAS_LIMIT || '500000',
  memo: '',
};

// Marketplace configuration
export const marketplaceConfig = {
  adminAddress: process.env.ADMIN_ADDRESS,
  feePercentage: parseInt(process.env.FEE_PERCENTAGE || '2'),
  denom: 'uxion',
};

// Validate required environment variables
export function validateConfig(): void {
  const required = ['MNEMONIC'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing.join(', '));
    console.error('Please copy .env.example to .env and fill in the values');
    process.exit(1);
  }
}

// Helper to get a specific contract address
export function getContractAddress(type: keyof ContractAddresses): string {
  const address = contractAddresses[type];
  if (!address) {
    throw new Error(`Contract address for ${type} not configured. Please set ${type.toUpperCase()}_ADDRESS in .env`);
  }
  return address;
}