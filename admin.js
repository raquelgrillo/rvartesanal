// =====================================================================
// Painel de pedidos (admin). Conversa com /api/admin/*.
// =====================================================================
const $ = s => document.querySelector(s);
const money = c => c == null ? 'Sob consulta'
  : (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const loginForm = $('#login-form');
const panel = $('#panel');
const topbar = $('#topbar');
let currentStatus = 'pendente';

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let data;
  try { data = await res.json(); } catch { data = {}; }
  return { status: res.status, data };
}

// Alterna entre login e painel conforme a sessão.
function showLoggedIn(name) {
  loginForm.hidden = true;
  panel.hidden = false;
  topbar.hidden = false;
  $('#who').textContent = name;
  loadOrders();
}
function showLogin() {
  loginForm.hidden = false;
  panel.hidden = true;
  topbar.hidden = true;
}

// Checa sessão ao abrir a página.
(async () => {
  const { status, data } = await api('/api/admin/sessao');
  if (status === 200 && data.ok) showLoggedIn(data.name);
  else showLogin();
})();

// Login
loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  $('#login-error').hidden = true;
  const { status, data } = await api('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ user: $('#user').value, password: $('#password').value }),
  });
  if (status === 200 && data.ok) {
    $('#password').value = '';
    showLoggedIn(data.name);
  } else {
    $('#login-error').textContent = data.erro || 'Não foi possível entrar.';
    $('#login-error').hidden = false;
  }
});

// Logout
$('#logout').addEventListener('click', async () => {
  await api('/api/admin/logout', { method: 'POST' });
  showLogin();
});

// Abas
document.querySelectorAll('.tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach(b =>
      b.setAttribute('aria-selected', String(b === btn)));
    currentStatus = btn.dataset.status;
    loadOrders();
  });
});

function fmtDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// Renderiza um cartão de pedido.
function renderOrder(o, blocks) {
  const card = document.createElement('div');
  card.className = 'card';

  const head = document.createElement('div');
  head.innerHTML = `<h3></h3>`;
  head.querySelector('h3').textContent = `#${o.id} — ${o.customer_name}`;
  const badge = document.createElement('span');
  badge.className = `badge ${o.status}`;
  badge.textContent = o.status;
  head.querySelector('h3').append(' ', badge);
  card.append(head);

  const meta = document.createElement('p');
  meta.className = 'muted';
  const parts = [`WhatsApp: ${o.customer_phone}`];
  if (o.fulfillment === 'delivery') {
    let addr = 'Entrega';
    try {
      const a = JSON.parse(o.address_json || '{}');
      addr = `Entrega: ${a.street}, ${a.number} — ${a.neighborhood}, ${a.city}${a.complement ? ' • ' + a.complement : ''}`;
    } catch {}
    parts.push(addr);
  } else {
    parts.push('Retirada');
  }
  if (o.delivery_date) parts.push(`Data: ${fmtDate(o.delivery_date)}`);
  if (o.payment) parts.push(`Pagamento: ${o.payment}`);
  meta.textContent = parts.join(' · ');
  card.append(meta);

  // Itens
  const ul = document.createElement('ul');
  ul.className = 'items';
  for (const it of o.items || []) {
    const li = document.createElement('li');
    li.textContent = `${it.qty}× ${it.product_name} — ${money(it.price_cents)}`;
    ul.append(li);
  }
  card.append(ul);

  if (o.is_event) {
    const ev = document.createElement('p');
    ev.className = 'muted';
    ev.textContent = `Pedido para evento: ${o.event_details || '(sem detalhes)'}`;
    card.append(ev);
  }
  if (o.notes) {
    const n = document.createElement('p');
    n.className = 'muted';
    n.textContent = `Observações: ${o.notes}`;
    card.append(n);
  }

  const total = document.createElement('p');
  const feePart = o.delivery_fee_cents
    ? `<span class="muted"> (inclui entrega ${money(o.delivery_fee_cents)})</span>`
    : '';
  total.innerHTML = `<strong>Total: ${money(o.total_cents)}</strong>${feePart}`;
  card.append(total);

  // Ocupação do bloco (para pedidos de pão)
  if (o.weekend_key && blocks[o.weekend_key]) {
    const b = blocks[o.weekend_key];
    const cap = document.createElement('div');
    cap.className = 'cap';
    const linhas = b.labels.map((label, i) =>
      `${label}: ${b.approvedByDay[i]} aprovados`).join(' · ');
    cap.textContent = `Bloco (sáb ${fmtDate(o.weekend_key)}): ${linhas}. Restam ${b.remainingTotal}/18 no fim de semana.`;
    card.append(cap);
  }

  // Ações (só para pendentes)
  if (o.status === 'pendente') {
    const actions = document.createElement('div');
    actions.className = 'actions';
    const approve = document.createElement('button');
    approve.className = 'approve';
    approve.textContent = 'Aprovar';
    const reject = document.createElement('button');
    reject.className = 'reject';
    reject.textContent = 'Recusar';
    approve.addEventListener('click', () => decide(o.id, 'aprovado', actions));
    reject.addEventListener('click', () => decide(o.id, 'recusado', actions));
    actions.append(approve, reject);
    card.append(actions);
  }

  return card;
}

async function decide(orderId, decision, actionsEl) {
  actionsEl.querySelectorAll('button').forEach(b => (b.disabled = true));
  const { status, data } = await api('/api/admin/decidir', {
    method: 'POST',
    body: JSON.stringify({ orderId, decision }),
  });
  if (status === 200 && data.ok) {
    loadOrders();
  } else {
    const err = document.createElement('p');
    err.className = 'error';
    err.textContent = data.erro || 'Não foi possível decidir.';
    actionsEl.after(err);
    actionsEl.querySelectorAll('button').forEach(b => (b.disabled = false));
  }
}

async function loadOrders() {
  const list = $('#list');
  list.innerHTML = '<p class="empty">Carregando…</p>';
  const { status, data } = await api(`/api/admin/pedidos?status=${currentStatus}`);
  if (status === 401) { showLogin(); return; }
  if (!data.ok) { list.innerHTML = `<p class="error">${data.erro || 'Erro ao carregar.'}</p>`; return; }

  list.innerHTML = '';
  if (!data.orders.length) {
    list.innerHTML = '<p class="empty">Nenhum pedido aqui.</p>';
    return;
  }
  for (const o of data.orders) list.append(renderOrder(o, data.blocks));
}
