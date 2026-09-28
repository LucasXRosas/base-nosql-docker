import { Router } from "express";
import { JogosController } from "../controllers/jogos.controller.js";

const router = Router();

// Rotas específicas / sem parâmetros dinâmicos (devem vir antes de /:sku)
router.get("/promocoes-sem-cache", JogosController.listarPromocoesSemCache);
router.get("/promocoes", JogosController.listarPromocoes);
router.get("/destaques", JogosController.listarDestaques);
router.delete("/cache", JogosController.limparCache);

// Rotas parametrizadas por SKU
router.patch("/:sku/preco-sem-cache", JogosController.atualizarPrecoSemInvalidar);
router.patch("/:sku/preco-estoque", JogosController.atualizarPrecoEstoque);
router.post("/:sku/view", JogosController.registrarVisualizacao);
router.get("/:sku", JogosController.obterPorSku);

// Rotas gerais da coleção de jogos
router.get("/", JogosController.listar);
router.post("/", JogosController.criar);

export default router;
