/**
 * Demo schema for the "Load E-Commerce Sample" button. It is deliberately
 * flawed: every check in the linter has at least one trigger here, and the
 * dialects are mixed (backticks, ALTER TABLE constraints, standalone
 * CREATE INDEX) to exercise the parser's tolerance.
 *
 *   type-mismatch        orders.user_id VARCHAR(36) -> users.id INT
 *   type-mismatch (info) inventory.product_sku VARCHAR(32) -> products.sku VARCHAR(64)
 *   implicit-fk          products.supplier_id, wishlists.user_id
 *   missing-index        addresses.user_id, order_items.product_id
 *   circular-dependency  orders <-> shipments, categories -> categories
 *   dangling-reference   payments.refund_id -> refunds (table never defined)
 *   no-primary-key       audit_log
 *   orphan-table         audit_log
 */
export const ECOMMERCE_SAMPLE_SQL = `-- ============================================================
--  Neon Commerce — demo schema (contains intentional defects)
-- ============================================================

CREATE TABLE users (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  email         VARCHAR(255) NOT NULL UNIQUE,
  display_name  VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- user_id is a foreign key with no supporting index.
CREATE TABLE addresses (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  user_id       INT NOT NULL,
  line1         VARCHAR(255) NOT NULL,
  line2         VARCHAR(255),
  city          VARCHAR(120) NOT NULL,
  postal_code   VARCHAR(24),
  country_code  CHAR(2) NOT NULL,
  CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Self-referencing hierarchy.
CREATE TABLE categories (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  name       VARCHAR(120) NOT NULL,
  slug       VARCHAR(140) NOT NULL UNIQUE,
  parent_id  INT NULL REFERENCES categories (id) ON DELETE SET NULL
);

CREATE TABLE suppliers (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  name          VARCHAR(180) NOT NULL,
  contact_email VARCHAR(255),
  country_code  CHAR(2)
);

-- supplier_id looks like a foreign key but no constraint declares it.
CREATE TABLE \`products\` (
  \`id\`           INT PRIMARY KEY AUTO_INCREMENT,
  \`sku\`          VARCHAR(64) NOT NULL UNIQUE,
  \`name\`         VARCHAR(200) NOT NULL,
  \`description\`  TEXT,
  \`price\`        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  \`category_id\`  INT NOT NULL,
  \`supplier_id\`  INT,
  \`is_active\`    BOOLEAN NOT NULL DEFAULT TRUE,
  \`created_at\`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY \`idx_products_category\` (\`category_id\`),
  CONSTRAINT \`fk_products_category\` FOREIGN KEY (\`category_id\`) REFERENCES \`categories\` (\`id\`)
);

-- user_id is VARCHAR(36) but users.id is INT.
-- current_shipment_id closes a cycle with shipments.
CREATE TABLE orders (
  id                   INT PRIMARY KEY AUTO_INCREMENT,
  user_id              VARCHAR(36) NOT NULL,
  shipping_address_id  INT NOT NULL,
  current_shipment_id  INT NULL,
  status               VARCHAR(32) NOT NULL DEFAULT 'pending',
  total_amount         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  placed_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  order_id    INT NOT NULL,
  product_id  INT NOT NULL,
  quantity    INT NOT NULL DEFAULT 1,
  unit_price  DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_order_items_order   FOREIGN KEY (order_id)   REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products (id)
);

CREATE TABLE shipments (
  id               INT PRIMARY KEY AUTO_INCREMENT,
  order_id         INT NOT NULL,
  carrier          VARCHAR(80) NOT NULL,
  tracking_number  VARCHAR(120),
  shipped_at       TIMESTAMP NULL,
  delivered_at     TIMESTAMP NULL,
  CONSTRAINT fk_shipments_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
);

-- refund_id points at a table that is never created.
CREATE TABLE payments (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  order_id        INT NOT NULL,
  refund_id       INT NULL REFERENCES refunds (id),
  amount          DECIMAL(12,2) NOT NULL,
  method          VARCHAR(40) NOT NULL,
  transaction_ref VARCHAR(160) NOT NULL UNIQUE,
  captured_at     TIMESTAMP NULL,
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders (id)
);

CREATE TABLE reviews (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  product_id  INT NOT NULL,
  user_id     INT NOT NULL,
  rating      SMALLINT NOT NULL,
  body        TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_user    FOREIGN KEY (user_id)    REFERENCES users (id)    ON DELETE CASCADE
);

-- product_sku is narrower than the key it references.
CREATE TABLE inventory (
  id             INT PRIMARY KEY AUTO_INCREMENT,
  product_sku    VARCHAR(32) NOT NULL,
  warehouse_code VARCHAR(16) NOT NULL,
  quantity       INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_inventory_product FOREIGN KEY (product_sku) REFERENCES products (sku)
);

-- user_id is an undeclared foreign key.
CREATE TABLE wishlists (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  user_id    INT NOT NULL,
  name       VARCHAR(120) NOT NULL DEFAULT 'Saved items',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- No primary key, and no relationships at all.
CREATE TABLE audit_log (
  event_type  VARCHAR(64) NOT NULL,
  payload     TEXT,
  occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------- constraints added after the fact ----------

ALTER TABLE orders
  ADD CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id);

ALTER TABLE orders
  ADD CONSTRAINT fk_orders_address FOREIGN KEY (shipping_address_id) REFERENCES addresses (id);

ALTER TABLE orders
  ADD CONSTRAINT fk_orders_shipment FOREIGN KEY (current_shipment_id) REFERENCES shipments (id);

-- ---------- indexes ----------

CREATE INDEX idx_orders_user       ON orders (user_id);
CREATE INDEX idx_orders_address    ON orders (shipping_address_id);
CREATE INDEX idx_orders_shipment   ON orders (current_shipment_id);
CREATE INDEX idx_order_items_order ON order_items (order_id);
CREATE INDEX idx_shipments_order   ON shipments (order_id);
CREATE INDEX idx_payments_order    ON payments (order_id);
CREATE INDEX idx_reviews_product   ON reviews (product_id);
CREATE INDEX idx_reviews_user      ON reviews (user_id);
CREATE INDEX idx_inventory_product ON inventory (product_sku);
`;

/** Shown as the placeholder in the paste panel. */
export const JSON_SAMPLE_HINT = `{
  "name": "blog",
  "tables": [
    {
      "name": "users",
      "columns": [
        { "name": "id", "type": "INTEGER", "primaryKey": true },
        { "name": "email", "type": "VARCHAR(255)", "unique": true }
      ]
    },
    {
      "name": "posts",
      "columns": [
        { "name": "id", "type": "INTEGER", "primaryKey": true },
        { "name": "author_id", "type": "INTEGER", "references": "users.id" },
        { "name": "title", "type": "VARCHAR(200)" }
      ]
    }
  ]
}`;
