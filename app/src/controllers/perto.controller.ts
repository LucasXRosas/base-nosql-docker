import { Request, Response } from "express";
import { getCollection } from "../database/mongo.js";
import { getRedisClient, redisPronto, comLimite } from "../database/redis.js";
import { COLECAO_LOJAS, CHAVE_ENTREGADORES } from "../scripts/seed-geo.js";

const RAIO_PADRAO_KM = 2;
const RAIO_MAXIMO_KM = 50;
const SERVICOS = ["retirada", "avaliacao_usados", "troca"];

type Posicao = { lat: number; lon: number; raioKm: number };

/**
 * Lê ?lat=&lon=&raio_km= da URL (a posição de quem pergunta e o raio).
 * Devolve uma mensagem de erro se a posição estiver ausente ou fora do intervalo válido.
 */
function lerPosicao(req: Request): Posicao | string {
  if (req.query.lat === undefined || req.query.lon === undefined) {
    return "Informe a sua posição em ?lat=<latitude>&lon=<longitude> (ex.: ?lat=-25.3935&lon=-51.4590).";
  }
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const raioKm = req.query.raio_km === undefined ? RAIO_PADRAO_KM : Number(req.query.raio_km);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return "Latitude inválida (deve estar entre -90 e 90).";
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) return "Longitude inválida (deve estar entre -180 e 180).";
  if (!Number.isFinite(raioKm) || raioKm <= 0 || raioKm > RAIO_MAXIMO_KM) {
    return `raio_km inválido (deve ser maior que 0 e no máximo ${RAIO_MAXIMO_KM}).`;
  }
  return { lat, lon, raioKm };
}

/**
 * Distância em km entre dois pontos (fórmula de haversine), só para EXIBIR na resposta.
 * Quem filtra pelo raio e ordena do mais perto para o mais longe é o próprio MongoDB ($near).
 */
function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Controller do Checkpoint 3 (Módulo 09) — "o que está perto de mim?" no RetroVault.
 *
 * 1. MongoDB — lojas e pontos de retirada/avaliação perto do cliente (endereço fixo,
 *    fonte da verdade): $near + índice 2dsphere, do mais perto para o mais longe.
 * 2. Redis — motoboys da entrega expressa perto de um ponto (posição muda a cada
 *    poucos segundos): GEOSEARCH.
 * 3. Redis — o motoboy andou: GEOADD.
 */
export class PertoController {
  /**
   * GET /api/perto/lojas?lat=-25.3935&lon=-51.4590&raio_km=1&servico=retirada
   */
  static async lojas(req: Request, res: Response): Promise<void> {
    const pos = lerPosicao(req);
    if (typeof pos === "string") {
      res.status(400).json({ erro: pos });
      return;
    }
    const servico = req.query.servico ? String(req.query.servico) : undefined;
    if (servico && !SERVICOS.includes(servico)) {
      res.status(400).json({ erro: `Serviço inválido. Use um destes: ${SERVICOS.join(", ")}.` });
      return;
    }

    try {
      const filtro: Record<string, any> = {
        ativa: true,
        localizacao: {
          $near: {
            // GeoJSON: longitude ANTES da latitude
            $geometry: { type: "Point", coordinates: [pos.lon, pos.lat] },
            $maxDistance: pos.raioKm * 1000, // metros
          },
        },
      };
      if (servico) filtro.servicos = servico;

      const lojas = await getCollection(COLECAO_LOJAS)
        .find(filtro)
        .project({ _id: 0, codigo: 1, nome: 1, tipo: 1, endereco: 1, servicos: 1, horario: 1, localizacao: 1 })
        .toArray();

      res.json({
        origem: "MONGODB ($near com índice 2dsphere)",
        sua_posicao: { lat: pos.lat, lon: pos.lon },
        raio_km: pos.raioKm,
        servico: servico || "todos",
        total: lojas.length,
        lojas: lojas.map((l) => {
          const [lon, lat] = l.localizacao.coordinates;
          return {
            codigo: l.codigo,
            nome: l.nome,
            distancia_km: Number(distanciaKm(pos.lat, pos.lon, lat, lon).toFixed(2)),
            servicos: l.servicos,
            endereco: l.endereco,
            horario: l.horario,
          };
        }),
      });
    } catch (err: any) {
      res.status(503).json({
        erro: "Busca de lojas próximas indisponível no momento: o banco principal (MongoDB) não respondeu.",
        detalhe: err.message,
      });
    }
  }

  /**
   * GET /api/perto/entregadores?lat=-25.3921&lon=-51.4602&raio_km=1
   * GET /api/perto/entregadores?loja=LJ-CENTRO&raio_km=1   (a partir da posição da loja de coleta)
   */
  static async entregadores(req: Request, res: Response): Promise<void> {
    let pos: Posicao | string;
    let lojaCodigo: string | undefined;

    if (req.query.loja) {
      lojaCodigo = String(req.query.loja);
      const raioKm = req.query.raio_km === undefined ? RAIO_PADRAO_KM : Number(req.query.raio_km);
      if (!Number.isFinite(raioKm) || raioKm <= 0 || raioKm > RAIO_MAXIMO_KM) {
        res.status(400).json({ erro: `raio_km inválido (deve ser maior que 0 e no máximo ${RAIO_MAXIMO_KM}).` });
        return;
      }
      try {
        const loja = await getCollection(COLECAO_LOJAS).findOne({ codigo: lojaCodigo });
        if (!loja) {
          res.status(404).json({ erro: `Loja '${lojaCodigo}' não encontrada.` });
          return;
        }
        const [lon, lat] = loja.localizacao.coordinates;
        pos = { lat, lon, raioKm };
      } catch (err: any) {
        res.status(503).json({ erro: "Não foi possível obter a posição da loja (MongoDB indisponível).", detalhe: err.message });
        return;
      }
    } else {
      pos = lerPosicao(req);
      if (typeof pos === "string") {
        res.status(400).json({ erro: pos });
        return;
      }
    }

    if (!redisPronto()) {
      res.status(503).json({
        erro: "Rastreamento dos entregadores indisponível no momento (Redis fora do ar). As posições voltam assim que o Redis voltar.",
      });
      return;
    }

    try {
      const resposta = (await comLimite(
        getRedisClient().call(
          "GEOSEARCH", CHAVE_ENTREGADORES, "FROMLONLAT", pos.lon, pos.lat,
          "BYRADIUS", pos.raioKm, "km", "ASC", "WITHDIST"
        ),
        1000
      )) as [string, string][];

      res.json({
        origem: "REDIS (GEOSEARCH)",
        ponto_de_partida: lojaCodigo ? { loja: lojaCodigo, lat: pos.lat, lon: pos.lon } : { lat: pos.lat, lon: pos.lon },
        raio_km: pos.raioKm,
        total: resposta.length,
        entregadores: resposta.map(([nome, km]) => ({ nome, distancia_km: Number(km) })),
      });
    } catch (err: any) {
      res.status(503).json({ erro: "Rastreamento dos entregadores indisponível no momento (Redis).", detalhe: err.message });
    }
  }

  /**
   * PATCH /api/perto/entregadores/:nome
   * Body: { "lat": -25.3930, "lon": -51.4610 }
   */
  static async moverEntregador(req: Request, res: Response): Promise<void> {
    const { nome } = req.params;
    const lat = Number(req.body?.lat);
    const lon = Number(req.body?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      res.status(400).json({ erro: "Informe 'lat' e 'lon' válidos no corpo da requisição." });
      return;
    }
    if (!redisPronto()) {
      res.status(503).json({ erro: "Não foi possível atualizar a posição agora (Redis fora do ar)." });
      return;
    }
    try {
      // GEOADD recebe longitude ANTES da latitude; se o membro já existe, só atualiza a posição
      await comLimite(getRedisClient().geoadd(CHAVE_ENTREGADORES, lon, lat, nome), 1000);
      res.json({ origem: "REDIS (GEOADD)", chave: CHAVE_ENTREGADORES, entregador: nome, nova_posicao: { lat, lon } });
    } catch (err: any) {
      res.status(503).json({ erro: "Não foi possível atualizar a posição agora (Redis).", detalhe: err.message });
    }
  }
}
