# Roteiro de Demonstração Prática — Módulo 09: Dados Geográficos (RetroVault)

A pergunta da aula: **"o que está perto de mim?"**, no RetroVault.

1. **MongoDB:** lojas e pontos de retirada/avaliação de usados perto do cliente (endereço oficial, fonte da verdade).
2. **MongoDB:** o mesmo raio, filtrando pelo serviço que o cliente quer.
3. **Redis:** motoboys da entrega expressa perto da loja de coleta (posição que muda a cada segundo).
4. **Redis:** o motoboy andou.

O código está em `app/src/controllers/perto.controller.ts` e as coordenadas, fictícias, em `init/geo-init.json`.

> **Por que não há busca geográfica no ElasticSearch?** O RetroVault envia pelos Correios: o jogo não tem lugar, e nenhuma busca do catálogo depende de distância. A localização existe só nas lojas (paradas) e nos motoboys (que se movem).

---

## Preparação

```bash
./iniciar.sh
```

O `./iniciar.sh` executa `npm run seed:geo`, que:

- grava a coleção `lojas` (loja-sede, parceiros e pontos de retirada) com o campo `localizacao` em GeoJSON e cria o índice `2dsphere`;
- coloca os motoboys na chave `retrovault:geo:entregadores` do Redis (`GEOADD`).

> **Atenção à ordem dos números:** o GeoJSON (MongoDB) e o `GEOADD` (Redis) recebem **longitude primeiro**. Inverter não dá erro: dá resultado vazio (ou no meio do oceano).

As rotas recebem a posição de quem pergunta em `?lat=&lon=`. Nos exemplos, é a do cliente Lucas Rosa, no Centro de Guarapuava (`-25.3935, -51.4590`). A posição do cliente **não é gravada** (LGPD).

---

## Experimento 1 — Lojas a até 1 km e a até 3 km (MongoDB)

```bash
curl -s "http://localhost:3400/api/perto/lojas?lat=-25.3935&lon=-51.4590&raio_km=1" | jq '{origem, total, lojas: [.lojas[] | {codigo, distancia_km}]}'
curl -s "http://localhost:3400/api/perto/lojas?lat=-25.3935&lon=-51.4590&raio_km=3" | jq -c '[.lojas[] | {codigo, distancia_km}]'
```

```json
{
  "origem": "MONGODB ($near com índice 2dsphere)",
  "total": 2,
  "lojas": [
    { "codigo": "LJ-CENTRO", "distancia_km": 0.2 },
    { "codigo": "LJ-SHOPPING", "distancia_km": 0.67 }
  ]
}
```
```json
[{"codigo":"LJ-CENTRO","distancia_km":0.2},{"codigo":"LJ-SHOPPING","distancia_km":0.67},{"codigo":"LJ-TRIANON","distancia_km":1.13},{"codigo":"LJ-BATEL","distancia_km":1.6}]
```

No `mongosh` (`docker exec -it nosql_mongo mongosh -u root -p root --authenticationDatabase admin retrovault`), a consulta é a mesma, com a distância em **metros**:

```js
db.lojas.find({ localizacao: { $near: {
  $geometry: { type: "Point", coordinates: [-51.4590, -25.3935] },
  $maxDistance: 1000
} } }, { _id: 0, codigo: 1 })
```

> **O que observar:** o `$near` filtra pelo raio **e** já devolve do mais perto para o mais longe. Sem o índice `2dsphere`, a consulta falha (`unable to find index for $geoNear query`).

---

## Experimento 2 — Só onde dá para avaliar jogos usados

```bash
curl -s "http://localhost:3400/api/perto/lojas?lat=-25.3935&lon=-51.4590&raio_km=3&servico=avaliacao_usados" | jq -c '[.lojas[] | {codigo, distancia_km}]'
```

```json
[{"codigo":"LJ-CENTRO","distancia_km":0.2},{"codigo":"LJ-TRIANON","distancia_km":1.13},{"codigo":"LJ-BATEL","distancia_km":1.6}]
```

> **O que observar:** o `LJ-SHOPPING` saiu, porque só faz retirada. O filtro geográfico e o filtro comum (`servicos`) convivem na mesma consulta.

---

## Experimento 3 — Motoboys perto da loja-sede (Redis)

```bash
curl -s "http://localhost:3400/api/perto/entregadores?loja=LJ-CENTRO&raio_km=1" | jq -c '{origem, total, entregadores}'
```

```json
{"origem":"REDIS (GEOSEARCH)","total":2,"entregadores":[{"nome":"Rafael","distancia_km":0.0602},{"nome":"Bianca","distancia_km":0.6053}]}
```

Com `loja=`, a posição de partida é lida da coleção `lojas` (MongoDB) e a busca é feita no Redis. No `redis-cli` (ou Redis Commander, `http://localhost:8402`):

```
GEOSEARCH retrovault:geo:entregadores FROMLONLAT -51.4602 -25.3921 BYRADIUS 1 km ASC WITHDIST
TYPE retrovault:geo:entregadores
```

> **O que observar:** o `TYPE` responde `zset`. O GEO do Redis é um Sorted Set (Módulo 06), em que o score é o código do quadrado do mapa.

---

## Experimento 4 — O motoboy andou (Redis)

```bash
curl -s -X PATCH "http://localhost:3400/api/perto/entregadores/Tiago" \
  -H "Content-Type: application/json" -d '{"lat": -25.3930, "lon": -51.4615}' | jq -c .
curl -s "http://localhost:3400/api/perto/entregadores?loja=LJ-CENTRO&raio_km=1" | jq -c '.entregadores'
```

```json
{"origem":"REDIS (GEOADD)","chave":"retrovault:geo:entregadores","entregador":"Tiago","nova_posicao":{"lat":-25.393,"lon":-51.4615}}
[{"nome":"Rafael","distancia_km":0.0602},{"nome":"Tiago","distancia_km":0.1644},{"nome":"Bianca","distancia_km":0.6053}]
```

Para voltar às posições iniciais: `docker exec nosql_app npm run seed:geo`.

> **O que observar:** atualizar a posição é um `GEOADD` em memória, sem tocar no MongoDB. Se o Redis cair, a rota responde `503` ("rastreamento indisponível"), e a busca de lojas continua funcionando.

---

## Resumo

- Separe o que **fica parado** (lojas: MongoDB, fonte da verdade) do que **se move** (motoboys: Redis).
- MongoDB: campo GeoJSON `{ type: "Point", coordinates: [lon, lat] }`, índice `2dsphere` e `$near` com `$maxDistance` em metros.
- Redis: `GEOADD` para gravar e atualizar, `GEOSEARCH ... ASC WITHDIST` para buscar por raio.
- Localização é dado pessoal (LGPD): a posição do cliente é usada na consulta e descartada.

Detalhes e justificativas no [`CHECKPOINT_3.md`](CHECKPOINT_3.md), Seção 1.
