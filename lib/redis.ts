import "server-only";
import { createClient } from "redis";

type RedisClient = ReturnType<typeof createClient>;
const shared = globalThis as typeof globalThis & {
  faceGateRedis?: RedisClient;
  faceGateRedisConnection?: Promise<RedisClient>;
};

export async function getRedis(): Promise<RedisClient> {
  if (!process.env.REDIS_URL) throw new Error("REDIS_URL is not configured");
  if (!shared.faceGateRedis) {
    shared.faceGateRedis = createClient({
      url: process.env.REDIS_URL,
      disableOfflineQueue: true,
      socket: { connectTimeout: 5000, reconnectStrategy: false },
    });
    shared.faceGateRedis.on("error", () => console.error("Redis connection error"));
  }
  const client = shared.faceGateRedis;
  if (client.isReady) return client;
  if (!shared.faceGateRedisConnection) {
    shared.faceGateRedisConnection = client.connect().then(() => client).finally(() => {
      shared.faceGateRedisConnection = undefined;
    });
  }
  return shared.faceGateRedisConnection;
}

export const redisKeys = {
  employees: "facegate:employees",
  attendance: "facegate:attendance",
  settings: "facegate:settings",
  images: "facegate:images",
};
