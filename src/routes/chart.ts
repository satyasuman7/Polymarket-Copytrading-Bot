import express from "express";
import NodeCache from "node-cache";
import { logger } from "../sockets/logger";
import { fetchPriceChartData } from "../utils/chart";



const router = express.Router();

// @route   GET /coin/
// @desc    Get all created coins
// @access  Public
router.get('/:pairIndex/:start/:end/:range/:token/:countBack', async (req, res) => {
} )

export default router;


