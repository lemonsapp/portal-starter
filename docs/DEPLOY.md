# DEPLOY.md — Cómo deployar el portal-starter para un cliente nuevo

> **Audiencia**: vos (la agencia). Este doc es para cuando ya cobraste el setup y arrancás un cliente nuevo. Estimado: **2-3 días** una vez que el starter esté maduro (post Sprint 5).

## 0. Antes de empezar

Confirmar con el cliente:

- [ ] **Nombre del producto** (ej. "Comunidad ACME")
- [ ] **Subdominio** que va a usar (ej. `portal.acme.com`) y quién maneja el DNS
- [ ] **Quién se encarga de las cuentas** en Neon/Render/Vercel/Cloudinary/Resend: ¿el cliente con email propio, o vos como agencia y después le transferís?
- [ ] **Colores y logo** iniciales (tus defaults del wizard alcanzan al inicio si no tiene preferencia)

## 1. Crear cuentas externas

Cada uno en cuenta del cliente (o tuya, según acuerdo):

1. **Neon** (https://console.neon.tech)
   - Nuevo proyecto, región más cercana al usuario final.
   - Free tier alcanza al inicio.
   - Anotar: `DATABASE_URL` (con `?sslmode=require&channel_binding=require`).

2. **Render** (https://render.com)
   - "New Web Service" → conectar repo (clone tuyo del starter).
   - Build command: `cd server && npm install`.
   - Start command: `cd server && node index.js`.
   - Plan: Starter ($7/mes).
   - Anotar la URL pública (algo como `https://acme-portal.onrender.com`).

3. **Vercel** (https://vercel.com)
   - "New Project" → mismo repo.
   - Root directory: `client`.
   - Build command: `npm run build`.
   - Output directory: `dist`.
   - Plan: Free tier.

4. **Cloudinary** (https://cloudinary.com) y **Resend** (https://resend.com)
   - El cliente final pega las API keys desde el setup wizard. Vos sólo creás las cuentas y le pasás los logins. **No las pongas en .env**.

## 2. Setear env vars en Render

En el dashboard de Render → Environment:

```bash
DATABASE_URL=<de Neon>
JWT_SECRET=<openssl rand -hex 32>
MASTER_KEY=<openssl rand -hex 32>     # CRÍTICO: guardar copia en 1Password/Bitwarden por cliente
NODE_ENV=production
PORT=4000
APP_URL=https://portal.acme.com        # subdominio del cliente
```

> **MASTER_KEY** es la llave maestra para encriptar las API keys que el cliente pegue en el wizard. Si se pierde, hay que re-pegar todas. Guardar en password manager.

## 3. Setear env vars en Vercel

En el dashboard de Vercel → Settings → Environment Variables:

```bash
VITE_API_URL=https://acme-portal.onrender.com
```

(La URL pública de Render del paso 1.)

## 4. DNS del subdominio del cliente

Crear un CNAME en el DNS del dominio del cliente:

```
portal.acme.com   CNAME   cname.vercel-dns.com.
```

Vercel detecta automáticamente y pide validación SSL (~5 min).

## 5. Aplicar schema base a Neon

> ⚠ **Pendiente** — Sprint 1.5: extraer schema canónico con `pg_dump --schema-only` del lemons-portal-prod, limpiar columnas Lemons-only, dejarlo en `scripts/init-db.sql`. Cuando esté:
>
> ```bash
> psql $DATABASE_URL < scripts/init-db.sql
> ```

## 6. Crear primer admin

Una vez que el server arranque, el frontend muestra "Crear cuenta de administrador" (porque la tabla users está vacía). Llenar email + password + nombre → admin queda creado con `role='admin'`.

Decisión operativa: ¿lo crea el cliente o lo creás vos para entregarle "listo"?

## 7. El cliente completa el wizard

Loguea como admin → app detecta `app_config` vacía → redirige a `/admin/setup`. Pasos:

1. **Cloudinary** — pegar `cloud_name` + `api_key` + `api_secret`. La app testea la conexión.
2. **Marca** — nombre del producto, slogan, logo (sube a Cloudinary), colores, favicon, fuente.
3. **Resend** — pegar API key + from email + from name.
4. **Telegram** (opcional) — bot token + chat id para alertas.
5. **Reglas** — coins por registro, modo de signup (open/invite), verificación de email obligatoria, etc.

## 8. Smoke test

- [ ] Registrarse como usuario nuevo (con código de invitación si signup_mode=invite).
- [ ] Recibir email de verificación.
- [ ] Click en link → cuenta verificada.
- [ ] Login.
- [ ] Subir avatar (testea Cloudinary).
- [ ] Crear post / dar like (testea posts/follows).
- [ ] Mandar mensaje privado (testea chat).

## 9. Handoff al cliente

Documentación que le pasás:

- Login del admin.
- Backup de la `MASTER_KEY` (en 1Password compartido o documento cifrado).
- Cómo agregar usuarios (admin panel → Coins/Users tab cuando exista).
- Cómo postear novedades al feed (admin panel → Feed Editor cuando exista).
- Costos mensuales esperados (~$7 Render + free tiers de Neon/Vercel/Cloudinary/Resend).
- Cómo contactarte para soporte si algo se rompe.

## 10. Costos típicos (sin SaaS lock-in)

| Servicio | Plan | Costo |
|---|---|---|
| Render Starter | Web Service | $7/mes |
| Neon Free | hasta 0.5 GB DB + 191 horas compute | $0 |
| Vercel Hobby | hasta 100 GB bandwidth | $0 |
| Cloudinary Free | hasta 25 GB storage | $0 |
| Resend Free | 3000 emails/mes | $0 |
| **Total** | | **~$7/mes** |

Si Render Starter no alcanza por tráfico: upgrade a Standard ($25/mes) o downgrade a Render Free con sleep (acept para clientes con uso intermitente).

## Troubleshooting

### El server no levanta en Render
- Revisar logs en Render → Logs.
- Causas comunes:
  - `DATABASE_URL` mal formateada (falta `?sslmode=require`).
  - `JWT_SECRET` ausente o muy corto (mínimo 32 chars).
  - Build falló (revisar el output del build step).

### Emails de verificación no llegan
- Revisar que Resend key esté pegada en el wizard y la conexión testeó OK.
- Revisar que el email "from" esté validado en Resend (dominio verificado o uso de @resend.dev).
- Revisar carpeta SPAM del cliente.

### Login funciona pero las imágenes no suben
- Cloudinary no configurado en el wizard, o keys equivocadas.
- Revisar `/admin/settings/cloudinary` → "Probar conexión".

---

**Última actualización**: 2026-05-07. Este doc evoluciona con cada cliente nuevo que deployamos.
