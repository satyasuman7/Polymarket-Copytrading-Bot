// models/PendingUser.ts
import mongoose from 'mongoose';

const pendingUserSchema = new mongoose.Schema(
);

const PendingUser = mongoose.models.PendingUser || mongoose.model('PendingUser', pendingUserSchema);

export default PendingUser;
