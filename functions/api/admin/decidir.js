// POST /api/admin/decidir  { orderId, decision: 'aprovado'|'recusado' }
//
// Aprova ou recusa um pedido. Ao APROVAR um pedido de pão, revalida a
// capacidade do bloco NAQUELE momento (outros pedidos podem ter sido
// aprovados no meio-tempo). Se não couber mais, a aprovação é bloqueada.
import { requireAdmin } from '../../_lib/auth.js';
import { breadByDay, canAddBread } from '../../_lib/capacity.js';

export async function onRequestPost({ env, request }) {
  let session;
  try {
    session = await requireAdmin(env, request);
  } catch (resp) {
    return resp;
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, erro: 'Dados inválidos.' }, { status: 400 });
  }

  const orderId = Number(body.orderId);
  const decision = body.decision;
  if (!Number.isInteger(orderId) || !['aprovado', 'recusado'].includes(decision)) {
    return Response.json({ ok: false, erro: 'Parâmetros inválidos.' }, { status: 400 });
  }

  const order = await env.DB
    .prepare('SELECT * FROM orders WHERE id = ?1')
    .bind(orderId)
    .first();
  if (!order) {
    return Response.json({ ok: false, erro: 'Pedido não encontrado.' }, { status: 404 });
  }
  if (order.status !== 'pendente') {
    return Response.json(
      { ok: false, erro: `Pedido já está "${order.status}".` },
      { status: 409 }
    );
  }

  // Ao aprovar pão, revalida capacidade contra os já aprovados.
  if (decision === 'aprovado' && order.bread_qty > 0 && order.weekend_key) {
    const byDay = await breadByDay(env.DB, order.weekend_key);
    const check = canAddBread(byDay, order.weekend_day, order.bread_qty);
    if (!check.ok) {
      return Response.json(
        { ok: false, erro: `Não é possível aprovar: ${check.reason}` },
        { status: 409 }
      );
    }
  }

  await env.DB
    .prepare(
      `UPDATE orders SET status = ?1, decided_at = datetime('now') WHERE id = ?2 AND status = 'pendente'`
    )
    .bind(decision, orderId)
    .run();

  return Response.json({ ok: true, orderId, status: decision, by: session.name });
}
