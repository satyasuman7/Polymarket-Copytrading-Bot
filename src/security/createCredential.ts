import { ApiKeyCreds, ClobClient } from "@polymarket/clob-client";
import { writeFileSync, existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { Wallet } from "@ethersproject/wallet";
import { logger } from "../utils/logger";
import { config } from "../utils/config";

export async function createCredential(): Promise<ApiKeyCreds | null> {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        logger.error("PRIVATE_KEY not found");
        return null;
    }

    // Check if credentials already exist
    // const credentialPath = resolve(process.cwd(), "src/data/credential.json");
    // if (existsSync(credentialPath)) {
    //     logger.info("Credentials already exist. Returning existing credentials.");
    //     return JSON.parse(readFileSync(credentialPath, "utf-8"));
    // }

    try {
        const wallet = new Wallet(privateKey);
        const chainId = config.chain.chainId;
        const host = config.clob.apiUrl;
        
        // Create temporary ClobClient just for credential creation
        const clobClient = new ClobClient(host, chainId, wallet);
        const credential = await clobClient.createOrDeriveApiKey();
        
        await saveCredential(credential);
        logger.success("Credential created successfully");
        return credential;
    } catch (error) {
        logger.error(`Error creating credential: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}   

export async function saveCredential(credential: ApiKeyCreds) {
    const credentialPath = resolve(process.cwd(), "src/data/credential.json");
    writeFileSync(credentialPath, JSON.stringify(credential, null, 2));
}