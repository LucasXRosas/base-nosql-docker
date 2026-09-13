import fs from "fs";
import path from "path";
import { connectMongo, getCollection, closeMongo } from "../database/mongo.js";
import { connectElastic, getElasticClient, closeElastic } from "../database/elastic.js";

function getElasticInitConfig() {
  // Procura o arquivo init/elastic-init.json
  const possiblePaths = [
    path.resolve(process.cwd(), "init", "elastic-init.json"),
    path.resolve(process.cwd(), "..", "init", "elastic-init.json"),
    path.resolve("/app", "init", "elastic-init.json"),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf-8");
      return JSON.parse(raw);
    }
  }

  // Fallback padrão se não encontrar o arquivo
  return {
    settings: { number_of_shards: 1, number_of_replicas: 0 },
    mappings: {
      properties: {
        jogo_id: { type: "keyword" },
        sku: { type: "keyword" },
        titulo: { type: "text", boost: 3 },
        descricao: { type: "text", boost: 2 },
        plataforma: { type: "keyword" },
        categoria: { type: "keyword" },
        preco: { type: "float" },
        quantidade_estoque: { type: "integer" },
        tags: { type: "text" },
        condicao: { type: "keyword" },
        ano_lancamento: { type: "integer" },
        ativo: { type: "boolean" },
        media_nota: { type: "float" },
      },
    },
  };
}

export async function seedElasticsearch(keepConnectionsOpen = false) {
  console.log("[Elasticsearch] Verificando/sincronizando índice 'jogos' a partir de init/elastic-init.json...");

  await connectMongo();
  await connectElastic();

  const elastic = getElasticClient();
  const indexName = "jogos";
  const initConfig = getElasticInitConfig();

  // 1. Recria o índice com base no arquivo declarativo init/elastic-init.json
  const indexExists = await elastic.indices.exists({ index: indexName });
  if (indexExists) {
    console.log(`[Elasticsearch] Índice '${indexName}' já existe. Recriando...`);
    await elastic.indices.delete({ index: indexName });
  }

  await elastic.indices.create({
    index: indexName,
    settings: initConfig.settings,
    mappings: initConfig.mappings,
  });

  // 2. Busca jogos e categorias no MongoDB RetroVault
  const colJogos = getCollection("jogos");
  const colCategorias = getCollection("categorias");

  const jogos = await colJogos.find().toArray();
  const categorias = await colCategorias.find().toArray();

  const catMap = new Map<string, string>();
  for (const c of categorias) {
    catMap.set(c._id.toString(), c.nome);
  }

  // 3. Indexa jogo por jogo
  let count = 0;
  for (const jogo of jogos) {
    const catNome = jogo.categoria_id ? catMap.get(jogo.categoria_id.toString()) || "Geral" : "Geral";

    await elastic.index({
      index: indexName,
      id: jogo._id.toString(),
      document: {
        jogo_id: jogo._id.toString(),
        sku: jogo.sku,
        titulo: jogo.titulo,
        descricao: jogo.descricao,
        plataforma: jogo.plataforma,
        categoria: catNome,
        preco: jogo.preco,
        quantidade_estoque: jogo.quantidade_estoque,
        tags: Array.isArray(jogo.tags) ? jogo.tags.join(" ") : jogo.tags,
        condicao: jogo.especificacoes_midia?.condicao || "Seminovo",
        ano_lancamento: jogo.especificacoes_midia?.ano_lancamento || null,
        ativo: jogo.ativo !== false,
        media_nota: jogo.avaliacoes_resumo?.media_nota || 0,
      },
    });
    count++;
  }

  await elastic.indices.refresh({ index: indexName });
  console.log(`[Elasticsearch] Sucesso! ${count} jogos sincronizados no índice '${indexName}'.`);

  if (!keepConnectionsOpen) {
    await closeMongo();
    await closeElastic();
  }
}

// Execução direta via CLI
if (process.argv[1] && process.argv[1].includes("seed-elastic")) {
  seedElasticsearch().catch((err) => {
    console.error("Erro ao popular Elasticsearch:", err);
    process.exit(1);
  });
}
