import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './useWallet';
import { ERC20_ABI, TOKENS } from '../constants/tokens';

interface TokenBalanceResult {
  balance: string;
  formattedBalance: string;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  usdValue: string;
}

/**
 * Hook to fetch token balance for a specific token
 * @param tokenAddress The token address to fetch balance for
 * @param decimals The number of decimals for the token
 * @returns TokenBalanceResult with balance info and refetch function
 */
export const useTokenBalance = (
  tokenAddress: string,
  decimals: number = 18
): TokenBalanceResult => {
  const { account, provider, isConnected } = useWallet();
  const [balance, setBalance] = useState<string>('0');
  const [formattedBalance, setFormattedBalance] = useState<string>('0');
  const [usdValue, setUsdValue] = useState<string>('0.00');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch the token balance
  const fetchBalance = useCallback(async () => {
    if (!provider || !account) {
      setBalance('0');
      setFormattedBalance('0');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Debug provider info
      console.log('Provider in useTokenBalance:', provider);
      console.log('Provider type:', provider.constructor.name);
      
      // Check if we're dealing with a Web3Provider or JsonRpcProvider
      if ('provider' in provider) {
        const web3Provider = provider as ethers.providers.Web3Provider;
        console.log('Web3Provider connection info:', web3Provider.provider);
      } else if ('connection' in provider) {
        const jsonRpcProvider = provider as ethers.providers.JsonRpcProvider;
        console.log('JsonRpcProvider connection info:', jsonRpcProvider.connection);
      }
      
      let rawBalance: ethers.BigNumber;

      // Try to use a fallback provider if needed
      let activeProvider = provider;
      try {
        // Test if the provider is working by getting the network
        await provider.getNetwork();
      } catch (networkError) {
        console.error('Provider network error:', networkError);
        console.log('Falling back to Infura provider');
        activeProvider = new ethers.providers.JsonRpcProvider('https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161');
      }

      // Handle ETH balance differently than ERC20 tokens
      if (tokenAddress === 'ETH' || tokenAddress === TOKENS.ETH.address) {
        rawBalance = await activeProvider.getBalance(account);
      } else {
        // For ERC20 tokens
        const tokenContract = new ethers.Contract(
          tokenAddress,
          ERC20_ABI,
          activeProvider
        );
        rawBalance = await tokenContract.balanceOf(account);
      }

      // Set raw balance as string
      setBalance(rawBalance.toString());

      // Format the balance with proper decimals
      const formatted = ethers.utils.formatUnits(rawBalance, decimals);
      
      // Format to 4 decimal places for display
      const parsedBalance = parseFloat(formatted);
      const displayBalance = parsedBalance < 0.0001 && parsedBalance > 0
        ? '< 0.0001'
        : parsedBalance.toFixed(4);
        
      setFormattedBalance(displayBalance);
      
      // Calculate USD value (mock values for demo)
      let tokenPrice = 0;
      if (tokenAddress === 'ETH' || tokenAddress === TOKENS.ETH.address) {
        tokenPrice = 3500; // Mock ETH price in USD
      } else if (tokenAddress === TOKENS.USDC.address) {
        tokenPrice = 1.0; // USDC is a stablecoin
      }
      
      const calculatedUsdValue = (parsedBalance * tokenPrice).toFixed(2);
      setUsdValue(calculatedUsdValue);
    } catch (err: any) {
      console.error('Error fetching token balance:', err);
      setError(`Failed to fetch balance: ${err.message || 'Unknown error'}`);
      setBalance('0');
      setFormattedBalance('0');
    } finally {
      setLoading(false);
    }
  }, [account, provider, tokenAddress, decimals, isConnected]);

  // Fetch balance when dependencies change
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return {
    balance,
    formattedBalance,
    loading,
    error,
    refetch: fetchBalance,
    usdValue
  };
};
