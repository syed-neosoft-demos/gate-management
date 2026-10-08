import "server-only";
import { createClient } from "redis";

type RedisClient = ReturnType<typeof createClient>;
const shared = globalThis as typeof globalThis & {
  faceGateRedis?: RedisClient;
  faceGateRedisConnection?: Promise<RedisClient>;
};

export async function getRedis(): Promise<RedisClient> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    throw new Error("REDIS_URL is missing. Set it in .env.local and restart the Next.js server.");
  }
  if (!shared.faceGateRedis) {
    shared.faceGateRedis = createClient({
      url,
      disableOfflineQueue: true,
      socket: { connectTimeout: 5000, reconnectStrategy: false },
      password: process.env.REDIS_PASSWORD || undefined,
    });
    shared.faceGateRedis.on("error", () =>
      console.error("Redis connection error"),
    );
  }
  const client = shared.faceGateRedis;
  if (client.isReady) return client;
  if (!shared.faceGateRedisConnection) {
    shared.faceGateRedisConnection = client
      .connect()
      .then(() => client)
      .finally(() => {
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
