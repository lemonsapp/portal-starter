# portal-starter

Boilerplate clonable para portales web con auth, perfiles, coins, chat 1-a-1, stories, amigos y panel admin con setup wizard runtime para que el cliente final pegue sus API keys (Cloudinary / Resend / Telegram) sin tocar archivos `.env`.

## Estado

✅ **Listo para deploy** — 7 sprints cerrados, build/boot/tests verde, refs Lemons en código vivo: 0. Spec: [`docs/superpowers/specs/2026-05-06-portal-starter-design.md`](./docs/superpowers/specs/2026-05-06-portal-starter-design.md).

| Sprint | Entregable | Estado |
|---|---|---|
| 0 | Copy-paste de lemons-portal + limpieza quirúrgica de features no aplicables (IG, WA, AI, cargas, founder, cash) | ✅ |
| 1 | Branding centralizado (CSS vars + branding.json), sacar refs hardcoded, auth verificado | ✅ |
| 2 | Setup wizard + configStore + encriptación AES-256-GCM + schema bootstrap | ✅ |
| 3 | First-admin bootstrap + AdminPanel (Coins/Feed/Settings) + feature flags wired | ✅ |
| 4 | HomeClient refactor + email branding dinámico + WebAuthn + cleanup migrations + assets purge | ✅ |
| 5 | Wizard guiado paso a paso + scripts/setup-new-client.js + docs CONFIGURACION+ARQUITECTURA | ✅ |
| 6 | Branding-aware rgba (CSS vars derivadas) + cleanup final Lemons-flavored (🍋→🪙, animations rename, sala general seed, copy genérico) | ✅ |

## Stack

| Pieza | Tecnología | Hosting (sugerido) |
|---|---|---|
| Frontend | React 19 + Vite 5 | Vercel (free tier) |
| Backend | Node + Express 5 | Render Starter (~$7/mes) |
| Base de datos | Postgres serverless | Neon (free tier) |
| Imágenes | Cloudinary | (config runtime via wizard) |
| Emails | Resend | (config runtime via wizard) |
| Realtime | Socket.io 4 | (incluido en Render) |
| Auth biométrico | WebAuthn nativo | — |

## Setup local (dev)

```bash
# 1. Clonar
git clone https://github.com/<tu-org>/portal-starter.git
cd portal-starter

# 2. Crear .env en la raíz (ver .env.example)
cp .env.example .env
# Llenar DATABASE_URL (Neon), JWT_SECRET, MASTER_KEY:
#   openssl rand -hex 32   # para JWT_SECRET y MASTER_KEY

# 3. Instalar deps (dos workspaces)
cd client && npm install && cd ..
cd server && npm install && cd ..

# 4. Aplicar schema base a la DB (pendiente — ver docs/SCHEMA.md cuando exista)

# 5. Arrancar en dos terminales
cd server && node index.js     # http://localhost:4000
cd client && npm run dev       # http://localhost:5173
```

## Customización

El branding por defecto vive en [`branding.json`](./branding.json) (raíz del repo). El primer admin puede sobrescribirlo desde el setup wizard una vez que esté implementado el config-store (Sprint 2).

## Origen

Extraído del núcleo social de [`lemons-portal`](https://github.com/lemonsapp/lemons-portal) (privado), refactorizado como producto agencia-vendible. Todo el código específico de Lemons (logística USA→AR, herramientas IG/WhatsApp, dashboards founder, AI generativa) fue removido en Sprint 0.
