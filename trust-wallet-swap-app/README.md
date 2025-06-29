# Uniswap V3 ETH-USDC Swap Integration

This application demonstrates a production-ready implementation of Ethereum token swaps between ETH and USDC using the Uniswap V3 protocol. The integration handles all aspects of the swap process including trade creation, price quoting, slippage handling, token approval, and transaction execution.

## Smart Contracts Used

This application interacts with several Ethereum smart contracts on mainnet:

### 1. Uniswap V3 SwapRouter (`0xE592427A0AEce92De3Edee1F18E0157C05861564`)

The primary contract for executing swaps on Uniswap V3. This contract provides the following key functions:

- **`exactInputSingle`**: Executes a swap of a specific amount of one token for as much as possible of another token
  - Parameters include: tokenIn, tokenOut, fee, recipient, deadline, amountIn, amountOutMinimum, sqrtPriceLimitX96
  - Used for both ETH→USDC and USDC→WETH swaps

- **`unwrapWETH9`**: Unwraps WETH to native ETH and sends it to a specified recipient
  - Used after USDC→WETH swaps to convert the WETH to native ETH

- **`multicall`**: Allows batching multiple function calls into a single transaction
  - Used to combine USDC→WETH swap and WETH→ETH unwrapping in one transaction

### 2. WETH (Wrapped Ether) Token Contract (`0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`)

The canonical ERC20 wrapped version of ETH on Ethereum mainnet.

### 3. USDC Token Contract (`0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`)

The official USD Coin ERC20 token on Ethereum mainnet.

### 4. Uniswap V3 Pool Contract

The ETH/USDC liquidity pool that facilitates the swap. For the 0.3% fee tier, the pool address is dynamically computed but corresponds to the ETH-USDC pair with the following properties:
- Fee tier: 0.3% (3000 in Uniswap's fee representation)
- Token0: WETH
- Token1: USDC

## How Swaps Are Executed

### ETH to USDC Swap

1. **Trade Creation**:
   - The application first attempts to create a trade using Uniswap V3 SDK by:
     - Fetching on-chain pool data (slot0, liquidity, fee)
     - Creating a Pool instance with the fetched data
     - Constructing a Route with the pool
     - Creating a Trade object with the route
   - If this fails, a fallback mechanism uses a direct swap approach

2. **Transaction Execution**:
   - The `exactInputSingle` function is called on the SwapRouter contract
   - Native ETH is sent along with the transaction (using the `value` field)
   - ETH is automatically wrapped to WETH by the router
   - The router swaps WETH for USDC
   - USDC is sent directly to the user's wallet

### USDC to ETH Swap

1. **Token Approval**:
   - Before swapping, the application checks if the router has sufficient allowance to spend the user's USDC
   - If not, it calls the `approve` function on the USDC contract to grant permission

2. **Multicall Transaction**:
   - A multicall transaction is created that combines two operations:
     - `exactInputSingle`: Swaps USDC for WETH, but sends the WETH to the router itself
     - `unwrapWETH9`: Unwraps the WETH to native ETH and sends it to the user's wallet
   - This approach ensures the user receives native ETH instead of WETH

## Implementation Details

### Slippage Protection

The application implements slippage protection by calculating a minimum output amount based on the user's slippage tolerance setting (defaulting to a minimum of 5% for safety). This ensures trades don't execute if market conditions change unfavorably between quote and execution.

### Error Handling

The integration includes robust error handling for common issues:

- **Quoter Contract Failures**: If the Uniswap Quoter contract call fails (common with some RPC providers), the application falls back to calculating quotes using pool price data
- **STF Errors**: To prevent "SafeTransferFrom" errors, the transaction uses generous gas limits and higher gas prices
- **Transaction Failures**: Detailed error messages are provided to help diagnose issues

### Gas Optimization

For mainnet transactions, the application:
- Sets appropriate gas limits (1,000,000 for simple swaps, 1,500,000 for multicalls)
- Uses a gas price 20% higher than the network average to improve confirmation times
- Batches operations using multicall to reduce overall transaction costs

## Getting Started

### Installation

```bash
npm install
```

### Running the Application

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view the application in your browser.

### Building for Production

```bash
npm run build
```

## Dependencies

- **@uniswap/v3-sdk**: Core SDK for interacting with Uniswap V3
- **@uniswap/sdk-core**: Base primitives and entities for the Uniswap SDK
- **ethers.js**: Ethereum wallet implementation and utilities
- **React**: Frontend framework
