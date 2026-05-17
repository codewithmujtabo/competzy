-- Migration: emc-commerce (Wave 1 Phase D, 4 of 6)
-- Vouchers + merchandise (products / orders). All T1 — each competition
-- has its own voucher campaigns, merchandise catalog, and orders. Voucher
-- codes can recur across competitions (UNIQUE constraint is (comp_id, code)).

-- ── voucher_groups ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voucher_groups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id       TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  code          TEXT NOT NULL,
  usable_count  INT NOT NULL DEFAULT 1,
  image         TEXT,
  price         NUMERIC(12,2) NOT NULL DEFAULT 0,
  discounted    NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_voucher_groups_comp_code_live
  ON voucher_groups(comp_id, code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_voucher_groups_comp_id ON voucher_groups(comp_id);

-- ── vouchers ──────────────────────────────────────────────────────────────
-- One individual voucher. Backed by a payment when used; the FK is
-- ON DELETE SET NULL so deleting the payment row doesn't cascade-destroy
-- the voucher's audit trail.
CREATE TABLE IF NOT EXISTS vouchers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id     TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  npsn        TEXT,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  group_id    UUID NOT NULL REFERENCES voucher_groups(id) ON DELETE CASCADE,
  payment_id  UUID REFERENCES payments(id) ON DELETE SET NULL,
  used        INT NOT NULL DEFAULT 0,
  max         INT NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_vouchers_code        ON vouchers(code);
CREATE INDEX IF NOT EXISTS idx_vouchers_comp_id     ON vouchers(comp_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_user_id     ON vouchers(user_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_group_id    ON vouchers(group_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_payment_id  ON vouchers(payment_id);

-- ── products ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id     TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  price       NUMERIC(12,2) NOT NULL DEFAULT 0,
  description TEXT,
  image       TEXT,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_comp_slug_live
  ON products(comp_id, slug) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_comp_code_live
  ON products(comp_id, code) WHERE deleted_at IS NULL;

-- ── orders ────────────────────────────────────────────────────────────────
-- Lifecycle state machine: ordered_at → (paid_at | canceled_at) →
-- (shipped_at) → (delivered_at). `region_data` and `shipping_data` are
-- JSONB blobs of the address breakdown from the regions service.
CREATE TABLE IF NOT EXISTS orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id           TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  code              TEXT NOT NULL,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  registration_id   TEXT REFERENCES registrations(id) ON DELETE SET NULL,
  payment_id        UUID REFERENCES payments(id) ON DELETE SET NULL,
  name              TEXT,
  phone             TEXT,
  address           TEXT,
  region_data       JSONB,
  shipping_data     JSONB,
  subtotal          NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping          NUMERIC(12,2) NOT NULL DEFAULT 0,
  total             NUMERIC(12,2) NOT NULL DEFAULT 0,
  status            TEXT,
  ordered_at        TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  canceled_at       TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,
  shipped_at        TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  tracking_number   TEXT,
  note              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_comp_code_live
  ON orders(comp_id, code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_user_id         ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_registration_id ON orders(registration_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_id      ON orders(payment_id);
CREATE INDEX IF NOT EXISTS idx_orders_comp_status_live
  ON orders(comp_id, status) WHERE deleted_at IS NULL;

-- ── order_items ───────────────────────────────────────────────────────────
-- comp_id duplicated from order for fast comp-scoped revenue queries.
CREATE TABLE IF NOT EXISTS order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id     TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  description TEXT,
  size        TEXT,
  quantity    INT NOT NULL DEFAULT 1,
  price       NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal    NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id   ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_comp_id    ON order_items(comp_id);
