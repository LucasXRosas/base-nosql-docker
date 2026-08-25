import { Request, Response } from "express";
import { getCollection } from "../database/mongo.js";
import { cacheGet, cacheSet } from "../database/redis.js";

export class ItensController {
  /**
   * GET /api/itens
   * Busca itens na coleção simples do MongoDB com Cache no Redis (< 2ms)
   */
  static async listar(req: Request, res: Response): Promise<void> {
    try {
      const CHAVE_CACHE = "cache:itens:todos";

      // 1. Tenta buscar no Cache Redis
      const cached = await cacheGet(CHAVE_CACHE);
      if (cached) {
        res.json({
          origem: "REDIS_CACHE (< 2ms)",
          dados: cached,
        });
        return;
      }

      // 2. Se não estiver no cache, busca no MongoDB (Coleção simples 'itens')
      const col = getCollection("itens");
      const itens = await col.find().toArray();

      // 3. Salva no Redis por 60 segundos
      await cacheSet(CHAVE_CACHE, itens, 60);

      res.json({
        origem: "MONGODB (Salvo no Redis por 60s)",
        total: itens.length,
        dados: itens,
      });
    } catch (err: any) {
      res.status(500).json({ erro: err.message });
    }
  }

  // ==========================================================================
  // Alunos: para criar novas funções, basta adicionar novos métodos abaixo:
  //
  // static async minhaFuncao(req: Request, res: Response): Promise<void> {
  //   // seu código aqui
  // }
  // ==========================================================================
}
