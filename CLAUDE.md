# CLAUDE.md — Guía para Claude Code en este repo

Este repo es un **boilerplate de portal social** (auth + perfiles + coins + chat + stories + friends + admin) que se vende como producto-base para clientes de la agencia. Spec canónica: [`docs/superpowers/specs/2026-05-06-portal-starter-design.md`](./docs/superpowers/specs/2026-05-06-portal-starter-design.md).

## Reglas no-negociables

1. **`/workspaces/lemons-portal/`** es un sibling clone read-only del repo origen. Nunca commitear ahí. Sólo se usa para consultas históricas durante la migración.
2. **Las API keys del cliente final se guardan encriptadas en DB** (tabla `app_config`, AES-256-GCM contra `MASTER_KEY` del .env). NO se hardcodean ni se ponen en .env.example excepto el bootstrap mínimo (DATABASE_URL, JWT_SECRET, MASTER_KEY, PORT, APP_URL).
3. **Cualquier feature que un cliente pueda querer apagar se controla por feature flag** (tabla `app_config`, prefijo `features.*`). Frontend usa `useFeatureFlag()`, backend usa middleware `requireFeature()`.
4. **Nada de "Lemon's", "lemonsarg.com", "@lemonsarg"**. Si aparece, es deuda técnica para limpiar. El branding vive en `/branding.json` y se aplica via `useBranding()` (cliente) o `require("../../branding.json")` (server).

## Estructura

```
portal-starter/
├── branding.json             # Defaults de marca (name, colors, font_preset)
├── client/                   # React + Vite (Vercel)
│   ├── src/
│   │   ├── pages/            # Login, Register, HomeClient, Coins, Profile, Chat, ...
│   │   ├── components/       # Sidebar, Topbar, Stories, FriendsPanel, ...
│   │   ├── lib/branding.js   # useBranding() — aplica CSS vars + title
│   │   └── lib/featureFlags.js  # useFeatureFlag() — skeleton, todos true
│   └── package.json
├── server/                   # Node + Express (Render)
│   ├── index.js              # Monolito: auth + posts + announcements + presence + ...
│   ├── routes/               # coins, chat, notifications, profile, stats, webauthn
│   ├── lib/                  # waReceipt (orphan), tokens, validation
│   ├── emails/               # templates HTML
│   └── package.json
├── docs/superpowers/         # Specs y plans
└── scripts/                  # (vacío post-Sprint 0)
```

## Comandos comunes

```bash
# Dev
cd client && npm run dev     # http://localhost:5173
cd server && node index.js   # http://localhost:4000

# Build
cd client && npm run build   # vite build → client/dist/

# Smoke test boot
node -c server/index.js                                  # syntax check
cd server && node index.js > /tmp/srv.log 2>&1 & sleep 5 && curl http://localhost:4000/health && kill %1
```

## Convenciones de commits

- Formato `<scope>: <verbo> <qué>` con cuerpo explicando el por qué.
- Para sprints: `Sprint <N>: <descripción>`, ej: `Sprint 1: centralize hex colors as var(--brand-primary/accent)`.
- Una feature borrada = un commit dedicado (Sprint 0 lo usó, sigue valiendo).
- Cada commit que afecta server/index.js corre al menos `node -c server/index.js`. Cada commit que afecta client/ corre `cd client && npm run build`.

## Decisiones de diseño relevantes

- **Monorepo único** (no separamos client/server en repos): un solo clone por cliente.
- **No SaaS multi-tenant**: cada cliente tiene su propio deploy + su propia DB Neon. Aislamiento físico.
- **Stack idéntico al origen** (React/Express/Postgres): probado, sin curva.
- **Sin AI generativa en v1**: AI es un módulo opcional (Sprint 2+ si un cliente lo pide).
- **CSS vars con fallback hex** (`var(--brand-primary, #f5e03a)`): si JS no corre (SSR/early), el fallback preserva color.

## Referencias rápidas

- Memorias persistentes: ver MEMORY.md / .claude/memory/*.md (cuando estés en Codespace de Claude Code).
- Sibling read-only: `/workspaces/lemons-portal` (jamás commitear ahí).
- Spec: `docs/superpowers/specs/2026-05-06-portal-starter-design.md`.
