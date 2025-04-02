// models/User.ts
import mongoose, { Types } from 'mongoose';


const curveConfigSchema = new mongoose.Schema({
});

const CurveConfig = mongoose.model('CurveConfig', curveConfigSchema);

export default CurveConfig;