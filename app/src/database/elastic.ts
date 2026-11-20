import { Client } from "@elastic/elasticsearch";
import dotenv from "dotenv";

dotenv.config();

const node = process.env.ELASTICSEARCH_NODE || "http://localhost:9200";

let elasticClient: Client | null = null;

export function getElasticClient(): Client {
  if (!elasticClient) {
    elasticClient = new Client({
      node,
      maxRetries: 3,
      requestTimeout: 5000,
    });
  }
  return elasticClient;
}

/**
 * Checkpoint 3 (Módulo 10): opções para as chamadas feitas DENTRO de uma requisição
 * do usuário. Sem novas tentativas e com tempo curto, a queda do ElasticSearch é
 * percebida rápido e a rota segue o plano B (busca no MongoDB ou pendência no Redis).
 */
export const LIMITE_ELASTIC_MS = 1500;
export const OPCOES_ELASTIC_RAPIDAS = { requestTimeout: LIMITE_ELASTIC_MS, maxRetries: 0 };

export async function connectElastic(): Promise<Client> {
  const client = getElasticClient();
  try {
    const health = await client.cluster.health({});
    console.log(`[Elasticsearch] Conectado com sucesso! Status do cluster: ${health.status}`);
  } catch (err: any) {
    console.warn(`[Elasticsearch] Aviso: Cluster não respondeu no startup (${err.message}). Verifique se o container está rodando.`);
  }
  return client;
}

export async function closeElastic(): Promise<void> {
  if (elasticClient) {
    await elasticClient.close();
    elasticClient = null;
    console.log("[Elasticsearch] Conexão encerrada.");
  }
}
