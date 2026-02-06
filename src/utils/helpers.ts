import { ethers } from 'ethers';
import { TransactionDetails } from '../types/events.js';

// Helper function to format BNB value
export function formatBNB(value: ethers.BigNumberish): string {
  return ethers.formatEther(value);
}

// Helper function to format token amount
export function formatToken(value: ethers.BigNumberish, decimals: number = 18): string {
  return ethers.formatUnits(value, decimals);
}

// Generate random transaction hash
export function generateTransactionHash(): string {
  return `0x${Math.random().toString(16).substr(2, 64)}`;
}

// Generate current timestamp for Kafka
export function generateKafkaTimestamp(): string {
  return new Date().toISOString();
}

// Sleep utility for delays
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Calculate exponential backoff delay
export function calculateBackoffDelay(attempt: number, baseDelay: number = 1000, maxDelay: number = 30000): number {
  return Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
}

// Create a standardized log message
export function createLogMessage(eventType: string, data: any, additionalInfo?: string): string {
  const timestamp = new Date().toISOString();
  const message = `${timestamp} [${eventType}] ${JSON.stringify(data, null, 2)}`;

  if (additionalInfo) {
    return `${message} - ${additionalInfo}`;
  }

  return message;
}

// Calculate market cap from price and supply
export function calculateMarketCap(price: number, supply: number): number {
  return price * supply;
}