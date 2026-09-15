// =====================================================================
// Catálogo oficial (fonte da verdade dos preços, no servidor).
// O navegador manda só o id e a quantidade; o preço é sempre resolvido
// aqui, para o cliente não conseguir forjar valores.
//
// Preços em centavos. 'bread' é o pão artesanal (sourdough) e é o único
// produto sujeito ao limite de fim de semana.
// =====================================================================

export const CATALOG = {
  'bread':          { id: 'bread',          name: 'Pão Artesanal',                       detail: 'Unidade', price: 2000, isBread: true },
  'cookie-amargo':  { id: 'cookie-amargo',  name: 'Cookie de Chocolate Amargo',          detail: 'Unidade', price: 700,  isBread: false },
  'cookie-meio':    { id: 'cookie-meio',    name: 'Cookie de Chocolate Meio Amargo',     detail: 'Unidade', price: 700,  isBread: false },
  'cookie-branco':  { id: 'cookie-branco',  name: 'Cookie de Chocolate Branco',          detail: 'Unidade', price: 700,  isBread: false },
  'cookie-morango': { id: 'cookie-morango', name: 'Cookie Branco com Geleia de Morango', detail: 'Unidade', price: 1000, isBread: false },
  'cookie-nutella': { id: 'cookie-nutella', name: 'Cookie Amargo com Nutella e Missô',   detail: 'Unidade', price: 1000, isBread: false },
  'palha':          { id: 'palha',          name: 'Palha Italiana',                      detail: 'Unidade', price: 700,  isBread: false },
};

export function getProduct(id) {
  return CATALOG[id] ?? null;
}
