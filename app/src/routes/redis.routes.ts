import { Router } from "express";
import { EstruturasRedisController } from "../controllers/estruturas-redis.controller.js";

const router = Router();

// 1. Hashes: Carrinho de Compras
router.post("/carrinho/:cliente_id", EstruturasRedisController.salvarCarrinho);
router.patch("/carrinho/:cliente_id/adicionar-item", EstruturasRedisController.adicionarItemCarrinho);
router.get("/carrinho/:cliente_id", EstruturasRedisController.obterCarrinho);

// 2. Lists: Fila de Expedição Postal (FIFO)
router.post("/expedicao/pedidos", EstruturasRedisController.enfileirarExpedicao);
router.get("/expedicao/pedidos", EstruturasRedisController.listarFilaExpedicao);
router.post("/expedicao/atender", EstruturasRedisController.atenderProximoPedido);

// 3. Sets: Consoles e Plataformas Únicas
router.post("/consoles", EstruturasRedisController.adicionarConsoles);
router.get("/consoles/verificar", EstruturasRedisController.verificarConsole);
router.get("/consoles", EstruturasRedisController.listarConsoles);

// 4. Sorted Sets: Ranking de Jogos Mais Vendidos (Leaderboard)
router.post("/ranking/venda", EstruturasRedisController.registrarVendaRanking);
router.get("/ranking/top", EstruturasRedisController.listarTopJogos);

export default router;
