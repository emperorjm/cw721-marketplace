#!/usr/bin/env ts-node

import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

// Load environment variables
dotenv.config();

async function debugWallet() {
  const mnemonic = process.env.MNEMONIC;
  const nftContract = process.env.NFT_CONTRACT_ADDRESS;
  
  if (!mnemonic) {
    console.error(chalk.red('MNEMONIC not found in .env'));
    process.exit(1);
  }

  console.log(chalk.blue('========================================'));
  console.log(chalk.blue('  Wallet Address Debug'));
  console.log(chalk.blue('========================================\n'));

  // Show first few words of mnemonic (for verification)
  const mnemonicWords = mnemonic.split(' ');
  console.log('Mnemonic (first 3 words):', mnemonicWords.slice(0, 3).join(' ') + '...');
  console.log('Total words:', mnemonicWords.length);
  console.log();

  // Create wallet with default HD path
  console.log(chalk.yellow('Creating wallet with default HD path (m/44\'/118\'/0\'/0/0)...'));
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: 'xion'
  });

  const [account] = await wallet.getAccounts();
  console.log(chalk.green('✓ Wallet Address:'), chalk.white.bold(account.address));
  console.log();

  // If NFT contract exists, check ownership
  if (nftContract) {
    console.log(chalk.yellow('Checking NFT ownership...'));
    console.log('NFT Contract:', nftContract);
    
    try {
      const rpcUrl = process.env.XION_RPC_URL || 'https://rpc.xion-testnet-2.burnt.com:443';
      const client = await SigningCosmWasmClient.connect(rpcUrl);
      
      // Query owner of token ID "1"
      const ownerQuery = {
        owner_of: {
          token_id: "1",
          include_expired: false
        }
      };
      
      const ownerResponse = await client.queryContractSmart(nftContract, ownerQuery);
      console.log(chalk.green('✓ Token ID "1" owner:'), chalk.white.bold(ownerResponse.owner));
      
      // Check if it matches our wallet
      if (ownerResponse.owner === account.address) {
        console.log(chalk.green('✓ You own this NFT!'));
      } else {
        console.log(chalk.red('✗ You do NOT own this NFT'));
        console.log(chalk.yellow('  Your address:'), account.address);
        console.log(chalk.yellow('  NFT owner:   '), ownerResponse.owner);
      }

      // Also try to get all tokens for our address
      console.log(chalk.yellow('\nChecking all tokens owned by your address...'));
      const tokensQuery = {
        tokens: {
          owner: account.address,
          start_after: undefined,
          limit: 10
        }
      };
      
      try {
        const tokensResponse = await client.queryContractSmart(nftContract, tokensQuery);
        if (tokensResponse.tokens && tokensResponse.tokens.length > 0) {
          console.log(chalk.green('✓ You own these token IDs:'), tokensResponse.tokens);
        } else {
          console.log(chalk.yellow('  You don\'t own any tokens in this NFT contract'));
        }
      } catch (e) {
        console.log(chalk.gray('  Could not query tokens (query might not be supported)'));
      }

    } catch (error: any) {
      console.error(chalk.red('Error querying NFT contract:'), error.message);
    }
  }

  console.log(chalk.blue('\n========================================'));
  console.log(chalk.cyan('Summary:'));
  console.log('Your wallet address is:', chalk.white.bold(account.address));
  console.log('Use this address when checking NFT ownership');
  console.log(chalk.blue('========================================'));
}

debugWallet().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});