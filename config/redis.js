const Redis = require("ioredis");

let client = null;

const connectRedis = async () => {
  try {
    client = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 3000),
      lazyConnect: true,
    });

    await client.connect();
    console.log("✅  Redis connected");

    client.on("error", (err) => console.error("❌  Redis error:", err.message));
    client.on("reconnecting", () => console.warn("⚠️  Redis reconnecting…"));
  } catch (err) {
    // Non-fatal — app works without Redis (codes won't be cached)
    console.warn(
      "⚠️  Redis connection failed. Running without cache:",
      err.message,
    );
    client = null;
  }
};

const getClient = () => client;

// ─── Helper wrappers (safe — return null if Redis is down) ──────────────────

const setEx = async (key, seconds, value) => {
  if (!client) return null;
  return client.setex(
    key,
    seconds,
    typeof value === "object" ? JSON.stringify(value) : value,
  );
};

const get = async (key) => {
  if (!client) return null;
  const val = await client.get(key);
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
};

const del = async (key) => {
  if (!client) return null;
  return client.del(key);
};

const incr = async (key) => {
  if (!client) return null;
  return client.incr(key);
};

module.exports = { connectRedis, getClient, setEx, get, del, incr };
