import React from 'react';
import { useTokenBalance } from '../hooks/useTokenBalance';
import { useWallet } from '../hooks/useWallet';
import { TOKENS } from '../constants/tokens';

interface TokenBalanceProps {
  tokenSymbol: 'ETH' | 'USDC';
}

const TokenBalance: React.FC<TokenBalanceProps> = ({ tokenSymbol }) => {
  const { isConnected } = useWallet();
  const token = TOKENS[tokenSymbol];
  
  const { formattedBalance, loading, error, refetch } = useTokenBalance(
    token.address,
    token.decimals
  );

  // Skeleton loading animation style
  const skeletonStyle = {
    backgroundColor: '#e5e7eb',
    borderRadius: '0.25rem',
    display: 'inline-block',
    width: '80px',
    height: '24px',
    animation: 'pulse 1.5s ease-in-out infinite',
  };

  if (!isConnected) {
    return (
      <div style={{ 
        padding: '1rem', 
        backgroundColor: '#f9fafb', 
        borderRadius: '0.5rem',
        border: '1px solid #e5e7eb',
        textAlign: 'center',
        marginBottom: '1rem'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <img 
              src={token.logoURI} 
              alt={token.symbol} 
              style={{ width: '24px', height: '24px', borderRadius: '50%' }} 
            />
            <span style={{ fontWeight: 500 }}>{token.symbol}</span>
          </div>
          <div style={{ color: '#6b7280' }}>Connect wallet to view balance</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '1rem', 
      backgroundColor: '#f9fafb', 
      borderRadius: '0.5rem',
      border: '1px solid #e5e7eb',
      marginBottom: '1rem'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <img 
            src={token.logoURI} 
            alt={token.symbol} 
            style={{ width: '24px', height: '24px', borderRadius: '50%' }} 
          />
          <span style={{ fontWeight: 500 }}>{token.symbol}</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {loading ? (
            <div style={skeletonStyle}></div>
          ) : error ? (
            <div style={{ color: '#ef4444', fontSize: '0.875rem' }}>Error loading balance</div>
          ) : (
            <div style={{ fontWeight: 500 }}>{formattedBalance} {token.symbol}</div>
          )}
          
          <button 
            onClick={refetch}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              padding: '0.25rem',
              borderRadius: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Refresh balance"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
          </button>
        </div>
      </div>
      
      {error && (
        <div style={{ 
          marginTop: '0.5rem', 
          color: '#ef4444', 
          fontSize: '0.75rem' 
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default TokenBalance;
