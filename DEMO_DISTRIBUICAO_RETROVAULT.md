# 🌐 Roteiro de Demonstração Prática — Módulo 10: Escalabilidade e Distribuição (RetroVault)

A pergunta da aula: **o que acontece com os pedidos do RetroVault quando um servidor cai ou a rede falha?**

1. **MongoDB:** três nós (replica set), um primário e duas cópias.
2. **MongoDB:** o primário cai e os outros elegem um novo.
3. **MongoDB:** esperar quantas cópias (`writeConcern`).
4. **MongoDB:** a rede parte e o nó isolado para de aceitar escritas.
5. **Redis:** réplica que só lê e escrita que não espera a cópia.
6. **ElasticSearch:** um índice dividido em shards, com réplicas sem lugar.
7. **MongoDB com sharding:** a mesma coleção de pedidos dividida por duas chaves diferentes.
8. **API do RetroVault:** as rotas continuam no ar com o Redis e o ElasticSearch fora.

---

## ⚙️ Preparação

```bash
./iniciar.sh            # ambiente de sempre (o ElasticSearch é usado no experimento 6, a API no 8)
./distribuido.sh subir  # 3 nós do MongoDB (replica set retrovault-rs) e Redis com réplica
```

O `./distribuido.sh` usa o `docker-compose.distribuido.yaml`, numa rede própria (`nosql_distribuido`), sem mexer no ambiente principal. Comandos:

- `./distribuido.sh sharding`: sobe também o MongoDB com sharding (experimento 7).
- `./distribuido.sh status`: quem é primário e quem é réplica.
- `./distribuido.sh parar`: derruba o ambiente distribuído (libera memória).
- `./distribuido.sh reset`: apaga os dados e começa do zero.

Para abrir o `mongosh` em um nó: `docker exec -it nosql_mongo_a mongosh` (ou `_b`, `_c`). Para o Redis: `docker exec -it nosql_redis_principal redis-cli` (ou `nosql_redis_replica`).

---

## 🧪 Experimento 1 — Quem é quem (MongoDB)

No `mongo-a`:

```js
rs.status().members.forEach(m => print(m.name, m.stateStr))
```

```
mongo-a:27017 PRIMARY
mongo-b:27017 SECONDARY
mongo-c:27017 SECONDARY
```

Grave um pedido pago no primário, esperando a maioria dos nós:

```js
use("retrovault")
db.pedidos.insertOne(
  { numero: 1001, cliente: "Lucas Rosa", jogo: "Chrono Trigger (SNES)", status: "pago" },
  { writeConcern: { w: "majority" } }
)
```

No `mongo-b`, leia da cópia e tente escrever:

```js
use("retrovault")
db.getMongo().setReadPref("secondary")
db.pedidos.findOne({ numero: 1001 }, { _id: 0 })
db.pedidos.insertOne({ numero: 1002, cliente: "Ana Silva" })
```

```
{ numero: 1001, cliente: 'Lucas Rosa', jogo: 'Chrono Trigger (SNES)', status: 'pago' }
MongoServerError: not primary
```

Só o primário aceita escritas; as cópias servem leitura.

---

## 🧪 Experimento 2 — O primário caiu

```bash
docker stop nosql_mongo_a
```

Espere uns 10 segundos e rode o `rs.status()` no `mongo-b`:

```
mongo-a:27017 (not reachable/healthy)
mongo-b:27017 PRIMARY
mongo-c:27017 SECONDARY
```

Com 2 de 3 nós de pé, a maioria elegeu um novo primário. O pedido 1001, gravado com `w: "majority"`, não se perdeu: ele já estava em pelo menos dois nós.

---

## 🧪 Experimento 3 — Esperar quantas cópias?

Ainda com o `mongo-a` fora do ar, no `mongo-b`:

```js
use("retrovault")
db.pedidos.insertOne({ numero: 1003, cliente: "Carlos Eduardo", jogo: "Silent Hill 2 (PS2)" }, { writeConcern: { w: 3, wtimeout: 3000 } })
db.pedidos.insertOne({ numero: 1004, cliente: "Mariana Souza", jogo: "Resident Evil 4 (GameCube)" }, { writeConcern: { w: "majority" } })
db.pedidos.find({}, { _id: 0, numero: 1, cliente: 1 })
```

```
MongoWriteConcernError: waiting for replication timed out
{ numero: 1001, cliente: 'Lucas Rosa' }
{ numero: 1003, cliente: 'Carlos Eduardo' }
{ numero: 1004, cliente: 'Mariana Souza' }
```

- `w: 3` espera os três nós e estoura o `wtimeout`.
- `w: "majority"` responde na hora (2 de 3 estão de pé).
- **Atenção:** o pedido do Carlos aparece na lista. O `MongoWriteConcernError` não desfaz a gravação; ele só avisa que não deu para esperar todas as cópias. Por isso o `POST /api/pedidos` do RetroVault responde `202` com o id e "não reenvie" nesse caso, em vez de tratar como falha (CHECKPOINT_3.md, Seção 3).

Volte o nó: `docker start nosql_mongo_a`. Em alguns segundos ele copia o que perdeu e, por ter prioridade maior, volta a ser o primário.

---

## 🧪 Experimento 4 — A rede partiu

```bash
docker network disconnect nosql_distribuido nosql_mongo_a
```

O `mongo-a` continua ligado, mas sozinho. Depois de uns 10 segundos, no `mongo-a`:

```
mongo-a:27017 SECONDARY
mongo-b:27017 (not reachable/healthy)
mongo-c:27017 (not reachable/healthy)
MongoServerError: not primary
```

E no `mongo-b`:

```
mongo-a:27017 (not reachable/healthy)
mongo-b:27017 PRIMARY
mongo-c:27017 SECONDARY
```

Sem enxergar a maioria, o isolado desiste de ser primário: o MongoDB prefere **consistência** (nunca dois primários aceitando pedidos diferentes) a disponibilidade. Religue a rede:

```bash
docker network connect nosql_distribuido nosql_mongo_a
```

---

## 🧪 Experimento 5 — Redis com réplica

```bash
docker exec nosql_redis_principal redis-cli SET retrovault:pedido:1001:status "enviado"
docker exec nosql_redis_principal redis-cli WAIT 1 1000
docker exec nosql_redis_replica redis-cli GET retrovault:pedido:1001:status
docker exec nosql_redis_replica redis-cli SET retrovault:pedido:1001:status "entregue"
```

```
OK
1
enviado
READONLY You can't write against a read only replica.
```

Agora derrube a réplica e escreva de novo:

```bash
docker stop nosql_redis_replica
docker exec nosql_redis_principal redis-cli SET retrovault:pedido:1002:status "em_separacao"
docker exec nosql_redis_principal redis-cli WAIT 1 1000
```

```
OK
0
```

O `SET` respondeu OK sem nenhuma cópia (`WAIT` devolveu 0): o Redis prefere responder logo. Volte a réplica com `docker start nosql_redis_replica` e confira que ela copiou o status do pedido 1002 (`GET retrovault:pedido:1002:status` → `em_separacao`).

> **Para o RetroVault:** é por isso que só guardamos no Redis o que pode ser refeito (cache, fila de expedição, ranking, posição dos motoboys). O pedido pago fica no MongoDB com `w: "majority"`.

---

## 🧪 Experimento 6 — Shards no ElasticSearch

No ElasticVue (<http://localhost:8400>) ou com `curl` na porta 9234:

```bash
curl -s -X PUT http://localhost:9234/pedidos-teste -H 'Content-Type: application/json' \
  -d '{"settings":{"number_of_shards":3,"number_of_replicas":1}}'
for n in $(seq 1001 1012); do
  curl -s -o /dev/null -X PUT "http://localhost:9234/pedidos-teste/_doc/pedido-$n" -H 'Content-Type: application/json' -d "{\"numero\": $n}"
done
curl -s -X POST http://localhost:9234/pedidos-teste/_refresh > /dev/null
curl -s "http://localhost:9234/_cat/shards/pedidos-teste?v&h=shard,prirep,state,docs&s=shard,prirep"
curl -s "http://localhost:9234/_cluster/health/pedidos-teste?filter_path=status"
```

```
shard prirep state      docs
0     p      STARTED       3
0     r      UNASSIGNED
1     p      STARTED       4
1     r      UNASSIGNED
2     p      STARTED       5
2     r      UNASSIGNED
{"status":"yellow"}
```

- `p`: o shard primário, uma parte do índice. Os 12 documentos foram divididos pelo hash do `_id`.
- `r`: a réplica de cada shard, sem lugar (`UNASSIGNED`): o ElasticSearch nunca põe a cópia no mesmo nó do original.
- `yellow`: todos os dados estão lá, mas sem cópia. (O índice `jogos` do RetroVault usa `number_of_replicas: 0` justamente por rodar num nó só, e fica `green`.)

Ao terminar: `curl -s -X DELETE http://localhost:9234/pedidos-teste`.

---

## 🧪 Experimento 7 — Sharding: a chave decide o equilíbrio

```bash
./distribuido.sh sharding
docker exec -it nosql_mongo_roteador mongosh
```

Quatro containers novos: `mongo-config` (o mapa de quem guarda o quê), `mongo-shard-1`, `mongo-shard-2` e `mongo-roteador` (`mongos`). A aplicação conversa só com o roteador, como se fosse um MongoDB comum.

No roteador, a mesma coleção de pedidos com duas chaves de shard:

```js
sh.enableSharding("retrovault");
sh.shardCollection("retrovault.pedidos_por_cidade", { cidade: 1 });
sh.shardCollection("retrovault.pedidos_por_numero", { numero: "hashed" });
// Por faixa: de A até antes de "Londrina" no shard-1; de "Londrina" em diante no shard-2
sh.splitAt("retrovault.pedidos_por_cidade", { cidade: "Londrina" });
sh.moveChunk("retrovault.pedidos_por_cidade", { cidade: "Londrina" }, "shard-2");
print("ok");
```

Grave os mesmos 1.000 pedidos nas duas coleções. A loja fica em Guarapuava, então a maior parte das entregas é local: 70% de Guarapuava, 15% de Curitiba, 10% de Ponta Grossa, 5% de Londrina.

```js
use("retrovault");
const pedidos = [];
let numero = 1;
for (const [cidade, qtd] of [["Guarapuava", 700], ["Curitiba", 150], ["Ponta Grossa", 100], ["Londrina", 50]])
  for (let i = 0; i < qtd; i++) pedidos.push({ numero: numero++, cidade });
db.pedidos_por_cidade.insertMany(pedidos);
db.pedidos_por_numero.insertMany(pedidos);
print("ok");
```

Quanto ficou em cada shard:

```js
use("retrovault");
for (const c of ["pedidos_por_cidade", "pedidos_por_numero"]) {
  print(c);
  db[c].aggregate([
    { $collStats: { count: {} } },
    { $sort: { shard: 1 } }
  ]).forEach(s =>
    print("  " + s.shard + ": " + s.count + " pedidos"));
}
```

```
pedidos_por_cidade
  shard-1: 850 pedidos
  shard-2: 150 pedidos
pedidos_por_numero
  shard-1: 520 pedidos
  shard-2: 480 pedidos
```

E quais shards cada consulta precisa visitar:

```js
use("retrovault");
const onde = (colecao, filtro) => {
  const plano = db[colecao].find(filtro).explain().queryPlanner.winningPlan;
  print(colecao, JSON.stringify(filtro), "->", plano.shards.map(s => s.shardName).sort().join(" e "));
};
onde("pedidos_por_cidade", { cidade: "Guarapuava" });
onde("pedidos_por_cidade", { numero: 500 });
onde("pedidos_por_numero", { numero: 500 });
onde("pedidos_por_numero", { cidade: "Guarapuava" });
```

```
pedidos_por_cidade {"cidade":"Guarapuava"} -> shard-1
pedidos_por_cidade {"numero":500} -> shard-1 e shard-2
pedidos_por_numero {"numero":500} -> shard-2
pedidos_por_numero {"cidade":"Guarapuava"} -> shard-1 e shard-2
```

- **Por cidade:** um shard quente (Guarapuava sozinha tem 70%). A busca por cidade vai a um shard só; a busca por número pergunta a todos.
- **Por hash do número:** equilibrado, e a busca por número vai a um shard só; a busca por cidade pergunta a todos.
- Não existe chave perfeita: escolha pela consulta mais frequente. No RetroVault, "Meus pedidos" filtra por `cliente_id`, que seria a chave natural para `pedidos_historico`.

Ao terminar: `./distribuido.sh parar`.

---

## 🧪 Experimento 8 — A API do RetroVault continua no ar quando um banco cai

No RetroVault, as **próprias rotas do Checkpoint 2** ficaram resilientes (não há rotas paralelas). Com todos os bancos no ar:

```bash
curl -s "http://localhost:3400/api/jogos/GAME-PS4-GOW-010" | jq -r .origem
curl -s "http://localhost:3400/api/jogos/GAME-PS4-GOW-010" | jq -r .origem
curl -s "http://localhost:3400/api/busca?q=zelda" | jq -r .origem
```
```
MONGODB (CACHE MISS)
REDIS (CACHE HIT)
ELASTICSEARCH (multi_match + fuzziness)
```

Agora derrube o Redis e o ElasticSearch do ambiente principal:

```bash
docker stop nosql_redis nosql_elasticsearch
curl -s -w "HTTP %{http_code} em %{time_total}s\n" -o >(jq -c '{origem, preco: .jogo.preco}') "http://localhost:3400/api/jogos/GAME-PS4-GOW-010"
curl -s -w "HTTP %{http_code} em %{time_total}s\n" -o >(jq -c '{origem, total, resultados: [.resultados[].titulo]}') "http://localhost:3400/api/busca?q=zelda"
```

```
{"origem":"MONGODB (REDIS FORA DO AR, SEM CACHE)","preco":89.9}
HTTP 200 em 0.0069s
{"origem":"MONGODB ($regex, ELASTICSEARCH FORA DO AR)","total":2,"resultados":["The Legend of Zelda: Ocarina of Time","The Legend of Zelda: Tears of the Kingdom"]}
HTTP 200 em 1.51s
```

- **Sem Redis:** `redisPronto()` vê que o cliente não está `ready` e a rota vai direto ao MongoDB, em milissegundos. Sem esse cuidado, o `ioredis` enfileira o comando e a rota termina em `500` depois das novas tentativas.
- **Sem ElasticSearch:** a busca tem teto de 1,5 s (`comLimite` + `maxRetries: 0`) e cai para um `$regex` no MongoDB, com `aviso` na resposta.
- **Sem MongoDB** (`docker stop nosql_mongo`): a fonte da verdade caiu, e as rotas respondem `503` com mensagem clara.

Volte os bancos:

```bash
docker start nosql_redis nosql_elasticsearch
```

O roteiro completo, com todas as rotas e a escrita crítica, está no [`CHECKPOINT_3.md`](CHECKPOINT_3.md), Seções 2, 3 e 5.

---

## 📌 Resumo

| Banco | Como copia | Como divide | Na falha, prefere | No RetroVault |
| :--- | :--- | :--- | :--- | :--- |
| MongoDB | Replica set com eleição | Shards por faixa ou por hash (mongos) | Consistência: sem maioria, não escreve | Pedido pago com `w: "majority"` |
| Redis | Réplica assíncrona | Redis Cluster (não visto) | Disponibilidade: responde sem esperar a cópia | Só dados que podem ser refeitos |
| ElasticSearch | Réplica de cada shard, em outro nó | Shards por hash do `_id` | Segue no amarelo com o que tem | Busca cai para o MongoDB com aviso |
