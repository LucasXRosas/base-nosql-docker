import { Router } from "express";
import { CategoriasController } from "../controllers/categorias.controller.js";

const router = Router();

router.get("/", CategoriasController.listar);
router.get("/:slug", CategoriasController.obterPorSlug);

export default router;
