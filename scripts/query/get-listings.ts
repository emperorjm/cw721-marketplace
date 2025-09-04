#!/usr/bin/env ts-node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { queryContract, formatXion, formatAddress } from '../utils/helpers';
import { GetListingsQuery, ListResponse, Swap } from '../utils/types';
import { getContractAddress } from '../utils/config';

const argv = yargs(hideBin(process.argv))
  .option('marketplace', {
    alias: 'm',
    type: 'string',
    description: 'Marketplace contract address',
    default: 'open'
  })
  .option('page', {
    alias: 'p',
    type: 'number',
    description: 'Page number (0-based)',
    default: 0
  })
  .option('limit', {
    alias: 'l',
    type: 'number',
    description: 'Number of results per page',
    default: 20
  })
  .option('format', {
    alias: 'f',
    type: 'string',
    description: 'Output format: table or json',
    default: 'table',
    choices: ['table', 'json']
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
  console.log(chalk.blue('Active Marketplace Listings'));
  console.log(chalk.blue('━'.repeat(60)));
  console.log('Marketplace:', formatAddress(marketplaceAddress, 12));
  console.log('Page:', argv.page, '| Limit:', argv.limit);
  console.log();

  // Query listings
  const query: GetListingsQuery = {
    get_listings: {
      page: argv.page,
      limit: argv.limit
    }
  };

  try {
    const response = await queryContract<ListResponse>(marketplaceAddress, query);
    
    if (!response.swaps || response.swaps.length === 0) {
      console.log(chalk.yellow('No active listings found'));
      return;
    }

    if (argv.format === 'json') {
      console.log(JSON.stringify(response.swaps, null, 2));
    } else {
      displayListingsTable(response.swaps);
    }

    console.log(chalk.gray(`\nShowing ${response.swaps.length} listings`));
    
    if (response.swaps.length === argv.limit) {
      console.log(chalk.gray(`To see more, use: --page ${argv.page + 1}`));
    }

  } catch (error: any) {
    console.error(chalk.red('Failed to fetch listings:'), error.message);
    process.exit(1);
  }
}

function displayListingsTable(swaps: Swap[]) {
  // Table header
  console.log(chalk.cyan('┌─────────────────┬──────────────┬──────────────┬──────────────┬────────┐'));
  console.log(chalk.cyan('│ ID              │ Token ID     │ Price        │ Seller       │ Type   │'));
  console.log(chalk.cyan('├─────────────────┼──────────────┼──────────────┼──────────────┼────────┤'));

  swaps.forEach((swap, index) => {
    const id = swap.id.length > 15 ? swap.id.substring(0, 12) + '...' : swap.id.padEnd(15);
    const tokenId = swap.token_id.length > 12 ? swap.token_id.substring(0, 9) + '...' : swap.token_id.padEnd(12);
    const price = formatXion(swap.price).padEnd(12);
    const seller = formatAddress(swap.creator, 5).padEnd(12);
    const type = swap.swap_type.padEnd(6);

    const row = `│ ${id} │ ${tokenId} │ ${price} │ ${seller} │ ${type} │`;
    
    if (index % 2 === 0) {
      console.log(chalk.white(row));
    } else {
      console.log(chalk.gray(row));
    }
  });

  console.log(chalk.cyan('└─────────────────┴──────────────┴──────────────┴──────────────┴────────┘'));
  
  // Show how to get details
  if (swaps.length > 0) {
    console.log(chalk.gray('\nTo view details of a listing:'));
    console.log(chalk.gray(`  npm run get-listing -- --id "${swaps[0].id}"`));
  }
}

main().catch(console.error);