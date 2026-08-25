import { Router } from "express";
import { PlaygroundController } from "../controllers/playground.controller.js";

const router = Router();

router.get("/clientes", PlaygroundController.listarClientes);
router.get("/contador", PlaygroundController.incrementarContador);

export default router;
