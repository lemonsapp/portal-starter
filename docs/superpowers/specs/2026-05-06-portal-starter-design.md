# Spec — Portal Starter (boilerplate clonable con auto-setup wizard)

**Fecha**: 2026-05-06
**Origen**: brainstorming-portal-starter-2026-05-06 (en repo `lemons-portal`)
**Contexto**: el dueño del repo `lemons-portal` (Lemons Argentina) quiere extraer la "parte social" del portal (auth, perfiles, coins, chat, stories, amigos, notifs, PWA) y empaquetarla como un **producto starter clonable** para usar como base de portales en futuros proyectos de su agencia. Ya tiene un primer cliente real (con landing en Astro estático) que va a recibir un portal en `portal.<dominio-cliente>.com`.

---

## 1. Motivación

`lemons-portal` arrancó como un producto único para Lemons (logística USA→AR). Con el tiempo acumuló muchas features distintas: tracking de cargas, herramientas de Instagram/WhatsApp con AI, founder dashboards, generación de imágenes con templates+mascotas, etc. El núcleo "social" (auth, perfiles, coins, chats, stories, amigos) que vive enmedio de todo eso es **reutilizable** y más valioso suelto que pegado a las features específicas de Lemons.

El owner está virando de "cliente único" a **agencia que vende webs/landings y, cuando se pide, portales con cuentas de usuarios**. Necesita un starter que:

1. Replicar para un cliente nuevo en **2-3 días** (no semanas).
2. Permitir al cliente final **auto-configurar** sus servicios externos (Cloudinary, Resend, Telegram, etc.) desde la propia app, sin tocar archivos `.env` ni dashboards de proveedores.
3. Ser modular: el cliente decide qué features encender (chats, stories, friends).
4. Quedar 100% **independiente** por cliente — cada deploy es propio (no SaaS multi-tenant).

## 2. Goals

1. Repo nuevo `portal-starter` con la parte social del portal de Lemons, **migrada limpia** (sin restos de "Lemons", branding centralizado, comentarios actualizados).
2. **Setup wizard** integrado en la propia app, accesible al primer admin que entra después del deploy.
3. Almacenamiento **encriptado** de las API keys que el cliente final pega desde el wizard (con master key pre-deploy).
4. **Sistema de feature flags** que el admin puede activar/desactivar desde el wizard (p.ej. apagar stories si su comunidad no las usa).
5. Panel admin minimalista: gestión de coins + editor del feed (postear actualizaciones al inicio) + edición de configuración.
6. Documentación operativa: cómo deployar un cliente nuevo de cero en 2-3 días.
7. Primer cliente real desplegado y vivo al final del proyecto.

## 3. Non-goals

- **No tocar `lemons-portal`**. El starter se arma en repo nuevo desde cero. Ningún commit toca el repo existente.
- **No SaaS multi-tenant**. Cada cliente tiene su propio deploy + DB + cuentas. El starter NO está pensado para que un solo deploy sirva a varios clientes.
- **No carrito/e-commerce**. Es un add-on potencial para clientes futuros, **fuera del alcance** de este spec.
- **No AI generativa** (Claude/OpenAI/Gemini/Replicate). Ninguna feature de generación AI entra en el v1. Si un cliente la pide, se agrega como módulo después.
- **No WhatsApp ni Instagram tools**. Específicas de Lemons, no entran.
- **No multi-idioma**. v1 en castellano (lengua del owner y de su primer cliente). i18n queda para futuro.
- **No replicar el VPS** (bot ETZ + Baileys WhatsApp). Es infraestructura específica de Lemons, queda fuera.

## 4. Modelo de negocio asociado

- **Cliente paga**: setup único (vos cobrás el proyecto) + costo de servicios externos por mes (Render Starter ~$7, Cloudinary/Resend/Neon free tier alcanzan al inicio).
- **Tu trabajo**: 2-3 días por cliente nuevo cuando el starter esté maduro (clonar, deploy, dominios, primer admin, handoff).
- **Sin lock-in**: el cliente queda dueño de su código. Si después se va, vos no perdés nada porque ya cobraste.

## 5. Stack técnico

Idéntico a `lemons-portal` (probado y conocido por el owner):

| Pieza | Tecnología | Hosting |
|---|---|---|
| Frontend | React + Vite | Vercel (free tier) |
| Backend | Node + Express | Render (Starter ~$7/mes) |
| Base de datos | Postgres serverless | Neon (free tier) |
| Almacenamiento | Cloudinary | free tier |
| Emails | Resend | free tier (3000/mes) |
| Auth biométrico | WebAuthn nativo | — |

**Por qué no cambiar el stack**: el owner lo conoce, ya tiene cuentas, es probado en producción. Cambiar (p.ej. a Next.js) introduce riesgo y curva de aprendizaje sin beneficio claro.

## 6. Arquitectura del repo

Monorepo único:

```
portal-starter/
├── client/                 # React + Vite (Vercel)
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── components/admin/   # NUEVO: panel admin + wizard
│   │   ├── hooks/
│   │   └── lib/
│   │       ├── branding.js     # NUEVO: hook que lee config de marca y aplica CSS vars
│   │       └── featureFlags.js # NUEVO: hook que lee feature flags
│   ├── public/
│   └── vite.config.js
├── server/                 # Express (Render)
│   ├── routes/
│   │   ├── auth.js
│   │   ├── profile.js
│   │   ├── coins.js
│   │   ├── chat.js
│   │   ├── notifications.js
│   │   ├── webauthn.js
│   │   ├── admin-config.js     # NUEVO: endpoints del wizard
│   │   ├── admin-feed.js       # NUEVO: editor del feed
│   │   └── stats.js
│   ├── lib/
│   │   ├── configStore.js      # NUEVO: encriptación + lectura de configs
│   │   ├── featureFlags.js     # NUEVO: lógica de feature flags
│   │   └── ...
│   ├── emails/                 # templates HTML (Resend)
│   ├── jobs/                   # crons (limpios)
│   └── index.js
├── scripts/
│   ├── setup-new-client.js     # NUEVO: genera secrets, prepara branding inicial
│   ├── pg-dump-schema.sh       # NUEVO: snapshot del schema desde Neon
│   └── ...
├── docs/
│   ├── DEPLOY.md               # cómo deployar un cliente nuevo de cero
│   ├── CONFIGURACION.md        # guía para el cliente final (post-deploy)
│   └── ARQUITECTURA.md         # explicación técnica para vos como agencia
├── branding.json               # archivo central con defaults de marca
├── .env.example
└── README.md
```

**Por qué monorepo**: cada cliente clona UN solo repo. Mantener UN solo set de archivos por feature. Si fueran 2 repos, doblás el trabajo.

## 7. Inventario de migración (qué se trae de Lemons y qué no)

### 7.1 Backend

**SE TRAE** (con limpieza de referencias a "Lemons" y rutas de envíos):
- `server/auth.js` — login/register/JWT, completo
- `server/db.js` — pool de Postgres con listener de errores 57P01 (Neon serverless)
- `server/mailer.js` — wrapper de Resend
- `server/security.js` — middlewares `authRequired`, `requireRole`
- `server/routes/coins.js` — endpoints de coins (transactions, balances)
- `server/routes/profile.js` — endpoints de perfil
- `server/routes/chat.js` — chats 1-a-1 (filtrar lo que use coins de Lemons-context)
- `server/routes/notifications.js` — notifs
- `server/routes/webauthn.js` — login biométrico
- `server/routes/stats.js` — stats básicas (sacar lo de cargas)
- `server/emails/` — templates HTML (verify, reset, welcome)
- `server/lib/` — helpers genéricos (uno por uno: traer `presence.js`, `tokens.js`, `validation.js`, etc. — NO traer `templateRenderer.js`, `mascots-manifest.json`, `fonts/`)
- `server/jobs/` — crons utilitarios (sacar los de IG/publisher)

**NO SE TRAE**:
- `server/routes/ai.js` (Anthropic/OpenAI/Gemini)
- `server/routes/aiOperator.js`
- `server/routes/external.js` (bot ETZ webhook)
- `server/routes/founderIntelligence.js`
- `server/routes/instagram-ads.js`
- `server/routes/instagram-content.js`
- `server/routes/instagram.js`
- `server/routes/waCRM.js`
- `server/lib/templateRenderer.js`
- `server/lib/mascots-manifest.json`
- `server/lib/fonts/`
- `server/clawfu-skills/`

**NUEVO** (no existe en Lemons, se escribe de cero):
- `server/routes/admin-config.js` — endpoints del setup wizard (`GET /admin/config/status`, `POST /admin/config/:key`, `POST /admin/config/test/:provider`, etc.)
- `server/routes/admin-feed.js` — endpoints para postear actualizaciones al inicio (`POST /admin/feed`, `GET /feed`, `DELETE /admin/feed/:id`)
- `server/lib/configStore.js` — funciones `getConfig(key)`, `setConfig(key, value)`, `testConnection(provider)` con encriptación AES-256-GCM contra `MASTER_KEY` del `.env`
- `server/lib/featureFlags.js` — `isFeatureEnabled(flag)` que lee de `app_config`

### 7.2 Frontend

**SE TRAE** (con limpieza de items de menú, copy de Lemons, rutas atadas a envíos):
- `client/src/pages/Login.jsx`, `Register.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx`, `VerifyEmail.jsx`
- `client/src/pages/HomeClient.jsx` — limpiar de bloques de cargas; queda como home base con feed del admin + widgets sociales
- `client/src/pages/ProfilePage.jsx`, `ProfileStudio.jsx`
- `client/src/pages/LemonCoins.jsx` → renombrar a `Coins.jsx` y limpiar copy
- `client/src/pages/ChatPage.jsx`, `PrivateChatsPage.jsx`
- `client/src/components/Sidebar.jsx`, `Topbar.jsx` — limpiar items hardcoded de Lemons (cargas, IG, etc.)
- `client/src/components/Stories.jsx`, `StoryViewer.jsx`
- `client/src/components/FriendsPanel.jsx`
- `client/src/components/Onboarding*.jsx` — limpiar copy
- `client/src/components/LemonNotification.jsx` → renombrar a `AppNotification.jsx`
- `client/src/components/ToastReward.jsx`
- `client/src/components/ActivateBiometricModal.jsx`, `ConnectedDevicesPanel.jsx`
- `client/src/components/UserName.jsx`, `SkillBadges.jsx`
- `client/src/components/MotionPop.jsx`, `Skeleton.jsx`, `AnimatedBadge.jsx`, `StatusBadge.jsx`, `PremiumFX.jsx`, `LottieAnim.jsx`
- `client/src/components/PWAManager.jsx`
- `client/src/hooks/usePresence.js`, `usePWA.js`
- `client/src/App.jsx` — limpiar rutas de envíos/IG/founder, mantener auth + social

**NO SE TRAE**:
- `Founder*` (5+ componentes/páginas: `FounderInsights`, `FounderDashboardHero`, `FounderRevenueChart`, `FounderPipeline`, `FounderIntelligencePanel`, `FounderSignalsPanel`, `FounderGodMode`)
- `Instagram*` (Panel, ContentPanel, AdsPanel)
- `WhatsAppCRMPanel`
- `ClientShipments`, `ExternalCargo`, `OperatorPanel`, `CashRegister`, `CoinsOperator`
- `QuotePublic`, `QuoteClient`
- `Dashboard.jsx` (atado a envíos — se reemplaza por una versión "social" simple en `HomeClient`)
- `BarcodeScanner.jsx`, `LinesStatusCard`, `LinesStatusWidget`
- `ClientUpdatePhoneCard`
- `EditorialHero.jsx` (revisar en migración: si tiene contenido genérico se trae)

**NUEVO**:
- `client/src/pages/AdminSetup.jsx` — pantalla del wizard (5 pasos)
- `client/src/pages/AdminPanel.jsx` — panel admin con tabs (Coins / Feed / Settings)
- `client/src/components/admin/CoinsManager.jsx` — UI para regalar/ajustar coins
- `client/src/components/admin/FeedEditor.jsx` — UI para postear actualizaciones al inicio
- `client/src/components/admin/SettingsPage.jsx` — UI para editar configs después del wizard inicial
- `client/src/components/admin/wizard/StepCloudinary.jsx`, `StepBranding.jsx`, `StepEmail.jsx`, `StepTelegram.jsx`, `StepRules.jsx`, `StepFinal.jsx`
- `client/src/lib/branding.js` — hook `useBranding()` que lee config de marca y la aplica como CSS vars
- `client/src/lib/featureFlags.js` — hook `useFeatureFlag(name)` que lee de `/api/config/public`

### 7.3 Base de datos

**SE TRAE** (de Lemons, limpiando columnas específicas de envíos):
- `users` — limpiar columnas tipo `cargas_count`, `lemon_id`, etc.; mantener email/pass/profile/role
- Tablas de coins (transactions, balances)
- Tablas de chat (`chats`, `chat_messages` o como se llamen — confirmar al hacer pg_dump)
- Tablas de stories (`stories`, `story_views`)
- Tabla `friendships`
- Tabla `notifications`
- Tabla `webauthn_credentials`
- Tabla `connected_devices` o `sessions`

**NO SE TRAE**:
- Tablas de cargas, trackings, expenses, income (CashRegister)
- Tablas de Instagram (ideas, ads, posts schedule, etc.)
- Tablas de WhatsApp CRM
- Tablas de founder dashboards (si existen como tablas separadas)

**NUEVO**:
- `app_config` — `key TEXT PRIMARY KEY, value_encrypted TEXT, is_secret BOOL DEFAULT false, updated_at TIMESTAMPTZ, updated_by INT REFERENCES users(id)` — almacén central de configs del wizard
- `app_config_history` — `id SERIAL PK, key TEXT, old_value_hash TEXT, new_value_hash TEXT, changed_by INT REFERENCES users(id), changed_at TIMESTAMPTZ` — audit log de cambios (los hashes son SHA-256 del valor, NO el valor en sí, para no exponer secretos en logs forenses)
- `feed_posts` — `id SERIAL PK, type TEXT (post|story|update), title TEXT, body TEXT, media_url TEXT, author_id INT, created_at TIMESTAMPTZ, expires_at TIMESTAMPTZ NULL` — para que el admin postee al inicio

⚠️ **Nota operativa**: el schema completo de Lemons hay que extraerlo con `pg_dump --schema-only` desde Neon al arrancar el sprint 1. El backup `.sql` que está en el repo (`backup_lemons_2026-04-16T00-28-47.sql`) está desactualizado (abril) — hay que sacar uno fresco.

## 8. El setup wizard (corazón del producto)

### 8.1 Flujo de primer uso

1. Owner deploya el repo `portal-starter` clonado para el cliente. Setea en Render solo 4 env vars críticas:
   - `DATABASE_URL` (creada en Neon)
   - `JWT_SECRET` (`openssl rand -hex 32`)
   - `MASTER_KEY` (`openssl rand -hex 32`) — usada para encriptar las keys que pegue el cliente
   - `APP_URL` (subdominio del cliente, ej. `https://portal.tucliente.com`)
2. Frontend deployado a Vercel con `VITE_API_URL` apuntando al backend de Render.
3. DNS del subdominio configurado (registro CNAME → Vercel).
4. **Primer login** (lo hace el owner-agencia o el cliente final, indistinto): la URL no tiene usuarios → muestra form **"Crear cuenta de administrador"** → email/password/nombre → admin creado con `role='admin'`. Decisión operativa: el owner puede dejar el deploy "vacío" para que lo configure el cliente, o configurarlo él y entregarlo listo.
5. Loguea como admin → sistema detecta `app_config` vacía → redirige a `/admin/setup`.
6. Wizard de 5 pasos:
   - Paso 1: Cloudinary (sin esto no se puede subir logo ni avatars)
   - Paso 2: Marca (nombre, slogan, logo, colores, favicon, fuente)
   - Paso 3: Resend (emails de verify/reset)
   - Paso 4: Telegram (alertas opcionales)
   - Paso 5: Reglas del producto (coins por registro, registro abierto/invitación, features on/off)
   - Verificación final + botón "Empezar"
7. Cualquier paso es saltable (con warnings en los críticos como Resend). Lo que se saltea queda visible como "configuración pendiente" en el dashboard.

### 8.2 Estructura de `app_config`

Entradas tipadas (todas guardadas como strings encriptados, pero con el tipo conocido por la app):

| key | tipo | secret? | descripción |
|---|---|---|---|
| `branding.name` | string | no | nombre del producto |
| `branding.slogan` | string | no | slogan/descripción corta |
| `branding.logo_url` | string | no | URL Cloudinary del logo |
| `branding.favicon_url` | string | no | URL Cloudinary del favicon |
| `branding.color_primary` | string | no | hex |
| `branding.color_accent` | string | no | hex |
| `branding.font_preset` | string | no | "moderna" / "clasica" / "tech" / "friendly" |
| `cloudinary.cloud_name` | string | no | el cloud name no es secreto |
| `cloudinary.api_key` | string | **sí** | encriptado |
| `cloudinary.api_secret` | string | **sí** | encriptado |
| `cloudinary.folder_base` | string | no | carpeta donde uploadea |
| `resend.api_key` | string | **sí** | encriptado |
| `resend.from_email` | string | no | "noreply@..." |
| `resend.from_name` | string | no | nombre del remitente |
| `telegram.bot_token` | string | **sí** | encriptado |
| `telegram.chat_id` | string | **sí** | encriptado |
| `rules.coins_on_register` | int | no | default 100 |
| `rules.coins_on_profile_complete` | int | no | default 50 |
| `rules.coins_on_onboarding_complete` | int | no | default 100 |
| `rules.email_verify_grace_days` | int | no | default 7 |
| `rules.signup_mode` | string | no | "open" \| "invite" |
| `rules.email_verify_required` | bool | no | default true |
| `rules.allow_self_delete` | bool | no | default true |
| `features.chat` | bool | no | default true |
| `features.stories` | bool | no | default true |
| `features.friends` | bool | no | default true |
| `features.coins` | bool | no | default true |
| `features.webauthn` | bool | no | default true |

### 8.3 Encriptación

- Algoritmo: **AES-256-GCM** (estándar Node `crypto`)
- Key: `MASTER_KEY` del `.env` (32 bytes hex)
- Cada valor encriptado guarda `iv:authTag:ciphertext` en base64
- Al desencriptar, si falla (master key cambió, dato corrupto): la app loguea el error y trata el config como ausente (no crashea)
- **`MASTER_KEY` NUNCA se rota** automáticamente. Si hay que rotarla, hay que re-pegar todas las API keys desde el wizard.

### 8.4 Endpoints del wizard

```
GET  /api/admin/config/status          → { branding: ✅, cloudinary: ✅, resend: ❌, ... }
GET  /api/admin/config/:section        → devuelve config sin secretos (p.ej. `cloudinary.cloud_name`, NO el secret)
POST /api/admin/config/:section        → recibe { key: value } y guarda (encriptando si es secret)
POST /api/admin/config/test/:provider  → prueba la conexión al proveedor
DELETE /api/admin/config/:section/:key → borra una entrada (vuelve a estado "pendiente")

GET  /api/config/public                → endpoint NO autenticado, devuelve solo branding + features (sin secretos), usado por el frontend en cada carga
```

### 8.5 Cómo el frontend usa la config

- `useBranding()` hace fetch a `/api/config/public` al cargar la app, y aplica:
  - `document.title = config.branding.name`
  - CSS variables: `--color-primary`, `--color-accent`, font preset
  - Logo en Sidebar/Topbar
- `useFeatureFlag('chat')` devuelve `true|false` y el componente se renderiza condicionalmente
- Si una feature está OFF: la ruta está deshabilitada (404) y los componentes que la usan no se montan

## 9. Panel admin (ya post-wizard)

Tres tabs en `/admin`:

### 9.1 Coins
- Tabla de usuarios con su balance actual
- Botón "Regalar coins" (modal: cantidad + razón)
- Botón "Ajustar saldo" (positive/negative)
- Historial de transacciones (filtrable por usuario, fecha, motivo)

### 9.2 Feed (editor del inicio)
- Editor WYSIWYG simple (título + body markdown + media opcional)
- Lista de posts publicados con botón borrar
- Toggle "tipo": post permanente / story (24hs) / update destacado
- Preview en vivo de cómo se ve en el HomeClient

### 9.3 Settings
- Pestañas espejo del wizard (Marca / Cloudinary / Resend / Telegram / Reglas / Features)
- Cada pestaña: ver estado actual, re-pegar valor, probar conexión
- Botón "Reset a defaults" (con confirmación) para reglas

## 10. Branding centralizado

Punto único de personalización. En el repo:

- `branding.json` — contiene defaults que se cargan a `app_config` en el primer boot:
  ```json
  {
    "name": "Mi Portal",
    "slogan": "Tu comunidad en un solo lugar",
    "color_primary": "#3B82F6",
    "color_accent": "#F59E0B",
    "font_preset": "moderna",
    "fonts": {
      "moderna": "Inter, sans-serif",
      "clasica": "Georgia, serif",
      "tech": "JetBrains Mono, monospace",
      "friendly": "Quicksand, sans-serif"
    }
  }
  ```
- En el frontend, **NINGUNA** referencia hardcoded a "Lemons", "lemonsarg", `#FFC700`. Todo lee de `useBranding()`.
- En el backend, los textos de emails también leen de `app_config` (subject, from name, etc.).

## 11. Sistema de feature flags

- Tabla `app_config` tiene entradas `features.*`
- Backend: middleware `requireFeature("chat")` que devuelve 404 si está apagada (en endpoints específicos)
- Frontend: hook `useFeatureFlag("chat")` para mostrar/esconder UI

Las features que tienen toggle en v1:
- `chat` (default ON)
- `stories` (default ON)
- `friends` (default ON)
- `coins` (default ON)
- `webauthn` (default ON)

Apagar `coins` desactiva: la página `/coins`, el widget de balance en topbar, la tab "Coins" del admin, los rewards por registro/perfil/onboarding.

## 12. Seguridad

- **API keys del cliente**: encriptadas con AES-256-GCM en DB
- **Endpoint de configuración**: requiere `role=admin`
- **Endpoint público de config**: solo devuelve no-secrets (branding + features)
- **Master key**: pre-deploy, en `.env` de Render. Nunca expuesta al frontend
- **Audit log**: cada cambio en `app_config` queda registrado en `app_config_history` (key, old_value_hash, new_value_hash, changed_by, at) para forensics
- **Rate limit** en endpoints de wizard (anti-fuerza bruta)
- **CSRF**: con tokens JWT en headers (igual que Lemons hoy)

## 13. Documentación

3 archivos críticos en `docs/`:

- **`DEPLOY.md`** — para vos como agencia. Paso a paso: crear cuentas Vercel/Render/Neon/Cloudinary para el cliente, clonar repo, setear las 4 env vars, deploy, configurar DNS del subdominio. Incluye screenshots y troubleshooting.
- **`CONFIGURACION.md`** — para el cliente final. "Cuando entrás por primera vez, vas a ver un wizard con 5 pasos. Para cada uno necesitás...". Explica qué es Cloudinary, cómo crear una cuenta, qué keys copiar, etc. Lenguaje no técnico.
- **`ARQUITECTURA.md`** — referencia técnica. Cómo funciona el configStore, cómo agregar una nueva config, cómo hacer migraciones de DB, cómo agregar una nueva feature flag.

## 14. Plan de ejecución (5 sprints + sprint 0)

| Sprint | Duración | Entregable |
|---|---|---|
| **0** | 1 semana | Copy-paste inicial de `lemons-portal` → `portal-starter`. Limpieza quirúrgica con commits dedicados (1 commit por feature borrada): IG tools, WA CRM, Founder dashboards, cargas/trackings, CashRegister, mascotas, AI generativa, bot ETZ. Al final: repo limpio, sin features de Lemons, todavía funciona como antes pero más chico. |
| **1** | 1 semana | Refactor del esqueleto: branding centralizado (CSS vars + `branding.json`), sacar referencias hardcoded a "Lemons", auth completo verificado, primer deploy "esqueleto" en Render+Vercel |
| **2** | 1 semana | `configStore` + encriptación, schema `app_config` aplicado, wizard completo (5 pasos UI), endpoints `/admin/config/*`, tests del configStore |
| **3** | 1 semana | Coins migrados con admin panel, chats 1-a-1, stories, friends, notifications, feed del inicio (con editor admin) |
| **4** | 1 semana | WebAuthn, PWA, onboarding migrado, sistema de feature flags conectado a UI, polish visual, accesibilidad básica |
| **5** | 1 semana | Deploy del primer cliente real: setup de cuentas a su nombre (o del owner), DNS del subdominio, primer admin creado, wizard completado por el cliente, smoke test, handoff y documentación final |

**Total**: 6 semanas calendario para tener:
- Starter clonable y vivo (`portal-starter`)
- Primer cliente real desplegado
- Documentación completa
- Base lista para vender N veces más

## 15. Criterios de éxito

1. Un cliente nuevo se deploya en **2-3 días** desde el sprint 5 en adelante (sin vos tocando el código del starter, solo configurando cuentas y ejecutando el wizard).
2. El starter es **100% genérico**: ninguna referencia a "Lemons" en código, copy, emails o UI.
3. Las API keys del cliente están **encriptadas** en DB. El backend NUNCA loguea secretos.
4. El cliente final puede **hacer su setup completo SIN tocar archivos `.env`** ni dashboards de proveedores externos (excepto crear las cuentas).
5. El primer cliente real está **vivo y operativo** al cierre del sprint 5.
6. Apagar una feature flag (ej. `stories`) **no rompe** la app — solo esconde la UI y deshabilita endpoints.
7. **Lemons-portal sigue intacto** y funcionando — cero commits al repo de Lemons durante este proyecto.

## 16. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El schema de Lemons tiene tablas que asumen contexto de "envíos" pero se usan también en partes sociales (acoplamiento oculto) | Sprint 0/1 arranca con `pg_dump --schema-only` + análisis manual. Cualquier tabla acoplada se desacopla en la migración (puede agregar 1-2 días al sprint). |
| El cliente del owner cambia requerimientos a mitad de proyecto | El starter está pensado genérico. Cualquier feature específica del cliente NO va al starter — va a un fork del cliente. Mantener disciplina de "core vs cliente". |
| Master key se pierde / es comprometida | Documentar que **MASTER_KEY** es como la "llave maestra" — guardarla en un manager de secretos (1Password, Bitwarden) por cada cliente. Si se pierde, hay que re-pegar todas las API keys desde wizard. |
| Costo de Render pasa free tier rápido | Sprint 5 incluye monitoreo de costos. Si Render Starter no alcanza, downgrade a free tier con sleep (acept para clientes con poco tráfico) o upgrade a Standard ($25/mes). |
| Setup wizard tiene un bug y el cliente queda atascado | Cada paso del wizard es **saltable**. La app boot-ea OK aunque falten configs (con banners de "pendiente"). El cliente puede contactarte por bug y vos resolvés sin que él esté bloqueado. |
| Migrar las features sociales lleva más de lo estimado | Sprint 3 tiene buffer; si se atrasa, las features menos críticas (stories, friends) pueden pasarse a sprint 4 sin afectar el deploy del primer cliente. |
| La limpieza quirúrgica del Sprint 0 deja imports rotos / código muerto | Cada commit del Sprint 0 corre `npm run build` antes de mergear. Si el build rompe, hay que limpiar imports antes de seguir. |

## 17. Decisiones tomadas (vs alternativas descartadas)

- ✅ **Boilerplate clonable** vs ❌ SaaS multi-tenant (overkill, ata al owner a operar)
- ✅ **Repo nuevo desde cero** (con copy-paste inicial + limpieza quirúrgica) vs ❌ Fork mantenido (heredás deuda técnica permanente) vs ❌ Construcción 100% from scratch (más lento, sin "guardarail" de código probado)
- ✅ **Setup wizard runtime** vs ❌ Setup por archivos `.env` (menos profesional, más fricción para el cliente)
- ✅ **Encriptación AES-256-GCM en DB** vs ❌ Plain text en DB (inaceptable) o ❌ Render secrets API (más complejo, requiere token Render del cliente)
- ✅ **6 sprints completos** vs ❌ Fork rápido + refactor después (con presión de cliente, más riesgo)
- ✅ **Subdominio del cliente** vs ❌ Mismo dominio + path / embedded (complejo, depende de stack del cliente)
- ✅ **Stack idéntico a Lemons** vs ❌ Migrar a Next.js (curva sin beneficio claro)
- ✅ **Sin AI generativa en v1** vs ❌ Incluir AI (ata al cliente a API keys de Anthropic/OpenAI/Gemini, costos, complejidad — añadible después)

## 18. Open questions

Ninguna. Todas las decisiones de scope y arquitectura quedaron cerradas durante el brainstorming. Las preguntas operativas (nombre del producto, dominio del cliente, colores específicos) se cierran al iniciar sprint 5 con los datos reales del cliente.
