import React from 'react';
import './App.css';
import { WalletProvider } from './contexts/WalletContext';
import WalletConnect from './components/WalletConnect';
import TokenBalance from './components/TokenBalance';
import { useWallet } from './hooks/useWallet';

// Card component for reusability
const Card: React.FC<{
  children: React.ReactNode;
  title?: string;
  className?: string;
}> = ({ children, title, className }) => {
  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        marginBottom: '1.5rem',
      }}
      className={className}
    >
      {title && (
        <h2
          style={{
            fontSize: '1.25rem',
            fontWeight: 'bold',
            marginBottom: '1rem',
            color: '#1f2937',
          }}
        >
          {title}
        </h2>
      )}
      {children}
    </div>
  );
};

// Main content component
const MainContent: React.FC = () => {
  const { isConnected } = useWallet();

  return (
    <>
      <Card title="Wallet">
        <WalletConnect />
      </Card>

      <Card title="Token Balances">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <TokenBalance tokenSymbol="ETH" />
          <TokenBalance tokenSymbol="USDT" />
        </div>
      </Card>

      {isConnected ? (
        <Card title="Swap">
          <p style={{ textAlign: 'center', color: '#6b7280' }}>
            Swap functionality will be implemented next.
          </p>
        </Card>
      ) : (
        <Card>
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <p style={{ color: '#6b7280', marginBottom: '0.5rem' }}>
              Connect your wallet to view balances and access swap functionality.
            </p>
          </div>
        </Card>
      )}
    </>
  );
};

function App() {
  return (
    <WalletProvider>
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#f3f4f6',
          padding: '2rem 1rem',
        }}
      >
        <div
          style={{
            maxWidth: '600px',
            margin: '0 auto',
          }}
        >
          <header
            style={{
              textAlign: 'center',
              marginBottom: '2rem',
            }}
          >
            <h1
              style={{
                fontSize: '2rem',
                fontWeight: 'bold',
                color: '#333',
                marginBottom: '0.5rem',
              }}
            >
              Ethereum Swap App
            </h1>
            <p style={{ color: '#6b7280' }}>
              Connect your wallet and swap USDT for ETH
            </p>
          </header>

          <MainContent />

          <footer
            style={{
              marginTop: '3rem',
              textAlign: 'center',
              color: '#6b7280',
              fontSize: '0.875rem',
            }}
          >
            <p>This app connects to Ethereum wallets and uses Uniswap for swaps</p>
            <p style={{ marginTop: '0.25rem' }}>⚠️ For demonstration purposes only ⚠️</p>
          </footer>
        </div>
      </div>
    </WalletProvider>
  );
}

export default App;
