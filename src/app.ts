import express from "express";
import WebSocket from "ws";
import cookieParser from "cookie-parser";
import axios from "axios";
import cors from "cors";
import url from "url";
import confessionsRouter from "./routes/confessions";
import connectToMongoDB from "./config/db";
import {
  deliverQueuedMessages,
  getConversation,
  handleMessage,
} from "./controllers/messageController";

const HTTP_PORT = process.env.HTTP_PORT as unknown as number;
const WS_PORT = process.env.WS_PORT as unknown as number;
const VERIFY_API = process.env.VERIFY_API as string;

const app = express();
app.use(
  cors({
    origin: ["http://localhost:5173", "https://campustown.in"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
const clients = new Map<string, WebSocket>();

const startHTTPServer = async () => {
  try {
    await connectToMongoDB();
    app.listen(HTTP_PORT, () => {
      console.log(`HTTP server running on port ${HTTP_PORT}`);
    });
  } catch (error: any) {
    console.error("Error in startHTTPServer", error.message);
  }
};
startHTTPServer();

const wss = new WebSocket.Server({ port: WS_PORT });
console.log(`WebSocket server started on port ${WS_PORT}`);

wss.on("connection", async (ws: WebSocket, req: any) => {
  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
  });

  const queryParams = url.parse(req.url, true).query;
  const token = queryParams.token as string;

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
    console.error("Error retrieving conversations", error.message);
    return [];
  }
});

app.use("/api/v1/confessions", confessionsRouter);

const authenticateJWT = async (token: string) => {
  try {
    const response = await axios.post(VERIFY_API, { token });
    return response.data.decoded;
  } catch (error: any) {
    console.error("Error verifying JWT:", error.message);
    return null;
  }
};
