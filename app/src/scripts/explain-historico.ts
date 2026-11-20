import { ObjectId } from "mongodb";
import { connectMongo, getCollection, closeMongo } from "../database/mongo.js";
import { COLECAO_HISTORICO } from "./seed-carga.js";

/**
 * Checkpoint 3 (Módulo 11) — explain("executionStats") da consulta "Meus pedidos":
 *
 *   db.pedidos_historico.find({ cliente_id: <id> }).sort({ data_pedido: -1 }).limit(10)
 *
 * Imprime o resumo usado na Seção 4 do CHECKPOINT_3.md: etapas do plano vencedor
 * (COLLSCAN, IXSCAN, FETCH, SORT, LIMIT...), chaves e documentos examinados,
 * documentos devolvidos, tempo e índices existentes na coleção.
 *
 * Uso: docker exec nosql_app npm run explain:historico [-- <cliente_id>] [-- --completo]
 */
const CLIENTE_PADRAO = "65f8c0009f1b2c001c8e5001"; // Lucas Rosa

async function main() {
  const args = process.argv.slice(2);
  const clienteId = args.find((a) => ObjectId.isValid(a)) || CLIENTE_PADRAO;
  const completo = args.includes("--completo");

  await connectMongo();
  const col = getCollection(COLECAO_HISTORICO);

  const plano: any = await col
    .find({ cliente_id: new ObjectId(clienteId) })
    .sort({ data_pedido: -1 })
    .limit(10)
    .explain("executionStats");

  const vencedor = plano.queryPlanner.winningPlan.queryPlan || plano.queryPlanner.winningPlan;
  const etapas: string[] = [];
  let indice: string | undefined;
  for (let s = vencedor; s; s = s.inputStage) {
    etapas.unshift(s.stage);
    if (s.indexName) indice = s.indexName;
  }
  const e = plano.executionStats;
  const indices = (await col.indexes()).map((i) => i.name);

  console.log(`consulta    find({ cliente_id: ObjectId("${clienteId}") }).sort({ data_pedido: -1 }).limit(10)`);
  console.log(`índices     ${indices.join(", ")}`);
  console.log(`etapas      ${etapas.join(" → ")}${indice ? `  (índice ${indice})` : ""}`);
  console.log(`chaves      ${e.totalKeysExamined} examinadas`);
  console.log(`examinados  ${e.totalDocsExamined} documentos`);
  console.log(`devolvidos  ${e.nReturned}`);
  console.log(`tempo       ${e.executionTimeMillis} ms`);
  if (completo) console.log(JSON.stringify(plano, null, 2));

  await closeMongo();
}

main().catch((err) => {
  console.error("Erro no explain:", err.message);
  process.exit(1);
});
