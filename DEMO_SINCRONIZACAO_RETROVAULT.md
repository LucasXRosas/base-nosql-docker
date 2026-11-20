# Roteiro de Demonstração Prática — Módulo 08: Integração entre Bancos e Sincronização (RetroVault)

Este roteiro mostra, no RetroVault, o que acontece quando o mesmo jogo está gravado em três bancos:

1. **Três cópias:** o mesmo jogo no MongoDB, no Redis e no ElasticSearch.
2. **Alteração sem sincronizar:** o MongoDB muda e as cópias ficam para trás.
3. **Reindexação total:** funciona, mas refaz o índice inteiro.
4. **Escrita sincronizada:** MongoDB, depois Redis, depois um documento no ElasticSearch.
5. **Falha e pendência:** o ElasticSearch não responde e a alteração fica registrada.
6. **Reprocessamento:** as pendências são copiadas de novo para o índice.

O código está em `app/src/controllers/jogos.controller.ts` e as rotas em `app/src/routes/jogos.routes.ts`.

---

## Preparação

```bash
./iniciar.sh
```

Os exemplos usam o jogo **God of War (PlayStation Hits)**, SKU `GAME-PS4-GOW-010` (R$ 89,90 na carga inicial). Os comandos usam `jq` para formatar a resposta; sem ele, basta remover o `| jq .`.

| Rota | O que faz |
| :--- | :--- |
| `GET /api/jogos/:sku` | Leitura com cache-aside (chave `retrovault:jogos:sku:<sku>`, TTL de 5 minutos) |
| `GET /api/jogos/:sku/comparar` | O mesmo jogo lido no MongoDB, no Redis e no ElasticSearch |
| `PATCH /api/jogos/:sku/sem-sincronizar` | Altera só o MongoDB |
| `PATCH /api/jogos/:sku/reindexando-tudo` | Altera o MongoDB e recria o índice inteiro |
| `PATCH /api/jogos/:sku` | Altera o MongoDB, apaga o cache e atualiza um documento do índice |
| `GET /api/jogos/sincronizacao/pendentes` | Pendências registradas no Redis (`retrovault:sync:pendentes`) |
| `POST /api/jogos/sincronizacao/reprocessar` | Copia as pendências para o índice |

---

## Experimento 1 — Um jogo, três cópias

```bash
curl -s "http://localhost:3400/api/jogos/GAME-PS4-GOW-010" | jq .origem
curl -s "http://localhost:3400/api/jogos/GAME-PS4-GOW-010" | jq .origem
curl -s "http://localhost:3400/api/jogos/GAME-PS4-GOW-010/comparar" | jq .
```

```
"MONGODB (CACHE MISS)"
"REDIS (CACHE HIT)"
```
```json
{
  "mongodb": "God of War (PlayStation Hits) · R$ 89.90",
  "redis": "God of War (PlayStation Hits) · R$ 89.90",
  "elasticsearch": "God of War (PlayStation Hits) · R$ 89.90"
}
```

> **O que observar:** a primeira leitura vem do MongoDB (`CACHE MISS`) e a segunda do Redis (`CACHE HIT`). O índice já tinha a cópia, criada pelo `./iniciar.sh`.

---

## Experimento 2 — Alterando só o MongoDB

```bash
curl -s -X PATCH "http://localhost:3400/api/jogos/GAME-PS4-GOW-010/sem-sincronizar" \
  -H "Content-Type: application/json" -d '{"preco": 109.90}' | jq .
curl -s "http://localhost:3400/api/jogos/GAME-PS4-GOW-010/comparar" | jq .
```

```json
{
  "mongodb": "God of War (PlayStation Hits) · R$ 109.90",
  "redis": "God of War (PlayStation Hits) · R$ 89.90",
  "elasticsearch": "God of War (PlayStation Hits) · R$ 89.90"
}
```

> **O que observar:** a fonte da verdade mudou; as duas cópias, não. O Redis só se corrige quando o TTL expirar. O ElasticSearch, só com reindexação. Um cliente veria R$ 89,90 na busca e pagaria R$ 109,90 no checkout.

Volte ao estado inicial antes do próximo experimento:

```bash
curl -s -X PATCH "http://localhost:3400/api/jogos/GAME-PS4-GOW-010" \
  -H "Content-Type: application/json" -d '{"preco": 89.90}' | jq .
```

---

## Experimento 3 — Reindexação total

```bash
curl -s -X PATCH "http://localhost:3400/api/jogos/GAME-PS4-GOW-010/reindexando-tudo" \
  -H "Content-Type: application/json" -d '{"preco": 99.90}' | jq .
```

```json
{
  "mongodb": "gravado",
  "documentos_indexados": 20,
  "redis": "invalidado",
  "aviso": "Reindexação total concluída (custo elevado: reindexou todos os itens para alterar apenas um)."
}
```

> **O que observar:** para refletir a alteração de **um** jogo, os 20 jogos do acervo foram reindexados. Com um catálogo de milhares de mídias, cada mudança de preço refaria o índice inteiro.

---

## Experimento 4 — Escrita sincronizada

```bash
curl -s "http://localhost:3400/api/jogos/GAME-PS4-GOW-010" > /dev/null   # recria o cache
curl -s -X PATCH "http://localhost:3400/api/jogos/GAME-PS4-GOW-010" \
  -H "Content-Type: application/json" -d '{"preco": 119.90}' | jq .
curl -s "http://localhost:3400/api/jogos/GAME-PS4-GOW-010/comparar" | jq .
```

```json
{
  "mongodb": "gravado",
  "redis": "invalidado",
  "elasticsearch": "atualizado (1 documento)"
}
```

```json
{
  "mongodb": "God of War (PlayStation Hits) · R$ 119.90",
  "redis": "(sem cópia)",
  "elasticsearch": "God of War (PlayStation Hits) · R$ 119.90"
}
```

A ordem dos passos no método `atualizarSincronizado`:

1. **MongoDB:** `findOneAndUpdate` grava e devolve o jogo já alterado.
2. **Redis:** apaga as chaves que dependem do jogo (`retrovault:jogos:sku:<sku>`, `retrovault:jogos:sku:<título>`, `retrovault:jogos:promocoes` e `retrovault:jogos:destaques`).
3. **ElasticSearch:** `index` com o `_id` do MongoDB substitui apenas aquele documento, com `refresh: true` para o preço novo aparecer na busca na mesma hora.

> **O que observar:** o Redis ficou sem cópia, e isso é o esperado: a próxima leitura busca o preço novo no MongoDB e recria o cache. Confira com `curl -s "http://localhost:3400/api/busca?q=god%20of%20war" | jq '.resultados[0]'`.

---

## Experimento 5 — Falha do ElasticSearch e pendência

O parâmetro `?simular_falha=elastic` lança um erro no lugar da chamada ao ElasticSearch. Uma falha real (`docker stop nosql_elasticsearch`) segue exatamente o mesmo caminho de código, detectada em até 1,5 s.

```bash
curl -s -X PATCH "http://localhost:3400/api/jogos/GAME-PS4-GOW-010?simular_falha=elastic" \
  -H "Content-Type: application/json" -d '{"preco": 89.90}' | jq .
curl -s "http://localhost:3400/api/jogos/GAME-PS4-GOW-010/comparar" | jq .
curl -s "http://localhost:3400/api/jogos/sincronizacao/pendentes" | jq '{total_pendentes, pendencias: [.pendencias[] | {sku, motivo}]}'
```

```json
{
  "mongodb": "gravado",
  "redis": "invalidado",
  "elasticsearch": "falhou (ElasticSearch fora do ar); pendência registrada",
  "motivo": "Falha simulada: ElasticSearch fora do ar (?simular_falha=elastic)",
  "chave_pendencias": "retrovault:sync:pendentes"
}
```
```json
{
  "mongodb": "God of War (PlayStation Hits) · R$ 89.90",
  "redis": "(sem cópia)",
  "elasticsearch": "God of War (PlayStation Hits) · R$ 119.90"
}
```

> **O que observar:** a resposta é `202 Accepted`. O MongoDB manteve o valor novo e o `_id` do jogo foi para a List `retrovault:sync:pendentes` (confira no Redis Commander, `http://localhost:8402`). A comparação mostra o índice com o preço antigo.

---

## Experimento 6 — Reprocessamento

```bash
curl -s -X POST "http://localhost:3400/api/jogos/sincronizacao/reprocessar" | jq .
curl -s "http://localhost:3400/api/jogos/GAME-PS4-GOW-010/comparar" | jq .
```

```json
{
  "reprocessados": 1,
  "jogos": ["God of War (PlayStation Hits)"],
  "falhas": [],
  "descartados": [],
  "pendentes_restantes": 0
}
```
```json
{
  "mongodb": "God of War (PlayStation Hits) · R$ 89.90",
  "redis": "(sem cópia)",
  "elasticsearch": "God of War (PlayStation Hits) · R$ 89.90"
}
```

> **O que observar:** o reprocessamento lê o jogo **atual** no MongoDB, e não o valor da hora da falha: se o preço mudou de novo, vai para o índice o mais recente. Cada pendência só sai da lista (`LREM`) depois de reindexada com sucesso; se o ElasticSearch continuar fora, ela aparece em `falhas` e permanece na fila. O jogo terminou com o preço da carga inicial (R$ 89,90).

---

## Resumo

- Cada dado tem **um** banco com a palavra final (MongoDB) e cópias (Redis e ElasticSearch).
- Toda escrita segue a ordem: MongoDB, invalidar o cache, atualizar só o documento alterado no índice.
- Se o índice falhar, o MongoDB não é desfeito: a alteração vira pendência e é reprocessada depois.

O documento completo do projeto está em [`CHECKPOINT_2.md`](CHECKPOINT_2.md).
