#!/usr/bin/env ts-node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { queryContract, formatXion, formatAddress, parsePrice } from '../utils/helpers';
import { SwapsByPriceQuery, ListResponse, Swap, SwapType } from '../utils/types';
import { getContractAddress } from '../utils/config';

const argv = yargs(hideBin(process.argv))
  .option('marketplace', {
    alias: 'm',
    type: 'string',
    description: 'Marketplace contract address',
    default: 'open'
  })
  .option('min', {
    type: 'string',
    description: 'Minimum price in XION'
  })
  .option('max', {
    type: 'string',
    description: 'Maximum price in XION'
  })
  .option('type', {
    alias: 't',
    type: 'string',
    description: 'Listing type: sale, offer, or all',
    default: 'all',
    choices: ['sale', 'offer', 'all']
  })
  .option('nft', {
    alias: 'n',
    type: 'string',
    description: 'Filter by NFT contract address'
  })
  .option('page', {
    alias: 'p',
    type: 'number',
    description: 'Page number',
    default: 0
  })
  .option('limit', {
    alias: 'l',
    type: 'number',
    description: 'Results per page',
    default: 20
  })
  .parseSync();

async function main() {
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

  console.log(chalk.blue('━'.repeat(60)));
  console.log(chalk.blue('Search Listings by Price'));
  console.log(chalk.blue('━'.repeat(60)));
  console.log('Marketplace:', formatAddress(marketplaceAddress, 12));
  
  if (argv.min || argv.max) {
    const minDisplay = argv.min ? formatXion(parsePrice(argv.min)) : 'No minimum';
    const maxDisplay = argv.max ? formatXion(parsePrice(argv.max)) : 'No maximum';
    console.log('Price Range:', minDisplay, '-', maxDisplay);
  }
  
  if (argv.type !== 'all') {
    console.log('Type:', argv.type);
  }
  
  if (argv.nft) {
    console.log('NFT Contract:', formatAddress(argv.nft, 12));
  }
  
  console.log();

  // Build query
  const query: SwapsByPriceQuery = {
    swaps_by_price: {
      min: argv.min ? parsePrice(argv.min) : undefined,
      max: argv.max ? parsePrice(argv.max) : undefined,
      swap_type: argv.type === 'all' ? undefined : (argv.type as SwapType),
      cw721: argv.nft,
      page: argv.page,
      limit: argv.limit
    }
  };

  try {
    const response = await queryContract<ListResponse>(marketplaceAddress, query);
    
    if (!response.swaps || response.swaps.length === 0) {
      console.log(chalk.yellow('No listings found matching your criteria'));
      return;
    }

    displayResults(response.swaps);
    
    console.log(chalk.gray(`\nFound ${response.swaps.length} listings`));
    
    if (response.swaps.length === argv.limit) {
      console.log(chalk.gray(`To see more, use: --page ${argv.page + 1}`));
    }

  } catch (error: any) {
    console.error(chalk.red('Search failed:'), error.message);
    process.exit(1);
  }
}

function displayResults(swaps: Swap[]) {
  // Sort by price
  swaps.sort((a, b) => parseInt(a.price) - parseInt(b.price));

  console.log(chalk.cyan('Price Range Results:'));
  console.log(chalk.cyan('━'.repeat(60)));

  swaps.forEach((swap, index) => {
    const price = formatXion(swap.price);
    const priceColor = parseInt(swap.price) < 10_000_000 ? chalk.green : 
                       parseInt(swap.price) < 100_000_000 ? chalk.yellow : 
                       chalk.red;

    console.log();
    console.log(`${chalk.gray(`#${index + 1}`)} ${chalk.white(swap.id)}`);
    console.log(`   NFT: ${swap.nft_contract} #${swap.token_id}`);
    console.log(`   Price: ${priceColor(price)}`);
    console.log(`   Type: ${swap.swap_type === 'Sale' ? chalk.green('For Sale') : chalk.blue('Offer')}`);
    console.log(`   Seller: ${formatAddress(swap.creator)}`);
    
    if (swap.payment_token) {
      console.log(`   Payment: CW20 Token (${formatAddress(swap.payment_token, 6)})`);
    }
  });

  console.log();
  console.log(chalk.cyan('━'.repeat(60)));

  // Price statistics
  const prices = swaps.map(s => parseInt(s.price));
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  console.log(chalk.gray('\nPrice Statistics:'));
  console.log(chalk.gray(`  Min: ${formatXion(minPrice.toString())}`));
  console.log(chalk.gray(`  Max: ${formatXion(maxPrice.toString())}`));
  console.log(chalk.gray(`  Avg: ${formatXion(avgPrice.toString())}`));
}

main().catch(console.error);