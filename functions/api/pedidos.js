// =====================================================================
// POST /api/pedidos
//
// Recebe um pedido do site, valida contra as regras de negócio e grava
// como 'pendente' (não conta para o limite até você aprovar).
//
// Corpo esperado (JSON):
// {
//   customer, phone, fulfillment ('pickup'|'delivery'),
//   deliveryDate ('YYYY-MM-DD' | null),
//   address { street, number, neighborhood, city, complement } | null,
//   payment, notes,
//   isEvent (bool), eventDetails (string),
//   items: [{ id, qty }, ...]
// }
// =====================================================================

import { getProduct } from '../_lib/catalog.js';
import { weekendInfo } from '../_lib/weekend.js';
import { breadByDay, canAddBread } from '../_lib/capacity.js';
import { isBreadDateOrderable, isSweetDateOrderable, isEventDateOk } from '../_lib/deadlines.js';
import { isDeliveryCityAllowed, DELIVERY_FEE_CENTS, DELIVERY_CITY } from '../_lib/delivery.js';

function bad(mensagem, status = 400) {
  return Response.json({ ok: false, erro: mensagem }, { status });
}

// Sanitiza texto: apara espaços e limita tamanho.
function clean(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

export async function onRequestPost({ env, request }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return bad('Corpo do pedido inválido.');
  }

  // ---- Itens e catálogo (preço resolvido no servidor) ----
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return bad('Adicione pelo menos um produto.');
  }

  const items = [];
  let breadQty = 0;
  let totalCents = 0;
  for (const raw of body.items) {
    const product = getProduct(raw.id);
    const qty = Number(raw.qty);
    if (!product) return bad(`Produto desconhecido: ${raw.id}`);
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      return bad(`Quantidade inválida para ${product.name}.`);
    }
    items.push({ ...product, qty });
    totalCents += product.price * qty;
    if (product.isBread) breadQty += qty;
  }

  // ---- Cliente ----
  const customer = clean(body.customer, 100);
  const phone = clean(body.phone, 16);
  if (!customer) return bad('Informe o nome do cliente.');
  if (!phone) return bad('Informe o WhatsApp.');

  const fulfillment = body.fulfillment === 'delivery' ? 'delivery' : 'pickup';
  const isEvent = Boolean(body.isEvent);
  const deliveryDate = body.deliveryDate ? clean(body.deliveryDate, 10) : null;

  const now = new Date();
  let weekendKey = null;
  let weekendDay = null;

  // ---- Regras dos pães ----
  if (breadQty > 0) {
    if (!deliveryDate) return bad('Escolha a data de entrega dos pães.');
    if (!isBreadDateOrderable(deliveryDate, now)) {
      return bad('Essa data de pão não está disponível (fora do prazo ou não é dia de entrega).');
    }
    const info = weekendInfo(deliveryDate);
    weekendKey = info.weekendKey;
    weekendDay = info.weekendDay;

    // Confere capacidade contra o que já está APROVADO.
    const byDay = await breadByDay(env.DB, weekendKey);
    const check = canAddBread(byDay, weekendDay, breadQty);
    if (!check.ok) return bad(check.reason);
  } else if (deliveryDate) {
    // ---- Pedido só de doces: prazo de 24h e dia de entrega válido ----
    if (!isSweetDateOrderable(deliveryDate, now)) {
      return bad('Essa data não está disponível. Doces precisam de pelo menos 24h de antecedência e entrega em dia disponível.');
    }
  }

  // ---- Regras de evento ----
  if (isEvent && deliveryDate && !isEventDateOk(deliveryDate, now)) {
    return bad('Pedidos para evento precisam de pelo menos 14 dias de antecedência.');
  }

  // ---- Endereço (quando entrega) ----
  let addressJson = null;
  let deliveryFee = 0;
  if (fulfillment === 'delivery') {
    const a = body.address ?? {};
    const address = {
      street: clean(a.street, 150),
      number: clean(a.number, 15),
      neighborhood: clean(a.neighborhood, 80),
      city: clean(a.city, 80),
      complement: clean(a.complement, 100),
    };
    if (!address.street || !address.number || !address.neighborhood || !address.city) {
      return bad('Endereço de entrega incompleto.');
    }
    // Só entregamos em Niterói.
    if (!isDeliveryCityAllowed(address.city)) {
      return bad(`No momento entregamos apenas em ${DELIVERY_CITY}. Escolha retirada ou um endereço em ${DELIVERY_CITY}.`);
    }
    deliveryFee = DELIVERY_FEE_CENTS;
    addressJson = JSON.stringify(address);
  }

  // Total final inclui a taxa de entrega (quando houver).
  const grandTotal = totalCents + deliveryFee;

  const payment = clean(body.payment, 60);
  const notes = clean(body.notes, 500);
  const eventDetails = isEvent ? clean(body.eventDetails, 500) : null;

  // ---- Grava o pedido + itens ----
  try {
    const insertOrder = await env.DB
      .prepare(
        `INSERT INTO orders
           (customer_name, customer_phone, fulfillment, delivery_date,
            weekend_key, weekend_day, address_json, payment, notes,
            is_event, event_details, bread_qty, status, delivery_fee_cents, total_cents)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,'pendente',?13,?14)`
      )
      .bind(
        customer, phone, fulfillment, deliveryDate,
        weekendKey, weekendDay, addressJson, payment, notes,
        isEvent ? 1 : 0, eventDetails, breadQty, deliveryFee, grandTotal
      )
      .run();

    const orderId = insertOrder.meta.last_row_id;

    for (const it of items) {
      await env.DB
        .prepare(
          `INSERT INTO order_items (order_id, product_id, product_name, qty, price_cents)
           VALUES (?1,?2,?3,?4,?5)`
        )
        .bind(orderId, it.id, it.name, it.qty, it.price)
        .run();
    }

    return Response.json({ ok: true, orderId, status: 'pendente', totalCents: grandTotal, deliveryFee });
  } catch (err) {
    return Response.json({ ok: false, erro: String(err) }, { status: 500 });
  }
}
