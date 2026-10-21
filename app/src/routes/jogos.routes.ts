import { Router } from "express";
import { JogosController } from "../controllers/jogos.controller.js";

const router = Router();

// 1. Rotas estáticas específicas (devem vir antes de /:sku)
router.get("/promocoes-sem-cache", JogosController.listarPromocoesSemCache);
router.get("/promocoes", JogosController.listarPromocoes);
router.get("/destaques", JogosController.listarDestaques);
router.delete("/cache", JogosController.limparCache);

// 2. Rotas de sincronização e pendências do Módulo 08 (devem vir antes de /:sku)
router.get("/sincronizacao/pendentes", JogosController.listarPendencias);
router.post("/sincronizacao/reprocessar", JogosController.reprocessarPendencias);

// 3. Rotas parametrizadas por SKU ou Nome
router.get("/:sku/comparar", JogosController.compararTresBancos);
router.patch("/:sku/sem-sincronizar", JogosController.atualizarSemSincronizar);
router.patch("/:sku/preco-sem-cache", JogosController.atualizarSemSincronizar);
router.patch("/:sku/reindexando-tudo", JogosController.atualizarReindexandoTudo);
router.patch("/:sku/preco-estoque", JogosController.atualizarSincronizado);
router.patch("/:sku", JogosController.atualizarSincronizado);
router.post("/:sku/view", JogosController.registrarVisualizacao);
router.get("/:sku", JogosController.obterPorSku);

// 4. Rotas gerais da coleção de jogos
router.get("/", JogosController.listar);
router.post("/", JogosController.criar);

export default router;
