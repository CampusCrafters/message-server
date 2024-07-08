import Message from "../models/Message";
import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || '';

const redisClient = createClient({
    url: redisUrl,
  });
  redisClient.connect();
  redisClient.on('connect', () => console.log('Redis Client Connected'));
  redisClient.on('error', (err) => console.log('Redis Client Error', err));
  
export const getConversation = async (contact: string, username: string) => {
    try {
      const messages = await Message.find({
        $or: [
          { from: username, to: contact },
          { from: contact, to: username },
        ],
      }).sort({ timestamp: 1 });
      return messages;
    } catch (error) {
      console.error("Error retrieving conversation from MongoDB:", error);
      return [];
    }
  };
  
  export const handleMessage = async (username: string, data: any) => {
    const { to, message } = data;
    const recipientWs = clients.get(to);
    const timestamp = new Date().toISOString();
    const newMessage = new Message({
      from: username,
      message: message,
      timestamp: timestamp,
      to: to,
    });
    await newMessage.save();
  
    if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
      recipientWs.send(JSON.stringify(newMessage));
    } else {
      await redisClient.lPush(`messages:${to}`, JSON.stringify(newMessage));
      console.log(
        `User ${data.to} is offline, message pushed to queue and stored in MongoDB`
      );
    }
  };
  
  export const deliverQueuedMessages = async (username: string, ws: any) => {
    try {
      while (true) {
        const message = await redisClient.rPop(`messages:${username}`);
        if (!message) {
          break;
        }
        ws.send(message);
      }
      console.log(`Delivered queued messages to ${username}`);
    } catch (error) {
      console.error(`Error delivering messages to ${username}:`, error);
    }
  };
  