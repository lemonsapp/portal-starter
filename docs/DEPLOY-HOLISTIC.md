# DEPLOY-HOLISTIC.md — Runbook deploy producción del portal Holistic Growshop

> **Audiencia**: vos (Lemons Argentina). Asume que el portal-starter está en `lemonsapp/portal-starter` y querés deployar el primer cliente real (**Holistic Growshop**, hgrowshop.com).
>
> **Tiempo estimado**: 90 minutos si todo va bien. **Costo mensual aprox**: USD 7 (Render) + 0 (Vercel free + Neon free). Resend free tier alcanza al inicio.

## 0. Branding & datos del cliente (ya configurados en el repo)

| Campo                | Valor                                                                |
|----------------------|----------------------------------------------------------------------|
| Producto             | Holistic Growshop                                                    |
| Slogan               | Tu growshop de confianza · Línea Elite, Pro y Bio                    |
| Web del cliente      | https://hgrowshop.com                                                |
| Subdominio sugerido  | `portal.hgrowshop.com` (CNAME → cname.vercel-dns.com)                |
| API subdomain        | `api.hgrowshop.com` (CNAME → render service URL)                     |
| color_primary        | `#52b788` (verde)                                                    |
| color_accent         | `#d4a574` (tan)                                                      |
| color_bg             | `#080808`                                                            |
| color_text           | `#EDE9E0`                                                            |
| Font preset          | moderna (Inter)                                                      |
| logo_url / favicon   | https://hgrowshop.com/wp-content/uploads/2022/01/logo2.svg           |

Todo eso ya vive en `branding.json`, `client/src/lib/branding.js` y la DB del Codespace dev. Cuando arranques con DB nueva en Neon, el primer admin via Setup Wizard reaplicará los valores (o aplicás el SQL que está al final de este doc).

---

## 1. Crear el repo dedicado en GitHub

> El portal-starter es el **boilerplate** (lemonsapp/portal-starter). Cada cliente vive en su **propio repo** para aislamiento total (Sprint 5 spec, decisión de diseño).

```bash
# en tu máquina local (no en el Codespace de Claude — el token de
# Codespaces no tiene scope repo:create):
gh repo create lemonsapp/holistic-portal --private \
  --description "Portal social Holistic Growshop · clonado de portal-starter"

# clonar y push del starter actual:
git clone https://github.com/lemonsapp/portal-starter holistic-portal
cd holistic-portal
git remote rename origin upstream
git remote add origin https://github.com/lemonsapp/holistic-portal.git
git push origin main
```

> Mantenés `upstream` apuntando al starter para poder traer fixes con `git pull upstream main` cada cuánto.

---

## 2. Crear cuentas externas

Lo más cómodo: crear las 4 con email `lemonscontacto@gmail.com` y al final transferir ownership al cliente, o cobrarle el setup como reembolso.

### 2.1 Neon (Postgres serverless · gratis hasta 0.5 GB)

1. https://console.neon.tech → New Project.
2. Nombre: `holistic-portal-prod`. Región: `aws-sa-east-1` (São Paulo, latencia AR).
3. Plan: **Free**.
4. Anotar la connection string (algo así):
   ```
   postgresql://neondb_owner:XXXXXX@ep-cool-flower-xxxxxx.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```
5. Aplicar el schema base. En la UI de Neon → SQL Editor, pegar todo el contenido de `scripts/init-db.sql` (~330 líneas, son CREATE TABLE IF NOT EXISTS idempotentes).

### 2.2 Render (backend Node + Express · USD 7/mes)

1. https://dashboard.render.com → New → Web Service.
2. Conectar GitHub → seleccionar `lemonsapp/holistic-portal`.
3. Config:
   - Name: `holistic-portal-api`
   - Region: `Ohio` (más barata; latencia ~150ms desde AR, aceptable).
   - Branch: `main`
   - Root Directory: dejar vacío
   - Build Command: `cd server && npm install`
   - Start Command: `cd server && node index.js`
   - Plan: **Starter** (USD 7/mes; Free tiene cold-starts brutales).
4. **Generar secrets** (ejecutar localmente y guardar en 1Password / Bitwarden — luego pegar como env vars en Render):
   ```bash
   node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
   node -e "console.log('MASTER_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
   ```
   O si preferís el helper del repo: `node scripts/setup-new-client.js` (interactivo, escribe `.env` local + imprime los valores).

5. Environment variables en Render (pegar uno por uno):
   ```
   NODE_ENV=production
   PORT=10000
   DATABASE_URL=<el connection string de Neon, paso 2.1.4>
   JWT_SECRET=<el generado en paso 4>
   MASTER_KEY=<el generado en paso 4>
   APP_URL=https://portal.hgrowshop.com
   ```
   > **Si regenerás JWT_SECRET o MASTER_KEY después del primer deploy**: todos los tokens de users existentes se invalidan (force re-login) y los secrets encriptados en `app_config` se vuelven ilegibles (perdés Cloudinary/Resend/Telegram en DB, hay que re-pegar). Guardalos en password manager y no rotes sin migración planeada.
6. "Create Web Service". Render va a buildear; primer deploy ~3 min.
7. Anotar la URL pública (ej. `https://holistic-portal-api.onrender.com`).
8. Verificación rápida:
   ```bash
   curl https://holistic-portal-api.onrender.com/health
   # → {"ok":true}
   curl https://holistic-portal-api.onrender.com/manifest.json
   # → {"name":"Mi Portal", ...}  (todavía defaults; cargamos branding en paso 4)
   ```

### 2.3 Vercel (frontend React + Vite · gratis)

1. https://vercel.com → Add New → Project.
2. Importar `lemonsapp/holistic-portal`.
3. Config:
   - Framework Preset: **Vite**
   - Root Directory: `client`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Environment variables:
   ```
   VITE_API_URL=https://holistic-portal-api.onrender.com
   ```
   > Cuando agregués el dominio custom en paso 3, también podés cambiar a `VITE_API_URL=https://api.hgrowshop.com` y redeployar.
5. Deploy. Anotar URL temporal (ej. `holistic-portal.vercel.app`).

### 2.4 Cloudinary (uploads · gratis hasta 25 GB de bandwidth/mes)

1. https://cloudinary.com → Sign up (free tier).
2. Dashboard → copiar `Cloud Name`, `API Key`, `API Secret`.
3. **No** se pegan en .env. Se pegan en el Setup Wizard del portal **paso 4**.

### 2.5 Resend (emails · gratis hasta 3000/mes)

1. https://resend.com → Sign up.
2. Domains → Add Domain → `hgrowshop.com`.
3. Resend te da 3 records DNS (MX, TXT-SPF, TXT-DKIM). El cliente debe agregarlos en su panel de DNS (probablemente Cloudflare/cPanel donde tiene el WordPress de hgrowshop.com).
4. Esperar verificación (~10 min).
5. API Keys → Create → copiar la key. Se pega en Setup Wizard **paso 4**.

### 2.6 Telegram (alertas internas · opcional, gratis)

1. Hablale a `@BotFather` en Telegram → `/newbot` → nombre `Holistic Portal Alerts` → username `holistic_portal_bot`.
2. Anotar el `bot token`.
3. Crear un grupo privado solo tuyo o con el cliente, agregar el bot, mandar un mensaje cualquiera.
4. `https://api.telegram.org/bot<BOT_TOKEN>/getUpdates` → buscar `chat.id` (es negativo si es grupo).
5. Token + chat_id se pegan en Setup Wizard **paso 4**.

---

## 3. DNS (en el panel del cliente, donde vive hgrowshop.com)

Dos CNAMEs:

```
portal.hgrowshop.com    CNAME  cname.vercel-dns.com
api.hgrowshop.com       CNAME  holistic-portal-api.onrender.com
```

Después:

- En Vercel → Settings → Domains → Add → `portal.hgrowshop.com`. Vercel emite cert automático.
- En Render → Settings → Custom Domain → `api.hgrowshop.com`. Render emite cert automático.
- Update env var en Render: `APP_URL=https://portal.hgrowshop.com` y redeploy.
- Update env var en Vercel: `VITE_API_URL=https://api.hgrowshop.com` y redeploy.

---

## 4. Bootstrap del primer admin + Setup Wizard

1. Abrir `https://portal.hgrowshop.com` (o la URL de Vercel temporal).
2. Como la DB no tiene users, redirige automáticamente a `/setup-admin`.
3. Crear el primer admin (email del cliente o tuyo).
4. Login → redirige a `/admin/setup` (Setup Wizard guiado).
5. Pegar:
   - Cloudinary cloud_name + api_key + api_secret
   - Resend api_key + from address (`Holistic <noreply@hgrowshop.com>`)
   - Telegram bot_token + chat_id (opcional)
   - Marca: el wizard ya muestra los defaults de `branding.json` (Holistic + paleta verde + logo SVG). Si querés override, editar acá.
6. Guardar cada sección. El wizard testea conectividad de Cloudinary/Resend/Telegram con un click.

> **Atajo SQL (si el cliente quiere bypassear el wizard)**: ejecutar en Neon SQL Editor:
> ```sql
> -- Aplicar branding Holistic directamente.
> -- (Ya está en defaults via branding.json + frontend BRANDING_DEFAULTS,
> --  esto solo es necesario si arrancás con un branding.json distinto.)
> -- NOTA: configStore encripta secrets con MASTER_KEY. Para campos no-secret
> --       como branding, podés insertar plaintext con is_secret=FALSE:
> INSERT INTO app_config (section, key, value_plain, is_secret) VALUES
>   ('branding', 'name',          'Holistic Growshop', FALSE),
>   ('branding', 'slogan',        'Tu growshop de confianza · Línea Elite, Pro y Bio', FALSE),
>   ('branding', 'color_primary', '#52b788', FALSE),
>   ('branding', 'color_accent',  '#d4a574', FALSE),
>   ('branding', 'color_bg',      '#080808', FALSE),
>   ('branding', 'color_text',    '#EDE9E0', FALSE),
>   ('branding', 'font_preset',   'moderna', FALSE),
>   ('branding', 'logo_url',      'https://hgrowshop.com/wp-content/uploads/2022/01/logo2.svg', FALSE),
>   ('branding', 'favicon_url',   'https://hgrowshop.com/wp-content/uploads/2022/01/logo2.svg', FALSE)
> ON CONFLICT (section, key) DO UPDATE SET value_plain = EXCLUDED.value_plain;
> ```
> (verificar que el schema de `app_config` matchea — desde Sprint 2 la col es `value_encrypted` para secrets y `value_plain` para no-secrets; el wizard maneja ambos).

---

## 5. Smoke test E2E producción

```bash
# Reemplazar URLS si todavía no aplicaste DNS custom:
PORTAL=https://portal.hgrowshop.com
API=https://api.hgrowshop.com

# 1. Health
curl -s $API/health  # {"ok":true}

# 2. Branding aplicado (HTML rendering server-side)
curl -s $PORTAL/ | grep -oE '<title>[^<]+</title>'
# → <title>Holistic Growshop</title>

# 3. PWA manifest
curl -s $API/manifest.json | python3 -m json.tool | head -8
# → name, short_name, theme_color #52b788, icons[0]=hgrowshop SVG

# 4. Theme color
curl -s $PORTAL/ | grep -oE 'theme-color"[^>]+'
# → content="#52b788"

# 5. Public config endpoint
curl -s $API/api/config/public | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin)['branding'], indent=2))"
```

Después abrí `$PORTAL/admin` con el admin creado, verificá los 4 tabs (Coins / Feed / 🎨 Branding / Configuración). El tab Branding muestra los 6 mockups con datos reales.

---

## 6. Checklist final antes de handoff

- [ ] DNS portal.hgrowshop.com resuelve y carga el frontend
- [ ] DNS api.hgrowshop.com resuelve y `/health` devuelve ok
- [ ] Setup Wizard completado al 100% (Cloudinary, Resend verificadas)
- [ ] Email de bienvenida al admin llegó
- [ ] Test biométrico en iPhone (Touch ID / Face ID) registra OK
- [ ] Subir logo + foto de perfil al admin → aparece en Sidebar/Topbar
- [ ] Crear un post, comentar, dar like → counts en /perfil suben (Sprint 11 verificación)
- [ ] Agregar un user de prueba (registro abierto) → flujo onboarding OK
- [ ] Pasarle al cliente el doc `docs/CONFIGURACION.md` + accesos a Vercel/Render/Neon (o transferir ownership)

---

## 7. Costos resumidos (USD/mes)

| Servicio   | Plan      | Costo    | Cuándo escalar                                   |
|------------|-----------|----------|--------------------------------------------------|
| Render     | Starter   | $7       | $25 cuando >100 users activos simultáneos        |
| Neon       | Free      | $0       | $19 cuando >0.5GB DB                             |
| Vercel     | Hobby     | $0       | $20/user cuando >100GB bandwidth/mes             |
| Cloudinary | Free      | $0       | $89 cuando >25GB bandwidth/mes                   |
| Resend     | Free      | $0       | $20 cuando >3k emails/mes                        |
| **Total**  |           | **$7**   |                                                  |

---

## 8. Mantenimiento futuro

```bash
# traer fixes/features del starter (cada vez que pusheás al boilerplate):
cd holistic-portal
git pull upstream main
git push origin main   # Render + Vercel auto-deployan al detectar push
```

Si el cliente pide algo custom que no aplica al starter, hacelo en su repo y NO lo pushees a upstream. Si lo querés portar, refactoreá para ser genérico y hacé un PR al starter.
