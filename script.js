/* =======================================================================
   Confeitaria RRV — comportamento
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
  { id: 'bread',   category: 'bread', name: 'Pão artesanal',  detail: 'Unidade', price: 2000, icon: '🥖', image: 'assets/pao.jpeg' },
  { id: 'cookie',  category: 'sweet', name: 'Cookie',         detail: 'Unidade', price: 700,  icon: '🍪', image: 'assets/cookie.jpeg' },
  { id: 'brownie', category: 'sweet', name: 'Brownie',        detail: 'Unidade', price: 1500, icon: '🍫', image: 'assets/brownie.webp' },
  { id: 'palha',   category: 'sweet', name: 'Palha italiana', detail: 'Unidade', price: 1500, icon: '🍬', image: 'assets/palha-italiana.jpeg' },
];

const cart = new Map();
const $ = s => document.querySelector(s);
const money = cents => cents === null
  ? 'Sob consulta'
  : (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const form = $('#order-form');

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
  row.innerHTML = `<span class="product-icon" aria-hidden="true"></span><div class="product-info"><h3></h3><div class="muted fine"></div><strong class="price"></strong></div><div class="counter"><button type="button" data-change="-1">−</button><output>0</output><button type="button" data-change="1">+</button></div>`;

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
  row.querySelector('.fine').textContent = p.detail;
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
  $('#subtotal').textContent = $('#total').textContent = money(total());

  const delivery = form.elements.delivery.value === 'delivery';
  $('#fee').textContent = delivery ? 'A confirmar' : 'Retirada na loja';
  $('#total-label').textContent = delivery ? 'Total parcial' : 'Total';
  if (count) $('#cart-error').hidden = true;
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

/* 8. Envio: monta a mensagem e abre o WhatsApp -------------------------------*/
form.addEventListener('submit', event => {
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
  const delivery = data.get('delivery') === 'delivery';
  const lines = [
    'CONFEITARIA RRV • SOLICITAÇÃO DE PEDIDO',
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
    `Pagamento desejado: ${data.get('payment')}`,
    `Observações: ${data.get('notes').trim() || 'Nenhuma'}`,
    '',
    `${delivery ? 'Total parcial (sem taxa de entrega)' : 'Total'}: ${money(total())}`,
    delivery ? 'Taxa e disponibilidade de entrega a confirmar.' : '',
    'Valores e disponibilidade sujeitos à confirmação da confeitaria.',
    'Este resumo não confirma o pedido nem realiza pagamento.',
  ];

  $('#review-text').textContent = lines.filter(line => line !== null).join('\n');
  $('#contact').href = 'https://wa.me/5521972526975?text=' + encodeURIComponent($('#review-text').textContent);
  $('#review').showModal();
});

$('#back').addEventListener('click', () => $('#review').close());

update();

/* 9. Mural / carrossel de fotos ----------------------------------------------*/
const mural = document.querySelector('.mural');
const slides = [...mural.querySelectorAll('.mural-slide')];
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let slideIndex = 0, paused = motion.matches;
const track = mural.querySelector('.mural-track');

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
