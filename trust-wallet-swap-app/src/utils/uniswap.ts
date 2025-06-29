import { ethers } from 'ethers';
import { FEE_TIERS } from '../hooks/useSwap';
import { Token, CurrencyAmount, TradeType, Percent } from '@uniswap/sdk-core';
import { Pool, Route, Trade, SwapQuoter, SwapRouter, computePoolAddress } from '@uniswap/v3-sdk';
import { TOKENS, UNISWAP_ROUTER_ADDRESS } from '../constants/tokens';
import JSBI from 'jsbi';

// Define chain ID for Ethereum mainnet
export const CHAIN_ID = 1;

// Define contract addresses
export const UNISWAP_V3_FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
export const QUOTER_CONTRACT_ADDRESS = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';

// Define token instances for SDK
export const WETH_TOKEN = new Token(
  CHAIN_ID,
  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
  18,
  'WETH',
  'Wrapped Ether'
);

export const USDC_TOKEN = new Token(
  CHAIN_ID,
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
  6,
  'USDC',
  'USD Coin'
);

// Common fee tiers in Uniswap V3
export const FEE_AMOUNT = {
  LOWEST: 100,   // 0.01%
  LOW: 500,      // 0.05%
  MEDIUM: 3000,  // 0.3%
  HIGH: 10000    // 1%
};

/**
 * Create a trade using Uniswap V3 SDK
 * This function attempts to create a trade using the Uniswap V3 SDK by fetching pool data
 * and constructing a trade object. If that fails, it falls back to a simpler approach.
 */
export async function createTrade(
  fromTokenSymbol: 'ETH' | 'USDC',
  toTokenSymbol: 'ETH' | 'USDC',
  inputAmount: string,
  provider: ethers.providers.Provider
): Promise<Trade<Token, Token, TradeType> | null> {
  try {
    console.log('Creating trade with params:', { fromTokenSymbol, toTokenSymbol, inputAmount });
    
    // Use predefined token instances instead of looking up in TOKENS
    const fromToken = fromTokenSymbol === 'ETH' ? WETH_TOKEN : USDC_TOKEN;
    const toToken = toTokenSymbol === 'ETH' ? WETH_TOKEN : USDC_TOKEN;
    
    console.log('Using tokens:', { 
      fromToken: { address: fromToken.address, symbol: fromToken.symbol },
      toToken: { address: toToken.address, symbol: toToken.symbol }
    });
    
    // Get decimals for parsing input amount
    const decimals = fromTokenSymbol === 'ETH' ? 18 : 6;
    
    // Parse input amount
    const inputAmountWei = ethers.utils.parseUnits(inputAmount, decimals);
    const amountIn = CurrencyAmount.fromRawAmount(
      fromToken,
      inputAmountWei.toString()
    );
    
    console.log('Amount in:', { raw: inputAmountWei.toString(), formatted: amountIn.toExact() });

    try {
      // Try to create a trade using SDK and pool data
      return await createTradeWithPoolData(fromToken, toToken, amountIn, provider);
    } catch (poolError: any) {
      console.error('Error creating trade with pool data:', poolError);
      console.log('Attempting to create direct swap parameters instead...');
      
      // If pool data approach fails, try a direct swap approach
      return createDirectSwapTrade(fromToken, toToken, amountIn, inputAmountWei);
    }
  } catch (error: any) {
    console.error('Error creating trade:', error);
    return null;
  }
}

/**
 * Create a trade using pool data from the blockchain
 * This is the preferred method that follows the Uniswap V3 SDK documentation
 */
async function createTradeWithPoolData(
  fromToken: Token,
  toToken: Token,
  amountIn: CurrencyAmount<Token>,
  provider: ethers.providers.Provider
): Promise<Trade<Token, Token, TradeType>> {
  // Create pool address
  console.log('Computing pool address with factory:', UNISWAP_V3_FACTORY_ADDRESS);
  const currentPoolAddress = computePoolAddress({
    factoryAddress: UNISWAP_V3_FACTORY_ADDRESS,
    tokenA: fromToken,
    tokenB: toToken,
    fee: FEE_AMOUNT.MEDIUM
  });
  console.log('Computed pool address:', currentPoolAddress);

  // Create pool contract
  const poolContract = new ethers.Contract(
    currentPoolAddress,
    [
      'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
      'function liquidity() external view returns (uint128)',
      'function fee() external view returns (uint24)'
    ],
    provider
  );

  console.log('Fetching pool data from contract...');
  
  // Get pool data
  const [slot0Data, liquidityData, feeData] = await Promise.all([
    poolContract.slot0(),
    poolContract.liquidity(),
    poolContract.fee()
  ]);
  
  console.log('Pool data fetched successfully:', {
    sqrtPriceX96: slot0Data.sqrtPriceX96.toString(),
    tick: slot0Data.tick,
    liquidity: liquidityData.toString(),
    fee: feeData
  });

  // Verify the pool has liquidity
  if (liquidityData.eq(0)) {
    throw new Error('Pool has no liquidity');
  }

  // Create pool instance
  const pool = new Pool(
    fromToken,
    toToken,
    feeData,
    slot0Data.sqrtPriceX96.toString(),
    liquidityData.toString(),
    slot0Data.tick
  );

  console.log('Pool created successfully');

  // Create route
  const swapRoute = new Route(
    [pool],
    fromToken,
    toToken
  );

  console.log('Route created successfully');

  // Get quote for output amount
  console.log('Getting quote from SwapQuoter...');
  const { calldata } = await SwapQuoter.quoteCallParameters(
    swapRoute,
    amountIn,
    TradeType.EXACT_INPUT,
    {
      useQuoterV2: false, // Try with V1 quoter instead of V2
    }
  );

  console.log('Calling quoter contract...');
  
  // Calculate a fallback quote based on the pool data we already have
  // This is more reliable than calling the quoter contract which often fails
  let amountOut;
  try {
    // Try calling the quoter contract first
    const quoteCallReturnData = await provider.call({
      to: QUOTER_CONTRACT_ADDRESS,
      data: calldata,
      gasLimit: ethers.utils.hexlify(1000000), // Add explicit gas limit
    });

    // Decode the result
    amountOut = ethers.utils.defaultAbiCoder.decode(['uint256'], quoteCallReturnData)[0];
    console.log('Quote received from contract:', { amountOut: amountOut.toString() });
  } catch (quoteError) {
    console.error('Error calling quoter contract:', quoteError);
    console.log('Using pool data to calculate quote instead');
    
    // Calculate quote directly from the pool data
    // For ETH->USDC, use the current price from the pool
    const inputAmount = parseFloat(amountIn.toExact());
    let outputAmount;
    
    if (fromToken.equals(WETH_TOKEN) && toToken.equals(USDC_TOKEN)) {
      // ETH to USDC: Use the pool's current price
      const spotPrice = pool.token0Price.toSignificant(6);
      console.log('Pool spot price:', spotPrice, 'USDC per ETH');
      outputAmount = inputAmount * parseFloat(spotPrice);
    } else {
      // USDC to ETH: Use the pool's current price (inverted)
      const spotPrice = pool.token1Price.toSignificant(6);
      console.log('Pool spot price:', spotPrice, 'ETH per USDC');
      outputAmount = inputAmount * parseFloat(spotPrice);
    }
    
    // Convert to BigNumber
    const outputDecimals = toToken.equals(WETH_TOKEN) ? 18 : 6;
    amountOut = ethers.utils.parseUnits(outputAmount.toFixed(outputDecimals), outputDecimals);
    console.log('Calculated quote from pool data:', { amountOut: amountOut.toString() });
  }
  
  console.log('Final quote amount:', { amountOut: amountOut.toString() });

  // Create an unchecked trade instance
  console.log('Creating unchecked trade...');
  const uncheckedTrade = Trade.createUncheckedTrade({
    route: swapRoute,
    inputAmount: amountIn,
    outputAmount: CurrencyAmount.fromRawAmount(
      toToken,
      JSBI.BigInt(amountOut)
    ),
    tradeType: TradeType.EXACT_INPUT,
  });

  console.log('Trade created successfully');
  return uncheckedTrade;
}

/**
 * Create a direct swap trade without using pool data
 * This is a fallback method when pool data cannot be fetched
 */
function createDirectSwapTrade(
  fromToken: Token,
  toToken: Token,
  amountIn: CurrencyAmount<Token>,
  inputAmountWei: ethers.BigNumber
): Trade<Token, Token, TradeType> {
  console.log('Creating direct swap trade...');
  
  // Use a fixed exchange rate as fallback (this is just an estimate)
  const ethToUsdcRate = 3000; // 1 ETH = 3000 USDC
  
  // Calculate output amount based on simple exchange rate
  let outputAmountRaw: string;
  if (fromToken.equals(WETH_TOKEN) && toToken.equals(USDC_TOKEN)) {
    // ETH to USDC: multiply by rate
    const ethAmount = parseFloat(ethers.utils.formatEther(inputAmountWei));
    const usdcAmount = ethAmount * ethToUsdcRate;
    outputAmountRaw = ethers.utils.parseUnits(usdcAmount.toString(), 6).toString();
  } else if (fromToken.equals(USDC_TOKEN) && toToken.equals(WETH_TOKEN)) {
    // USDC to ETH: divide by rate
    const usdcAmount = parseFloat(ethers.utils.formatUnits(inputAmountWei, 6));
    const ethAmount = usdcAmount / ethToUsdcRate;
    outputAmountRaw = ethers.utils.parseEther(ethAmount.toString()).toString();
  } else {
    throw new Error('Unsupported token pair for direct swap');
  }
  
  console.log('Calculated output amount:', outputAmountRaw);
  
  // Create output amount
  const outputAmount = CurrencyAmount.fromRawAmount(
    toToken,
    JSBI.BigInt(outputAmountRaw)
  );
  
  // Create a synthetic route (this won't be used for actual routing, just for trade construction)
  const syntheticPool = new Pool(
    fromToken,
    toToken,
    FEE_AMOUNT.MEDIUM,
    '1', // Dummy sqrtPriceX96
    '1', // Dummy liquidity
    0    // Dummy tick
  );
  
  const syntheticRoute = new Route(
    [syntheticPool],
    fromToken,
    toToken
  );
  
  // Create an unchecked trade
  const uncheckedTrade = Trade.createUncheckedTrade({
    route: syntheticRoute,
    inputAmount: amountIn,
    outputAmount: outputAmount,
    tradeType: TradeType.EXACT_INPUT,
  });
  
  console.log('Direct swap trade created successfully');
  return uncheckedTrade;
}

/**
 * Calculate the minimum output amount based on input amount and slippage tolerance
 * @param inputAmount The input amount as a string
 * @param outputAmount The estimated output amount as a string
 * @param slippageTolerance The slippage tolerance as a percentage (e.g., 0.5 for 0.5%)
 * @returns The minimum output amount as a string
 */
export const calculateMinimumOutputAmount = (
  inputAmount: string,
  outputAmount: string,
  slippageTolerance: number
): string => {
  if (!outputAmount || parseFloat(outputAmount) === 0) {
    return '0';
  }
  
  const output = parseFloat(outputAmount);
  const slippageMultiplier = 1 - slippageTolerance / 100;
  const minOutput = output * slippageMultiplier;
  
  return minOutput.toFixed(6);
};

/**
 * Format gas price to gwei
 * @param gasPrice The gas price in wei
 * @returns Formatted gas price in gwei
 */
export const formatGasToGwei = (gasPrice: string): string => {
  if (!gasPrice) return '0';
  
  const gweiValue = ethers.utils.formatUnits(gasPrice, 'gwei');
  return parseFloat(gweiValue).toFixed(2);
};

/**
 * Calculate gas cost in ETH
 * @param gasLimit The gas limit
 * @param gasPrice The gas price in wei
 * @returns The gas cost in ETH
 */
export const calculateGasCost = (
  gasLimit: string,
  gasPrice: string
): string => {
  if (!gasLimit || !gasPrice) return '0';
  
  const limit = ethers.BigNumber.from(gasLimit);
  const price = ethers.BigNumber.from(gasPrice);
  const cost = limit.mul(price);
  
  return ethers.utils.formatEther(cost);
};

/**
 * Format fee tier to human-readable string
 * @param feeTier The fee tier in basis points
 * @returns Human-readable fee tier
 */
export const formatFeeTier = (feeTier: number): string => {
  switch (feeTier) {
    case FEE_TIERS.LOWEST:
      return '0.01%';
    case FEE_TIERS.LOW:
      return '0.05%';
    case FEE_TIERS.MEDIUM:
      return '0.3%';
    case FEE_TIERS.HIGH:
      return '1%';
    default:
      return `${(feeTier / 10000).toFixed(2)}%`;
  }
};

/**
 * Calculate the price impact color based on percentage
 * @param priceImpact The price impact as a percentage string
 * @returns CSS color for the price impact
 */
export const getPriceImpactColor = (priceImpact: string | null): string => {
  if (!priceImpact) return '#6b7280'; // Gray
  
  const impact = parseFloat(priceImpact);
  
  if (impact < 0.5) return '#10b981'; // Green
  if (impact < 1) return '#f59e0b';   // Yellow
  if (impact < 3) return '#f97316';   // Orange
  return '#ef4444';                   // Red
};
