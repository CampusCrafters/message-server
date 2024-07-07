import "dotenv/config";
import express from "express";
import WebSocket from "ws";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import axios from "axios";
import cors from "cors";
import { createClient } from "redis";
import url from "url";

const HTTP_PORT = process.env.HTTP_PORT;
const WS_PORT = process.env.WS_PORT as unknown as number;
const DATABASE_URL = process.env.DATABASE_URL;
const VERIFY_API = process.env.VERIFY_API as string;
const redisUrl = process.env.REDIS_URL;

const corsOptions = {
  origin: ["http://localhost:5173", "https://campustown.in"],
  credentials: true,
};

const clientOptions = { serverApi: { version: '1', strict: true, deprecationErrors: true } };
const uri = `${DATABASE_URL}`;

const app = express();
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

async function run() {
  try {
    await mongoose.connect(uri, { ...clientOptions, serverApi: "1" });
    await mongoose.connection.db.admin().command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (e) {
    console.error("Error connecting to MongoDB:", e);
  }
}
run().catch(console.dir);

const Schema = mongoose.Schema;
const messageSchema = new Schema({
  from: String,
  to: String,
  message: String,
  timestamp: { type: Date, default: Date.now },
});
const Message = mongoose.model("Message", messageSchema);

const redisClient = createClient({
  url: `${redisUrl}`,
});
(async () => {
  await redisClient.connect();
})();

redisClient.on("connect", () => console.log("::> Redis Client Connected"));
redisClient.on("error", (err) => console.log("<:: Redis Client Error", err));
const wss = new WebSocket.Server({ port: WS_PORT });
console.log(`WebSocket server started on port ${WS_PORT}`);

const clients = new Map();

wss.on("connection", async (ws: WebSocket, req: any) => {
  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
  });

  const queryParams = url.parse(req.url, true).query;
  const token = queryParams.token as string;
  //console.log("Token:", token);
  
  if (!token) {
    ws.close(4002, "No JWT token");
    return;
  }
  const user = await authenticateJWT(token);
  if (!user) {
    ws.close(4003, "Invalid JWT token");
    return;
  }

  let username = user.name.replace(" -IIITK", "");
  clients.set(username, ws);
  console.log(`User ${username} connected`);

  await deliverQueuedMessages(username, ws);

  ws.on("message", async (message: string) => {
    let data;
    try {
      data = JSON.parse(message);
      console.log(`Received message from ${username}:`, data);
    } catch (error: any) {
      console.error("Error parsing message:", error.message);
      return;
    }

    await handleMessage(username, data);
  });

  ws.on("close", () => {
    clients.delete(username);
    console.log(`User ${username} disconnected`);
  });

  ws.on("error", (error) => {
    console.log(`User ${username} disconnected due to error: ${error}`);
  });
});

app.get("/chat/:contact", async (req, res) => {
  const token = req.cookies.jwt;
  const user = await authenticateJWT(token);
  if (!user) {
    res.status(401).json({ error: "Token invalid" });
    return;
  }
  const username = user.name.replace(" -IIITK", "");
  const contactName = req.params.contact.substring(1);
  console.log(`User ${username} requested conversation with ${contactName}`);
  try {
    const messages = await getConversation(contactName, username);
    res.json(messages);
  } catch (error: any) {
    console.error(`Error retrieving conversations`, error.message);
    return [];
  }
});

app.listen(HTTP_PORT, () => {
  console.log(`HTTP server running on port ${HTTP_PORT}`);
});

/***************************************************************************************************/

const getConversation = async (contact: string, username: string) => {
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

const handleMessage = async (username: string, data: any) => {
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

const deliverQueuedMessages = async (username: string, ws: WebSocket) => {
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

const authenticateJWT = async (token: string) => {
  try {
    const response = await axios.post(VERIFY_API, { token: token });
    return response.data.decoded;
  } catch (error: any) {
    console.error("Error verifying JWT:", error.message);
    return null;
  }
};
