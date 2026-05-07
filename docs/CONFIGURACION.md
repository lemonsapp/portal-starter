# Configuración del portal — Guía para vos

> **Para quién es este doc**: vos, el cliente final que recibe el portal listo para configurar. Si todavía no recibiste el link y los datos del admin, pedíselos a quien te lo desplegó.

> **TL;DR**: la mayoría de la configuración la hacés desde la propia app, paso a paso, sin tocar archivos. Este doc es backup por si algo no cierra.

---

## ✅ Lo que recibiste

Te tienen que haber pasado:

1. **El link de tu portal** (ej. `https://portal.tucliente.com`).
2. **Login del admin**: email + contraseña.
3. *(Opcional)* Un backup de la **MASTER_KEY** — guardalo en tu password manager (1Password, Bitwarden). Si nunca lo necesitás, mejor; pero si tu portal pierde acceso a sus configs encriptadas, sin la MASTER_KEY hay que rehacer toda la configuración.

---

## 🚀 Primera vez que entrás

1. Abrí el link → vas a ver una pantalla de login.
2. Si nadie creó la cuenta de admin todavía, en lugar del login te muestra **"Crear cuenta de administrador"** — completá nombre/email/password y dale.
3. Ya logueado como admin, te lleva automáticamente al **Setup Wizard** (`/admin/setup`).

---

## 🪄 El Setup Wizard

Son 5 pasos, todos guiados. Cada paso te explica:

- **Qué es** ese servicio
- **Cómo crear cuenta gratis**
- **Dónde encontrar las API keys**
- **Qué pegar en cada campo**
- **Probar conexión** (verifica que las keys son válidas en vivo)

### 1. Cloudinary (~5 min)

Es donde se guardan las imágenes que suben los users (avatars, fotos del feed, logo del portal). Cuenta gratis alcanza para empezar — 25 GB de storage.

El wizard te lleva a `cloudinary.com/users/register_free` → te explica dónde está cada cosa en su dashboard. Pegás 3 cosas: `cloud_name`, `api_key`, `api_secret`. Click "Probar conexión" y listo.

### 2. Marca

Acá definís cómo se ve tu portal:
- **Nombre del producto** (aparece en el title del browser, en emails, en el header).
- **Slogan** corto.
- **Color primario** y **acento** (hex o color picker).
- **Preset de fuente** (Moderna / Clásica / Tech / Friendly).
- **URL del logo** y **favicon** (subilos a Cloudinary primero, copiá la "Secure URL").

Hay un preview en vivo abajo del form — vas viendo cómo se va a ver tu portal mientras editás.

### 3. Resend (emails) (~5 min)

Para mandar emails de verificación cuando alguien se registra y de reset password cuando alguien se olvida. **Sin esto los users no pueden completar registro.** 3000 emails/mes gratis.

Wizard te lleva a `resend.com/signup`. Creás API key (`re_…`).

**Dos opciones para el "from email"**:
- **Rápido (sin DNS)**: usá `onboarding@resend.dev` — los emails dicen "from resend.dev". Funciona pero queda raro.
- **Profesional (recomendado)**: Resend → Domains → Add Domain → tu dominio → te da unos registros DNS (TXT, MX, DKIM) que tenés que cargar en tu proveedor de DNS (GoDaddy / Cloudflare / Namecheap / etc). Tarda 1-24 horas en verificar. Después podés usar `noreply@tudominio.com` como from.

### 4. Telegram (alertas — opcional, saltable)

Para que el server te avise por Telegram cuando algo se rompe. Si no querés alertas, saltalo.

Wizard te explica cómo crear un bot con `@BotFather` en Telegram, conseguir el token, y obtener tu `chat_id`. Click "Probar conexión" → te llega un mensaje de prueba al chat.

### 5. Reglas y features

- **Modo de registro**: Abierto (cualquiera con un código de invitación se registra) vs Solo invitación (admin tiene que mandar códigos).
- **Coins por registro**: cuántos coins recibe un user nuevo. 0 = no hay reward.
- **Verificación email obligatoria**: si está ON, los users no pueden loguear sin clickear el link del email. Recomendado: ON.
- **Features ON/OFF**: prendé/apagá módulos completos: chat, stories, friends, coins, webauthn (login biométrico). Cualquiera de estas se puede prender/apagar después.

---

## 🛠 Después del wizard: el panel admin

Una vez que terminás el wizard, click "Empezar 🚀" → te lleva al inicio. Para volver al panel admin: navegá a `/admin` (el login te tiene que mandar ahí automáticamente cuando logueás como admin).

El panel tiene 3 tabs:

### 🪙 Coins

- **Lista de users** con su balance actual.
- **Buscar** por email o nombre.
- **+ Regalar**: dale coins extra a un user (ej. premio por participación). Tenés que poner una razón — queda en el historial.
- **Ajustar**: subir/bajar el balance. Acepta valores negativos.

Cada acción queda en `coin_transactions` con prefijo `[admin:N]` para que después puedas auditar quién hizo qué.

### 📰 Feed

- **Composer** arriba para postear novedades.
- 3 tipos:
  - **Post permanente**: queda hasta que lo borres.
  - **Story**: se auto-borra a las 24hs.
  - **Update destacado**: aparece pinned arriba en el inicio.
- Soporta título + body (markdown básico) + URL de media (imagen subida a Cloudinary).
- Lista de posts publicados abajo, con botón "Borrar" en cada uno.

### ⚙️ Configuración

Reabre el wizard sección por sección. Cualquier valor se puede editar después: cambiar logo, agregar/sacar features, rotar API keys.

---

## 🔐 Seguridad — qué hay que saber

- **Las API keys del wizard** (Cloudinary secret, Resend key, Telegram token) se guardan **encriptadas con AES-256-GCM** en la base de datos. Sin la MASTER_KEY (que vive solo en el `.env` del servidor) son ilegibles.
- **Cambios al admin panel** quedan registrados en `app_config_history` con SHA-256 hashes (no los valores originales) — auditoría sin exponer secretos.
- **Cambios a coins** quedan en `coin_transactions` con el ID del admin que los hizo.
- **Si perdés la MASTER_KEY** y no tenés backup, hay que repegar todas las API keys del wizard de cero (porque la app no las puede leer).

---

## 🆘 Si algo no funciona

### "No me llegan los emails de verificación"
1. Andá a `/admin` → Configuración → Resend → Probar conexión. ¿Devuelve OK?
2. Si dice "from email no verificado", andá a Resend → Domains y verificá los registros DNS.
3. Como workaround temporal, usá `onboarding@resend.dev` como from email.
4. Revisá la carpeta de spam del user.

### "Los users no pueden subir avatar"
1. `/admin` → Configuración → Cloudinary → Probar conexión.
2. Si dice "Credenciales inválidas (401)", revisá api_key y api_secret en cloudinary.com → API Keys.
3. Si dice "Error de red", verificá que la cuenta de Cloudinary no esté suspendida.

### "El portal no se ve con mis colores / nombre"
1. Hard refresh en el browser (Cmd+Shift+R / Ctrl+Shift+F5).
2. `/admin` → Configuración → Marca → verificar que los valores estén guardados.
3. Si subiste logo, asegurate que la URL es accesible públicamente (Cloudinary la entrega public por default si la subiste con configuración estándar).

### "No puedo entrar al panel admin"
1. Verificá que estás logueado con un user de role=`admin` (no client/operator).
2. Si te tira 403, pediste a quien armó el deploy que te promueva en la base de datos: `UPDATE users SET role='admin' WHERE email='tu@email.com';`

### "Quiero borrar mi cuenta"
Pediselo al admin del portal. La app no expone ese flujo al user todavía (Sprint 4+).

---

## 📞 Contacto

Si algo no cierra, contactá a quien te desplegó el portal — tienen acceso a logs y pueden diagnosticar problemas que la app no puede mostrar (ej. errores de DB, problemas de Render).
