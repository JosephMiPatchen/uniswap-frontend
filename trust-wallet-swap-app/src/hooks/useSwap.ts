import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './useWallet';
import { TOKENS, UNISWAP_ROUTER_ADDRESS, UNISWAP_ROUTER_ABI } from '../constants/tokens';

// Fee tiers in basis points (0.01% = 1 basis point)
export const FEE_TIERS = {
  LOWEST: 100, // 0.01%
  LOW: 500,    // 0.05%
  MEDIUM: 3000, // 0.3%
  HIGH: 10000   // 1%
};

// Default fee tier for ETH/USDC pair
const DEFAULT_FEE_TIER = FEE_TIERS.MEDIUM; // 0.3%

interface SwapResult {
  isSwapping: boolean;
  error: string | null;
  txHash: string | null;
  estimatedGas: string | null;
  estimatedOutput: string | null;
  priceImpact: string | null;
  swapFee: string | null;
  estimateSwap: (inputAmount: string, slippageTolerance: number) => Promise<void>;
  executeSwap: (inputAmount: string, minOutputAmount: string, slippageTolerance: number) => Promise<void>;
}

/**
 * Hook to handle token swapping via Uniswap
 * @param fromToken The token to swap from
 * @param toToken The token to swap to
 * @returns SwapResult with swap functions and state
 */
export const useSwap = (
  fromToken: 'ETH' | 'USDC',
  toToken: 'ETH' | 'USDC'
): SwapResult => {
  const { signer, account, isConnected } = useWallet();
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [estimatedGas, setEstimatedGas] = useState<string | null>(null);
  const [estimatedOutput, setEstimatedOutput] = useState<string | null>(null);
  const [priceImpact, setPriceImpact] = useState<string | null>(null);
  const [swapFee, setSwapFee] = useState<string | null>(null);

  // Reset state
  const resetState = () => {
    setError(null);
    setTxHash(null);
    setEstimatedGas(null);
    setEstimatedOutput(null);
    setPriceImpact(null);
    setSwapFee(null);
  };

  // Calculate swap fee
  const calculateSwapFee = (inputAmount: string, feeTier: number = DEFAULT_FEE_TIER): string => {
    const amount = parseFloat(inputAmount);
    const feePercentage = feeTier / 10000; // Convert basis points to percentage
    const fee = amount * feePercentage;
    return fee.toFixed(6);
  };

  // Estimate price impact (simplified calculation)
  const calculatePriceImpact = (inputAmount: string): string => {
    // This is a simplified calculation
    // In a real app, you would compare the execution price to the mid-price
    const amount = parseFloat(inputAmount);
    
    // Simulate higher price impact for larger trades
    let impact = 0;
    if (amount < 10) {
      impact = 0.1; // 0.1% for small trades
    } else if (amount < 100) {
      impact = 0.3; // 0.3% for medium trades
    } else if (amount < 1000) {
      impact = 0.5; // 0.5% for large trades
    } else {
      impact = 1.0; // 1% for very large trades
    }
    
    return impact.toFixed(2);
  };

  // Estimate the swap output and gas
  const estimateSwap = useCallback(async (
    inputAmount: string,
    slippageTolerance: number = 0.5
  ): Promise<void> => {
    if (!isConnected || !signer || !account) {
      setError('Wallet not connected');
      return;
    }

    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      resetState();
      return;
    }

    try {
      setIsSwapping(true);
      setError(null);

      const fromTokenData = TOKENS[fromToken];
      const toTokenData = TOKENS[toToken];
      
      // Create router contract
      const router = new ethers.Contract(
        UNISWAP_ROUTER_ADDRESS,
        UNISWAP_ROUTER_ABI,
        signer
      );

      // Format input amount with proper decimals
      const amountIn = ethers.utils.parseUnits(
        inputAmount,
        fromTokenData.decimals
      );

      // Calculate deadline 20 minutes from now
      const deadline = Math.floor(Date.now() / 1000) + 20 * 60;

      // Prepare swap parameters
      const params = {
        tokenIn: fromTokenData.address,
        tokenOut: toTokenData.address,
        fee: DEFAULT_FEE_TIER,
        recipient: account,
        deadline: deadline,
        amountIn: amountIn,
        amountOutMinimum: 0, // For estimation only
        sqrtPriceLimitX96: 0 // No price limit for estimation
      };

      // Estimate gas and output
      let gasEstimate;
      let outputAmount;

      try {
        // For ETH to Token swaps
        if (fromToken === 'ETH') {
          gasEstimate = await router.estimateGas.exactInputSingle(
            params,
            { value: amountIn }
          );
          
          // Simulate the swap to get the output amount
          // In a real implementation, you would call quoteExactInputSingle on the Quoter contract
          // Here we're using a simplified calculation
          const ethPrice = 3000; // Simplified: 1 ETH = $3000
          const usdtAmount = parseFloat(inputAmount) * ethPrice;
          outputAmount = ethers.utils.parseUnits(
            usdtAmount.toFixed(6),
            toTokenData.decimals
          );
        } 
        // For Token to ETH swaps
        else {
          // Check allowance first
          const tokenContract = new ethers.Contract(
            fromTokenData.address,
            [
              'function allowance(address owner, address spender) view returns (uint256)',
            ],
            signer
          );
          
          const allowance = await tokenContract.allowance(account, UNISWAP_ROUTER_ADDRESS);
          
          if (allowance.lt(amountIn)) {
            setError('Insufficient allowance. You need to approve USDC first.');
            setIsSwapping(false);
            return;
          }
          
          gasEstimate = await router.estimateGas.exactInputSingle(params);
          
          // Simulate the swap to get the output amount
          // In a real implementation, you would call quoteExactInputSingle on the Quoter contract
          const ethPrice = 3000; // Simplified: 1 ETH = $3000
          const ethAmount = parseFloat(inputAmount) / ethPrice;
          outputAmount = ethers.utils.parseUnits(
            ethAmount.toFixed(18),
            toTokenData.decimals
          );
        }

        // Format the estimated output
        const formattedOutput = ethers.utils.formatUnits(
          outputAmount,
          toTokenData.decimals
        );
        
        // Calculate swap fee
        const fee = calculateSwapFee(inputAmount);
        
        // Calculate price impact
        const impact = calculatePriceImpact(inputAmount);

        // Set state with estimates
        setEstimatedGas(gasEstimate.toString());
        setEstimatedOutput(formattedOutput);
        setSwapFee(fee);
        setPriceImpact(impact);
      } catch (err: any) {
        console.error('Error estimating swap:', err);
        setError(`Error estimating swap: ${err.message || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Error in estimateSwap:', err);
      setError(`Error preparing swap: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSwapping(false);
    }
  }, [fromToken, toToken, signer, account, isConnected]);

  // Execute the swap
  const executeSwap = useCallback(async (
    inputAmount: string,
    minOutputAmount: string,
    slippageTolerance: number = 0.5
  ): Promise<void> => {
    if (!isConnected || !signer || !account) {
      setError('Wallet not connected');
      return;
    }

    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      setError('Invalid input amount');
      return;
    }

    if (!minOutputAmount || parseFloat(minOutputAmount) <= 0) {
      setError('Invalid minimum output amount');
      return;
    }

    try {
      setIsSwapping(true);
      setError(null);
      setTxHash(null);

      const fromTokenData = TOKENS[fromToken];
      const toTokenData = TOKENS[toToken];
      
      // Create router contract
      const router = new ethers.Contract(
        UNISWAP_ROUTER_ADDRESS,
        UNISWAP_ROUTER_ABI,
        signer
      );

      // Format input amount with proper decimals
      const amountIn = ethers.utils.parseUnits(
        inputAmount,
        fromTokenData.decimals
      );

      // Format minimum output amount with proper decimals
      const amountOutMinimum = ethers.utils.parseUnits(
        minOutputAmount,
        toTokenData.decimals
      );

      // Calculate deadline 20 minutes from now
      const deadline = Math.floor(Date.now() / 1000) + 20 * 60;

      // Prepare swap parameters
      const params = {
        tokenIn: fromTokenData.address,
        tokenOut: toTokenData.address,
        fee: DEFAULT_FEE_TIER,
        recipient: account,
        deadline: deadline,
        amountIn: amountIn,
        amountOutMinimum: amountOutMinimum,
        sqrtPriceLimitX96: 0 // No price limit
      };

      let tx;

      // For ETH to Token swaps
      if (fromToken === 'ETH') {
        tx = await router.exactInputSingle(params, {
          value: amountIn,
          gasLimit: ethers.utils.hexlify(1000000) // Set a gas limit
        });
      } 
      // For Token to ETH swaps
      else {
        // Check and approve allowance first
        const tokenContract = new ethers.Contract(
          fromTokenData.address,
          [
            'function allowance(address owner, address spender) view returns (uint256)',
            'function approve(address spender, uint256 amount) returns (bool)'
          ],
          signer
        );
        
        const allowance = await tokenContract.allowance(account, UNISWAP_ROUTER_ADDRESS);
        
        if (allowance.lt(amountIn)) {
          console.log('Approving USDC...');
          const approveTx = await tokenContract.approve(
            UNISWAP_ROUTER_ADDRESS,
            ethers.constants.MaxUint256 // Approve maximum amount
          );
          await approveTx.wait();
          console.log('USDC approved');
        }
        
        tx = await router.exactInputSingle(params, {
          gasLimit: ethers.utils.hexlify(1000000) // Set a gas limit
        });
      }

      // Wait for transaction to be mined
      const receipt = await tx.wait();
      setTxHash(receipt.transactionHash);
      
      // Calculate and set swap fee
      const fee = calculateSwapFee(inputAmount);
      setSwapFee(fee);
      
      // Calculate and set price impact
      const impact = calculatePriceImpact(inputAmount);
      setPriceImpact(impact);
      
      console.log('Swap successful:', receipt);
    } catch (err: any) {
      console.error('Error executing swap:', err);
      setError(`Error executing swap: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSwapping(false);
    }
  }, [fromToken, toToken, signer, account, isConnected]);

  return {
    isSwapping,
    error,
    txHash,
    estimatedGas,
    estimatedOutput,
    priceImpact,
    swapFee,
    estimateSwap,
    executeSwap
  };
};
