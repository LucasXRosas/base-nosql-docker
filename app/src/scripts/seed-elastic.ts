import { connectMongo, getCollection, closeMongo } from "../database/mongo.js";
import { connectElastic, getElasticClient, closeElastic } from "../database/elastic.js";

export async function seedElasticsearch(keepConnectionsOpen = false) {
  console.log("[Elasticsearch] Verificando/sincronizando índice 'pratos' com o MongoDB...");

  await connectMongo();
  await connectElastic();

  const elastic = getElasticClient();
  const indexName = "pratos";

  // 1. Recria o índice com mapeamento otimizado para busca textual em português
  const indexExists = await elastic.indices.exists({ index: indexName });
  if (indexExists) {
    console.log(`[Elasticsearch] Índice '${indexName}' já existe. Recriando...`);
    await elastic.indices.delete({ index: indexName });
  }

  await elastic.indices.create({
    index: indexName,
    settings: {
      number_of_shards: 1,
      number_of_replicas: 0,
    },
    mappings: {
      properties: {
        prato_id: { type: "keyword" },
        restaurante_id: { type: "keyword" },
        restaurante_nome: { type: "text" },
        nome: { type: "text", boost: 3 },
        descricao: { type: "text", boost: 2 },
        categoria: { type: "keyword" },
        preco: { type: "float" },
        ingredientes: { type: "text" },
        alergenos: { type: "keyword" },
        disponivel: { type: "boolean" },
      },
    },
  });

  // 2. Busca todos os pratos no MongoDB GastroHub
  const colCardapio = getCollection("cardapio");
  const colRestaurantes = getCollection("restaurantes");

  const pratos = await colCardapio.find().toArray();
  const restaurantes = await colRestaurantes.find().toArray();

  const restMap = new Map<string, string>();
  for (const r of restaurantes) {
    restMap.set(r._id.toString(), r.nome);
  }

  // 3. Indexa prato por prato
  let count = 0;
  for (const prato of pratos) {
    const restNome = prato.restaurante_id ? restMap.get(prato.restaurante_id.toString()) || "Desconhecido" : "Desconhecido";

    await elastic.index({
      index: indexName,
      id: prato._id.toString(),
      document: {
        prato_id: prato._id.toString(),
        restaurante_id: prato.restaurante_id ? prato.restaurante_id.toString() : null,
        restaurante_nome: restNome,
        nome: prato.nome,
        descricao: prato.descricao,
        categoria: prato.categoria,
        preco: prato.preco,
        ingredientes: Array.isArray(prato.ingredientes) ? prato.ingredientes.join(", ") : prato.ingredientes,
        alergenos: prato.alergenos || [],
        disponivel: prato.disponivel !== false,
      },
    });
    count++;
  }

  await elastic.indices.refresh({ index: indexName });
  console.log(`[Elasticsearch] Sucesso! ${count} pratos sincronizados no índice '${indexName}'.`);

  if (!keepConnectionsOpen) {
    await closeMongo();
    await closeElastic();
  }
}

// Execução direta via CLI: npm run seed:elastic
if (process.argv[1] && process.argv[1].includes("seed-elastic")) {
  seedElasticsearch().catch((err) => {
    console.error("Erro ao popular Elasticsearch:", err);
    process.exit(1);
  });
}
