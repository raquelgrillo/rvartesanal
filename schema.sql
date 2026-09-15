-- =====================================================================
-- RV Artesanal — esquema do banco de dados (Cloudflare D1 / SQLite)
--
-- Modelo de dados:
--   orders       -> um pedido feito por um cliente (nasce como 'pendente')
--   order_items  -> os itens de cada pedido (pão, cookie, palha, etc.)
--
-- Regra de negócio dos pães (capacidade de produção acumulada):
--   A massa é feita num dia e assada no dia seguinte, produzindo 6 por
--   fornada. A capacidade disponível para ENTREGA acumula assim:
--     - sábado:                        até  6  (fornada de sáb)
--     - sábado+domingo:                até 12  (+ fornada de dom)
--     - sábado+domingo+segunda+terça:  até 18  (+ fornada de seg;
--       a terça divide a mesma fornada da segunda, não adiciona capacidade)
--
--   Portanto o limite NÃO é "6 por dia fixo": é o acumulado que não pode
--   ultrapassar a produção acumulada. Isso permite o "arraste" (o que
--   sobra de um dia pode ser entregue no seguinte).
--
--   - Só pedidos APROVADOS contam para o limite.
--   - Cada pedido guarda o bloco (weekend_key, ancorado no SÁBADO) e o
--     dia dentro do bloco (weekend_day: sáb=0, dom=1, seg=2, ter=3),
--     para somar por degrau sem recalcular datas o tempo todo.
-- =====================================================================

-- Recria as tabelas do zero. Seguro em desenvolvimento; em produção
-- rode apenas uma vez (ou remova os DROP para não perder dados).
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;

CREATE TABLE orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Dados do cliente
  customer_name   TEXT    NOT NULL,
  customer_phone  TEXT    NOT NULL,

  -- Entrega
  fulfillment     TEXT    NOT NULL DEFAULT 'pickup',  -- 'pickup' ou 'delivery'
  delivery_date   TEXT,                                -- data escolhida (YYYY-MM-DD)
  weekend_key     TEXT,                                -- bloco de fim de semana ancorado no sábado (ex: '2026-09-19'); NULL se não for pão
  weekend_day     INTEGER,                             -- dia dentro do bloco: sáb=0, dom=1, seg=2, ter=3; NULL se não for pão
  address_json    TEXT,                                -- endereço em JSON quando for delivery
  payment         TEXT,
  notes           TEXT,

  -- Pedido personalizado / evento
  is_event        INTEGER NOT NULL DEFAULT 0,          -- 0 = não, 1 = sim
  event_details   TEXT,

  -- Contagem de pães deste pedido (redundante, mas acelera a soma do limite)
  bread_qty       INTEGER NOT NULL DEFAULT 0,

  -- Estado do pedido no fluxo de aprovação
  status          TEXT    NOT NULL DEFAULT 'pendente', -- 'pendente' | 'aprovado' | 'recusado'

  delivery_fee_cents INTEGER NOT NULL DEFAULT 0,        -- taxa de entrega (0 na retirada)
  total_cents     INTEGER NOT NULL DEFAULT 0,           -- total já com a taxa
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  decided_at      TEXT                                 -- quando foi aprovado/recusado
);

CREATE TABLE order_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   TEXT    NOT NULL,   -- 'bread', 'cookie', 'palha'
  product_name TEXT    NOT NULL,
  qty          INTEGER NOT NULL,
  price_cents  INTEGER              -- preço unitário no momento do pedido (NULL = sob consulta)
);

-- Índices para as consultas mais comuns:
-- somar pães aprovados por bloco de fim de semana, e listar por status.
CREATE INDEX idx_orders_weekend ON orders(weekend_key, status, weekend_day);
CREATE INDEX idx_orders_status  ON orders(status, created_at);
CREATE INDEX idx_items_order    ON order_items(order_id);
