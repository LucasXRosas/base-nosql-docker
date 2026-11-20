# Checkpoint 3: Localização, Resiliência e Desempenho (RetroVault)

**Universidade Tecnológica Federal do Paraná — UTFPR, Câmpus Guarapuava**  
**Curso:** Tecnologia em Sistemas para Internet (TSI34E-TSI4)  
**Disciplina:** Banco de Dados NoSQL · **Professor:** Prof. Marcelo Marcos Vichar Junior  
**Projeto:** RetroVault — E-commerce & Preservação Histórica de Mídias Físicas de Jogos  

O Checkpoint 2 montou a arquitetura com três bancos (MongoDB como fonte da verdade, Redis como cache e estruturas em memória, ElasticSearch como busca). Este checkpoint mostra como essa arquitetura se comporta em três situações reais do RetroVault:

| Situação | Pergunta do RetroVault | Onde está no código |
| :--- | :--- | :--- |
| **"Perto de mim"** (Módulo 09) | Onde retiro meu pedido ou levo meus jogos usados para avaliação? Qual motoboy está perto da loja? | [perto.controller.ts](app/src/controllers/perto.controller.ts), [seed-geo.ts](app/src/scripts/seed-geo.ts), [geo-init.json](init/geo-init.json) |
| **Um banco cai** (Módulo 10) | A vitrine e a busca continuam funcionando sem Redis ou sem ElasticSearch? O pedido pago fica garantido? | [redis.ts](app/src/database/redis.ts), [limite.ts](app/src/database/limite.ts), [jogos.controller.ts](app/src/controllers/jogos.controller.ts), [busca.controller.ts](app/src/controllers/busca.controller.ts), [pedidos.controller.ts](app/src/controllers/pedidos.controller.ts) |
| **O volume cresce** (Módulo 11) | A tela "Meus pedidos" continua rápida depois de 200 mil pedidos? | [seed-carga.ts](app/src/scripts/seed-carga.ts), [explain-historico.ts](app/src/scripts/explain-historico.ts), [benchmark.ts](app/src/scripts/benchmark.ts) |

Tudo sobe com `./iniciar.sh`, sem intervenção manual: coordenadas carregadas, índice `2dsphere` criado, motoboys no Redis, 200 mil pedidos gravados e índice de desempenho criado.

---

## Seção 1 — Localização

### 1.1 O que tem localização no RetroVault

O RetroVault vende mídias físicas pela internet e envia pelos Correios, então **o jogo em si não tem lugar**: um cartucho de *Chrono Trigger* custa o mesmo e chega do mesmo jeito em qualquer cidade. Por isso o índice `jogos` do ElasticSearch **não** recebeu um campo `geo_point`: nenhuma busca do catálogo depende de distância.

A localização aparece em duas operações da loja em Guarapuava:

1. **Retirada e avaliação presencial (click & collect):** o cliente pode retirar o pedido em uma loja ou ponto de retirada, e levar jogos usados para avaliação e troca (*trade-in*) nos parceiros. A pergunta é: *"quais pontos ficam perto de mim, do mais perto para o mais longe?"*
2. **Entrega expressa no mesmo dia:** pedidos da cidade podem sair por motoboy. A pergunta é: *"qual motoboy está mais perto da loja onde o pedido será coletado?"*

| O que tem posição | Fica parado ou se move? | Banco | Estrutura | Por quê |
| :--- | :---: | :---: | :--- | :--- |
| **Lojas e pontos** (loja-sede, parceiros, pontos de retirada) | Parado | **MongoDB** (coleção `lojas`) | Campo `localizacao` em GeoJSON + índice `2dsphere` | É endereço oficial, cadastrado uma vez e mudado raramente: dado da **fonte da verdade**, junto com nome, serviços e horário. |
| **Motoboys da entrega expressa** | Se move (nova posição a cada poucos segundos) | **Redis** (chave `retrovault:geo:entregadores`) | `GEOADD` / `GEOSEARCH` (Sorted Set geográfico) | Escrita muito frequente e valor que envelhece em segundos. Gravar isso no MongoDB a cada movimento seria desperdício; perder a posição não é grave, porque o próximo envio do celular do motoboy a refaz. |
| **Cliente (quem pergunta)** | — | **Nenhum** | Recebido em `?lat=&lon=` na URL | Localização é dado pessoal (LGPD): a posição do cliente é usada só para responder à pergunta e **não é armazenada**. |

As coordenadas (fictícias, em Guarapuava) ficam em [init/geo-init.json](init/geo-init.json), sempre na ordem **`[longitude, latitude]`**, a mesma do GeoJSON e do `GEOADD`:

```json
{
  "codigo": "LJ-CENTRO",
  "nome": "RetroVault Centro (loja-sede)",
  "servicos": ["retirada", "avaliacao_usados", "troca"],
  "coordenadas": [-51.4602, -25.3921]
}
```

### 1.2 Carga das coordenadas e índices (feita pelo `iniciar.sh`)

O `iniciar.sh` executa `npm run seed:geo` ([seed-geo.ts](app/src/scripts/seed-geo.ts)), que é idempotente:

```ts
// MongoDB: upsert de cada loja com GeoJSON — longitude ANTES da latitude
await col.updateOne(
  { codigo: loja.codigo },
  { $set: { ...dados, ativa: true, localizacao: { type: "Point", coordinates: [lon, lat] } } },
  { upsert: true }
);
await col.createIndex({ localizacao: "2dsphere" });
await col.createIndex({ codigo: 1 }, { unique: true });

// Redis: posição inicial dos motoboys
await redis.geoadd("retrovault:geo:entregadores", lon, lat, nome);
```

### 1.3 Rotas de localização

| Rota | Banco | O que responde |
| :--- | :---: | :--- |
| `GET /api/perto/lojas?lat=&lon=&raio_km=&servico=` | MongoDB | Lojas dentro do raio, **do mais perto para o mais longe**, com a distância em km. `servico` (opcional): `retirada`, `avaliacao_usados` ou `troca`. |
| `GET /api/perto/entregadores?lat=&lon=&raio_km=` ou `?loja=LJ-CENTRO&raio_km=` | Redis | Motoboys dentro do raio, do mais perto para o mais longe (`GEOSEARCH ... ASC WITHDIST`). Com `loja=`, o ponto de partida é a posição da loja, lida do MongoDB. |
| `PATCH /api/perto/entregadores/:nome` | Redis | Atualiza a posição de um motoboy (`GEOADD`). |

**Busca por raio no MongoDB** ([perto.controller.ts](app/src/controllers/perto.controller.ts)): o `$near` usa o índice `2dsphere`, filtra pelo raio e **já devolve ordenado pela distância**:

```ts
const lojas = await getCollection("lojas").find({
  ativa: true,
  localizacao: {
    $near: {
      $geometry: { type: "Point", coordinates: [pos.lon, pos.lat] }, // longitude primeiro
      $maxDistance: pos.raioKm * 1000,                               // metros
    },
  },
  ...(servico ? { servicos: servico } : {}),
}).toArray();
```

A distância exibida (`distancia_km`) é calculada na API pela fórmula de haversine apenas para mostrar ao cliente; quem filtra e ordena é o MongoDB.

**Busca por raio no Redis:**

```ts
await redis.call("GEOSEARCH", "retrovault:geo:entregadores",
  "FROMLONLAT", lon, lat, "BYRADIUS", raioKm, "km", "ASC", "WITHDIST");
```

A rota valida a entrada: sem `lat`/`lon`, ou com latitude fora de [-90, 90], longitude fora de [-180, 180] ou raio fora de (0, 50] km, responde `400` com a mensagem do problema.

---

## Seção 2 — O sistema com um banco fora do ar

A regra do RetroVault é a do Checkpoint 2: **o MongoDB é a fonte da verdade; o Redis e o ElasticSearch são cópias**. Se uma cópia cai, a loja continua vendendo com menos desempenho ou menos recursos de busca. Se a fonte da verdade cai, a resposta honesta é `503`.

| Banco fora do ar | O que o cliente vê | Rotas |
| :--- | :--- | :--- |
| **Redis** | A mesma vitrine, lida direto do MongoDB, em poucos milissegundos. Campo `origem: "MONGODB (REDIS FORA DO AR, SEM CACHE)"` e cabeçalho `X-Cache: BYPASS`. | `GET /api/jogos/promocoes`, `/api/jogos/destaques`, `/api/jogos/:sku` |
| **ElasticSearch** | Resultados de uma busca simples no MongoDB, com `aviso` explicando que não há relevância nem tolerância a erro de digitação. Resposta em ~1,5 s. | `GET /api/busca?q=`, `GET /api/busca/filtrada?...` |
| **MongoDB** | `HTTP 503` com mensagem clara ("indisponível no momento... tente novamente em instantes"). | Todas as rotas que dependem da fonte da verdade |

### 2.1 Redis fora do ar: a leitura com cache continua respondendo

O problema: o `ioredis` guarda os comandos numa fila enquanto tenta reconectar. Uma rota que chama `redis.get()` com o Redis parado fica esperando as novas tentativas e termina em `500` (`Reached the max retries per request limit`). O cache precisa ser **opcional**.

A solução fica em [redis.ts](app/src/database/redis.ts), usada pelas três rotas com cache do Checkpoint 2:

```ts
export function redisPronto(): boolean {
  return getRedisClient().status === "ready"; // Redis caiu? Nem tenta.
}

export async function cacheLerSeguro<T>(key: string) {
  if (!redisPronto()) return { valor: null, redisNoAr: false };
  try {
    const valor = await comLimite(cacheGet<T>(key), 300); // no máximo 300 ms
    return { valor, redisNoAr: true };
  } catch {
    return { valor: null, redisNoAr: false };
  }
}
```

E na rota ([jogos.controller.ts](app/src/controllers/jogos.controller.ts), `listarPromocoes`):

```ts
const { valor: cached, redisNoAr } = await cacheLerSeguro<any[]>(CACHE_KEY_PROMOCOES);
if (cached) { /* REDIS (CACHE HIT) */ return; }

const promocoes = await col.find({ preco: { $lte: 150.0 }, ativo: true, quantidade_estoque: { $gt: 0 } })
  .sort({ preco: 1 }).toArray();                  // MongoDB: fonte da verdade

if (redisNoAr) await cacheGravarSeguro(CACHE_KEY_PROMOCOES, promocoes, 60); // gravar no cache é um extra

// origem: "MONGODB (CACHE MISS)" ou "MONGODB (REDIS FORA DO AR, SEM CACHE)"
```

Se o próprio MongoDB falhar, o `catch` responde `503` (função `responderMongoIndisponivel`).

**As escritas também não caem com o Redis:** `PATCH /api/jogos/:sku` grava no MongoDB e tenta invalidar o cache com `cacheInvalidarSeguro`. Com o Redis fora, a resposta informa `redis: "não invalidado (Redis fora do ar; cópias expiram pelo TTL)"`. Como o Redis persiste as chaves com o prazo de expiração, uma cópia antiga dura no máximo o TTL da chave (5 min para jogo por SKU, 60 s para promoções) depois que o Redis volta.

### 2.2 ElasticSearch fora do ar: busca simples no MongoDB, com aviso

Em [busca.controller.ts](app/src/controllers/busca.controller.ts), a chamada ao ElasticSearch tem **teto de 1,5 s e nenhuma nova tentativa**:

```ts
function buscarNoElastic(params: any) {
  return comLimite(getElasticClient().search(params, { requestTimeout: 1500, maxRetries: 0 }), 1500);
}
```

O `requestTimeout` do cliente sozinho não basta: com o container parado, só a resolução de DNS do nome `elasticsearch` leva cerca de 4 s até falhar com `ENOTFOUND`, e com as 3 novas tentativas padrão a rota chegava a 20 s. O `comLimite` ([limite.ts](app/src/database/limite.ts)) usa `Promise.race` e garante o teto para a operação inteira.

Se o ElasticSearch não responde, a rota cai para `buscaSimplesNoMongo()`: cada palavra digitada vira um `$regex` (sem diferenciar maiúsculas) no título, na descrição ou nas tags. Na busca filtrada, os mesmos filtros exatos (plataforma, categoria, condição, preço máximo) são aplicados no MongoDB:

```json
{
  "origem": "MONGODB ($regex, ELASTICSEARCH FORA DO AR)",
  "aviso": "ElasticSearch fora do ar: busca simplificada no MongoDB ($regex no título, descrição e tags), sem relevância, sem pesos e sem tolerância a erro de digitação.",
  "motivo": "sem resposta em 1500 ms",
  ...
}
```

Se o MongoDB também não responder, a busca devolve `503`: *"Busca indisponível no momento: o ElasticSearch e o MongoDB não responderam."*

O mesmo teto de 1,5 s vale para a **escrita sincronizada do Checkpoint 2**: com o ElasticSearch fora, o `PATCH /api/jogos/:sku` agora registra a pendência em `retrovault:sync:pendentes` e responde `202` em ~1,5 s (antes, ~20 s).

### 2.3 MongoDB fora do ar: `503` com mensagem clara

O MongoDB é a fonte da verdade: sem ele não existe resposta correta para dar. As rotas de leitura, de localização e de pedido capturam o erro e respondem `503` depois do `serverSelectionTimeoutMS` do driver (5 s), sem travar indefinidamente:

```json
{
  "erro": "A lista de promoções está indisponível no momento: o banco principal (MongoDB) não respondeu. Tente novamente em instantes.",
  "detalhe": "getaddrinfo ENOTFOUND mongo"
}
```

Quando o banco volta (`docker start`), as três conexões se refazem sozinhas, sem reiniciar a API.

---

## Seção 3 — Escrita crítica

### 3.1 O que não pode ser perdido e o que pode atrasar

| Não pode ser perdido | Pode atrasar ou ser refeito |
| :--- | :--- |
| **Pedido pago** (`pedidos`, MongoDB): é dinheiro do cliente e compromisso de envio. Se sumir, o cliente pagou e não recebe. | **Cache das vitrines e do jogo por SKU** (Redis): some com o TTL e é refeito na próxima leitura a partir do MongoDB. |
| **Cadastro do cliente** (`clientes`): nome, e-mail e endereços de entrega. | **Índice de busca `jogos`** (ElasticSearch): refeito do MongoDB com `npm run seed:elastic` ou pelas pendências em `POST /api/jogos/sincronizacao/reprocessar`. |
| **Catálogo: preço e estoque** (`jogos`): estoque errado vende a mesma mídia rara duas vezes. | **Pendências de sincronização** (`retrovault:sync:pendentes`): se perdidas, uma reindexação total resolve. |
| **Histórico de pedidos** (`pedidos_historico`): base de garantia, devolução e suporte pós-venda. | **Fila de expedição postal** (Redis List): refeita a partir dos pedidos com status `pago`/`em_separacao` (`GET /api/pedidos/expedicao`). |
| | **Ranking de mais vendidos** (Redis Sorted Set) e **contador de visualizações**: estatísticas recalculáveis a partir dos pedidos. |
| | **Posição dos motoboys** (Redis GEO): o celular do motoboy envia uma nova posição em segundos. |
| | **Carrinho** (Redis Hash): incômodo perder, mas o cliente refaz; nada foi pago. |

### 3.2 O pedido com `writeConcern: { w: "majority" }`

`POST /api/pedidos` ([pedidos.controller.ts](app/src/controllers/pedidos.controller.ts)) grava o pedido com `w: "majority"` explícito: a API só confirma ao cliente depois que a maioria dos nós do MongoDB gravou o pedido (e o registrou no *journal*):

```ts
const WRITE_CONCERN_PEDIDO = { w: "majority" as const, wtimeout: 5000 };

// O _id é gerado ANTES de gravar: mesmo sem a confirmação da maioria,
// a API sabe o número do pedido e pode devolvê-lo ao cliente.
const novoPedido = { _id: new ObjectId(), cliente_id, itens, valor_total, status: "pago", ... };

try {
  const result = await col.insertOne(novoPedido, { writeConcern: WRITE_CONCERN_PEDIDO });
  res.status(201).json({ gravado: true, confirmacao: "maioria dos nós (writeConcern w: \"majority\")", ... });
} catch (err: any) {
  if (err instanceof MongoWriteConcernError) {
    // NÃO é "não gravou": o primário gravou, só não deu para esperar as cópias.
    res.status(202).json({
      id: novoPedido._id,
      gravado: true,
      confirmacao: "sem confirmação da maioria dentro de 5 s",
      aviso: "Não reenvie o pedido: ele já foi gravado e seria duplicado. Consulte GET /api/pedidos/<id>",
    });
    return;
  }
  // Qualquer outra falha: o pedido NÃO foi gravado e o cliente pode tentar de novo.
  res.status(503).json({ gravado: false, erro: "... O pedido NÃO foi gravado; tente novamente." });
}
```

| Resultado | HTTP | Significado para o cliente |
| :--- | :---: | :--- |
| Maioria confirmou | `201` | Pedido gravado e garantido. |
| `MongoWriteConcernError` (passou o `wtimeout`) | `202` | Pedido **gravado** no primário, cópias ainda não confirmaram. A API devolve o `id` e pede para **não reenviar**, porque reenviar duplicaria o pedido. |
| Outro erro (MongoDB fora do ar, falha de rede antes da gravação) | `503` | Pedido **não** gravado; pode tentar de novo. |

> **No ambiente da disciplina** o MongoDB roda como nó único, então "maioria" é 1 de 1: o `w: "majority"` faz a API esperar a gravação no *journal* desse nó. Em produção, com *replica set* de 3 nós, a mesma linha de código passa a esperar 2 de 3, e o pedido sobrevive à queda do primário. A configuração fica no código, não depende do ambiente. O roteiro (Passo 5) mostra pelo *profiler* do MongoDB que o `insert` chega ao banco com `writeConcern: { w: "majority", wtimeout: 5000 }`.

---

## Seção 4 — Desempenho

### 4.1 Carga de teste

O script [app/src/scripts/seed-carga.ts](app/src/scripts/seed-carga.ts) grava **200.000 pedidos antigos** (cinco anos de vendas, de nov/2021 a nov/2026) na coleção `pedidos_historico`:

- **1.000 clientes:** os 5 clientes reais da coleção `clientes` (Lucas Rosa, Ana Silva, ...) e 995 clientes sintéticos. Cada um fica com cerca de 200 pedidos; o cliente usado nas medições, **Lucas Rosa** (`65f8c0009f1b2c001c8e5001`), tem **227**.
- **Itens reais:** cada pedido tem de 1 a 3 jogos sorteados do catálogo da coleção `jogos` (título, plataforma e preço), frete, status (`entregue`, `cancelado`, `devolvido`, `enviado`) e `data_pedido`.
- **Sorteio com semente fixa** (mulberry32): a carga é a mesma em qualquer máquina, então os números deste documento se repetem.

```bash
docker exec nosql_app npm run seed:carga                  # grava (se ainda não gravou) e cria o índice
docker exec nosql_app npm run seed:carga -- --sem-indice  # deixa só o _id (medição "antes")
docker exec nosql_app npm run seed:carga -- --recriar     # apaga e grava de novo
```

O `iniciar.sh` executa `npm run seed:carga`: na primeira vez grava os 200 mil pedidos (poucos segundos); nas seguintes só garante o índice.

Exemplo de documento:

```json
{
  "numero": 1,
  "cliente_id": "ObjectId('6a00000000000000000000dd')",
  "itens": [
    { "titulo": "The Legend of Zelda: Tears of the Kingdom", "plataforma": "Nintendo Switch", "quantidade": 1, "preco_unitario": 299 },
    { "titulo": "Dark Souls Remastered", "plataforma": "PlayStation 4", "quantidade": 1, "preco_unitario": 120 }
  ],
  "valor_total": 443.37,
  "status": "entregue",
  "data_pedido": "2025-03-31T05:15:50.858Z",
  "entrega": { "valor_frete": 24.37 }
}
```

### 4.2 Consulta escolhida: "Meus pedidos"

```js
db.pedidos_historico.find({ cliente_id: ObjectId("65f8c0009f1b2c001c8e5001") })
                    .sort({ data_pedido: -1 })
                    .limit(10)
```

Rota: `GET /api/pedidos/historico/:cliente_id` ([pedidos.controller.ts](app/src/controllers/pedidos.controller.ts), `historicoCliente`).

**Por que esta consulta:**

1. **É a coleção que cresce sem limite.** O catálogo de uma loja de jogos retrô é finito (milhares de títulos, no máximo), mas os pedidos se acumulam todos os dias, para sempre. É ali que um `COLLSCAN` vai ficar mais caro a cada mês.
2. **É frequente:** todo cliente logado abre "Meus pedidos" para acompanhar entrega, rastreio e devolução, e o suporte pós-venda consulta a mesma tela.
3. **É cara sem índice:** para devolver 10 pedidos, o banco lê os 200 mil e ainda ordena na memória.

### 4.3 `explain("executionStats")`: antes e depois

Comando (resumo do plano vencedor, via driver):

```bash
docker exec nosql_app npm run explain:historico
```

Equivalente no `mongosh` (plano completo):

```bash
docker exec -it nosql_mongo mongosh -u root -p root --authenticationDatabase admin retrovault
```
```js
db.pedidos_historico.find({ cliente_id: ObjectId("65f8c0009f1b2c001c8e5001") })
  .sort({ data_pedido: -1 }).limit(10).explain("executionStats")
```

| | Sem índice (só `_id`) | Índice simples `{ cliente_id: 1 }` | **Índice composto `{ cliente_id: 1, data_pedido: -1 }`** |
| :--- | :---: | :---: | :---: |
| **Etapas** | `COLLSCAN → SORT` | `IXSCAN → FETCH → SORT` | **`IXSCAN → FETCH → LIMIT`** |
| **Chaves examinadas** | 0 | 227 | **10** |
| **Documentos examinados** | 200.000 | 227 | **10** |
| **Documentos devolvidos** | 10 | 10 | **10** |
| **Tempo (`executionTimeMillis`)** | 65–69 ms | 0–1 ms | **0–1 ms** |

- **Sem índice:** `COLLSCAN` lê a coleção inteira e `SORT` ordena na memória. 200 mil documentos examinados para devolver 10.
- **Índice simples (só para comparação):** acha os 227 pedidos do cliente pelo índice, mas ainda ordena na memória (`SORT`) e examina 227 para devolver 10. Com clientes antigos, que acumulam milhares de pedidos, esse número cresce.
- **Índice composto:** a ordem dos campos segue a consulta: primeiro o **filtro de igualdade** (`cliente_id`) e depois a **ordenação** (`data_pedido: -1`). Os pedidos do cliente já estão em ordem de data dentro do índice: o banco lê só os 10 primeiros e para (`LIMIT`), sem `SORT`. **Examinados = devolvidos = 10**, e esse número não cresce com o histórico do cliente.

Plano vencedor com o índice composto (trecho do `explain`):

```js
{
  stage: 'LIMIT', limitAmount: 10,
  inputStage: {
    stage: 'FETCH',
    inputStage: {
      stage: 'IXSCAN',
      indexName: 'cliente_id_1_data_pedido_-1',
      indexBounds: {
        cliente_id: ["[ObjectId('65f8c0009f1b2c001c8e5001'), ObjectId('65f8c0009f1b2c001c8e5001')]"],
        data_pedido: ['[MaxKey, MinKey]']
      }
    }
  }
}
```

### 4.4 Benchmark da rota: antes e depois

Comando ([benchmark.ts](app/src/scripts/benchmark.ts), copiado do repositório base): **1.000 requisições, 10 simultâneas**, na rota `GET /api/pedidos/historico/65f8c0009f1b2c001c8e5001`. Antes de cada medição foi feito um aquecimento de 50 requisições; cada cenário foi medido duas vezes.

```bash
docker exec nosql_app npm run benchmark -- "http://localhost:3400/api/pedidos/historico/65f8c0009f1b2c001c8e5001" 1000 10
```

**Sem índice:**

```
requisições  1000 (10 ao mesmo tempo), 0 com erro
vazão        88 requisições por segundo
latência     média 112.7 ms
             p50 111.8 ms · p95 136.8 ms · p99 145.5 ms

requisições  1000 (10 ao mesmo tempo), 0 com erro
vazão        80 requisições por segundo
latência     média 124.5 ms
             p50 123.4 ms · p95 144.9 ms · p99 156.7 ms
```

**Com o índice `{ cliente_id: 1, data_pedido: -1 }`:**

```
requisições  1000 (10 ao mesmo tempo), 0 com erro
vazão        1290 requisições por segundo
latência     média 7.4 ms
             p50 6.6 ms · p95 13.1 ms · p99 21.4 ms

requisições  1000 (10 ao mesmo tempo), 0 com erro
vazão        1568 requisições por segundo
latência     média 6.1 ms
             p50 5.5 ms · p95 9.4 ms · p99 17.8 ms
```

| Cenário (1.000 req., 10 simultâneas) | Vazão | p95 |
| :--- | :---: | :---: |
| Sem índice | 80–88 req/s | 137–145 ms |
| Com índice composto | 1.290–1.568 req/s | 9–13 ms |
| **Ganho** | **~16× mais vazão** | **~12× menor** |

O índice corrigiu a causa (a leitura da coleção inteira), sem cache e sem máquina maior. As medidas foram feitas no Docker Desktop (Windows 11) e variam entre máquinas e rodadas; o que se repete é a ordem de grandeza.

### 4.5 Índices da coleção `pedidos_historico`

```js
db.pedidos_historico.getIndexes()
```
```js
[
  { v: 2, key: { _id: 1 }, name: '_id_' },
  { v: 2, key: { cliente_id: 1, data_pedido: -1 }, name: 'cliente_id_1_data_pedido_-1' }
]
```

| Índice | Por que existe |
| :--- | :--- |
| `_id_` | Criado automaticamente pelo MongoDB; garante a unicidade do pedido e atende `GET /api/pedidos/:id`. |
| `cliente_id_1_data_pedido_-1` | Atende a consulta "Meus pedidos" sem `COLLSCAN` e sem `SORT` (Seção 4.3). Pela **regra do prefixo**, também atende qualquer consulta só por `cliente_id` (ex.: contar os pedidos de um cliente), por isso um índice separado `{ cliente_id: 1 }` seria redundante. |

**Índices que não foram criados:** cada pedido gravado precisa entrar em todos os índices da coleção, então índice demais deixa a escrita mais lenta. Consultas por `status` ou por período servem relatórios internos raros (fechamento mensal), que podem rodar fora do horário de pico; por isso não ganharam índice nesta coleção. Índice serve à consulta frequente e lenta, não a todos os campos.

**Outros índices criados no Checkpoint 3**, coleção `lojas`: `localizacao_2dsphere` (obrigatório para o `$near` da Seção 1) e `codigo_1` (único; usado pelo upsert do `seed:geo` e por `GET /api/perto/entregadores?loja=`).

---

## Seção 5 — Roteiro de demonstração

Sequência na ordem, a partir de um clone limpo. As saídas abaixo foram obtidas executando estes comandos. Valores de tempo variam de máquina para máquina.

### Passo 0: subir o ambiente do zero

```bash
git clone https://github.com/LucasXRosas/base-nosql-docker.git && cd base-nosql-docker
./iniciar.sh
```

**Saída esperada (trecho):**

```
Carregando coordenadas e a carga de teste (Checkpoint 3)...
Coordenadas, índice 2dsphere, carga de teste e índice de desempenho prontos.
Aguardando o Elasticsearch para criar o índice de busca...
Índice de busca criado a partir dos dados do MongoDB.
```

Conferência opcional dos índices criados pelo `iniciar.sh`:

```bash
docker exec nosql_mongo mongosh -u root -p root --authenticationDatabase admin retrovault --quiet \
  --eval 'printjson({ lojas: db.lojas.getIndexes().map(i => i.name), pedidos_historico: db.pedidos_historico.getIndexes().map(i => i.name), total_pedidos: db.pedidos_historico.countDocuments() })'
```
```js
{
  lojas: [ '_id_', 'localizacao_2dsphere', 'codigo_1' ],
  pedidos_historico: [ '_id_', 'cliente_id_1_data_pedido_-1' ],
  total_pedidos: 200000
}
```

---

### Passo 1: busca por raio (dois raios diferentes)

A posição de quem pergunta é a do cliente Lucas Rosa, no Centro (`lat=-25.3935`, `lon=-51.4590`).

#### 1.1 Raio de 1 km

```bash
curl -s "http://localhost:3400/api/perto/lojas?lat=-25.3935&lon=-51.4590&raio_km=1" | jq '{origem, raio_km, total, lojas: [.lojas[] | {codigo, nome, distancia_km}]}'
```
```json
{
  "origem": "MONGODB ($near com índice 2dsphere)",
  "raio_km": 1,
  "total": 2,
  "lojas": [
    { "codigo": "LJ-CENTRO", "nome": "RetroVault Centro (loja-sede)", "distancia_km": 0.2 },
    { "codigo": "LJ-SHOPPING", "nome": "Ponto de Retirada Shopping", "distancia_km": 0.67 }
  ]
}
```

#### 1.2 Raio de 3 km

```bash
curl -s "http://localhost:3400/api/perto/lojas?lat=-25.3935&lon=-51.4590&raio_km=3" | jq '{raio_km, total, lojas: [.lojas[] | {codigo, distancia_km}]}'
```
```json
{
  "raio_km": 3,
  "total": 4,
  "lojas": [
    { "codigo": "LJ-CENTRO", "distancia_km": 0.2 },
    { "codigo": "LJ-SHOPPING", "distancia_km": 0.67 },
    { "codigo": "LJ-TRIANON", "distancia_km": 1.13 },
    { "codigo": "LJ-BATEL", "distancia_km": 1.6 }
  ]
}
```
> Do mais perto para o mais longe. Com `raio_km=5` entram também `LJ-PRIMAVERA` (3.06 km) e `LJ-CAMPUS` (3.64 km).

#### 1.3 Só onde dá para levar jogos usados para avaliação (raio 3 km)

```bash
curl -s "http://localhost:3400/api/perto/lojas?lat=-25.3935&lon=-51.4590&raio_km=3&servico=avaliacao_usados" | jq -c '[.lojas[] | {codigo, distancia_km}]'
```
```json
[{"codigo":"LJ-CENTRO","distancia_km":0.2},{"codigo":"LJ-TRIANON","distancia_km":1.13},{"codigo":"LJ-BATEL","distancia_km":1.6}]
```
> O ponto `LJ-SHOPPING` saiu: ele só faz retirada.

#### 1.4 Motoboys perto da loja-sede (Redis `GEOSEARCH`) e o motoboy andou (`GEOADD`)

```bash
curl -s "http://localhost:3400/api/perto/entregadores?loja=LJ-CENTRO&raio_km=1" | jq -c '{origem, total, entregadores}'
curl -s -X PATCH "http://localhost:3400/api/perto/entregadores/Tiago" -H "Content-Type: application/json" -d '{"lat": -25.3930, "lon": -51.4615}' | jq -c .
curl -s "http://localhost:3400/api/perto/entregadores?loja=LJ-CENTRO&raio_km=1" | jq -c '{total, entregadores}'
```
```json
{"origem":"REDIS (GEOSEARCH)","total":2,"entregadores":[{"nome":"Rafael","distancia_km":0.0602},{"nome":"Bianca","distancia_km":0.6053}]}
{"origem":"REDIS (GEOADD)","chave":"retrovault:geo:entregadores","entregador":"Tiago","nova_posicao":{"lat":-25.393,"lon":-51.4615}}
{"total":3,"entregadores":[{"nome":"Rafael","distancia_km":0.0602},{"nome":"Tiago","distancia_km":0.1644},{"nome":"Bianca","distancia_km":0.6053}]}
```
> Tiago chegou ao raio de 1 km depois do `GEOADD`. Para voltar às posições iniciais: `docker exec nosql_app npm run seed:geo`.

---

### Passo 2: leitura com cache e busca, com todos os bancos no ar

#### 2.1 Leitura com cache: `MISS` e depois `HIT`

```bash
curl -s -X DELETE http://localhost:3400/api/jogos/cache > /dev/null
curl -s http://localhost:3400/api/jogos/promocoes | jq '{origem, tempo_resposta, total_itens}'
curl -s http://localhost:3400/api/jogos/promocoes | jq '{origem, tempo_resposta, total_itens}'
```
```json
{ "origem": "MONGODB (CACHE MISS)", "tempo_resposta": "6.95 ms", "total_itens": 8 }
{ "origem": "REDIS (CACHE HIT)", "tempo_resposta": "0.49 ms", "total_itens": 8 }
```

#### 2.2 Busca no ElasticSearch

```bash
curl -s "http://localhost:3400/api/busca?q=zelda" | jq '{origem, total, resultados: [.resultados[] | {sku, titulo, relevancia}]}'
```
```json
{
  "origem": "ELASTICSEARCH (multi_match + fuzziness)",
  "total": 2,
  "resultados": [
    { "sku": "GAME-N64-ZELDA-019", "titulo": "The Legend of Zelda: Ocarina of Time", "relevancia": 5.82 },
    { "sku": "GAME-NSW-TOTK-004", "titulo": "The Legend of Zelda: Tears of the Kingdom", "relevancia": 5.46 }
  ]
}
```

---

### Passo 3: derrubando o Redis e o ElasticSearch

#### 3.1 `docker stop` do Redis e a mesma leitura

```bash
docker stop nosql_redis
curl -s -w "\nHTTP %{http_code} em %{time_total}s\n" http://localhost:3400/api/jogos/promocoes -o >(jq -c '{origem, tempo_resposta, total_itens}')
curl -s -I http://localhost:3400/api/jogos/promocoes | grep -i x-cache
```
```
{"origem":"MONGODB (REDIS FORA DO AR, SEM CACHE)","tempo_resposta":"2.62 ms","total_itens":8}
HTTP 200 em 0.006389s
X-Cache: BYPASS
```
> Mesmos 8 itens, `HTTP 200` em milissegundos, sem erro 500 e sem esperar o Redis. (Se preferir sem `>(...)`: `curl -s http://localhost:3400/api/jogos/promocoes | jq '{origem, total_itens}'`.)

#### 3.2 `docker stop` do ElasticSearch e a mesma busca

```bash
docker stop nosql_elasticsearch
curl -s -w "\nHTTP %{http_code} em %{time_total}s\n" "http://localhost:3400/api/busca?q=zelda" -o >(jq '{origem, aviso, total, resultados: [.resultados[] | {sku, titulo}]}')
```
```
{
  "origem": "MONGODB ($regex, ELASTICSEARCH FORA DO AR)",
  "aviso": "ElasticSearch fora do ar: busca simplificada no MongoDB ($regex no título, descrição e tags), sem relevância, sem pesos e sem tolerância a erro de digitação.",
  "total": 2,
  "resultados": [
    { "sku": "GAME-N64-ZELDA-019", "titulo": "The Legend of Zelda: Ocarina of Time" },
    { "sku": "GAME-NSW-TOTK-004", "titulo": "The Legend of Zelda: Tears of the Kingdom" }
  ]
}
HTTP 200 em 1.508913s
```
> O que o aviso quer dizer: com erro de digitação (`q=zeldda`) a busca simples devolve `"total": 0`, porque o `$regex` não tem a tolerância a erro (`fuzziness`) do ElasticSearch.

#### 3.3 `docker start` dos dois

```bash
docker start nosql_redis nosql_elasticsearch
until curl -s -f http://localhost:9234 > /dev/null; do sleep 2; done     # o ElasticSearch leva ~20 s para subir
curl -s http://localhost:3400/api/health | jq -c '{status_geral, mongodb: .bancos.mongodb.status, redis: .bancos.redis.status, elasticsearch: .bancos.elasticsearch.status}'
curl -s http://localhost:3400/api/jogos/promocoes | jq -r .origem
curl -s http://localhost:3400/api/jogos/promocoes | jq -r .origem
curl -s "http://localhost:3400/api/busca?q=zelda" | jq -r .origem
```
```
{"status_geral":"OK","mongodb":"ONLINE","redis":"ONLINE","elasticsearch":"ONLINE"}
MONGODB (CACHE MISS)
REDIS (CACHE HIT)
ELASTICSEARCH (multi_match + fuzziness)
```
> A API voltou a usar o cache e o ElasticSearch sozinha, sem reiniciar.

#### 3.4 (Opcional) MongoDB fora do ar: `503`

```bash
docker stop nosql_mongo
curl -s -w "\nHTTP %{http_code}\n" http://localhost:3400/api/jogos/promocoes
docker start nosql_mongo
```
```
{"erro":"A lista de promoções está indisponível no momento: o banco principal (MongoDB) não respondeu. Tente novamente em instantes.","detalhe":"getaddrinfo ENOTFOUND mongo"}
HTTP 503
```
> Se a lista de promoções ainda estiver no cache, a resposta vem do Redis (`CACHE HIT`). Para ver o `503`, rode antes `curl -s -X DELETE http://localhost:3400/api/jogos/cache`.

---

### Passo 4: escrita crítica

Ligamos o *profiler* do MongoDB só para inserts em `pedidos`, gravamos um pedido pela API e conferimos o `writeConcern` que chegou ao banco:

```bash
docker exec nosql_mongo mongosh -u root -p root --authenticationDatabase admin retrovault --quiet \
  --eval 'db.setProfilingLevel(2, { filter: { op: "insert", ns: "retrovault.pedidos" } })'

curl -s -X POST http://localhost:3400/api/pedidos -H "Content-Type: application/json" \
  -d '{"cliente_id":"65f8c0009f1b2c001c8e5001","itens":[{"jogo_id":"65f8a12b9f1b2c001c8e4a10","titulo":"God of War (PlayStation Hits)","plataforma":"PlayStation 4","quantidade":1,"preco_unitario":89.90}],"valor_total":104.90}' \
  | jq '{mensagem, gravado, confirmacao, id}'

docker exec nosql_mongo mongosh -u root -p root --authenticationDatabase admin retrovault --quiet \
  --eval 'printjson(db.system.profile.find({ op: "insert", ns: "retrovault.pedidos" }).sort({ ts: -1 }).limit(1).toArray().map(p => ({ op: p.op, writeConcern: p.command.writeConcern, ninserted: p.ninserted }))); db.setProfilingLevel(0)'
```
```json
{
  "mensagem": "Pedido registrado com sucesso!",
  "gravado": true,
  "confirmacao": "maioria dos nós (writeConcern w: \"majority\")",
  "id": "6b00ad75c6783e687a3c3fe1"
}
```
```js
[ { op: 'insert', writeConcern: { w: 'majority', wtimeout: 5000 }, ninserted: 1 } ]
```
> O `id` muda a cada execução. O caminho do `MongoWriteConcernError` (`202`, "não reenvie") está na Seção 3.2; ele não ocorre num nó único, porque a maioria de 1 nó responde sempre. Com o MongoDB parado (`docker stop nosql_mongo`), o mesmo `POST` responde `503` com `"gravado": false`.

---

### Passo 5: `explain()` da consulta escolhida e benchmark da rota

#### 5.1 Antes: sem índice

```bash
docker exec nosql_app npm run seed:carga -- --sem-indice
docker exec nosql_app npm run explain:historico
```
```
índices     _id_
etapas      COLLSCAN → SORT
chaves      0 examinadas
examinados  200000 documentos
devolvidos  10
tempo       67 ms
```
```bash
docker exec nosql_app npm run benchmark -- "http://localhost:3400/api/pedidos/historico/65f8c0009f1b2c001c8e5001" 1000 10
```
```
requisições  1000 (10 ao mesmo tempo), 0 com erro
vazão        88 requisições por segundo
latência     média 112.7 ms
             p50 111.8 ms · p95 136.8 ms · p99 145.5 ms
```

#### 5.2 Depois: com o índice composto

```bash
docker exec nosql_app npm run seed:carga        # recria { cliente_id: 1, data_pedido: -1 }
docker exec nosql_app npm run explain:historico
```
```
índices     _id_, cliente_id_1_data_pedido_-1
etapas      IXSCAN → FETCH → LIMIT  (índice cliente_id_1_data_pedido_-1)
chaves      10 examinadas
examinados  10 documentos
devolvidos  10
tempo       1 ms
```
```bash
docker exec nosql_app npm run benchmark -- "http://localhost:3400/api/pedidos/historico/65f8c0009f1b2c001c8e5001" 1000 10
```
```
requisições  1000 (10 ao mesmo tempo), 0 com erro
vazão        1290 requisições por segundo
latência     média 7.4 ms
             p50 6.6 ms · p95 13.1 ms · p99 21.4 ms
```
> De 200 mil documentos examinados para 10; vazão ~16× maior e p95 ~12× menor. O ambiente termina como o `iniciar.sh` deixou, com o índice criado.

---

## Anexo — Correções do feedback do Checkpoint 2

Conferidas antes deste checkpoint (commit `6b43fe6`) e mantidas:

1. **Falha real do ElasticSearch registra pendência:** em `atualizarSincronizado`, a indexação (`indexarJogoNoElastic`) fica dentro do `try/catch`; falha real e simulada (`?simular_falha=elastic`) seguem o mesmo caminho e fazem `RPUSH` em `retrovault:sync:pendentes`. Neste checkpoint a falha real também passou a ser detectada em até 1,5 s (Seção 2.2).
2. **O reprocessamento não perde pendências:** `reprocessarPendencias` remove cada item com `LREM` só depois de reindexá-lo com sucesso; as que falham de novo permanecem na lista (sem `DEL` da lista inteira).
3. **Ranking do roteiro:** o `init/redis-init.commands` popula `retrovault:ranking:jogos:vendidos`, a mesma chave lida por `GET /api/redis/ranking/top`.
