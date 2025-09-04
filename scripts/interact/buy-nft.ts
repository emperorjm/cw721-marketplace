#!/usr/bin/env ts-node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { 
  executeContract, 
  queryContract,
  formatXion,
  displayTxResult 
} from '../utils/helpers';
import { FinishSwapMsg, DetailsQuery, DetailsResponse } from '../utils/types';
import { getContractAddress, marketplaceConfig } from '../utils/config';

const argv = yargs(hideBin(process.argv))
  .option('marketplace', {
    alias: 'm',
    type: 'string',
    description: 'Marketplace contract address',
    default: 'open'
  })
  .option('id', {
    alias: 'i',
    type: 'string',
    description: 'Listing ID to purchase',
    required: true
  })
  .option('skip-confirm', {
    alias: 's',
    type: 'boolean',
    description: 'Skip purchase confirmation',
    default: false
  })
  .parseSync();

async function main() {
  console.log(chalk.blue('━'.repeat(50)));
  console.log(chalk.blue('Purchasing NFT from Marketplace'));
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

  // Step 1: Query listing details
  console.log(chalk.yellow('\n📋 Fetching listing details...'));
  
  const detailsQuery: DetailsQuery = {
    details: {
      id: argv.id
    }
  };

  let listing: DetailsResponse;
  try {
    listing = await queryContract<DetailsResponse>(marketplaceAddress, detailsQuery);
  } catch (error: any) {
    console.error(chalk.red('Failed to fetch listing:'), error.message);
    console.log(chalk.yellow('\n💡 Tip: Make sure the listing ID is correct and the listing exists'));
    process.exit(1);
  }

  // Display listing details
  console.log(chalk.green('✓ Listing found'));
  console.log('\nListing Details:');
  console.log('├─ ID:', listing.id);
  console.log('├─ NFT Contract:', listing.nft_contract);
  console.log('├─ Token ID:', listing.token_id);
  console.log('├─ Seller:', listing.creator);
  console.log('├─ Price:', formatXion(listing.price));
  console.log('├─ Type:', listing.swap_type);
  
  if (listing.payment_token) {
    console.log('├─ Payment Token:', listing.payment_token);
    console.log(chalk.yellow('⚠️  This listing requires CW20 token payment'));
  } else {
    console.log('├─ Payment:', 'Native XION');
  }

  // Check if listing is a sale (not an offer)
  if (listing.swap_type !== 'Sale') {
    console.error(chalk.red('\n❌ This listing is an offer, not a sale'));
    console.log('To accept an offer, the NFT owner must use the finish command');
    process.exit(1);
  }

  // Confirm purchase
  if (!argv.skipConfirm) {
    console.log(chalk.yellow('\n⚠️  Purchase Confirmation'));
    console.log(`You are about to purchase NFT #${listing.token_id} for ${formatXion(listing.price)}`);
    console.log(chalk.gray('Press Ctrl+C to cancel, or wait 5 seconds to continue...'));
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Step 2: Execute purchase
  console.log(chalk.yellow('\n💰 Executing purchase...'));
  
  const finishMsg: FinishSwapMsg = {
    finish: {
      id: argv.id
    }
  };

  // Prepare funds for native token payment
  const funds = listing.payment_token ? [] : [{
    denom: marketplaceConfig.denom,
    amount: listing.price
  }];

  try {
    const result = await executeContract(marketplaceAddress, finishMsg, funds);
    
    console.log(chalk.green('\n🎉 Purchase successful!'));
    displayTxResult(result);
    
    console.log(chalk.cyan('\n📦 Purchase Summary:'));
    console.log('├─ NFT:', chalk.white(`${listing.nft_contract} #${listing.token_id}`));
    console.log('├─ Price Paid:', chalk.white(formatXion(listing.price)));
    console.log('├─ Seller:', chalk.white(listing.creator));
    console.log('└─ Status:', chalk.green('Completed'));
    
    console.log(chalk.green('\n✅ The NFT has been transferred to your wallet!'));
    
  } catch (error: any) {
    console.error(chalk.red('\n❌ Purchase failed:'), error.message);
    
    if (error.message.includes('insufficient funds')) {
      console.log(chalk.yellow('\n💡 Tip: Make sure you have enough XION to complete the purchase'));
      console.log(chalk.yellow(`Required: ${formatXion(listing.price)}`));
    } else if (error.message.includes('Expired')) {
      console.log(chalk.yellow('\n💡 Tip: This listing has expired'));
    } else if (error.message.includes('not found')) {
      console.log(chalk.yellow('\n💡 Tip: This listing may have already been purchased or cancelled'));
    }
    
    process.exit(1);
  }
}

main().catch(console.error);