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
const multer = require("multer");
const db = require("../db");
const { reauthorProductImages } = require("./shopImageSet");
const { migrateImagesToCloudinary } = require("./shopImageMigrate");
// Upload de imágenes de producto: mismo patrón probado que profile.js (avatar)
// y chat.js (emojis) — multer en memoria + Cloudinary configurado por request
// leyendo las creds de configStore (DB encriptada via wizard /admin/setup).
const { configureCloudinary } = require("../lib/cloudinaryConfig");

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Solo se permiten imágenes"));
  },
});

// Helper para que un fallo en un INSERT no aborte el resto del migrate.
// Imprime el error y sigue. Solo lo aplicamos a INSERT seed (las CREATE
// TABLE se dejan duras: si una falla, el resto no tiene sentido seguir).
async function safeQuery(sql, label = "seed") {
  try { await db.query(sql); }
  catch (e) { console.error(`[SHOP MIGRATE ${label}]`, e.message || e); }
}

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
  // en landing/public/imagenes-web/* (servidas al raíz por build-vercel.sh).
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
       'Sistema de 5 fertilizantes para el ciclo completo indoor y outdoor.',
       'Race 1 (NPK), Race 2 (Calcio + Nitrógeno), Race 3 (PK de crecimiento y maduración en 2 partes) y Race 4 (Micro + Magnesio).',
       25000000, NULL::int, 'RACE-KIT', 'fertilizantes', TRUE, 1,
       '{"presentaciones": ["250ml", "500ml", "1L", "5L", "10L", "20L"], "linea": "race", "indoor_outdoor": true}'),
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
       '{"presentaciones": ["500ml"]}'),
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
       '{"presentaciones": ["500ml"]}')
    ) AS v(slug, name, short, long, price, stock, sku, cat_slug, featured, sort, meta)
    LEFT JOIN product_categories c ON c.slug = v.cat_slug
    ON CONFLICT (slug) DO NOTHING
  `);

  // Imágenes seed: las que vivían en /imagenes-web/productos/* del bundle Astro (que
  // build-vercel.sh copia al raíz dist/) — se sirven desde el mismo dominio.
  await db.query(`
    INSERT INTO product_images (product_id, url, alt, sort_order, is_primary)
    SELECT p.id, v.url, v.alt, v.sort, v.is_primary
    FROM (VALUES
      -- Kit Race: foto familia + los potes 500ml de costado ("costado 2",
      -- etiqueta con banderas + auto F1). Race 3 1ª y 2ª comparten el tarro
      -- violeta. Sin botellas PART (pedido del cliente 2026-06-07).
      ('linea-race',     '/imagenes-web/productos/linea-race/500ml/race-unificado.png',                    'Línea Race completa — todos los potes',   0, TRUE),
      ('linea-race',     '/imagenes-web/productos/linea-race/500ml/race-1-verde-tarro-500ml.webp',         'Race 1 — NPK (tarro verde)',            1, FALSE),
      ('linea-race',     '/imagenes-web/productos/linea-race/500ml/race-2-celeste-tarro-500ml.webp',       'Race 2 — Calcio + Nitrógeno (tarro celeste)', 2, FALSE),
      ('linea-race',     '/imagenes-web/productos/linea-race/500ml/race-3-violeta-tarro-500ml.webp',       'Race 3 — PK en 2 partes (tarro violeta)', 3, FALSE),
      ('linea-race',     '/imagenes-web/productos/linea-race/500ml/race-4-rosa-tarro-500ml.webp',          'Race 4 — Micro + Magnesio (tarro rosa)', 4, FALSE),
      -- Kit Elite: foto familia + las 2 partes.
      ('linea-elite',    '/imagenes-web/ultimos-cambios/POTE-ELITE-UNIFICADO-INTERNA.png',                     'Línea Elite completa — Part 1 + Part 2',  0, TRUE),
      ('linea-elite',    '/imagenes-web/productos/linea-elite/elite-part-1.png',                           'Elite Parte 1',                   1, FALSE),
      ('linea-elite',    '/imagenes-web/productos/linea-elite/elite-part-2.png',                           'Elite Parte 2',                   2, FALSE),
      -- Kit Pro: foto familia + las 4 etapas.
      ('linea-pro',      '/imagenes-web/productos/linea-pro/1kg/pro-unificado.png',                        'Línea Pro completa — 4 etapas',   0, TRUE),
      ('linea-pro',      '/imagenes-web/productos/linea-pro/1kg/enraizante-1kg-1.png',                     'Pro Enraizante 1kg',              1, FALSE),
      ('linea-pro',      '/imagenes-web/productos/linea-pro/1kg/vegetativo-1kg-1.png',                     'Pro Vegetativo 1kg',              2, FALSE),
      ('linea-pro',      '/imagenes-web/productos/linea-pro/1kg/preflora-1kg-1.png',                       'Pro Preflora 1kg',                3, FALSE),
      ('linea-pro',      '/imagenes-web/productos/linea-pro/1kg/flora-1kg-1.png',                          'Pro Flora 1kg',                   4, FALSE),
      ('bio-estimulante','/imagenes-web/productos/bio-estimulante/perspectiva-1-grande-rosa-sin-fondo.png','Bio Estimulante perspectiva',     0, TRUE),
      ('cloner',         '/imagenes-web/ultimos-cambios/POTE-CLONER-HOME.png',                                 'Cloner gel enraizante',           0, TRUE),
      ('day-0',          '/imagenes-web/productos/day-0/perspectiva-1-grande-amarillo-sin-fondo.png',      'Day-0 finalizador',               0, TRUE)
    ) AS v(prod_slug, url, alt, sort, is_primary)
    JOIN products p ON p.slug = v.prod_slug
    -- Cada producto con su set seed se inserta una sola vez: detectamos si
    -- ya hay imágenes para ese producto (cualquiera) y skipeamos si sí.
    WHERE NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = p.id)
  `);

  // ─── Seed Shop expansión 2026-05-23 ──────────────────────────────────────
  // ~40 SKUs individuales (botella+formato) además de los 6 "kit" originales.
  // Cada SKU apunta a su render real en /imagenes-web/productos/* (renders del zip
  // RENDERULTIMOHOLISTIC.zip mapeados con kebab-case).
  // Precios PLACEHOLDER — el cliente los ajusta luego desde admin → Productos.
  // ON CONFLICT (slug) DO NOTHING → idempotente, no toca SKUs ya existentes.
  await db.query(`
    INSERT INTO products (slug, name, short_description, price_cents, sku, category_id, featured, sort_order, meta)
    SELECT v.slug, v.name, v.short, v.price, v.sku, c.id, FALSE, v.sort, v.meta::jsonb
    FROM (VALUES
      -- ═══════════════ LÍNEA RACE (10 SKUs: 5 fórmulas × 2 sizes) ═══════════════
      -- Esquema alineado a la interna: R1 NPK verde · R2 Calcio+Nitrógeno celeste
      -- · R3 PK 1ª/2ª violeta · R4 Micro+Magnesio rosa.
      ('race-1-npk-250ml',
       'Race 1 — NPK 250ml',
       'NPK concentrado para todo el ciclo. Hojas, raíces y metabolismo regulado.',
       4500000, 'RACE1-NPK-250', 'fertilizantes', 10,
       '{"linea":"race","etapa":"npk","formato":"250ml","color":"verde"}'),
      ('race-1-npk-500ml',
       'Race 1 — NPK 500ml',
       'NPK concentrado para todo el ciclo. Hojas, raíces y metabolismo regulado.',
       7500000, 'RACE1-NPK-500', 'fertilizantes', 11,
       '{"linea":"race","etapa":"npk","formato":"500ml","color":"verde"}'),
      ('race-2-calcio-nitrogeno-250ml',
       'Race 2 — Calcio + Nitrógeno 250ml',
       'Paredes celulares fuertes, más raíces y brotes, resistencia a plagas y sequías.',
       4500000, 'RACE2-CAN-250', 'fertilizantes', 12,
       '{"linea":"race","etapa":"estructura","formato":"250ml","color":"celeste"}'),
      ('race-2-calcio-nitrogeno-500ml',
       'Race 2 — Calcio + Nitrógeno 500ml',
       'Paredes celulares fuertes, más raíces y brotes, resistencia a plagas y sequías.',
       7500000, 'RACE2-CAN-500', 'fertilizantes', 13,
       '{"linea":"race","etapa":"estructura","formato":"500ml","color":"celeste"}'),
      ('race-3-pk-1-250ml',
       'Race 3 — PK 1ª parte 250ml',
       'Primera de las 2 partes PK. Translocación de azúcares y flores agrandadas.',
       5000000, 'RACE3A-PK-250', 'fertilizantes', 14,
       '{"linea":"race","etapa":"pk","formato":"250ml","color":"violeta","parte":"1"}'),
      ('race-3-pk-1-500ml',
       'Race 3 — PK 1ª parte 500ml',
       'Primera de las 2 partes PK. Translocación de azúcares y flores agrandadas.',
       8500000, 'RACE3A-PK-500', 'fertilizantes', 15,
       '{"linea":"race","etapa":"pk","formato":"500ml","color":"violeta","parte":"1"}'),
      ('race-3-pk-2-250ml',
       'Race 3 — PK 2ª parte 250ml',
       'Segunda parte PK. Sostiene flores densas hasta el cierre del ciclo.',
       5000000, 'RACE3B-PK-250', 'fertilizantes', 16,
       '{"linea":"race","etapa":"pk","formato":"250ml","color":"violeta","parte":"2"}'),
      ('race-3-pk-2-500ml',
       'Race 3 — PK 2ª parte 500ml',
       'Segunda parte PK. Sostiene flores densas hasta el cierre del ciclo.',
       8500000, 'RACE3B-PK-500', 'fertilizantes', 17,
       '{"linea":"race","etapa":"pk","formato":"500ml","color":"violeta","parte":"2"}'),
      ('race-4-micro-magnesio-250ml',
       'Race 4 — Micro + Magnesio 250ml',
       'Microelementos (Fe, Zn, B, Mn, Cu, Mo) + magnesio. Activan enzimas y fotosíntesis.',
       4500000, 'RACE4-MIC-250', 'fertilizantes', 18,
       '{"linea":"race","etapa":"micro","formato":"250ml","color":"rosa"}'),
      ('race-4-micro-magnesio-500ml',
       'Race 4 — Micro + Magnesio 500ml',
       'Microelementos (Fe, Zn, B, Mn, Cu, Mo) + magnesio. Activan enzimas y fotosíntesis.',
       7500000, 'RACE4-MIC-500', 'fertilizantes', 19,
       '{"linea":"race","etapa":"micro","formato":"500ml","color":"rosa"}'),

      -- ═══ RACE formatos grandes (2026-06-05): 1L + bidones 5/10/20L ═══
      -- Mismas familias (meta.linea/etapa/parte) → se suman solas al selector
      -- de medida. Race 3 Parte B no tiene render de 20L → ese SKU no existe
      -- (mismo criterio que Elite Max 20L, solo Parte A).
      -- Precios PLACEHOLDER — el cliente los ajusta desde admin → Productos.
      ('race-1-npk-1l',
       'Race 1 — NPK 1L',
       'NPK concentrado para todo el ciclo. Hojas, raíces y metabolismo regulado.',
       12000000, 'RACE1-NPK-1L', 'fertilizantes', 110,
       '{"linea":"race","etapa":"npk","formato":"1L","color":"verde"}'),
      ('race-1-npk-5l',
       'Race 1 — NPK 5L',
       'Bidón profesional para cultivadores intensivos. NPK para todo el ciclo.',
       45000000, 'RACE1-NPK-5L', 'fertilizantes', 111,
       '{"linea":"race","etapa":"npk","formato":"5L","color":"verde","tipo":"bidon"}'),
      ('race-1-npk-10l',
       'Race 1 — NPK 10L',
       'Bidón industrial para grow shops o cultivos a gran escala.',
       85000000, 'RACE1-NPK-10L', 'fertilizantes', 112,
       '{"linea":"race","etapa":"npk","formato":"10L","color":"verde","tipo":"bidon"}'),
      ('race-1-npk-20l',
       'Race 1 — NPK 20L',
       'Bidón industrial — el formato más grande de la línea Race.',
       150000000, 'RACE1-NPK-20L', 'fertilizantes', 113,
       '{"linea":"race","etapa":"npk","formato":"20L","color":"verde","tipo":"bidon"}'),
      ('race-2-calcio-nitrogeno-1l',
       'Race 2 — Calcio + Nitrógeno 1L',
       'Paredes celulares fuertes, más raíces y brotes, resistencia a plagas y sequías.',
       12000000, 'RACE2-CAN-1L', 'fertilizantes', 114,
       '{"linea":"race","etapa":"estructura","formato":"1L","color":"celeste"}'),
      ('race-2-calcio-nitrogeno-5l',
       'Race 2 — Calcio + Nitrógeno 5L',
       'Bidón profesional para cultivadores intensivos. Calcio + Nitrógeno.',
       45000000, 'RACE2-CAN-5L', 'fertilizantes', 115,
       '{"linea":"race","etapa":"estructura","formato":"5L","color":"celeste","tipo":"bidon"}'),
      ('race-2-calcio-nitrogeno-10l',
       'Race 2 — Calcio + Nitrógeno 10L',
       'Bidón industrial para grow shops o cultivos a gran escala.',
       85000000, 'RACE2-CAN-10L', 'fertilizantes', 116,
       '{"linea":"race","etapa":"estructura","formato":"10L","color":"celeste","tipo":"bidon"}'),
      ('race-2-calcio-nitrogeno-20l',
       'Race 2 — Calcio + Nitrógeno 20L',
       'Bidón industrial — el formato más grande de la línea Race.',
       150000000, 'RACE2-CAN-20L', 'fertilizantes', 117,
       '{"linea":"race","etapa":"estructura","formato":"20L","color":"celeste","tipo":"bidon"}'),
      ('race-3-pk-1-1l',
       'Race 3 — PK 1ª parte 1L',
       'Primera de las 2 partes PK. Translocación de azúcares y flores agrandadas.',
       14000000, 'RACE3A-PK-1L', 'fertilizantes', 118,
       '{"linea":"race","etapa":"pk","formato":"1L","color":"violeta","parte":"1"}'),
      ('race-3-pk-1-5l',
       'Race 3 — PK 1ª parte 5L',
       'Bidón profesional para cultivadores intensivos. PK 1ª parte.',
       50000000, 'RACE3A-PK-5L', 'fertilizantes', 119,
       '{"linea":"race","etapa":"pk","formato":"5L","color":"violeta","parte":"1","tipo":"bidon"}'),
      ('race-3-pk-1-10l',
       'Race 3 — PK 1ª parte 10L',
       'Bidón industrial para grow shops o cultivos a gran escala.',
       95000000, 'RACE3A-PK-10L', 'fertilizantes', 120,
       '{"linea":"race","etapa":"pk","formato":"10L","color":"violeta","parte":"1","tipo":"bidon"}'),
      ('race-3-pk-1-20l',
       'Race 3 — PK 1ª parte 20L',
       'Bidón industrial — el formato más grande de la línea Race.',
       165000000, 'RACE3A-PK-20L', 'fertilizantes', 121,
       '{"linea":"race","etapa":"pk","formato":"20L","color":"violeta","parte":"1","tipo":"bidon"}'),
      ('race-3-pk-2-1l',
       'Race 3 — PK 2ª parte 1L',
       'Segunda parte PK. Sostiene flores densas hasta el cierre del ciclo.',
       14000000, 'RACE3B-PK-1L', 'fertilizantes', 122,
       '{"linea":"race","etapa":"pk","formato":"1L","color":"violeta","parte":"2"}'),
      ('race-3-pk-2-5l',
       'Race 3 — PK 2ª parte 5L',
       'Bidón profesional para cultivadores intensivos. PK 2ª parte.',
       50000000, 'RACE3B-PK-5L', 'fertilizantes', 123,
       '{"linea":"race","etapa":"pk","formato":"5L","color":"violeta","parte":"2","tipo":"bidon"}'),
      ('race-3-pk-2-10l',
       'Race 3 — PK 2ª parte 10L',
       'Bidón industrial para grow shops o cultivos a gran escala.',
       95000000, 'RACE3B-PK-10L', 'fertilizantes', 124,
       '{"linea":"race","etapa":"pk","formato":"10L","color":"violeta","parte":"2","tipo":"bidon"}'),
      ('race-4-micro-magnesio-1l',
       'Race 4 — Micro + Magnesio 1L',
       'Microelementos (Fe, Zn, B, Mn, Cu, Mo) + magnesio. Activan enzimas y fotosíntesis.',
       12000000, 'RACE4-MIC-1L', 'fertilizantes', 125,
       '{"linea":"race","etapa":"micro","formato":"1L","color":"rosa"}'),
      ('race-4-micro-magnesio-5l',
       'Race 4 — Micro + Magnesio 5L',
       'Bidón profesional para cultivadores intensivos. Micro + Magnesio.',
       45000000, 'RACE4-MIC-5L', 'fertilizantes', 126,
       '{"linea":"race","etapa":"micro","formato":"5L","color":"rosa","tipo":"bidon"}'),
      ('race-4-micro-magnesio-10l',
       'Race 4 — Micro + Magnesio 10L',
       'Bidón industrial para grow shops o cultivos a gran escala.',
       85000000, 'RACE4-MIC-10L', 'fertilizantes', 127,
       '{"linea":"race","etapa":"micro","formato":"10L","color":"rosa","tipo":"bidon"}'),
      ('race-4-micro-magnesio-20l',
       'Race 4 — Micro + Magnesio 20L',
       'Bidón industrial — el formato más grande de la línea Race.',
       150000000, 'RACE4-MIC-20L', 'fertilizantes', 128,
       '{"linea":"race","etapa":"micro","formato":"20L","color":"rosa","tipo":"bidon"}'),

      -- ═══════════════ LÍNEA ELITE (10 SKUs: Parte 1 + Parte 2 × varios sizes) ═══════════════
      ('elite-parte-1-500ml',
       'Elite Parte 1 — 500ml',
       'NPK + calcio. Se aplica junto con Parte 2 en cada riego.',
       7000000, 'ELITE-P1-500', 'fertilizantes', 20,
       '{"linea":"elite","parte":"1","formato":"500ml"}'),
      ('elite-parte-1-1l',
       'Elite Parte 1 — 1 Litro',
       'NPK + calcio. Se aplica junto con Parte 2 en cada riego.',
       12000000, 'ELITE-P1-1L', 'fertilizantes', 21,
       '{"linea":"elite","parte":"1","formato":"1L"}'),
      ('elite-parte-2-500ml',
       'Elite Parte 2 — 500ml',
       'Magnesio + micro. Se aplica junto con Parte 1 en cada riego.',
       7000000, 'ELITE-P2-500', 'fertilizantes', 22,
       '{"linea":"elite","parte":"2","formato":"500ml"}'),
      ('elite-parte-2-1l',
       'Elite Parte 2 — 1 Litro',
       'Magnesio + micro. Se aplica junto con Parte 1 en cada riego.',
       12000000, 'ELITE-P2-1L', 'fertilizantes', 23,
       '{"linea":"elite","parte":"2","formato":"1L"}'),
      ('elite-juntos-1l',
       'Elite Parte 1 + Parte 2 Combo — 1L cada uno',
       'Combo del fertilizante dual completo. Parte 1 + Parte 2 de 1L cada uno.',
       22000000, 'ELITE-COMBO-1L', 'fertilizantes', 24,
       '{"linea":"elite","tipo":"combo","formato":"1L"}'),
      ('elite-max-5l',
       'Elite Max 5L — Bidón profesional',
       'Presentación profesional para cultivadores intensivos. 5L Parte A.',
       45000000, 'ELITEMAX-A-5L', 'fertilizantes', 25,
       '{"linea":"elite","formato":"5L","tipo":"bidon","parte":"A"}'),
      ('elite-max-5l-b',
       'Elite Max 5L Parte B — Bidón profesional',
       'Presentación profesional 5L Parte B (Mg + micro).',
       45000000, 'ELITEMAX-B-5L', 'fertilizantes', 26,
       '{"linea":"elite","formato":"5L","tipo":"bidon","parte":"B"}'),
      ('elite-max-10l',
       'Elite Max 10L — Bidón industrial Parte A',
       'Industrial 10L Parte A para grow shops o cultivos a gran escala.',
       85000000, 'ELITEMAX-A-10L', 'fertilizantes', 27,
       '{"linea":"elite","formato":"10L","tipo":"bidon","parte":"A"}'),
      ('elite-max-10l-b',
       'Elite Max 10L — Bidón industrial Parte B',
       'Industrial 10L Parte B para grow shops o cultivos a gran escala.',
       85000000, 'ELITEMAX-B-10L', 'fertilizantes', 28,
       '{"linea":"elite","formato":"10L","tipo":"bidon","parte":"B"}'),
      ('elite-max-20l',
       'Elite Max 20L — Bidón industrial Parte A',
       'Industrial 20L Parte A — el formato más grande disponible.',
       150000000, 'ELITEMAX-A-20L', 'fertilizantes', 29,
       '{"linea":"elite","formato":"20L","tipo":"bidon","parte":"A"}'),

      -- ═══════════════ LÍNEA PRO (16 SKUs: 4 etapas × 4 formatos) ═══════════════
      ('pro-enraizante-25gr',
       'Pro Enraizante — 25g',
       'Hidrosoluble para enraizamiento. Estimula desarrollo radicular.',
       1500000, 'PRO-ENR-25G', 'fertilizantes', 30,
       '{"linea":"pro","etapa":"enraizante","formato":"25g"}'),
      ('pro-enraizante-100gr',
       'Pro Enraizante — 100g',
       'Hidrosoluble para enraizamiento. Estimula desarrollo radicular.',
       4500000, 'PRO-ENR-100G', 'fertilizantes', 31,
       '{"linea":"pro","etapa":"enraizante","formato":"100g"}'),
      ('pro-enraizante-500gr',
       'Pro Enraizante — 500g',
       'Hidrosoluble para enraizamiento. Estimula desarrollo radicular.',
       12000000, 'PRO-ENR-500G', 'fertilizantes', 32,
       '{"linea":"pro","etapa":"enraizante","formato":"500g"}'),
      ('pro-enraizante-1kg',
       'Pro Enraizante — 1kg',
       'Hidrosoluble para enraizamiento. Estimula desarrollo radicular.',
       18000000, 'PRO-ENR-1KG', 'fertilizantes', 33,
       '{"linea":"pro","etapa":"enraizante","formato":"1kg"}'),
      ('pro-vegetativo-25gr',
       'Pro Vegetativo — 25g',
       'NPK alto en N para etapa vegetativa. EC programable, pH estable.',
       1500000, 'PRO-VEG-25G', 'fertilizantes', 34,
       '{"linea":"pro","etapa":"vegetativo","formato":"25g"}'),
      ('pro-vegetativo-100gr',
       'Pro Vegetativo — 100g',
       'NPK alto en N para etapa vegetativa. EC programable, pH estable.',
       4500000, 'PRO-VEG-100G', 'fertilizantes', 35,
       '{"linea":"pro","etapa":"vegetativo","formato":"100g"}'),
      ('pro-vegetativo-500gr',
       'Pro Vegetativo — 500g',
       'NPK alto en N para etapa vegetativa. EC programable, pH estable.',
       12000000, 'PRO-VEG-500G', 'fertilizantes', 36,
       '{"linea":"pro","etapa":"vegetativo","formato":"500g"}'),
      ('pro-vegetativo-1kg',
       'Pro Vegetativo — 1kg',
       'NPK alto en N para etapa vegetativa. EC programable, pH estable.',
       18000000, 'PRO-VEG-1KG', 'fertilizantes', 37,
       '{"linea":"pro","etapa":"vegetativo","formato":"1kg"}'),
      ('pro-preflora-25gr',
       'Pro Preflora — 25g',
       'Transición vegetativo→floración. Hidrosoluble.',
       1500000, 'PRO-PRE-25G', 'fertilizantes', 38,
       '{"linea":"pro","etapa":"preflora","formato":"25g"}'),
      ('pro-preflora-100gr',
       'Pro Preflora — 100g',
       'Transición vegetativo→floración. Hidrosoluble.',
       4500000, 'PRO-PRE-100G', 'fertilizantes', 39,
       '{"linea":"pro","etapa":"preflora","formato":"100g"}'),
      ('pro-preflora-500gr',
       'Pro Preflora — 500g',
       'Transición vegetativo→floración. Hidrosoluble.',
       12000000, 'PRO-PRE-500G', 'fertilizantes', 40,
       '{"linea":"pro","etapa":"preflora","formato":"500g"}'),
      ('pro-preflora-1kg',
       'Pro Preflora — 1kg',
       'Transición vegetativo→floración. Hidrosoluble.',
       18000000, 'PRO-PRE-1KG', 'fertilizantes', 41,
       '{"linea":"pro","etapa":"preflora","formato":"1kg"}'),
      ('pro-flora-25gr',
       'Pro Flora — 25g',
       'PK de floración. Flores densas y compactas.',
       1500000, 'PRO-FLOR-25G', 'fertilizantes', 42,
       '{"linea":"pro","etapa":"floracion","formato":"25g"}'),
      ('pro-flora-100gr',
       'Pro Flora — 100g',
       'PK de floración. Flores densas y compactas.',
       4500000, 'PRO-FLOR-100G', 'fertilizantes', 43,
       '{"linea":"pro","etapa":"floracion","formato":"100g"}'),
      ('pro-flora-500gr',
       'Pro Flora — 500g',
       'PK de floración. Flores densas y compactas.',
       12000000, 'PRO-FLOR-500G', 'fertilizantes', 44,
       '{"linea":"pro","etapa":"floracion","formato":"500g"}'),
      ('pro-flora-1kg',
       'Pro Flora — 1kg',
       'PK de floración. Flores densas y compactas.',
       18000000, 'PRO-FLOR-1KG', 'fertilizantes', 45,
       '{"linea":"pro","etapa":"floracion","formato":"1kg"}'),

      -- ═══════════════ BIO + DAY-0 size variants ═══════════════
      -- Bio + Day-0 variantes — SKUs renombrados (BIO-EST-* / DAY0-EST-*)
      -- para no chocar con los SKUs de los kits originales (BIO-1L y DAY0-500).
      ('bio-estimulante-500ml',
       'Bio Estimulante — 500ml',
       'Bioestimulante orgánico. Ácidos húmicos, fúlvicos, carboxílicos. Potasio soluble.',
       5500000, 'BIO-EST-500', 'bioestimulantes', 50,
       '{"linea":"bio","formato":"500ml"}'),
      ('bio-estimulante-1l',
       'Bio Estimulante — 1 Litro',
       'Bioestimulante orgánico. Ácidos húmicos, fúlvicos, carboxílicos. Potasio soluble.',
       8500000, 'BIO-EST-1L', 'bioestimulantes', 51,
       '{"linea":"bio","formato":"1L"}'),
      ('day-0-500ml',
       'Day-0 — 500ml',
       'Finalizador previo a cosecha. Limpia reservorios, pule sabor y aroma.',
       5500000, 'DAY0-EST-500', 'finalizadores', 60,
       '{"linea":"day0","formato":"500ml"}'),
      ('day-0-1l',
       'Day-0 — 1 Litro',
       'Finalizador previo a cosecha. Limpia reservorios, pule sabor y aroma.',
       8500000, 'DAY0-EST-1L', 'finalizadores', 61,
       '{"linea":"day0","formato":"1L"}')
    ) AS v(slug, name, short, price, sku, cat_slug, sort, meta)
    LEFT JOIN product_categories c ON c.slug = v.cat_slug
    -- ON CONFLICT DO NOTHING (catch-all sin target) → cualquier UNIQUE violation
    -- (slug O sku duplicados) skipea la fila en vez de abortar el INSERT entero.
    -- Patrón canónico para seeds idempotentes en Postgres.
    ON CONFLICT DO NOTHING
  `);

  // Imágenes de los nuevos SKUs — apuntan a los renders del zip ya copiados
  // a landing/public/imagenes-web/productos/*. is_primary = TRUE en cada uno (única
  // imagen por SKU). NOT EXISTS check para idempotencia.
  await db.query(`
    INSERT INTO product_images (product_id, url, alt, sort_order, is_primary)
    SELECT p.id, v.url, v.alt, 0, TRUE
    FROM (VALUES
      -- Race 250ml — renders F1 de costado (subidos 2026-06-06)
      ('race-1-npk-250ml',                '/imagenes-web/productos/linea-race/250ml/race-1-verde-f1.webp',       'Race 1 NPK (verde) 250ml'),
      ('race-2-calcio-nitrogeno-250ml',   '/imagenes-web/productos/linea-race/250ml/race-2-celeste-f1.webp',     'Race 2 Calcio + Nitrógeno (celeste) 250ml'),
      ('race-3-pk-1-250ml',               '/imagenes-web/productos/linea-race/250ml/race-3-violeta-a-f1.webp',   'Race 3 PK 1ª parte (violeta) 250ml'),
      ('race-3-pk-2-250ml',               '/imagenes-web/productos/linea-race/250ml/race-3-violeta-b-f1.webp',   'Race 3 PK 2ª parte (violeta) 250ml'),
      ('race-4-micro-magnesio-250ml',     '/imagenes-web/productos/linea-race/250ml/race-4-rosa-f1.webp',        'Race 4 Micro + Magnesio (rosa) 250ml'),
      -- Race 500ml — Race 1 y Race 4 conservan el render viejo (no vino F1 500ml de esos dos)
      ('race-1-npk-500ml',                '/imagenes-web/productos/linea-race/500ml/race-1-verde-500ml.png',     'Race 1 NPK (verde) 500ml'),
      ('race-2-calcio-nitrogeno-500ml',   '/imagenes-web/productos/linea-race/500ml/race-2-celeste-500ml-f1.webp',   'Race 2 Calcio + Nitrógeno (celeste) 500ml'),
      ('race-3-pk-1-500ml',               '/imagenes-web/productos/linea-race/500ml/race-3-violeta-a-500ml-f1.webp', 'Race 3 PK 1ª parte (violeta) 500ml'),
      ('race-3-pk-2-500ml',               '/imagenes-web/productos/linea-race/500ml/race-3-violeta-b-500ml-f1.webp', 'Race 3 PK 2ª parte (violeta) 500ml'),
      ('race-4-micro-magnesio-500ml',     '/imagenes-web/productos/linea-race/500ml/race-4-rosa-500ml.png',      'Race 4 Micro + Magnesio (rosa) 500ml'),
      -- Race 1L — renders F1 de costado
      ('race-1-npk-1l',                   '/imagenes-web/productos/linea-race/1l/race-1-verde-1l-f1.webp',       'Race 1 NPK (verde) 1L'),
      ('race-2-calcio-nitrogeno-1l',      '/imagenes-web/productos/linea-race/1l/race-2-celeste-1l-f1.webp',     'Race 2 Calcio + Nitrógeno (celeste) 1L'),
      ('race-3-pk-1-1l',                  '/imagenes-web/productos/linea-race/1l/race-3-violeta-a-1l-f1.webp',   'Race 3 PK 1ª parte (violeta) 1L'),
      ('race-3-pk-2-1l',                  '/imagenes-web/productos/linea-race/1l/race-3-violeta-b-1l-f1.webp',   'Race 3 PK 2ª parte (violeta) 1L'),
      ('race-4-micro-magnesio-1l',        '/imagenes-web/productos/linea-race/1l/race-4-rosa-1l-f1.webp',        'Race 4 Micro + Magnesio (rosa) 1L'),
      -- Race bidones 5L — renders F1
      ('race-1-npk-5l',                   '/imagenes-web/productos/linea-race/5l/race-1-verde-5l-f1.webp',       'Race 1 NPK (verde) bidón 5L'),
      ('race-2-calcio-nitrogeno-5l',      '/imagenes-web/productos/linea-race/5l/race-2-celeste-5l-f1.webp',     'Race 2 Calcio + Nitrógeno (celeste) bidón 5L'),
      ('race-3-pk-1-5l',                  '/imagenes-web/productos/linea-race/5l/race-3-violeta-a-5l-f1.webp',   'Race 3 PK 1ª parte (violeta) bidón 5L'),
      ('race-3-pk-2-5l',                  '/imagenes-web/productos/linea-race/5l/race-3-violeta-b-5l-f1.webp',   'Race 3 PK 2ª parte (violeta) bidón 5L'),
      ('race-4-micro-magnesio-5l',        '/imagenes-web/productos/linea-race/5l/race-4-rosa-5l-f1.webp',        'Race 4 Micro + Magnesio (rosa) bidón 5L'),
      -- Race bidones 10L — renders F1
      ('race-1-npk-10l',                  '/imagenes-web/productos/linea-race/10l/race-1-verde-10l-f1.webp',     'Race 1 NPK (verde) bidón 10L'),
      ('race-2-calcio-nitrogeno-10l',     '/imagenes-web/productos/linea-race/10l/race-2-celeste-10l-f1.webp',   'Race 2 Calcio + Nitrógeno (celeste) bidón 10L'),
      ('race-3-pk-1-10l',                 '/imagenes-web/productos/linea-race/10l/race-3-violeta-a-10l-f1.webp', 'Race 3 PK 1ª parte (violeta) bidón 10L'),
      ('race-3-pk-2-10l',                 '/imagenes-web/productos/linea-race/10l/race-3-violeta-b-10l-f1.webp', 'Race 3 PK 2ª parte (violeta) bidón 10L'),
      ('race-4-micro-magnesio-10l',       '/imagenes-web/productos/linea-race/10l/race-4-rosa-10l-f1.webp',      'Race 4 Micro + Magnesio (rosa) bidón 10L'),
      -- Race bidones 20L (Race 3 sólo Parte A: tampoco hay render F1 de Parte B 20L)
      ('race-1-npk-20l',                  '/imagenes-web/productos/linea-race/20l/race-1-verde-20l-f1.webp',     'Race 1 NPK (verde) bidón 20L'),
      ('race-2-calcio-nitrogeno-20l',     '/imagenes-web/productos/linea-race/20l/race-2-celeste-20l-f1.webp',   'Race 2 Calcio + Nitrógeno (celeste) bidón 20L'),
      ('race-3-pk-1-20l',                 '/imagenes-web/productos/linea-race/20l/race-3-violeta-a-20l-f1.webp', 'Race 3 PK 1ª parte (violeta) bidón 20L'),
      ('race-4-micro-magnesio-20l',       '/imagenes-web/productos/linea-race/20l/race-4-rosa-20l-f1.webp',      'Race 4 Micro + Magnesio (rosa) bidón 20L'),
      -- Elite 500ml + 1L
      ('elite-parte-1-500ml',             '/imagenes-web/productos/linea-elite/elite-part-1.png',                'Elite Parte 1 500ml'),
      ('elite-parte-1-1l',                '/imagenes-web/productos/linea-elite/1l/parte-1-perspectiva-1l.png',   'Elite Parte 1 1L'),
      ('elite-parte-2-500ml',             '/imagenes-web/productos/linea-elite/500gr/parte-2-perspectiva.png',   'Elite Parte 2 500ml'),
      ('elite-parte-2-1l',                '/imagenes-web/productos/linea-elite/500gr/parte-2-perspectiva-1l.png','Elite Parte 2 1L'),
      ('elite-juntos-1l',                 '/imagenes-web/productos/linea-elite/1l/juntos-1l.png',                'Elite Parte 1 + Parte 2 1L'),
      -- Elite Max
      ('elite-max-5l',                    '/imagenes-web/productos/elite-max/a-5-lts-perspectiva-1.png',         'Elite Max Parte A 5L'),
      ('elite-max-5l-b',                  '/imagenes-web/productos/elite-max/b-5-lts-perspectiva-1.png',         'Elite Max Parte B 5L'),
      ('elite-max-10l',                   '/imagenes-web/productos/elite-max/a-10-lts-perspectiva-1.png',        'Elite Max Parte A 10L'),
      ('elite-max-10l-b',                 '/imagenes-web/productos/elite-max/b-10-lts-perspectiva-1.png',        'Elite Max Parte B 10L'),
      ('elite-max-20l',                   '/imagenes-web/productos/elite-max/a-20-lts-perspectiva-1.png',        'Elite Max Parte A 20L'),
      -- Pro: 4 etapas × 4 formatos. Cada uno apunta al render principal.
      ('pro-enraizante-25gr',             '/imagenes-web/productos/linea-pro/25gr/enraizante-25gr-1.png',        'Pro Enraizante 25g'),
      ('pro-enraizante-100gr',            '/imagenes-web/productos/linea-pro/100gr/enraizante-100gr-1.png',      'Pro Enraizante 100g'),
      ('pro-enraizante-500gr',            '/imagenes-web/productos/linea-pro/500gr/enraizante-500gr-1.png',      'Pro Enraizante 500g'),
      ('pro-enraizante-1kg',              '/imagenes-web/productos/linea-pro/1kg/enraizante-1kg-1.png',          'Pro Enraizante 1kg'),
      ('pro-vegetativo-25gr',             '/imagenes-web/productos/linea-pro/25gr/vegetativo-25gr-1.png',        'Pro Vegetativo 25g'),
      ('pro-vegetativo-100gr',            '/imagenes-web/productos/linea-pro/100gr/vegetativo-100gr-1.png',      'Pro Vegetativo 100g'),
      ('pro-vegetativo-500gr',            '/imagenes-web/productos/linea-pro/500gr/vegetativo-500gr-1.png',      'Pro Vegetativo 500g'),
      ('pro-vegetativo-1kg',              '/imagenes-web/productos/linea-pro/1kg/vegetativo-1kg-1.png',          'Pro Vegetativo 1kg'),
      ('pro-preflora-25gr',               '/imagenes-web/productos/linea-pro/25gr/prefloracion-25gr-1.png',      'Pro Preflora 25g'),
      ('pro-preflora-100gr',              '/imagenes-web/productos/linea-pro/100gr/pre-floracion-100gr-1.png',   'Pro Preflora 100g'),
      ('pro-preflora-500gr',              '/imagenes-web/productos/linea-pro/500gr/pre-flora-500gr-1.png',       'Pro Preflora 500g'),
      ('pro-preflora-1kg',                '/imagenes-web/productos/linea-pro/1kg/preflora-1kg-1.png',            'Pro Preflora 1kg'),
      ('pro-flora-25gr',                  '/imagenes-web/productos/linea-pro/25gr/floracion-25gr-1.png',         'Pro Flora 25g'),
      ('pro-flora-100gr',                 '/imagenes-web/productos/linea-pro/100gr/floracion-100gr-1.png',       'Pro Flora 100g'),
      ('pro-flora-500gr',                 '/imagenes-web/productos/linea-pro/500gr/flora-500gr-1.png',           'Pro Flora 500g'),
      ('pro-flora-1kg',                   '/imagenes-web/productos/linea-pro/1kg/flora-1kg-1.png',               'Pro Flora 1kg'),
      -- Bio + Day-0 variants reusan los renders del producto principal
      ('bio-estimulante-500ml',           '/imagenes-web/productos/bio-estimulante/lateral-grande-rosa-sin-fondo.png',     'Bio Estimulante 500ml'),
      ('bio-estimulante-1l',              '/imagenes-web/productos/bio-estimulante/perspectiva-1-grande-rosa-sin-fondo.png','Bio Estimulante 1L'),
      ('day-0-500ml',                     '/imagenes-web/productos/day-0/lateral-grande-amarillo-sin-fondo.png',          'Day-0 500ml'),
      ('day-0-1l',                        '/imagenes-web/productos/day-0/perspectiva-1-grande-amarillo-sin-fondo.png',    'Day-0 1L')
    ) AS v(prod_slug, url, alt)
    JOIN products p ON p.slug = v.prod_slug
    WHERE NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = p.id)
  `);

  // ─── Reconciliación de imágenes Race (fix de paths viejos) ────────────────
  // El seed de arriba usa `WHERE NOT EXISTS`, así que en deploys que ya tenían
  // filas en product_images (sembradas con una organización vieja de la línea
  // Race: "floración part-a/b", "pk-rosa", race-4 celeste) los paths corregidos
  // NUNCA se reaplican → quedan apuntando a archivos que no existen (404).
  // Acá mapeamos cada URL vieja → el render real que corresponde por COLOR
  // (verde/celeste/violeta/rosa son los 5 únicos renders por tamaño que existen).
  // OJO: las old_url (columna izquierda) conservan los prefijos viejos
  // (/img/, /assets/) a propósito: son los valores tal cual quedaron en la
  // DB de producción. La migración de prefijos /imagenes-web/ corre DESPUÉS.
  // Idempotente: tras la 1ª corrida las URLs viejas ya no existen → no-op.
  await safeQuery(`
    UPDATE product_images pi SET url = m.new_url
    FROM (VALUES
      -- 250ml: floración morado → violeta · pk-rosa/race-4 → rosa
      ('/img/productos/linea-race/250ml/race-2-part-a.png',     '/imagenes-web/productos/linea-race/250ml/race-3-violeta-a.png'),
      ('/img/productos/linea-race/250ml/race-2-part-b.png',     '/imagenes-web/productos/linea-race/250ml/race-3-violeta-b.png'),
      ('/img/productos/linea-race/250ml/race-3-rosa.png',       '/imagenes-web/productos/linea-race/250ml/race-4-rosa.png'),
      ('/img/productos/linea-race/250ml/race-4-celeste.png',    '/imagenes-web/productos/linea-race/250ml/race-4-rosa.png'),
      -- 500ml: mismos mapeos
      ('/img/productos/linea-race/500ml/race-2-part-a-500ml.png','/imagenes-web/productos/linea-race/500ml/race-3-violeta-a-500ml.png'),
      ('/img/productos/linea-race/500ml/race-2-part-b-500ml.png','/imagenes-web/productos/linea-race/500ml/race-3-violeta-b-500ml.png'),
      ('/img/productos/linea-race/500ml/race-3-rosa-500ml.png',  '/imagenes-web/productos/linea-race/500ml/race-4-rosa-500ml.png'),
      ('/img/productos/linea-race/500ml/race-4-celeste-500ml.png','/imagenes-web/productos/linea-race/500ml/race-4-rosa-500ml.png'),
      -- Cloner: render viejo → render holográfico del home (pedido 2026-06-05,
      -- mismo pote que se ve en ComplementosIdeales del inicio)
      ('/assets/productos/cloner2.png',                          '/imagenes-web/ultimos-cambios/POTE-CLONER-HOME.png'),
      -- Auditoría de fotos 2026-06-05:
      -- · kit Línea Elite mostraba bidones Elite Max apilados → botellas Part 1+2
      -- · Elite Parte 1 500ml mostraba vista lateral sin el "PART 1" visible
      -- · Elite Max 5L Parte B apuntaba a un render con nombre "a-" (Parte A)
      ('/img/productos/linea-elite/elite-unificado.png',         '/imagenes-web/ultimos-cambios/POTE-ELITE-UNIFICADO-INTERNA.png'),
      ('/img/productos/linea-elite/500gr/parte-1-lateral.png',   '/imagenes-web/productos/linea-elite/elite-part-1.png'),
      ('/img/productos/elite-max/a-5-lts-perspectiva-2.png',     '/imagenes-web/productos/elite-max/b-5-lts-perspectiva-1.png')
    ) AS m(old_url, new_url)
    WHERE pi.url = m.old_url
  `, "reconcile race image paths");

  // ─── Consolidación /imagenes-web/ (2026-06-06) ─────────────────────────────
  // TODAS las imágenes servidas se movieron a landing/public/imagenes-web/
  // (antes dispersas en /img/, /assets/productos/ y /ultimos-cambios/).
  // Reescribimos los prefijos viejos que queden en la DB (filas sembradas o
  // cargadas por admin con la organización anterior). Corre DESPUÉS de la
  // reconciliación de arriba para que los fixes por color apliquen primero.
  // Idempotente: los LIKE sólo matchean prefijos viejos; tras la 1ª corrida
  // no queda ninguno → no-op. vercel.json mantiene rewrites de respaldo para
  // cualquier URL vieja cacheada/indexada.
  await safeQuery(`
    UPDATE product_images
       SET url = '/imagenes-web/fotos-productos/' || substring(url from 19)
     WHERE url LIKE '/assets/productos/%'
  `, "imagenes-web: /assets/productos → fotos-productos");
  await safeQuery(`
    UPDATE product_images
       SET url = '/imagenes-web/' || substring(url from 6)
     WHERE url LIKE '/img/%'
  `, "imagenes-web: /img → raíz consolidada");
  await safeQuery(`
    UPDATE product_images
       SET url = '/imagenes-web' || url
     WHERE url LIKE '/ultimos-cambios/%'
  `, "imagenes-web: /ultimos-cambios anidado");

  // ─── Desactivar productos Race fantasma del esquema viejo ─────────────────
  // La DB de producción quedó con 8 SKUs Race de una organización anterior
  // de la línea (Race 1 "Vegetativo", Race 2 "Floración Part A/B", Race 3
  // "PK rosa") que DUPLICAN a los SKUs actuales con nombres/colores que ya
  // no corresponden (ej: "Race 2 — Floración" mostrando la botella violeta
  // que hoy es Race 3). El seed usa ON CONFLICT DO NOTHING, así que nunca
  // los pisa. Verificado contra la API de producción 2026-06-05: estos 8
  // slugs son los únicos que existen en prod y no en el seed actual.
  // Se desactivan (no DELETE: pueden estar referenciados por orders viejas).
  // Idempotente: tras la 1ª corrida ya están inactive → no-op.
  await safeQuery(`
    UPDATE products SET active = FALSE
    WHERE active = TRUE AND slug IN (
      'race-1-vegetativo-250ml',        'race-1-vegetativo-500ml',
      'race-2-floracion-part-a-250ml',  'race-2-floracion-part-a-500ml',
      'race-2-floracion-part-b-250ml',  'race-2-floracion-part-b-500ml',
      'race-3-pk-rosa-250ml',           'race-3-pk-rosa-500ml'
    )
  `, "deactivate stale race products");

  // ─── Fix meta drifteada de Race 4 (2026-06-08) ────────────────────────────
  // En prod, race-4-micro-magnesio-250ml/500ml quedaron con meta de un esquema
  // viejo (etapa "finalizador", color "celeste") en vez de micro/rosa. Como el
  // seed usa ON CONFLICT DO NOTHING, nunca corrige la meta de productos
  // existentes → variantGroup daba "race-finalizador" y partía la familia Race 4
  // en dos en el selector (250/500 por un lado, 1L+ por otro). La realineamos a
  // los valores canónicos. Guard por etapa != micro → idempotente.
  await safeQuery(`
    UPDATE products
       SET meta = meta || '{"etapa":"micro","color":"rosa"}'::jsonb
     WHERE slug IN ('race-4-micro-magnesio-250ml','race-4-micro-magnesio-500ml')
       AND meta->>'etapa' IS DISTINCT FROM 'micro'
  `, "fix race-4 meta drift");

  // ─── Race formatos grandes (2026-06-05): presentaciones del kit ───────────
  // El seed del kit linea-race usa ON CONFLICT DO NOTHING, así que en DBs ya
  // sembradas el meta viejo (sólo 250ml/500ml) no se actualiza. Idempotente:
  // sólo corre si '1L' todavía no está en presentaciones.
  await safeQuery(`
    UPDATE products
       SET meta = jsonb_set(meta, '{presentaciones}',
                            '["250ml","500ml","1L","5L","10L","20L"]'::jsonb)
     WHERE slug = 'linea-race'
       AND NOT (meta->'presentaciones' @> '"1L"'::jsonb)
  `, "extend race kit presentaciones");

  // ─── Renders F1 de la línea Race (2026-06-06) ──────────────────────────────
  // El cliente subió la línea gráfica nueva (etiqueta "PH IDEAL RACE" estilo
  // F1). Acá repunteamos la imagen primaria de los BIDONES 5/10/20L (el seed
  // de arriba sólo aplica a DBs vírgenes). Las primarias de 250ml/500ml/1L
  // las maneja el bloque "tarros" de abajo (2026-06-07): el envase chico real
  // es el tarro dosificador y la botella PART pasa a 2ª foto de galería.
  // Race 3 Parte B 20L sigue sin existir (no hay render).
  // Idempotente: UPDATE a un valor fijo → segunda corrida es no-op.
  await safeQuery(`
    UPDATE product_images pi SET url = v.url, alt = v.alt
    FROM (VALUES
      ('race-1-npk-5l',                 '/imagenes-web/productos/linea-race/5l/race-1-verde-5l-f1.webp',           'Race 1 NPK (verde) bidón 5L'),
      ('race-2-calcio-nitrogeno-5l',    '/imagenes-web/productos/linea-race/5l/race-2-celeste-5l-f1.webp',         'Race 2 Calcio + Nitrógeno (celeste) bidón 5L'),
      ('race-3-pk-1-5l',                '/imagenes-web/productos/linea-race/5l/race-3-violeta-a-5l-f1.webp',       'Race 3 PK 1ª parte (violeta) bidón 5L'),
      ('race-3-pk-2-5l',                '/imagenes-web/productos/linea-race/5l/race-3-violeta-b-5l-f1.webp',       'Race 3 PK 2ª parte (violeta) bidón 5L'),
      ('race-4-micro-magnesio-5l',      '/imagenes-web/productos/linea-race/5l/race-4-rosa-5l-f1.webp',            'Race 4 Micro + Magnesio (rosa) bidón 5L'),
      ('race-1-npk-10l',                '/imagenes-web/productos/linea-race/10l/race-1-verde-10l-f1.webp',         'Race 1 NPK (verde) bidón 10L'),
      ('race-2-calcio-nitrogeno-10l',   '/imagenes-web/productos/linea-race/10l/race-2-celeste-10l-f1.webp',       'Race 2 Calcio + Nitrógeno (celeste) bidón 10L'),
      ('race-3-pk-1-10l',               '/imagenes-web/productos/linea-race/10l/race-3-violeta-a-10l-f1.webp',     'Race 3 PK 1ª parte (violeta) bidón 10L'),
      ('race-3-pk-2-10l',               '/imagenes-web/productos/linea-race/10l/race-3-violeta-b-10l-f1.webp',     'Race 3 PK 2ª parte (violeta) bidón 10L'),
      ('race-4-micro-magnesio-10l',     '/imagenes-web/productos/linea-race/10l/race-4-rosa-10l-f1.webp',          'Race 4 Micro + Magnesio (rosa) bidón 10L'),
      ('race-1-npk-20l',                '/imagenes-web/productos/linea-race/20l/race-1-verde-20l-f1.webp',         'Race 1 NPK (verde) bidón 20L'),
      ('race-2-calcio-nitrogeno-20l',   '/imagenes-web/productos/linea-race/20l/race-2-celeste-20l-f1.webp',       'Race 2 Calcio + Nitrógeno (celeste) bidón 20L'),
      ('race-3-pk-1-20l',               '/imagenes-web/productos/linea-race/20l/race-3-violeta-a-20l-f1.webp',     'Race 3 PK 1ª parte (violeta) bidón 20L'),
      ('race-4-micro-magnesio-20l',     '/imagenes-web/productos/linea-race/20l/race-4-rosa-20l-f1.webp',          'Race 4 Micro + Magnesio (rosa) bidón 20L')
    ) AS v(slug, url, alt), products p
    WHERE p.slug = v.slug AND pi.product_id = p.id AND pi.is_primary = TRUE
  `, "race renders F1: repoint primaries");

  // ─── Tarros Race de costado (2026-06-07, pedido del cliente) ──────────────
  // El envase real de Race en 250ml/500ml/1L es el TARRO dosificador de dos
  // bocas con el arte de color (bandera + auto F1). Pasa a ser la imagen
  // PRIMARIA de esos SKUs; la botella con la palanca (PART + medida) queda
  // como segunda foto de la galería. Bidones 5/10/20L no cambian.
  // R3 Part A y B comparten arte violeta (la distinción A/B vive en la
  // botella con palanca, 2ª foto de la galería).
  // Corre DESPUÉS del repoint F1 (pisa la primaria con el tarro). Idempotente.
  await safeQuery(`
    UPDATE product_images pi SET url = v.url, alt = v.alt
    FROM (VALUES
      ('race-1-npk-250ml',              '/imagenes-web/productos/linea-race/250ml/race-1-verde-tarro.webp',      'Race 1 NPK — tarro dosificador (verde)'),
      ('race-2-calcio-nitrogeno-250ml', '/imagenes-web/productos/linea-race/250ml/race-2-celeste-tarro.webp',    'Race 2 Calcio + Nitrógeno — tarro dosificador (celeste)'),
      ('race-3-pk-1-250ml',             '/imagenes-web/productos/linea-race/250ml/race-3-violeta-tarro.webp',    'Race 3 PK 1ª parte — tarro dosificador (violeta)'),
      ('race-3-pk-2-250ml',             '/imagenes-web/productos/linea-race/250ml/race-3-violeta-tarro.webp',    'Race 3 PK 2ª parte — tarro dosificador (violeta)'),
      ('race-4-micro-magnesio-250ml',   '/imagenes-web/productos/linea-race/250ml/race-4-rosa-tarro.webp',       'Race 4 Micro + Magnesio — tarro dosificador (rosa)'),
      ('race-1-npk-500ml',              '/imagenes-web/productos/linea-race/500ml/race-1-verde-tarro-500ml.webp','Race 1 NPK — tarro dosificador (verde)'),
      ('race-2-calcio-nitrogeno-500ml', '/imagenes-web/productos/linea-race/500ml/race-2-celeste-tarro-500ml.webp','Race 2 Calcio + Nitrógeno — tarro dosificador (celeste)'),
      ('race-3-pk-1-500ml',             '/imagenes-web/productos/linea-race/500ml/race-3-violeta-tarro-500ml.webp','Race 3 PK 1ª parte — tarro dosificador (violeta)'),
      ('race-3-pk-2-500ml',             '/imagenes-web/productos/linea-race/500ml/race-3-violeta-tarro-500ml.webp','Race 3 PK 2ª parte — tarro dosificador (violeta)'),
      ('race-4-micro-magnesio-500ml',   '/imagenes-web/productos/linea-race/500ml/race-4-rosa-tarro-500ml.webp', 'Race 4 Micro + Magnesio — tarro dosificador (rosa)'),
      ('race-1-npk-1l',                 '/imagenes-web/productos/linea-race/1l/race-1-verde-tarro-1l.webp',      'Race 1 NPK — tarro dosificador 1L (verde)'),
      ('race-2-calcio-nitrogeno-1l',    '/imagenes-web/productos/linea-race/1l/race-2-celeste-tarro-1l.webp',    'Race 2 Calcio + Nitrógeno — tarro dosificador 1L (celeste)'),
      ('race-3-pk-1-1l',                '/imagenes-web/productos/linea-race/1l/race-3-violeta-tarro-1l.webp',    'Race 3 PK 1ª parte — tarro dosificador 1L (violeta)'),
      ('race-3-pk-2-1l',                '/imagenes-web/productos/linea-race/1l/race-3-violeta-tarro-1l.webp',    'Race 3 PK 2ª parte — tarro dosificador 1L (violeta)'),
      ('race-4-micro-magnesio-1l',      '/imagenes-web/productos/linea-race/1l/race-4-rosa-tarro-1l.webp',       'Race 4 Micro + Magnesio — tarro dosificador 1L (rosa)')
    ) AS v(slug, url, alt), products p
    WHERE p.slug = v.slug AND pi.product_id = p.id AND pi.is_primary = TRUE
  `, "race tarros: primary");
  await safeQuery(`
    INSERT INTO product_images (product_id, url, alt, sort_order, is_primary)
    SELECT p.id, v.url, v.alt, 1, FALSE
    FROM (VALUES
      ('race-1-npk-250ml',              '/imagenes-web/productos/linea-race/250ml/race-1-verde-f1.webp',           'Race 1 NPK (botella 250ml)'),
      ('race-2-calcio-nitrogeno-250ml', '/imagenes-web/productos/linea-race/250ml/race-2-celeste-f1.webp',         'Race 2 Calcio + Nitrógeno (botella 250ml)'),
      ('race-3-pk-1-250ml',             '/imagenes-web/productos/linea-race/250ml/race-3-violeta-a-f1.webp',       'Race 3 PK 1ª parte (botella 250ml)'),
      ('race-3-pk-2-250ml',             '/imagenes-web/productos/linea-race/250ml/race-3-violeta-b-f1.webp',       'Race 3 PK 2ª parte (botella 250ml)'),
      ('race-4-micro-magnesio-250ml',   '/imagenes-web/productos/linea-race/250ml/race-4-rosa-f1.webp',            'Race 4 Micro + Magnesio (botella 250ml)'),
      ('race-1-npk-500ml',              '/imagenes-web/productos/linea-race/500ml/race-1-verde-500ml.png',         'Race 1 NPK (botella 500ml)'),
      ('race-2-calcio-nitrogeno-500ml', '/imagenes-web/productos/linea-race/500ml/race-2-celeste-500ml-f1.webp',   'Race 2 Calcio + Nitrógeno (botella 500ml)'),
      ('race-3-pk-1-500ml',             '/imagenes-web/productos/linea-race/500ml/race-3-violeta-a-500ml-f1.webp', 'Race 3 PK 1ª parte (botella 500ml)'),
      ('race-3-pk-2-500ml',             '/imagenes-web/productos/linea-race/500ml/race-3-violeta-b-500ml-f1.webp', 'Race 3 PK 2ª parte (botella 500ml)'),
      ('race-4-micro-magnesio-500ml',   '/imagenes-web/productos/linea-race/500ml/race-4-rosa-500ml.png',          'Race 4 Micro + Magnesio (botella 500ml)'),
      ('race-1-npk-1l',                 '/imagenes-web/productos/linea-race/1l/race-1-verde-1l-f1.webp',           'Race 1 NPK (botella 1L)'),
      ('race-2-calcio-nitrogeno-1l',    '/imagenes-web/productos/linea-race/1l/race-2-celeste-1l-f1.webp',         'Race 2 Calcio + Nitrógeno (botella 1L)'),
      ('race-3-pk-1-1l',                '/imagenes-web/productos/linea-race/1l/race-3-violeta-a-1l-f1.webp',       'Race 3 PK 1ª parte (botella 1L)'),
      ('race-3-pk-2-1l',                '/imagenes-web/productos/linea-race/1l/race-3-violeta-b-1l-f1.webp',       'Race 3 PK 2ª parte (botella 1L)'),
      ('race-4-micro-magnesio-1l',      '/imagenes-web/productos/linea-race/1l/race-4-rosa-1l-f1.webp',            'Race 4 Micro + Magnesio (botella 1L)')
    ) AS v(slug, url, alt)
    JOIN products p ON p.slug = v.slug
    WHERE NOT EXISTS (
      SELECT 1 FROM product_images WHERE product_id = p.id AND url = v.url
    )
  `, "race tarros: botella PART como 2ª foto");

  // El kit decía "4 fertilizantes" pero la línea son 5 envases (Race 3 va en
  // 2 partes). Guard por el texto viejo exacto → no pisa ediciones del admin.
  await safeQuery(`
    UPDATE products
       SET short_description = 'Sistema de 5 fertilizantes para el ciclo completo indoor y outdoor.'
     WHERE slug = 'linea-race'
       AND short_description = 'Sistema de 4 fertilizantes para el ciclo completo indoor y outdoor.'
  `, "race kit: 5 fertilizantes");

  // ─── Galerías de los kits de línea (2026-06-06, ajustada 2026-06-07) ──────
  // El pedido del cliente: la interna de cada "línea completa" tiene que
  // mostrar TODOS los envases que la componen, no 1 o 2 sueltos.
  // · linea-race: familia + los potes 500ml de costado (foto "costado 2",
  //   etiqueta banderas + auto F1; R3 1ª y 2ª comparten tarro violeta; SIN
  //   botellas PART) → reset completo. El set 1L intermedio nunca llegó a
  //   correr en prod, así que el marker nuevo lo cubre igual.
  // · linea-elite / linea-pro: inserts aditivos de lo que falte (no borra
  //   imágenes que el admin haya subido).
  // Idempotencia: el reset de Race sólo corre si falta el marker (tarro
  // verde 500ml); los inserts aditivos chequean NOT EXISTS por URL.
  try {
    const { rows: raceKit } = await db.query(`
      SELECT p.id,
             EXISTS (SELECT 1 FROM product_images
                      WHERE product_id = p.id
                        AND url = '/imagenes-web/productos/linea-race/500ml/race-1-verde-tarro-500ml.webp') AS has_marker
      FROM products p WHERE p.slug = 'linea-race'
    `);
    if (raceKit[0] && !raceKit[0].has_marker) {
      const pid = raceKit[0].id;
      await db.query(`DELETE FROM product_images WHERE product_id = $1`, [pid]);
      const gallery = [
        ['/imagenes-web/productos/linea-race/500ml/race-unificado.png',              'Línea Race completa — todos los potes',        0, true],
        ['/imagenes-web/productos/linea-race/500ml/race-1-verde-tarro-500ml.webp',   'Race 1 — NPK (tarro verde)',                   1, false],
        ['/imagenes-web/productos/linea-race/500ml/race-2-celeste-tarro-500ml.webp', 'Race 2 — Calcio + Nitrógeno (tarro celeste)',  2, false],
        ['/imagenes-web/productos/linea-race/500ml/race-3-violeta-tarro-500ml.webp', 'Race 3 — PK en 2 partes (tarro violeta)',      3, false],
        ['/imagenes-web/productos/linea-race/500ml/race-4-rosa-tarro-500ml.webp',    'Race 4 — Micro + Magnesio (tarro rosa)',       4, false],
      ];
      for (const [url, alt, sort, primary] of gallery) {
        await db.query(
          `INSERT INTO product_images (product_id, url, alt, sort_order, is_primary)
           VALUES ($1,$2,$3,$4,$5)`,
          [pid, url, alt, sort, primary]
        );
      }
    }
  } catch (e) {
    console.error("[SHOP MIGRATE race kit gallery]", e.message || e);
  }
  await safeQuery(`
    INSERT INTO product_images (product_id, url, alt, sort_order, is_primary)
    SELECT p.id, v.url, v.alt, v.sort, FALSE
    FROM (VALUES
      ('linea-elite', '/imagenes-web/productos/linea-elite/elite-part-2.png',        'Elite Parte 2',      2),
      ('linea-pro',   '/imagenes-web/productos/linea-pro/1kg/enraizante-1kg-1.png',  'Pro Enraizante 1kg', 2),
      ('linea-pro',   '/imagenes-web/productos/linea-pro/1kg/preflora-1kg-1.png',    'Pro Preflora 1kg',   3),
      ('linea-pro',   '/imagenes-web/productos/linea-pro/1kg/flora-1kg-1.png',       'Pro Flora 1kg',      4)
    ) AS v(slug, url, alt, sort)
    JOIN products p ON p.slug = v.slug
    WHERE NOT EXISTS (
      SELECT 1 FROM product_images WHERE product_id = p.id AND url = v.url
    )
  `, "elite/pro kit gallery: completar línea");
  // La primaria del kit Pro en DBs viejas quedó en el render suelto de Flora
  // 1kg (el seed nuevo usa la foto familia pro-unificado.png, pero su WHERE
  // NOT EXISTS por producto nunca re-aplica). Guard por el estado viejo
  // exacto → no pisa una primaria que el admin haya elegido después.
  // Corre DESPUÉS de la consolidación /imagenes-web/ (compara URLs nuevas).
  await safeQuery(`
    INSERT INTO product_images (product_id, url, alt, sort_order, is_primary)
    SELECT p.id, '/imagenes-web/productos/linea-pro/1kg/pro-unificado.png',
           'Línea Pro completa — 4 etapas', 0, FALSE
    FROM products p
    WHERE p.slug = 'linea-pro'
      AND EXISTS (SELECT 1 FROM product_images
                   WHERE product_id = p.id AND is_primary = TRUE
                     AND url = '/imagenes-web/productos/linea-pro/1kg/flora-1kg-1.png')
      AND NOT EXISTS (SELECT 1 FROM product_images
                   WHERE product_id = p.id
                     AND url = '/imagenes-web/productos/linea-pro/1kg/pro-unificado.png')
  `, "pro kit: foto familia en galería");
  await safeQuery(`
    UPDATE product_images pi
       SET is_primary = (pi.url = '/imagenes-web/productos/linea-pro/1kg/pro-unificado.png')
      FROM products p
     WHERE p.slug = 'linea-pro' AND pi.product_id = p.id
       AND EXISTS (SELECT 1 FROM product_images
                    WHERE product_id = p.id AND is_primary = TRUE
                      AND url = '/imagenes-web/productos/linea-pro/1kg/flora-1kg-1.png')
       AND EXISTS (SELECT 1 FROM product_images
                    WHERE product_id = p.id
                      AND url = '/imagenes-web/productos/linea-pro/1kg/pro-unificado.png')
  `, "pro kit: foto familia como primaria");

  // ═══ Catálogo real (2026-06-06): medidas, precios y modelo Elite ══════════
  // Auditoría contra la tienda WooCommerce viva del cliente (hgrowshop.com).
  // Hallazgos aplicados acá:
  //   1. Elite SIEMPRE se vendió como PAR ("un producto en dos partes", el
  //      precio del envase incluye Part 1 + Part 2; Elite Max "de cada
  //      Parte"). Los SKUs por parte suelta no existen en el negocio real →
  //      se desactivan y los reemplazan SKUs "Parte 1 + Parte 2" por medida.
  //   2. Faltaban formatos que el cliente vende hoy: Elite 250ml y 500ml en
  //      par, Day-0 250ml, Bio Estimulante 250ml.
  //   3. Precios reales de hgrowshop.com reemplazan placeholders (guard por
  //      el valor placeholder exacto: si el admin ya tocó un precio, no se
  //      pisa). Race no existe en la tienda vieja → conserva placeholders.
  //   4. Bio/Day-0 sin meta.linea no agrupaban como familia → se setea.

  // 4) meta.linea para variantes Bio/Day-0 sembradas sin él.
  await safeQuery(`
    UPDATE products SET meta = meta || '{"linea":"bio"}'::jsonb
    WHERE slug IN ('bio-estimulante-500ml','bio-estimulante-1l') AND NOT (meta ? 'linea')
  `, "meta.linea bio");
  await safeQuery(`
    UPDATE products SET meta = meta || '{"linea":"day0"}'::jsonb
    WHERE slug IN ('day-0-500ml','day-0-1l') AND NOT (meta ? 'linea')
  `, "meta.linea day0");

  // 2) SKUs nuevos: formatos reales que faltaban. Fotos de producto reales
  //    (fotos-productos/*) — no hay renders sin fondo de estos formatos.
  await safeQuery(`
    INSERT INTO products (slug, name, short_description, price_cents, sku, category_id, featured, sort_order, meta)
    SELECT v.slug, v.name, v.short, v.price, v.sku, c.id, FALSE, v.sort, v.meta::jsonb
    FROM (VALUES
      ('elite-juntos-250ml',
       'Elite Parte 1 + Parte 2 — 250ml',
       'El fertilizante dual completo: 250ml de Parte 1 + 250ml de Parte 2.',
       4460800, 'ELITE-COMBO-250', 'fertilizantes', 22,
       '{"linea":"elite","parte":"1+2","formato":"250ml"}'),
      ('elite-juntos-500ml',
       'Elite Parte 1 + Parte 2 — 500ml',
       'El fertilizante dual completo: 500ml de Parte 1 + 500ml de Parte 2.',
       7492200, 'ELITE-COMBO-500', 'fertilizantes', 23,
       '{"linea":"elite","parte":"1+2","formato":"500ml"}'),
      ('bio-estimulante-250ml',
       'Bio Estimulante — 250ml',
       'Bioestimulante orgánico. Ácidos húmicos, fúlvicos, carboxílicos. Potasio soluble.',
       3040000, 'BIO-EST-250', 'bioestimulantes', 49,
       '{"linea":"bio","formato":"250ml"}'),
      ('day-0-250ml',
       'Day-0 — 250ml',
       'Finalizador previo a cosecha. Limpia reservorios, pule sabor y aroma.',
       1303000, 'DAY0-EST-250', 'finalizadores', 59,
       '{"linea":"day0","formato":"250ml"}')
    ) AS v(slug, name, short, price, sku, cat_slug, sort, meta)
    LEFT JOIN product_categories c ON c.slug = v.cat_slug
    ON CONFLICT DO NOTHING
  `, "skus formatos reales faltantes");
  await safeQuery(`
    INSERT INTO product_images (product_id, url, alt, sort_order, is_primary)
    SELECT p.id, v.url, p.name, 0, TRUE
    FROM (VALUES
      ('elite-juntos-250ml',     '/imagenes-web/fotos-productos/elite250-juntos.jpg'),
      ('elite-juntos-500ml',     '/imagenes-web/fotos-productos/elite500ml-juntos.jpg'),
      ('bio-estimulante-250ml',  '/imagenes-web/fotos-productos/bio-250gr1.jpg'),
      ('day-0-250ml',            '/imagenes-web/fotos-productos/day0250ml-1.jpg')
    ) AS v(slug, url)
    JOIN products p ON p.slug = v.slug
    WHERE NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = p.id)
  `, "imgs skus nuevos");

  // 1) Elite → modelo de pares. El combo 1L existente pasa a ser la variante
  //    1L de la familia (sale el meta "combo" que lo excluía del agrupado).
  await safeQuery(`
    UPDATE products
       SET name = 'Elite Parte 1 + Parte 2 — 1L',
           meta = (meta - 'tipo') || '{"parte":"1+2"}'::jsonb
     WHERE slug = 'elite-juntos-1l' AND meta->>'tipo' = 'combo'
  `, "elite combo 1l → variante par");
  await safeQuery(`
    UPDATE products SET name = 'Elite Max 5L — Parte 1 + Parte 2'
     WHERE slug = 'elite-max-5l' AND name = 'Elite Max 5L — Bidón profesional'
  `, "elite max 5l → par");
  await safeQuery(`
    UPDATE products SET name = 'Elite Max 10L — Parte 1 + Parte 2'
     WHERE slug = 'elite-max-10l' AND name = 'Elite Max 10L — Bidón industrial Parte A'
  `, "elite max 10l → par");
  await safeQuery(`
    UPDATE products SET name = 'Elite Max 20L — Parte 1 + Parte 2'
     WHERE slug = 'elite-max-20l' AND name = 'Elite Max 20L — Bidón industrial Parte A'
  `, "elite max 20l → par");
  // Los bidones Max muestran la foto real del par (los renders sueltos eran
  // de una sola parte). Guard: sólo si siguen apuntando al render viejo.
  await safeQuery(`
    UPDATE product_images pi SET url = v.url, alt = v.alt
    FROM (VALUES
      ('elite-max-5l',  '/imagenes-web/fotos-productos/5lts-juntos.jpg',      'Elite Max 5L Parte 1 + Parte 2',  '/imagenes-web/productos/elite-max/a-5-lts-perspectiva-1.png'),
      ('elite-max-10l', '/imagenes-web/fotos-productos/10-litros-juntos.jpg', 'Elite Max 10L Parte 1 + Parte 2', '/imagenes-web/productos/elite-max/a-10-lts-perspectiva-1.png'),
      ('elite-max-20l', '/imagenes-web/fotos-productos/max20ltjuntos.jpg',    'Elite Max 20L Parte 1 + Parte 2', '/imagenes-web/productos/elite-max/a-20-lts-perspectiva-1.png')
    ) AS v(slug, url, alt, old_url), products p
    WHERE p.slug = v.slug AND pi.product_id = p.id AND pi.url = v.old_url
  `, "elite max fotos par");
  // Bidones "Parte B" industriales fuera del catálogo (no se venden sueltos).
  // Desactivación, no DELETE: pueden estar en orders viejas.
  await safeQuery(`
    UPDATE products SET active = FALSE
    WHERE active = TRUE AND slug IN (
      'elite-max-5l-b','elite-max-10l-b'
    )
  `, "deactivate elite bidones parte B");
  // Elite Parte 1 y Parte 2 SE VENDEN SUELTAS (pedido cliente 2026-06-08).
  // Re-activación explícita para DBs donde la migración anterior las apagó.
  await safeQuery(`
    UPDATE products SET active = TRUE
    WHERE active = FALSE AND slug IN (
      'elite-parte-1-500ml','elite-parte-1-1l',
      'elite-parte-2-500ml','elite-parte-2-1l'
    )
  `, "reactivate elite partes sueltas");

  // 3) Precios reales (hgrowshop.com, jun 2026). Guard por placeholder.
  await safeQuery(`
    UPDATE products p SET price_cents = v.real
    FROM (VALUES
      -- Línea Pro: mismas tarifas las 4 etapas
      ('pro-enraizante-25gr',  1500000,  1536700), ('pro-vegetativo-25gr',  1500000,  1536700),
      ('pro-preflora-25gr',    1500000,  1536700), ('pro-flora-25gr',       1500000,  1536700),
      ('pro-enraizante-100gr', 4500000,  2568500), ('pro-vegetativo-100gr', 4500000,  2568500),
      ('pro-preflora-100gr',   4500000,  2568500), ('pro-flora-100gr',      4500000,  2568500),
      ('pro-enraizante-500gr', 12000000, 7093800), ('pro-vegetativo-500gr', 12000000, 7093800),
      ('pro-preflora-500gr',   12000000, 7093800), ('pro-flora-500gr',      12000000, 7093800),
      ('pro-enraizante-1kg',   18000000, 11330400),('pro-vegetativo-1kg',   18000000, 11330400),
      ('pro-preflora-1kg',     18000000, 11330400),('pro-flora-1kg',        18000000, 11330400),
      -- Elite en pares
      ('elite-juntos-1l',      22000000, 11075500),
      ('elite-max-5l',         45000000, 33774900),
      ('elite-max-10l',        85000000, 56837200),
      ('elite-max-20l',        150000000, 99730000),
      -- Bio / Day-0 / Cloner
      ('bio-estimulante-500ml', 5500000, 4758800),
      ('bio-estimulante',       8500000, 4758800),
      ('day-0-500ml',           5500000, 2280200),
      ('day-0',                 7500000, 2280200),
      ('cloner',                6500000, 2156000)
    ) AS v(slug, placeholder, real)
    WHERE p.slug = v.slug AND p.price_cents = v.placeholder
  `, "precios reales hgrowshop");

  // ─── Bundles (Diseño C): marcar los 3 "kit" de línea como bundles ─────────
  // meta.bundle=true → "comprar junto". bundle_line conecta con las variantes
  // individuales (capa derivada en variantGroup/buildBundle). bundle_discount_pct
  // es el % de ahorro vs comprar separado (configurable después desde admin).
  // Idempotente: solo setea si meta todavía no tiene 'bundle' (no pisa ajustes).
  await safeQuery(
    `UPDATE products SET meta = meta || '{"bundle":true,"bundle_line":"race","bundle_discount_pct":10}'::jsonb
       WHERE slug='linea-race' AND NOT (meta ? 'bundle')`, "bundle race");
  await safeQuery(
    `UPDATE products SET meta = meta || '{"bundle":true,"bundle_line":"pro","bundle_discount_pct":10}'::jsonb
       WHERE slug='linea-pro' AND NOT (meta ? 'bundle')`, "bundle pro");
  await safeQuery(
    `UPDATE products SET meta = meta || '{"bundle":true,"bundle_line":"elite","bundle_discount_pct":10}'::jsonb
       WHERE slug='linea-elite' AND NOT (meta ? 'bundle')`, "bundle elite");

  // ─── Packs de puntos (F3.2): comprar puntos como producto del shop ─────────
  // Precio = puntos × buy_price ($3.600/pto). Lineup según spec v9 §11.4:
  // 10 / 25 / 50 / 100 puntos + "cantidad libre". Al pagar, onOrderPaid acredita
  // meta.points_pack × quantity como compra_puntos (ver shopNotify.creditOrderPoints).
  // "Cantidad libre" (puntos-custom): producto unitario de 1 punto ($3.600). El
  // cliente elige N en la ficha → carrito quantity=N → se acreditan N puntos.
  await safeQuery(
    `INSERT INTO product_categories (slug, name, description, sort_order)
     VALUES ('puntos', 'Puntos', 'Comprá puntos Holistic y canjealos por descuentos o premios', 50)
     ON CONFLICT (slug) DO NOTHING`, "cat puntos");
  await safeQuery(`
    INSERT INTO products (slug, name, short_description, price_cents, sku, category_id, featured, sort_order, meta)
    SELECT v.slug, v.name, v.short, v.price, v.sku, c.id, FALSE, v.sort, v.meta::jsonb
    FROM (VALUES
      ('puntos-custom',   'Puntos Holistic', 'Elegí cuántos querés · 1 punto = $3.600 · se acreditan al pagar.', 360000, 'PACK-PTS-CUSTOM', 'puntos', 49, '{"points_pack":1,"points_custom":true}'),
      ('pack-10-puntos',  'Pack 10 puntos',  'Sumá 10 puntos a tu cuenta (se acreditan al pagar).',    3600000, 'PACK-PTS-10',  'puntos', 50, '{"points_pack":10}'),
      ('pack-25-puntos',  'Pack 25 puntos',  'Sumá 25 puntos a tu cuenta (se acreditan al pagar).',    9000000, 'PACK-PTS-25',  'puntos', 51, '{"points_pack":25}'),
      ('pack-50-puntos',  'Pack 50 puntos',  'Sumá 50 puntos a tu cuenta (se acreditan al pagar).',   18000000, 'PACK-PTS-50',  'puntos', 52, '{"points_pack":50}'),
      ('pack-100-puntos', 'Pack 100 puntos', 'Sumá 100 puntos a tu cuenta (se acreditan al pagar).',  36000000, 'PACK-PTS-100', 'puntos', 53, '{"points_pack":100}')
    ) AS v(slug, name, short, price, sku, cat_slug, sort, meta)
    JOIN product_categories c ON c.slug = v.cat_slug
    ON CONFLICT (slug) DO NOTHING`, "packs puntos");
  // Migración v1.0: re-precio de packs a $3.600/pto en deploys que aún tengan el
  // precio previo ($1.600/pto). Acotado al valor viejo → no pisa un precio que el
  // admin haya cambiado a mano.
  await safeQuery(`
    UPDATE products SET price_cents=18000000 WHERE slug='pack-50-puntos'  AND price_cents=8000000;
    UPDATE products SET price_cents=36000000 WHERE slug='pack-100-puntos' AND price_cents=16000000;
  `, "repricing packs puntos v1.0");
  // Alineación v9 §11.4: lineup 10/25/50/100. Reordenar los packs que ya existían
  // y desactivar pack-250 (no DELETE: puede estar en orders viejas). Idempotente.
  await safeQuery(`
    UPDATE products SET sort_order=52 WHERE slug='pack-50-puntos'  AND sort_order=50;
    UPDATE products SET sort_order=53 WHERE slug='pack-100-puntos' AND sort_order=51;
    UPDATE products SET active=FALSE  WHERE slug='pack-250-puntos' AND active=TRUE;
  `, "lineup packs puntos v9");

  // Imagen de los packs de puntos: la MONEDA HOLISTIC oficial (pedido cliente
  // 2026-07-02 — antes era un SVG 💎 genérico). Servida desde landing/public.
  // NOT EXISTS para idempotencia (no pisa una imagen que el admin haya cargado).
  await safeQuery(`
    INSERT INTO product_images (product_id, url, alt, sort_order, is_primary)
    SELECT p.id, '/imagenes-web/coins/moneda-holistic.webp', p.name, 0, TRUE
    FROM products p
    WHERE p.slug IN ('puntos-custom','pack-10-puntos','pack-25-puntos','pack-50-puntos','pack-100-puntos')
      AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = p.id)
  `, "img packs puntos");
  // Migración: los packs que ya tienen el SVG diamante viejo → moneda oficial.
  // Sólo matchea la URL del SVG, así no pisa imágenes custom del admin. Idempotente.
  await safeQuery(`
    UPDATE product_images
    SET url = '/imagenes-web/coins/moneda-holistic.webp'
    WHERE url = '/imagenes-web/productos/puntos/pack-puntos.svg'
  `, "packs puntos → moneda oficial");

  // ─── Day-0 y Bio: sacar la presentación 1L (sin stock — cliente 2026-07-02) ──
  // Desactivar los SKUs -1l (no DELETE: pueden estar en orders viejas) y limpiar
  // meta.presentaciones de los kits base. jsonb_set preserva otras keys del meta.
  // Idempotente (corre en prod y en instalaciones nuevas tras el seed).
  await safeQuery(`
    UPDATE products SET active = FALSE
      WHERE active = TRUE AND slug IN ('bio-estimulante-1l','day-0-1l');
    UPDATE products SET meta = jsonb_set(meta, '{presentaciones}', '["500ml"]'::jsonb)
      WHERE slug IN ('bio-estimulante','day-0') AND meta ? 'presentaciones';
  `, "sacar 1L de day-0 y bio");

  // ─── Accesorios (2026-06-08): importados de hgrowshop.com (tienda real) ─────
  // Productos que la tienda WooCommerce de Holistic tiene y el portal no traía.
  // Precios de hgrowshop.com (jun 2026); el cliente los ajusta desde el admin.
  // Idempotente: categoría + productos con ON CONFLICT DO NOTHING, imágenes con
  // NOT EXISTS (no pisa lo que el admin edite después). Sólo AGREGA — no toca
  // ningún producto/categoría existente.
  await safeQuery(
    `INSERT INTO product_categories (slug, name, description, sort_order)
     VALUES ('accesorios', 'Accesorios', 'Accesorios para cultivo', 10)
     ON CONFLICT (slug) DO NOTHING`, "cat accesorios");
  await safeQuery(`
    INSERT INTO products (slug, name, short_description, price_cents, sku, category_id, featured, sort_order, meta)
    SELECT v.slug, v.name, v.short, v.price, v.sku, c.id, FALSE, v.sort, v.meta::jsonb
    FROM (VALUES
      ('filtro-de-agua',       'Filtro de agua',                'Filtro de agua para riego.',                           8142000, 'ACC-FILTRO',   'accesorios', 64, '{"accesorio":true}')
    ) AS v(slug, name, short, price, sku, cat_slug, sort, meta)
    JOIN product_categories c ON c.slug = v.cat_slug
    ON CONFLICT (slug) DO NOTHING`, "seed accesorios");
  await safeQuery(`
    INSERT INTO product_images (product_id, url, alt, sort_order, is_primary)
    SELECT p.id, v.url, p.name, 0, TRUE
    FROM (VALUES
      ('filtro-de-agua',       '/imagenes-web/productos/accesorios/filtro-de-agua.jpg')
    ) AS v(slug, url)
    JOIN products p ON p.slug = v.slug
    WHERE NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = p.id)
  `, "img accesorios");
  // Croper / Tutores / Maceta fuera del catálogo (pedido cliente 2026-06-10).
  // Desactivación, no DELETE: pueden estar en orders viejas (FK ON DELETE SET NULL,
  // pero conservamos la fila para el historial). Idempotente por el guard active=TRUE.
  await safeQuery(`
    UPDATE products SET active = FALSE
    WHERE active = TRUE AND slug IN (
      'croper-simple-x10','croper-regulable-x10','tutores-x10','maceta-x10'
    )
  `, "deactivate croper/tutores/maceta");

  // ─── Re-author autoritativo de imágenes (2026-06-08) ──────────────────────
  // Última palabra sobre product_images: para cada slug del set canónico
  // (routes/shopImageSet.js) borra sus filas y reinserta el set correcto.
  // Resuelve de raíz el problema de las imágenes rotas en prod (la DB quedó
  // con URLs que ningún bloque de reconciliación matcheaba por old_url exacto).
  // Corre UNA vez por IMAGE_SET_VERSION (marcador en shop_migrations): el
  // próximo deploy de Render arregla todo y los boots siguientes son no-op
  // (no pisa lo que el admin edite después). Subir la versión re-aplica.
  try {
    const res = await reauthorProductImages(db);
    if (res.applied) console.log(`[SHOP MIGRATE] re-author imágenes: ${res.slugs} productos`);
  } catch (e) {
    console.error("[SHOP MIGRATE reauthor images]", e.message || e);
  }

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

  // Tracking de envío (idempotente): carrier elegido por el admin al despachar
  // + número de seguimiento. carrier ∈ andreani | correo_argentino | via_cargo | propio.
  await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier         TEXT`);
  await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number TEXT`);

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

  // ═════════════════════════════════════════════════════════════════════════
  // F5: PROMO CODES — descuentos aplicables en checkout
  // ═════════════════════════════════════════════════════════════════════════
  //
  // kind=percent: value = 0-100 (porcentaje del subtotal)
  // kind=fixed_cents: value = monto en centavos a descontar
  // min_subtotal_cents = monto mínimo requerido (0 = sin mínimo)
  // max_uses NULL = ilimitado; INT = capped al N
  // current_uses = contador incrementado cada checkout exitoso
  // expires_at NULL = sin expiración
  await db.query(`
    CREATE TABLE IF NOT EXISTS promo_codes (
      id                    SERIAL PRIMARY KEY,
      code                  TEXT UNIQUE NOT NULL,
      kind                  TEXT NOT NULL CHECK (kind IN ('percent', 'fixed_cents')),
      value                 INT NOT NULL CHECK (value > 0),
      min_subtotal_cents    INT NOT NULL DEFAULT 0,
      max_uses              INT,
      current_uses          INT NOT NULL DEFAULT 0,
      expires_at            TIMESTAMPTZ,
      active                BOOLEAN NOT NULL DEFAULT TRUE,
      notes                 TEXT,
      created_by            INT REFERENCES users(id) ON DELETE SET NULL,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(active, expires_at) WHERE active = TRUE`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_promo_codes_code_upper ON promo_codes(UPPER(code))`);

  // Agregar columnas a orders para tracking del descuento aplicado (idempotente).
  await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code TEXT`);
  await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_cents INT NOT NULL DEFAULT 0`);
  // Puntos (F3): flag idempotente para no acreditar dos veces al pagar.
  await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS points_credited BOOLEAN NOT NULL DEFAULT FALSE`);

  // Seed de códigos TEST para que el admin pueda probar el flow inmediato.
  await db.query(`
    INSERT INTO promo_codes (code, kind, value, max_uses, notes, active)
    VALUES
      ('TEST10',  'percent', 10,  NULL, 'Código de prueba seed — 10% off, ilimitado', TRUE),
      ('FULLOFF', 'percent', 100, NULL, 'Código test 100% off — compra gratis (skip MercadoPago, marca paid directo)', TRUE)
    ON CONFLICT (code) DO NOTHING
  `);
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

// ─────────────────────────────────────────────────────────────────────────────
// VARIANTES / FAMILIAS / BUNDLES / CROSS-SELL (Diseño C)
// Capa derivada de products.meta — sin tablas nuevas. Las variantes ya existen
// como productos separados (meta.linea/etapa/parte/formato); acá las agrupamos.
// ─────────────────────────────────────────────────────────────────────────────

const FMT_LABEL = {
  "250ml": "250 ml", "500ml": "500 ml", "1L": "1 L", "5L": "5 L", "10L": "10 L", "20L": "20 L",
  "25g": "25 g", "100g": "100 g", "500g": "500 g", "1kg": "1 kg",
};
const FMT_ORDER = {
  "25g": 1, "100g": 2, "500g": 3, "1kg": 4,
  "250ml": 1, "500ml": 2, "1L": 3, "5L": 4, "10L": 5, "20L": 6,
};
// Tokens de medida embebidos en el name (para derivar el nombre de familia).
const SIZE_RE = /\b(250\s?ml|500\s?ml|1\s?L|5\s?L|10\s?L|20\s?L|25\s?g|100\s?g|500\s?g|1\s?kg)\b/gi;

// Clave de familia (mismo producto, distinta medida). null = no agrupable
// (bundles, combos, o SKUs sin formato → quedan solos).
function variantGroup(meta = {}) {
  if (meta.bundle || meta.tipo === "combo") return null;
  const fmt = meta.formato;
  if (!fmt) return null;
  const l = meta.linea;
  if (l === "race")  return `race-${meta.etapa}${meta.parte ? "-" + meta.parte : ""}`;
  if (l === "pro")   return `pro-${meta.etapa}`;
  if (l === "elite") return meta.tipo === "bidon"
        ? `elite-max-${String(meta.parte || "a").toLowerCase()}`
        : `elite-parte-${meta.parte}`;
  if (l) return `linea-${l}`; // bio, day0, etc → agrupan por línea
  return null;
}
const variantLabel = (meta = {}) => (meta.formato ? (FMT_LABEL[meta.formato] || meta.formato) : null);
const variantOrder = (meta = {}) => (meta.formato ? (FMT_ORDER[meta.formato] ?? 99) : 99);

// Nombre de familia: el name sin el token de medida ("Race 1 — NPK 250ml" → "Race 1 — NPK").
function familyName(name = "") {
  return name.replace(SIZE_RE, "").replace(/\s*[—-]\s*$/, "").replace(/\s{2,}/g, " ").trim();
}

// Resumen liviano de una variante para el selector de medida.
function variantSummary(row, img) {
  const m = row.meta || {};
  return {
    id: row.id,
    slug: row.slug,
    sku: row.sku,
    name: row.name,
    label: variantLabel(m) || row.name,
    formato: m.formato || null,
    order: variantOrder(m),
    price_cents: row.price_cents,
    price_formatted: formatARS(row.price_cents),
    stock: row.stock,
    primary_image: img || null,
  };
}

// Cross-sell curado por línea (slugs sugeridos para "te olvidaste / acompañar").
const CROSS_SELL_BY_LINE = {
  race:  ["bio-estimulante-500ml", "day-0-500ml", "cloner"],
  pro:   ["bio-estimulante-500ml", "day-0-500ml", "cloner"],
  elite: ["bio-estimulante-500ml", "day-0-500ml", "cloner"],
  bio:   ["day-0-500ml", "cloner"],
  day0:  ["bio-estimulante-500ml", "cloner"],
};
function crossSellSlugsFor(meta = {}) {
  const line = meta.bundle_line || meta.linea;
  return CROSS_SELL_BY_LINE[line] || ["bio-estimulante-500ml", "day-0-500ml", "cloner"];
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

// Imagen primaria (url) de un map de imágenes para un product id.
function primaryUrl(imagesMap, id) {
  const imgs = imagesMap.get(id) || [];
  return imgs.find((i) => i.is_primary)?.url || imgs[0]?.url || null;
}

// Trae filas de productos activos por lista de slugs (preserva el orden de entrada).
async function fetchRowsBySlugs(slugs) {
  if (!slugs.length) return [];
  const { rows } = await db.query(
    `SELECT * FROM products WHERE slug = ANY($1::text[]) AND active = TRUE`, [slugs]);
  const imagesMap = await loadImagesFor(rows.map((r) => r.id));
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  return slugs.map((s) => bySlug.get(s)).filter(Boolean)
    .map((r) => ({ row: r, img: primaryUrl(imagesMap, r.id) }));
}

// Trae todas las variantes activas de una línea (meta.linea = X) con su imagen.
async function fetchLineRows(linea) {
  if (!linea) return [];
  const { rows } = await db.query(
    `SELECT * FROM products WHERE active = TRUE AND meta->>'linea' = $1`, [linea]);
  const imagesMap = await loadImagesFor(rows.map((r) => r.id));
  return rows.map((r) => ({ row: r, img: primaryUrl(imagesMap, r.id) }));
}

// Agrupa una lista de productos YA serializados en familias (1 por variantGroup).
// Los no agrupables quedan como familia de 1 (group: null).
function groupIntoFamilies(products) {
  const buckets = new Map();
  const order = [];
  for (const p of products) {
    const g = variantGroup(p.meta);
    const key = g || `solo:${p.slug}`;
    if (!buckets.has(key)) { buckets.set(key, []); order.push(key); }
    buckets.get(key).push(p);
  }
  const families = order.map((key) => {
    const items = buckets.get(key).slice().sort((a, b) => variantOrder(a.meta) - variantOrder(b.meta));
    // Cabecera de la familia = la que ve el catálogo (slug, imagen, precio "desde").
    // El admin puede fijar la "medida destacada" marcando una variante con
    // meta.medida_destacada=true → esa abre desde el catálogo. Si no, la de menor orden.
    const head = items.find((i) => i.meta?.medida_destacada === true) || items[0];
    const isFamily = !key.startsWith("solo:");
    const prices = items.map((i) => i.price_cents).filter((v) => v != null);
    return {
      group: isFamily ? key : null,
      slug: head.slug,
      name: isFamily ? familyName(head.name) : head.name,
      short_description: head.short_description,
      category: head.category,
      meta: head.meta,
      featured: items.some((i) => i.featured),
      primary_image: head.primary_image,
      from_price_cents: prices.length ? Math.min(...prices) : null,
      from_price_formatted: prices.length ? formatARS(Math.min(...prices)) : null,
      variant_count: items.length,
      variants: items.map((i) => ({
        id: i.id, slug: i.slug, sku: i.sku,
        label: variantLabel(i.meta) || i.name,
        formato: i.meta?.formato || null,
        price_cents: i.price_cents, price_formatted: i.price_formatted,
        stock: i.stock, primary_image: i.primary_image,
      })),
    };
  });

  // Dedupe: ocultar el producto "kit" suelto (ej. bio-estimulante, day-0) cuando
  // ya existe una familia de variantes que lo cubre (sus slugs lo prefijan).
  // No afecta bundles (linea-*) ni productos sin variantes (cloner).
  const variantSlugs = new Set();
  for (const f of families) if (f.group) for (const v of f.variants) variantSlugs.add(v.slug);
  return families.filter((f) => {
    if (f.group || f.meta?.bundle) return true;
    const redundant = [...variantSlugs].some((s) => s.startsWith(f.slug + "-"));
    return !redundant;
  });
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

      // ?grouped=1 → 1 entrada por familia (variantes agrupadas por medida).
      if (req.query.grouped === "1" || req.query.grouped === "true") {
        const families = groupIntoFamilies(products);
        return res.json({ families, count: families.length });
      }

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

      // ── Diseño C: variantes (medidas), bundle y cross-sell ──
      const meta = product.meta || {};
      const grp = variantGroup(meta);
      const lineRows = meta.linea ? await fetchLineRows(meta.linea) : [];

      // Variantes: hermanos de la misma familia (otras medidas del mismo producto).
      let variants = [];
      if (grp) {
        variants = lineRows
          .filter((x) => variantGroup(x.row.meta) === grp)
          .map((x) => variantSummary(x.row, x.img))
          .sort((a, b) => a.order - b.order);
      }

      // Producto "base" sin formato propio (ej. bio-estimulante, day-0) que
      // tiene variantes-hijas por medida (bio-estimulante-250ml/500ml/1l).
      // Sin esto, su página queda sin selector de medida. Las adjuntamos para
      // que ofrezca las mismas medidas que la familia (cada pill navega al SKU).
      if (!grp && !meta.bundle && !variants.length) {
        const { rows: kids } = await db.query(
          `SELECT * FROM products
             WHERE active = TRUE AND slug LIKE $1 AND meta ? 'formato'`,
          [`${product.slug}-%`]
        );
        if (kids.length) {
          const kidImgs = await loadImagesFor(kids.map((k) => k.id));
          variants = kids
            .map((k) => variantSummary(k, primaryUrl(kidImgs, k.id)))
            .filter((v) => v.formato)
            .sort((a, b) => a.order - b.order);
        }
      }

      // Contenido editorial curado por el admin desde el panel (meta.editorial).
      // Lo que el admin no defina cae al comportamiento automático de siempre.
      const editorial = (meta.editorial && typeof meta.editorial === "object") ? meta.editorial : {};

      // Bundle: si este producto es el "kit" de la línea, listamos las familias incluidas.
      let bundle = null;
      if (meta.bundle) {
        // Override del admin: lista explícita de slugs ("Incluye la línea
        // completa" editable). Se agrupan por familia para conservar el
        // selector de medidas; si no hay override, se deriva de la línea.
        const manual = Array.isArray(editorial.bundle_includes_slugs)
          ? editorial.bundle_includes_slugs.filter((s) => s && s !== product.slug)
          : [];
        const fams = new Map();
        if (manual.length) {
          for (const x of await fetchRowsBySlugs(manual)) {
            const g = variantGroup(x.row.meta) || x.row.slug;
            if (!fams.has(g)) fams.set(g, { group: g, name: familyName(x.row.name), variants: [] });
            fams.get(g).variants.push(variantSummary(x.row, x.img));
          }
        } else {
          for (const x of lineRows) {
            const g = variantGroup(x.row.meta);
            if (!g) continue;
            if (!fams.has(g)) fams.set(g, { group: g, name: familyName(x.row.name), variants: [] });
            fams.get(g).variants.push(variantSummary(x.row, x.img));
          }
        }
        const includes = [...fams.values()];
        includes.forEach((f) => f.variants.sort((a, b) => a.order - b.order));
        // Orden estable por nombre ("Race 1 — NPK" < "Race 2 — ..." < "Race 3
        // — PK 1ª parte" < "Race 3 — PK 2ª parte" < "Race 4 — ..."): el Map se
        // arma en orden de llegada de la query y el front lo muestra tal cual.
        includes.sort((a, b) => a.name.localeCompare(b.name, "es"));
        bundle = {
          line: meta.bundle_line || meta.linea || null,
          discount_pct: meta.bundle_discount_pct ?? 0,
          includes,
        };
      }

      // Cross-sell: "Sumá para acompañar". El admin elige los slugs desde el
      // panel (editorial.cross_sell_slugs); sin eso, cae al set curado por línea.
      const csSlugs = (Array.isArray(editorial.cross_sell_slugs) && editorial.cross_sell_slugs.length)
        ? editorial.cross_sell_slugs
        : crossSellSlugsFor(meta);
      const csRows = await fetchRowsBySlugs(
        csSlugs.filter((s) => s && s !== product.slug)
      );
      const cross_sell = csRows.map((x) => variantSummary(x.row, x.img));

      res.json({ product: { ...product, variant_group: grp, variants, bundle, cross_sell } });
    } catch (e) {
      console.error("[shop.public product detail]", e);
      res.status(500).json({ error: "Error al obtener producto" });
    }
  });

  // GET /api/shop/cross-sell — complementarios curados (para el carrito).
  // "te olvidaste / sirve para acompañar". Set genérico por ahora.
  router.get("/cross-sell", async (_req, res) => {
    try {
      const rows = await fetchRowsBySlugs(["bio-estimulante-500ml", "day-0-500ml", "cloner"]);
      res.json({ products: rows.map((x) => variantSummary(x.row, x.img)) });
    } catch (e) {
      console.error("[shop.public cross-sell]", e);
      res.status(500).json({ error: "Error al obtener cross-sell" });
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
  // Zod v4: z.record() exige (keySchema, valueSchema). Con un solo argumento
  // (forma de Zod v3) tira un TypeError al parsear un meta con claves, que el
  // catch reporta como un "Datos inválidos" sin detalle. meta es un mapa libre.
  meta: z.record(z.string(), z.any()).optional(),
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

  // ── POST /api/admin/shop/products/upload-image — subir imagen a Cloudinary
  // Recibe un archivo (campo `image`, multipart) y devuelve { ok, url }. El
  // cliente pega esa url en la fila de imagen del producto y guarda como siempre.
  // El error de multer (tipo / tamaño) se devuelve limpio en vez de tirar 500.
  router.post(
    "/products/upload-image",
    ...writeMw,
    (req, res, next) => {
      uploadImage.single("image")(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message });
        next();
      });
    },
    async (req, res) => {
      try {
        if (!req.file) return res.status(400).json({ error: "No se recibió ninguna imagen" });
        const cloudinary = await configureCloudinary();
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "portal-shop", resource_type: "image" },
            (error, out) => { if (error) reject(error); else resolve(out); }
          );
          stream.end(req.file.buffer);
        });
        res.json({ ok: true, url: result.secure_url });
      } catch (e) {
        console.error("[SHOP IMAGE UPLOAD]", e.message);
        res.status(500).json({ error: e.message });
      }
    }
  );

  // ── POST /api/admin/shop/migrate-images-to-cloudinary — one-shot
  // Sube a Cloudinary las imágenes de producto que todavía son paths estáticos
  // y reapunta las filas de product_images, para que el admin las controle de
  // punta a punta. Idempotente (saltea las que ya son Cloudinary). El cliente
  // manda { host } = window.location.origin (de donde Cloudinary baja los renders).
  router.post("/migrate-images-to-cloudinary", ...writeMw, async (req, res) => {
    try {
      const cloudinary = await configureCloudinary();
      const host =
        (req.body && typeof req.body.host === "string" && req.body.host.trim()) ||
        process.env.PUBLIC_ASSETS_URL || process.env.APP_URL;
      if (!host) {
        return res.status(400).json({ error: "Falta host (origen público de las imágenes)" });
      }
      const result = await migrateImagesToCloudinary(db, cloudinary, { host });
      res.json({ ok: true, ...result });
    } catch (e) {
      console.error("[SHOP IMAGE MIGRATE]", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/admin/shop/products — crear
  router.post("/products", ...writeMw, async (req, res) => {
    let body;
    try { body = productSchema.parse(req.body); }
    catch (e) { return res.status(400).json({ error: "Datos inválidos", issues: e.issues }); }

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
    catch (e) { return res.status(400).json({ error: "Datos inválidos", issues: e.issues }); }

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
    catch (e) { return res.status(400).json({ error: "Datos inválidos", issues: e.issues }); }

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
