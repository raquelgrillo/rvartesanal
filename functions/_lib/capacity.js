// =====================================================================
// Regra de capacidade acumulada de pães por bloco de fim de semana.
//
// Só contam pedidos APROVADOS. A checagem é por "degrau":
//   entregas até sáb        <= 6
//   entregas até dom        <= 12
//   entregas até seg+ter    <= 18
//
// Modelamos isso como: para cada dia d (0..3), a soma dos pães dos dias
// [0..d] não pode passar de CUMULATIVE_CAP[d].
// =====================================================================

import { CUMULATIVE_CAP, WEEKEND_TOTAL_CAP } from './weekend.js';

// Lê do banco quantos pães APROVADOS existem em cada dia de um bloco.
// Retorna um array [sab, dom, seg, ter] com as quantidades.
export async function breadByDay(db, weekendKey) {
  const rows = await db
    .prepare(
      `SELECT weekend_day AS day, COALESCE(SUM(bread_qty), 0) AS qty
         FROM orders
        WHERE weekend_key = ?1 AND status = 'aprovado' AND bread_qty > 0
        GROUP BY weekend_day`
    )
    .bind(weekendKey)
    .all();

  const byDay = [0, 0, 0, 0];
  for (const row of rows.results ?? []) {
    if (row.day >= 0 && row.day <= 3) byDay[row.day] = Number(row.qty);
  }
  return byDay;
}

// Dado o array por dia já aprovado, calcula quanto ainda cabe para ENTREGAR
// em cada dia, respeitando todos os degraus acumulados.
// Retorna { byDay, remainingByDay, remainingTotal }.
export function computeRemaining(byDay) {
  const remainingByDay = [0, 0, 0, 0];
  // Para cada dia, o quanto cabe é limitado por TODOS os degraus a partir
  // dele: adicionar 1 pão no dia d afeta os acumulados de d, d+1, d+2, d+3.
  for (let d = 0; d < 4; d++) {
    let allowed = Infinity;
    for (let step = d; step < 4; step++) {
      const usedUpToStep = byDay
        .slice(0, step + 1)
        .reduce((a, b) => a + b, 0);
      allowed = Math.min(allowed, CUMULATIVE_CAP[step] - usedUpToStep);
    }
    remainingByDay[d] = Math.max(0, allowed);
  }
  const usedTotal = byDay.reduce((a, b) => a + b, 0);
  const remainingTotal = Math.max(0, WEEKEND_TOTAL_CAP - usedTotal);
  return { byDay, remainingByDay, remainingTotal };
}

// Verifica se dá para adicionar `qty` pães no dia `weekendDay`, considerando
// o que já está aprovado. Retorna { ok, reason, remainingByDay }.
export function canAddBread(byDay, weekendDay, qty) {
  const { remainingByDay } = computeRemaining(byDay);
  if (qty > remainingByDay[weekendDay]) {
    return {
      ok: false,
      reason: `Só cabem mais ${remainingByDay[weekendDay]} pães nesse dia.`,
      remainingByDay,
    };
  }
  return { ok: true, remainingByDay };
}
