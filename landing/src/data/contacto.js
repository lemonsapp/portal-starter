// Datos de contacto + URLs del portal centralizados.
// Si el cliente cambia el WhatsApp / IG / mail, se edita solo acá y se
// propaga a Header, Footer, Channels, WhatsAppBanner, HumanSupport.
//
// Datos confirmados desde IMAGENES-HOLISTIC/SEO-DOCS/v3 (Marzo 2026).

export const CONTACTO = {
    // ── WhatsApp ─────────────────────────────────────────────────────────────
    // Numero en formato internacional sin "+". Confirmado SEO-DOCS v3.
    whatsapp_number: "5491124759002",
    get whatsapp_url() {
        return `https://wa.me/${this.whatsapp_number}`;
    },
    // Mensaje pre-llenado opcional (URL-encoded)
    get whatsapp_url_with_message() {
        return `${this.whatsapp_url}?text=${encodeURIComponent("Hola Holistic, vengo desde la web — quería consultarles por su línea de fertilizantes 👋")}`;
    },

    // ── Instagram ────────────────────────────────────────────────────────────
    // Handle oficial confirmado en SEO-DOCS v3.
    instagram_handle: "holistic.arg",
    get instagram_url() {
        return `https://instagram.com/${this.instagram_handle}`;
    },
    get instagram_handle_at() {
        return `@${this.instagram_handle}`;
    },

    // ── TikTok ──────────────────────────────────────────────────────────────
    tiktok_handle: "holistic.pro",
    get tiktok_url() {
        return `https://tiktok.com/@${this.tiktok_handle}`;
    },
    get tiktok_handle_at() {
        return `@${this.tiktok_handle}`;
    },

    // ── Email ────────────────────────────────────────────────────────────────
    email: "contacto@hgrowshop.com",
    get mailto_url() {
        return `mailto:${this.email}`;
    },

    // ── Telefono ─────────────────────────────────────────────────────────────
    // Confirmado SEO-DOCS v3.
    phone_display: "+54 11 2475-9002",
    phone_dial: "+541124759002",  // sin espacios, formato tel:
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
