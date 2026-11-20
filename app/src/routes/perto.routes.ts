import { Router } from "express";
import { PertoController } from "../controllers/perto.controller.js";

const router = Router();

// Checkpoint 3 (Módulo 09) — "o que está perto de mim?"
router.get("/lojas", PertoController.lojas); // MongoDB $near + 2dsphere
router.get("/entregadores", PertoController.entregadores); // Redis GEOSEARCH
router.patch("/entregadores/:nome", PertoController.moverEntregador); // Redis GEOADD

export default router;
