import express from "express";
import mongoose from "mongoose";
import CoinStatus from "../models/CoinsStatus";
import Coin from "../models/Coin";
import User from "../models/User";
import { io } from '../sockets';
import { sleep } from "../utils/sleep";
import { coinKing } from '../controller/coinController';
import {
  PublicKey,
} from '@solana/web3.js';

const router = express.Router();

// @route   Post /cointrade/update
// @desc    Post coin swap sig update
// @access  Public
router.post("/update", async (req, res) => {
});

export default router;
