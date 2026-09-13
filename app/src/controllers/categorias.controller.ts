import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { getCollection } from "../database/mongo.js";

export class CategoriasController {
  /**
   * Listar todas as categorias
   * GET /api/categorias
   */
  static async listar(req: Request, res: Response): Promise<void> {
    try {
      const col = getCollection("categorias");
      const categorias = await col.find({ ativa: true }).sort({ nome: 1 }).toArray();

      res.json({
        origem: "MONGODB",
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
