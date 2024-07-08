import mongoose from "mongoose";
const Schema = mongoose.Schema;

const messageSchema = new Schema({
  from: String,
  to: String,
  message: String,
  timestamp: { type: Date, default: Date.now },
});

const Message = mongoose.model("Message", messageSchema);

export default Message;
