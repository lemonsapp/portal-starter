# Diseño F — Sistema de Puntos y Fidelización Holistic

Fecha: 2026-06-03 · Estado: **PROPUESTA (a confirmar antes de construir)**
Spec fuente: `Sistemas/holistic sistema puntos v3.docx`

## 1. Objetivo

Implementar el programa de puntos de Holistic en el portal: economía interna donde
cada compra (web o externa) y cada acción de comunidad genera puntos canjeables por
descuentos o premios físicos. Reglas de oro:

- **1 punto = $2.000 ARS** de valor de canje (configurable).
- **Comprar 1 punto = $1.600** (20% de beneficio, configurable).
- Funciona para compras **web (automático)** y **externas (WhatsApp/ML/efectivo, carga manual)** vía **código de cliente**.

## 2. Qué hay hoy vs qué falta (mapeo)

| Concepto spec | Hoy en el portal | Acción |
|---|---|---|
| Saldo de puntos | `coins.balance`, `coins.total_earned`, `peak_balance` | **Reusar** (coins = puntos). Sumar `points_redeemed_total`. |
| Historial de movimientos | `coin_transactions(type, amount, reason, created_at)` | **Extender**: tipos del spec + `amount_cents`, `canal`, `operador`. |
| Canjes | `coin_redemptions(item_key, cost)` | **Extender**: `kind(descuento\|premio)`, `discount_pct`, `coupon_code`, `status`, `valor_pesos`. |
| Código de cliente HST-XXXX-XX | `users.client_number` (INT, otra cosa) | **Agregar** `users.customer_code` (TEXT único, inmutable, formato HST-XXXX-XX). |
| Catálogo de premios/descuentos | `REWARDS` hardcodeado en `coins.js` | **Mover a DB** `point_rewards` (admin-editable). |
| Acreditación por compra web | — | **Nuevo**: hook al pagar orden → `floor(total/2000)`. |
| Carga manual (Gaia) | — | **Nuevo**: endpoint admin + panel. |
| Compra de puntos | — | **Nuevo**: "pack de puntos" como producto del shop. |
| Acciones de Instagram | `coin_missions`/`user_missions` (parecido) | **Nuevo flujo** con evidencia + límites + validación manual (puede apoyarse en missions). |
| Descuento → cupón | checkout ya tiene promo code (TEST10) | **Integrar**: el canje genera un cupón de 1 uso aplicable en checkout. |
| Emails | infra de emails existe (`server/emails/`) | **Agregar** templates: código, acreditación, canje, corrección. |

## 3. Modelo de datos (cambios)

```
users
  + customer_code TEXT UNIQUE        -- HST-XXXX-XX, generado al registrar, inmutable

coins (= puntos)                     -- reusar tal cual; opcional + points_redeemed_total INT

coin_transactions  (extender)
  + amount_cents BIGINT              -- monto $ de la compra asociada (si aplica)
  + canal TEXT                       -- web | whatsapp | mercadolibre | efectivo | instagram | compra_puntos | admin
  + operador TEXT                    -- 'sistema' o email del admin
  type: compra_web | compra_externa | compra_puntos | accion_ig
        | canje_descuento | canje_premio | correccion   -- (amplía el enum actual)

point_rewards  (NUEVA — catálogo canjeable, admin-editable)
  id, slug, kind(descuento|premio), label, description,
  cost_points INT, discount_pct INT NULL, market_value_cents BIGINT NULL,
  stock INT NULL, active BOOL, sort_order

point_redemptions  (= coin_redemptions extendida)
  + kind, discount_pct, coupon_code, status(pending|fulfilled|cancelled), market_value_cents

ig_submissions  (NUEVA — evidencias de acciones de comunidad)
  id, user_id, action_key, evidence_url|note, status(pending|approved|rejected),
  points INT, reviewed_by, created_at, reviewed_at
```

Config (todo en `app_config`, prefijo `points.*`, editable desde admin):
`points.peso_per_point=2000`, `points.buy_price=1600`, `points.discount_tiers`(50→5%…500→40%),
`points.ig_actions`(like 5, comentario 15, story 20, foto 50, planta 100, etapa 150, ciclo 500 + límites).

## 4. Flujos

### 4.1 Ganar
- **Compra web**: al pasar la orden a `paid` (webhook MP, ya existe), hook → `floor(total_sin_envio/2000)` puntos, tx `compra_web` canal `web` operador `sistema`. Email de acreditación.
- **Compra externa**: panel admin de Gaia → busca por `customer_code` (autocompletar nombre), ingresa monto + canal + descripción → preview de puntos → acreditar. tx `compra_externa`.
- **Compra de puntos**: producto "Pack de puntos" en el shop (precio = puntos × $1.600). Al pagar → tx `compra_puntos`.
- **Instagram**: cliente sube evidencia (form en "Mis puntos" o WhatsApp) → `ig_submissions(pending)` → Gaia aprueba/rechaza → acredita con límites. tx `accion_ig`.

### 4.2 Canjear
- **Descuento**: cliente elige tier desde "Mis puntos" → valida saldo → descuenta puntos, genera **cupón de 1 uso** (integra con el promo del checkout) → tx `canje_descuento` + email con el cupón.
- **Premio físico**: valida stock + saldo → crea pedido $0 / registro `fulfilled pending` → avisa a Gaia para despacho → tx `canje_premio` + email.

### 4.3 Reglas (del spec)
Redondeo hacia abajo; no acumula sobre envío ni sobre cupón aplicado; puntos sin
vencimiento; personales e intransferibles; correcciones por admin con tx `correccion`.

## 5. UI

### Cliente — "Mis puntos" (evoluciona la página Coins actual)
- Saldo + equivalencia en $ + **código de cliente** visible (copiar).
- Historial de movimientos (tipado, con canal).
- Catálogo de canjes (descuentos + premios) con "te falta X".
- Form "Informar compra externa" y "Enviar evidencia de Instagram".

### Admin — "Puntos" (nueva pestaña en AdminPanel)
- **Carga manual**: código de cliente (autocompletar nombre) + monto + canal + descripción + preview → Acreditar.
- Cola de **evidencias IG** (aprobar/rechazar).
- Cola de **canjes** (descuentos generados / premios a despachar).
- Editor del **catálogo de premios** y de la **config** (valores de punto, tiers, límites IG).

## 6. Integración con lo ya hecho
- **Shop/checkout**: el cupón de canje usa el mismo mecanismo de promo code del checkout.
- **Compra de puntos**: usa el motor de productos/orders existente (un SKU especial).
- **Acreditación**: engancha en la transición de orden `paid` (ya hay webhook MP).

## 7. Fases de construcción (propuesta)

- **F1 — Núcleo económico (MVP):** `customer_code` + coins-as-points + equivalencia $ + historial tipado + **panel admin de carga manual** + página "Mis puntos" con código y saldo. (Lo mínimo para operar el programa con compras externas.)
- **F2 — Canjes:** catálogo en DB (descuentos + premios) + canje de descuento con cupón integrado al checkout + canje de premio + emails.
- **F3 — Acreditación automática web** + **compra de puntos** (pack en shop).
- **F4 — Comunidad Instagram:** submissions + validación admin + límites.

## 8. Decisiones tomadas (2026-06-03)

1. **Etiqueta:** ✅ "Puntos" en toda la UI (la tabla sigue siendo `coins` por dentro).
2. **Código de cliente:** ✅ columna nueva `users.customer_code` (HST-XXXX-XX, única, inmutable).
3. **Arranque:** ✅ por fases, empezando por **F1** (núcleo + panel Gaia).
4. **Premios/config:** ✅ catálogo y valores en DB / `app_config`, editables desde admin.
