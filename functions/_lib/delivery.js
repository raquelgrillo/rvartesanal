// =====================================================================
// Regras de entrega.
//
// - Só entregamos em Niterói (RJ). Endereços de outra cidade são
//   recusados no servidor.
// - Taxa fixa de entrega (em centavos). Retirada não tem taxa.
//
// Depois isto pode evoluir para taxa por região (ex: Região Oceânica
// sem taxa, demais bairros com adicional).
// =====================================================================

export const DELIVERY_CITY = 'Niterói';
export const DELIVERY_FEE_CENTS = 1000; // R$ 10,00

// Normaliza a cidade para comparação (sem acentos, minúscula, sem espaços
// nas pontas) — assim "Niteroi", "NITERÓI", " niterói " são aceitos.
export function normalizeCity(value) {
  return String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase();
}

export function isDeliveryCityAllowed(city) {
  return normalizeCity(city) === normalizeCity(DELIVERY_CITY);
}
