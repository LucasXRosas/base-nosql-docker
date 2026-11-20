# ⚡ Roteiro de Demonstração Prática — Módulo 11: Performance e Otimização (RetroVault)

A pergunta da aula: **a tela "Meus pedidos" do RetroVault está lenta. Por quê, e o que realmente resolve?**

1. **MongoDB:** 200 mil pedidos e o `explain()` de uma consulta sem índice.
2. **MongoDB:** o índice simples, o índice composto e o índice que não serve.
3. **MongoDB:** o custo dos índices na escrita.
4. **API:** o benchmark da rota, sem índice e com índice.

O código está em `app/src/controllers/pedidos.controller.ts` (`historicoCliente`), a carga em `app/src/scripts/seed-carga.ts`, o resumo do `explain` em `app/src/scripts/explain-historico.ts` e o benchmark em `app/src/scripts/benchmark.ts`.

---

## ⚙️ Preparação

```bash
./iniciar.sh
```

O `./iniciar.sh` executa `npm run seed:carga`, que grava 200 mil pedidos antigos (cinco anos de vendas, 1.000 clientes, itens sorteados do catálogo real) na coleção `pedidos_historico` e cria o índice `{ cliente_id: 1, data_pedido: -1 }`. A carga usa um sorteio com semente fixa: os pedidos são os mesmos em qualquer máquina. Se a coleção já existe, nada é regravado.

```bash
docker exec nosql_app npm run seed:carga -- --sem-indice  # tira todos os índices (fica só o _id)
docker exec nosql_app npm run seed:carga                  # recria o índice
docker exec nosql_app npm run seed:carga -- --recriar     # apaga e grava tudo de novo
```

Para os experimentos 1 a 5, comece **sem índice** e abra o `mongosh`:

```bash
docker exec nosql_app npm run seed:carga -- --sem-indice
docker exec -it nosql_mongo mongosh -u root -p root --authenticationDatabase admin retrovault
```

---

## 🧪 Experimento 1 — O histórico de pedidos

```js
db.pedidos_historico.countDocuments();
db.pedidos_historico.countDocuments({ cliente_id: ObjectId("65f8c0009f1b2c001c8e5001") });
db.pedidos_historico.findOne({}, { _id: 0 });
```

```
200000
227
{
  numero: 1,
  cliente_id: ObjectId('6a00000000000000000000dd'),
  itens: [
    { jogo_id: ObjectId('65f8a12b9f1b2c001c8e4a04'), titulo: 'The Legend of Zelda: Tears of the Kingdom', plataforma: 'Nintendo Switch', quantidade: 1, preco_unitario: 299 },
    { jogo_id: ObjectId('65f8a12b9f1b2c001c8e4a09'), titulo: 'Dark Souls Remastered', plataforma: 'PlayStation 4', quantidade: 1, preco_unitario: 120 }
  ],
  valor_total: 443.37,
  status: 'entregue',
  data_pedido: ISODate('2025-03-31T05:15:50.858Z'),
  entrega: { valor_frete: 24.37 }
}
```

O cliente dos exemplos é o **Lucas Rosa** (`65f8c0009f1b2c001c8e5001`), com 227 pedidos no histórico.

---

## 🧪 Experimento 2 — Sem índice: o banco lê tudo

A tela "Meus pedidos" mostra os 10 pedidos mais recentes do cliente:

```js
const plano = db.pedidos_historico
  .find({ cliente_id: ObjectId("65f8c0009f1b2c001c8e5001") })
  .sort({ data_pedido: -1 })
  .limit(10)
  .explain("executionStats");
```

No resultado, procure em `executionStats` os campos `totalDocsExamined`, `nReturned` e `executionTimeMillis`, e em `queryPlanner.winningPlan` as etapas (`stage`). O mesmo resumo sai pronto com:

```bash
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

`COLLSCAN` é a leitura da coleção inteira; `SORT` é a ordenação feita na memória. Para devolver 10 pedidos, o banco examinou 200 mil.

---

## 🧪 Experimento 3 — O índice simples e o composto

```js
db.pedidos_historico.createIndex({ cliente_id: 1 })
```

Repita o mesmo `explain`:

```
etapas      IXSCAN → FETCH → SORT
chaves      227 examinadas
examinados  227 documentos
devolvidos  10
tempo       1 ms
```

Achou os 227 pedidos do Lucas pelo índice (`IXSCAN`), mas ainda ordenou na memória (`SORT`). Agora o índice com os dois campos, na ordem **filtro e depois ordenação**:

```js
db.pedidos_historico.dropIndexes()
db.pedidos_historico.createIndex({ cliente_id: 1, data_pedido: -1 })
```

```
etapas      IXSCAN → FETCH → LIMIT  (índice cliente_id_1_data_pedido_-1)
chaves      10 examinadas
examinados  10 documentos
devolvidos  10
tempo       1 ms
```

Os pedidos do Lucas já estão em ordem de data dentro do índice: o banco examina só 10 documentos e não precisa ordenar. Esse número não cresce com o histórico do cliente.

---

## 🧪 Experimento 4 — O índice que não serve

Com o índice `{ cliente_id: 1, data_pedido: -1 }` criado, um relatório interno de devoluções de uma plataforma:

```js
db.pedidos_historico
  .find({ "itens.plataforma": "Nintendo 64", status: "devolvido" })
  .explain("executionStats")
```

```
etapas      COLLSCAN
examinados  200000 documentos
devolvidos  594
```

O índice só ajuda quando a consulta usa o **primeiro campo** dele (regra do prefixo). Como uma lista telefônica ordenada por sobrenome, que não ajuda a achar alguém pelo primeiro nome. Esse relatório é raro (fechamento mensal), então não ganhou índice próprio: veja o experimento 5.

Para ver os índices da coleção: `db.pedidos_historico.getIndexes()`.

---

## 🧪 Experimento 5 — O custo do índice na escrita

```js
// Os mesmos 50 mil pedidos, gravados em duas coleções:
// uma só com o índice do _id e outra com mais cinco índices.
const pedidos = db.pedidos_historico.find({}, { _id: 0 }).limit(50000).toArray();
const teste = (nome, indices) => {
  db[nome].drop();
  indices.forEach(i => db[nome].createIndex(i));
  const inicio = Date.now();
  db[nome].insertMany(pedidos);
  return Date.now() - inicio;
};
const sem = teste("teste_1_indice", []);
const com = teste("teste_6_indices", [{ cliente_id: 1, data_pedido: -1 },
  { status: 1 }, { valor_total: 1 }, { data_pedido: 1 }, { "itens.plataforma": 1 }]);
print("só o _id  ", sem, "ms"); print("6 índices ", com, "ms");
db.teste_1_indice.drop(); db.teste_6_indices.drop();
```

```
só o _id   593 ms
6 índices  1120 ms
```

Com seis índices, gravar os mesmos 50 mil pedidos levou quase o dobro do tempo (o `itens.plataforma` é *multikey* e gera uma entrada por item; o valor exato depende da máquina). Cada pedido gravado precisa entrar em todos os índices. Índice para as consultas frequentes e lentas, não para todos os campos.

---

## 🧪 Experimento 6 — O benchmark da API

O script de benchmark dispara várias requisições, algumas ao mesmo tempo, e mostra a vazão (requisições por segundo) e a latência (média, p50, p95 e p99). Argumentos: URL, total de requisições e quantas ao mesmo tempo.

Sem índice:

```bash
docker exec nosql_app npm run seed:carga -- --sem-indice
docker exec nosql_app npm run benchmark -- "http://localhost:3400/api/pedidos/historico/65f8c0009f1b2c001c8e5001" 1000 10
```

```
requisições  1000 (10 ao mesmo tempo), 0 com erro
vazão        88 requisições por segundo
latência     média 112.7 ms
             p50 111.8 ms · p95 136.8 ms · p99 145.5 ms
```

Com o índice composto:

```bash
docker exec nosql_app npm run seed:carga
docker exec nosql_app npm run benchmark -- "http://localhost:3400/api/pedidos/historico/65f8c0009f1b2c001c8e5001" 1000 10
```

```
requisições  1000 (10 ao mesmo tempo), 0 com erro
vazão        1290 requisições por segundo
latência     média 7.4 ms
             p50 6.6 ms · p95 13.1 ms · p99 21.4 ms
```

- **O índice resolveu a causa:** a vazão ficou cerca de 16 vezes maior, e o p95 caiu de cerca de 140 ms para cerca de 10 ms.
- Cache no Redis viria depois: sem índice, a primeira requisição de cada cliente, e cada vez que o TTL vence, ainda pagaria a consulta lenta.

> A medida oscila de uma rodada para outra e de máquina para máquina (estes números são do Docker Desktop no Windows 11). Rode cada benchmark mais de uma vez e compare versões medidas na mesma máquina, do mesmo jeito. Ao terminar, deixe o índice criado (`npm run seed:carga`), como o `iniciar.sh` deixa.

---

## 📌 Resumo

1. **Medir antes de mexer:** latência (p50, p95, p99) e vazão.
2. **Encontrar a etapa lenta:** `explain()`; desconfie de `COLLSCAN` e de muitos examinados para poucos devolvidos.
3. **Corrigir a causa:** o índice certo (filtro primeiro, depois a ordenação).
4. **Medir de novo.** Cache e servidor maior vêm depois.

Os números e a justificativa de cada índice estão no [`CHECKPOINT_3.md`](CHECKPOINT_3.md), Seção 4.
