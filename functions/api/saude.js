// Endpoint de verificação: confirma que a Function roda e que o D1 responde.
// Acesse em /api/saude. Retorna a contagem de pedidos no banco.
export async function onRequestGet({ env }) {
  try {
    const row = await env.DB
      .prepare('SELECT COUNT(*) AS total FROM orders')
      .first();
    return Response.json({
      ok: true,
      pedidos: row?.total ?? 0,
      mensagem: 'Functions e D1 conectados.',
    });
  } catch (err) {
    return Response.json(
      { ok: false, erro: String(err) },
      { status: 500 }
    );
  }
}
