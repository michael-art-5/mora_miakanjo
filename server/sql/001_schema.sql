-- Schéma initial PostgreSQL — appliqué automatiquement par server/migrate.js

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(60)  NOT NULL UNIQUE,
  password_hash VARCHAR(200) NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token_hash CHAR(64)    PRIMARY KEY,
  user_id    INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_sessions_expires ON sessions (expires_at);

CREATE TABLE settings (
  key        VARCHAR(40) PRIMARY KEY,
  value      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id    VARCHAR(60)  PRIMARY KEY,
  label VARCHAR(60)  NOT NULL,
  blurb VARCHAR(200) NOT NULL DEFAULT '',
  color CHAR(7)      NOT NULL DEFAULT '#1b2438',
  sort  INT          NOT NULL DEFAULT 0
);

-- Photos des produits, stockées en base (l'hébergement gratuit n'a pas de disque permanent)
CREATE TABLE images (
  id         BIGSERIAL   PRIMARY KEY,
  mime       VARCHAR(40) NOT NULL,
  size       INT         NOT NULL,
  data       BYTEA       NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id           BIGSERIAL     PRIMARY KEY,
  slug         VARCHAR(80)   NOT NULL UNIQUE,
  name         VARCHAR(120)  NOT NULL,
  category_id  VARCHAR(60)   REFERENCES categories(id) ON DELETE SET NULL ON UPDATE CASCADE,
  price        BIGINT        NOT NULL CHECK (price >= 0),
  description  VARCHAR(4000) NOT NULL DEFAULT '',
  sizes        JSONB         NOT NULL DEFAULT '[]',
  colors       JSONB         NOT NULL DEFAULT '[]',
  image        VARCHAR(300),
  tone         CHAR(7)       NOT NULL DEFAULT '#c49a5c',
  is_new       BOOLEAN       NOT NULL DEFAULT false,
  is_featured  BOOLEAN       NOT NULL DEFAULT false,
  is_published BOOLEAN       NOT NULL DEFAULT true,
  in_stock     BOOLEAN       NOT NULL DEFAULT true,
  sort         INT           NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);
-- Catalogue public : liste, catégorie, à la une, nouveautés
CREATE INDEX ix_products_catalog  ON products (is_published, sort, id);
CREATE INDEX ix_products_category ON products (category_id, is_published, sort, id);
CREATE INDEX ix_products_featured ON products (sort, id) WHERE is_featured AND is_published;
CREATE INDEX ix_products_new      ON products (sort, id) WHERE is_new AND is_published;
CREATE INDEX ix_products_name     ON products (name);
-- Filtres taille et coloris (opérateur @>)
CREATE INDEX ix_products_sizes    ON products USING GIN (sizes jsonb_path_ops);
CREATE INDEX ix_products_colors   ON products USING GIN (colors jsonb_path_ops);

CREATE TABLE promotions (
  id         SERIAL       PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  kind       VARCHAR(10)  NOT NULL CHECK (kind IN ('percent', 'fixed')),
  value      BIGINT       NOT NULL,
  scope      VARCHAR(10)  NOT NULL CHECK (scope IN ('all', 'category', 'product')),
  target     VARCHAR(60),
  starts_at  DATE,
  ends_at    DATE,
  is_active  BOOLEAN      NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX ix_promotions_active ON promotions (is_active, starts_at, ends_at);

-- Carnet clients : une fiche par e-mail ou téléphone, alimentée par les commandes et les messages
CREATE TABLE customers (
  id              BIGSERIAL    PRIMARY KEY,
  name            VARCHAR(120) NOT NULL,
  email           VARCHAR(160),
  phone           VARCHAR(40),
  phone_key       VARCHAR(40),  -- chiffres uniquement, pour le dédoublonnage
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  last_contact_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_customers_email ON customers (email)     WHERE email IS NOT NULL;
CREATE UNIQUE INDEX ux_customers_phone ON customers (phone_key) WHERE phone_key IS NOT NULL;
CREATE INDEX ix_customers_last ON customers (last_contact_at DESC);
CREATE INDEX ix_customers_name ON customers (name);

CREATE TABLE orders (
  id            BIGSERIAL     PRIMARY KEY,
  reference     VARCHAR(20)   NOT NULL UNIQUE,
  customer_id   BIGINT        REFERENCES customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(120)  NOT NULL,
  phone         VARCHAR(40)   NOT NULL DEFAULT '',
  email         VARCHAR(160)  NOT NULL DEFAULT '',
  message       VARCHAR(2000) NOT NULL DEFAULT '',
  status        VARCHAR(12)   NOT NULL DEFAULT 'nouvelle'
                CHECK (status IN ('nouvelle', 'confirmee', 'prete', 'terminee', 'annulee')),
  source        VARCHAR(12)   NOT NULL DEFAULT 'site',
  admin_note    VARCHAR(2000) NOT NULL DEFAULT '',
  total         BIGINT        NOT NULL DEFAULT 0,
  items_count   INT           NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX ix_orders_created        ON orders (created_at DESC) INCLUDE (status, total);
CREATE INDEX ix_orders_status_created ON orders (status, created_at DESC) INCLUDE (total);
CREATE INDEX ix_orders_customer       ON orders (customer_id, created_at DESC) INCLUDE (status, total);
CREATE INDEX ix_orders_phone          ON orders (phone);
CREATE INDEX ix_orders_email          ON orders (email);

CREATE TABLE order_items (
  id           BIGSERIAL    PRIMARY KEY,
  order_id     BIGINT       NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   BIGINT       REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(120) NOT NULL,
  size         VARCHAR(20)  NOT NULL DEFAULT '',
  color        VARCHAR(40)  NOT NULL DEFAULT '',
  quantity     INT          NOT NULL CHECK (quantity > 0),
  unit_price   BIGINT       NOT NULL
);
CREATE INDEX ix_order_items_order   ON order_items (order_id);
CREATE INDEX ix_order_items_product ON order_items (product_id);

CREATE TABLE messages (
  id          BIGSERIAL     PRIMARY KEY,
  customer_id BIGINT        REFERENCES customers(id) ON DELETE SET NULL,
  name        VARCHAR(120)  NOT NULL,
  email       VARCHAR(160)  NOT NULL DEFAULT '',
  phone       VARCHAR(40)   NOT NULL DEFAULT '',
  subject     VARCHAR(200)  NOT NULL DEFAULT '',
  body        VARCHAR(4000) NOT NULL,
  status      VARCHAR(10)   NOT NULL DEFAULT 'nouveau' CHECK (status IN ('nouveau', 'lu', 'traite', 'archive')),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX ix_messages_status_created ON messages (status, created_at DESC);
CREATE INDEX ix_messages_created        ON messages (created_at DESC);
CREATE INDEX ix_messages_customer       ON messages (customer_id);
