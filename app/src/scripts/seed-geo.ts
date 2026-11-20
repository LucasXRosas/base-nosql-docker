import fs from "fs";
import path from "path";
import { connectMongo, getCollection, closeMongo } from "../database/mongo.js";
import { getRedisClient, closeRedis } from "../database/redis.js";

export const COLECAO_LOJAS = "lojas";
export const CHAVE_ENTREGADORES = "retrovault:geo:entregadores";

function getGeoInitConfig() {
  const possiblePaths = [
    path.resolve(process.cwd(), "init", "geo-init.json"),
    path.resolve(process.cwd(), "..", "init", "geo-init.json"),
    path.resolve("/app", "init", "geo-init.json"),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8"));
  }
  throw new Error("Arquivo init/geo-init.json não encontrado.");
}

/**
 * Checkpoint 3 (Módulo 09) — carrega as coordenadas de init/geo-init.json:
 *
 * 1. MongoDB (o que FICA PARADO): coleção "lojas" — loja-sede, parceiros e pontos de
 *    retirada/avaliação de mídias usadas. Campo "localizacao" em GeoJSON
 *    { type: "Point", coordinates: [longitude, latitude] } + índice 2dsphere.
 * 2. Redis (o que SE MOVE): posição atual dos motoboys da entrega expressa (GEOADD).
 *
 * Idempotente: pode rodar várias vezes (upsert por código e posições sobrescritas).
 */
export async function seedGeo(keepConnectionsOpen = false) {
  const config = getGeoInitConfig();
  await connectMongo();

  const col = getCollection(COLECAO_LOJAS);
  for (const loja of config.lojas) {
    const { coordenadas, ...dados } = loja;
    const [lon, lat] = coordenadas;
    await col.updateOne(
      { codigo: loja.codigo },
      { $set: { ...dados, ativa: true, localizacao: { type: "Point", coordinates: [lon, lat] } } },
      { upsert: true }
    );
  }
  await col.createIndex({ localizacao: "2dsphere" });
  await col.createIndex({ codigo: 1 }, { unique: true });

  const redis = getRedisClient();
  await redis.del(CHAVE_ENTREGADORES);
  for (const [nome, [lon, lat]] of Object.entries<number[]>(config.entregadores)) {
    // GEOADD recebe longitude ANTES da latitude
    await redis.geoadd(CHAVE_ENTREGADORES, lon, lat, nome);
  }

  console.log(
    `[Geo] ${config.lojas.length} lojas (MongoDB, índice 2dsphere) e ` +
      `${Object.keys(config.entregadores).length} entregadores (Redis GEO) carregados.`
  );

  if (!keepConnectionsOpen) {
    await closeMongo();
    await closeRedis();
  }
}

if (process.argv[1] && process.argv[1].includes("seed-geo")) {
  seedGeo().catch((err) => {
    console.error("Erro ao carregar as coordenadas:", err);
    process.exit(1);
  });
}
