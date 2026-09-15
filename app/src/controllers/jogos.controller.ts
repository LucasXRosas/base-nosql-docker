import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { getCollection } from "../database/mongo.js";
import { cacheGet, cacheSet, cacheDel } from "../database/redis.js";

const CACHE_KEY_DESTAQUES = "cache:jogos:destaques";

export class JogosController {
  /**
   * 1. VITRINE DE JOGOS MAIS BEM AVALIADOS (Checkpoint 1 — Consulta 1)
   * GET /api/jogos/destaques
   */
  static async listarDestaques(req: Request, res: Response): Promise<void> {
    try {
      // Tenta recuperar do cache Redis (< 2ms)
      const cached = await cacheGet<any[]>(CACHE_KEY_DESTAQUES);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        res.json({
          origem: "REDIS_CACHE (< 2ms)",
          total: cached.length,
          destaques: cached,
        });
        return;
      }

      const col = getCollection("jogos");
      const jogos = await col
        .find({ ativo: true, "avaliacoes_resumo.media_nota": { $gte: 4.5 } })
        .sort({ "avaliacoes_resumo.media_nota": -1 })
        .limit(5)
        .toArray();

      // Salva no Redis com TTL de 60 segundos
      await cacheSet(CACHE_KEY_DESTAQUES, jogos, 60);

      res.setHeader("X-Cache", "MISS");
      res.json({
        origem: "MONGODB (Salvo no Redis por 60s)",
        total: jogos.length,
        destaques: jogos,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao listar destaques", detalhe: err.message });
    }
  }

  /**
   * 2. BUSCA DE MÍDIAS EM PROMOÇÃO (Checkpoint 1 — Consulta 2)
   * GET /api/jogos/promocoes
   */
  static async listarPromocoes(req: Request, res: Response): Promise<void> {
    try {
      const col = getCollection("jogos");
      const promocoes = await col
        .find({ preco: { $lte: 150.0 }, ativo: true, quantidade_estoque: { $gt: 0 } })
        .sort({ preco: 1 })
        .toArray();

      res.json({
        origem: "MONGODB",
        total: promocoes.length,
        promocoes,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao listar promoções", detalhe: err.message });
    }
  }

  /**
   * 3. ATUALIZAÇÃO DE PREÇO E ESTOQUE DO JOGO (Checkpoint 1 — Consulta 4)
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

      // Invalida cache de destaques pois o item pode ter sofrido alteração
      await cacheDel(CACHE_KEY_DESTAQUES);

      res.json({
        mensagem: "Preço e/ou estoque atualizados com sucesso!",
        sku,
        novos_valores: updateFields,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao atualizar preço e estoque", detalhe: err.message });
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
   * 5. OBTER JOGO POR SKU
   * GET /api/jogos/:sku
   */
  static async obterPorSku(req: Request, res: Response): Promise<void> {
    try {
      const { sku } = req.params;
      const col = getCollection("jogos");
      const jogo = await col.findOne({ sku });

      if (!jogo) {
        res.status(404).json({ erro: `Jogo com SKU '${sku}' não encontrado.` });
        return;
      }

      res.json({
        origem: "MONGODB",
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
      await cacheDel(CACHE_KEY_DESTAQUES);

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
