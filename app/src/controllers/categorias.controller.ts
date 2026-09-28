import { Request, Response } from "express";
import { performance } from "perf_hooks";
import { getCollection } from "../database/mongo.js";
import { cacheGet, cacheSet } from "../database/redis.js";

const CACHE_KEY_CATEGORIAS = "retrovault:categorias:todas";

export class CategoriasController {
  /**
   * Listar todas as categorias (Cache-Aside: TTL 300 segundos)
   * GET /api/categorias
   */
  static async listar(req: Request, res: Response): Promise<void> {
    const t0 = performance.now();
    try {
      const cached = await cacheGet<any[]>(CACHE_KEY_CATEGORIAS);
      if (cached) {
        const duracao = (performance.now() - t0).toFixed(2);
        res.setHeader("X-Cache", "HIT");
        res.json({
          origem: "REDIS (CACHE HIT)",
          tempo_resposta: `${duracao} ms`,
          total: cached.length,
          categorias: cached,
        });
        return;
      }

      const col = getCollection("categorias");
      const categorias = await col.find({ ativa: true }).sort({ nome: 1 }).toArray();

      // TTL de 300s (5 minutos) para dados de categorias (quase estáticos)
      await cacheSet(CACHE_KEY_CATEGORIAS, categorias, 300);

      const duracao = (performance.now() - t0).toFixed(2);
      res.setHeader("X-Cache", "MISS");
      res.json({
        origem: "MONGODB (CACHE MISS)",
        tempo_resposta: `${duracao} ms`,
        total: categorias.length,
        categorias,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao listar categorias", detalhe: err.message });
    }
  }

  /**
   * Obter categoria por slug amigável
   * GET /api/categorias/:slug
   */
  static async obterPorSlug(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const col = getCollection("categorias");
      const categoria = await col.findOne({ slug });

      if (!categoria) {
        res.status(404).json({ erro: `Categoria '${slug}' não encontrada.` });
        return;
      }

      res.json({
        origem: "MONGODB",
        categoria,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao buscar categoria", detalhe: err.message });
    }
  }
}
