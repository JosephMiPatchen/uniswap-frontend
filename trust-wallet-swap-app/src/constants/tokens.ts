// Ethereum Mainnet Addresses
export const ETHEREUM_MAINNET_CHAIN_ID = 1;
export const ETHEREUM_GOERLI_CHAIN_ID = 5;

// Using Ethereum mainnet
export const CURRENT_CHAIN_ID = ETHEREUM_MAINNET_CHAIN_ID;

// Uniswap Router Address (V3)
export const UNISWAP_ROUTER_ADDRESS = '0xE592427A0AEce92De3Edee1F18E0157C05861564';

// Token Addresses and Information
export const TOKENS = {
  ETH: {
    name: 'Ethereum',
    symbol: 'ETH',
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH address for Uniswap V3
    decimals: 18,
    logoURI: 'https://tokens.1inch.io/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.png'
  },
  USDC: {
    name: 'USD Coin',
    symbol: 'USDC',
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
    logoURI: 'https://tokens.1inch.io/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.png'
  }
};

// ABI for ERC20 token interface (minimal)
export const ERC20_ABI = [
  // Read-only functions
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  
  // Write functions
  'function transfer(address to, uint amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  
  // Read-only functions
  'function allowance(address owner, address spender) view returns (uint256)',
  
  // Events
  'event Transfer(address indexed from, address indexed to, uint amount)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)'
];

// Uniswap Router ABI (minimal for swapping)
export const UNISWAP_ROUTER_ABI = [
  // ExactInputSingle for V3 swaps
  'function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
  
  // For unwrapping WETH
  'function unwrapWETH9(uint256 amountMinimum, address recipient) external payable',
  
  // For getting quotes
  'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external view returns (uint256 amountOut)'
];
