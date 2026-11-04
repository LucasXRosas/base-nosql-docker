import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { performance } from "perf_hooks";
import { getCollection } from "../database/mongo.js";
import { cacheGet, cacheSet, cacheDelMany, cacheIncr, getRedisClient } from "../database/redis.js";
import { getElasticClient } from "../database/elastic.js";
import { seedElasticsearch } from "../scripts/seed-elastic.js";

const CACHE_KEY_DESTAQUES = "retrovault:jogos:destaques";
const CACHE_KEY_PROMOCOES = "retrovault:jogos:promocoes";
const CACHE_PREFIX_SKU = "retrovault:jogos:sku:";
const CACHE_PREFIX_VIEWS = "retrovault:views:";
const KEY_SYNC_PENDENTES = "retrovault:sync:pendentes";

/**
 * Helper para buscar jogo por SKU ou Título (case-insensitive substring)
 */
function buildJogoQuery(param: string) {
  const escaped = param.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return {
    $or: [
      { sku: param },
      { titulo: param },
      { titulo: new RegExp(escaped, "i") },
    ],
  };
}

/**
 * Indexa (ou reindexa) UM documento de jogo no ElasticSearch a partir do
 * documento canônico do MongoDB. Lança exceção se o ElasticSearch falhar.
 */
async function indexarJogoNoElastic(jogo: any): Promise<void> {
  const elastic = getElasticClient();
  let catNome = "Geral";
  if (jogo.categoria_id && ObjectId.isValid(jogo.categoria_id)) {
    const colCat = getCollection("categorias");
    const cat = await colCat.findOne({ _id: new ObjectId(jogo.categoria_id) });
    if (cat) catNome = cat.nome;
  }

  await elastic.index({
    index: "jogos",
    id: jogo._id.toString(),
    document: {
      jogo_id: jogo._id.toString(),
      sku: jogo.sku,
      titulo: jogo.titulo,
      descricao: jogo.descricao || "",
      plataforma: jogo.plataforma,
      categoria: catNome,
      preco: jogo.preco,
      quantidade_estoque: jogo.quantidade_estoque,
      tags: Array.isArray(jogo.tags) ? jogo.tags.join(" ") : (jogo.tags || ""),
      condicao: jogo.especificacoes_midia?.condicao || "Seminovo",
      ano_lancamento: jogo.especificacoes_midia?.ano_lancamento || null,
      ativo: jogo.ativo !== false,
      media_nota: jogo.avaliacoes_resumo?.media_nota || 0,
    },
    refresh: true, // Torna visível imediatamente para novas buscas
  });
}

export class JogosController {
  /**
   * BASELINE SEM CACHE — CONSULTA DIRETA AO MONGODB
   * GET /api/jogos/promocoes-sem-cache
   */
  static async listarPromocoesSemCache(req: Request, res: Response): Promise<void> {
    const t0 = performance.now();
    try {
      const col = getCollection("jogos");
      const promocoes = await col
        .find({ preco: { $lte: 150.0 }, ativo: true, quantidade_estoque: { $gt: 0 } })
        .sort({ preco: 1 })
        .toArray();

      const duracao = (performance.now() - t0).toFixed(2);
      res.setHeader("X-Cache", "DISABLED");
      res.json({
        origem: "MONGODB (SEM CACHE)",
        tempo_resposta: `${duracao} ms`,
        total_itens: promocoes.length,
        total: promocoes.length,
        promocoes,
        dados: promocoes,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao listar promoções sem cache", detalhe: err.message });
    }
  }

  /**
   * 1. VITRINE DE JOGOS MAIS BEM AVALIADOS (Checkpoint 1 — Consulta 1 + Cache-Aside)
   * GET /api/jogos/destaques
   * TTL: 120 segundos
   */
  static async listarDestaques(req: Request, res: Response): Promise<void> {
    const t0 = performance.now();
    try {
      const cached = await cacheGet<any[]>(CACHE_KEY_DESTAQUES);
      if (cached) {
        const duracao = (performance.now() - t0).toFixed(2);
        res.setHeader("X-Cache", "HIT");
        res.json({
          origem: "REDIS (CACHE HIT)",
          tempo_resposta: `${duracao} ms`,
          total_itens: cached.length,
          total: cached.length,
          destaques: cached,
          dados: cached,
        });
        return;
      }

      const col = getCollection("jogos");
      const jogos = await col
        .find({ ativo: true, "avaliacoes_resumo.media_nota": { $gte: 4.5 } })
        .sort({ "avaliacoes_resumo.media_nota": -1 })
        .limit(5)
        .toArray();

      // Salva no Redis com TTL de 120 segundos
      await cacheSet(CACHE_KEY_DESTAQUES, jogos, 120);

      const duracao = (performance.now() - t0).toFixed(2);
      res.setHeader("X-Cache", "MISS");
      res.json({
        origem: "MONGODB (CACHE MISS)",
        tempo_resposta: `${duracao} ms`,
        total_itens: jogos.length,
        total: jogos.length,
        destaques: jogos,
        dados: jogos,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao listar destaques", detalhe: err.message });
    }
  }

  /**
   * 2. BUSCA DE MÍDIAS EM PROMOÇÃO (Checkpoint 1 — Consulta 2 + Cache-Aside)
   * GET /api/jogos/promocoes
   * TTL: 60 segundos
   */
  static async listarPromocoes(req: Request, res: Response): Promise<void> {
    const t0 = performance.now();
    try {
      const cached = await cacheGet<any[]>(CACHE_KEY_PROMOCOES);
      if (cached) {
        const duracao = (performance.now() - t0).toFixed(2);
        res.setHeader("X-Cache", "HIT");
        res.json({
          origem: "REDIS (CACHE HIT)",
          tempo_resposta: `${duracao} ms`,
          total_itens: cached.length,
          total: cached.length,
          promocoes: cached,
          dados: cached,
        });
        return;
      }

      const col = getCollection("jogos");
      const promocoes = await col
        .find({ preco: { $lte: 150.0 }, ativo: true, quantidade_estoque: { $gt: 0 } })
        .sort({ preco: 1 })
        .toArray();

      // Salva no Redis com TTL de 60 segundos
      await cacheSet(CACHE_KEY_PROMOCOES, promocoes, 60);

      const duracao = (performance.now() - t0).toFixed(2);
      res.setHeader("X-Cache", "MISS");
      res.json({
        origem: "MONGODB (CACHE MISS)",
        tempo_resposta: `${duracao} ms`,
        total_itens: promocoes.length,
        total: promocoes.length,
        promocoes,
        dados: promocoes,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao listar promoções", detalhe: err.message });
    }
  }

  /**
   * MÓDULO 08 — EXPERIMENTO 1: COMPARAR O MESMO REGISTRO NOS TRÊS BANCOS
   * GET /api/jogos/:sku/comparar
   */
  static async compararTresBancos(req: Request, res: Response): Promise<void> {
    try {
      const { sku: param } = req.params;
      const col = getCollection("jogos");

      // 1. MongoDB (Fonte canônica da verdade)
      const jogoMongo = await col.findOne(buildJogoQuery(param));

      if (!jogoMongo) {
        res.status(404).json({ erro: `Jogo '${param}' não encontrado no MongoDB.` });
        return;
      }

      const strMongo = `${jogoMongo.titulo} · R$ ${Number(jogoMongo.preco).toFixed(2)}`;

      // 2. Redis (Cache em memória)
      const cachedRedis = (await cacheGet<any>(`${CACHE_PREFIX_SKU}${jogoMongo.sku}`)) ||
                          (await cacheGet<any>(`${CACHE_PREFIX_SKU}${jogoMongo.titulo}`));

      const strRedis = cachedRedis
        ? `${cachedRedis.titulo || jogoMongo.titulo} · R$ ${Number(cachedRedis.preco).toFixed(2)}`
        : "(sem cópia)";

      // 3. ElasticSearch (Índice de busca textual)
      let strElastic = "(sem cópia)";
      try {
        const elastic = getElasticClient();
        const searchRes = await elastic.search({
          index: "jogos",
          query: {
            bool: {
              should: [
                { term: { "sku.keyword": jogoMongo.sku } },
                { term: { sku: jogoMongo.sku } },
                { match: { titulo: jogoMongo.titulo } },
              ],
            },
          },
        });

        if (searchRes.hits.hits.length > 0) {
          const doc: any = searchRes.hits.hits[0]._source;
          strElastic = `${doc.titulo} · R$ ${Number(doc.preco).toFixed(2)}`;
        }
      } catch (err: any) {
        strElastic = `(erro ao consultar: ${err.message})`;
      }

      res.json({
        mongodb: strMongo,
        redis: strRedis,
        elasticsearch: strElastic,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao comparar bancos", detalhe: err.message });
    }
  }

  /**
   * MÓDULO 08 — EXPERIMENTO 2: ALTERAÇÃO SEM SINCRONIZAR (Altera só o MongoDB)
   * PATCH /api/jogos/:sku/sem-sincronizar
   * PATCH /api/jogos/:sku/preco-sem-cache
   */
  static async atualizarSemSincronizar(req: Request, res: Response): Promise<void> {
    try {
      const { sku: param } = req.params;
      const { preco, quantidade_estoque } = req.body;

      const updateFields: Record<string, any> = {};
      if (preco !== undefined) updateFields.preco = Number(preco);
      if (quantidade_estoque !== undefined) updateFields.quantidade_estoque = Number(quantidade_estoque);

      if (Object.keys(updateFields).length === 0) {
        res.status(400).json({ erro: "Pelo menos um dos campos ('preco' ou 'quantidade_estoque') deve ser informado." });
        return;
      }

      const col = getCollection("jogos");
      const result = await col.updateOne(buildJogoQuery(param), { $set: updateFields });

      if (result.matchedCount === 0) {
        res.status(404).json({ erro: `Jogo '${param}' não encontrado.` });
        return;
      }

      res.json({
        mongodb: `gravado (R$ ${preco !== undefined ? Number(preco).toFixed(2) : "atualizado"})`,
        redis: "não alterado (dado obsoleto / stale data)",
        elasticsearch: "não alterado (índice defasado)",
        aviso: "A fonte da verdade mudou; as duas cópias não. Consulte /:sku/comparar para ver a divergência.",
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao atualizar sem sincronizar", detalhe: err.message });
    }
  }

  /**
   * MÓDULO 08 — EXPERIMENTO 3: REINDEXAÇÃO TOTAL (Ingênua)
   * PATCH /api/jogos/:sku/reindexando-tudo
   */
  static async atualizarReindexandoTudo(req: Request, res: Response): Promise<void> {
    try {
      const { sku: param } = req.params;
      const { preco, quantidade_estoque } = req.body;

      const updateFields: Record<string, any> = {};
      if (preco !== undefined) updateFields.preco = Number(preco);
      if (quantidade_estoque !== undefined) updateFields.quantidade_estoque = Number(quantidade_estoque);

      const col = getCollection("jogos");
      const jogoAtualizado = await col.findOneAndUpdate(
        buildJogoQuery(param),
        { $set: updateFields },
        { returnDocument: "after" }
      );

      if (!jogoAtualizado) {
        res.status(404).json({ erro: `Jogo '${param}' não encontrado.` });
        return;
      }

      // Invalida cache no Redis
      await cacheDelMany([
        CACHE_KEY_PROMOCOES,
        CACHE_KEY_DESTAQUES,
        `${CACHE_PREFIX_SKU}${jogoAtualizado.sku}`,
        `${CACHE_PREFIX_SKU}${jogoAtualizado.titulo}`,
      ]);

      // Reindexação total ingênua do catálogo inteiro
      const totalIndexados = await seedElasticsearch(true);

      res.json({
        mongodb: "gravado",
        documentos_indexados: totalIndexados,
        redis: "invalidado",
        aviso: "Reindexação total concluída (custo elevado: reindexou todos os itens para alterar apenas um).",
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao atualizar reindexando tudo", detalhe: err.message });
    }
  }

  /**
   * MÓDULO 08 — EXPERIMENTOS 4 E 5: ESCRITA SINCRONIZADA COM SUPORTE A SIMULAÇÃO DE FALHA
   * PATCH /api/jogos/:sku
   * PATCH /api/jogos/:sku/preco-estoque
   */
  static async atualizarSincronizado(req: Request, res: Response): Promise<void> {
    try {
      const { sku: param } = req.params;
      const { preco, quantidade_estoque } = req.body;
      const { simular_falha } = req.query;

      const updateFields: Record<string, any> = {};
      if (preco !== undefined) updateFields.preco = Number(preco);
      if (quantidade_estoque !== undefined) updateFields.quantidade_estoque = Number(quantidade_estoque);

      if (Object.keys(updateFields).length === 0) {
        res.status(400).json({ erro: "Pelo menos um dos campos ('preco' ou 'quantidade_estoque') deve ser informado." });
        return;
      }

      // 1. Grava no MongoDB (Fonte da Verdade)
      const col = getCollection("jogos");
      const jogoAtualizado = await col.findOneAndUpdate(
        buildJogoQuery(param),
        { $set: updateFields },
        { returnDocument: "after" }
      );

      if (!jogoAtualizado) {
        res.status(404).json({ erro: `Jogo '${param}' não encontrado.` });
        return;
      }

      // 2. Invalida cache no Redis
      const chavesInvalidar = [
        CACHE_KEY_PROMOCOES,
        CACHE_KEY_DESTAQUES,
        `${CACHE_PREFIX_SKU}${jogoAtualizado.sku}`,
        `${CACHE_PREFIX_SKU}${jogoAtualizado.titulo}`,
      ];
      await cacheDelMany(chavesInvalidar);

      // 3. ElasticSearch: Atualiza APENAS aquele documento.
      // Qualquer falha (real ou simulada via ?simular_falha=elastic) cai no mesmo
      // catch e registra a pendência no Redis — o MongoDB nunca é revertido.
      try {
        if (simular_falha === "elastic") {
          throw new Error("Falha simulada: ElasticSearch fora do ar (?simular_falha=elastic)");
        }
        await indexarJogoNoElastic(jogoAtualizado);
      } catch (errElastic: any) {
        console.error("[Sincronização] Falha ao indexar no ElasticSearch:", errElastic.message);

        const payloadPendencia = JSON.stringify({
          jogo_id: jogoAtualizado._id.toString(),
          sku: jogoAtualizado.sku,
          titulo: jogoAtualizado.titulo,
          data_falha: new Date().toISOString(),
          motivo: errElastic.message,
        });

        try {
          await getRedisClient().rpush(KEY_SYNC_PENDENTES, payloadPendencia);
        } catch (errRedis: any) {
          // Nem o ElasticSearch nem a fila de pendências estão disponíveis.
          res.status(500).json({
            mongodb: "gravado",
            elasticsearch: `falhou: ${errElastic.message}`,
            erro: "Não foi possível registrar a pendência no Redis",
            detalhe: errRedis.message,
          });
          return;
        }

        res.status(202).json({
          mongodb: "gravado",
          redis: "invalidado",
          elasticsearch: "falhou (ElasticSearch fora do ar); pendência registrada",
          motivo: errElastic.message,
          chave_pendencias: KEY_SYNC_PENDENTES,
        });
        return;
      }

      res.json({
        mongodb: "gravado",
        redis: "invalidado",
        elasticsearch: "atualizado (1 documento)",
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro na escrita sincronizada", detalhe: err.message });
    }
  }

  /**
   * MÓDULO 08 — EXPERIMENTO 5: LISTAR PENDÊNCIAS REGISTRADAS NO REDIS
   * GET /api/jogos/sincronizacao/pendentes
   */
  static async listarPendencias(req: Request, res: Response): Promise<void> {
    try {
      const redis = getRedisClient();
      const pendenciasRaw = await redis.lrange(KEY_SYNC_PENDENTES, 0, -1);
      const pendencias = pendenciasRaw.map((raw) => {
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      });

      res.json({
        chave: KEY_SYNC_PENDENTES,
        total_pendentes: pendencias.length,
        pendencias,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao listar pendências", detalhe: err.message });
    }
  }

  /**
   * MÓDULO 08 — EXPERIMENTO 6: REPROCESSAMENTO DE PENDÊNCIAS
   * POST /api/jogos/sincronizacao/reprocessar
   */
  static async reprocessarPendencias(req: Request, res: Response): Promise<void> {
    try {
      const redis = getRedisClient();
      const pendenciasRaw = await redis.lrange(KEY_SYNC_PENDENTES, 0, -1);

      if (pendenciasRaw.length === 0) {
        res.json({
          reprocessados: 0,
          jogos: [],
          mensagem: "Nenhuma pendência na fila para reprocessar.",
        });
        return;
      }

      const col = getCollection("jogos");
      const reprocessados: string[] = [];
      const falhas: Array<{ sku?: string; titulo?: string; erro: string }> = [];
      const descartados: string[] = [];

      // Cada pendência só sai da fila (LREM) depois de reindexada com sucesso.
      // As que falham de novo permanecem em retrovault:sync:pendentes, e
      // pendências registradas durante o reprocessamento também não são perdidas
      // (nada de DEL na lista inteira).
      for (const raw of pendenciasRaw) {
        let item: any;
        try {
          item = JSON.parse(raw);
        } catch {
          // Payload corrompido nunca poderá ser reprocessado: descarta.
          await redis.lrem(KEY_SYNC_PENDENTES, 1, raw);
          descartados.push(raw);
          continue;
        }

        try {
          // Lê o dado ATUAL no MongoDB (garante o dado mais recente)
          const jogoAtual = ObjectId.isValid(item.jogo_id)
            ? await col.findOne({ _id: new ObjectId(item.jogo_id) })
            : null;

          if (jogoAtual) {
            await indexarJogoNoElastic(jogoAtual);
            reprocessados.push(jogoAtual.titulo);
          } else {
            // Jogo não existe mais na fonte da verdade: remove a cópia do índice.
            await getElasticClient().delete(
              { index: "jogos", id: String(item.jogo_id), refresh: true },
              { ignore: [404] }
            );
            descartados.push(item.sku ?? String(item.jogo_id));
          }

          await redis.lrem(KEY_SYNC_PENDENTES, 1, raw);
        } catch (e: any) {
          console.error("[Sincronização] Erro ao reprocessar item:", e.message);
          falhas.push({ sku: item.sku, titulo: item.titulo, erro: e.message });
        }
      }

      const pendentesRestantes = await redis.llen(KEY_SYNC_PENDENTES);

      res.json({
        reprocessados: reprocessados.length,
        jogos: reprocessados,
        falhas,
        descartados,
        pendentes_restantes: pendentesRestantes,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao reprocessar pendências", detalhe: err.message });
    }
  }

  /**
   * INVALIDAÇÃO MANUAL DO CACHE
   * DELETE /api/jogos/cache
   */
  static async limparCache(req: Request, res: Response): Promise<void> {
    try {
      await cacheDelMany([CACHE_KEY_PROMOCOES, CACHE_KEY_DESTAQUES]);
      res.json({
        mensagem: "Cache das consultas de jogos invalidado com sucesso!",
        cache_invalidado: true,
        chaves_removidas: [CACHE_KEY_PROMOCOES, CACHE_KEY_DESTAQUES],
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao limpar cache", detalhe: err.message });
    }
  }

  /**
   * CONTADOR ATÔMICO DE VISUALIZAÇÕES EM MEMÓRIA RAM (Redis INCR)
   * POST /api/jogos/:sku/view
   */
  static async registrarVisualizacao(req: Request, res: Response): Promise<void> {
    try {
      const { sku: param } = req.params;
      const col = getCollection("jogos");
      const jogo = await col.findOne(buildJogoQuery(param), { projection: { titulo: 1, sku: 1 } });

      if (!jogo) {
        res.status(404).json({ erro: `Jogo '${param}' não encontrado.` });
        return;
      }

      const key = `${CACHE_PREFIX_VIEWS}${jogo.sku}`;
      const totalViews = await cacheIncr(key);

      res.json({
        mensagem: "Visualização registrada com sucesso no Redis!",
        sku: jogo.sku,
        titulo: jogo.titulo,
        chave_redis: key,
        total_visualizacoes: totalViews,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao registrar visualização", detalhe: err.message });
    }
  }

  /**
   * 4. LISTAR TODOS OS JOGOS (Com filtros opcionais por plataforma, condicao e categoria)
   * GET /api/jogos
   */
  static async listar(req: Request, res: Response): Promise<void> {
    try {
      const { plataforma, condicao, categoria_id } = req.query;
      const filtro: Record<string, any> = { ativo: true };

      if (plataforma) {
        filtro.plataforma = String(plataforma);
      }

      if (condicao) {
        filtro["especificacoes_midia.condicao"] = String(condicao);
      }

      if (categoria_id && ObjectId.isValid(String(categoria_id))) {
        filtro.categoria_id = new ObjectId(String(categoria_id));
      }

      const col = getCollection("jogos");
      const jogos = await col.find(filtro).sort({ titulo: 1 }).toArray();

      res.json({
        origem: "MONGODB",
        total: jogos.length,
        filtros_aplicados: req.query,
        jogos,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao listar jogos", detalhe: err.message });
    }
  }

  /**
   * 5. OBTER JOGO POR SKU OU NOME (Com Cache-Aside: TTL de 5 minutos)
   * GET /api/jogos/:sku
   */
  static async obterPorSku(req: Request, res: Response): Promise<void> {
    const t0 = performance.now();
    try {
      const { sku: param } = req.params;
      const col = getCollection("jogos");

      // Tenta recuperar do cache Redis pelo parâmetro direto
      const cacheKey = `${CACHE_PREFIX_SKU}${param}`;
      const cached = await cacheGet<any>(cacheKey);

      if (cached) {
        const duracao = (performance.now() - t0).toFixed(2);
        res.setHeader("X-Cache", "HIT");
        res.json({
          origem: "REDIS (CACHE HIT)",
          tempo_resposta: `${duracao} ms`,
          jogo: cached,
        });
        return;
      }

      // Busca no MongoDB por SKU ou por Título
      const jogo = await col.findOne(buildJogoQuery(param));

      if (!jogo) {
        res.status(404).json({ erro: `Jogo '${param}' não encontrado.` });
        return;
      }

      // Salva no cache com TTL de 300s (5 minutos)
      await cacheSet(`${CACHE_PREFIX_SKU}${jogo.sku}`, jogo, 300);
      if (jogo.titulo !== jogo.sku) {
        await cacheSet(`${CACHE_PREFIX_SKU}${jogo.titulo}`, jogo, 300);
      }

      const duracao = (performance.now() - t0).toFixed(2);
      res.setHeader("X-Cache", "MISS");
      res.json({
        origem: "MONGODB (CACHE MISS)",
        tempo_resposta: `${duracao} ms`,
        jogo,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao buscar jogo", detalhe: err.message });
    }
  }

  /**
   * 6. CRIAR NOVO JOGO NO CATÁLOGO
   * POST /api/jogos
   */
  static async criar(req: Request, res: Response): Promise<void> {
    try {
      const { sku, titulo, preco, quantidade_estoque, plataforma, categoria_id, especificacoes_midia } = req.body;

      if (!sku || !titulo || preco === undefined || quantidade_estoque === undefined || !plataforma) {
        res.status(400).json({ erro: "Campos obrigatórios ausentes (sku, titulo, preco, quantidade_estoque, plataforma)." });
        return;
      }

      const col = getCollection("jogos");
      const existente = await col.findOne({ sku });
      if (existente) {
        res.status(409).json({ erro: `Já existe um jogo cadastrado com o SKU '${sku}'.` });
        return;
      }

      const novoJogo = {
        ...req.body,
        preco: Number(preco),
        quantidade_estoque: Number(quantidade_estoque),
        categoria_id: categoria_id && ObjectId.isValid(categoria_id) ? new ObjectId(categoria_id) : null,
        ativo: req.body.ativo !== false,
        data_cadastramento: new Date(),
        especificacoes_midia: especificacoes_midia || {
          condicao: "Seminovo",
          estado_disco: "Excelente",
          possui_caixa_original: true,
          possui_manual: true,
          regiao: "NTSC-U",
          ano_lancamento: new Date().getFullYear(),
        },
        avaliacoes_resumo: req.body.avaliacoes_resumo || {
          media_nota: 5.0,
          total_avaliacoes: 1,
        },
      };

      const result = await col.insertOne(novoJogo);

      // Invalida cache das listas para incluir o novo produto
      await cacheDelMany([CACHE_KEY_PROMOCOES, CACHE_KEY_DESTAQUES]);

      // Sincroniza novo jogo no ElasticSearch
      let elasticStatus = "NÃO_APLICADO";
      try {
        const elastic = getElasticClient();
        let catNome = "Geral";
        if (categoria_id && ObjectId.isValid(categoria_id)) {
          const colCat = getCollection("categorias");
          const cat = await colCat.findOne({ _id: new ObjectId(categoria_id) });
          if (cat) catNome = cat.nome;
        }

        await elastic.index({
          index: "jogos",
          id: result.insertedId.toString(),
          document: {
            jogo_id: result.insertedId.toString(),
            sku: novoJogo.sku,
            titulo: novoJogo.titulo,
            descricao: novoJogo.descricao || "",
            plataforma: novoJogo.plataforma,
            categoria: catNome,
            preco: novoJogo.preco,
            quantidade_estoque: novoJogo.quantidade_estoque,
            tags: Array.isArray(novoJogo.tags) ? novoJogo.tags.join(" ") : (novoJogo.tags || ""),
            condicao: novoJogo.especificacoes_midia?.condicao || "Seminovo",
            ano_lancamento: novoJogo.especificacoes_midia?.ano_lancamento || null,
            ativo: novoJogo.ativo !== false,
            media_nota: novoJogo.avaliacoes_resumo?.media_nota || 0,
          },
          refresh: true,
        });
        elasticStatus = "INDEXADO COM SUCESSO (REFRESH IMEDIATO)";
      } catch (elasticErr: any) {
        console.error(`[Elasticsearch] Falha na indexação do novo jogo ${sku}:`, elasticErr.message);
        elasticStatus = `FALHA_NA_INDEXACAO: ${elasticErr.message}`;
      }

      res.status(201).json({
        mensagem: "Jogo cadastrado com sucesso e sincronizado entre bancos!",
        id: result.insertedId,
        jogo: novoJogo,
        sincronizacao: {
          mongodb: "INSERIDO (FONTE DA VERDADE)",
          redis: "CACHE DAS LISTAS INVALIDADO",
          elasticsearch: elasticStatus,
        },
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao cadastrar jogo", detalhe: err.message });
    }
  }
}
