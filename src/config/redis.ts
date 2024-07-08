import "dotenv/config";
import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL;

export const redisClient = createClient({
  url: `${redisUrl}`,
});

const connectToRedisInstance = async () => {
  await redisClient.connect();
  redisClient.on("connect", () => console.log("::> Redis Client Connected"));
  redisClient.on("error", (err) => console.log("<:: Redis Client Error", err));
  return redisClient;
};

export default connectToRedisInstance
