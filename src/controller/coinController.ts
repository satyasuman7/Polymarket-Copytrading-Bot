import Coin from "../models/Coin";
import { io } from "../sockets";

// @route   GET /coin/king
// @desc    Get king of hill
// @access  Public
export const coinKing = async (): Promise<any> => {
    console.log("coinKing")
    const data = await Coin.find({})
        .populate({ path: 'creator' })
        .sort({ progressMcap: -1 })
        .limit(1)
    console.log("coinKing", data)

    if (io != null) io.emit("KingOfHill", data[0])
}