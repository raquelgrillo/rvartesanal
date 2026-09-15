// =====================================================================
// GET /api/disponibilidade
//
// Retorna os próximos dias de entrega (sáb/dom/seg/ter), indicando para
// cada um:
//   - breadOpen: aceita pão (dentro do prazo de quinta 18h) e quantas
//     vagas de pão restam (só pedidos APROVADOS contam);
//   - sweetOpen: aceita doce (até 24h antes da entrega).
//
// O site decide o que oferecer conforme o carrinho:
//   - com pão  -> usa breadOpen + vagas;
//   - só doce  -> usa sweetOpen.
// =====================================================================

import { weekendInfo, formatDate, parseDate, WEEKEND_DAY_LABELS } from '../_lib/weekend.js';
import { breadByDay, computeRemaining } from '../_lib/capacity.js';
import { isBreadOrderOpen, isSweetDateOrderable, todaySaoPaulo, EVENT_MIN_DAYS } from '../_lib/deadlines.js';

// Gera os próximos dias de entrega (sáb/dom/seg/ter) a partir de hoje.
function upcomingDeliveryDays(now, weeksAhead = 6) {
  const days = [];
  const start = parseDate(todaySaoPaulo(now));
  for (let i = 0; i < weeksAhead * 7; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const iso = formatDate(d);
    const info = weekendInfo(iso);
    if (info) days.push({ iso, ...info });
  }
  return days;
}

export async function onRequestGet({ env, request }) {
  try {
    const now = new Date();
    const days = upcomingDeliveryDays(now);

    // Agrupa por bloco para consultar o banco uma vez por bloco.
    const blocks = new Map();
    for (const day of days) {
      if (!blocks.has(day.weekendKey)) blocks.set(day.weekendKey, []);
      blocks.get(day.weekendKey).push(day);
    }

    const result = [];
    for (const [weekendKey, blockDays] of blocks) {
      const breadOpen = isBreadOrderOpen(weekendKey, now);

      // Só consulta vagas se o bloco aceita pão.
      let remainingByDay = [0, 0, 0, 0];
      let remainingTotal = 0;
      if (breadOpen) {
        const byDay = await breadByDay(env.DB, weekendKey);
        const r = computeRemaining(byDay);
        remainingByDay = r.remainingByDay;
        remainingTotal = r.remainingTotal;
      }

      for (const day of blockDays) {
        const sweetOpen = isSweetDateOrderable(day.iso, now);
        // Inclui o dia se aceita pão OU doce.
        if (!breadOpen && !sweetOpen) continue;
        result.push({
          date: day.iso,
          weekendKey,
          weekendDay: day.weekendDay,
          label: WEEKEND_DAY_LABELS[day.weekendDay],
          breadOpen,
          sweetOpen,
          remaining: breadOpen ? remainingByDay[day.weekendDay] : 0,
          weekendRemaining: breadOpen ? remainingTotal : 0,
        });
      }
    }

    return Response.json({
      ok: true,
      today: todaySaoPaulo(now),
      eventMinDays: EVENT_MIN_DAYS,
      breadDays: result,
    });
  } catch (err) {
    return Response.json({ ok: false, erro: String(err) }, { status: 500 });
  }
}
