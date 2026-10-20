import { Router } from "express";
import { BuscaController } from "../controllers/busca.controller.js";

const router = Router();

router.get("/mongo", BuscaController.buscarMongo);
router.get("/analisar", BuscaController.analisarTexto);
router.get("/simples", BuscaController.buscarSimples);
router.get("/filtrada", BuscaController.buscarFiltrada);
router.post("/reindexar", BuscaController.reindexar);
router.get("/", BuscaController.buscar);

export default router;
