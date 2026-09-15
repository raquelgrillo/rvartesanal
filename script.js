/* =======================================================================
   RV Artesanal — comportamento
   Índice:
     1. Catálogo de produtos e utilitários
     2. Navegação por etapas (checkout)
     3. Carrinho: total e linha de produto
     4. Renderização da lista de produtos
     5. Resumo do pedido (sidebar)
     6. Filtros de categoria
     7. Modalidade de entrega
     8. Envio: monta a mensagem e abre o WhatsApp
     9. Mural / carrossel de fotos
   ======================================================================= */

/* 1. Catálogo de produtos e utilitários --------------------------------- */
// Preços em centavos. null = sob consulta; substitua pelos valores reais.
// Ajuste a unidade de venda de cada produto conforme o catálogo da confeitaria.
const products = [
  { id: 'bread',          category: 'bread', name: 'Pão Artesanal',                       detail: 'Unidade', desc: 'Fermentação natural e longa maturação. Casca rústica e crocante, miolo alveolado e macio.',                    price: 2000, icon: '🥖', image: 'assets/pao.jpeg' },
  { id: 'cookie-amargo',  category: 'sweet', name: 'Cookie de Chocolate Amargo',          detail: 'Unidade', desc: 'Chocolate 70% de cacau. Profundo, marcante e pouco doce, para verdadeiros apreciadores.',                       price: 700,  icon: '🍪', image: 'assets/cookie_amargo.jpeg' },
  { id: 'cookie-meio',    category: 'sweet', name: 'Cookie de Chocolate Meio Amargo',     detail: 'Unidade', desc: 'Chocolate meio amargo finalizado com flor de sal, que realça o cacau e equilibra o dulçor. Nosso clássico.',    price: 700,  icon: '🍪', image: 'assets/cookie.jpeg' },
  { id: 'cookie-branco',  category: 'sweet', name: 'Cookie de Chocolate Branco',          detail: 'Unidade', desc: 'Delicado e amanteigado, com generosos pedaços de chocolate branco que derretem na boca.',                     price: 700,  icon: '🍪', image: 'assets/cookie_branco.jpeg' },
  { id: 'cookie-morango', category: 'sweet', name: 'Cookie Branco com Geleia de Morango', detail: 'Unidade', desc: 'Cookie de chocolate branco recheado com geleia de morango feita na casa. Doce, frutado e irresistível.',        price: 1000, icon: '🍪', image: 'assets/cookie_branco_recheado.jpeg' },
  { id: 'cookie-nutella', category: 'sweet', name: 'Cookie Amargo com Nutella e Missô',   detail: 'Unidade', desc: 'Criação do chef: chocolate amargo recheado de nutella, com um toque de missô que realça tudo. Ousado e viciante.', price: 1000, icon: '🍪', image: 'assets/cookie_nutella.jpeg' },
  { id: 'palha',          category: 'sweet', name: 'Palha Italiana',                      detail: 'Unidade', desc: 'Brigadeiro belga cremoso com biscoito amanteigado. Textura na medida, sabor de infância.',                    price: 700,  icon: '🍬', image: 'assets/palha-italiana.jpeg' },
];

// Taxa fixa de entrega (em centavos). Deve refletir functions/_lib/delivery.js.
const DELIVERY_FEE_CENTS = 1000; // R$ 10,00

const cart = new Map();
const $ = s => document.querySelector(s);
const money = cents => cents === null
  ? 'Sob consulta'
  : (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const form = $('#order-form');

/* 1b. Disponibilidade de pães (vinda da API) ---------------------------- */
// breadDays: [{ date, label, remaining, weekendRemaining, ... }]
let availability = { breadDays: [], eventMinDays: 14 };
const breadDaysByDate = new Map();

// Quantos pães estão no carrinho agora (só produtos isBread do catálogo).
function breadInCart() {
  return products
    .filter(p => p.category === 'bread')
    .reduce((sum, p) => sum + (cart.get(p.id) || 0), 0);
}

// Qualquer item no carrinho? (doces também entregam nos dias de pão)
function anyInCart() {
  return products.some(p => (cart.get(p.id) || 0) > 0);
}

async function loadAvailability() {
  try {
    const res = await fetch('/api/disponibilidade');
    const data = await res.json();
    if (data.ok) {
      availability = data;
      breadDaysByDate.clear();
      for (const d of data.breadDays) breadDaysByDate.set(d.date, d);
    }
  } catch {
    // Sem API (ex: abrir o arquivo direto), o site segue funcionando;
    // a validação final fica por conta do WhatsApp.
  }
  renderCalendar();
}

/* Calendário de entrega ------------------------------------------------- */
let calMonth = null; // {year, month} do mês exibido
const DOW_LABELS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

// Uma data é escolhível? Depende do que há no carrinho:
//   - com pão: o dia precisa aceitar pão e comportar a quantidade;
//   - só doce: o dia precisa aceitar doce (prazo de 24h).
function isDateSelectable(iso) {
  const day = breadDaysByDate.get(iso);
  if (!day) return false;
  const needed = breadInCart();
  if (needed > 0) {
    return day.breadOpen && day.remaining >= needed;
  }
  return day.sweetOpen; // só doces
}

// Meses que têm ao menos um dia de entrega, para navegação.
function availableMonths() {
  const set = new Set();
  for (const d of availability.breadDays) set.add(d.date.slice(0, 7)); // YYYY-MM
  return [...set].sort();
}

function renderCalendar() {
  const grid = $('#cal-grid');
  if (!grid) return;

  const months = availableMonths();
  if (!months.length) {
    grid.replaceChildren();
    $('#cal-title').textContent = 'Sem datas disponíveis';
    return;
  }
  // Mês inicial: o do dia selecionado, ou o primeiro com vaga.
  if (!calMonth) {
    const first = months[0].split('-');
    calMonth = { year: +first[0], month: +first[1] - 1 };
  }

  const y = calMonth.year, m = calMonth.month;
  const monthName = new Date(Date.UTC(y, m, 1))
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  $('#cal-title').textContent = monthName;

  // Navegação: habilita setas se houver mês com vaga antes/depois.
  const cur = `${y}-${String(m + 1).padStart(2, '0')}`;
  $('#cal-prev').disabled = !months.some(mo => mo < cur);
  $('#cal-next').disabled = !months.some(mo => mo > cur);

  grid.replaceChildren();
  for (const label of DOW_LABELS) {
    const head = document.createElement('div');
    head.className = 'cal-dow';
    head.textContent = label;
    grid.append(head);
  }

  const firstDow = new Date(Date.UTC(y, m, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  for (let i = 0; i < firstDow; i++) {
    const blank = document.createElement('div');
    blank.className = 'cal-day empty';
    grid.append(blank);
  }
  const selected = $('#delivery-date').value;
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cal-day';
    cell.textContent = d;
    const selectable = isDateSelectable(iso);
    const isDeliveryDay = breadDaysByDate.has(iso);
    if (selectable) {
      cell.classList.add('available');
      if (iso === selected) cell.classList.add('selected');
      cell.setAttribute('aria-label', `Escolher ${d}`);
      cell.addEventListener('click', () => selectDate(iso));
    } else {
      cell.classList.add('disabled');
      cell.disabled = true;
      if (isDeliveryDay) cell.title = 'Sem vaga de pão para essa quantidade';
    }
    grid.append(cell);
  }
}

function selectDate(iso) {
  $('#delivery-date').value = iso;
  const day = breadDaysByDate.get(iso);
  const [y, m, d] = iso.split('-');
  $('#date-trigger-label').textContent = day
    ? `${day.label}, ${d}/${m}/${y}`
    : `${d}/${m}/${y}`;
  renderCalendar();
  showDateInfo(iso);
  closeCalendar();
}

function openCalendar() {
  if (!anyInCart()) return;
  renderCalendar();
  $('#calendar-pop').hidden = false;
  $('#date-trigger').setAttribute('aria-expanded', 'true');
}
function closeCalendar() {
  $('#calendar-pop').hidden = true;
  $('#date-trigger').setAttribute('aria-expanded', 'false');
}
function toggleCalendar() {
  $('#calendar-pop').hidden ? openCalendar() : closeCalendar();
}

// Quadradinho ao lado com a info do dia escolhido.
function showDateInfo(iso) {
  const box = $('#date-info');
  const day = breadDaysByDate.get(iso);
  if (!iso || !day) { box.hidden = true; return; }
  const [yy, mm, dd] = iso.split('-');
  box.replaceChildren();

  if (breadInCart() > 0) {
    const badge = document.createElement('div');
    badge.className = 'badge-qty';
    badge.innerHTML = `<b>${day.remaining}</b>`;
    box.append(badge);
  }
  const text = document.createElement('div');
  text.className = 'info-text';
  const dayLine = document.createElement('span');
  dayLine.className = 'info-day';
  dayLine.textContent = `${day.label}, ${dd}/${mm}`;
  text.append(dayLine);
  text.append(
    breadInCart() > 0
      ? `${day.remaining} pães ainda podem ser encomendados nesse dia.`
      : 'Entrega disponível neste dia.'
  );
  box.append(text);
  box.hidden = false;
}

/* 2. Navegação por etapas (checkout) ------------------------------------ */
const steps = [...document.querySelectorAll('.checkout-step')];
let currentStep = 0;

function showStep(index, focus = true) {
  currentStep = index;
  steps.forEach((step, i) => { step.hidden = i !== index; });
  document.querySelectorAll('.checkout-progress span').forEach((label, i) => {
    if (i === index) label.setAttribute('aria-current', 'step');
    else label.removeAttribute('aria-current');
  });
  $('#previous').hidden = index === 0;
  $('#continue').textContent = index === steps.length - 1 ? 'Revisar pedido →' : 'Continuar →';
  if (focus) {
    const title = steps[index].querySelector('h2');
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
    document.querySelector('.checkout-progress').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
}

function validateStep(index) {
  if (index === 0 && !products.some(p => cart.get(p.id) > 0)) {
    showStep(0, false);
    $('#cart-error').hidden = false;
    const add = [...document.querySelectorAll('#products button[data-change="1"]')]
      .find(button => !button.closest('.product').hidden);
    if (add) add.focus();
    return false;
  }
  for (const field of steps[index].querySelectorAll('input,select,textarea')) {
    if (field.willValidate && !field.checkValidity()) {
      showStep(index, false);
      field.reportValidity();
      return false;
    }
  }
  return true;
}

$('#previous').addEventListener('click', () => showStep(Math.max(0, currentStep - 1)));
showStep(0, false);

/* 3. Carrinho: total e linha de produto ---------------------------------- */
function total() {
  if (products.some(p => cart.get(p.id) && p.price === null)) return null;
  return products.reduce((sum, p) => sum + p.price * (cart.get(p.id) || 0), 0);
}
function lineTotal(p, qty) {
  return p.price === null ? null : p.price * qty;
}

/* 4. Renderização da lista de produtos ------------------------------------*/
for (const p of products) {
  const row = document.createElement('article');
  row.className = 'product';
  row.dataset.category = p.category;
  row.innerHTML = `<span class="product-icon" aria-hidden="true"></span><div class="product-info"><h3></h3><p class="product-desc"></p><strong class="price"></strong> <span class="muted fine unit"></span></div><div class="counter"><button type="button" data-change="-1">−</button><output>0</output><button type="button" data-change="1">+</button></div>`;

  row.querySelector('.product-icon').textContent = p.icon;
  if (p.image) {
    const photo = document.createElement('img');
    photo.src = p.image;
    photo.alt = p.name;
    photo.loading = 'lazy';
    photo.width = 80;
    photo.height = 80;
    photo.addEventListener('error', () => {
      const fallback = document.createElement('span');
      fallback.className = 'product-icon';
      fallback.textContent = p.icon;
      photo.replaceWith(fallback);
    });
    row.querySelector('.product-icon').replaceWith(photo);
  }

  row.querySelector('h3').textContent = p.name;
  row.querySelector('.product-desc').textContent = p.desc || '';
  row.querySelector('.unit').textContent = p.detail;
  row.querySelector('.price').textContent = money(p.price);
  row.querySelector('output').setAttribute('aria-label', 'Quantidade de ' + p.name);

  for (const button of row.querySelectorAll('button')) {
    const delta = Number(button.dataset.change);
    button.setAttribute('aria-label', (delta > 0 ? 'Adicionar ' : 'Remover ') + p.name);
    button.disabled = delta < 0;
    button.addEventListener('click', () => {
      const qty = Math.max(0, Math.min(99, (cart.get(p.id) || 0) + delta));
      cart.set(p.id, qty);
      row.querySelector('output').value = qty;
      row.querySelector('[data-change="-1"]').disabled = qty === 0;
      row.querySelector('[data-change="1"]').disabled = qty === 99;
      update();
    });
  }

  $('#products').append(row);
}

/* 5. Resumo do pedido (sidebar) --------------------------------------------*/
function update() {
  const summary = $('#summary');
  summary.replaceChildren();
  let count = 0;

  for (const p of products) {
    const qty = cart.get(p.id) || 0;
    if (!qty) continue;
    count += qty;
    const row = document.createElement('div');
    row.className = 'summary-item';
    const name = document.createElement('span');
    name.textContent = `${qty}× ${p.name} (${p.detail})`;
    const price = document.createElement('span');
    price.textContent = money(lineTotal(p, qty));
    row.append(name, price);
    summary.append(row);
  }

  if (!count) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Seu pedido começa aqui. Adicione algo gostoso ao lado.';
    summary.append(empty);
  }

  $('#count').textContent = count + ' ' + (count === 1 ? 'item' : 'itens');
  const subtotal = total();
  $('#subtotal').textContent = money(subtotal);

  const delivery = form.elements.delivery.value === 'delivery';
  $('#fee').textContent = delivery ? money(DELIVERY_FEE_CENTS) : 'Retirada na loja';
  $('#total-label').textContent = 'Total';
  // Total inclui a taxa de entrega quando for delivery.
  $('#total').textContent = subtotal === null
    ? money(null)
    : money(subtotal + (delivery ? DELIVERY_FEE_CENTS : 0));
  if (count) $('#cart-error').hidden = true;

  syncBreadDateField();
}

/* 4b. Campo de data: aparece quando há qualquer produto no carrinho ------ */
function syncBreadDateField() {
  const field = $('#bread-date-field');
  if (!field) return;
  const show = anyInCart();
  field.hidden = !show;
  field.disabled = !show;
  // A obrigatoriedade da data é tratada manualmente no submit (o input é
  // hidden, então não usamos "required" nativo para evitar erro de foco).

  if (!show) {
    $('#date-info').hidden = true;
    closeCalendar();
    return;
  }

  // Se a data escolhida deixou de ser válida (ex: aumentou o pão e não
  // cabe mais), limpa a seleção.
  const dateInput = $('#delivery-date');
  const selected = dateInput.value;
  if (selected && !isDateSelectable(selected)) {
    dateInput.value = '';
    $('#date-trigger-label').textContent = 'Selecione uma data';
    $('#date-info').hidden = true;
  }
  // Se o popover estiver aberto, re-renderiza para refletir vagas atuais.
  if (!$('#calendar-pop').hidden) renderCalendar();
  if (dateInput.value) showDateInfo(dateInput.value);
}

/* 6. Filtros de categoria ---------------------------------------------------*/
document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.filter').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  document.querySelectorAll('.product').forEach(row => {
    row.hidden = button.dataset.category !== 'all' && row.dataset.category !== button.dataset.category;
  });
}));

/* 7. Modalidade de entrega ---------------------------------------------------*/
form.elements.delivery.forEach(radio => radio.addEventListener('change', () => {
  const delivery = form.elements.delivery.value === 'delivery';
  $('#address').hidden = !delivery;
  $('#address').disabled = !delivery;
  $('#pickup-info').hidden = delivery;
  update();
}));

// Abre/fecha o calendário flutuante.
$('#date-trigger')?.addEventListener('click', toggleCalendar);

// Fecha ao clicar fora do campo/calendário.
document.addEventListener('click', event => {
  const picker = event.target.closest('.date-picker');
  if (!picker && $('#calendar-pop') && !$('#calendar-pop').hidden) closeCalendar();
});
// Fecha com Esc.
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && $('#calendar-pop') && !$('#calendar-pop').hidden) closeCalendar();
});

// Navegação de mês no calendário.
$('#cal-prev')?.addEventListener('click', () => {
  const m = calMonth.month - 1;
  calMonth = m < 0 ? { year: calMonth.year - 1, month: 11 } : { year: calMonth.year, month: m };
  renderCalendar();
});
$('#cal-next')?.addEventListener('click', () => {
  const m = calMonth.month + 1;
  calMonth = m > 11 ? { year: calMonth.year + 1, month: 0 } : { year: calMonth.year, month: m };
  renderCalendar();
});

// Carrega a disponibilidade de pães assim que a página abre.
loadAvailability();

/* 8. Envio: registra o pedido (pendente) e abre o WhatsApp -------------------*/
// Monta o corpo que a API espera a partir do formulário e do carrinho.
function buildOrderPayload(data) {
  const delivery = data.get('delivery') === 'delivery';
  return {
    customer: data.get('customer').trim(),
    phone: data.get('phone'),
    fulfillment: delivery ? 'delivery' : 'pickup',
    deliveryDate: data.get('deliveryDate') || null,
    address: delivery ? {
      street: data.get('street'), number: data.get('number'),
      neighborhood: data.get('neighborhood'), city: data.get('city'),
      complement: data.get('complement') || '',
    } : null,
    payment: data.get('payment'),
    notes: (data.get('notes') || '').trim(),
    isEvent: false,
    eventDetails: '',
    items: products.filter(p => cart.get(p.id) > 0)
      .map(p => ({ id: p.id, qty: cart.get(p.id) })),
  };
}

// Monta o texto do WhatsApp.
function buildWhatsappText(data) {
  const delivery = data.get('delivery') === 'delivery';
  const date = data.get('deliveryDate');
  const dateLabel = date
    ? (() => { const [y, m, d] = date.split('-'); return `${d}/${m}/${y}`; })()
    : null;
  const lines = [
    'RV ARTESANAL • SOLICITAÇÃO DE PEDIDO',
    '',
    ...products.filter(p => cart.get(p.id)).map(p =>
      `${cart.get(p.id)}× ${p.name} (${p.detail}) — ${money(lineTotal(p, cart.get(p.id)))}`
    ),
    '',
    `Cliente: ${data.get('customer').trim()}`,
    `WhatsApp: ${data.get('phone')}`,
    delivery
      ? `Entrega: ${data.get('street')}, ${data.get('number')} — ${data.get('neighborhood')}, ${data.get('city')}${data.get('complement') ? ' • ' + data.get('complement') : ''}`
      : 'Retirada: local e horário a combinar',
    dateLabel ? `Data desejada: ${dateLabel}` : null,
    `Pagamento desejado: ${data.get('payment')}`,
    `Observações: ${(data.get('notes') || '').trim() || 'Nenhuma'}`,
    '',
    `Subtotal: ${money(total())}`,
    delivery ? `Taxa de entrega: ${money(DELIVERY_FEE_CENTS)}` : null,
    `Total: ${money(total() === null ? null : total() + (delivery ? DELIVERY_FEE_CENTS : 0))}`,
    '',
    'Pedido registrado como PENDENTE. Aguarde nossa confirmação por aqui.',
    'Valores e disponibilidade sujeitos à confirmação da confeitaria.',
  ];
  return lines.filter(line => line !== null).join('\n');
}

const submitBtn = $('#continue');

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!validateStep(currentStep)) return;
  if (currentStep < steps.length - 1) { showStep(currentStep + 1); return; }
  for (let i = 0; i < steps.length; i++) { if (!validateStep(i)) return; }
  if (!products.some(p => cart.get(p.id) > 0)) {
    $('#cart-error').hidden = false;
    $('#products button[data-change="1"]').focus();
    return;
  }

  const data = new FormData(form);

  // Havendo qualquer produto, a data de entrega é obrigatória.
  if (anyInCart() && !data.get('deliveryDate')) {
    showStep(steps.length - 1, false);
    const box = $('#date-info');
    box.hidden = false;
    box.innerHTML = '<div class="info-text error">Escolha uma data de entrega no calendário.</div>';
    $('#calendar').scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }

  // Tenta registrar o pedido na API antes de abrir o WhatsApp.
  submitBtn.disabled = true;
  const previousLabel = submitBtn.textContent;
  submitBtn.textContent = 'Registrando…';
  try {
    const res = await fetch('/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildOrderPayload(data)),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result.ok) {
      // A API recusou (ex: limite estourou nesse meio-tempo).
      await loadAvailability(); // atualiza vagas
      alert(result.erro || 'Não foi possível registrar o pedido. Revise a data e a quantidade.');
      showStep(steps.length - 1, false);
      return;
    }
  } catch {
    // API indisponível: seguimos só com o WhatsApp para não travar o cliente.
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = previousLabel;
  }

  $('#review-text').textContent = buildWhatsappText(data);
  $('#contact').href = 'https://wa.me/5521972526975?text=' + encodeURIComponent($('#review-text').textContent);
  $('#review').showModal();
});

$('#back').addEventListener('click', () => $('#review').close());

update();

/* 9. Mural / carrossel de fotos ----------------------------------------------*/
// Fotos da galeria. Para adicionar ou remover uma foto, basta editar esta
// lista: os slides e o contador são gerados automaticamente.
const galleryImages = [
  'assets/galeria-1.jpeg',
  'assets/galeria-2.jpeg',
  'assets/galeria-3.jpeg',
  'assets/galeria-4.jpeg',
  'assets/galeria-5.jpeg',
  'assets/galeria-6.jpeg',
  'assets/galeria-7.jpeg',
  'assets/galeria-8.jpeg',
];

const mural = document.querySelector('.mural');
const track = mural.querySelector('.mural-track');

// Gera os slides a partir da lista de imagens.
galleryImages.forEach((src, i) => {
  const slide = document.createElement('div');
  slide.className = 'mural-slide' + (i === 0 ? ' active' : '');
  slide.setAttribute('role', 'group');
  slide.setAttribute('aria-label', `Foto ${i + 1} de ${galleryImages.length}`);
  const img = document.createElement('img');
  img.src = src;
  img.alt = 'Foto dos produtos da RV Artesanal';
  if (i === 0) img.setAttribute('fetchpriority', 'high');
  else img.loading = 'lazy';
  slide.append(img);
  track.append(slide);
});

const slides = [...mural.querySelectorAll('.mural-slide')];
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let slideIndex = 0, paused = motion.matches;

function displaySlide(index) {
  slideIndex = (index + slides.length) % slides.length;
  track.scrollTo({
    left: slides[slideIndex].offsetLeft - slides[0].offsetLeft,
    behavior: motion.matches ? 'instant' : 'smooth',
  });
  $('#mural-count').textContent = (slideIndex + 1) + ' / ' + slides.length;
}

track.addEventListener('scroll', () => {
  const maxScroll = track.scrollWidth - track.clientWidth;
  const positions = slides.map(slide => Math.min(
    slide.offsetLeft - slides[0].offsetLeft,
    maxScroll,
  ));
  slideIndex = positions.reduce((nearest, position, index) =>
    Math.abs(position - track.scrollLeft) < Math.abs(positions[nearest] - track.scrollLeft)
      ? index
      : nearest,
  0);
  $('#mural-count').textContent = (slideIndex + 1) + ' / ' + slides.length;
}, { passive: true });

function pauseLabel() {
  $('#mural-pause').textContent = paused ? 'Reproduzir' : 'Pausar';
  $('#mural-pause').setAttribute('aria-label', paused ? 'Reproduzir carrossel' : 'Pausar carrossel');
}

$('#mural-prev').addEventListener('click', () => displaySlide(slideIndex - 1));
$('#mural-next').addEventListener('click', () => displaySlide(slideIndex + 1));
$('#mural-pause').addEventListener('click', () => { paused = !paused; pauseLabel(); });
motion.addEventListener('change', event => { paused = event.matches; pauseLabel(); });

setInterval(() => {
  if (!paused && !document.hidden && !mural.matches(':hover') && !mural.contains(document.activeElement)) {
    displaySlide(slideIndex + 1);
  }
}, 5000);

pauseLabel();
