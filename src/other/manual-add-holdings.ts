#!/usr/bin/env ts-node

/**
 * Utility script to manually add holdings to token-holding.json
 * Use this if you have existing tokens that weren't tracked by the bot
 */

import { addHoldings, getAllHoldings, loadHoldings } from "../utils/holdings";
import { logger } from "../utils/logger";

// Example usage:
// npm run manual-add-holdings

// Replace these with your actual values
// You can find these in your Polymarket transaction history or wallet

const MANUAL_HOLDINGS: Array<{
    conditionId: string;  // Market condition ID (long hex string)
    tokenId: string;      // Token ID (long hex string)
    amount: number;       // Number of tokens/shares you own
    description?: string; // Optional: description for your reference
}> = [
    {
        conditionId: "0x9004b4c7b16708a0fde815f9e0ea21113e62ddd7b4694cb57df60da875adb0de",
        tokenId: "24720261270920665992433021530232576012344221618298787003133801912636105153748",
        amount: 5.0,
        description: "Bitcoin Up or Down - Jan 8 - UP token"
    },
];

async function main() {
    logger.info("🔄 Manual Holdings Adder");
    logger.info("=" .repeat(70));
    
    if (MANUAL_HOLDINGS.length === 0) {
        logger.warning("⚠️  No holdings defined in MANUAL_HOLDINGS array");
        logger.info("\nTo add holdings, edit this file and add entries like:");
        logger.info(`
const MANUAL_HOLDINGS = [
    {
        conditionId: "0x1234...",  // Market condition ID
        tokenId: "0xabcd...",      // Token ID  
        amount: 5.0,               // Number of shares you own
        description: "Optional description"
    },
];
        `);
        logger.info("\n💡 You can find conditionId and tokenId from:");
        logger.info("   - Your Polymarket transaction history");
        logger.info("   - The bot's trade logs");
        logger.info("   - Your wallet's token holdings");
        return;
    }
    
    logger.info(`\nFound ${MANUAL_HOLDINGS.length} holding(s) to add\n`);
    
    // Show current holdings
    const current = getAllHoldings();
    const currentCount = Object.keys(current).reduce((sum, marketId) => {
        return sum + Object.keys(current[marketId] || {}).length;
    }, 0);
    
    logger.info(`Current holdings: ${currentCount} token(s) across ${Object.keys(current).length} market(s)`);
    
    // Add each holding
    let added = 0;
    let updated = 0;
    
    for (const holding of MANUAL_HOLDINGS) {
        try {
            const before = loadHoldings();
            const hadBefore = before[holding.conditionId]?.[holding.tokenId] !== undefined;
            const beforeAmount = hadBefore ? before[holding.conditionId][holding.tokenId] : 0;
            
            addHoldings(holding.conditionId, holding.tokenId, holding.amount);
            
            if (hadBefore) {
                updated++;
                logger.info(`✅ Updated: ${holding.conditionId.substring(0, 10)}... -> ${holding.tokenId.substring(0, 10)}...`);
                logger.info(`   ${beforeAmount.toFixed(2)} → ${(beforeAmount + holding.amount).toFixed(2)} tokens`);
            } else {
                added++;
                logger.info(`✅ Added: ${holding.conditionId.substring(0, 10)}... -> ${holding.tokenId.substring(0, 10)}...`);
                logger.info(`   ${holding.amount.toFixed(2)} tokens`);
            }
            
            if (holding.description) {
                logger.info(`   Description: ${holding.description}`);
            }
            logger.info("");
        } catch (error) {
            logger.error(`❌ Failed to add holding: ${holding.conditionId.substring(0, 10)}...`);
            logger.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    // Show final state
    const final = getAllHoldings();
    const finalCount = Object.keys(final).reduce((sum, marketId) => {
        return sum + Object.keys(final[marketId] || {}).length;
    }, 0);
    
    logger.info("=" .repeat(70));
    logger.success(`\n✅ Complete!`);
    logger.info(`   Added: ${added} holding(s)`);
    logger.info(`   Updated: ${updated} holding(s)`);
    logger.info(`   Total holdings: ${finalCount} token(s) across ${Object.keys(final).length} market(s)`);
    logger.info(`\n📁 File: src/data/token-holding.json`);
    
    // Show summary
    if (Object.keys(final).length > 0) {
        logger.info("\n📊 Current Holdings Summary:");
        for (const [marketId, tokens] of Object.entries(final)) {
            logger.info(`\n   Market: ${marketId.substring(0, 20)}...`);
            for (const [tokenId, amount] of Object.entries(tokens)) {
                logger.info(`     Token: ${tokenId.substring(0, 20)}... → ${amount.toFixed(2)} shares`);
            }
        }
    }
}

main().catch((error) => {
    logger.error("Fatal error:", error);
    process.exit(1);
});

