import { ethers } from 'ethers';

/**
 * Format an Ethereum address to a shortened form (e.g., 0x1234...5678)
 * @param address The Ethereum address to format
 * @param start Number of characters to show at the start
 * @param end Number of characters to show at the end
 * @returns Formatted address string
 */
export const formatAddress = (address: string, start = 6, end = 4): string => {
  if (!address || !ethers.utils.isAddress(address)) return '';
  return `${address.substring(0, start)}...${address.substring(address.length - end)}`;
};

/**
 * Format a token amount with proper decimals
 * @param amount The amount in wei or smallest unit
 * @param decimals The number of decimals for the token
 * @param displayDecimals Number of decimals to display
 * @returns Formatted amount string
 */
export const formatTokenAmount = (
  amount: ethers.BigNumberish,
  decimals = 18,
  displayDecimals = 4
): string => {
  if (!amount) return '0';
  
  try {
    const formattedAmount = ethers.utils.formatUnits(amount, decimals);
    
    // Parse to float and fix to displayDecimals
    const parsed = parseFloat(formattedAmount);
    
    // Handle very small numbers that would show as 0
    if (parsed > 0 && parsed < 0.0001) {
      return '< 0.0001';
    }
    
    return parsed.toFixed(displayDecimals);
  } catch (error) {
    console.error('Error formatting token amount:', error);
    return '0';
  }
};

/**
 * Format a USD value
 * @param value The USD value to format
 * @param includeSymbol Whether to include the $ symbol
 * @returns Formatted USD string
 */
export const formatUSD = (value: number, includeSymbol = true): string => {
  if (value === undefined || value === null) return includeSymbol ? '$0.00' : '0.00';
  
  // Handle very small values
  if (value > 0 && value < 0.01) {
    return includeSymbol ? '< $0.01' : '< 0.01';
  }
  
  const formatter = new Intl.NumberFormat('en-US', {
    style: includeSymbol ? 'currency' : 'decimal',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  return formatter.format(value);
};

/**
 * Format a percentage value
 * @param value The percentage value (e.g., 0.05 for 5%)
 * @param includeSymbol Whether to include the % symbol
 * @returns Formatted percentage string
 */
export const formatPercent = (value: number, includeSymbol = true): string => {
  if (value === undefined || value === null) return includeSymbol ? '0%' : '0';
  
  const percentage = value * 100;
  const formatted = percentage.toFixed(2);
  
  // Remove trailing zeros and decimal point if not needed
  const trimmed = formatted.replace(/\.?0+$/, '');
  
  return includeSymbol ? `${trimmed}%` : trimmed;
};
