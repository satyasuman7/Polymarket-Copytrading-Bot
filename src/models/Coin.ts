// models/Coin.ts
import mongoose from "mongoose";

const coinSchema = new mongoose.Schema({
});

const Coin = mongoose.model("Coin", coinSchema);

export default Coin;
