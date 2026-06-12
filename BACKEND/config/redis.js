import { createClient } from "redis";

export const redis = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
  socket: {
    reconnectStrategy: (retries) => {
      // Limit reconnection attempts to avoid infinite retries spamming connection errors
      if (retries > 3) {
        return new Error("Redis connection retry limit reached");
      }
      return 3000; // Retry after 3 seconds
    }
  }
});

// Suppress connection-related error logging
redis.on("error", (err) => {
  // Silent fallback to memory store
});

export const connectRedis = async () => {
  try {
    if (!redis.isOpen) {
      await redis.connect();
      console.log("🚀 Connected to Redis successfully.");
    }
  } catch (err) {
    // Graceful silent fallback
  }
};

// In-memory fallback map for active sessions
const memoryStore = new Map();

export const sessionStore = {
  get: async (key) => {
    // Only attempt Redis if it is fully connected and ready
    if (redis.isOpen && redis.isReady) {
      try {
        return await redis.get(key);
      } catch (err) {
        // Fallback silently
      }
    }
    // Fallback to in-memory cache
    const item = memoryStore.get(key);
    if (item) {
      if (item.expiresAt > Date.now()) {
        return item.value;
      }
      memoryStore.delete(key); // Clean up expired session
    }
    return null;
  },

  set: async (key, value, ttlSeconds) => {
    if (redis.isOpen && redis.isReady) {
      try {
        await redis.set(key, value, { EX: ttlSeconds });
        return;
      } catch (err) {
        // Fallback silently
      }
    }
    // Fallback to in-memory cache
    memoryStore.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  },

  del: async (key) => {
    if (redis.isOpen && redis.isReady) {
      try {
        await redis.del(key);
        return;
      } catch (err) {
        // Fallback silently
      }
    }
    memoryStore.delete(key);
  }
};