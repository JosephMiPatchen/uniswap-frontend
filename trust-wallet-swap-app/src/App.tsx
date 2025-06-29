import React from 'react';
import './App.css';
import { WalletProvider } from './contexts/WalletContext';
import WalletConnect from './components/WalletConnect';
import { useWallet } from './hooks/useWallet';
import SwapForm from './components/SwapForm';
import { useTokenBalance } from './hooks/useTokenBalance';
import { TOKENS } from './constants/tokens';

// Token display component for the side panels
const TokenPanel: React.FC<{
  tokenSymbol: string;
  className: string;
  titleClassName: string;
}> = ({ tokenSymbol, className, titleClassName }) => {
  const { account } = useWallet();
  const tokenAddress = tokenSymbol === 'ETH' ? 'ETH' : TOKENS.USDC.address;
  const decimals = tokenSymbol === 'ETH' ? 18 : TOKENS.USDC.decimals;
  const { balance, formattedBalance, usdValue } = useTokenBalance(tokenAddress, decimals);
  
  const logoSrc = tokenSymbol === 'ETH' 
    ? 'https://upload.wikimedia.org/wikipedia/commons/0/05/Ethereum_logo_2014.svg'
    : 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Circle_USDC_Logo.svg';
  
  return (
    <div className={className}>
      <h2 className={`card-title ${titleClassName}`}>{tokenSymbol}</h2>
      <div className="token-balance-container" data-token={tokenSymbol}>
        <img src={logoSrc} alt={`${tokenSymbol} logo`} className="token-logo" />
        <div className="token-amount">{formattedBalance}</div>
        <div className="token-value">${usdValue}</div>
      </div>
    </div>
  );
};

// Wallet Connect Panel
const WalletPanel: React.FC = () => {
  const { isConnected, account } = useWallet();
  
  return (
    <div className="wallet-panel">
      <WalletConnect />
      {isConnected && account && (
        <div className="wallet-address">
          {account.substring(0, 6)}...{account.substring(account.length - 4)}
        </div>
      )}
    </div>
  );
};

// Main App component that uses the wallet connection state
const AppContent = () => {
  const { isConnected } = useWallet();
  
  return (
    <>
      {/* Grid overlay and scan lines for cyberpunk effect */}
      <div className="grid-overlay"></div>
      <div className="scan-lines"></div>
      
      <div className="app-container">
        <header className="app-header">
          <h1 className="app-title">CYBER SWAP</h1>
          <p className="app-subtitle">ETH ⟷ USDC | ETHEREUM MAINNET</p>
          <WalletPanel />
        </header>

        {isConnected ? (
          <div className="main-content">
            {/* Left panel - USDC with light blue glow */}
            <TokenPanel 
              tokenSymbol="USDC" 
              className="token-card-left" 
              titleClassName="card-title-usdc"
            />
            
            {/* Middle panel - Swap form with pink glow */}
            <div className="swap-card-middle">
              <h2 className="card-title card-title-swap">SWAP</h2>
              <SwapForm />
            </div>
            
            {/* Right panel - ETH with dark blue glow */}
            <TokenPanel 
              tokenSymbol="ETH" 
              className="token-card-right" 
              titleClassName="card-title-eth"
            />
          </div>
        ) : (
          <div className="connect-prompt swap-card-middle">
            <h2 className="card-title card-title-swap">CONNECT WALLET</h2>
            <p>Connect your wallet to access the cyberpunk swap interface</p>
          </div>
        )}

        <footer className="app-footer">
          <p>POWERED BY UNISWAP V3 | ETHEREUM MAINNET</p>
          <p>⚠️ USE AT YOUR OWN RISK ⚠️</p>
        </footer>
      </div>
    </>
  );
};

// Root App component that provides the wallet context
function App() {
  return (
    <WalletProvider>
      <AppContent />
    </WalletProvider>
  );
}

export default App;
