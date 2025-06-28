import React from 'react';
import { useWallet } from '../hooks/useWallet';

const WalletConnect: React.FC = () => {
  const { account, isConnected, isConnecting, connectWallet, disconnectWallet, error } = useWallet();

  // Format address for display (0x1234...5678)
  const formatAddress = (address: string): string => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {error && (
        <div style={{ 
          backgroundColor: '#fee2e2', 
          border: '1px solid #fecaca', 
          color: '#ef4444', 
          padding: '0.75rem 1rem', 
          borderRadius: '0.375rem', 
          marginBottom: '1rem',
          maxWidth: '400px'
        }}>
          <p>{error}</p>
        </div>
      )}

      {isConnected ? (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: '1rem' 
        }}>
          <div style={{ 
            backgroundColor: '#dbeafe', 
            color: '#1e40af', 
            padding: '0.5rem 1rem', 
            borderRadius: '9999px', 
            fontWeight: '500' 
          }}>
            {formatAddress(account || '')}
          </div>
          <button
            onClick={disconnectWallet}
            style={{
              backgroundColor: '#ef4444',
              color: 'white',
              fontWeight: 'bold',
              padding: '0.5rem 1.5rem',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          onClick={connectWallet}
          disabled={isConnecting}
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            fontWeight: 'bold',
            padding: '0.75rem 2rem',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: isConnecting ? 'not-allowed' : 'pointer',
            opacity: isConnecting ? 0.7 : 1,
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => !isConnecting && (e.currentTarget.style.backgroundColor = '#2563eb')}
          onMouseOut={(e) => !isConnecting && (e.currentTarget.style.backgroundColor = '#3b82f6')}
        >
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      )}
    </div>
  );
};

export default WalletConnect;
