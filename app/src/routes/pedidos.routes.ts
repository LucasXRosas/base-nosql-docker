import { Router } from "express";
import { PedidosController } from "../controllers/pedidos.controller.js";

const router = Router();

// Consultas específicas do Checkpoint 1 (definidas antes das rotas com parâmetros genéricos)
router.get("/expedicao", PedidosController.filaExpedicao);
router.patch("/:id/status", PedidosController.atualizarStatus);

// Rotas gerais de CRUD e detalhes
router.get("/", PedidosController.listar);
router.get("/:id", PedidosController.obterPorId);
router.post("/", PedidosController.criar);

export default router;
