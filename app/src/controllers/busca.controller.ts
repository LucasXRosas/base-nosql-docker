import { Request, Response } from "express";
import { getElasticClient, OPCOES_ELASTIC_RAPIDAS, LIMITE_ELASTIC_MS } from "../database/elastic.js";
import { comLimite } from "../database/limite.js";
import { getCollection } from "../database/mongo.js";
import { seedElasticsearch } from "../scripts/seed-elastic.js";

const INDEX_NAME = "jogos";
const CAMPOS_BUSCA = ["titulo^3", "descricao^2", "tags"];

// Checkpoint 3 (Módulo 10): a busca não pode travar esperando um ElasticSearch fora do ar.
// Sem novas tentativas e com teto de 1,5 s (inclusive DNS), a rota cai para o MongoDB.
function buscarNoElastic(params: any) {
  return comLimite(getElasticClient().search(params, OPCOES_ELASTIC_RAPIDAS), LIMITE_ELASTIC_MS);
}
const AVISO_BUSCA_SIMPLES =
  "ElasticSearch fora do ar: busca simplificada no MongoDB ($regex no título, descrição e tags), " +
  "sem relevância, sem pesos e sem tolerância a erro de digitação.";

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Busca simples no MongoDB (fonte da verdade), usada quando o ElasticSearch cai.
 * Cada palavra digitada precisa aparecer no título, na descrição ou nas tags.
 */
async function buscaSimplesNoMongo(
  q: string,
  filtros: { plataforma?: string; categoria?: string; condicao?: string; preco_max?: number } = {}
) {
  const filtro: Record<string, any> = { ativo: true };
  const palavras = q.split(/\s+/).filter(Boolean);
  if (palavras.length > 0) {
    filtro.$and = palavras.map((p) => {
      const re = { $regex: escaparRegex(p), $options: "i" };
      return { $or: [{ titulo: re }, { descricao: re }, { tags: re }] };
    });
  }
  if (filtros.plataforma) filtro.plataforma = filtros.plataforma;
  if (filtros.condicao) filtro["especificacoes_midia.condicao"] = filtros.condicao;
  if (filtros.preco_max !== undefined) filtro.preco = { $lte: filtros.preco_max };
  if (filtros.categoria) {
    const cat = await getCollection("categorias").findOne({ nome: filtros.categoria });
    filtro.categoria_id = cat ? cat._id : null; // categoria inexistente: nenhum resultado
  }

  const jogos = await getCollection("jogos")
    .find(filtro)
    .project({ sku: 1, titulo: 1, plataforma: 1, preco: 1, "especificacoes_midia.condicao": 1 })
    .sort({ titulo: 1 })
    .limit(10)
    .toArray();

  return jogos.map((j) => ({
    sku: j.sku,
    titulo: j.titulo,
    plataforma: j.plataforma,
    preco: j.preco,
    condicao: j.especificacoes_midia?.condicao,
  }));
}

export class BuscaController {
  /**
   * 1. BUSCA POR SUBSTRING NO MONGODB ($regex) — Ponto de partida didático
   * GET /api/busca/mongo?q=...
   */
  static async buscarMongo(req: Request, res: Response): Promise<void> {
    try {
      const q = String(req.query.q || "").trim();
      if (!q) {
        res.status(400).json({ erro: "Parâmetro 'q' é obrigatório na query string." });
        return;
      }

      const col = getCollection("jogos");
      const jogos = await col
        .find({
          ativo: true,
          titulo: { $regex: q, $options: "i" },
        })
        .project({
          sku: 1,
          titulo: 1,
          plataforma: 1,
          preco: 1,
          "especificacoes_midia.condicao": 1,
        })
        .toArray();

      res.json({
        origem: "MONGODB ($regex no campo titulo)",
        termo: q,
        total: jogos.length,
        resultados: jogos.map((j) => ({
          sku: j.sku,
          titulo: j.titulo,
          plataforma: j.plataforma,
          preco: j.preco,
          condicao: j.especificacoes_midia?.condicao,
        })),
        observacao: "O MongoDB com $regex busca substring exata: não tolera erros de digitação, não aplica pesos entre campos e não calcula relevância estatística.",
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro na busca via MongoDB", detalhe: err.message });
    }
  }

  /**
   * 2. ANÁLISE DE TEXTO E TOKENS INVERTIDOS (texto_ptbr)
   * GET /api/busca/analisar?texto=...
   */
  static async analisarTexto(req: Request, res: Response): Promise<void> {
    try {
      const texto = String(req.query.texto || "").trim();
      if (!texto) {
        res.status(400).json({ erro: "Parâmetro 'texto' é obrigatório." });
        return;
      }

      const elastic = getElasticClient();
      const resposta = await elastic.indices.analyze({
        index: INDEX_NAME,
        text: texto,
        analyzer: "texto_ptbr",
      });

      const tokens = (resposta.tokens || []).map((t: any) => t.token);

      res.json({
        texto_original: texto,
        analisador: "texto_ptbr (lowercase + asciifolding + stopwords portuguesas + stemmer)",
        total_tokens: tokens.length,
        termos_no_indice: tokens,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro na análise de texto", detalhe: err.message });
    }
  }

  /**
   * 3. BUSCA SIMPLES POR RELEVÂNCIA (match em um único campo)
   * GET /api/busca/simples?q=...
   */
  static async buscarSimples(req: Request, res: Response): Promise<void> {
    try {
      const q = String(req.query.q || "").trim();
      if (!q) {
        res.status(400).json({ erro: "Parâmetro 'q' é obrigatório." });
        return;
      }

      const elastic = getElasticClient();
      const resposta = await elastic.search({
        index: INDEX_NAME,
        query: {
          match: {
            titulo: q,
          },
        },
      });

      const hits = (resposta.hits.hits || []).map((hit: any) => ({
        sku: hit._source.sku,
        titulo: hit._source.titulo,
        plataforma: hit._source.plataforma,
        categoria: hit._source.categoria,
        preco: hit._source.preco,
        condicao: hit._source.condicao,
        relevancia: hit._score,
      }));

      res.json({
        origem: "ELASTICSEARCH (match simples no campo titulo)",
        termo: q,
        total: hits.length,
        resultados: hits,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro na busca simples", detalhe: err.message });
    }
  }

  /**
   * 4. BUSCA COMPLETA COM PESOS E TOLERÂNCIA A ERROS (multi_match + fuzziness)
   * GET /api/busca?q=...
   */
  static async buscar(req: Request, res: Response): Promise<void> {
    const q = String(req.query.q || "").trim();
    if (!q) {
      res.status(400).json({ erro: "Parâmetro 'q' é obrigatório." });
      return;
    }

    let resposta;
    try {
      resposta = await buscarNoElastic({
        index: INDEX_NAME,
        query: {
          multi_match: {
            query: q,
            fields: CAMPOS_BUSCA,
            fuzziness: "AUTO",
            prefix_length: 1,
          },
        },
      });
    } catch (errElastic: any) {
      // ElasticSearch fora do ar: segue para a busca simples no MongoDB.
      try {
        const resultados = await buscaSimplesNoMongo(q);
        res.setHeader("X-Search-Fallback", "mongodb");
        res.json({
          origem: "MONGODB ($regex, ELASTICSEARCH FORA DO AR)",
          aviso: AVISO_BUSCA_SIMPLES,
          motivo: errElastic.message,
          termo: q,
          total: resultados.length,
          resultados,
        });
      } catch (errMongo: any) {
        res.status(503).json({
          erro: "Busca indisponível no momento: o ElasticSearch e o MongoDB não responderam. Tente novamente em instantes.",
          detalhe: errMongo.message,
        });
      }
      return;
    }

    try {

      const hits = (resposta.hits.hits || []).map((hit: any) => ({
        sku: hit._source.sku,
        titulo: hit._source.titulo,
        plataforma: hit._source.plataforma,
        categoria: hit._source.categoria,
        preco: hit._source.preco,
        condicao: hit._source.condicao,
        tags: hit._source.tags,
        relevancia: Number(hit._score.toFixed(2)),
      }));

      res.json({
        origem: "ELASTICSEARCH (multi_match + fuzziness)",
        termo: q,
        campos_pesquisados: CAMPOS_BUSCA,
        total: hits.length,
        resultados: hits,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro na busca completa", detalhe: err.message });
    }
  }

  /**
   * 5. BUSCA FILTRADA COM BOOL + FILTER (Filtros executados direto no motor do ElasticSearch)
   * GET /api/busca/filtrada?q=...&plataforma=...&categoria=...&condicao=...&preco_max=...
   */
  static async buscarFiltrada(req: Request, res: Response): Promise<void> {
    try {
      const { q, plataforma, categoria, condicao, preco_max } = req.query;
      const elastic = getElasticClient();

      // Monta as cláusulas must (relevância textual) e filter (condições exatas)
      const mustClause: any = q
        ? {
            multi_match: {
              query: String(q),
              fields: CAMPOS_BUSCA,
              fuzziness: "AUTO",
            },
          }
        : { match_all: {} };

      const filterClauses: any[] = [{ term: { ativo: true } }];

      if (plataforma) {
        filterClauses.push({ term: { plataforma: String(plataforma) } });
      }

      if (categoria) {
        filterClauses.push({ term: { categoria: String(categoria) } });
      }

      if (condicao) {
        filterClauses.push({ term: { condicao: String(condicao) } });
      }

      if (preco_max) {
        filterClauses.push({
          range: {
            preco: {
              lte: parseFloat(String(preco_max)),
            },
          },
        });
      }

      let resposta;
      try {
        resposta = await buscarNoElastic({
          index: INDEX_NAME,
          query: {
            bool: {
              must: mustClause,
              filter: filterClauses,
            },
          },
        });
      } catch (errElastic: any) {
        // ElasticSearch fora do ar: aplica os mesmos filtros exatos numa busca simples no MongoDB.
        try {
          const resultados = await buscaSimplesNoMongo(String(q || "").trim(), {
            plataforma: plataforma ? String(plataforma) : undefined,
            categoria: categoria ? String(categoria) : undefined,
            condicao: condicao ? String(condicao) : undefined,
            preco_max: preco_max ? parseFloat(String(preco_max)) : undefined,
          });
          res.setHeader("X-Search-Fallback", "mongodb");
          res.json({
            origem: "MONGODB ($regex + filtros, ELASTICSEARCH FORA DO AR)",
            aviso: AVISO_BUSCA_SIMPLES,
            motivo: errElastic.message,
            termo: q || null,
            filtros_aplicados: {
              plataforma: plataforma || null,
              categoria: categoria || null,
              condicao: condicao || null,
              preco_max: preco_max ? Number(preco_max) : null,
            },
            total: resultados.length,
            resultados,
          });
        } catch (errMongo: any) {
          res.status(503).json({
            erro: "Busca indisponível no momento: o ElasticSearch e o MongoDB não responderam. Tente novamente em instantes.",
            detalhe: errMongo.message,
          });
        }
        return;
      }

      const hits = (resposta.hits.hits || []).map((hit: any) => ({
        sku: hit._source.sku,
        titulo: hit._source.titulo,
        plataforma: hit._source.plataforma,
        categoria: hit._source.categoria,
        preco: hit._source.preco,
        condicao: hit._source.condicao,
        relevancia: hit._score ? Number(hit._score.toFixed(2)) : 1.0,
      }));

      res.json({
        origem: "ELASTICSEARCH (bool: must + filter)",
        termo: q || null,
        filtros_aplicados: {
          plataforma: plataforma || null,
          categoria: categoria || null,
          condicao: condicao || null,
          preco_max: preco_max ? Number(preco_max) : null,
        },
        recebidos_do_elastic: hits.length,
        total: hits.length,
        resultados: hits,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro na busca filtrada", detalhe: err.message });
    }
  }

  /**
   * 6. REINDEXAÇÃO COMPLETA A PARTIR DO MONGODB (Sincronização administrativa)
   * POST /api/busca/reindexar
   */
  static async reindexar(req: Request, res: Response): Promise<void> {
    try {
      const totalSincronizados = await seedElasticsearch(true);
      res.json({
        mensagem: "Índice 'jogos' recriado e reindexado com sucesso a partir do MongoDB!",
        total_jogos_indexados: totalSincronizados,
        indice: INDEX_NAME,
      });
    } catch (err: any) {
      res.status(500).json({ erro: "Erro ao reindexar Elasticsearch", detalhe: err.message });
    }
  }
}
