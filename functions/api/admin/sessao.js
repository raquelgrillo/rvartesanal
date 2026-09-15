// GET /api/admin/sessao — diz quem está logado (ou 401 se ninguém).
// A página de admin usa isto ao carregar para decidir se mostra o login
// ou o painel.
import { requireAdmin } from '../../_lib/auth.js';

export async function onRequestGet({ env, request }) {
  try {
    const session = await requireAdmin(env, request);
    return Response.json({ ok: true, name: session.name });
  } catch (resp) {
    return resp; // requireAdmin lança uma Response 401
  }
}
