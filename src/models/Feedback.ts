// models/Feedback.ts
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
});

const Message = mongoose.model('Message', messageSchema);

export default Message;
