// models/CoinStatus.ts
import mongoose from "mongoose";

const coinStatusSchema = new mongoose.Schema({
});

const CoinStatus = mongoose.model("CoinStatus", coinStatusSchema);

export default CoinStatus;
