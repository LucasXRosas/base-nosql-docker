import { Request, Response } from "express";
import { getDb, getCollection } from "../database/mongo.js";
import { getRedisClient, cacheGet, cacheSet } from "../database/redis.js";
import { getElasticClient } from "../database/elastic.js";

/**
 * ============================================================================
 * PLAYGROUND DO ALUNO — ESPAÇO PARA AULAS PRÁTICAS E EXPERIMENTOS
 * ============================================================================
 * 
 * Aqui você pode escrever suas próprias funções e controllers durante as aulas!
 * 
 * Como usar os bancos:
 * 
 * 1. MONGODB:
 *    const db = getDb();
 *    const clientes = await db.collection("clientes").find().toArray();
 * 
 * 2. REDIS:
 *    await cacheSet("minha-chave", { teste: 123 }, 60); // 60 segundos
 *    const valor = await cacheGet("minha-chave");
 * 
 * 3. ELASTICSEARCH:
 *    const elastic = getElasticClient();
 *    const res = await elastic.search({ index: "pratos", query: { match_all: {} } });
 */

export class PlaygroundController {
  /**
   * Exemplo de função: Consultar clientes no MongoDB
   * GET /api/playground/clientes
   */
  static async listarClientes(req: Request, res: Response): Promise<void> {
    try {
      const col = getCollection("clientes");
      const clientes = await col.find().limit(10).toArray();

      res.json({
        mensagem: "Exemplo no Playground executado com sucesso!",
        total: clientes.length,
        clientes,
      });
    } catch (err: any) {
      res.status(500).json({ erro: err.message });
    }
  }

  /**
   * Exemplo de função: Testar contador no Redis
   * GET /api/playground/contador
   */
  static async incrementarContador(req: Request, res: Response): Promise<void> {
    try {
      const redis = getRedisClient();
      const novoValor = await redis.incr("playground:visitas");

      res.json({
        mensagem: "Contador atômico no Redis incrementado!",
        chave: "playground:visitas",
        total_visitas: novoValor,
      });
    } catch (err: any) {
      res.status(500).json({ erro: err.message });
    }
  }

  /**
   * ESPAÇO PARA O ALUNO CRIAR NOVAS FUNÇÕES:
   * 
   * static async meuExercicio(req: Request, res: Response): Promise<void> {
   *   // Seu código aqui!
   * }
   */
}
