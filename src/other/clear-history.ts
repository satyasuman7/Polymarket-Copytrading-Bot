#!/usr/bin/env ts-node
/**
 * Clear Trade History
 * 
 * Deletes the trade history file to allow re-trading markets
 * Use this if you want to reset and start fresh
 * 
 * Usage:
 *   ts-node src/clear-history.ts
 *   bun src/clear-history.ts
 */

import { resolve } from "path";
import { existsSync, unlinkSync, readFileSync } from "fs";
import { logger } from "../utils/logger";

const LOG_DIR = resolve(process.cwd(), "log");
const HISTORY_FILE = resolve(LOG_DIR, "trade-history.json");

async function main() {
    logger.title("🗑️  CLEAR TRADE HISTORY");
    logger.info("\n" + "═".repeat(70));
    
    if (!existsSync(HISTORY_FILE)) {
        logger.warning("⚠️  No trade history file found");
        logger.info(`   Looking for: ${HISTORY_FILE}`);
        logger.info("\n   Nothing to clear!");
        logger.info("═".repeat(70));
        return;
    }
    
    // Show current history
    try {
        const data = JSON.parse(readFileSync(HISTORY_FILE, "utf-8"));
        const count = Object.keys(data).length;
        
        logger.info("📚 CURRENT TRADE HISTORY");
        logger.info("═".repeat(70));
        logger.info(`   Total trades in history: ${count}`);
        logger.info(`   File: ${HISTORY_FILE}`);
        
        if (count > 0) {
            logger.info("\n   Recent trades:");
            const entries = Object.entries(data).slice(-5);
            entries.forEach(([key, value]: [string, any]) => {
                logger.info(`   - ${value.market || "Unknown"} (${value.side}) at ${value.timestamp}`);
            });
        }
        
        logger.info("\n═".repeat(70));
        
    } catch (error) {
        logger.error("Could not read history file");
    }
    
    // Ask for confirmation (auto-confirm in script)
    logger.warning("\n⚠️  This will delete all trade history!");
    logger.info("   The bot will be able to copy trades again for previously traded markets.");
    logger.info("\n   Deleting in 3 seconds... (Press Ctrl+C to cancel)");
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Delete the file
    try {
        unlinkSync(HISTORY_FILE);
        logger.success("\n✅ Trade history cleared!");
        logger.info("   Bot will now copy all trades (including previously traded markets)");
        logger.info("   Restart the bot to start fresh");
    } catch (error) {
        logger.error("Failed to delete history file", error);
        process.exit(1);
    }
    
    logger.info("\n═".repeat(70));
}

main().catch((error) => {
    logger.error("Error", error);
    process.exit(1);
});

