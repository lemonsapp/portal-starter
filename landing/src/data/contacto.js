// Datos de contacto + URLs del portal centralizados.
// Si el cliente cambia el WhatsApp / IG / mail, se edita solo acá y se
// propaga a Header, Footer, Channels, WhatsAppBanner, HumanSupport.
//
// PLACEHOLDERS marcados con TODO_HOLISTIC: confirmar con el cliente y
// reemplazar antes del lanzamiento publico.

export const CONTACTO = {
    // ── WhatsApp ─────────────────────────────────────────────────────────────
    // Numero en formato internacional sin "+". Ej: 5491155555555
    // TODO_HOLISTIC: pedirle al cliente el numero real
    whatsapp_number: "5491100000000",
    get whatsapp_url() {
        return `https://wa.me/${this.whatsapp_number}`;
    },
    // Mensaje pre-llenado opcional (URL-encoded)
    get whatsapp_url_with_message() {
        return `${this.whatsapp_url}?text=${encodeURIComponent("Hola Holistic, vengo desde la web 👋")}`;
    },

    // ── Instagram ────────────────────────────────────────────────────────────
    // TODO_HOLISTIC: confirmar handle exacto (probable: holisticgrowshop)
    instagram_handle: "holisticgrowshop",
    get instagram_url() {
        return `https://instagram.com/${this.instagram_handle}`;
    },
    get instagram_handle_at() {
        return `@${this.instagram_handle}`;
    },

    // ── Email ────────────────────────────────────────────────────────────────
    email: "contacto@hgrowshop.com",
    get mailto_url() {
        return `mailto:${this.email}`;
    },

    // ── Telefono ─────────────────────────────────────────────────────────────
    // TODO_HOLISTIC: pedirle al cliente
    phone_display: "+54 11 0000-0000",
    phone_dial: "+5411000000000",  // sin espacios, formato tel:
    get phone_url() {
        return `tel:${this.phone_dial}`;
    },

    // ── Horario de atencion ──────────────────────────────────────────────────
    horario: "Lun–Sáb · 10 a 19 hs",
};

// URLs internas del portal React (mismo dominio, distintas paths).
// El portal vive bajo /portal/* en el dist final pero las rutas de usuario
// (login, registro, inicio) son rewriteadas por vercel.json.
export const PORTAL = {
    login: "/login",
    register: "/registro",
    home: "/inicio",
    profile: "/perfil",
    coins: "/coins",
};

// CTAs cross-componente. Centralizar por si cambia el copy.
export const CTAS = {
    // FinalCTA: el cliente NO tiene /shop como pagina Astro propia. Dirigimos
    // al registro del portal: "para ver el catalogo completo, registrate".
    // Cuando se cree /shop como pagina Astro o /tienda, cambiar aca.
    explorar_catalogo: PORTAL.register,
    // Header "Mi cuenta": login (si el user ya estaba logueado, el portal
    // redirige a /inicio automatico).
    mi_cuenta: PORTAL.login,
};
