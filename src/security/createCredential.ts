import { ApiKeyCreds, ClobClient } from "@polymarket/clob-client";
import { writeFileSync, existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { Wallet } from "@ethersproject/wallet";
import { config } from "../utils/config";

export async function createCredential(): Promise<ApiKeyCreds | null> {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        console.log("[ERROR] PRIVATE_KEY not found");
        return null;
    }

    // Check if credentials already exist
    // const credentialPath = resolve(process.cwd(), "src/data/credential.json");
    // if (existsSync(credentialPath)) {
    //     console.log(`[INFO] Credentials already exist. Returning existing credentials.`);
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
        console.log("[SUCCESS] Credential created successfully");
        return credential;
    } catch (error) {
        console.log(`[ERROR] Error creating credential: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}   

export async function saveCredential(credential: ApiKeyCreds) {
    const credentialPath = resolve(process.cwd(), "src/data/credential.json");
    writeFileSync(credentialPath, JSON.stringify(credential, null, 2));
}