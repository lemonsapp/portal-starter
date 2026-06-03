# Diseño C — Comprar junto o separado (variantes + bundles) + Cross-sell

Fecha: 2026-06-03 · Estado: **PROPUESTA (a confirmar antes de construir)**

## 1. Problema

El cliente quiere que en el shop cada línea se pueda comprar:
- **Junta** (toda la línea / kit) o **separada** (productos individuales).
- En **varias medidas** (formatos), eligiendo la medida desde el producto.
- Y que adentro del producto haya **cross-sell**: "te olvidaste un producto" / "esto sirve para acompañar", para incentivar compra mayor.

Aplica a: **Línea Race** (5 productos: R1, R2, R3-1ª, R3-2ª, R4), **Línea Pro** (4 etapas), **Elite Max** (Parte 1 + Parte 2 / bidones).

## 2. Estado actual (lo que ya hay)

- Tabla `products`: cada SKU es una fila (`slug, name, price_cents, stock, sku, category_id, meta jsonb`).
- Tabla `product_images`, `product_categories`.
- **~46 filas ya sembradas**: 6 "kits" (linea-race, linea-elite, linea-pro, bio, cloner, day-0) + ~40 individuales con `meta`:
  - Race: `{linea:"race", etapa:"npk|estructura|pk|micro", formato:"250ml|500ml", color, parte}`
  - Elite: `{linea:"elite", parte:"1|2|A|B", formato:"500ml|1L|5L|10L|20L", tipo:"combo|bidon"}`
  - Pro: `{linea:"pro", etapa:"enraizante|vegetativo|preflora|flora", formato:"25g|100g|500g|1kg"}`
- Carrito: client-side (`useCart.js`), agrega `product` completo.
- **No hay**: selector de medida en el producto, agrupación de variantes en una card, bundles reales con precio, ni cross-sell.

## 3. Decisión de modelo de datos

**Opción elegida: grupos + variantes derivados de `meta` (sin tablas nuevas pesadas) + un flag de bundle.**

Razón: las variantes **ya existen como productos**. En vez de migrar a `product_variants`, agregamos una capa fina de agrupación:

### 3.1 Agrupación de variantes (mismo producto, distinta medida)
Agregar a cada SKU individual en `meta`:
- `group` (string): clave de familia. Ej: `race-1-npk`, `pro-enraizante`, `elite-parte-1`.
- `variant_label` (string): la medida visible. Ej: `250 ml`, `1 kg`, `5 L`.
- `variant_order` (int): orden del selector.

La API agrupa por `meta.group`: la **card del catálogo** muestra 1 sola entrada por familia (con "desde $X"), y la **interna** muestra un **selector de medida** que cambia precio/imagen/SKU entre hermanos.

### 3.2 Bundles (comprar toda la línea junta)
Un bundle es un `products` row con:
- `meta.bundle = true`
- `meta.bundle_items = [{ group, formato }]` (o lista de slugs) → qué incluye.
- `meta.bundle_line = "race|pro|elite"`
- Precio propio (`price_cents`) que puede tener **descuento** vs la suma de individuales.

Bundles a crear/normalizar:
- **Race completo** (R1+R2+R3·1ª+R3·2ª+R4) por formato (250ml, 500ml, …).
- **Kit Pro** (4 etapas) por formato (25g/100g/500g/1kg) — ya existen como "kits".
- **Elite Parte 1 + Parte 2** por formato (combo) — ya existe en 1L; extender a otros.

En la interna del bundle: toggle **"Comprar junta (kit) / por separado"**. "Por separado" lleva a las cards individuales de la línea.

### 3.3 ¿Por qué no tablas nuevas?
- Cero migración riesgosa; reusa el seed existente.
- El admin sigue editando productos como hoy.
- Si en el futuro se necesita stock/precio por variante más estricto, se migra a `product_variants` sin romper la UX (la capa de agrupación queda igual).

## 4. UX propuesta

### 4.1 Catálogo (Shop.jsx)
- 1 card por **familia** (no por SKU) → menos ruido. Muestra "desde $X · N medidas".
- Filtros por línea (ya existen).
- Las cards de bundle ("Race completo", "Kit Pro", "Elite 1+2") se destacan.

### 4.2 Interna de producto (ShopProduct.jsx)
- **Selector de medida** (pills): 250ml / 500ml / 1L… → cambia precio, imagen, SKU, stock.
- Si la familia pertenece a una línea con bundle: bloque **"¿Lo querés completo?"** con CTA al bundle (y al revés en el bundle: "comprar por separado").
- Cantidad + Agregar al carrito (del SKU de la medida elegida).

### 4.3 Cross-sell (tarea D, diseñada acá)
Dos puntos de contacto:
1. **En la interna**, sección "Completá tu compra" / "Te olvidaste…":
   - Si es **individual** de una línea → sugerir el **resto de la línea** ("te falta R3 para cerrar el ciclo") + complementarios (Bio, Day-0, Cloner).
   - Si es **bundle** → sugerir add-ons sueltos (Bio Estimulante, Day-0, accesorios) y "sumá una medida más grande".
2. **En el carrito** (drawer): "Sirve para acompañar" con 2–3 sugerencias.

Fuente de sugerencias: **mapa curado de cross-sell** (config en código) por `linea`/`etapa`, + fallback a "más vendidos de la categoría". Simple, controlable, sin ML.

## 5. Cambios técnicos (cuando se construya)

- **Seed/meta**: agregar `group`, `variant_label`, `variant_order` a SKUs; normalizar bundles con `bundle_items`. Migración idempotente en `routes/shop.js` (UPDATE … WHERE meta no tiene group).
- **API**:
  - `GET /api/shop/products` → opción `group=true` que devuelve familias (1 por group) con `from_price`, `variants[]`.
  - `GET /api/shop/products/:slug` → incluir `variants[]` (hermanos por group) y `bundle`/`includes`.
  - Endpoint o campo de `cross_sell[]` por producto.
- **Cliente**: selector de medida en ShopProduct, cards por familia en Shop, bloque bundle, componente `CrossSell`, sugerencias en el cart drawer.
- **Carrito**: agregar por SKU de variante (ya soporta product completo).

## 6. Decisiones a confirmar con el cliente

1. **Modelo**: ¿OK con grupos vía `meta` (rápido) en vez de tablas `product_variants` (más formal pero migración grande)? → *recomendado: meta.*
2. **Descuento por bundle**: ¿el kit/combo cuesta **menos** que la suma de individuales? ¿Qué %? (el doc de puntos sugiere kits ~4% más baratos). → *propuesta: sí, descuento configurable por bundle.*
3. **Catálogo**: ¿1 card por familia (recomendado) o seguir 1 card por SKU?
4. **Cross-sell**: ¿mapa curado por línea (recomendado) o automático por categoría?
