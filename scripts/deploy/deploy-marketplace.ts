#!/usr/bin/env ts-node

import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { GasPrice } from '@cosmjs/stargate';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

// Load environment variables
dotenv.config();

interface DeployConfig {
  contractType: 'marketplace' | 'single-collection' | 'permissioned';
  wasmPath: string;
  instantiateMsg: any;
  label: string;
}

async function deployContract(config: DeployConfig) {
  // Check required environment variables
  const mnemonic = process.env.MNEMONIC;
  if (!mnemonic) {
    console.error(chalk.red('Error: MNEMONIC not found in .env file'));
    process.exit(1);
  }

  const rpcUrl = process.env.XION_RPC_URL || 'https://rpc.xion-testnet-2.burnt.com:443';
  const chainId = process.env.XION_CHAIN_ID || 'xion-testnet-2';
  const adminAddress = process.env.ADMIN_ADDRESS;
  const feePercentage = parseInt(process.env.FEE_PERCENTAGE || '2');

  console.log(chalk.blue('\n========================================'));
  console.log(chalk.blue(`  Deploying ${config.label}`));
  console.log(chalk.blue('========================================\n'));
  
  console.log(`Network: ${chainId}`);
  console.log(`RPC URL: ${rpcUrl}`);
  console.log(`Admin: ${adminAddress || 'Will use deployer address'}`);
  console.log(`Fee: ${feePercentage}%\n`);

  try {
    // Create wallet
    console.log(chalk.yellow('Creating wallet from mnemonic...'));
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
      prefix: 'xion'
    });

    const [account] = await wallet.getAccounts();
    const deployerAddress = account.address;
    console.log(`Deployer address: ${deployerAddress}\n`);

    // Use admin address from env or default to deployer
    const admin = adminAddress || deployerAddress;

    // Connect to chain
    console.log(chalk.yellow('Connecting to chain...'));
    const gasPrice = GasPrice.fromString('0.025uxion');
    const client = await SigningCosmWasmClient.connectWithSigner(
      rpcUrl,
      wallet,
      { gasPrice }
    );

    // Read WASM file
    console.log(chalk.yellow('Reading optimized WASM file...'));
    const wasmPath = path.join(__dirname, '..', '..', config.wasmPath);
    
    if (!fs.existsSync(wasmPath)) {
      console.error(chalk.red(`Error: WASM file not found at ${wasmPath}`));
      console.error(chalk.red('Please run the optimizer first'));
      process.exit(1);
    }

    const wasmBytes = fs.readFileSync(wasmPath);
    const wasmSize = (wasmBytes.length / 1024).toFixed(2);
    console.log(`WASM size: ${wasmSize} KB\n`);

    // Upload contract
    console.log(chalk.yellow('Uploading contract to chain...'));
    const uploadResult = await client.upload(
      deployerAddress,
      wasmBytes,
      'auto',
      `Upload ${config.label}`
    );
    console.log(chalk.green(`✓ Contract uploaded with code ID: ${uploadResult.codeId}`));
    console.log(`  Transaction hash: ${uploadResult.transactionHash}\n`);

    // Instantiate contract
    console.log(chalk.yellow('Instantiating contract...'));
    
    // Build instantiate message based on contract type
    let instantiateMsg = config.instantiateMsg;
    if (!instantiateMsg) {
      if (config.contractType === 'marketplace') {
        instantiateMsg = {
          admin,
          denom: 'uxion',
          fee_percentage: feePercentage
        };
      }
      // Add other contract types as needed
    }

    console.log('Instantiate message:', JSON.stringify(instantiateMsg, null, 2));

    const instantiateResult = await client.instantiate(
      deployerAddress,
      uploadResult.codeId,
      instantiateMsg,
      config.label,
      'auto',
      {
        admin: admin
      }
    );

    console.log(chalk.green(`\n✓ Contract instantiated successfully!`));
    console.log(`  Contract address: ${instantiateResult.contractAddress}`);
    console.log(`  Transaction hash: ${instantiateResult.transactionHash}\n`);

    // Save deployment info
    const deploymentInfo = {
      network: chainId,
      contractType: config.contractType,
      codeId: uploadResult.codeId,
      contractAddress: instantiateResult.contractAddress,
      admin,
      denom: 'uxion',
      feePercentage,
      deployedAt: new Date().toISOString(),
      deployer: deployerAddress,
      transactionHashes: {
        upload: uploadResult.transactionHash,
        instantiate: instantiateResult.transactionHash
      }
    };

    const deploymentsDir = path.join(__dirname, '..', '..', 'deployments');
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const deploymentFile = path.join(
      deploymentsDir,
      `${config.contractType}-${timestamp}.json`
    );
    
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log(chalk.green(`Deployment info saved to: ${deploymentFile}\n`));

    // Output summary
    console.log(chalk.green('========================================'));
    console.log(chalk.green('  Deployment Successful!'));
    console.log(chalk.green('========================================\n'));
    console.log(chalk.bold('Contract Address:'), instantiateResult.contractAddress);
    console.log(chalk.bold('Code ID:'), uploadResult.codeId);
    console.log(chalk.bold('Admin:'), admin);
    
    console.log(chalk.cyan('\nNext steps:'));
    console.log('1. Save the contract address in your .env file');
    console.log('2. Verify the contract on the explorer');
    console.log('3. Create your first listing using scripts/interact/create-listing.ts');

    // Update .env file with contract address
    const envPath = path.join(__dirname, '..', '.env');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    let envVarName = '';
    
    switch(config.contractType) {
      case 'marketplace':
        envVarName = 'MARKETPLACE_ADDRESS';
        break;
      case 'single-collection':
        envVarName = 'SINGLE_COLLECTION_ADDRESS';
        break;
      case 'permissioned':
        envVarName = 'PERMISSIONED_ADDRESS';
        break;
    }

    if (envVarName) {
      const regex = new RegExp(`^${envVarName}=.*$`, 'm');
      let newEnvContent = envContent;
      
      if (regex.test(envContent)) {
        newEnvContent = envContent.replace(regex, `${envVarName}=${instantiateResult.contractAddress}`);
      } else {
        newEnvContent = envContent + `\n${envVarName}=${instantiateResult.contractAddress}`;
      }
      
      fs.writeFileSync(envPath, newEnvContent);
      console.log(chalk.green(`\n✓ Updated ${envVarName} in .env file`));
    }

    return {
      codeId: uploadResult.codeId,
      contractAddress: instantiateResult.contractAddress
    };

  } catch (error) {
    console.error(chalk.red('\n❌ Deployment failed:'), error);
    process.exit(1);
  }
}

// Main execution
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const contractType = args[0] || 'marketplace';
  
  let config: DeployConfig;
  
  switch(contractType) {
    case 'marketplace':
      config = {
        contractType: 'marketplace',
        wasmPath: 'artifacts/cw721_marketplace.wasm',
        instantiateMsg: null, // Will be built in deployContract
        label: 'CW721 Open Marketplace'
      };
      break;
    case 'single-collection':
      // Check for NFT collection address argument
      const nftAddress = args[1];
      if (!nftAddress) {
        console.error(chalk.red('Error: NFT collection address required for single-collection marketplace'));
        console.error('Usage: npm run deploy:single-collection <nft-address>');
        process.exit(1);
      }
      config = {
        contractType: 'single-collection',
        wasmPath: 'artifacts/cw721_marketplace_single_collection.wasm',
        instantiateMsg: {
          admin: process.env.ADMIN_ADDRESS || undefined,
          denom: 'uxion',
          fee_percentage: parseInt(process.env.FEE_PERCENTAGE || '2'),
          cw721: nftAddress
        },
        label: 'CW721 Single Collection Marketplace'
      };
      break;
    case 'permissioned':
      // Get NFT collection addresses from remaining arguments
      const collections = args.slice(1);
      if (collections.length === 0) {
        console.error(chalk.red('Error: At least one NFT collection address required'));
        console.error('Usage: npm run deploy:permissioned <nft-address1> [<nft-address2> ...]');
        process.exit(1);
      }
      config = {
        contractType: 'permissioned',
        wasmPath: 'artifacts/cw721_marketplace_permissioned.wasm',
        instantiateMsg: {
          admin: process.env.ADMIN_ADDRESS || undefined,
          denom: 'uxion',
          fee_percentage: parseInt(process.env.FEE_PERCENTAGE || '2'),
          cw721: collections
        },
        label: 'CW721 Permissioned Marketplace'
      };
      break;
    default:
      console.error(chalk.red(`Unknown contract type: ${contractType}`));
      console.error('Valid types: marketplace, single-collection, permissioned');
      process.exit(1);
  }

  await deployContract(config);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

export { deployContract };