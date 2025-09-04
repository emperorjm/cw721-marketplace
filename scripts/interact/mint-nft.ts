#!/usr/bin/env ts-node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { executeContract, displayTxResult } from '../utils/helpers';
import { getContractAddress } from '../utils/config';

const argv = yargs(hideBin(process.argv))
  .option('nft', {
    alias: 'n',
    type: 'string',
    description: 'NFT contract address (defaults to NFT_CONTRACT_ADDRESS from .env)'
  })
  .option('token-id', {
    alias: 't',
    type: 'string',
    description: 'Token ID to mint',
    required: true
  })
  .option('owner', {
    alias: 'o',
    type: 'string',
    description: 'Owner address (defaults to minter)'
  })
  .option('token-uri', {
    alias: 'u',
    type: 'string',
    description: 'Token URI for metadata',
    default: ''
  })
  .option('extension', {
    alias: 'e',
    type: 'string',
    description: 'Extension metadata (JSON string)',
  })
  .parseSync();

interface MintMsg {
  mint: {
    token_id: string;
    owner: string;
    token_uri?: string;
    extension?: any;
  };
}

async function mintNFT() {
  console.log(chalk.blue('━'.repeat(50)));
  console.log(chalk.blue('Minting NFT'));
  console.log(chalk.blue('━'.repeat(50)));

  // Get NFT contract address
  const nftContract = argv.nft || getContractAddress('nftContract');
  
  if (!nftContract) {
    console.error(chalk.red('\n❌ Error: NFT contract address not found'));
    console.error(chalk.yellow('Please provide --nft parameter or set NFT_CONTRACT_ADDRESS in .env'));
    process.exit(1);
  }

  // Parse extension if provided
  let extension = null;
  if (argv.extension) {
    try {
      extension = JSON.parse(argv.extension);
    } catch (e) {
      console.error(chalk.red('Error parsing extension JSON:'), e);
      process.exit(1);
    }
  }

  // Import createSigningClient to get the minter's address
  const { createSigningClient } = await import('../utils/helpers');
  const { address: minterAddress } = await createSigningClient();

  // Get owner address (will default to minter's wallet address if not provided)
  // Changed from defaulting to ADMIN_ADDRESS to defaulting to minter's address
  const owner = argv.owner || minterAddress;

  console.log('\nMint Details:');
  console.log('├─ NFT Contract:', nftContract);
  console.log('├─ Token ID:', argv.tokenId);
  console.log('├─ Owner:', owner);
  if (argv.tokenUri) {
    console.log('├─ Token URI:', argv.tokenUri);
  }
  if (extension) {
    console.log('└─ Extension:', JSON.stringify(extension));
  }

  // Create mint message
  const mintMsg: MintMsg = {
    mint: {
      token_id: argv.tokenId,
      owner: owner,
      ...(argv.tokenUri && { token_uri: argv.tokenUri }),
      ...(extension && { extension })
    }
  };

  console.log(chalk.yellow('\n📝 Minting NFT...'));
  
  try {
    const result = await executeContract(nftContract, mintMsg);
    
    console.log(chalk.green('\n✅ NFT minted successfully!'));
    displayTxResult(result);
    
    console.log(chalk.cyan('\n📋 NFT Summary:'));
    console.log('├─ Contract:', chalk.white(nftContract));
    console.log('├─ Token ID:', chalk.white(argv.tokenId));
    console.log('├─ Owner:', chalk.white(owner));
    console.log('└─ Status:', chalk.green('Minted'));
    
    console.log(chalk.cyan('\nNext steps:'));
    console.log('1. View NFT details: Query the contract for token info');
    console.log('2. List on marketplace: npm run create-listing -- --nft', nftContract, '--token-id', argv.tokenId);
    console.log('3. Transfer NFT: Use transfer commands');

  } catch (error: any) {
    console.error(chalk.red('\n❌ Failed to mint NFT:'), error.message);
    
    // Common error explanations
    if (error.message.includes('Unauthorized')) {
      console.error(chalk.yellow('\nYou are not authorized to mint NFTs on this contract.'));
      console.error(chalk.yellow('Only the designated minter can mint new NFTs.'));
    } else if (error.message.includes('token_id already claimed')) {
      console.error(chalk.yellow('\nThis token ID already exists. Try a different ID.'));
    }
    
    process.exit(1);
  }
}

// Main execution
mintNFT().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});