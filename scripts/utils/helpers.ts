import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { networkConfig, walletConfig, validateConfig } from './config';
import chalk from 'chalk';

// Create a signing client
export async function createSigningClient(): Promise<{
  client: SigningCosmWasmClient;
  address: string;
}> {
  validateConfig();
  
  if (!walletConfig.mnemonic) {
    throw new Error('MNEMONIC not set in environment');
  }

  // Create wallet from mnemonic
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(
    walletConfig.mnemonic,
    {
      prefix: networkConfig.prefix,
    }
  );

  // Get the first account
  const [account] = await wallet.getAccounts();

  // Create signing client
  const client = await SigningCosmWasmClient.connectWithSigner(
    networkConfig.rpcUrl,
    wallet,
    {
      gasPrice: networkConfig.gasPrice,
    }
  );

  return {
    client,
    address: account.address,
  };
}

// Query contract
export async function queryContract<T = any>(
  contractAddress: string,
  query: any
): Promise<T> {
  const client = await SigningCosmWasmClient.connect(networkConfig.rpcUrl);
  return client.queryContractSmart(contractAddress, query);
}

// Execute contract
export async function executeContract(
  contractAddress: string,
  msg: any,
  funds: any[] = []
): Promise<any> {
  const { client, address } = await createSigningClient();
  
  console.log(chalk.blue('Executing transaction...'));
  console.log('Contract:', contractAddress);
  console.log('Sender:', address);
  console.log('Message:', JSON.stringify(msg, null, 2));
  if (funds.length > 0) {
    console.log('Funds:', JSON.stringify(funds, null, 2));
  }

  try {
    const result = await client.execute(
      address,
      contractAddress,
      msg,
      'auto',
      '',
      funds
    );

    console.log(chalk.green('✓ Transaction successful!'));
    console.log('Transaction hash:', result.transactionHash);
    console.log('Gas used:', result.gasUsed);
    
    return result;
  } catch (error: any) {
    console.error(chalk.red('✗ Transaction failed:'), error.message);
    throw error;
  }
}

// Format XION amount for display
export function formatXion(amount: string): string {
  const xion = parseInt(amount) / 1_000_000;
  return `${xion.toFixed(6)} XION`;
}

// Parse XION amount from string
export function parseXion(amount: string): string {
  const xion = parseFloat(amount);
  return Math.floor(xion * 1_000_000).toString();
}

// Create expiration at height
export function expirationAtHeight(height: number): any {
  return {
    at_height: height,
  };
}

// Create expiration at time (timestamp in seconds)
export function expirationAtTime(seconds: number): any {
  return {
    at_time: (seconds * 1_000_000_000).toString(), // Convert to nanoseconds
  };
}

// Create expiration after N blocks from current
export async function expirationAfterBlocks(blocks: number): Promise<any> {
  const client = await SigningCosmWasmClient.connect(networkConfig.rpcUrl);
  const height = await client.getHeight();
  return expirationAtHeight(height + blocks);
}

// Create expiration after N hours from now
export function expirationAfterHours(hours: number): any {
  const seconds = Math.floor(Date.now() / 1000) + (hours * 3600);
  return expirationAtTime(seconds);
}

// Format address for display
export function formatAddress(address: string, length: number = 8): string {
  if (address.length <= length * 2) return address;
  return `${address.slice(0, length)}...${address.slice(-length)}`;
}

// Parse command line price (handles both XION and uxion)
export function parsePrice(price: string): string {
  if (price.toLowerCase().includes('xion')) {
    // Remove 'xion' and parse as XION
    const amount = parseFloat(price.replace(/xion/gi, '').trim());
    return parseXion(amount.toString());
  } else if (price.toLowerCase().includes('uxion')) {
    // Remove 'uxion' and return as is
    return price.replace(/uxion/gi, '').trim();
  } else {
    // Assume it's in XION if no unit specified
    return parseXion(price);
  }
}

// Display transaction result
export function displayTxResult(result: any): void {
  console.log(chalk.green('━'.repeat(50)));
  console.log(chalk.green('Transaction Successful!'));
  console.log(chalk.green('━'.repeat(50)));
  console.log('Transaction Hash:', chalk.yellow(result.transactionHash));
  console.log('Block Height:', result.height);
  console.log('Gas Used:', result.gasUsed);
  
  // Parse events
  if (result.events && result.events.length > 0) {
    console.log('\nEvents:');
    result.events.forEach((event: any) => {
      if (event.type === 'wasm') {
        console.log(`  ${chalk.cyan(event.type)}:`);
        event.attributes.forEach((attr: any) => {
          console.log(`    ${attr.key}: ${chalk.white(attr.value)}`);
        });
      }
    });
  }
}

// Sleep for milliseconds
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry function for network requests
export async function retry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    console.log(chalk.yellow(`Retrying... (${retries} attempts left)`));
    await sleep(delay);
    return retry(fn, retries - 1, delay * 2);
  }
}