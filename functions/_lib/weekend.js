// =====================================================================
// Utilidades de data para os "blocos de fim de semana" dos pães.
//
// Um bloco é ancorado no SÁBADO. Dado sáb/dom/seg/ter, achamos o sábado
// daquele bloco e usamos "YYYY-MM-DD" desse sábado como weekend_key.
//
// weekend_day dentro do bloco: sáb=0, dom=1, seg=2, ter=3.
// Dias fora desse intervalo (qua/qui/sex) não são dias de pão.
//
// IMPORTANTE: trabalhamos com datas "puras" (só ano-mês-dia), sem fuso,
// para evitar que o horário/UTC empurre a data para o dia errado.
// =====================================================================

// getUTCDay(): domingo=0, segunda=1, ..., sábado=6.
// Mapeamos para o índice do bloco (sáb=0, dom=1, seg=2, ter=3) ou null.
const DOW_TO_WEEKEND_DAY = {
  6: 0, // sábado
  0: 1, // domingo
  1: 2, // segunda
  2: 3, // terça
};

// Rótulos legíveis para exibir na tela e no admin.
export const WEEKEND_DAY_LABELS = ['Sábado', 'Domingo', 'Segunda', 'Terça'];

// Capacidade acumulada de pães por degrau do bloco:
//   até sáb = 6, até dom = 12, até seg/ter = 18.
// index = weekend_day (0..3) -> teto acumulado até aquele dia (inclusive).
export const CUMULATIVE_CAP = [6, 12, 18, 18];
export const WEEKEND_TOTAL_CAP = 18;

// Constrói um Date em UTC a partir de "YYYY-MM-DD" (data pura, sem fuso).
export function parseDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// Formata um Date (UTC) de volta para "YYYY-MM-DD".
export function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

// É um dia válido de pão (sáb/dom/seg/ter)?
export function isBreadDay(isoDate) {
  const dow = parseDate(isoDate).getUTCDay();
  return dow in DOW_TO_WEEKEND_DAY;
}

// Dado um dia de pão, retorna { weekendKey, weekendDay } ou null se não for
// um dia de pão. weekendKey é a data (YYYY-MM-DD) do sábado do bloco.
export function weekendInfo(isoDate) {
  const date = parseDate(isoDate);
  const dow = date.getUTCDay();
  if (!(dow in DOW_TO_WEEKEND_DAY)) return null;

  const weekendDay = DOW_TO_WEEKEND_DAY[dow];
  // Recuar até o sábado: sáb recua 0, dom recua 1, seg recua 2, ter recua 3.
  const saturday = new Date(date);
  saturday.setUTCDate(date.getUTCDate() - weekendDay);
  return { weekendKey: formatDate(saturday), weekendDay };
}
