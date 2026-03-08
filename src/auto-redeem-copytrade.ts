#!/usr/bin/env ts-node
/**
 * Auto Redeem Script for Copy Trade Positions
 * 
 * Automatically redeems resolved markets from token-holding.json
 * - Runs every 200 seconds
 * - Checks all positions in token-holding.json
 * - Redeems winning positions from resolved markets
 * - Removes redeemed positions from file
 * 
 * Usage:
 *   ts-node src/auto-redeem-copytrade.ts
 *   npm run auto-redeem
 */

import { resolve } from "path";
import { existsSync, mkdirSync, appendFileSync } from "fs";
import { logger } from "./utils/logger";
import { redeemMarket, isMarketResolved } from "./utils/redeem";
import { getAllHoldings, clearMarketHoldings } from "./utils/holdings";
import { env } from "./config/env";

const HOLDINGS_FILE = resolve(process.cwd(), "src/data/token-holding.json");
const REDEEM_INTERVAL = 160 * 1000; // 200 seconds
const LOG_DIR = resolve(process.cwd(), "log");
const REDEEM_LOG_FILE = resolve(LOG_DIR, "holdings-redeem.log");

function redeemLog(line: string): void {
    try {
        if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
        appendFileSync(REDEEM_LOG_FILE, `[${new Date().toISOString()}] ${line}\n`);
    } catch (_) {}
}

// Statistics
let totalChecks = 0;
let totalRedeemed = 0;
let totalFailed = 0;

/**
 * Check and redeem positions from token-holding.json
 */
async function checkAndRedeemPositions(): Promise<void> {
    totalChecks++;
    
    logger.info("\n" + "═".repeat(70));
    logger.info(`🔄 AUTO-REDEEM CHECK #${totalChecks}`);
    logger.info("═".repeat(70));
    logger.info(`Time: ${new Date().toLocaleString()}`);
    
    // Load holdings from token-holding.json
    const holdings = getAllHoldings();
    const marketIds = Object.keys(holdings);
    
    if (marketIds.length === 0) {
        logger.info("📭 No open positions to check");
        logger.info("   (No markets in src/data/token-holding.json)");
        logger.info("═".repeat(70) + "\n");
        return;
    }
    
    logger.info(`📊 Checking ${marketIds.length} market(s)...\n`);
    
    let redeemedCount = 0;
    let failedCount = 0;
    let notResolvedCount = 0;
    
    // Check each market
    for (const conditionId of marketIds) {
        const tokens = holdings[conditionId];
        const tokenIds = Object.keys(tokens);
        const totalAmount = Object.values(tokens).reduce((sum: number, amt) => sum + (amt as number), 0);
        
        try {
            redeemLog(`REDEEM_CHECK conditionId=${conditionId} tokenIdsFromFile=${tokenIds.join(",")} totalAmount=${totalAmount.toFixed(2)}`);
            logger.info(`\n📍 Checking Market: ${conditionId.substring(0, 20)}...`);
            logger.info(`   Tokens: ${tokenIds.length} different token(s)`);
            logger.info(`   Total Amount: ${totalAmount.toFixed(2)} tokens`);
            
            // Check if market is resolved
            const { isResolved, winningIndexSets } = await isMarketResolved(conditionId);
            
            if (!isResolved) {
                notResolvedCount++;
                logger.info(`   Status: ⏳ Not resolved yet`);
                continue;
            }
            
            logger.success(`   Status: ✅ Resolved!`);
            logger.info(`   Winning outcomes: ${winningIndexSets?.join(", ") || "checking..."}`);
            
            // Try to redeem
            logger.info(`   🎯 Attempting redemption...`);
            
            try {
                redeemLog(`REDEEM_CALL conditionId=${conditionId}`);
                await redeemMarket(conditionId);
                redeemLog(`REDEEM_SUCCESS conditionId=${conditionId}`);
                // Redemption successful - clear from holdings
                clearMarketHoldings(conditionId);
                
                redeemedCount++;
                totalRedeemed++;
                
                logger.success(`   ✅ REDEEMED SUCCESSFULLY!`);
                logger.info(`   💰 Cleared from holdings (src/data/token-holding.json)`);
                
            } catch (redeemError) {
                failedCount++;
                totalFailed++;
                
                const errorMsg = redeemError instanceof Error ? redeemError.message : String(redeemError);
                
                // Check if error is because we don't hold winning tokens
                if (errorMsg.includes("don't hold any winning tokens") || 
                    errorMsg.includes("You don't have any tokens")) {
                    redeemLog(`REDEEM_FAIL conditionId=${conditionId} reason=no_winning_tokens_at_proxy (clearing from file)`);
                    logger.warning(`   ⚠️  Don't hold winning tokens (lost position)`);
                    logger.info(`   🗑️  Clearing from holdings anyway`);
                    
                    // Remove losing position from holdings
                    clearMarketHoldings(conditionId);
                } else {
                    redeemLog(`REDEEM_FAIL conditionId=${conditionId} error=${errorMsg.slice(0, 200)}`);
                    logger.error(`   ❌ Redemption failed: ${errorMsg}`);
                    logger.warning(`   Will retry on next check`);
                }
            }
            
        } catch (error) {
            failedCount++;
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.error(`   ❌ Error: ${errorMsg}`);
        }
    }
    
    // Reload to get updated count
    const updatedHoldings = getAllHoldings();
    const remaining = Object.keys(updatedHoldings).length;
    
    // Summary
    logger.info("\n" + "─".repeat(70));
    logger.info("📊 CHECK SUMMARY");
    logger.info("─".repeat(70));
    logger.info(`   Total Markets: ${marketIds.length}`);
    logger.info(`   Not Resolved: ${notResolvedCount} ⏳`);
    logger.info(`   Redeemed: ${redeemedCount} ✅`);
    logger.info(`   Failed: ${failedCount} ❌`);
    logger.info(`   Remaining: ${remaining} 💼`);
    logger.info("─".repeat(70));
    
    logger.info("\n" + "═".repeat(70));
    logger.info(`Next check in ${REDEEM_INTERVAL / 1000} seconds...`);
    logger.info("═".repeat(70) + "\n");
}

/**
 * Display statistics
 */
function displayStats(): void {
    const holdings = getAllHoldings();
    const positionCount = Object.keys(holdings).length;
    
    logger.info("\n" + "═".repeat(70));
    logger.info("📊 AUTO-REDEEM STATISTICS");
    logger.info("═".repeat(70));
    logger.info(`   Total Checks: ${totalChecks}`);
    logger.info(`   Total Redeemed: ${totalRedeemed} ✅`);
    logger.info(`   Total Failed: ${totalFailed} ❌`);
    logger.info(`   Open Positions: ${positionCount} 💼`);
    logger.info(`   Interval: ${REDEEM_INTERVAL / 1000} seconds`);
    logger.info("═".repeat(70) + "\n");
}

/**
 * Main function
 */
async function main() {
    logger.title("🤖 AUTO-REDEEM FOR COPY TRADE POSITIONS");
    logger.info("\n" + "═".repeat(70));
    logger.info("CONFIGURATION");
    logger.info("═".repeat(70));
    logger.info(`Holdings File: src/data/token-holding.json`);
    logger.info(`Check Interval: ${REDEEM_INTERVAL / 1000} seconds (${(REDEEM_INTERVAL / 60000).toFixed(1)} minutes)`);
    logger.info(`Proxy Wallet: ${env.PROXY_WALLET_ADDRESS}`);
    logger.info("═".repeat(70) + "\n");
    
    // Check current holdings
    const holdings = getAllHoldings();
    const count = Object.keys(holdings).length;
    if (count > 0) {
        logger.info(`💼 Found ${count} market(s) with holdings to monitor\n`);
    } else {
        logger.info("📭 No open positions found\n");
    }
    
    // Run first check immediately
    logger.info("🚀 Running initial redemption check...\n");
    await checkAndRedeemPositions();
    
    // Set up periodic checks
    setInterval(async () => {
        try {
            await checkAndRedeemPositions();
        } catch (error) {
            logger.error("Error during redemption check", error);
        }
    }, REDEEM_INTERVAL);
    
    // Display stats every 10 minutes
    setInterval(displayStats, 10 * 60 * 1000);
    
    logger.success("✅ Auto-redeem service is now running!");
    logger.info(`⏰ Will check for redemptions every ${REDEEM_INTERVAL / 1000} seconds`);
    logger.info("Press Ctrl+C to stop\n");
    
    // Handle graceful shutdown
    process.on("SIGINT", () => {
        logger.info("\n\n🛑 Stopping auto-redeem service...");
        displayStats();
        logger.success("✅ Service stopped");
        process.exit(0);
    });
    
    process.on("SIGTERM", () => {
        logger.info("\n\n🛑 Stopping auto-redeem service...");
        displayStats();
        logger.success("✅ Service stopped");
        process.exit(0);
    });
}

// Run the service
main().catch((error) => {
    logger.error("\n💥 FATAL ERROR");
    logger.error("═".repeat(70));
    logger.error(error instanceof Error ? error.message : String(error));
    logger.error("═".repeat(70));
    process.exit(1);
});

