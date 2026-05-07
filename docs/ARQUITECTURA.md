# Arquitectura — Referencia técnica

> **Para quién**: vos como dueño/agencia que mantiene este starter y lo deploya para clientes nuevos. Este doc explica decisiones de diseño, cómo está armado el código, y cómo extenderlo cuando necesites.

---

## Stack

- **Frontend**: React 19 + Vite 5 + react-router-dom 7. Sin TypeScript (sí `.jsx`). Build → `client/dist/`. Deploy a Vercel.
- **Backend**: Node 20+ + Express 5 + Postgres (driver `pg`). Socket.io para chat realtime. Deploy a Render.
- **DB**: Postgres serverless (Neon recomendado por free tier + branching). Schema en `scripts/init-db.sql`.
- **Auth**: JWT (HS256) firmado con `JWT_SECRET`. Sessions stateless. Opcional: WebAuthn biométrico.
- **Storage**: Cloudinary (cliente lo paga, el wizard pega las keys).
- **Email**: Resend (cliente lo paga, el wizard pega las keys).

---

## Layout del repo

```
portal-starter/
├── branding.json              # Defaults de marca (lee server/lib/branding.js + client/lib/branding.js)
├── CLAUDE.md                  # Guía operativa para Claude Code
├── README.md
├── docs/
│   ├── DEPLOY.md              # Playbook agencia: 10 pasos para deployar un cliente
│   ├── CONFIGURACION.md       # Backup para el cliente final (la mayoría se hace en el wizard)
│   ├── ARQUITECTURA.md        # ← este archivo
│   └── superpowers/specs/...  # Spec canónica del proyecto
├── scripts/
│   ├── init-db.sql            # Schema bootstrap (32 tablas keepers)
│   └── setup-new-client.js    # Genera .env con secrets para nuevo cliente
├── client/                    # React (Vercel)
│   ├── src/
│   │   ├── App.jsx            # Routes + AuthGate + FeatureGate + LoginOrBootstrap
│   │   ├── pages/             # Login, Register, HomeClient, Coins, Profile, AdminSetup, AdminPanel, …
│   │   ├── components/        # Sidebar, Topbar, Stories, FriendsPanel, OnboardingModal, …
│   │   ├── lib/branding.js    # useBranding + useFeatureFlag + useRules (cache singleton)
│   │   └── hooks/             # usePresence, usePWA
│   ├── public/                # /icons/, manifest.json, FONDO-LOGIN.jpg
│   ├── index.html             # Title + meta neutrales (overrideado por useBranding)
│   ├── vite.config.js         # Config para Codespaces (host:true, allowedHosts:true)
│   └── package.json
├── server/                    # Express (Render)
│   ├── index.js               # Monolito principal (~2700 LOC) con auth, posts, announcements, presence
│   ├── routes/
│   │   ├── coins.js           # /coins (con feature gate)
│   │   ├── chat.js            # /api/chat (con feature gate)
│   │   ├── notifications.js   # /notifications (broadcast lemon_notifications)
│   │   ├── profile.js         # /profile (con auto-migraciones inline)
│   │   ├── webauthn.js        # /auth/webauthn (con feature gate)
│   │   ├── stats.js           # /public/stats (sin auth)
│   │   ├── admin-config.js    # /api/admin/config/* — wizard backend
│   │   ├── admin-feed.js      # /admin/feed CRUD + /feed (sin auth)
│   │   └── admin-users.js     # /admin/users + coins gift/adjust + tx history
│   ├── lib/
│   │   ├── configStore.js     # AES-256-GCM contra MASTER_KEY; encrypt/decrypt + audit
│   │   ├── configStore.test.js  # 15 unit tests (round-trip, tampering, hashes)
│   │   ├── branding.js        # getBranding async — combina branding.json + configStore overrides
│   │   └── featureFlags.js    # isFeatureEnabled + requireFeature middleware
│   ├── emails/                # Templates HTML (server/index.js inline también)
│   ├── jobs/                  # Crons utilitarios (vacío post-Sprint 0)
│   ├── services/telegram.js   # Notify a Telegram (lo usa el wizard test/telegram)
│   ├── auth.js                # authRequired + requireRole middleware
│   ├── db.js                  # Pool pg con listener 57P01 (Neon serverless)
│   ├── mailer.js              # Wrapper de Resend
│   ├── security.js            # loginSlowDown + helmet + sanitize helpers
│   └── package.json
└── .env.example               # Template del .env (DATABASE_URL, JWT_SECRET, MASTER_KEY, APP_URL)
```

---

## Cómo agregar una config nueva al wizard

Ejemplo: querés agregar `slack.webhook_url` para que el cliente pueda mandar alertas a Slack además de Telegram.

### 1. Agregar al catálogo `KEY_CATALOG` en `server/lib/configStore.js`

```js
const KEY_CATALOG = {
  // ...
  "slack.webhook_url": { type: "string", isSecret: true },
};
```

`isSecret: true` → se encripta con AES-256-GCM antes de guardarse en `app_config`.

### 2. Si querés que aparezca en `/api/config/public`

Si es info no-sensitive que el cliente lee al cargar (ej. no es secret), agregalo a `getPublicConfig()` en el mismo archivo. Para webhook URLs (secrets), no lo expongas — el server lo lee directo cuando manda la alerta.

### 3. Agregar el step al wizard UI (`client/src/pages/AdminSetup.jsx`)

Crear un nuevo `function StepSlack({ goNext, goSkip })` siguiendo el patrón de `StepTelegram`. Agregarlo al array `STEPS` y al render del root `AdminSetup`.

### 4. Test de conexión real

En `server/routes/admin-config.js`, agregá un case al switch de `/api/admin/config/test/:provider`:

```js
async function testSlack() {
  const url = await cs.getConfig("slack.webhook_url");
  if (!url) return { ok: false, message: "Falta slack.webhook_url" };
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "✓ Test desde portal-starter" }),
    });
    return r.ok ? { ok: true, message: "Slack OK" } : { ok: false, message: `Slack ${r.status}` };
  } catch (e) { return { ok: false, message: e.message }; }
}
```

### 5. Usarlo en runtime

Donde mandes la alerta:
```js
const url = await cs.getConfig("slack.webhook_url");
if (url) await fetch(url, { method: "POST", body: JSON.stringify({ text: "..." }) });
```

---

## Cómo agregar una feature flag nueva

Ejemplo: querés agregar `features.events` para encender/apagar un módulo de eventos del calendario.

### 1. Agregar al catálogo

`server/lib/configStore.js`:
```js
const KEY_CATALOG = {
  // ...
  "features.events": { type: "bool", isSecret: false, default: true },
};
```

Y en `server/lib/featureFlags.js`:
```js
const KNOWN_FLAGS = ["chat", "stories", "friends", "coins", "webauthn", "events"];
```

Y en `client/src/lib/branding.js`:
```js
const FEATURE_DEFAULTS = { chat: true, stories: true, friends: true, coins: true, webauthn: true, events: true };
```

### 2. Backend: usar `requireFeature` middleware

En `server/index.js`:
```js
app.use("/events", requireFeature("events"), eventsRouter);
```

### 3. Frontend: usar `<FeatureGate>` o `useFeatureFlag()`

En `client/src/App.jsx`:
```jsx
<Route path="/events" element={<FeatureGate flag="events"><AuthGate><EventsPage /></AuthGate></FeatureGate>} />
```

O en cualquier componente:
```jsx
const showEvents = useFeatureFlag("events");
{showEvents && <EventsBanner />}
```

### 4. Agregar checkbox al wizard

En `client/src/pages/AdminSetup.jsx`, en `StepRules`, agregar `events` al objeto `featureDescriptions` y al state `features`.

---

## Cómo hacer una migration de DB

Hay 2 lugares para migraciones:

### A. `scripts/init-db.sql` (nuevas tablas)
Para tablas que se crean al primer setup. Idempotente con `CREATE TABLE IF NOT EXISTS`. Cuando un cliente nuevo deploya, corren via:
```bash
psql $DATABASE_URL < scripts/init-db.sql
```

### B. IIFE inline en `server/index.js` (ALTERs en clones existentes)
Para `ALTER TABLE ADD COLUMN IF NOT EXISTS` en deploys que ya están vivos. Ejemplo:
```js
(async () => {
  try {
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_phone BOOLEAN DEFAULT FALSE`);
    console.log("[MIGRATION] users.verified_phone ready");
  } catch (e) { console.error("[MIGRATION ERROR]", e.message); }
})();
```

Estas IIFEs corren al boot del server. Idempotentes — se ejecutan en cada arranque pero no rompen si ya están aplicadas.

**Convención**: agregalas también a `scripts/init-db.sql` para que clones nuevos no necesiten reboot para tener el schema completo.

---

## El flow de auth completo

1. **Bootstrap del primer admin** (DB sin users):
   ```
   GET /auth/needs-bootstrap → { needs_bootstrap: true }
   Frontend redirige a /setup-admin
   POST /auth/bootstrap-admin {name, email, password}
     → Crea user con role='admin', email_verified=true
     → Devuelve JWT
   ```

2. **Registro normal** (DB con users):
   ```
   POST /auth/register {invite_code, name, email, password}
     → Valida invite_code en tabla invite_codes
     → Crea user con role='client', email_verified=false
     → Crea lemon_coins balance, user_profile
     → Genera token de verificación, manda email via Resend
   ```

3. **Login**:
   ```
   POST /auth/login {email, password}
     → bcrypt.compare contra password_hash
     → Si role=client y !email_verified → 403 EMAIL_NOT_VERIFIED
     → Devuelve JWT (7 días)
   ```

4. **Cualquier request autenticada**:
   ```
   Authorization: Bearer <jwt>
   middleware authRequired:
     → jwt.verify(token, JWT_SECRET)
     → req.user = { id, role }
   ```

5. **Endpoints admin**:
   ```
   middleware requireRole(["admin"]) → si role !== 'admin' → 403
   ```

---

## El flow del configStore (encriptación)

```
Admin pega cloudinary.api_secret en wizard
  ↓
POST /api/admin/config/cloudinary { api_secret: "abc..." }
  ↓
configStore.setConfig("cloudinary.api_secret", "abc...", { userId: 1 })
  ↓
Es secret? → encrypt(value) con AES-256-GCM:
  iv = randomBytes(12)
  cipher = createCipheriv("aes-256-gcm", MASTER_KEY, iv)
  ciphertext = cipher.update(value) + cipher.final()
  authTag = cipher.getAuthTag()
  blob = base64(iv | authTag | ciphertext)
  ↓
INSERT INTO app_config (key, value_encrypted, is_secret, updated_by)
INSERT INTO app_config_history (key, old_value_hash, new_value_hash, changed_by)
  // Hashes son SHA-256 de los valores en plain — NO los valores en sí.
```

Cuando se necesita el valor:

```
const apiSecret = await configStore.getConfig("cloudinary.api_secret");
  ↓
SELECT value_encrypted, is_secret FROM app_config WHERE key=$1
  ↓
Es secret? → decrypt(blob):
  parsea iv|tag|ct del base64
  decipher = createDecipheriv(..., MASTER_KEY, iv)
  decipher.setAuthTag(tag)
  return decipher.update(ct) + decipher.final()
  // Si MASTER_KEY cambió o el blob fue tampered → throw → loguea + return null
```

**Resiliencia**: si decrypt falla, la app trata el config como ausente (en lugar de crashear). Cae al `default` del catálogo o al fallback de `branding.json`.

---

## Deploy: cómo agregar un cliente nuevo

Ver `docs/DEPLOY.md` (10 pasos secuenciales: cuentas → env vars → DNS → schema → admin → wizard → smoke test).

Para automatizar parte del setup local previo:
```bash
git clone <fork-de-este-repo> mi-cliente-portal
cd mi-cliente-portal
node scripts/setup-new-client.js   # genera .env con JWT_SECRET + MASTER_KEY
psql $DATABASE_URL < scripts/init-db.sql
cd client && npm install && cd ../server && npm install
```

---

## Tests

Por ahora hay tests sólo del configStore (`server/lib/configStore.test.js`). Se corren con:
```bash
cd server && node lib/configStore.test.js
```

15 tests cubriendo: round-trip de crypto, IV randomness, tampering detection (authTag GCM), hashes determinísticos, mascado de secretos en getAllSection, isolation de getPublicConfig (no leak), audit history.

Tests TODO (Sprint 6+ si se necesita):
- Endpoint tests con supertest (wizard, auth, admin)
- E2E con Playwright/Cypress del wizard completo
- Tests de feature flag wiring (FeatureGate + requireFeature)

---

## Convenciones de código

- **CommonJS** (`require/module.exports`) en server. **ESM** (`import/export`) en client. No los mezclamos.
- **Async/await** en handlers, no callbacks. Try/catch siempre.
- **Errores al cliente**: `res.status(NNN).json({ error: "mensaje user-friendly" })`. NO leakees stack traces.
- **Logs**: `console.log("[MODULO]", ...)` con prefijo categórico. Errores con `console.error("[MODULO ERROR]", e.message)`.
- **Strings al user**: castellano. Comments en código: castellano (mezcla con inglés OK para tech terms).
- **Naming**: tablas DB en `snake_case`, columnas también. JS en `camelCase`. Componentes React en `PascalCase`.

---

## Decisiones operativas

- **No SaaS multi-tenant**: cada cliente = su propio repo (clone) + su propia DB + sus propias env vars. Aislamiento físico. Si querés mover a multi-tenant, tendrías que agregar `tenant_id` a TODAS las tablas — no recomendado, pierde la simplicidad.
- **MASTER_KEY no se rota**: si se cambia, los configs encriptados quedan ilegibles. La app falla gracefully (cae a defaults), pero hay que repegar todas las API keys del wizard. Documentado en `docs/CONFIGURACION.md`.
- **Branding cache 30s**: `server/lib/branding.js` cachea el resultado de getBranding() por 30s. Trade-off: emails durante 30s post-cambio del wizard usan el branding viejo. Aceptable porque emails de verify/reset no son tiempo-real.
- **Feature flags fail-open**: si el middleware `requireFeature` no puede leer la flag (DB caída), permite la request. Mejor servir feature OFF por error que romper toda la app.
