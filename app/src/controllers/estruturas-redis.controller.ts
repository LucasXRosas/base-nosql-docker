import { Request, Response } from "express";
import { getRedisClient } from "../database/redis.js";

export class EstruturasRedisController {
  // =========================================================================
  // 1. HASHES: Carrinho de Compras em Memória (retrovault:carrinho:<cliente_id>)
  // =========================================================================

  /**
   * Inicializar ou atualizar carrinho de compras
   * POST /api/redis/carrinho/:cliente_id
   */
  static async salvarCarrinho(req: Request, res: Response): Promise<void> {
    try {
      const { cliente_id } = req.params;
      const { cliente_nome, status, total_itens, valor_total } = req.body;
      const redis = getRedisClient();
      const key = `retrovault:carrinho:${cliente_id}`;

      await redis.hset(key, {
        cliente_id,
        cliente_nome: cliente_nome || "Cliente RetroVault",
        status: status || "aberto",
        total_itens: String(total_itens !== undefined ? total_itens : 0),
        valor_total: String(valor_total !== undefined ? valor_total : "0.00"),
        atualizado_em: new Date().toISOString(),
      });

      // TTL de 24 horas para carrinhos em memória
      await redis.expire(key, 86400);

      const dados = await redis.hgetall(key);

      res.status(201).json({
        mensagem: "Carrinho gravado no Redis (Estrutura: Hash) com sucesso!",
        estrutura: "HASH (HSET)",
        chave: key,
        carrinho: dados,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao salvar carrinho no Redis", detalhe: err.message });
    }
  }

  /**
   * Adicionar jogo ao carrinho e incrementar contador atomicamente
   * PATCH /api/redis/carrinho/:cliente_id/adicionar-item
   */
  static async adicionarItemCarrinho(req: Request, res: Response): Promise<void> {
    try {
      const { cliente_id } = req.params;
      const { titulo, quantidade = 1, preco = 0 } = req.body;
      const redis = getRedisClient();
      const key = `retrovault:carrinho:${cliente_id}`;

      const existe = await redis.exists(key);
      if (!existe) {
        res.status(404).json({ erro: `Carrinho para cliente '${cliente_id}' não encontrado.` });
        return;
      }

      // Incrementa atomicamente a quantidade de itens no Hash
      const novoTotalItens = await redis.hincrby(key, "total_itens", Number(quantidade));

      // Atualiza o valor total e o último jogo adicionado
      const carrinhoAtual = await redis.hgetall(key);
      const valorAtual = parseFloat(carrinhoAtual.valor_total || "0");
      const acrescimo = Number(preco) * Number(quantidade);
      const novoValorTotal = (valorAtual + acrescimo).toFixed(2);

      await redis.hset(key, {
        valor_total: novoValorTotal,
        ultimo_item_adicionado: titulo || "Mídia Física",
        atualizado_em: new Date().toISOString(),
      });

      res.json({
        mensagem: "Item adicionado ao carrinho com incremento atômico!",
        estrutura: "HASH (HINCRBY)",
        chave: key,
        item_adicionado: { titulo, quantidade, preco },
        total_itens: novoTotalItens,
        valor_total: novoValorTotal,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao adicionar item ao carrinho", detalhe: err.message });
    }
  }

  /**
   * Consultar dados do carrinho
   * GET /api/redis/carrinho/:cliente_id
   */
  static async obterCarrinho(req: Request, res: Response): Promise<void> {
    try {
      const { cliente_id } = req.params;
      const redis = getRedisClient();
      const key = `retrovault:carrinho:${cliente_id}`;

      const carrinho = await redis.hgetall(key);
      if (!carrinho || Object.keys(carrinho).length === 0) {
        res.status(404).json({ erro: `Carrinho '${cliente_id}' não encontrado no Redis.` });
        return;
      }

      res.json({
        origem: "REDIS",
        estrutura: "HASH (HGETALL)",
        chave: key,
        carrinho,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao obter carrinho", detalhe: err.message });
    }
  }

  // =========================================================================
  // 2. LISTS: Fila de Expedição / Envio Postal FIFO (retrovault:expedicao:pedidos)
  // =========================================================================

  /**
   * Inserir pedido pago na esteira de despacho postal (RPUSH)
   * POST /api/redis/expedicao/pedidos
   */
  static async enfileirarExpedicao(req: Request, res: Response): Promise<void> {
    try {
      const { pedido_id, cliente, destino, total_itens } = req.body;
      const redis = getRedisClient();
      const key = "retrovault:expedicao:pedidos";

      const payload = JSON.stringify({
        pedido_id: pedido_id || `PED-${Date.now().toString().slice(-6)}`,
        cliente: cliente || "Colecionador",
        destino: destino || "Curitiba/PR",
        total_itens: total_itens || 1,
        enfileirado_em: new Date().toISOString(),
      });

      const tamanhoFila = await redis.rpush(key, payload);

      res.status(201).json({
        mensagem: "Pedido enfileirado na esteira postal com sucesso!",
        estrutura: "LIST (RPUSH — FIFO)",
        chave: key,
        posicao_na_fila: tamanhoFila,
        pedido: JSON.parse(payload),
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao enfileirar pedido na expedição", detalhe: err.message });
    }
  }

  /**
   * Listar todos os pedidos da fila de expedição (LRANGE 0 -1)
   * GET /api/redis/expedicao/pedidos
   */
  static async listarFilaExpedicao(req: Request, res: Response): Promise<void> {
    try {
      const redis = getRedisClient();
      const key = "retrovault:expedicao:pedidos";

      const itensRaw = await redis.lrange(key, 0, -1);
      const pedidos = itensRaw.map((raw) => {
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      });

      res.json({
        estrutura: "LIST (LRANGE)",
        chave: key,
        total_na_fila: pedidos.length,
        pedidos,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao listar fila de expedição", detalhe: err.message });
    }
  }

  /**
   * Atendente retira o próximo pedido para empacotamento e envio (LPOP)
   * POST /api/redis/expedicao/atender
   */
  static async atenderProximoPedido(req: Request, res: Response): Promise<void> {
    try {
      const redis = getRedisClient();
      const key = "retrovault:expedicao:pedidos";

      const proximoRaw = await redis.lpop(key);
      if (!proximoRaw) {
        res.status(200).json({
          mensagem: "Fila de expedição vazia. Nenhum pacote pendente de envio no momento.",
          estrutura: "LIST (LPOP)",
          total_restante: 0,
        });
        return;
      }

      const tamanhoRestante = await redis.llen(key);

      res.json({
        mensagem: "Próximo pedido retirado da fila para empacotamento e despacho!",
        estrutura: "LIST (LPOP)",
        pedido_processado: JSON.parse(proximoRaw),
        pedidos_restantes_na_fila: tamanhoRestante,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao atender próximo pedido", detalhe: err.message });
    }
  }

  // =========================================================================
  // 3. SETS: Consoles e Plataformas Ativas (retrovault:consoles:ativos)
  // =========================================================================

  /**
   * Cadastrar plataformas suportadas sem duplicidades (SADD)
   * POST /api/redis/consoles
   */
  static async adicionarConsoles(req: Request, res: Response): Promise<void> {
    try {
      const { consoles } = req.body;
      if (!Array.isArray(consoles) || consoles.length === 0) {
        res.status(400).json({ erro: "Envie um array de strings no campo 'consoles'." });
        return;
      }

      const redis = getRedisClient();
      const key = "retrovault:consoles:ativos";

      const adicionados = await redis.sadd(key, ...consoles);
      const todos = await redis.smembers(key);

      res.status(201).json({
        mensagem: "Conjunto de plataformas atualizado sem duplicatas!",
        estrutura: "SET (SADD)",
        chave: key,
        novos_membros_inseridos: adicionados,
        total_consoles_ativos: todos.length,
        consoles: todos,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao adicionar consoles no Set", detalhe: err.message });
    }
  }

  /**
   * Listar todas as plataformas do catálogo (SMEMBERS)
   * GET /api/redis/consoles
   */
  static async listarConsoles(req: Request, res: Response): Promise<void> {
    try {
      const redis = getRedisClient();
      const key = "retrovault:consoles:ativos";

      const consoles = await redis.smembers(key);

      res.json({
        estrutura: "SET (SMEMBERS)",
        chave: key,
        total: consoles.length,
        consoles: consoles.sort(),
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao listar consoles do Set", detalhe: err.message });
    }
  }

  /**
   * Verificar se uma plataforma específica é suportada (SISMEMBER O(1))
   * GET /api/redis/consoles/verificar?console=...
   */
  static async verificarConsole(req: Request, res: Response): Promise<void> {
    try {
      const { console: nomeConsole } = req.query;
      if (!nomeConsole) {
        res.status(400).json({ erro: "Parâmetro 'console' é obrigatório na query string." });
        return;
      }

      const redis = getRedisClient();
      const key = "retrovault:consoles:ativos";

      const existe = await redis.sismember(key, String(nomeConsole));

      res.json({
        estrutura: "SET (SISMEMBER — O(1))",
        chave: key,
        console_consultado: nomeConsole,
        suportado: existe === 1,
        mensagem: existe === 1 ? `Plataforma '${nomeConsole}' está ativa no RetroVault!` : `Plataforma '${nomeConsole}' não é comercializada.`,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao verificar console no Set", detalhe: err.message });
    }
  }

  // =========================================================================
  // 4. SORTED SETS: Ranking de Vendas em Tempo Real (retrovault:ranking:jogos:vendidos)
  // =========================================================================

  /**
   * Registrar venda de um jogo com incremento de pontuação (ZINCRBY)
   * POST /api/redis/ranking/venda
   */
  static async registrarVendaRanking(req: Request, res: Response): Promise<void> {
    try {
      const { jogo, quantidade = 1 } = req.body;
      if (!jogo) {
        res.status(400).json({ erro: "Campo 'jogo' é obrigatório no corpo da requisição." });
        return;
      }

      const redis = getRedisClient();
      const key = "retrovault:ranking:jogos:vendidos";

      const novoScore = await redis.zincrby(key, Number(quantidade), String(jogo));

      res.json({
        mensagem: "Venda computada no placar em tempo real!",
        estrutura: "SORTED SET (ZINCRBY)",
        chave: key,
        jogo,
        quantidade_adicionada: Number(quantidade),
        vendas_totais_acumuladas: parseFloat(novoScore),
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao registrar venda no ranking", detalhe: err.message });
    }
  }

  /**
   * Consultar Top N mais vendidos ordenados por score decrescente (ZREVRANGE)
   * GET /api/redis/ranking/top?limite=...
   */
  static async listarTopJogos(req: Request, res: Response): Promise<void> {
    try {
      const limite = Math.max(1, parseInt(String(req.query.limite || "5"), 10));
      const redis = getRedisClient();
      const key = "retrovault:ranking:jogos:vendidos";

      // ZREVRANGE key 0 (limite - 1) WITHSCORES
      const resultadosComScores = await redis.zrevrange(key, 0, limite - 1, "WITHSCORES");

      const ranking: Array<{ posicao: number; jogo: string; unidades_vendidas: number }> = [];
      for (let i = 0; i < resultadosComScores.length; i += 2) {
        ranking.push({
          posicao: ranking.length + 1,
          jogo: resultadosComScores[i],
          unidades_vendidas: parseFloat(resultadosComScores[i + 1]),
        });
      }

      res.json({
        origem: "REDIS",
        estrutura: "SORTED SET (ZSET — ZREVRANGE)",
        chave: key,
        total_itens_retornados: ranking.length,
        ranking,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao listar ranking de jogos", detalhe: err.message });
    }
  }
}
