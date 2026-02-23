import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
import { Chain } from "@polymarket/clob-client";

dotenvConfig({ path: resolve(process.cwd(), ".env") });

/**
 * Centralized configuration for all API URLs and endpoints
 */
export const config = {
    /**
     * CLOB API Configuration
     */
    clob: {
        apiUrl: process.env.CLOB_API_URL || "https://clob.polymarket.com",
    },

    /**
     * Data API Configuration
     */
    dataApi: {
        baseUrl: process.env.DATA_API_URL || "https://data-api.polymarket.com",
        positionsEndpoint: "/positions",
    },

    /**
     * Get full URL for data API endpoint
     */
    getDataApiUrl(endpoint: string = ""): string {
        return `${this.dataApi.baseUrl}${endpoint}`;
    },

    /**
     * WebSocket Configuration
     */
    websocket: {
        host: process.env.USER_REAL_TIME_DATA_URL || "wss://ws-live-data.polymarket.com",
        pingInterval: 5000,
    },

    /**
     * RPC Provider Configuration
     */
    rpc: {
        /**
         * Get RPC URL for a given chain ID
         */
        getUrl(chainId: number): string {
            const rpcToken = process.env.RPC_TOKEN;
            
            if (chainId === 137) {
                // Polygon Mainnet
                if (rpcToken) {
                    return `https://polygon-mainnet.g.alchemy.com/v2/${rpcToken}`;
                }
                return "https://polygon-rpc.com";
            } else if (chainId === 80002) {
                // Polygon Amoy Testnet
                if (rpcToken) {
                    return `https://polygon-amoy.g.alchemy.com/v2/${rpcToken}`;
                }
                return "https://rpc-amoy.polygon.technology";
            }
            
            throw new Error(`Unsupported chain ID: ${chainId}. Supported: 137 (Polygon), 80002 (Amoy)`);
        },
    },

    /**
     * Chain Configuration
     */
    chain: {
        chainId: parseInt(`${process.env.CHAIN_ID || Chain.POLYGON}`) as Chain,
    },
} as const;
