// POST /api/admin/login  { user, password }
// Confere as credenciais e, se corretas, devolve um cookie de sessão.
import { checkCredentials, createSession, sessionCookieHeader } from '../../_lib/auth.js';

export async function onRequestPost({ env, request }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, erro: 'Dados inválidos.' }, { status: 400 });
  }

  const name = checkCredentials(env, body.user, body.password);
  if (!name) {
    return Response.json({ ok: false, erro: 'Usuário ou senha incorretos.' }, { status: 401 });
  }

  const token = await createSession(env, name);
  return new Response(JSON.stringify({ ok: true, name }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': sessionCookieHeader(token),
    },
  });
}
