#!/usr/bin/env ts-node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { 
  executeContract, 
  expirationAfterHours, 
  parsePrice,
  displayTxResult 
} from '../utils/helpers';
import { CreateListingMsg, SwapType, ApproveMsg } from '../utils/types';
import { getContractAddress, marketplaceConfig } from '../utils/config';

const argv = yargs(hideBin(process.argv))
  .option('marketplace', {
    alias: 'm',
    type: 'string',
    description: 'Marketplace contract address',
    default: 'open'
  })
  .option('nft', {
    alias: 'n',
    type: 'string',
    description: 'NFT contract address (defaults to NFT_CONTRACT_ADDRESS from .env)',
    required: false
  })
  .option('token-id', {
    alias: 't',
    type: 'string',
    description: 'NFT token ID',
    required: true
  })
  .option('price', {
    alias: 'p',
    type: 'string',
    description: 'Price in XION (e.g., "10" or "10 XION" or "10000000 uxion")',
    required: true
  })
  .option('duration', {
    alias: 'd',
    type: 'number',
    description: 'Listing duration in hours',
    default: 24 * 7 // 1 week
  })
  .option('type', {
    type: 'string',
    description: 'Listing type: sale or offer',
    default: 'sale',
    choices: ['sale', 'offer']
  })
  .option('payment-token', {
    type: 'string',
    description: 'CW20 token address for payment (optional, defaults to native XION)'
  })
  .option('id', {
    type: 'string',
    description: 'Custom listing ID (optional, auto-generated if not provided)'
  })
  .option('approve', {
    alias: 'a',
    type: 'boolean',
    description: 'Approve marketplace to transfer NFT (required for sales)',
    default: true
  })
  .parseSync();

async function main() {
  console.log(chalk.blue('━'.repeat(50)));
  console.log(chalk.blue('Creating Marketplace Listing'));
  console.log(chalk.blue('━'.repeat(50)));

  // Determine marketplace address
  let marketplaceAddress: string;
  if (argv.marketplace === 'open') {
    marketplaceAddress = getContractAddress('marketplace');
  } else if (argv.marketplace === 'single') {
    marketplaceAddress = getContractAddress('singleCollection');
  } else if (argv.marketplace === 'permissioned') {
    marketplaceAddress = getContractAddress('permissioned');
  } else {
    marketplaceAddress = argv.marketplace;
  }

  // Determine NFT contract address
  let nftContract = argv.nft;
  
  // If --nft is not provided or is empty, use NFT_CONTRACT_ADDRESS from .env
  if (!nftContract || nftContract === '') {
    nftContract = getContractAddress('nftContract');
    
    if (!nftContract) {
      console.error(chalk.red('\n❌ Error: NFT contract address not found'));
      console.error(chalk.yellow('Please either:'));
      console.error(chalk.yellow('1. Set NFT_CONTRACT_ADDRESS in your .env file'));
      console.error(chalk.yellow('2. Provide the NFT address with --nft parameter'));
      console.error(chalk.cyan('\nExamples:'));
      console.error(chalk.cyan('npm run create-listing -- --token-id 1 --price 10  (uses .env)'));
      console.error(chalk.cyan('npm run create-listing -- --nft xion1abc... --token-id 1 --price 10'));
      process.exit(1);
    }
    
    console.log(chalk.gray(`Using NFT contract from .env: ${nftContract.substring(0, 20)}...`));
  }

  // Validation: Check that NFT address is not the same as marketplace
  if (nftContract === marketplaceAddress) {
    console.error(chalk.red('\n❌ Error: NFT contract address cannot be the same as marketplace address'));
    console.error(chalk.yellow('You need to provide the address of an NFT (CW721) contract, not the marketplace contract.'));
    console.error(chalk.yellow('\nTo create a listing:'));
    console.error(chalk.yellow('1. First deploy or have access to a CW721 NFT contract'));
    console.error(chalk.yellow('2. Ensure you own the NFT you want to list'));
    console.error(chalk.yellow('3. Use the NFT contract address with --nft parameter'));
    console.error(chalk.cyan('\nExample:'));
    console.error(chalk.cyan('npm run create-listing -- --nft <YOUR_NFT_CONTRACT> --token-id 1 --price 10'));
    process.exit(1);
  }

  // Generate listing ID if not provided
  const listingId = argv.id || `listing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Parse price
  const price = parsePrice(argv.price);
  
  // Create expiration
  const expires = expirationAfterHours(argv.duration);
  
  // Determine swap type (note: lowercase input, but enum has capitalized values)
  const swapType = argv.type.toLowerCase() === 'offer' ? SwapType.Offer : SwapType.Sale;

  console.log('\nListing Details:');
  console.log('├─ Marketplace:', marketplaceAddress);
  console.log('├─ NFT Contract:', nftContract);
  console.log('├─ Token ID:', argv.tokenId);
  console.log('├─ Price:', `${price} uxion (${parseInt(price) / 1_000_000} XION)`);
  console.log('├─ Type:', swapType);
  console.log('├─ Duration:', `${argv.duration} hours`);
  console.log('├─ Listing ID:', listingId);
  if (argv.paymentToken) {
    console.log('├─ Payment Token:', argv.paymentToken);
  }
  console.log('└─ Auto-approve:', argv.approve);

  // Step 1: Approve marketplace to transfer NFT (if it's a sale)
  if (swapType === SwapType.Sale && argv.approve) {
    console.log(chalk.yellow('\n📝 Step 1: Approving marketplace to transfer NFT...'));
    
    const approveMsg: ApproveMsg = {
      approve: {
        spender: marketplaceAddress,
        token_id: argv.tokenId,
        expires: expires
      }
    };

    try {
      const approveResult = await executeContract(nftContract, approveMsg);
      console.log(chalk.green('✓ NFT transfer approved'));
      console.log('  Transaction:', approveResult.transactionHash);
    } catch (error: any) {
      console.error(chalk.red('Failed to approve NFT transfer:'), error.message);
      console.log(chalk.yellow('You may need to manually approve the marketplace to transfer your NFT'));
    }
  }

  // Step 2: Create the listing
  console.log(chalk.yellow('\n📝 Step 2: Creating marketplace listing...'));
  
  const createMsg: CreateListingMsg = {
    create: {
      id: listingId,
      cw721: nftContract,
      payment_token: argv.paymentToken,
      token_id: argv.tokenId,
      expires: expires,
      price: price,
      swap_type: swapType
    }
  };

  try {
    const result = await executeContract(marketplaceAddress, createMsg);
    
    console.log(chalk.green('\n✅ Listing created successfully!'));
    displayTxResult(result);
    
    console.log(chalk.cyan('\n📋 Listing Summary:'));
    console.log('├─ Listing ID:', chalk.white(listingId));
    console.log('├─ NFT:', chalk.white(`${nftContract} #${argv.tokenId}`));
    console.log('├─ Price:', chalk.white(`${parseInt(price) / 1_000_000} XION`));
    console.log('├─ Type:', chalk.white(swapType));
    console.log('└─ Status:', chalk.green('Active'));
    
    console.log(chalk.gray('\nTo cancel this listing, run:'));
    console.log(chalk.gray(`  npm run cancel-listing -- --id "${listingId}"`));
    
    console.log(chalk.gray('\nTo update this listing, run:'));
    console.log(chalk.gray(`  npm run update-listing -- --id "${listingId}" --price <new_price>`));
    
  } catch (error: any) {
    console.error(chalk.red('\n❌ Failed to create listing:'), error.message);
    
    if (error.message.includes('Unauthorized')) {
      console.log(chalk.yellow('\n💡 Tip: Make sure you own the NFT you\'re trying to list'));
    } else if (error.message.includes('AlreadyExists')) {
      console.log(chalk.yellow('\n💡 Tip: A listing with this ID already exists. Try a different ID or omit --id to auto-generate'));
    }
    
    process.exit(1);
  }
}

main().catch(console.error);