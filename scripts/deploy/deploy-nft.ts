#!/usr/bin/env ts-node

import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { GasPrice } from '@cosmjs/stargate';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Load environment variables
dotenv.config();

const argv = yargs(hideBin(process.argv))
  .option('name', {
    type: 'string',
    description: 'NFT collection name',
    default: 'Test NFT Collection'
  })
  .option('symbol', {
    type: 'string',
    description: 'NFT collection symbol',
    default: 'TNFT'
  })
  .option('minter', {
    type: 'string',
    description: 'Address that can mint NFTs (defaults to deployer)'
  })
  .option('base-uri', {
    type: 'string',
    description: 'Base URI for token metadata',
    default: 'https://ipfs.io/ipfs/'
  })
  .parseSync();

async function deployNFTContract() {
  // Check required environment variables
  const mnemonic = process.env.MNEMONIC;
  if (!mnemonic) {
    console.error(chalk.red('Error: MNEMONIC not found in .env file'));
    process.exit(1);
  }

  const rpcUrl = process.env.XION_RPC_URL || 'https://rpc.xion-testnet-2.burnt.com:443';
  const chainId = process.env.XION_CHAIN_ID || 'xion-testnet-2';

  console.log(chalk.blue('\n========================================'));
  console.log(chalk.blue('  Deploying CW721 NFT Contract'));
  console.log(chalk.blue('========================================\n'));
  
  console.log(`Network: ${chainId}`);
  console.log(`RPC URL: ${rpcUrl}`);
  console.log(`Name: ${argv.name}`);
  console.log(`Symbol: ${argv.symbol}\n`);

  try {
    // Create wallet
    console.log(chalk.yellow('Creating wallet from mnemonic...'));
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
      prefix: 'xion'
    });

    const [account] = await wallet.getAccounts();
    const deployerAddress = account.address;
    console.log(`Deployer address: ${deployerAddress}\n`);

    const minter = argv.minter || deployerAddress;

    // Connect to chain
    console.log(chalk.yellow('Connecting to chain...'));
    const gasPrice = GasPrice.fromString('0.025uxion');
    const client = await SigningCosmWasmClient.connectWithSigner(
      rpcUrl,
      wallet,
      { gasPrice }
    );

    // For this example, we'll use a pre-deployed CW721-base code ID
    // In production, you would upload your own CW721 contract
    // You can find public CW721-base code IDs on the chain or deploy your own
    
    console.log(chalk.yellow('Note: Using CW721-base contract'));
    console.log(chalk.yellow('For production, consider deploying your own customized NFT contract\n'));

    // Check if CW721_CODE_ID is in env, otherwise prompt user
    let codeId = process.env.CW721_CODE_ID;
    
    if (!codeId) {
      console.log(chalk.yellow('CW721_CODE_ID not found in .env'));
      console.log(chalk.yellow('You need to either:'));
      console.log(chalk.yellow('1. Use an existing CW721-base code ID from the chain'));
      console.log(chalk.yellow('2. Upload your own CW721 contract first'));
      console.log(chalk.cyan('\nTo find existing code IDs, you can query the chain'));
      console.log(chalk.cyan('or check the explorer for CW721 contracts\n'));
      
      // For testnet, we might know a common CW721-base code ID
      // This is chain-specific and would need to be updated
      console.log(chalk.yellow('For XION testnet, you might try code ID 1 or 2 (if available)'));
      console.log(chalk.yellow('Otherwise, you need to upload a CW721 contract first\n'));
      
      process.exit(1);
    }

    // Instantiate NFT contract
    console.log(chalk.yellow(`Instantiating NFT contract with code ID ${codeId}...`));
    
    const instantiateMsg = {
      name: argv.name,
      symbol: argv.symbol,
      minter: minter,
      // Optional: Add more configuration as needed
      // base_uri: argv.baseUri,
    };

    console.log('Instantiate message:', JSON.stringify(instantiateMsg, null, 2));

    const instantiateResult = await client.instantiate(
      deployerAddress,
      parseInt(codeId),
      instantiateMsg,
      `${argv.name} - ${argv.symbol}`,
      'auto',
      {
        admin: deployerAddress
      }
    );

    console.log(chalk.green(`\n✓ NFT Contract deployed successfully!`));
    console.log(`  Contract address: ${instantiateResult.contractAddress}`);
    console.log(`  Transaction hash: ${instantiateResult.transactionHash}\n`);

    // Save deployment info
    const deploymentInfo = {
      network: chainId,
      contractType: 'cw721-nft',
      codeId: codeId,
      contractAddress: instantiateResult.contractAddress,
      name: argv.name,
      symbol: argv.symbol,
      minter: minter,
      deployedAt: new Date().toISOString(),
      deployer: deployerAddress,
      transactionHash: instantiateResult.transactionHash
    };

    const deploymentsDir = path.join(__dirname, '..', '..', 'deployments');
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const deploymentFile = path.join(
      deploymentsDir,
      `nft-${timestamp}.json`
    );
    
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log(chalk.green(`Deployment info saved to: ${deploymentFile}\n`));

    // Update .env file with NFT contract address
    const envPath = path.join(__dirname, '..', '.env');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const envVarName = 'NFT_CONTRACT_ADDRESS';
    
    const regex = new RegExp(`^${envVarName}=.*$`, 'm');
    let newEnvContent = envContent;
    
    if (regex.test(envContent)) {
      newEnvContent = envContent.replace(regex, `${envVarName}=${instantiateResult.contractAddress}`);
    } else {
      newEnvContent = envContent + `\n${envVarName}=${instantiateResult.contractAddress}`;
    }
    
    fs.writeFileSync(envPath, newEnvContent);
    console.log(chalk.green(`✓ Updated ${envVarName} in .env file\n`));

    // Output summary
    console.log(chalk.green('========================================'));
    console.log(chalk.green('  NFT Contract Ready!'));
    console.log(chalk.green('========================================\n'));
    console.log(chalk.bold('Contract Address:'), instantiateResult.contractAddress);
    console.log(chalk.bold('Minter:'), minter);
    
    console.log(chalk.cyan('\nNext steps:'));
    console.log('1. Mint NFTs using: npm run mint-nft');
    console.log('2. List NFTs on marketplace: npm run create-listing');
    console.log('3. View your NFTs in the explorer');

    return instantiateResult.contractAddress;

  } catch (error) {
    console.error(chalk.red('\n❌ Deployment failed:'), error);
    process.exit(1);
  }
}

// Main execution
async function main() {
  await deployNFTContract();
}

if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

export { deployNFTContract };