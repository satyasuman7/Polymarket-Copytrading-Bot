import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionResponse,
  clusterApiUrl,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import base58 from 'bs58';
import { Types } from 'mongoose';
import { AnchorProvider, Program, web3 } from '@coral-xyz/anchor';
import { Pumpfun } from './pumpfun'
import idl from "./pumpfun.json"
import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet';
import * as anchor from '@coral-xyz/anchor';
import { io } from '../sockets';
import axios from 'axios';
import Coin from '../models/Coin';
import User from '../models/User';
import { Metaplex } from '@metaplex-foundation/js';
import CoinStatus from '../models/CoinsStatus';
import { coinKing } from '../controller/coinController';
import CurveConfig from '../models/CurveConfig';
import { ASSOCIATED_TOKEN_PROGRAM_ID, DEVNET_PROGRAM_ID, MarketV2, TOKEN_PROGRAM_ID } from '@raydium-io/raydium-sdk';
import { NATIVE_MINT } from '@solana/spl-token';
import { ammProgram, marketProgram, feeDestination, makeTxVersion } from '../utils/constants';
import { createMarket } from './createMarket';
// import {
//   Metadata,
// } from '@metaplex/js';

require('dotenv').config();

export const commitmentLevel = "processed";
export const endpoint = process.env.PUBLIC_SOLANA_RPC || clusterApiUrl("devnet");
export const connection = new Connection(endpoint, commitmentLevel);
// export const connection = new Connection('https://white-aged-glitter.solana-mainnet.quiknode.pro/743d4e1e3949c3127beb7f7815cf2ca9743b43a6/');

const privateKey = base58.decode(process.env.PRIVATE_KEY!);

export const pumpProgramInterface = JSON.parse(JSON.stringify(idl));

const adminKeypair = web3.Keypair.fromSecretKey(privateKey);
const adminWallet = new NodeWallet(adminKeypair);
const provider = new AnchorProvider(connection, adminWallet, {
  preflightCommitment: "confirmed",
});
anchor.setProvider(provider);
const program = new Program(
  pumpProgramInterface,
  provider
) as Program<Pumpfun>;




const metaplex = Metaplex.make(connection);
let token: PublicKey;
// Function to handle `launchEvent`
const handleLaunchEvent = async (event: any) => {
  
};

// Function to handle `swapEvent`
const handleSwapEvent = async (event: any) => {
  
};

// Function to handle `completeEvent`
const handleCompleteEvent = async (event: any) => {
  console.log("Complete Event received:", event);
};

// Function to handle `withdrawEvent`
const handleWithdrawEvent = async (event: any) => {
};

// Function to handle `MigrateEvent`
const handleMigrateEvent = async (event: any) => {
  console.log("Migrate Event received:", event);
  // Handle your withdraw event here
};

// Function to handle `withdrawEvent`
const handleConfigEvent = async (event: any) => {
  console.log("Withdraw Event received:", event);
  // Handle your withdraw event here
  await CurveConfig.updateOne(
    {},
    { $set: { curveLimit: event.curveLimit } },
    { upsert: true } // Create a new document if none exists
  );
};

const handleMigrate = async (token: PublicKey) => {
  
}








let eventListenerConnected: boolean = false;

export const listenerForEvents = async () => {
};

// Call the listener function to start listening for events
listenerForEvents().catch(err => {
  console.error("Error setting up listener:", err);
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// TODO: use a better API source
export const getSolPriceInUSD = async () => {
};

export interface CoinInfo {
  creator: string;
  name: string;
  ticker: string;
  url: string;
  description?: string;
  token: string;
  tokenReserves: number;
  lamportReserves: number;
  marketcap: number;
  presale?: number;
  decimals: number;
}

export type CoinInfoRequest = Omit<
  CoinInfo,
  "tokenReserves" | "lamportReserves" | "marketcap"
> & { tx: string; tokenReserves: number; lamportReserves: number };

export interface ResultType {
  tx: string;
  mint: string;
  user: string;
  swapDirection: number;
  lamportAmount: number;
  tokenAmount: number;
  tokenReserves: number;
  lamportReserves: number;
}
