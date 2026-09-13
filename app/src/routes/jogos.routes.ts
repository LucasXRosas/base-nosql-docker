import { Router } from "express";
import { JogosController } from "../controllers/jogos.controller.js";

const router = Router();

// Consultas específicas do Checkpoint 1 (definidas antes das rotas com parâmetros genéricos)
router.get("/destaques", JogosController.listarDestaques);
router.get("/promocoes", JogosController.listarPromocoes);
router.patch("/:sku/preco-estoque", JogosController.atualizarPrecoEstoque);

// Rotas gerais de CRUD e detalhes
router.get("/", JogosController.listar);
router.get("/:sku", JogosController.obterPorSku);
router.post("/", JogosController.criar);

export default router;
