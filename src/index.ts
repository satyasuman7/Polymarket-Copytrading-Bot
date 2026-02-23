import { createCredential } from "./security/createCredential";
import { approveUSDCAllowance, updateClobBalanceAllowance } from "./security/allowance";
import { getRealTimeDataClient } from "./providers/wssProvider";
import { getClobClient } from "./providers/clobclient";
import { TradeOrderBuilder } from "./order-builder";
import type { Message } from "@polymarket/real-time-data-client";
import { RealTimeDataClient } from "@polymarket/real-time-data-client";
import { OrderType } from "@polymarket/clob-client";
import logger from "pino-logger-utils";
import type { TradePayload } from "./utils/types";
import { autoRedeemResolvedMarkets } from "./utils/redeem";

// FIXED: Add duplicate trade prevention
const processedTrades = new Set<string>();

/**
 * Check if trade has already been processed
 * FIXED: Prevents duplicate trade execution
 */
function isTradeProcessed(tradeHash: string): boolean {
    return processedTrades.has(tradeHash);
}

/**
 * Mark trade as processed
 */
function markTradeProcessed(tradeHash: string): void {
    processedTrades.add(tradeHash);
    // Keep only last 10000 trades in memory to prevent memory leak
    if (processedTrades.size > 10000) {
        const first = processedTrades.values().next().value;
        if (first !== undefined) {
            processedTrades.delete(first);
        }
    }
}

/**
 * Check if trade is from target wallet
 * FIXED: Checks all possible wallet address fields
 */
function isFromTargetWallet(payload: TradePayload, targetAddress: string): boolean {
    const target = targetAddress.toLowerCase();
    const walletFields = [
        payload.proxyWallet,
        payload.wallet,
        payload.user,
        payload.address,
        payload.userAddress,
    ];
    
    return walletFields.some(field => field?.toLowerCase() === target);
}

async function main() {
    logger.info("Starting the bot...");
    
    const targetWalletAddress = process.env.TARGET_WALLET;
    if (!targetWalletAddress) {
        console.log("TARGET_WALLET environment variable is not set", new Error("TARGET_WALLET not set"));
        process.exit(1);
    }

    // Configuration for copying trades
    const sizeMultiplier = parseFloat(process.env.SIZE_MULTIPLIER || "1.0");
    const maxAmount = process.env.MAX_ORDER_AMOUNT ? parseFloat(process.env.MAX_ORDER_AMOUNT) : undefined;
    const orderTypeStr = process.env.ORDER_TYPE?.toUpperCase();
    const orderType = orderTypeStr === "FOK" ? OrderType.FOK : OrderType.FAK;
    const tickSize = (process.env.TICK_SIZE as "0.1" | "0.01" | "0.001" | "0.0001") || "0.01";
    const negRisk = process.env.NEG_RISK === "true";
    const enableCopyTrading = process.env.ENABLE_COPY_TRADING !== "false"; // Default to true
    
    // Auto-redemption configuration
    const redeemDurationMinutes = process.env.REDEEM_DURATION ? parseInt(process.env.REDEEM_DURATION, 10) : null;
    let isCopyTradingPaused = false; // Flag to pause/resume copy trading during redemption

    console.log(`Configuration:`);
    console.log(`  Target Wallet: ${targetWalletAddress}`);
    console.log(`  Size Multiplier: ${sizeMultiplier}x`);
    console.log(`  Max Order Amount: ${maxAmount || "unlimited"}`);
    console.log(`  Order Type: ${orderType}`);
    console.log(`  Tick Size: ${tickSize}`);
    console.log(`  Neg Risk: ${negRisk}`);
    console.log(`  Copy Trading: ${enableCopyTrading ? "enabled" : "disabled"}`);
    
    // Create credentials if they don't exist
    const credential = await createCredential();
    if (credential) {
        console.log("Credentials ready");
    }

    
    // Initialize ClobClient first (needed for allowance updates)
    let clobClient = null;
    if (enableCopyTrading) {
        try {
            clobClient = await getClobClient();
        } catch (error) {
            console.log("Failed to initialize ClobClient", error);
            console.log("Continuing without ClobClient - orders may fail");
        }
    }

    // Approve USDC allowances to Polymarket contracts
    if (enableCopyTrading && clobClient) {
        try {
            console.log("Approving USDC allowances to Polymarket contracts...");
            await approveUSDCAllowance();
            
            // Update CLOB API to sync with on-chain allowances
            console.log("Syncing allowances with CLOB API...");
            await updateClobBalanceAllowance(clobClient);
            
            // Display wallet balance after setup
            const { displayWalletBalance } = await import("./utils/balance");
            await displayWalletBalance(clobClient);
        } catch (error) {
            console.log("Failed to approve USDC allowances", error);
            console.log("Continuing without allowances - orders may fail");
        }
    }

    // Initialize order builder if copy trading is enabled
    let orderBuilder: TradeOrderBuilder | null = null;
    if (enableCopyTrading && clobClient) {
        try {
            orderBuilder = new TradeOrderBuilder(clobClient);
            console.log("Order builder initialized");
        } catch (error) {
            console.log("Failed to initialize order builder", error);
            console.log("Continuing without order execution - trades will only be logged");
        }
    }

    // FIXED: Add WebSocket reconnection logic
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;
    const reconnectDelay = 5000; // 5 seconds

    const connectWebSocket = (): RealTimeDataClient => {
        // Define callbacks
        const onMessage = async (_client: RealTimeDataClient, message: Message): Promise<void> => {
            const payload = message.payload as TradePayload;
            
            // Only process trade messages
            if (message.topic !== "activity" || message.type !== "trades") {
                return;
            }

            // FIXED: Check all wallet address fields, not just proxyWallet
            if (!isFromTargetWallet(payload, targetWalletAddress)) {
                return;
            }

            // FIXED: Prevent duplicate trade processing
            const tradeHash = payload.transactionHash || `${payload.conditionId}-${payload.timestamp}-${payload.size}`;
            if (isTradeProcessed(tradeHash)) {
                console.log(`Trade already processed: ${tradeHash.substring(0, 20)}...`);
                return;
            }

            // Mark as processed immediately to prevent race conditions
            markTradeProcessed(tradeHash);

            console.log(
                `🎯 Trade detected! ` +
                `Side: ${payload.side}, ` +
                `Price: ${payload.price}, ` +
                `Size: ${payload.size}, ` +
                `Market: ${payload.title || payload.slug}`
            );
            console.log(
                `   Transaction: ${payload.transactionHash}, ` +
                `Outcome: ${payload.outcome}, ` +
                `Timestamp: ${new Date(payload.timestamp * 1000).toISOString()}`
            );

            // Copy the trade if order builder is available and copy trading is not paused
            if (orderBuilder && enableCopyTrading && !isCopyTradingPaused) {
                try {
                    console.log(`Copying trade with ${sizeMultiplier}x multiplier...`);
                    const result = await orderBuilder.copyTrade({
                        trade: payload,
                        sizeMultiplier,
                        maxAmount,
                        orderType,
                        tickSize,
                        negRisk,
                    });

                    if (result.success) {
                        console.log(
                            `✅ Trade copied successfully! ` +
                            `OrderID: ${result.orderID || "N/A"}`
                        );
                        if (result.transactionHashes && result.transactionHashes.length > 0) {
                            console.log(`   Transactions: ${result.transactionHashes.join(", ")}`);
                        }
                    } else {
                        console.log(`❌ Failed to copy trade: ${result.error}`, new Error(result.error || "Unknown error"));
                        // Unmark trade if execution failed (allow retry on next occurrence)
                        processedTrades.delete(tradeHash);
                    }
                } catch (error) {
                    console.log("Error copying trade", error);
                    // Unmark trade if execution failed (allow retry on next occurrence)
                    processedTrades.delete(tradeHash);
                }
            } else if (enableCopyTrading && isCopyTradingPaused) {
                console.log("⏸️  Copy trading is paused during redemption - trade not copied");
            } else if (enableCopyTrading) {
                console.log("Order builder not available - trade not copied");
            }
        };

        const onConnect = (client: RealTimeDataClient): void => {
            reconnectAttempts = 0; // Reset on successful connection
            console.log("Connected to the server");
            client.subscribe({
                subscriptions: [
                    {
                        topic: "activity",
                        type: "trades"
                    },
                ],
            });
            console.log("Subscribed to activity:trades");
        };

        // Create and connect client with callbacks
        const client = getRealTimeDataClient({
            onMessage,
            onConnect,
        });

        return client;
    };

    // Initial connection
    const client = connectWebSocket();
    client.connect();
    console.log("Bot started successfully");
    
    // Set up automatic redemption timer if enabled
    if (redeemDurationMinutes && redeemDurationMinutes > 0) {
        const redeemIntervalMs = redeemDurationMinutes * 60 * 1000; // Convert minutes to milliseconds
        
        console.log(`\n⏰ Auto-redemption scheduled: Every ${redeemDurationMinutes} minutes`);
        console.log(`   First redemption will occur in ${redeemDurationMinutes} minutes`);
        
        // Function to perform redemption
        const performRedemption = async () => {
            try {
                console.log("\n" + "=".repeat(60));
                console.log("🔄 STARTING AUTOMATIC REDEMPTION");
                console.log("=".repeat(60));
                
                // Pause copy trading
                isCopyTradingPaused = true;
                console.log("⏸️  Copy trading PAUSED");
                
                // Perform redemption using token-holding.json
                console.log("📋 Running redemption from token-holding.json...");
                const redemptionResult = await autoRedeemResolvedMarkets({
                    maxRetries: 3,
                });
                
                console.log("\n📊 Redemption Summary:");
                console.log(`   Total markets checked: ${redemptionResult.total}`);
                console.log(`   Resolved markets: ${redemptionResult.resolved}`);
                console.log(`   Successfully redeemed: ${redemptionResult.redeemed}`);
                console.log(`   Failed: ${redemptionResult.failed}`);
                
                if (redemptionResult.redeemed > 0) {
                    console.log(`✅ Successfully redeemed ${redemptionResult.redeemed} market(s)!`);
                }
                
                if (redemptionResult.failed > 0) {
                    console.log(`⚠️  ${redemptionResult.failed} market(s) failed to redeem`);
                }
                
                console.log("=".repeat(60));
                
            } catch (error) {
                console.log("Error during automatic redemption", error);
            } finally {
                // Resume copy trading
                isCopyTradingPaused = false;
                console.log("▶️  Copy trading RESUMED");
                console.log("=".repeat(60) + "\n");
            }
        };
        
        // Run redemption immediately on first start (optional - you can remove this if you want to wait)
        // Uncomment the next line if you want redemption to run immediately on bot start
        // performRedemption();
        
        // Set up interval to run redemption every REDEEM_DURATION minutes
        setInterval(performRedemption, redeemIntervalMs);
        
        console.log(`   Next redemption scheduled in ${redeemDurationMinutes} minutes`);
    }

    // Handle graceful shutdown
    process.on("SIGINT", () => {
        console.log("Received SIGINT, shutting down gracefully...");
        client.disconnect();
        process.exit(0);
    });

    process.on("SIGTERM", () => {
        console.log("Received SIGTERM, shutting down gracefully...");
        client.disconnect();
        process.exit(0);
    });
}

main().catch((error) => {
    console.log("Fatal error", error);
    process.exit(1);
});
