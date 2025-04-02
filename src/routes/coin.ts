import express from "express";
import Coin from "../models/Coin";
import { TOKEN_LIST_QUERY_LIMIT } from "../utils/constants";
import { AuthRequest, auth } from "../middleware/authorization";
import { Types } from "mongoose";
import { Keypair, PublicKey } from "@solana/web3.js";
import CoinStatus from "../models/CoinsStatus";
import { io } from "../sockets";
import { coinKing } from "../controller/coinController";


const router = express.Router();

// @route   GET /coin/
// @desc    Get all created coins
// @access  Public
router.get('/', async (req, res) => {
    const coins = await Coin.find({}).populate('creator')
    return res.status(200).send(coins)
})
router.post('/king', async (req, res) => {
    const data = coinKing();
})

// @route   GET /coin/:userID
// @desc    Get coins created by userID
// @access  Public
router.get("/:id", (req, res) => {
  const id = req.params.id;
  Coin.findOne({ _id: id })
    .populate("creator")
    .then((users) => res.status(200).send(users))
    .catch((err) => res.status(400).json("Nothing"));
});

// @route   GET /token/:token
// @desc    Get coins created by userID
// @access  Public
router.get("/token/:token", (req, res) => {
  const token = req.params.token;
  Coin.findOne({ token: token })
    .populate("creator")
    .then((users) => res.status(200).send(users))
    .catch((err) => res.status(400).json("Nothing"));
});

// @route   GET /coin/user/:userID
// @desc    Get coins created by userID
// @access  Public
router.get("/user/:userID", (req, res) => {
  const creator = req.params.userID;
  Coin.find({ creator })
    .populate("creator")
    .then((users) => res.status(200).send(users))
    .catch((err) => res.status(400).json("Nothing"));
});

// @route   GET /coin/user/:token
// @desc    Get coin created by token
// @access  Public
router.get("/token/:token", (req, res) => {
  const token = req.params.token;
  Coin.findOne({ token })
    .then((t) => res.status(200).send(t))
    .catch((err) => res.status(400).send(err));
});

// @route   POST /coin/:coinId
// @desc    Update coin
// @access  Public
router.post("/:coinId", (req, res) => {
  const { body } = req;
  const coinId = req.params.coinId;
  console.log(body);
  Coin.updateOne({ _id: coinId }, { $set: body })
    .then((updateCoin) => {
      console.log(updateCoin);
      res.status(200).send(updateCoin);
    })
    .catch((err) => res.status(400).json("update is failed!!"));
});

export default router;
