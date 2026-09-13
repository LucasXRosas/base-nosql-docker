import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { getCollection } from "../database/mongo.js";

export class ClientesController {
  /**
   * Listar clientes cadastrados
   * GET /api/clientes
   */
  static async listar(req: Request, res: Response): Promise<void> {
    try {
      const col = getCollection("clientes");
      const clientes = await col.find().sort({ nome: 1 }).toArray();

      res.json({
        origem: "MONGODB",
        total: clientes.length,
        clientes,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao listar clientes", detalhe: err.message });
    }
  }

  /**
   * Obter cliente por ID com sua lista de desejos (Wishlist)
   * GET /api/clientes/:id
   */
  static async obterPorId(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        res.status(400).json({ erro: "ID do cliente inválido." });
        return;
      }

      const col = getCollection("clientes");
      const cliente = await col.findOne({ _id: new ObjectId(id) });

      if (!cliente) {
        res.status(404).json({ erro: `Cliente com ID '${id}' não encontrado.` });
        return;
      }

      // Se o cliente possuir itens em 'desejos', busca detalhes dos jogos referenciados
      let jogosDesejados: any[] = [];
      if (Array.isArray(cliente.desejos) && cliente.desejos.length > 0) {
        const colJogos = getCollection("jogos");
        jogosDesejados = await colJogos
          .find({ _id: { $in: cliente.desejos } })
          .project({ titulo: 1, sku: 1, preco: 1, plataforma: 1 })
          .toArray();
      }

      res.json({
        origem: "MONGODB",
        cliente: {
          ...cliente,
          detalhes_desejos: jogosDesejados,
        },
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao buscar cliente", detalhe: err.message });
    }
  }

  /**
   * Adicionar jogo à Wishlist do cliente
   * POST /api/clientes/:id/desejos
   */
  static async adicionarDesejo(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { jogo_id } = req.body;

      if (!ObjectId.isValid(id) || !ObjectId.isValid(jogo_id)) {
        res.status(400).json({ erro: "IDs de cliente ou jogo inválidos." });
        return;
      }

      const col = getCollection("clientes");
      const result = await col.updateOne(
        { _id: new ObjectId(id) },
        { $addToSet: { desejos: new ObjectId(jogo_id) } }
      );

      if (result.matchedCount === 0) {
        res.status(404).json({ erro: "Cliente não encontrado." });
        return;
      }

      res.json({
        mensagem: "Jogo adicionado à lista de desejos com sucesso!",
        cliente_id: id,
        jogo_id,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao adicionar desejo", detalhe: err.message });
    }
  }
}
