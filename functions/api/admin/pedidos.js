// GET /api/admin/pedidos?status=pendente|aprovado|recusado|todos
// Lista pedidos para o painel, com seus itens. Para pedidos de pão,
// inclui a ocupação atual do bloco (aprovados por dia) para ajudar na
// decisão.
import { requireAdmin } from '../../_lib/auth.js';
import { breadByDay, computeRemaining } from '../../_lib/capacity.js';
import { WEEKEND_DAY_LABELS } from '../../_lib/weekend.js';

export async function onRequestGet({ env, request }) {
  let session;
  try {
    session = await requireAdmin(env, request);
  } catch (resp) {
    return resp;
  }

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'pendente';

  const where = status === 'todos' ? '' : 'WHERE o.status = ?1';
  const binds = status === 'todos' ? [] : [status];

  const orders = await env.DB
    .prepare(
      `SELECT o.* FROM orders o ${where} ORDER BY o.created_at DESC`
    )
    .bind(...binds)
    .all();

  const rows = orders.results ?? [];

  // Busca os itens de todos os pedidos listados.
  const byId = new Map();
  for (const o of rows) {
    o.items = [];
    byId.set(o.id, o);
  }
  if (rows.length) {
    const ids = rows.map(o => o.id);
    const placeholders = ids.map((_, i) => `?${i + 1}`).join(',');
    const items = await env.DB
      .prepare(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`)
      .bind(...ids)
      .all();
    for (const it of items.results ?? []) {
      byId.get(it.order_id)?.items.push(it);
    }
  }

  // Para blocos de pão presentes, calcula a ocupação (aprovados) por dia.
  const weekendKeys = [...new Set(rows.filter(o => o.weekend_key).map(o => o.weekend_key))];
  const blocks = {};
  for (const key of weekendKeys) {
    const day = await breadByDay(env.DB, key);
    const { remainingByDay, remainingTotal } = computeRemaining(day);
    blocks[key] = {
      approvedByDay: day,
      remainingByDay,
      remainingTotal,
      labels: WEEKEND_DAY_LABELS,
    };
  }

  return Response.json({ ok: true, admin: session.name, status, orders: rows, blocks });
}
