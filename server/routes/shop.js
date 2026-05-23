// server/routes/shop.js
//
// E-commerce — Fase 1 (Sprint 14, 2026-05-23): catálogo público + CRUD admin
// de productos / categorías / imágenes. Fase 2 (carrito, orders, MercadoPago)
// y Fase 3 (lifecycle dispatched/completed) se montan en módulos aparte.
//
// Exports:
//   publicRouter()                          → GET catálogo (no auth)
//   adminRouter({authRequired, requireRole}) → CRUD admin (role admin|operator)
//
// Tablas: products, product_images, product_categories (init-db.sql).
// Feature flag: features.shop (montado con requireFeature en index.js).

"use strict";

const express = require("express");
const { z } = require("zod");
const db = require("../db");

// ─────────────────────────────────────────────────────────────────────────────
// Auto-migración + seed (idempotente). Patrón inherited de routes/profile.js:
// se corre una vez al hacer require() del módulo. Todas las queries son
// `IF NOT EXISTS` / `ON CONFLICT DO NOTHING` así que es safe re-ejecutar en
// cada deploy.
//
// Esto permite que el módulo Shop quede totalmente self-contained: ni
// init-db.sql ni operativa manual contra la DB.
// ─────────────────────────────────────────────────────────────────────────────
async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS product_categories (
      id           SERIAL PRIMARY KEY,
      slug         TEXT UNIQUE NOT NULL,
      name         TEXT NOT NULL,
      description  TEXT,
      sort_order   INT NOT NULL DEFAULT 0,
      active       BOOLEAN NOT NULL DEFAULT TRUE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS products (
      id                 SERIAL PRIMARY KEY,
      slug               TEXT UNIQUE NOT NULL,
      name               TEXT NOT NULL,
      short_description  TEXT,
      long_description   TEXT,
      price_cents        INT NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
      stock              INT,
      sku                TEXT UNIQUE,
      category_id        INT REFERENCES product_categories(id) ON DELETE SET NULL,
      active             BOOLEAN NOT NULL DEFAULT TRUE,
      featured           BOOLEAN NOT NULL DEFAULT FALSE,
      sort_order         INT NOT NULL DEFAULT 0,
      meta               JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_products_active_sort ON products(active, sort_order, id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_products_category    ON products(category_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_products_featured    ON products(featured) WHERE featured = TRUE`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS product_images (
      id          SERIAL PRIMARY KEY,
      product_id  INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      url         TEXT NOT NULL,
      alt         TEXT,
      sort_order  INT NOT NULL DEFAULT 0,
      is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id, sort_order)`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_product_images_primary ON product_images(product_id) WHERE is_primary = TRUE`);

  // Seed categorías + 6 productos del catálogo Holistic con imágenes existentes
  // en landing/public/img/* (servidas al raíz por build-vercel.sh).
  await db.query(`
    INSERT INTO product_categories (slug, name, description, sort_order) VALUES
      ('fertilizantes',    'Fertilizantes',    'Sistemas completos de nutrición vegetal', 1),
      ('bioestimulantes',  'Bioestimulantes',  'Activadores radiculares y de absorción',  2),
      ('clonadores',       'Clonadores',       'Geles enraizantes para esquejes',         3),
      ('finalizadores',    'Finalizadores',    'Tratamientos pre-cosecha',                4)
    ON CONFLICT (slug) DO NOTHING
  `);

  // Productos seed. Precios placeholder (admin los ajusta luego desde el panel).
  await db.query(`
    INSERT INTO products (slug, name, short_description, long_description, price_cents, stock, sku, category_id, featured, sort_order, meta)
    SELECT v.slug, v.name, v.short, v.long, v.price, v.stock, v.sku, c.id, v.featured, v.sort, v.meta::jsonb
    FROM (VALUES
      ('linea-race',
       'Línea Race — Sistema completo',
       'Sistema de 4 fertilizantes para el ciclo completo indoor y outdoor.',
       'Race 1 (NPK), Race 2 (Calcio + Nitrógeno), Race 3 (PK de crecimiento y maduración en 2 partes) y Race 4 (Micro + Magnesio).',
       25000000, NULL::int, 'RACE-KIT', 'fertilizantes', TRUE, 1,
       '{"presentaciones": ["250ml", "500ml"], "linea": "race", "indoor_outdoor": true}'),
      ('linea-elite',
       'Línea Elite — Part 1 + Part 2',
       'Fertilizante dual premium para hidroponía y sustratos.',
       'Parte 1 aporta NPK y calcio, Parte 2 aporta magnesio y micro. Aplicadas juntas en cada riego, sin antagonismos químicos.',
       18000000, NULL::int, 'ELITE-KIT', 'fertilizantes', TRUE, 2,
       '{"presentaciones": ["250ml", "500ml", "1L", "5L", "10L", "20L"], "linea": "elite"}'),
      ('linea-pro',
       'Línea Pro — 4 etapas hidrosolubles',
       'Fertilizante sólido hidrosoluble en 4 fórmulas etapa-específicas.',
       'Enraizante, Vegetativo, Preflora y Flora. Pesás, disolvés, regás. EC programable, pH estable, 36 meses de vida útil.',
       15000000, NULL::int, 'PRO-KIT', 'fertilizantes', TRUE, 3,
       '{"presentaciones": ["25g", "100g", "500g", "1kg"], "linea": "pro"}'),
      ('bio-estimulante',
       'Bio Estimulante orgánico',
       'Bioestimulante orgánico producido en biorreactor industrial.',
       'Ácidos húmicos, fúlvicos, carboxílicos y grupos fenoles. Potasio soluble. Estimula raíces y absorción.',
       8500000, NULL::int, 'BIO-1L', 'bioestimulantes', TRUE, 4,
       '{"presentaciones": ["500ml", "1L"]}'),
      ('cloner',
       'Cloner — Gel enraizante',
       'Gel enraizante de alta adherencia para esquejes y plantines.',
       'Fórmula de contacto rápido que acelera el prendimiento radicular con mínima manipulación. El primer paso del ciclo.',
       6500000, NULL::int, 'CLONER-50', 'clonadores', TRUE, 5,
       '{"presentaciones": ["50ml"]}'),
      ('day-0',
       'Day-0 — Finalizador',
       'Tratamiento finalizador previo a cosecha.',
       'Aplicado en los últimos riegos antes del corte, limpia reservorios internos y pule sabor, aroma y textura final.',
       7500000, NULL::int, 'DAY0-500', 'finalizadores', TRUE, 6,
       '{"presentaciones": ["500ml", "1L"]}')
    ) AS v(slug, name, short, long, price, stock, sku, cat_slug, featured, sort, meta)
    LEFT JOIN product_categories c ON c.slug = v.cat_slug
    ON CONFLICT (slug) DO NOTHING
  `);

  // Imágenes seed: las que vivían en /img/productos/* del bundle Astro (que
  // build-vercel.sh copia al raíz dist/) — se sirven desde el mismo dominio.
  await db.query(`
    INSERT INTO product_images (product_id, url, alt, sort_order, is_primary)
    SELECT p.id, v.url, v.alt, v.sort, v.is_primary
    FROM (VALUES
      ('linea-race',     '/img/productos/linea-race/500ml/race-1-verde-500ml.png',                'Race 1 vegetativo 500ml',         0, TRUE),
      ('linea-race',     '/img/productos/linea-race/500ml/race-3-rosa-500ml.png',                 'Race 3 PK rosa 500ml',            1, FALSE),
      ('linea-elite',    '/img/productos/linea-elite/1l/parte-1-perspectiva-1l.png',              'Elite Parte 1 1L',                0, TRUE),
      ('linea-elite',    '/img/productos/linea-elite/1l/juntos-1l.png',                           'Elite Parte 1 + Parte 2 1L',      1, FALSE),
      ('linea-pro',      '/img/productos/linea-pro/1kg/flora-1kg-1.png',                          'Pro Flora 1kg',                   0, TRUE),
      ('linea-pro',      '/img/productos/linea-pro/1kg/vegetativo-1kg-1.png',                     'Pro Vegetativo 1kg',              1, FALSE),
      ('bio-estimulante','/img/productos/bio-estimulante/perspectiva-1-grande-rosa-sin-fondo.png','Bio Estimulante perspectiva',     0, TRUE),
      ('cloner',         '/assets/productos/cloner2.png',                                         'Cloner gel enraizante',           0, TRUE),
      ('day-0',          '/img/productos/day-0/perspectiva-1-grande-amarillo-sin-fondo.png',      'Day-0 finalizador',               0, TRUE)
    ) AS v(prod_slug, url, alt, sort, is_primary)
    JOIN products p ON p.slug = v.prod_slug
    -- Cada producto con su set seed se inserta una sola vez: detectamos si
    -- ya hay imágenes para ese producto (cualquiera) y skipeamos si sí.
    WHERE NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = p.id)
  `);

  // ═════════════════════════════════════════════════════════════════════════
  // F2: ORDERS — carrito + checkout + MercadoPago
  // ═════════════════════════════════════════════════════════════════════════
  //
  // Lifecycle: pending_payment → paid → dispatched → completed
  //                          └→ cancelled / failed (terminal)
  //
  // pending_payment = orden creada, esperando webhook MP.
  // paid            = MP confirmó pago, admin tiene que despachar.
  // dispatched      = admin marcó como despachado, esperando confirmación.
  // completed       = ciclo cerrado (cliente recibió o admin marcó).
  // cancelled       = cancelado por user/admin antes de pago.
  // failed          = pago falló o expiró sin confirmar.
  await db.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id                  SERIAL PRIMARY KEY,
      -- Identificador público corto (no exponer SERIAL al cliente para
      -- evitar enumeration y datos sensibles en URLs). Generado al insert.
      public_id           TEXT UNIQUE NOT NULL,
      status              TEXT NOT NULL DEFAULT 'pending_payment'
                          CHECK (status IN ('pending_payment','paid','dispatched','completed','cancelled','failed')),
      -- Datos del cliente (guest checkout). Si user_id se setea, está logueado.
      user_id             INT REFERENCES users(id) ON DELETE SET NULL,
      customer_email      TEXT NOT NULL,
      customer_first_name TEXT NOT NULL,
      customer_last_name  TEXT,
      customer_phone      TEXT,
      -- Dirección de envío como JSONB (street, number, apartment, city,
      -- province, postal_code, country, notes). Flexible para futuras
      -- adiciones sin migrar schema.
      shipping_address    JSONB NOT NULL DEFAULT '{}'::jsonb,
      -- Montos en centavos ARS (entero, sin float drift).
      subtotal_cents      INT NOT NULL DEFAULT 0,
      shipping_cents      INT NOT NULL DEFAULT 0,
      total_cents         INT NOT NULL DEFAULT 0,
      currency            TEXT NOT NULL DEFAULT 'ARS',
      -- MercadoPago: preference creada antes del redirect, payment_id viene
      -- del webhook cuando confirma pago. Ambos opcionales (orden puede
      -- existir sin MP si el cliente no completó el flow).
      mp_preference_id    TEXT,
      mp_payment_id       TEXT,
      mp_status_raw       TEXT,                          -- raw status del webhook MP
      -- Cuándo cada evento ocurrió (para audit + analytics).
      paid_at             TIMESTAMPTZ,
      dispatched_at       TIMESTAMPTZ,
      completed_at        TIMESTAMPTZ,
      -- Notas internas del admin (no visibles al cliente).
      admin_notes         TEXT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_orders_email          ON orders(LOWER(customer_email))`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_orders_mp_preference  ON orders(mp_preference_id) WHERE mp_preference_id IS NOT NULL`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_orders_mp_payment     ON orders(mp_payment_id) WHERE mp_payment_id IS NOT NULL`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id                  SERIAL PRIMARY KEY,
      order_id            INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      -- product_id se setea pero NO se confía en él para precio/nombre:
      -- snapshots inmutables (name_snapshot, price_cents_snapshot) protegen
      -- el histórico si el admin edita el producto después de la venta.
      product_id          INT REFERENCES products(id) ON DELETE SET NULL,
      product_slug        TEXT NOT NULL,
      name_snapshot       TEXT NOT NULL,
      price_cents_snapshot INT NOT NULL CHECK (price_cents_snapshot >= 0),
      quantity            INT NOT NULL CHECK (quantity > 0),
      line_total_cents    INT NOT NULL CHECK (line_total_cents >= 0),
      image_url_snapshot  TEXT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)`);

  // ═════════════════════════════════════════════════════════════════════════
  // F3: CUSTOMERS — base para marketing + tracking de comportamiento
  // ═════════════════════════════════════════════════════════════════════════
  //
  // Email es la PK natural (guest checkout permite repetir customer sin user_id).
  // Capturamos en checkout POST: UPSERT con datos del cliente + acumulado de
  // métricas (orders_count, total_spent_cents, last_order_at).
  //
  // opted_in_marketing default TRUE — el cliente puede pedir baja desde un
  // unsubscribe link en cualquier email. F4 (campañas) sólo manda a quienes
  // tengan TRUE.
  await db.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id                    SERIAL PRIMARY KEY,
      email                 TEXT UNIQUE NOT NULL,
      first_name            TEXT,
      last_name             TEXT,
      phone                 TEXT,
      -- última dirección usada (snapshot del último envío). Para campañas
      -- "destinatarios cerca de tu ciudad" o re-uso en próximas compras.
      last_address          JSONB NOT NULL DEFAULT '{}'::jsonb,
      -- contadores acumulados — más rápido leer aquí que hacer GROUP BY
      -- sobre orders cada vez.
      orders_count          INT NOT NULL DEFAULT 0,
      total_spent_cents     INT NOT NULL DEFAULT 0,
      last_order_at         TIMESTAMPTZ,
      first_order_at        TIMESTAMPTZ,
      -- marketing opt-in. Por defecto TRUE (el cliente al checkout acepta
      -- los TyC que incluyen aviso de emails transaccionales y de promo).
      -- F4: respetar este flag en envíos masivos.
      opted_in_marketing    BOOLEAN NOT NULL DEFAULT TRUE,
      unsubscribed_at       TIMESTAMPTZ,
      -- vínculo opcional con user del portal (si registró cuenta más tarde).
      user_id               INT REFERENCES users(id) ON DELETE SET NULL,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(LOWER(email))`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_customers_marketing ON customers(opted_in_marketing) WHERE opted_in_marketing = TRUE`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_customers_last_order ON customers(last_order_at DESC NULLS LAST)`);

  // ═════════════════════════════════════════════════════════════════════════
  // F4: EMAIL CAMPAIGNS — broadcast marketing a base de customers
  // ═════════════════════════════════════════════════════════════════════════
  //
  // Lifecycle: draft → sending → sent  (o cancelled / failed)
  //
  // Una campaña es un email único que se manda a un segmento de customers
  // (all, opt_in, etc.). Cada destinatario genera una row en email_sends
  // con su propio unsubscribe_token (HMAC firmado) — link único por send
  // que permite tracking + revocación granular sin exponer secrets.
  await db.query(`
    CREATE TABLE IF NOT EXISTS email_campaigns (
      id              SERIAL PRIMARY KEY,
      name            TEXT NOT NULL,                    -- nombre interno admin-only
      subject         TEXT NOT NULL,                    -- asunto del email
      body_html       TEXT NOT NULL,
      body_text       TEXT,                             -- fallback plain (optional, auto-gen si falta)
      preheader       TEXT,                             -- línea visible en inbox preview
      template_kind   TEXT NOT NULL DEFAULT 'custom',   -- promo | anuncio | newsletter | custom
      segment         TEXT NOT NULL DEFAULT 'opt_in',   -- all | opt_in | custom
      status          TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','sending','sent','cancelled','failed')),
      scheduled_at    TIMESTAMPTZ,                      -- futuro: schedule send
      started_at      TIMESTAMPTZ,                      -- cuando arrancó el bucle de envío
      finished_at     TIMESTAMPTZ,                      -- cuando terminó
      sent_count      INT NOT NULL DEFAULT 0,
      failed_count    INT NOT NULL DEFAULT 0,
      total_count     INT NOT NULL DEFAULT 0,           -- size del segmento snapshot al send
      created_by      INT REFERENCES users(id) ON DELETE SET NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_email_campaigns_status_created ON email_campaigns(status, created_at DESC)`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS email_sends (
      id                  SERIAL PRIMARY KEY,
      campaign_id         INT NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
      customer_id         INT REFERENCES customers(id) ON DELETE SET NULL,
      email_snapshot      TEXT NOT NULL,
      status              TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','sent','failed','bounced','unsubscribed')),
      -- Token único por send, HMAC firmado de campaign_id:customer_id:email.
      -- Permite unsubscribe sin login + tracking de open/click sin riesgo
      -- de enumeration (no se puede inferir el token de otro send).
      unsubscribe_token   TEXT UNIQUE NOT NULL,
      sent_at             TIMESTAMPTZ,
      error_message       TEXT,
      resend_message_id   TEXT,                         -- id del email en Resend (futuro: tracking)
      opened_at           TIMESTAMPTZ,                  -- futuro: 1px pixel
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_email_sends_campaign ON email_sends(campaign_id, status)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_email_sends_customer ON email_sends(customer_id, created_at DESC) WHERE customer_id IS NOT NULL`);
}
migrate().catch((e) => console.error("[SHOP MIGRATE]", e));

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de serialización
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convierte una fila de products + lista de imágenes en el shape que consume
 * el cliente. Mantiene `price_cents` (entero ARS) y agrega `price_formatted`
 * para display directo.
 */
function serializeProduct(row, images = [], category = null) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    short_description: row.short_description,
    long_description: row.long_description,
    price_cents: row.price_cents,
    price_formatted: formatARS(row.price_cents),
    stock: row.stock,           // null = stock infinito
    sku: row.sku,
    category: category
      ? { id: category.id, slug: category.slug, name: category.name }
      : null,
    active: row.active,
    featured: row.featured,
    sort_order: row.sort_order,
    meta: row.meta || {},
    images: images.map((img) => ({
      id: img.id,
      url: img.url,
      alt: img.alt,
      sort_order: img.sort_order,
      is_primary: img.is_primary,
    })),
    primary_image: images.find((img) => img.is_primary)?.url
      || images[0]?.url
      || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function formatARS(cents) {
  if (cents == null) return null;
  const value = cents / 100;
  return value.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/**
 * Carga imágenes de N productos en una sola query (evita N+1). Devuelve un
 * Map<productId, image[]> ordenado por sort_order.
 */
async function loadImagesFor(productIds) {
  if (!productIds.length) return new Map();
  const { rows } = await db.query(
    `SELECT id, product_id, url, alt, sort_order, is_primary
     FROM product_images
     WHERE product_id = ANY($1::int[])
     ORDER BY product_id, sort_order, id`,
    [productIds]
  );
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.product_id)) map.set(r.product_id, []);
    map.get(r.product_id).push(r);
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTER — sin auth, sin role check (montado bajo features.shop)
// ─────────────────────────────────────────────────────────────────────────────

function publicRouter() {
  const router = express.Router();

  // GET /api/shop/categories — lista categorías activas con count.
  router.get("/categories", async (_req, res) => {
    try {
      const { rows } = await db.query(
        `SELECT c.id, c.slug, c.name, c.description, c.sort_order,
                COUNT(p.id)::int AS product_count
         FROM product_categories c
         LEFT JOIN products p ON p.category_id = c.id AND p.active = TRUE
         WHERE c.active = TRUE
         GROUP BY c.id
         ORDER BY c.sort_order, c.name`
      );
      res.json({ categories: rows });
    } catch (e) {
      console.error("[shop.public categories]", e);
      res.status(500).json({ error: "Error al listar categorías" });
    }
  });

  // GET /api/shop/products — listado público con filtros.
  // Query: ?category=slug, ?featured=1, ?search=texto, ?limit=, ?offset=
  router.get("/products", async (req, res) => {
    try {
      const { category, featured, search, limit, offset } = req.query;
      const params = [];
      const where = ["p.active = TRUE"];

      if (category) {
        params.push(String(category).toLowerCase());
        where.push(`c.slug = $${params.length}`);
      }
      if (featured === "1" || featured === "true") {
        where.push("p.featured = TRUE");
      }
      if (search) {
        params.push(`%${String(search).toLowerCase()}%`);
        const i = params.length;
        where.push(`(LOWER(p.name) LIKE $${i} OR LOWER(p.short_description) LIKE $${i})`);
      }

      const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 60));
      const off = Math.max(0, parseInt(offset, 10) || 0);
      params.push(lim, off);

      const sql = `
        SELECT p.*,
               c.id   AS cat_id,
               c.slug AS cat_slug,
               c.name AS cat_name
        FROM products p
        LEFT JOIN product_categories c ON c.id = p.category_id
        WHERE ${where.join(" AND ")}
        ORDER BY p.sort_order, p.id
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `;
      const { rows } = await db.query(sql, params);
      const productIds = rows.map((r) => r.id);
      const imagesMap = await loadImagesFor(productIds);

      const products = rows.map((r) => serializeProduct(
        r,
        imagesMap.get(r.id) || [],
        r.cat_id ? { id: r.cat_id, slug: r.cat_slug, name: r.cat_name } : null
      ));

      res.json({ products, count: products.length });
    } catch (e) {
      console.error("[shop.public products]", e);
      res.status(500).json({ error: "Error al listar productos" });
    }
  });

  // GET /api/shop/products/:slug — detalle público.
  router.get("/products/:slug", async (req, res) => {
    try {
      const slug = String(req.params.slug || "").trim().toLowerCase();
      if (!slug) return res.status(400).json({ error: "Slug inválido" });

      const { rows } = await db.query(
        `SELECT p.*,
                c.id   AS cat_id,
                c.slug AS cat_slug,
                c.name AS cat_name
         FROM products p
         LEFT JOIN product_categories c ON c.id = p.category_id
         WHERE p.slug = $1 AND p.active = TRUE
         LIMIT 1`,
        [slug]
      );
      const row = rows[0];
      if (!row) return res.status(404).json({ error: "Producto no encontrado" });

      const imagesMap = await loadImagesFor([row.id]);
      const product = serializeProduct(
        row,
        imagesMap.get(row.id) || [],
        row.cat_id ? { id: row.cat_id, slug: row.cat_slug, name: row.cat_name } : null
      );
      res.json({ product });
    } catch (e) {
      console.error("[shop.public product detail]", e);
      res.status(500).json({ error: "Error al obtener producto" });
    }
  });

  return router;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ROUTER — requiere auth + role admin (operator solo lectura)
// ─────────────────────────────────────────────────────────────────────────────

const productSchema = z.object({
  slug: z.string().trim().min(1).max(160).regex(/^[a-z0-9-]+$/i,
    "slug solo admite letras, números y guiones").transform((s) => s.toLowerCase()),
  name: z.string().trim().min(1).max(200),
  short_description: z.string().trim().max(500).optional().nullable(),
  long_description: z.string().trim().max(8000).optional().nullable(),
  price_cents: z.number().int().min(0),
  stock: z.number().int().min(0).optional().nullable(),
  sku: z.string().trim().max(80).optional().nullable(),
  category_id: z.number().int().positive().optional().nullable(),
  active: z.boolean().optional(),
  featured: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  meta: z.record(z.any()).optional(),
  images: z.array(z.object({
    url: z.string().trim().min(1).max(1000),
    alt: z.string().trim().max(300).optional().nullable(),
    sort_order: z.number().int().optional(),
    is_primary: z.boolean().optional(),
  })).optional(),
});

function build({ authRequired, requireRole }) {
  const router = express.Router();
  const writeMw = [authRequired, requireRole(["admin"])];
  const readMw  = [authRequired, requireRole(["admin", "operator"])];

  // ── GET /api/admin/shop/products — lista con productos INCLUYENDO inactivos
  router.get("/products", ...readMw, async (_req, res) => {
    try {
      const { rows } = await db.query(
        `SELECT p.*,
                c.id AS cat_id, c.slug AS cat_slug, c.name AS cat_name
         FROM products p
         LEFT JOIN product_categories c ON c.id = p.category_id
         ORDER BY p.sort_order, p.id`
      );
      const imagesMap = await loadImagesFor(rows.map((r) => r.id));
      const products = rows.map((r) => serializeProduct(
        r,
        imagesMap.get(r.id) || [],
        r.cat_id ? { id: r.cat_id, slug: r.cat_slug, name: r.cat_name } : null
      ));
      res.json({ products });
    } catch (e) {
      console.error("[shop.admin products list]", e);
      res.status(500).json({ error: "Error al listar productos (admin)" });
    }
  });

  // ── GET /api/admin/shop/categories
  router.get("/categories", ...readMw, async (_req, res) => {
    try {
      const { rows } = await db.query(
        `SELECT * FROM product_categories ORDER BY sort_order, name`
      );
      res.json({ categories: rows });
    } catch (e) {
      console.error("[shop.admin categories]", e);
      res.status(500).json({ error: "Error al listar categorías" });
    }
  });

  // ── POST /api/admin/shop/products — crear
  router.post("/products", ...writeMw, async (req, res) => {
    let body;
    try { body = productSchema.parse(req.body); }
    catch (e) { return res.status(400).json({ error: "Datos inválidos", issues: e.errors }); }

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const { rows: prodRows } = await client.query(
        `INSERT INTO products (slug, name, short_description, long_description,
                                price_cents, stock, sku, category_id,
                                active, featured, sort_order, meta)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,
                 COALESCE($9,TRUE), COALESCE($10,FALSE), COALESCE($11,0),
                 COALESCE($12,'{}'::jsonb))
         RETURNING *`,
        [body.slug, body.name, body.short_description || null, body.long_description || null,
         body.price_cents, body.stock ?? null, body.sku || null, body.category_id || null,
         body.active, body.featured, body.sort_order, JSON.stringify(body.meta || {})]
      );
      const product = prodRows[0];

      // Imágenes (opcional). Si no se pasan, queda sin imágenes (admin las
      // sube luego en otro request).
      if (Array.isArray(body.images) && body.images.length > 0) {
        for (let i = 0; i < body.images.length; i++) {
          const img = body.images[i];
          await client.query(
            `INSERT INTO product_images (product_id, url, alt, sort_order, is_primary)
             VALUES ($1,$2,$3,$4,$5)`,
            [product.id, img.url, img.alt || null,
             img.sort_order ?? i,
             img.is_primary === true || (i === 0 && !body.images.some((x) => x.is_primary))]
          );
        }
      }

      await client.query("COMMIT");

      // Reload completo + serializar.
      const imagesMap = await loadImagesFor([product.id]);
      res.status(201).json({
        product: serializeProduct(product, imagesMap.get(product.id) || [], null)
      });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[shop.admin products create]", e);
      if (e.code === "23505") {
        return res.status(409).json({ error: "Slug o SKU duplicado" });
      }
      res.status(500).json({ error: "Error al crear producto" });
    } finally {
      client.release();
    }
  });

  // ── PUT /api/admin/shop/products/:id — actualizar
  router.put("/products/:id", ...writeMw, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "ID inválido" });

    let body;
    try { body = productSchema.partial({ slug: true }).parse(req.body); }
    catch (e) { return res.status(400).json({ error: "Datos inválidos", issues: e.errors }); }

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      const updates = [];
      const params = [];
      const setIf = (col, val) => {
        if (val !== undefined) {
          params.push(val);
          updates.push(`${col} = $${params.length}`);
        }
      };
      setIf("slug", body.slug);
      setIf("name", body.name);
      setIf("short_description", body.short_description ?? null);
      setIf("long_description", body.long_description ?? null);
      setIf("price_cents", body.price_cents);
      setIf("stock", body.stock ?? null);
      setIf("sku", body.sku ?? null);
      setIf("category_id", body.category_id ?? null);
      setIf("active", body.active);
      setIf("featured", body.featured);
      setIf("sort_order", body.sort_order);
      if (body.meta !== undefined) {
        params.push(JSON.stringify(body.meta));
        updates.push(`meta = $${params.length}::jsonb`);
      }
      updates.push("updated_at = NOW()");

      params.push(id);
      const sql = `UPDATE products SET ${updates.join(", ")} WHERE id = $${params.length} RETURNING *`;
      const { rows } = await client.query(sql, params);
      if (!rows[0]) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Producto no encontrado" });
      }

      // Si vino `images`, reemplaza el set completo. (Update parcial dentro de
      // una sola request: el admin maneja la galería como bloque, no diff.)
      if (Array.isArray(body.images)) {
        await client.query(`DELETE FROM product_images WHERE product_id = $1`, [id]);
        for (let i = 0; i < body.images.length; i++) {
          const img = body.images[i];
          await client.query(
            `INSERT INTO product_images (product_id, url, alt, sort_order, is_primary)
             VALUES ($1,$2,$3,$4,$5)`,
            [id, img.url, img.alt || null,
             img.sort_order ?? i,
             img.is_primary === true || (i === 0 && !body.images.some((x) => x.is_primary))]
          );
        }
      }

      await client.query("COMMIT");
      const imagesMap = await loadImagesFor([id]);
      res.json({ product: serializeProduct(rows[0], imagesMap.get(id) || [], null) });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[shop.admin products update]", e);
      if (e.code === "23505") {
        return res.status(409).json({ error: "Slug o SKU duplicado" });
      }
      res.status(500).json({ error: "Error al actualizar producto" });
    } finally {
      client.release();
    }
  });

  // ── DELETE /api/admin/shop/products/:id — hard delete (CASCADE limpia imágenes)
  router.delete("/products/:id", ...writeMw, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    try {
      const r = await db.query(`DELETE FROM products WHERE id = $1`, [id]);
      if (r.rowCount === 0) return res.status(404).json({ error: "Producto no encontrado" });
      res.json({ ok: true });
    } catch (e) {
      console.error("[shop.admin products delete]", e);
      res.status(500).json({ error: "Error al borrar producto" });
    }
  });

  // ── POST /api/admin/shop/categories — crear categoría
  router.post("/categories", ...writeMw, async (req, res) => {
    const schema = z.object({
      slug: z.string().trim().min(1).regex(/^[a-z0-9-]+$/i).transform((s) => s.toLowerCase()),
      name: z.string().trim().min(1),
      description: z.string().trim().optional().nullable(),
      sort_order: z.number().int().optional(),
    });
    let body;
    try { body = schema.parse(req.body); }
    catch (e) { return res.status(400).json({ error: "Datos inválidos", issues: e.errors }); }

    try {
      const { rows } = await db.query(
        `INSERT INTO product_categories (slug, name, description, sort_order)
         VALUES ($1,$2,$3,COALESCE($4,0))
         RETURNING *`,
        [body.slug, body.name, body.description || null, body.sort_order]
      );
      res.status(201).json({ category: rows[0] });
    } catch (e) {
      console.error("[shop.admin categories create]", e);
      if (e.code === "23505") return res.status(409).json({ error: "Slug duplicado" });
      res.status(500).json({ error: "Error al crear categoría" });
    }
  });

  return router;
}

module.exports = { publicRouter, build };
