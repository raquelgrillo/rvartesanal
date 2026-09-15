// =====================================================================
// Regras de prazo (deadlines).
//
// - Pães: encomenda até QUINTA 18h para o bloco de fim de semana seguinte.
//   Depois da quinta 18h, o bloco daquela semana é fechado e só o próximo
//   fica disponível.
// - Evento personalizado: antecedência mínima de 14 dias.
//
// Tudo é calculado no fuso de São Paulo (America/Sao_Paulo, UTC-3),
// independentemente de onde o servidor Cloudflare rode.
// =====================================================================

import { parseDate, formatDate, weekendInfo } from './weekend.js';

// Offset fixo de São Paulo. O Brasil não usa mais horário de verão desde
// 2019, então UTC-3 é constante. Se isso mudar, ajustar aqui.
const SAO_PAULO_OFFSET_MIN = -180; // -3h em minutos

export const EVENT_MIN_DAYS = 14;

// Retorna "agora" como um Date deslocado para o horário de São Paulo,
// para podermos ler getUTCDay()/getUTCHours() como se fosse hora local.
export function nowInSaoPaulo(now = new Date()) {
  return new Date(now.getTime() + SAO_PAULO_OFFSET_MIN * 60 * 1000);
}

// Data de hoje (YYYY-MM-DD) no fuso de São Paulo.
export function todaySaoPaulo(now = new Date()) {
  return formatDate(nowInSaoPaulo(now));
}

// A encomenda de pão para o bloco `weekendKey` (sábado) ainda está aberta?
// Aberta enquanto AGORA <= quinta 18h imediatamente anterior ao sábado.
// A quinta anterior ao sábado é sábado - 2 dias.
export function isBreadOrderOpen(weekendKey, now = new Date()) {
  const saturday = parseDate(weekendKey);
  const thursday = new Date(saturday);
  thursday.setUTCDate(saturday.getUTCDate() - 2); // quinta anterior
  // Deadline = quinta 18:00 no horário de São Paulo, convertido para UTC.
  // 18h em SP = 21h UTC.
  const deadlineUtc = new Date(Date.UTC(
    thursday.getUTCFullYear(),
    thursday.getUTCMonth(),
    thursday.getUTCDate(),
    21, 0, 0
  ));
  return now.getTime() <= deadlineUtc.getTime();
}

// Uma data de entrega de pão é válida para pedir AGORA?
// Precisa ser dia de pão E estar dentro do prazo do seu bloco.
export function isBreadDateOrderable(isoDate, now = new Date()) {
  const info = weekendInfo(isoDate);
  if (!info) return false;
  if (isoDate < todaySaoPaulo(now)) return false; // data no passado
  return isBreadOrderOpen(info.weekendKey, now);
}

// Doces (cookie, palha): podem ser pedidos até 24h antes da entrega.
// Consideramos a entrega no início do dia (00h em São Paulo = 03h UTC) e
// exigimos que agora + 24h ainda alcance esse instante.
export function isSweetDateOrderable(isoDate, now = new Date()) {
  if (isoDate < todaySaoPaulo(now)) return false; // data no passado
  const date = parseDate(isoDate);
  const startOfDayUtc = new Date(Date.UTC(
    date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 3, 0, 0
  )); // 00h SP
  return now.getTime() + 24 * 60 * 60 * 1000 <= startOfDayUtc.getTime();
}

// Uma data de evento respeita a antecedência mínima?
export function isEventDateOk(isoDate, now = new Date()) {
  const today = parseDate(todaySaoPaulo(now));
  const target = parseDate(isoDate);
  const diffDays = Math.round((target - today) / (24 * 60 * 60 * 1000));
  return diffDays >= EVENT_MIN_DAYS;
}
