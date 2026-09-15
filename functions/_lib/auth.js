// =====================================================================
// Autenticação simples do admin.
//
// Usuários e senhas vêm de variáveis de ambiente (nunca do código):
//   ADMIN_RAQUEL   = senha da Raquel
//   ADMIN_RICARDO  = senha do Ricardo
//   SESSION_SECRET = segredo usado para assinar o token de sessão
//
// Ao logar, geramos um token assinado (HMAC) com o nome do usuário e a
// validade. O token é guardado num cookie HttpOnly. Cada requisição do
// admin valida esse token antes de agir.
// =====================================================================

const COOKIE_NAME = 'rv_admin';
const SESSION_HOURS = 12;
const encoder = new TextEncoder();

// Mapeia o identificador de usuário para o nome da variável de ambiente.
const USERS = {
  raquel: 'ADMIN_RAQUEL',
  ricardo: 'ADMIN_RICARDO',
};

// Comparação de strings em tempo constante (evita timing attacks).
function safeEqual(a, b) {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

// Base64url sem padding (seguro para cookies/URLs).
function b64url(bytes) {
  let str = '';
  const arr = new Uint8Array(bytes);
  for (const b of arr) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return b64url(sig);
}

// Confere usuário + senha contra as variáveis de ambiente.
// Retorna o nome canônico (ex: 'Raquel') ou null.
export function checkCredentials(env, user, password) {
  const key = USERS[String(user ?? '').toLowerCase()];
  if (!key) return null;
  const expected = env[key];
  if (!expected || !password) return null;
  if (!safeEqual(String(password), String(expected))) return null;
  return String(user).charAt(0).toUpperCase() + String(user).slice(1).toLowerCase();
}

// Cria um token assinado: payload em base64url + assinatura HMAC.
export async function createSession(env, name) {
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  const payload = b64url(encoder.encode(JSON.stringify({ name, exp })));
  const sig = await hmac(env.SESSION_SECRET, payload);
  return `${payload}.${sig}`;
}

// Valida o token; retorna { name } se válido e não expirado, senão null.
export async function verifySession(env, token) {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = await hmac(env.SESSION_SECRET, payload);
  if (!safeEqual(sig, expected)) return null;
  try {
    const json = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    );
    if (typeof json.exp !== 'number' || Date.now() > json.exp) return null;
    return { name: json.name };
  } catch {
    return null;
  }
}

// Lê o cookie de sessão do request.
export function readSessionCookie(request) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// Monta o cabeçalho Set-Cookie para logar ou deslogar.
export function sessionCookieHeader(token, { clear = false } = {}) {
  const maxAge = clear ? 0 : SESSION_HOURS * 3600;
  const value = clear ? '' : encodeURIComponent(token);
  return `${COOKIE_NAME}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

// Guarda de rota: retorna { name } ou lança uma Response 401.
export async function requireAdmin(env, request) {
  const token = readSessionCookie(request);
  const session = await verifySession(env, token);
  if (!session) {
    throw Response.json({ ok: false, erro: 'Não autenticado.' }, { status: 401 });
  }
  return session;
}
