# Polymarket Copy Trading Bot

A production-grade Polymarket copy trading bot with bug fixes and improvements. This bot automatically monitors target wallets and copies their trades in real-time using WebSocket connections.

## 🎯 Overview

This bot is an improved version of the Polymarket copy trading bot with the following fixes and enhancements:

### ✅ Fixes Applied

1. **Fixed maxAmount calculation bug** - Corrected logic in order amount calculation
2. **Enabled balance validation for SELL orders** - Re-enabled commented-out balance checks to prevent overselling
3. **Added duplicate trade prevention** - Prevents processing the same trade multiple times using transaction hash tracking
4. **Improved wallet address validation** - Now checks all possible wallet address fields (proxyWallet, wallet, user, address, userAddress)
5. **Added WebSocket reconnection logic** - Automatic reconnection with exponential backoff on connection failures
6. **Fixed directory creation** - Automatically creates data directory if it doesn't exist
7. **Enhanced error handling** - Better error recovery and logging

## 🏗️ Architecture

### Technology Stack

- **Runtime**: Node.js with TypeScript
- **Language**: TypeScript 5.9+ (strict mode)
- **Blockchain**: Polygon (Ethereum-compatible L2)
- **APIs**: 
  - Polymarket CLOB Client (`@polymarket/clob-client`)
  - Polymarket Real-Time Data Client (`@polymarket/real-time-data-client`)
- **Web3**: Ethers.js for blockchain interactions
- **Logging**: Custom structured logger with chalk

### System Flow

```
WebSocket Connection → Trade Detection → Wallet Validation → Duplicate Check
                                                                    ↓
Order Execution ← Balance Validation ← Order Building ← Trade Processing
                                                                    ↓
Holdings Update → Success Logging
```

## 📦 Installation

### Prerequisites

- **Node.js** 18+ and npm
- **TypeScript** 5.9+
- **Polygon wallet** with USDC for trading
- **Private key** for wallet authentication

### Setup

1. **Clone or navigate to the project**
   ```bash
   cd Polymarket-Copytrading-Bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # Wallet Configuration (REQUIRED)
   PRIVATE_KEY=your_private_key_here
   TARGET_WALLET=0x... # Wallet address to copy trades from
   
   # Trading Configuration
   SIZE_MULTIPLIER=1.0
   MAX_ORDER_AMOUNT=100
   ORDER_TYPE=FAK
   TICK_SIZE=0.01
   NEG_RISK=false
   ENABLE_COPY_TRADING=true
   
   # Redemption Configuration
   REDEEM_DURATION=60 # Minutes between auto-redemptions (null = disabled)
   
   # API Configuration
   CHAIN_ID=137 # Polygon mainnet (80002 for Amoy testnet)
   CLOB_API_URL=https://clob.polymarket.com
   USER_REAL_TIME_DATA_URL=wss://ws-live-data.polymarket.com
   
   # Optional
   DEBUG=false
   ```

4. **Initialize credentials**
   On first run, the bot will automatically create API credentials using your `PRIVATE_KEY`.
   Credentials are saved to `src/data/credential.json`.

## ⚙️ Configuration

### Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PRIVATE_KEY` | string | **required** | Private key of trading wallet |
| `TARGET_WALLET` | string | **required** | Wallet address to copy trades from |
| `SIZE_MULTIPLIER` | number | `1.0` | Multiplier for trade sizes (e.g., `2.0` = 2x size) |
| `MAX_ORDER_AMOUNT` | number | `undefined` | Maximum USDC amount per order |
| `ORDER_TYPE` | string | `FAK` | Order type: `FAK` or `FOK` |
| `TICK_SIZE` | string | `0.01` | Price precision: `0.1`, `0.01`, `0.001`, `0.0001` |
| `NEG_RISK` | boolean | `false` | Enable negative risk (allow negative balances) |
| `ENABLE_COPY_TRADING` | boolean | `true` | Enable/disable copy trading |
| `REDEEM_DURATION` | number | `null` | Minutes between auto-redemptions (null = disabled) |
| `CHAIN_ID` | number | `137` | Blockchain chain ID (137 = Polygon, 80002 = Amoy) |
| `CLOB_API_URL` | string | `https://clob.polymarket.com` | CLOB API endpoint |
| `USER_REAL_TIME_DATA_URL` | string | `wss://ws-live-data.polymarket.com` | WebSocket URL |
| `DEBUG` | boolean | `false` | Enable debug logging |

### Trading Parameters

- **Size Multiplier**: Scales the copied trade size. `1.0` = exact copy, `2.0` = double size, `0.5` = half size
- **Max Order Amount**: Safety limit to prevent oversized positions. When exceeded, uses 50% of maxAmount
- **Order Type**:
  - `FAK` (Fill-and-Kill): Partial fills allowed, remaining unfilled portion cancelled
  - `FOK` (Fill-or-Kill): Entire order must fill immediately or cancelled
- **Tick Size**: Price precision for order placement. Must match market's tick size
- **Negative Risk**: When enabled, allows orders that may result in negative USDC balance

## 🚀 Usage

### Starting the Bot

```bash
# Start copy trading bot
npm start

# Or using ts-node directly
ts-node src/index.ts
```

The bot will:
1. Initialize WebSocket connection to Polymarket
2. Subscribe to trade activity feed
3. Monitor target wallet for trades
4. Automatically copy trades when detected
5. Run scheduled redemptions (if enabled)

### Manual Redemption

#### Redeem from Holdings File
```bash
# Redeem all resolved markets from token-holding.json
npm run redeem

# Or directly
ts-node src/auto-redeem.ts
```

#### Redeem Specific Market
```bash
# Check market status
ts-node src/redeem.ts --check <conditionId>

# Redeem specific market
ts-node src/redeem.ts <conditionId>
```

## 🔧 Technical Details

### Trade Execution Flow

1. **Trade Detection**: WebSocket receives trade activity message
2. **Wallet Filtering**: Validates trade originates from target wallet (checks all address fields)
3. **Duplicate Prevention**: Checks if trade has already been processed (by transaction hash)
4. **Order Construction**: Converts trade payload to market order:
   - Applies size multiplier
   - Validates against max order amount
   - Adjusts price to tick size
   - Sets order type (FAK/FOK)
5. **Balance Validation**: 
   - For BUY: Checks sufficient USDC balance
   - For SELL: Checks available token balance (accounting for open orders)
6. **Allowance Management**: Ensures proper token approvals
7. **Order Execution**: Submits order to CLOB API
8. **Holdings Update**: Records token positions locally
9. **Logging**: Logs all operations with structured output

### Key Improvements

#### 1. Duplicate Trade Prevention
```typescript
// Tracks processed trades by transaction hash
const processedTrades = new Set<string>();

// Prevents processing same trade twice
if (isTradeProcessed(tradeHash)) {
    return; // Skip duplicate
}
```

#### 2. Enhanced Wallet Validation
```typescript
// Checks all possible wallet address fields
function isFromTargetWallet(payload: TradePayload, targetAddress: string): boolean {
    const walletFields = [
        payload.proxyWallet,
        payload.wallet,
        payload.user,
        payload.address,
        payload.userAddress,
    ];
    return walletFields.some(field => field?.toLowerCase() === target);
}
```

#### 3. WebSocket Reconnection
```typescript
// Automatic reconnection with exponential backoff
if (reconnectAttempts < maxReconnectAttempts) {
    setTimeout(() => {
        const newClient = connectWebSocket();
        newClient.connect();
    }, reconnectDelay);
}
```

#### 4. Balance Validation for SELL Orders
```typescript
// Re-enabled balance validation to prevent overselling
const balanceCheck = await validateSellOrderBalance(
    this.client,
    tokenId,
    holdingsAmount
);
const sellAmount = Math.min(holdingsAmount, balanceCheck.available);
```

### Redemption Mechanism

The bot maintains a local JSON database (`src/data/token-holding.json`) tracking all token positions. When markets resolve:

1. **Resolution Check**: Queries Polymarket API for market status
2. **Winning Detection**: Identifies winning outcome tokens
3. **Balance Verification**: Confirms user holds winning tokens
4. **Redemption Execution**: Calls Polymarket redemption contract
5. **Holdings Cleanup**: Removes redeemed positions from database

### Security Features

- **Credential Management**: Secure API key storage in `src/data/credential.json`
- **Allowance Control**: Automatic USDC approval management
- **Balance Validation**: Pre-order balance checks prevent over-trading
- **Error Handling**: Comprehensive error handling with graceful degradation
- **Private Key Security**: Uses environment variables (never hardcoded)
- **Duplicate Prevention**: Prevents accidental double execution

## 📁 Project Structure

```
Polymarket-Copytrading-Bot/
├── src/
│   ├── index.ts                 # Main bot entry point (FIXED)
│   ├── auto-redeem.ts           # Automated redemption script
│   ├── redeem.ts                # Manual redemption script
│   ├── data/                    # Data storage (auto-created)
│   │   ├── credential.json      # API credentials (auto-generated)
│   │   └── token-holding.json  # Token holdings database
│   ├── order-builder/           # Order construction logic
│   │   ├── builder.ts           # TradeOrderBuilder class (FIXED)
│   │   ├── helpers.ts           # Order conversion utilities (FIXED)
│   │   ├── types.ts             # Type definitions
│   │   └── index.ts             # Exports
│   ├── providers/               # API clients
│   │   ├── clobclient.ts        # CLOB API client
│   │   ├── wssProvider.ts       # WebSocket provider
│   │   └── rpcProvider.ts       # RPC provider
│   ├── security/                # Security utilities
│   │   ├── allowance.ts         # Token approval management
│   │   └── createCredential.ts # Credential generation
│   └── utils/                   # Utility functions
│       ├── balance.ts           # Balance checking
│       ├── holdings.ts          # Holdings management (FIXED)
│       ├── logger.ts            # Logging utility
│       ├── redeem.ts            # Redemption logic
│       ├── types.ts             # TypeScript types
│       └── config.ts            # Configuration
├── package.json
├── tsconfig.json
└── README.md
```

## 🔌 API Integration

### Polymarket CLOB Client

The bot uses the official `@polymarket/clob-client` for order execution:

```typescript
import { ClobClient, OrderType, Side } from "@polymarket/clob-client";

const client = await getClobClient();
const response = await client.createAndPostMarketOrder(
    marketOrder,
    orderOptions,
    orderType
);
```

### Real-Time Data Client

WebSocket connection for live trade monitoring:

```typescript
import { RealTimeDataClient } from "@polymarket/real-time-data-client";

client.subscribe({
    subscriptions: [{
        topic: "activity",
        type: "trades"
    }]
});
```

## 📊 Monitoring & Logging

The bot provides comprehensive logging:

- **Trade Detection**: Logs all detected trades from target wallet
- **Order Execution**: Records order placement and results
- **Redemption Activity**: Tracks redemption operations
- **Error Handling**: Detailed error messages with stack traces
- **Balance Updates**: Displays wallet balances after operations
- **WebSocket Status**: Logs connection and reconnection events

Log levels:
- `info`: General operational messages
- `success`: Successful operations
- `warning`: Non-critical issues
- `error`: Errors requiring attention
- `debug`: Debug messages (when `DEBUG=true`)

## ⚠️ Risk Considerations

1. **Market Risk**: Copy trading amplifies both gains and losses
2. **Liquidity Risk**: Large orders may not fill completely
3. **Slippage**: Market orders execute at current market price
4. **Gas Costs**: Each transaction incurs Polygon gas fees
5. **API Limits**: Rate limiting may affect order execution
6. **Network Latency**: WebSocket delays may cause missed trades
7. **Duplicate Prevention**: Failed trades are unmarked for retry, which could cause issues if not handled properly

**Recommendations**:
- Start with small size multipliers
- Set conservative max order amounts
- Monitor wallet balance regularly
- Test with small amounts before scaling
- Review logs regularly for errors
- Keep sufficient USDC balance for trading

## 🛠️ Development

### Building

```bash
# Type checking
npm run build

# Run in development
npm start
```

### Testing

```bash
# Test redemption (dry run)
ts-node src/auto-redeem.ts

# Test specific market
ts-node src/redeem.ts --check <conditionId>
```

## 🐛 Bug Fixes Summary

### Fixed Issues

1. **maxAmount Calculation Bug** (helpers.ts)
   - **Issue**: When calculated amount exceeded maxAmount, it returned maxAmount instead of the calculated capped amount
   - **Fix**: Returns `maxAmount * 0.5` when limit is exceeded (as per original logic)

2. **Disabled Balance Validation** (builder.ts)
   - **Issue**: Balance validation for SELL orders was commented out, risking overselling
   - **Fix**: Re-enabled balance validation to prevent selling more tokens than available

3. **Missing Duplicate Prevention** (index.ts)
   - **Issue**: Same trade could be processed multiple times if WebSocket sent duplicates
   - **Fix**: Added transaction hash tracking to prevent duplicate execution

4. **Incomplete Wallet Validation** (index.ts)
   - **Issue**: Only checked `proxyWallet` field, missing other possible address fields
   - **Fix**: Now checks all wallet address fields (proxyWallet, wallet, user, address, userAddress)

5. **No WebSocket Reconnection** (index.ts)
   - **Issue**: Bot would crash on WebSocket disconnection
   - **Fix**: Added automatic reconnection logic with retry limits

6. **Missing Directory Creation** (holdings.ts)
   - **Issue**: Data directory might not exist, causing file write failures
   - **Fix**: Automatically creates `src/data/` directory if it doesn't exist

## 📝 License

ISC

## 🤝 Contributing

Contributions welcome! Please ensure:
- Code follows TypeScript best practices
- All functions are properly typed
- Error handling is comprehensive
- Logging is informative
- Documentation is updated

## 📞 Support

For issues, questions, or contributions:
- Review existing documentation
- Check Polymarket API documentation
- Review logs for error messages

---

**Disclaimer**: This software is provided as-is. Trading cryptocurrencies and prediction markets carries significant risk. Use at your own discretion and never trade more than you can afford to lose.

**Version**: 1.0.0 (Fixed and Improved)
**Last Updated**: 2024
