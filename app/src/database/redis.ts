import { Redis } from "ioredis";
import dotenv from "dotenv";
import { comLimite } from "./limite.js";

dotenv.config();

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 2000);
        return delay;
      },
    });

    redisClient.on("connect", () => {
      console.log("[Redis] Conectado com sucesso!");
    });

    redisClient.on("error", (err) => {
      console.error("[Redis] Erro de conexão:", err.message);
    });
  }
  return redisClient;
}

export async function connectRedis(): Promise<Redis> {
  const client = getRedisClient();
  await client.ping();
  return client;
}

export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  const client = getRedisClient();
  const data = await client.get(key);
  if (!data) return null;
  try {
    return JSON.parse(data) as T;
  } catch {
    return data as unknown as T;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
  const client = getRedisClient();
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  await client.set(key, serialized, "EX", ttlSeconds);
}

export async function cacheDel(key: string): Promise<void> {
  const client = getRedisClient();
  await client.del(key);
}

export async function cacheDelMany(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const client = getRedisClient();
  await client.del(...keys);
}

export async function cacheIncr(key: string): Promise<number> {
  const client = getRedisClient();
  return client.incr(key);
}

/* ==========================================================================
   CHECKPOINT 3 (MÓDULO 10) — CACHE OPCIONAL: A ROTA NÃO DEPENDE DO REDIS
   ========================================================================== */

// Tempo máximo que uma rota aceita esperar pelo Redis antes de seguir sem ele.
const LIMITE_REDIS_MS = 300;

/**
 * O ioredis guarda os comandos numa fila enquanto tenta reconectar. Se o Redis
 * não está "ready", nem tenta: a rota não pode ficar esperando um banco que caiu.
 */
export function redisPronto(): boolean {
  return getRedisClient().status === "ready";
}

export { comLimite };

/**
 * Leitura de cache que nunca lança exceção.
 * - redisNoAr=false: o Redis está fora (ou não respondeu a tempo); a rota segue para o MongoDB.
 * - valor=null com redisNoAr=true: cache miss normal.
 */
export async function cacheLerSeguro<T = unknown>(key: string): Promise<{ valor: T | null; redisNoAr: boolean }> {
  if (!redisPronto()) return { valor: null, redisNoAr: false };
  try {
    const valor = await comLimite(cacheGet<T>(key), LIMITE_REDIS_MS);
    return { valor, redisNoAr: true };
  } catch {
    return { valor: null, redisNoAr: false };
  }
}

/** Gravar no cache é um extra: se falhar, o cliente recebe a resposta do mesmo jeito. */
export async function cacheGravarSeguro(key: string, value: unknown, ttlSeconds = 60): Promise<boolean> {
  if (!redisPronto()) return false;
  try {
    await comLimite(cacheSet(key, value, ttlSeconds), LIMITE_REDIS_MS);
    return true;
  } catch {
    return false;
  }
}

/** Invalidação que não derruba a escrita: devolve false se o Redis estiver fora. */
export async function cacheInvalidarSeguro(keys: string[]): Promise<boolean> {
  if (keys.length === 0) return true;
  if (!redisPronto()) return false;
  try {
    await comLimite(cacheDelMany(keys), LIMITE_REDIS_MS);
    return true;
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log("[Redis] Conexão encerrada.");
  }
}
