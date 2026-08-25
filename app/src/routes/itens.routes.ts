import { Router } from "express";
import { ItensController } from "../controllers/itens.controller.js";

const router = Router();

// GET /api/itens
router.get("/", ItensController.listar);

export default router;
