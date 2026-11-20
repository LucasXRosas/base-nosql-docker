/**
 * Checkpoint 3 (Módulo 10) — desiste de uma operação que demora mais do que o limite.
 *
 * Os timeouts dos próprios drivers não cobrem tudo: com um container parado, só a
 * resolução de DNS do nome do serviço (ex.: "elasticsearch") leva alguns segundos
 * até falhar com ENOTFOUND. O Promise.race garante um teto para a rota inteira.
 */
export function comLimite<T>(operacao: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const limite = new Promise<never>((_, rejeitar) => {
    timer = setTimeout(() => rejeitar(new Error(`sem resposta em ${ms} ms`)), ms);
  });
  // Evita "unhandled rejection" se a operação original falhar depois do limite
  operacao.catch(() => {});
  return Promise.race([operacao, limite]).finally(() => clearTimeout(timer));
}
