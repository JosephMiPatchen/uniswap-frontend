import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { ethers } from 'ethers';
import { ETHEREUM_MAINNET_CHAIN_ID } from '../constants/tokens';

// Default Ethereum RPC URL for fallback
const ETHEREUM_RPC_URL = 'https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161';

interface WalletContextType {
  provider: ethers.providers.Provider | null;
  signer: ethers.Signer | null;
  account: string | null;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

export const WalletContext = createContext<WalletContextType>({
  provider: null,
  signer: null,
  account: null,
  chainId: null,
  isConnected: false,
  isConnecting: false,
  error: null,
  connectWallet: async () => {},
  disconnectWallet: () => {},
});

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [provider, setProvider] = useState<ethers.providers.Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Check if any Ethereum provider is available
  const isWalletAvailable = useCallback((): boolean => {
    return (
      typeof window !== 'undefined' &&
      typeof window.ethereum !== 'undefined'
    );
  }, []);

  // Connect to wallet
  const connectWallet = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      if (!isWalletAvailable()) {
        throw new Error('Ethereum wallet is not installed. Please install an Ethereum wallet extension.');
      }

      if (!window.ethereum) {
        throw new Error('Ethereum provider not found');
      }

      // Debug wallet provider
      console.log('Wallet provider:', window.ethereum);
      if (window.ethereum.networkVersion) {
        console.log('Current network version:', window.ethereum.networkVersion);
      }
      
      // Try to ensure we're on Ethereum network
      try {
        // Request to switch to Ethereum Mainnet first
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${ETHEREUM_MAINNET_CHAIN_ID.toString(16)}` }],
        });
      } catch (switchError: any) {
        console.log('Error switching to Ethereum:', switchError);
        // Continue anyway, we'll check network later
      }

      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const account = accounts[0];
      
      // Create ethers provider
      let provider;
      try {
        provider = new ethers.providers.Web3Provider(window.ethereum as ethers.providers.ExternalProvider);
      } catch (error) {
        console.error('Error creating Web3Provider, falling back to JsonRpcProvider:', error);
        provider = new ethers.providers.JsonRpcProvider(ETHEREUM_RPC_URL);
      }
      const signer = provider.getSigner();
      
      // Get network
      const network = await provider.getNetwork();
      const chainId = network.chainId;
      
      // Check if we're on Ethereum Mainnet
      if (chainId !== ETHEREUM_MAINNET_CHAIN_ID) {
        try {
          // Try to switch to Ethereum Mainnet
          if (!window.ethereum) throw new Error('Ethereum provider not found');
          
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${ETHEREUM_MAINNET_CHAIN_ID.toString(16)}` }],
          });
          
          // Get updated network after switch
          const updatedNetwork = await provider.getNetwork();
          setChainId(updatedNetwork.chainId);
        } catch (switchError: any) {
          // This error code indicates that the chain has not been added to Trust Wallet
          if (switchError.code === 4902) {
            throw new Error('Please add Ethereum Mainnet to your Trust Wallet');
          } else {
            throw new Error(`Failed to switch to Ethereum Mainnet: ${switchError.message}`);
          }
        }
      } else {
        setChainId(chainId);
      }

      setProvider(provider);
      setSigner(signer);
      setAccount(account);
      setIsConnected(true);
      
      // Store connection in local storage
      localStorage.setItem('walletConnected', 'true');
    } catch (err: any) {
      console.error('Connection error:', err);
      setError(err.message || 'Failed to connect to Trust Wallet');
      setIsConnected(false);
      setAccount(null);
      setProvider(null);
      setSigner(null);
      setChainId(null);
      localStorage.removeItem('walletConnected');
    } finally {
      setIsConnecting(false);
    }
  }, [isWalletAvailable]);

  // Disconnect wallet
  const disconnectWallet = useCallback(() => {
    setIsConnected(false);
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
    localStorage.removeItem('walletConnected');
  }, []);

  // Handle account changes
  const handleAccountsChanged = useCallback((accounts: string[]) => {
    if (accounts.length === 0) {
      // User disconnected their wallet
      disconnectWallet();
    } else {
      // Account changed
      setAccount(accounts[0]);
    }
  }, [disconnectWallet]);

  // Handle chain changes
  const handleChainChanged = useCallback((chainIdHex: string) => {
    const newChainId = parseInt(chainIdHex, 16);
    setChainId(newChainId);
    
    // Refresh provider on chain change
    if (window.ethereum) {
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum as ethers.providers.ExternalProvider);
        setProvider(provider);
        setSigner(provider.getSigner());
      } catch (error) {
        console.error('Error creating Web3Provider on chain change, falling back to JsonRpcProvider:', error);
        const fallbackProvider = new ethers.providers.JsonRpcProvider(ETHEREUM_RPC_URL);
        setProvider(fallbackProvider);
        // We can't get a signer from JsonRpcProvider without a private key
        // For read-only operations this is fine
        setSigner(null);
      }
    }
    
    // Check if we're on Ethereum Mainnet
    if (newChainId !== ETHEREUM_MAINNET_CHAIN_ID) {
      setError('Please switch to Ethereum Mainnet');
    } else {
      setError(null);
    }
  }, []);

  // Auto-connect if previously connected
  useEffect(() => {
    const wasConnected = localStorage.getItem('walletConnected') === 'true';
    
    if (wasConnected && isWalletAvailable()) {
      connectWallet();
    }
  }, [connectWallet, isWalletAvailable]);

  // Set up event listeners
  useEffect(() => {
    const ethereum = window.ethereum;
    
    if (ethereum) {
      // Listen for account changes
      ethereum.on('accountsChanged', handleAccountsChanged);
      
      // Listen for chain changes
      ethereum.on('chainChanged', handleChainChanged);
      
      // Listen for disconnect
      ethereum.on('disconnect', disconnectWallet);
      
      // Clean up listeners
      return () => {
        ethereum.removeListener('accountsChanged', handleAccountsChanged);
        ethereum.removeListener('chainChanged', handleChainChanged);
        ethereum.removeListener('disconnect', disconnectWallet);
      };
    }
    
    return undefined;
  }, [handleAccountsChanged, handleChainChanged, disconnectWallet]);

  const value = {
    provider,
    signer,
    account,
    chainId,
    isConnected,
    isConnecting,
    error,
    connectWallet,
    disconnectWallet,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};
