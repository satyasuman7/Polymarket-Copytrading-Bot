import express from "express";
import { logger } from "../sockets/logger";
import CurveConfig from "../models/CurveConfig";



const router = express.Router();

// @route   GET /curveConfig/
// @desc    curveLimit
// @access  Public
router.get('/', async (req, res) => {
    console.log("limit")
    try {
        const limit = await CurveConfig.findOne({});
        res.status(200).send(limit);
    } catch (error) {
        res.status(500).send(error);
    }
})

export default router;