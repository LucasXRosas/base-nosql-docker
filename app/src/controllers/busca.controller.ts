import { Request, Response } from "express";
import { getElasticClient } from "../database/elastic.js";
import { getCollection } from "../database/mongo.js";
import { seedElasticsearch } from "../scripts/seed-elastic.js";

const INDEX_NAME = "jogos";
const CAMPOS_BUSCA = ["titulo^3", "descricao^2", "tags"];

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
          multi_match: {
            query: q,
            fields: CAMPOS_BUSCA,
            fuzziness: "AUTO",
            prefix_length: 1,
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

      const resposta = await elastic.search({
        index: INDEX_NAME,
        query: {
          bool: {
            must: mustClause,
            filter: filterClauses,
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
