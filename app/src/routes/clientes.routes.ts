import { Router } from "express";
import { ClientesController } from "../controllers/clientes.controller.js";

const router = Router();

router.get("/", ClientesController.listar);
router.get("/:id", ClientesController.obterPorId);
router.post("/:id/desejos", ClientesController.adicionarDesejo);

export default router;
