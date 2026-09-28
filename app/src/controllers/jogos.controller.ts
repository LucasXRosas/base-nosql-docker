import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { performance } from "perf_hooks";
import { getCollection } from "../database/mongo.js";
import { cacheGet, cacheSet, cacheDel, cacheDelMany, cacheIncr } from "../database/redis.js";

const CACHE_KEY_DESTAQUES = "retrovault:jogos:destaques";
const CACHE_KEY_PROMOCOES = "retrovault:jogos:promocoes";
const CACHE_PREFIX_SKU = "retrovault:jogos:sku:";
const CACHE_PREFIX_VIEWS = "retrovault:views:";

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
   * 3. ATUALIZAÇÃO DE PREÇO E ESTOQUE COM INVALIDAÇÃO ATIVA (Checkpoint 1 — Consulta 4 + Invalidação)
   * PATCH /api/jogos/:sku/preco-estoque
   */
  static async atualizarPrecoEstoque(req: Request, res: Response): Promise<void> {
    try {
      const { sku } = req.params;
      const { preco, quantidade_estoque } = req.body;

      const updateFields: Record<string, any> = {};
      if (preco !== undefined) updateFields.preco = Number(preco);
      if (quantidade_estoque !== undefined) updateFields.quantidade_estoque = Number(quantidade_estoque);

      if (Object.keys(updateFields).length === 0) {
        res.status(400).json({ erro: "Pelo menos um dos campos ('preco' ou 'quantidade_estoque') deve ser informado." });
        return;
      }

      const col = getCollection("jogos");
      const result = await col.updateOne(
        { sku },
        { $set: updateFields }
      );

      if (result.matchedCount === 0) {
        res.status(404).json({ erro: `Jogo com SKU '${sku}' não encontrado.` });
        return;
      }

      // Invalidação Ativa no Redis: limpa listas cacheadas e o detalhe do item
      const chavesInvalidar = [
        CACHE_KEY_PROMOCOES,
        CACHE_KEY_DESTAQUES,
        `${CACHE_PREFIX_SKU}${sku}`,
      ];
      await cacheDelMany(chavesInvalidar);

      res.json({
        mensagem: "Preço e/ou estoque atualizados com sucesso e cache invalidado!",
        sku,
        novos_valores: updateFields,
        cache_invalidado: true,
        chaves_invalidadas: chavesInvalidar,
        aviso: "Caches do Redis invalidados com sucesso. A próxima consulta buscará dados frescos do MongoDB.",
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao atualizar preço e estoque", detalhe: err.message });
    }
  }

  /**
   * DEMONSTRAÇÃO DE STALE DATA (Dado Obsoleto) — ATUALIZA MONGODB SEM LIMPAR O REDIS
   * PATCH /api/jogos/:sku/preco-sem-cache
   */
  static async atualizarPrecoSemInvalidar(req: Request, res: Response): Promise<void> {
    try {
      const { sku } = req.params;
      const { preco } = req.body;

      if (preco === undefined) {
        res.status(400).json({ erro: "Campo 'preco' é obrigatório no corpo da requisição." });
        return;
      }

      const col = getCollection("jogos");
      const result = await col.updateOne(
        { sku },
        { $set: { preco: Number(preco) } }
      );

      if (result.matchedCount === 0) {
        res.status(404).json({ erro: `Jogo com SKU '${sku}' não encontrado.` });
        return;
      }

      res.json({
        mensagem: "Preço atualizado no MongoDB SEM invalidar o cache (Demonstração de Stale Data)!",
        sku,
        novo_preco: Number(preco),
        cache_invalidado: false,
        aviso: "O MongoDB foi atualizado, mas o Redis continua com o valor antigo em memória RAM. Consulte /api/jogos/promocoes para observar o dado obsoleto (Stale Data)!",
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao atualizar preço sem invalidar cache", detalhe: err.message });
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
      const { sku } = req.params;
      const col = getCollection("jogos");
      const jogo = await col.findOne({ sku }, { projection: { titulo: 1, sku: 1 } });

      if (!jogo) {
        res.status(404).json({ erro: `Jogo com SKU '${sku}' não encontrado.` });
        return;
      }

      const key = `${CACHE_PREFIX_VIEWS}${sku}`;
      const totalViews = await cacheIncr(key);

      res.json({
        mensagem: "Visualização registrada com sucesso no Redis!",
        sku,
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
   * 5. OBTER JOGO POR SKU (Com Cache-Aside)
   * GET /api/jogos/:sku
   * TTL: 60 segundos
   */
  static async obterPorSku(req: Request, res: Response): Promise<void> {
    const t0 = performance.now();
    try {
      const { sku } = req.params;
      const cacheKey = `${CACHE_PREFIX_SKU}${sku}`;

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

      const col = getCollection("jogos");
      const jogo = await col.findOne({ sku });

      if (!jogo) {
        res.status(404).json({ erro: `Jogo com SKU '${sku}' não encontrado.` });
        return;
      }

      // Salva no cache com TTL de 60s
      await cacheSet(cacheKey, jogo, 60);

      const duracao = (performance.now() - t0).toFixed(2);
      res.setHeader("X-Cache", "MISS");
      res.json({
        origem: "MONGODB (CACHE MISS)",
        tempo_resposta: `${duracao} ms`,
        jogo,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao buscar jogo por SKU", detalhe: err.message });
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

      res.status(201).json({
        mensagem: "Jogo cadastrado com sucesso!",
        id: result.insertedId,
        jogo: novoJogo,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao cadastrar jogo", detalhe: err.message });
    }
  }
}
