#!/usr/bin/env ts-node
/**
 * Polymarket Copy Trade (WebSocket)
 * Receives target wallet trades via WebSocket → processTrade (shared core).
 * Same copy-trade logic as copytrade-api; only trade source differs.
 * Usage: npm run start
 */

import { logger } from "./utils/logger";
import { createCredential } from "./security/createCredential";
import { approveUSDCAllowance, updateClobBalanceAllowance } from "./security/allowance";
import { getRealTimeDataClient } from "./providers/wssProvider";
import { getClobClient } from "./providers/clobclient";
import type { Message } from "@polymarket/real-time-data-client";
import { RealTimeDataClient } from "@polymarket/real-time-data-client";
import { AssetType } from "@polymarket/clob-client";
import type { TradePayload } from "./utils/types";
import { env } from "./config/env";
import { displayWalletBalance, getAvailableBalance } from "./utils/balance";
import {
    processTrade,
    refreshCachedAvailableUsdc,
    loadProcessedTrades,
    getTargetWallets,
    getWalletOrderSize,
} from "./copy-trade/core";
import type { TradeForProcess } from "./copy-trade/core";

async function main() {
    const enableCopyTrading = env.ENABLE_COPY_TRADING;
    const targetCount = getTargetWallets().length;
    const WALLET_ORDER_SIZE = getWalletOrderSize();

    if (enableCopyTrading && targetCount === 0) {
        logger.error("No target wallets in src/config/config.json");
        process.exit(1);
    }

    const dryRun = env.DRY_RUN;
    logger.info(dryRun ? "Starting WebSocket copy-trade bot (DRY RUN – no orders placed)..." : "Starting WebSocket copy-trade bot (LIVE – orders enabled)...");
    if (dryRun) logger.warning("⚠️  DRY_RUN=true: Only logging. Set DRY_RUN=false in .env to place real orders.");
    logger.info(
        `  Order: ${env.ORDER_SIZE_IN_TOKENS ? "token amount" : "fixed USDC (config.json)"} | ` +
            `Wallets: ${targetCount} | Telegram: ${env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID ? "on" : "off"}`
    );

    loadProcessedTrades();
    await createCredential();

    let clobClient: Awaited<ReturnType<typeof getClobClient>> | null = null;
    if (enableCopyTrading) {
        clobClient = await getClobClient();
        await displayWalletBalance(clobClient);
        await approveUSDCAllowance();
        await updateClobBalanceAllowance(clobClient);
        if (env.ORDER_SIZE_IN_TOKENS) {
            await refreshCachedAvailableUsdc(clobClient);
            setInterval(async () => {
                try {
                    if (clobClient) await refreshCachedAvailableUsdc(clobClient);
                } catch (_) {}
            }, 150 * 1000);
        }
    }

    const onMessage = async (_c: RealTimeDataClient, message: Message): Promise<void> => {
        // Log ALL WebSocket data to verify connection
        
        if (message.topic !== "activity" || message.type !== "trades") return;
        const payload = message.payload as TradePayload;
        
        const wallet = payload.proxyWallet?.toLowerCase();
        
        if (!wallet || !(wallet in WALLET_ORDER_SIZE) || WALLET_ORDER_SIZE[wallet] <= 0) return;
        logger.info(`[WS] topic=${message.topic} type=${message.type} payload=${JSON.stringify(message.payload)}`);

        const tReceived = Date.now();
        logger.info(`📥 Trade received | ${payload.side} ${payload.title || payload.slug} | $${payload.price} | wallet: ${wallet.substring(0, 10)}...`);

        const trade: TradeForProcess = {
            asset: payload.asset,
            conditionId: payload.conditionId,
            eventSlug: payload.eventSlug,
            outcome: payload.outcome,
            outcomeIndex: payload.outcomeIndex ?? 0,
            price: payload.price ?? 0,
            proxyWallet: payload.proxyWallet,
            side: payload.side,
            size: payload.size,
            slug: payload.slug,
            timestamp: payload.timestamp,
            title: payload.title,
            transactionHash: payload.transactionHash,
            sourceWallet: payload.proxyWallet,
        };

        try {
            const configAmount = WALLET_ORDER_SIZE[wallet];
            const amountUsdc = env.ORDER_SIZE_IN_TOKENS
                ? Math.max(1, configAmount * (payload.price ?? 0))
                : Math.max(1, configAmount);
            if (env.DRY_RUN) {
                logger.info(
                    `   [DRY RUN] Would place ${payload.side} | ` +
                        `Market: ${payload.title || payload.slug} | ` +
                        `Outcome: ${payload.outcome} | ` +
                        `$${payload.price} × size ${payload.size} | ` +
                        `Config: ${configAmount} → ~$${amountUsdc.toFixed(2)} USDC`
                );
                logger.info(`   [DRY RUN] asset=${payload.asset?.substring(0, 20)}... tx=${payload.transactionHash?.substring(0, 16)}...`);
            } else {
                await processTrade(trade);
            }
        } catch (err) {
            logger.error("Copy trade error", err);
        }
    };

    const onConnect = (client: RealTimeDataClient): void => {
        logger.success("WebSocket connected");
        client.subscribe({ subscriptions: [{ topic: "activity", type: "trades" }] });
    };

    getRealTimeDataClient({ onMessage, onConnect }).connect();
    logger.success("Bot running (WebSocket)\n");
}

main().catch((e) => {
    logger.error("Fatal", e);
    process.exit(1);
});
