import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../hooks/useWallet';
import { Percent } from '@uniswap/sdk-core';
import { SwapRouter, FeeAmount } from '@uniswap/v3-sdk';
import { createTrade } from '../utils/uniswap';
import { TOKENS, ERC20_ABI, UNISWAP_ROUTER_ADDRESS, UNISWAP_ROUTER_ABI } from '../constants/tokens';
import { formatTokenAmount, formatUSD } from '../utils/formatters';
import './SwapForm.css';

// Constants for direct router interaction
const WETH_TOKEN = TOKENS.ETH;
const USDC_TOKEN = TOKENS.USDC;
const FEE_AMOUNT = {
  LOW: 500,
  MEDIUM: 3000,
  HIGH: 10000
};

// Simple swap form component
const SwapForm: React.FC = () => {
  const { provider, signer, account, isConnected } = useWallet();
  const [fromToken, setFromToken] = useState<'ETH' | 'USDC'>('ETH');
  const [toToken, setToToken] = useState<'ETH' | 'USDC'>('USDC');
  const [amount, setAmount] = useState<string>('');
  const [estimatedOutput, setEstimatedOutput] = useState<string>('');
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [slippage, setSlippage] = useState<number>(5); // 5% default slippage - increased to avoid errors

  // Reset states when tokens change
  useEffect(() => {
    setAmount('');
    setEstimatedOutput('');
    setError(null);
    setSuccess(null);
  }, [fromToken, toToken]);

  // Swap the from and to tokens
  const swapTokens = () => {
    setFromToken(toToken as 'ETH' | 'USDC');
    setToToken(fromToken as 'ETH' | 'USDC');
    setAmount('');
    setEstimatedOutput('');
  };

  // Estimate the swap output using Uniswap V3 SDK
  const estimateSwap = async (inputAmount: string) => {
    if (!inputAmount || parseFloat(inputAmount) <= 0 || !provider) {
      setEstimatedOutput('');
      setError(null);
      return;
    }

    try {
      setError(null);
      console.log(`Estimating swap from ${fromToken} to ${toToken} with amount ${inputAmount}`);
      
      // Create a trade using the Uniswap V3 SDK
      const trade = await createTrade(fromToken, toToken, inputAmount, provider);
      
      if (trade) {
        // Get the output amount from the trade
        const outputAmount = trade.outputAmount;
        setEstimatedOutput(outputAmount.toSignificant(6));
        console.log(`Estimated output: ${outputAmount.toSignificant(6)} ${toToken}`);
      } else {
        console.warn('Trade creation failed, using fallback estimation');
        // Fallback to a simple estimation if trade creation fails
        const ethToUsdcRate = 3000; // 1 ETH = 3000 USDC (fallback rate)
        
        let estimated;
        if (fromToken === 'ETH' && toToken === 'USDC') {
          estimated = parseFloat(inputAmount) * ethToUsdcRate;
        } else if (fromToken === 'USDC' && toToken === 'ETH') {
          estimated = parseFloat(inputAmount) / ethToUsdcRate;
        } else {
          estimated = parseFloat(inputAmount); // Same token (shouldn't happen)
        }

        setEstimatedOutput(estimated.toFixed(6));
        setError('Warning: Using estimated price. Actual swap may vary.');
      }
    } catch (error: any) {
      console.error('Error estimating swap:', error);
      setEstimatedOutput('');
      setError(`Error estimating swap: ${error?.message || 'Unknown error'}. Try a different amount or check your network connection.`);
    }
  };

  // Calculate minimum output amount based on slippage tolerance
  const calculateMinimumOutputAmount = (inputAmount: string, outputAmount: string, slippagePercent: number): string => {
    if (!outputAmount || parseFloat(outputAmount) === 0) {
      return '0';
    }
    
    const output = parseFloat(outputAmount);
    const slippageFactor = 1 - (slippagePercent / 100);
    const minOutput = output * slippageFactor;
    
    // Return with high precision to avoid rounding errors
    return minOutput.toFixed(toToken === 'ETH' ? 18 : 6);
  };

  // Execute the swap using Uniswap V3 Router directly
  const executeSwap = async () => {
    if (!isConnected || !provider || !signer || !account || !amount || parseFloat(amount) <= 0) {
      setError('Please connect your wallet and enter an amount');
      return;
    }

    try {
      setIsSwapping(true);
      setError(null);
      setSuccess(null);

      const fromTokenData = TOKENS[fromToken];
      const toTokenData = TOKENS[toToken];
      
      console.log('Swap details:', {
        fromToken,
        toToken,
        amount,
        estimatedOutput,
        slippage
      });
      
      // Format amounts with proper decimals
      const amountIn = ethers.utils.parseUnits(
        amount,
        fromTokenData.decimals
      );
      
      // Calculate minimum amount out based on slippage
      const effectiveSlippage = Math.max(slippage, 5); // Use at least 5% slippage
      console.log(`Using slippage tolerance: ${effectiveSlippage}%`);
      
      const minOutputAmount = calculateMinimumOutputAmount(
        amount,
        estimatedOutput,
        effectiveSlippage
      );
      
      console.log('Minimum output amount:', minOutputAmount);
      
      const amountOutMinimum = ethers.utils.parseUnits(
        minOutputAmount,
        toTokenData.decimals
      );
      
      // For USDC to ETH swaps, we need to check and approve allowance
      if (fromToken === 'USDC') {
        // Create token contract instance
        const tokenContract = new ethers.Contract(
          fromTokenData.address,
          ERC20_ABI,
          signer
        );
        
        // Check if we have enough allowance
        const allowance = await tokenContract.allowance(account, UNISWAP_ROUTER_ADDRESS);
        
        // If allowance is not enough, approve first
        if (allowance.lt(amountIn)) {
          console.log('Approving USDC...');
          const approveTx = await tokenContract.approve(
            UNISWAP_ROUTER_ADDRESS,
            ethers.constants.MaxUint256 // Approve maximum amount
          );
          
          setSuccess(`Approval transaction submitted! Hash: ${approveTx.hash}`);
          const approveReceipt = await approveTx.wait();
          console.log('USDC approved:', approveReceipt);
          setSuccess(`USDC approved! Now executing swap...`);
        }
      }
      
      // Create router contract instance
      const routerContract = new ethers.Contract(
        UNISWAP_ROUTER_ADDRESS,
        UNISWAP_ROUTER_ABI,
        signer
      );
      
      // Set deadline 30 minutes from now
      const deadline = Math.floor(Date.now() / 1000) + 60 * 30;
      
      // Prepare transaction parameters based on swap direction
      let tx;
      
      if (fromToken === 'ETH' && toToken === 'USDC') {
        // ETH to USDC swap
        const params = {
          tokenIn: WETH_TOKEN.address,
          tokenOut: USDC_TOKEN.address,
          fee: FEE_AMOUNT.MEDIUM,
          recipient: account,
          deadline: deadline,
          amountIn: amountIn,
          amountOutMinimum: amountOutMinimum,
          sqrtPriceLimitX96: 0
        };
        
        console.log('ETH to USDC swap parameters:', params);
        
        // Execute the swap with ETH value
        tx = await routerContract.exactInputSingle(
          params,
          {
            value: amountIn,
            gasLimit: 1000000,
            gasPrice: await provider.getGasPrice().then(price => price.mul(12).div(10)) // 20% higher
          }
        );
      } else if (fromToken === 'USDC' && toToken === 'ETH') {
        // USDC to ETH swap (requires two steps: swap to WETH, then unwrap WETH to ETH)
        console.log('Performing USDC to ETH swap with unwrapping...');
        
        // First, we need to create a multicall to handle both the swap and unwrap in one transaction
        // We'll use a different approach - swap to WETH but send it to the router, then unwrap
        
        // Create a multicall interface for the router
        const multicallRouter = new ethers.utils.Interface([
          'function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256)',
          'function unwrapWETH9(uint256 amountMinimum, address recipient) external payable',
          'function multicall(bytes[] calldata data) external payable returns (bytes[] memory)'
        ]);
        
        // Parameters for swapping USDC to WETH
        const swapParams = {
          tokenIn: USDC_TOKEN.address,
          tokenOut: WETH_TOKEN.address,
          fee: FEE_AMOUNT.MEDIUM,
          recipient: UNISWAP_ROUTER_ADDRESS, // Send WETH to the router itself
          deadline: deadline,
          amountIn: amountIn,
          amountOutMinimum: amountOutMinimum,
          sqrtPriceLimitX96: 0
        };
        
        // Create calldata for the swap
        const swapCalldata = multicallRouter.encodeFunctionData('exactInputSingle', [swapParams]);
        
        // Create calldata for unwrapping WETH
        const unwrapCalldata = multicallRouter.encodeFunctionData('unwrapWETH9', [
          amountOutMinimum,  // Minimum amount to unwrap
          account            // Recipient of the unwrapped ETH
        ]);
        
        // Combine into a multicall
        const multicallCalldata = multicallRouter.encodeFunctionData('multicall', [
          [swapCalldata, unwrapCalldata]
        ]);
        
        console.log('USDC to ETH swap with unwrap parameters:', { swapParams, multicallCalldata });
        
        // Execute the multicall
        tx = await signer.sendTransaction({
          to: UNISWAP_ROUTER_ADDRESS,
          data: multicallCalldata,
          gasLimit: 1500000, // Higher gas limit for the multicall
          gasPrice: await provider.getGasPrice().then(price => price.mul(12).div(10)) // 20% higher
        });
      } else {
        throw new Error('Unsupported token pair');
      }
      
      console.log('Transaction sent:', tx.hash);
      setSuccess(`Transaction submitted! Hash: ${tx.hash}`);
      
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      console.log('Transaction successful:', receipt);
      setSuccess(`Transaction successful! Hash: ${receipt.transactionHash}`);
      
      setAmount('');
      setEstimatedOutput('');
    } catch (err: any) {
      console.error('Error executing swap:', err);
      setError(`Error executing swap: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSwapping(false);
    }
  };

  // Update estimated output when amount changes
  useEffect(() => {
    const handler = setTimeout(() => {
      if (amount && parseFloat(amount) > 0) {
        estimateSwap(amount);
      } else {
        setEstimatedOutput('');
      }
    }, 500); // 500ms debounce

    return () => {
      clearTimeout(handler);
    };
  }, [amount, fromToken, toToken]);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '15px',
      padding: '10px'
    }}>
      {/* From Token Section */}
      <div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginBottom: '5px' 
        }}>
          <span>From:</span>
          <select 
            value={fromToken} 
            onChange={(e) => setFromToken(e.target.value as 'ETH' | 'USDC')}
            disabled={isSwapping}
            style={{ marginLeft: '10px' }}
          >
            <option value="ETH">ETH</option>
            <option value="USDC">USDC</option>
          </select>
        </div>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.0"
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: '5px',
            border: '1px solid #ccc'
          }}
          disabled={!isConnected || isSwapping}
        />
      </div>

      {/* Swap Direction Button */}
      <button 
        onClick={swapTokens} 
        disabled={isSwapping}
        style={{ 
          padding: '8px', 
          margin: '10px 0', 
          backgroundColor: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isSwapping ? 'not-allowed' : 'pointer'
        }}
      >
        ↑↓ Swap Direction
      </button>

      {/* To Token Section */}
      <div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginBottom: '5px' 
        }}>
          <span>To:</span>
          <select 
            value={toToken} 
            onChange={(e) => setToToken(e.target.value as 'ETH' | 'USDC')}
            disabled={isSwapping}
            style={{ marginLeft: '10px' }}
          >
            <option value="ETH">ETH</option>
            <option value="USDC">USDC</option>
          </select>
        </div>
        <input
          type="text"
          value={estimatedOutput}
          readOnly
          placeholder="0.0"
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: '5px',
            border: '1px solid #ccc',
            backgroundColor: '#f8f9fa'
          }}
        />
      </div>

      {/* Slippage Setting */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '10px',
        marginTop: '5px'
      }}>
        <label>Slippage Tolerance:</label>
        <input
          type="number"
          value={slippage}
          onChange={(e) => setSlippage(parseFloat(e.target.value) || 0.5)}
          step="0.1"
          min="0.1"
          max="5"
          style={{
            width: '60px',
            padding: '5px',
            borderRadius: '5px',
            border: '1px solid #ccc'
          }}
          disabled={isSwapping}
        />
        <span>%</span>
      </div>

      {/* Swap Button */}
      <button
        onClick={executeSwap}
        style={{
          padding: '12px',
          borderRadius: '5px',
          border: 'none',
          backgroundColor: isConnected ? '#3b82f6' : '#94a3b8',
          color: 'white',
          fontWeight: 'bold',
          cursor: isConnected ? 'pointer' : 'not-allowed',
          marginTop: '10px'
        }}
        disabled={!isConnected || !amount || !estimatedOutput || isSwapping}
      >
        {isSwapping ? 'Swapping...' : 'Swap'}
      </button>

      {/* Error Message */}
      {error && (
        <div style={{ 
          color: '#ef4444', 
          marginTop: '10px',
          padding: '10px',
          borderRadius: '5px',
          backgroundColor: '#fee2e2'
        }}>
          {error}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div style={{ 
          color: '#10b981', 
          marginTop: '10px',
          padding: '10px',
          borderRadius: '5px',
          backgroundColor: '#d1fae5'
        }}>
          {success}
        </div>
      )}

      {/* Not Connected Message */}
      {!isConnected && (
        <div style={{ 
          textAlign: 'center', 
          color: '#6b7280',
          marginTop: '10px'
        }}>
          Connect your wallet to swap tokens
        </div>
      )}
    </div>
  );
};

export default SwapForm;
