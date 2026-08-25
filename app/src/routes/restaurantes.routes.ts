import { Router } from "express";
import { RestaurantesController } from "../controllers/restaurantes.controller.js";

const router = Router();

// Rota de busca no Elasticsearch (colocada antes de /:id para não colidir com o parâmetro de rota)
router.get("/busca", RestaurantesController.buscarPratos);

// Rotas CRUD e Cache
router.get("/", RestaurantesController.listar);
router.get("/:id", RestaurantesController.obterPorId);
router.post("/", RestaurantesController.criar);

export default router;
