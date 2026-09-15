// POST /api/admin/logout — apaga o cookie de sessão.
import { sessionCookieHeader } from '../../_lib/auth.js';

export async function onRequestPost() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': sessionCookieHeader('', { clear: true }),
    },
  });
}
