import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { getCollection } from "../database/mongo.js";

export class PedidosController {
  /**
   * 1. FILA DE EXPEDIÇÃO E ENVIO DE PEDIDOS (Checkpoint 1 — Consulta 3)
   * GET /api/pedidos/expedicao
   */
  static async filaExpedicao(req: Request, res: Response): Promise<void> {
    try {
      const col = getCollection("pedidos");
      const pedidos = await col
        .find({ status: { $in: ["pago", "em_separacao"] } })
        .sort({ data_pedido: 1 })
        .toArray();

      res.json({
        origem: "MONGODB",
        total: pedidos.length,
        descricao: "Pedidos aguardando separação e despacho ordenados por data de compra",
        pedidos,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao consultar fila de expedição", detalhe: err.message });
    }
  }

  /**
   * 2. ATUALIZAÇÃO DE STATUS DE ENVIO DO PEDIDO (Checkpoint 1 — Consulta 5)
   * PATCH /api/pedidos/:id/status
   */
  static async atualizarStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status, codigo_rastreio } = req.body;

      if (!ObjectId.isValid(id)) {
        res.status(400).json({ erro: "ID do pedido inválido." });
        return;
      }

      if (!status) {
        res.status(400).json({ erro: "Campo 'status' é obrigatório." });
        return;
      }

      const updateFields: Record<string, any> = { status };
      if (codigo_rastreio !== undefined) {
        updateFields["entrega.codigo_rastreio"] = codigo_rastreio || null;
      }

      const col = getCollection("pedidos");
      const result = await col.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateFields }
      );

      if (result.matchedCount === 0) {
        res.status(404).json({ erro: `Pedido com ID '${id}' não encontrado.` });
        return;
      }

      res.json({
        mensagem: "Status do pedido atualizado com sucesso!",
        id,
        status,
        codigo_rastreio: codigo_rastreio || null,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao atualizar status do pedido", detalhe: err.message });
    }
  }

  /**
   * 3. LISTAR TODOS OS PEDIDOS
   * GET /api/pedidos
   */
  static async listar(req: Request, res: Response): Promise<void> {
    try {
      const { status, cliente_id } = req.query;
      const filtro: Record<string, any> = {};

      if (status) {
        filtro.status = String(status);
      }

      if (cliente_id && ObjectId.isValid(String(cliente_id))) {
        filtro.cliente_id = new ObjectId(String(cliente_id));
      }

      const col = getCollection("pedidos");
      const pedidos = await col.find(filtro).sort({ data_pedido: -1 }).toArray();

      res.json({
        origem: "MONGODB",
        total: pedidos.length,
        pedidos,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao listar pedidos", detalhe: err.message });
    }
  }

  /**
   * 4. OBTER PEDIDO POR ID
   * GET /api/pedidos/:id
   */
  static async obterPorId(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        res.status(400).json({ erro: "ID do pedido inválido." });
        return;
      }

      const col = getCollection("pedidos");
      const pedido = await col.findOne({ _id: new ObjectId(id) });

      if (!pedido) {
        res.status(404).json({ erro: `Pedido com ID '${id}' não encontrado.` });
        return;
      }

      res.json({
        origem: "MONGODB",
        pedido,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao buscar pedido", detalhe: err.message });
    }
  }

  /**
   * 5. CRIAR NOVO PEDIDO (Snapshot Histórico dos Itens)
   * POST /api/pedidos
   */
  static async criar(req: Request, res: Response): Promise<void> {
    try {
      const { cliente_id, itens, entrega, valor_total } = req.body;

      if (!cliente_id || !Array.isArray(itens) || itens.length === 0) {
        res.status(400).json({ erro: "cliente_id e itens (array não vazio) são obrigatórios." });
        return;
      }

      const itensFormatados = itens.map((item: any) => ({
        jogo_id: ObjectId.isValid(item.jogo_id) ? new ObjectId(item.jogo_id) : item.jogo_id,
        titulo: item.titulo,
        plataforma: item.plataforma,
        quantidade: Number(item.quantidade) || 1,
        preco_unitario: Number(item.preco_unitario) || 0,
      }));

      const novoPedido = {
        cliente_id: ObjectId.isValid(cliente_id) ? new ObjectId(cliente_id) : cliente_id,
        itens: itensFormatados,
        valor_total: Number(valor_total) || itensFormatados.reduce((acc: number, it: any) => acc + it.preco_unitario * it.quantidade, 0),
        status: req.body.status || "pago",
        data_pedido: new Date(),
        entrega: entrega || {
          endereco_completo: "Endereço cadastrado",
          codigo_rastreio: null,
          valor_frete: 15.0,
        },
      };

      const col = getCollection("pedidos");
      const result = await col.insertOne(novoPedido);

      res.status(201).json({
        mensagem: "Pedido registrado com sucesso!",
        id: result.insertedId,
        pedido: novoPedido,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao registrar pedido", detalhe: err.message });
    }
  }
}
