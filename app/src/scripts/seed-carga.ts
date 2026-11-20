import { ObjectId } from "mongodb";
import { connectMongo, getCollection, closeMongo } from "../database/mongo.js";

/**
 * Checkpoint 3 (Módulo 11) — CARGA DE TESTE DO RETROVAULT
 *
 * Grava 200 mil pedidos antigos (cinco anos de vendas da loja) na coleção
 * "pedidos_historico", para medir a consulta "Meus pedidos" com e sem índice.
 *
 * - 1.000 clientes: os 5 clientes reais da coleção "clientes" (Lucas Rosa, Ana Silva...)
 *   e 995 clientes sintéticos; cada um fica com cerca de 200 pedidos.
 * - Itens sorteados do catálogo real (coleção "jogos"): título, plataforma e preço.
 * - Sorteio com semente fixa (mulberry32): a carga é a mesma em qualquer máquina.
 *
 * Uso (dentro do container):
 *   docker exec nosql_app npm run seed:carga                 # grava (se ainda não gravou) e cria o índice
 *   docker exec nosql_app npm run seed:carga -- --recriar    # apaga e grava de novo
 *   docker exec nosql_app npm run seed:carga -- --sem-indice # grava sem criar o índice (medição "antes")
 */

export const COLECAO_HISTORICO = "pedidos_historico";
export const INDICE_HISTORICO = { cliente_id: 1, data_pedido: -1 } as const;

const TOTAL = 200_000;
const LOTE = 10_000;
const TOTAL_CLIENTES = 1_000;

// Gerador de números com semente fixa (mulberry32)
function sorteador(semente: number) {
  let estado = semente >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Catálogo usado se a coleção "jogos" estiver vazia (não deve acontecer após o mongo-init.js)
const CATALOGO_RESERVA = [
  { titulo: "Silent Hill 2", plataforma: "PlayStation 2", preco: 380 },
  { titulo: "Chrono Trigger", plataforma: "Super Nintendo", preco: 420 },
  { titulo: "Resident Evil 4", plataforma: "Nintendo GameCube", preco: 140 },
];

export async function seedCarga(opcoes: { recriar?: boolean; semIndice?: boolean } = {}) {
  await connectMongo();
  const col = getCollection(COLECAO_HISTORICO);

  const jaGravado = !opcoes.recriar && (await col.estimatedDocumentCount()) === TOTAL;
  if (jaGravado) {
    console.log(`[Carga] "${COLECAO_HISTORICO}" já tem ${TOTAL.toLocaleString("pt-BR")} pedidos; nada a gravar (use --recriar).`);
  } else {
    await col.drop().catch(() => {});

    const clientesReais = (await getCollection("clientes").find({}, { projection: { _id: 1 } }).sort({ _id: 1 }).toArray())
      .map((c) => c._id as ObjectId);
    const clientes: ObjectId[] = [...clientesReais];
    for (let i = clientes.length; i < TOTAL_CLIENTES; i++) {
      clientes.push(new ObjectId("6a0000000000000000" + i.toString(16).padStart(6, "0")));
    }

    const jogos = await getCollection("jogos")
      .find({}, { projection: { _id: 1, titulo: 1, plataforma: 1, preco: 1 } })
      .sort({ sku: 1 })
      .toArray();
    const catalogo = jogos.length > 0 ? jogos : CATALOGO_RESERVA.map((j) => ({ _id: new ObjectId(), ...j }));

    const aleatorio = sorteador(2026);
    const inicio = new Date("2021-11-01T00:00:00Z").getTime();
    const cincoAnos = 5 * 365 * 24 * 60 * 60 * 1000;

    for (let n = 0; n < TOTAL; n += LOTE) {
      const lote = [];
      for (let i = n; i < n + LOTE; i++) {
        const qtdItens = 1 + Math.floor(aleatorio() * 3); // 1 a 3 jogos por pedido
        const itens = Array.from({ length: qtdItens }, () => {
          const jogo = catalogo[Math.floor(aleatorio() * catalogo.length)];
          return {
            jogo_id: jogo._id,
            titulo: jogo.titulo,
            plataforma: jogo.plataforma,
            quantidade: 1,
            preco_unitario: jogo.preco,
          };
        });
        const frete = Math.round((12 + aleatorio() * 20) * 100) / 100;
        const sorteio = aleatorio();
        lote.push({
          numero: i + 1,
          cliente_id: clientes[Math.floor(aleatorio() * clientes.length)],
          itens,
          valor_total: Math.round((itens.reduce((s, it) => s + it.preco_unitario, 0) + frete) * 100) / 100,
          status: sorteio < 0.85 ? "entregue" : sorteio < 0.92 ? "cancelado" : sorteio < 0.95 ? "devolvido" : "enviado",
          data_pedido: new Date(inicio + Math.floor(aleatorio() * cincoAnos)),
          entrega: { valor_frete: frete },
        });
      }
      await col.insertMany(lote, { ordered: false });
    }
    console.log(`[Carga] ${TOTAL.toLocaleString("pt-BR")} pedidos gravados em "${COLECAO_HISTORICO}" (${clientes.length} clientes).`);
  }

  if (opcoes.semIndice) {
    await col.dropIndexes().catch(() => {}); // fica só o _id
    console.log(`[Carga] Sem índices além do _id (medição "antes").`);
  } else {
    // Índice da consulta "Meus pedidos": igualdade (cliente_id) primeiro, ordenação (data_pedido) depois
    const nome = await col.createIndex(INDICE_HISTORICO);
    console.log(`[Carga] Índice "${nome}" garantido.`);
  }

  await closeMongo();
}

if (process.argv[1] && process.argv[1].includes("seed-carga")) {
  seedCarga({
    recriar: process.argv.includes("--recriar"),
    semIndice: process.argv.includes("--sem-indice"),
  }).catch((err) => {
    console.error("Erro na carga de teste:", err);
    process.exit(1);
  });
}
