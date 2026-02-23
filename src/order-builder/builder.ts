import { ClobClient, OrderType, Side, AssetType } from "@polymarket/clob-client";
import type { UserMarketOrder, CreateOrderOptions } from "@polymarket/clob-client";
import type { TradePayload } from "../utils/types";
import type { CopyTradeOptions, CopyTradeResult } from "./types";
import { tradeToMarketOrder, getDefaultOrderOptions } from "./helpers";
import { addHoldings, getHoldings, removeHoldings } from "../utils/holdings";
import { approveTokensAfterBuy, updateClobBalanceAllowance } from "../security/allowance";
import { validateBuyOrderBalance, validateSellOrderBalance, displayWalletBalance } from "../utils/balance";

/**
 * Order builder for copying trades
 * Handles conversion of trade data to executable market orders
 */
export class TradeOrderBuilder {
    private client: ClobClient;

    constructor(client: ClobClient) {
        this.client = client;
    }

    /**
     * Copy a trade by placing a market order
     */
    async copyTrade(options: CopyTradeOptions): Promise<CopyTradeResult> {   
        try {
            const { trade, tickSize = "0.01", negRisk = false, orderType = OrderType.FAK } = options;
            const marketId = trade.conditionId;
            const tokenId = trade.asset;

            // For SELL orders, check holdings and sell all available
            if (trade.side.toUpperCase() === "SELL") {
                const holdingsAmount = getHoldings(marketId, tokenId);
                
                if (holdingsAmount <= 0) {
                    console.log(
                        `[WARNING] No holdings found for token ${tokenId} in market ${marketId}. ` +
                        `Skipping SELL order.`
                    );
                    return {
                        success: false,
                        error: "No holdings available to sell",
                    };
                }

                // Validate available balance (accounting for open orders)
                // FIXED: Re-enabled balance validation for SELL orders
                const balanceCheck = await validateSellOrderBalance(
                    this.client,
                    tokenId,
                    holdingsAmount
                );

                if (!balanceCheck.valid) {
                    console.log(
                        `[WARNING] Insufficient balance for SELL order. ` +
                        `Required: ${balanceCheck.required}, Available: ${balanceCheck.available}. ` +
                        `Using available balance instead.`
                    );
                    
                    if (balanceCheck.available <= 0) {
                        return {
                            success: false,
                            error: `Insufficient token balance. Available: ${balanceCheck.available}`,
                        };
                    }
                }

                // Use the minimum of holdings and available balance
                const sellAmount = Math.min(holdingsAmount, balanceCheck.available);

                // console.log("[INFO] 
                //     `Selling tokens: Holdings=${holdingsAmount}, Available=${balanceCheck.available}, Selling=${sellAmount}`
                // );

                // For SELL, amount is in shares
                const marketOrder: UserMarketOrder = {
                    tokenID: tokenId,
                    side: Side.SELL,
                    amount: sellAmount,
                    orderType,
                };

                const orderOptions: Partial<CreateOrderOptions> = getDefaultOrderOptions(tickSize, negRisk);

                console.log(`[INFO] Placing SELL market order: ${sellAmount} shares (type: ${orderType})`);
                
                const response = await this.client.createAndPostMarketOrder(
                    marketOrder,
                    orderOptions,
                    orderType
                );

                // Check if order was successful
                if (!response || (response.status && response.status !== "FILLED" && response.status !== "PARTIALLY_FILLED")) {
                    console.log(`[WARNING] Order may not have been fully successful. Status: ${response?.status || "unknown"}`);
                }

                // For SELL orders, makingAmount is tokens sold
                // Parse the amount (might be in string format with decimals)
                const tokensSold = response.makingAmount 
                    ? parseFloat(response.makingAmount) 
                    : sellAmount;

                // Remove from holdings after successful sell
                if (tokensSold > 0) {
                    removeHoldings(marketId, tokenId, tokensSold);
                    console.log(`[INFO] ✅ Removed ${tokensSold} tokens from holdings: ${marketId} -> ${tokenId}`);
                } else {
                    console.log(`[WARNING] No tokens were sold - not removing from holdings`);
                }

                console.log(
                    `[SUCCESS] SELL order executed! ` +
                    `OrderID: ${response.orderID || "N/A"}, ` +
                    `Tokens sold: ${tokensSold}, ` +
                    `Status: ${response.status || "N/A"}`
                );

                return {
                    success: true,
                    orderID: response.orderID,
                    transactionHashes: response.transactionsHashes,
                    marketOrder,
                };
            }

            // For BUY orders, proceed normally
            console.log(
                `[INFO] Building order to copy trade: ${trade.side} ${trade.size} @ ${trade.price} ` +
                `for token ${tokenId.substring(0, 20)}...`
            );

            // Convert trade to market order
            const marketOrder = tradeToMarketOrder(options);
            
            // Update CLOB API balance allowance before checking (ensures latest state)
            try {
                await this.client.updateBalanceAllowance({ asset_type: AssetType.COLLATERAL });
            } catch (error) {
                console.log(`[WARNING] Failed to update balance allowance: ${error instanceof Error ? error.message : String(error)}`);
            }
            
            // Display current wallet balance
            await displayWalletBalance(this.client);
            
            // Validate available USDC balance before placing BUY order
            const balanceCheck = await validateBuyOrderBalance(
                this.client,
                marketOrder.amount
            );

            if (!balanceCheck.valid) {
                console.log(
                    `[WARNING] Insufficient USDC balance for BUY order. ` +
                    `Required: ${balanceCheck.required}, Available: ${balanceCheck.available}. ` +
                    `Adjusting order amount to available balance.`
                );
                
                if (balanceCheck.available <= 0) {
                    return {
                        success: false,
                        error: `Insufficient USDC balance. Available: ${balanceCheck.available}`,
                    };
                }

                // Adjust order amount to available balance
                marketOrder.amount = balanceCheck.available;
                console.log(`[INFO] Adjusted order amount to available balance: ${marketOrder.amount}`);
            }
            
            // Get order options
            const orderOptions: Partial<CreateOrderOptions> = getDefaultOrderOptions(tickSize, negRisk);

            // Place the market order
            console.log(`[INFO] Placing ${marketOrder.side} market order: ${marketOrder.amount} (type: ${orderType})`);
            
            const response = await this.client.createAndPostMarketOrder(
                marketOrder,
                orderOptions,
                orderType
            );

            // Check if order was successful
            if (!response || (response.status && response.status !== "FILLED" && response.status !== "PARTIALLY_FILLED")) {
                console.log(`[WARNING] Order may not have been fully successful. Status: ${response?.status || "unknown"}`);
            }

            // Get the actual filled amount from response
            // For BUY orders: makingAmount = USDC spent, takingAmount = tokens received
            const tokensReceived = response.takingAmount 
                ? parseFloat(response.takingAmount) 
                : 0;
            
            // Add to holdings after successful buy (only if we received tokens)
            if (tokensReceived > 0) {
                addHoldings(marketId, tokenId, tokensReceived);
                console.log(`[INFO] ✅ Added ${tokensReceived} tokens to holdings: ${marketId} -> ${tokenId}`);
            } else {
                // Fallback: estimate from order amount if response doesn't have takingAmount
                // For BUY: amount is USDC, so tokens = USDC / price
                const estimatedTokens = marketOrder.amount / (trade.price || 1);
                if (estimatedTokens > 0) {
                    addHoldings(marketId, tokenId, estimatedTokens);
                    console.log(`[WARNING] Using estimated token amount: ${estimatedTokens} (actual amount not in response)`);
                } else {
                    console.log(`[WARNING] No tokens received and cannot estimate - not adding to holdings`);
                }
            }

            // Approve tokens immediately after buying so they can be sold without delay
            try {
                await approveTokensAfterBuy();
            } catch (error) {
                console.log(`[WARNING] Failed to approve tokens after buy: ${error instanceof Error ? error.message : String(error)}`);
            }

            console.log(
                `[SUCCESS] BUY order executed! ` +
                `OrderID: ${response.orderID || "N/A"}, ` +
                `Tokens received: ${tokensReceived || "estimated"}, ` +
                `Status: ${response.status || "N/A"}`
            );

            return {
                success: true,
                orderID: response.orderID,
                transactionHashes: response.transactionsHashes,
                marketOrder,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // If it's a balance/allowance error, show current balance
            if (errorMessage.includes("not enough balance") || errorMessage.includes("allowance")) {
                console.log("═══════════════════════════════════════");
                console.log("[ERROR] ❌ ORDER FAILED: Balance/Allowance Error");
                console.log("═══════════════════════════════════════");
                
                // Try to display current balance
                try {
                    await displayWalletBalance(this.client);
                    // Try updating allowance and retry
                    console.log("[INFO] Attempting to update balance allowance...");
                    await this.client.updateBalanceAllowance({ asset_type: AssetType.COLLATERAL });
                } catch (balanceError) {
                    console.log(`[ERROR] Failed to get balance: ${balanceError instanceof Error ? balanceError.message : String(balanceError)}`);
                }
                
                console.log("═══════════════════════════════════════");
            }
            
            console.log(`[ERROR] Failed to copy trade: ${errorMessage}`);
            
            return {
                success: false,
                error: errorMessage,
            };
        }
    }

    /**
     * Place a market buy order
     */
    async placeMarketBuy(
        tokenID: string,
        amount: number,
        options?: {
            tickSize?: CreateOrderOptions["tickSize"];
            negRisk?: boolean;
            orderType?: OrderType.FOK | OrderType.FAK;
            price?: number;
        }
    ): Promise<CopyTradeResult> {
        const marketOrder: UserMarketOrder = {
            tokenID,
            side: Side.BUY,
            amount,
            orderType: options?.orderType || OrderType.FAK,
            ...(options?.price !== undefined && { price: options.price }),
        };

        const orderOptions: Partial<CreateOrderOptions> = getDefaultOrderOptions(
            options?.tickSize,
            options?.negRisk
        );

        try {
            const response = await this.client.createAndPostMarketOrder(
                marketOrder,
                orderOptions,
                marketOrder.orderType || OrderType.FAK
            );

            return {
                success: true,
                orderID: response.orderID,
                transactionHashes: response.transactionsHashes,
                marketOrder,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                error: errorMessage,
            };
        }
    }

    /**
     * Place a market sell order
     */
    async placeMarketSell(
        tokenID: string,
        amount: number,
        options?: {
            tickSize?: CreateOrderOptions["tickSize"];
            negRisk?: boolean;
            orderType?: OrderType.FOK | OrderType.FAK;
            price?: number;
        }
    ): Promise<CopyTradeResult> {
        const marketOrder: UserMarketOrder = {
            tokenID,
            side: Side.SELL,
            amount,
            orderType: options?.orderType || OrderType.FAK,
            ...(options?.price !== undefined && { price: options.price }),
        };

        const orderOptions: Partial<CreateOrderOptions> = getDefaultOrderOptions(
            options?.tickSize,
            options?.negRisk
        );

        try {
            const response = await this.client.createAndPostMarketOrder(
                marketOrder,
                orderOptions,
                marketOrder.orderType || OrderType.FAK
            );

            return {
                success: true,
                orderID: response.orderID,
                transactionHashes: response.transactionsHashes,
                marketOrder,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                error: errorMessage,
            };
        }
    }
}

