import { RealTimeDataClient, type RealTimeDataClientArgs } from "@polymarket/real-time-data-client";
import { config } from "../utils/config";

/**
 * Get a RealTimeDataClient instance with optional callbacks.
 * @param args - Configuration options including callbacks for the client.
 * @returns A RealTimeDataClient instance.
 */
export function getRealTimeDataClient(args?: RealTimeDataClientArgs): RealTimeDataClient {
    return new RealTimeDataClient({
        host: config.websocket.host,
        pingInterval: config.websocket.pingInterval,
        ...args,
    });
}
