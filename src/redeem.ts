#!/usr/bin/env bun
/**
 * Standalone script to redeem positions for resolved markets
 * 
 * Usage:
 *   bun src/redeem.ts <conditionId> [indexSets...]
 *   bun src/redeem.ts 0x5f65177b394277fd294cd75650044e32ba009a95022d88a0c1d565897d72f8f1 1 2
 * 
 * Or set CONDITION_ID and INDEX_SETS in .env file
 */

import { redeemPositions, redeemMarket } from "./utils/redeem";
import { getAllHoldings, getMarketHoldings } from "./utils/holdings";

import { resolve } from "path";
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: resolve(process.cwd(), ".env") });

async function main() {
    const args = process.argv.slice(2);

    // Get condition ID from args or env
    let conditionId: string | undefined;
    let indexSets: number[] | undefined;

    if (args.length > 0) {
        conditionId = args[0];
        if (args.length > 1) {
            indexSets = args.slice(1).map(arg => parseInt(arg, 10));
        }
    } else {
        conditionId = process.env.CONDITION_ID;
        const indexSetsEnv = process.env.INDEX_SETS;
        if (indexSetsEnv) {
            indexSets = indexSetsEnv.split(",").map(s => parseInt(s.trim(), 10));
        }
    }

    // If no conditionId provided, show holdings and prompt
    if (!conditionId) {
        console.log(`[INFO] No condition ID provided. Showing current holdings...`);
        const holdings = getAllHoldings();
        
        if (Object.keys(holdings).length === 0) {
            console.log(`[WARNING] No holdings found.`);
            console.log(`[INFO] \nUsage:`);
            console.log(`[INFO]   bun src/redeem.ts <conditionId> [indexSets...]`);
            console.log(`[INFO]   bun src/redeem.ts 0x5f65177b394277fd294cd75650044e32ba009a95022d88a0c1d565897d72f8f1 1 2`);
            console.log(`[INFO] \nOr set in .env:`);
            console.log(`[INFO]   CONDITION_ID=0x5f65177b394277fd294cd75650044e32ba009a95022d88a0c1d565897d72f8f1`);
            console.log(`[INFO]   INDEX_SETS=1,2`);
            process.exit(1);
        }

        console.log(`[INFO] \nCurrent Holdings:`);
        for (const [marketId, tokens] of Object.entries(holdings)) {
            console.log(`[INFO]   Market: ${marketId}`);
            for (const [tokenId, amount] of Object.entries(tokens)) {
                console.log(`[INFO]     Token ${tokenId.substring(0, 20)}...: ${amount}`);
            }
        }
        console.log(`[INFO] \nTo redeem a market, provide the conditionId (market ID) as an argument.`);
        console.log(`[INFO] Example: bun src/redeem.ts <conditionId>`);
        process.exit(0);
    }

    // Default to [1, 2] for Polymarket binary markets if not specified
    if (!indexSets || indexSets.length === 0) {
        console.log(`[INFO] No index sets specified, using default [1, 2] for Polymarket binary markets`);
        indexSets = [1, 2];
    }

    // Show holdings for this market if available
    const marketHoldings = getMarketHoldings(conditionId!);
    if (Object.keys(marketHoldings).length > 0) {
        console.log(`[INFO] \nHoldings for market ${conditionId}:`);
        for (const [tokenId, amount] of Object.entries(marketHoldings)) {
            console.log(`[INFO]   Token ${tokenId.substring(0, 20)}...: ${amount}`);
        }
    } else {
        console.log(`[WARNING] No holdings found for market ${conditionId}`);
    }

    try {
        console.log(`[INFO] \nRedeeming positions for condition: ${conditionId}`);
        console.log(`[INFO] Index Sets: ${indexSets.join(", ")}`);

        // Use the simple redeemMarket function
        const receipt = await redeemMarket(conditionId!);

        console.log(`[SUCCESS] \n✅ Successfully redeemed positions!`);
        console.log(`[INFO] Transaction hash: ${receipt.transactionHash}`);
        console.log(`[INFO] Block number: ${receipt.blockNumber}`);
        console.log(`[INFO] Gas used: ${receipt.gasUsed.toString()}`);

        // Automatically clear holdings after successful redemption
        try {
            const { clearMarketHoldings } = await import("./utils/holdings");
            clearMarketHoldings(conditionId!);
            console.log(`[INFO] \n✅ Cleared holdings record for this market from token-holding.json`);
        } catch (clearError) {
            console.log(`[WARNING] Failed to clear holdings: ${clearError instanceof Error ? clearError.message : String(clearError)}`);
            // Don't fail if clearing holdings fails
        }
    } catch (error) {
        console.log(`[ERROR] \n❌ Failed to redeem positions:`, error);
        if (error instanceof Error) {
            console.log(`[ERROR] Error message: ${error.message}`);
        }
        process.exit(1);
    }
}

main().catch((error) => {
    console.log(`[ERROR] Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});

