// client/src/components/TopNav.jsx
//
// Top nav minimalista (2026-05-23) — reemplaza Sidebar + Topbar legacy.
// Una sola barra horizontal arriba con todo: brand + nav role-based +
// balance coins + user menu. Mobile: hamburger con drawer lateral.
//
// Estética alineada al landing Holistic: dark bg con backdrop blur,
// mint accents, Gotham Black para brand y nav labels uppercase.

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext.jsx";

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

// SVG icon set — Lucide-like outline, 1.6 stroke
const Icon = ({ name, size = 18 }) => {
    const p = {
        width: size, height: size, viewBox: "0 0 24 24",
        fill: "none", stroke: "currentColor",
        strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round",
        "aria-hidden": "true",
    };
    switch (name) {
        case "home":     return <svg {...p}><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>;
        case "user":     return <svg {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>;
        case "coins":    return <svg {...p}><ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M3 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/></svg>;
        case "chat":     return <svg {...p}><path d="M4 6.5C4 5.7 4.7 5 5.5 5h13c.8 0 1.5.7 1.5 1.5v9c0 .8-.7 1.5-1.5 1.5H10l-4 3v-3H5.5c-.8 0-1.5-.7-1.5-1.5z"/></svg>;
        case "bell":     return <svg {...p}><path d="M6 8a6 6 0 1 1 12 0c0 4 1.5 5 2 6H4c.5-1 2-2 2-6"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>;
        case "shop":     return <svg {...p}><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2.7l2.5 12.4a1.5 1.5 0 0 0 1.5 1.2h8.7a1.5 1.5 0 0 0 1.5-1.2L21 7H6"/></svg>;
        case "admin":    return <svg {...p}><path d="M12 3l8 3v5c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z"/><path d="m9 12 2 2 4-4"/></svg>;
        case "settings": return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9 1.7 1.7 0 0 0 4.3 7.2l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;
        case "menu":     return <svg {...p}><path d="M3 6h18M3 12h18M3 18h18"/></svg>;
        case "close":    return <svg {...p}><path d="M18 6 6 18M6 6l12 12"/></svg>;
        case "logout":   return <svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>;
        case "chevron":  return <svg {...p}><path d="m6 9 6 6 6-6"/></svg>;
        default: return null;
    }
};

// Nav config por rol
const NAV_BY_ROLE = {
    client: [
        { path: "/inicio",  label: "Inicio", icon: "home" },
        { path: "/shop",    label: "Tienda", icon: "shop" },
        { path: "/perfil",  label: "Perfil", icon: "user" },
        { path: "/coins",   label: "Coins",  icon: "coins" },
        { path: "/chat",    label: "Chat",   icon: "chat" },
    ],
    operator: [
        { path: "/inicio",  label: "Inicio", icon: "home" },
        { path: "/shop",    label: "Tienda", icon: "shop" },
        { path: "/coins",   label: "Coins",  icon: "coins" },
        { path: "/chat",    label: "Chat",   icon: "chat" },
    ],
    admin: [
        { path: "/inicio",      label: "Inicio", icon: "home" },
        { path: "/shop",        label: "Tienda", icon: "shop" },
        { path: "/admin",       label: "Admin",  icon: "admin" },
        { path: "/coins",       label: "Coins",  icon: "coins" },
        { path: "/chat",        label: "Chat",   icon: "chat" },
        { path: "/admin/setup", label: "Config", icon: "settings" },
    ],
};

// Notificaciones — emoji por tipo (social) y formato de fecha es-AR.
// Los anuncios (type "ann_*") muestran 📢; el resto cae a 🔔.
const NOTIF_EMOJI = { follow: "👤", delivery: "📦", like: "❤️", comment: "💬" };
function fmtNotifTime(iso) {
    if (!iso) return "";
    try {
        return new Date(iso).toLocaleString("es-AR", {
            day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
        });
    } catch { return ""; }
}

// Rutas donde NO se renderiza el TopNav (login flow, setup).
// El shop, /inicio, /perfil, /admin, /coins, /chat sí lo muestran.
const HIDE_ON_PATHS = [
    "/", "/login", "/register", "/registro",
    "/forgot-password", "/reset-password", "/verify-email",
    "/setup-admin",
];

export default function TopNav() {
    const location = useLocation();
    const navigate = useNavigate();
    const userCtx = useUser();
    const [me, setMe] = useState(null);
    const [balance, setBalance] = useState(null);
    const [unreadChat, setUnreadChat] = useState(0);
    const [notifs, setNotifs] = useState([]);                 // notificaciones
    const [unreadNotifs, setUnreadNotifs] = useState(0);
    const [notifOpen, setNotifOpen] = useState(false);        // bell dropdown
    const [menuOpen, setMenuOpen] = useState(false);          // mobile drawer
    const [userMenuOpen, setUserMenuOpen] = useState(false);  // desktop dropdown
    const userMenuRef = useRef(null);
    const notifRef = useRef(null);

    // Calcular si el nav debe ocultarse — necesitamos saberlo antes de
    // posibles returns prematuros para mantener el orden de hooks
    // consistente (React error #310: "rendered more hooks than during
    // the previous render" si retornamos antes de algún useEffect).
    const hidden = HIDE_ON_PATHS.includes(location.pathname);

    useEffect(() => {
        const token = getToken();
        if (!token) return;
        fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then((d) => {
                if (!d.user) return;
                setMe(d.user);
                // Fix: el endpoint es /coins/:userId, no /coins/me. Fetch sólo
                // cuando tenemos el ID. Falla silenciosa si feature off o
                // server error (no es crítico para que el nav funcione).
                fetch(`${API}/coins/${d.user.id}`, { headers: { Authorization: `Bearer ${token}` } })
                    .then((r) => r.ok ? r.json() : null)
                    .then((cd) => { if (cd?.balance != null) setBalance(cd.balance); })
                    .catch(() => {});
            })
            .catch(() => {});
        // Unread chat + notificaciones — un solo loop de polling (30s).
        const refresh = async () => {
            try {
                const r = await fetch(`${API}/api/chat/unread`, { headers: { Authorization: `Bearer ${token}` } });
                const d = await r.json();
                if (d.ok) setUnreadChat(d.total || 0);
            } catch {}
            try {
                const r = await fetch(`${API}/api/notifications`, { headers: { Authorization: `Bearer ${token}` } });
                const d = await r.json();
                if (d.ok) { setNotifs(d.notifications || []); setUnreadNotifs(d.unread || 0); }
            } catch {}
        };
        refresh();
        const t = setInterval(refresh, 30000);
        return () => clearInterval(t);
    }, []);

    // Close dropdowns on outside click + on route change
    useEffect(() => {
        setMenuOpen(false);
        setUserMenuOpen(false);
        setNotifOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        if (!userMenuOpen) return;
        const onClick = (e) => {
            if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
        };
        document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, [userMenuOpen]);

    useEffect(() => {
        if (!notifOpen) return;
        const onClick = (e) => {
            if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
        };
        document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, [notifOpen]);

    // Marcar todas leídas (POST sin ids = todas) — optimista.
    function markAllNotifsRead() {
        setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadNotifs(0);
        fetch(`${API}/api/notifications/read`, {
            method: "POST",
            headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
            body: JSON.stringify({}),
        }).catch(() => {});
    }

    // Abrir una notificación: marca leída (optimista) y navega a su link.
    function openNotif(n) {
        setNotifOpen(false);
        if (!n.read) {
            setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
            setUnreadNotifs((u) => Math.max(0, u - 1));
            fetch(`${API}/api/notifications/read`, {
                method: "POST",
                headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
                body: JSON.stringify({ ids: [n.id] }),
            }).catch(() => {});
        }
        if (n.link) navigate(n.link);
    }

    const isAnon = !getToken();
    const role = me?.role || "client";
    // Si es anónimo, nav reducida (Tienda + Inicio) sin admin / coins / chat
    const nav = useMemo(() => {
        if (isAnon) return [
            { path: "/shop", label: "Tienda", icon: "shop" },
        ];
        return NAV_BY_ROLE[role] || NAV_BY_ROLE.client;
    }, [role, isAnon]);

    function logout() {
        localStorage.removeItem("token");
        sessionStorage.removeItem("token");
        navigate("/", { replace: true });
        // Hard reload to clear all state
        setTimeout(() => window.location.reload(), 50);
    }

    // Después de TODOS los hooks: si la ruta está en HIDE_ON_PATHS,
    // no renderizar. Antes había un `return null` arriba que rompía
    // el orden de hooks → React error #310 al navegar entre auth y
    // non-auth pages (cantidad de hooks cambia entre renders).
    if (hidden) return null;

    return (
        <>
            <header style={S.shell}>
                <div style={S.inner}>
                    {/* Brand */}
                    <Link to="/inicio" style={S.brand} aria-label="Inicio">
                        <span style={S.brandDot} />
                        <span style={S.brandName}>HOLISTIC</span>
                    </Link>

                    {/* Desktop nav */}
                    <nav className="topnav-nav" style={S.nav} aria-label="Navegación principal">
                        {nav.map((item) => {
                            const active = location.pathname === item.path
                                || (item.path !== "/inicio" && location.pathname.startsWith(item.path));
                            const showBadge = item.path === "/chat" && unreadChat > 0;
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    style={{
                                        ...S.navLink,
                                        ...(active ? S.navLinkActive : {}),
                                    }}
                                >
                                    <span style={S.navIcon}><Icon name={item.icon} /></span>
                                    <span style={S.navLabel}>{item.label}</span>
                                    {active && <span style={S.activeBar} aria-hidden="true" />}
                                    {showBadge && (
                                        <span style={S.unreadBadge} aria-label={`${unreadChat} mensajes sin leer`}>
                                            {unreadChat > 9 ? "9+" : unreadChat}
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Right: balance + user menu (desktop) + hamburger (mobile) */}
                    <div style={S.right}>
                        {balance != null && !isAnon && (
                            <Link to="/coins" className="topnav-balance" style={S.balance} aria-label={`Balance: ${balance} coins`}>
                                <Icon name="coins" size={14} />
                                <span style={S.balanceNum}>{balance}</span>
                            </Link>
                        )}

                        {/* Notificaciones (bell) — solo logueado */}
                        {!isAnon && (
                        <div ref={notifRef} style={S.notifWrap}>
                            <button
                                style={S.iconBtn}
                                onClick={() => setNotifOpen((v) => !v)}
                                aria-label="Notificaciones"
                                aria-expanded={notifOpen}
                            >
                                <Icon name="bell" size={18} />
                                {unreadNotifs > 0 && (
                                    <span style={S.iconBadge} aria-label={`${unreadNotifs} sin leer`}>
                                        {unreadNotifs > 9 ? "9+" : unreadNotifs}
                                    </span>
                                )}
                            </button>
                            {notifOpen && (
                                <div style={S.notifMenu}>
                                    <div style={S.notifHead}>
                                        <span style={S.notifTitle}>Notificaciones</span>
                                        {unreadNotifs > 0 && (
                                            <button onClick={markAllNotifsRead} style={S.notifMarkAll}>
                                                Marcar leído
                                            </button>
                                        )}
                                    </div>
                                    <div style={S.notifList}>
                                        {notifs.length === 0 && (
                                            <div style={S.notifEmpty}>Sin notificaciones</div>
                                        )}
                                        {notifs.map((n) => {
                                            const isAnn = typeof n.type === "string" && n.type.startsWith("ann_");
                                            return (
                                                <button
                                                    key={n.id}
                                                    onClick={() => openNotif(n)}
                                                    style={{ ...S.notifItem, ...(n.read ? {} : S.notifItemUnread) }}
                                                >
                                                    <span style={S.notifAvatar}>
                                                        {isAnn
                                                            ? "📢"
                                                            : n.actor_avatar
                                                                ? <img src={n.actor_avatar} alt="" style={S.notifAvatarImg} />
                                                                : (NOTIF_EMOJI[n.type] || "🔔")}
                                                    </span>
                                                    <span style={S.notifTextWrap}>
                                                        {!isAnn && n.actor_name && (
                                                            <span style={{ ...S.notifActor, color: n.actor_name_color || "var(--c-accent, #A7F5C8)" }}>
                                                                {n.actor_name}{" "}
                                                            </span>
                                                        )}
                                                        <span style={n.read ? S.notifTextRead : S.notifText}>
                                                            {isAnn ? n.title : n.body}
                                                        </span>
                                                        <span style={S.notifTime}>{fmtNotifTime(n.created_at)}</span>
                                                    </span>
                                                    {!n.read && <span style={S.notifDot} aria-hidden="true" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        )}

                        {/* Anónimo: solo CTA "Iniciar sesión" + hamburger */}
                        {isAnon && (
                            <Link to="/login" style={S.loginCta}>
                                Iniciar sesión
                            </Link>
                        )}

                        {/* User dropdown (solo si está logueado) */}
                        {!isAnon && (
                        <div ref={userMenuRef} style={S.userWrap}>
                            <button
                                style={S.userBtn}
                                onClick={() => setUserMenuOpen((v) => !v)}
                                aria-label="Menú de usuario"
                                aria-expanded={userMenuOpen}
                            >
                                <span style={S.avatar}>{(me?.name || me?.email || "?").charAt(0).toUpperCase()}</span>
                                <span style={S.userName} className="topnav-username">
                                    {me?.name ? me.name.split(" ")[0] : "Cuenta"}
                                </span>
                                <Icon name="chevron" size={14} />
                            </button>
                            {userMenuOpen && (
                                <div style={S.userMenu}>
                                    <div style={S.userMenuHead}>
                                        <div style={S.userMenuName}>{me?.name || "—"}</div>
                                        <div style={S.userMenuEmail}>{me?.email}</div>
                                        {me?.role && me.role !== "client" && (
                                            <span style={S.roleBadge}>{me.role}</span>
                                        )}
                                    </div>
                                    <Link to="/perfil" style={S.userMenuItem}>
                                        <Icon name="user" size={16} /> Mi perfil
                                    </Link>
                                    <Link to="/coins" style={S.userMenuItem}>
                                        <Icon name="coins" size={16} /> Mis coins{balance != null ? ` (${balance})` : ""}
                                    </Link>
                                    {role === "admin" && (
                                        <Link to="/admin" style={S.userMenuItem}>
                                            <Icon name="admin" size={16} /> Panel admin
                                        </Link>
                                    )}
                                    <button
                                        onClick={logout}
                                        style={{ ...S.userMenuItem, ...S.userMenuLogout, textAlign: "left", border: "none", width: "100%" }}
                                    >
                                        <Icon name="logout" size={16} /> Cerrar sesión
                                    </button>
                                </div>
                            )}
                        </div>
                        )}

                        {/* Hamburger (mobile) */}
                        <button
                            className="topnav-hamburger"
                            style={S.hamburger}
                            onClick={() => setMenuOpen(true)}
                            aria-label="Abrir menú"
                        >
                            <Icon name="menu" size={22} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Mobile drawer */}
            <div style={S.mobileBackdrop(menuOpen)} onClick={() => setMenuOpen(false)} />
            <aside style={S.mobileDrawer(menuOpen)} aria-hidden={!menuOpen}>
                <div style={S.mobileHeader}>
                    <span style={S.brandName}>HOLISTIC</span>
                    <button style={S.mobileClose} onClick={() => setMenuOpen(false)} aria-label="Cerrar menú">
                        <Icon name="close" size={22} />
                    </button>
                </div>
                <nav style={S.mobileNav}>
                    {nav.map((item) => {
                        const active = location.pathname === item.path;
                        return (
                            <Link key={item.path} to={item.path} style={{
                                ...S.mobileNavLink,
                                ...(active ? S.mobileNavLinkActive : {}),
                            }}>
                                <Icon name={item.icon} size={20} />
                                <span>{item.label}</span>
                                {item.path === "/chat" && unreadChat > 0 && (
                                    <span style={{ ...S.unreadBadge, position: "static", marginLeft: "auto" }}>
                                        {unreadChat > 9 ? "9+" : unreadChat}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                    <hr style={S.mobileDivider} />
                    <button onClick={logout} style={{ ...S.mobileNavLink, color: "#fca5a5", background: "transparent", border: "none", textAlign: "left", width: "100%" }}>
                        <Icon name="logout" size={20} /> Cerrar sesión
                    </button>
                </nav>
            </aside>

            {/* Spacer global para que el contenido no quede tapado por la nav fixed */}
            <div style={S.spacer} aria-hidden="true" />
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles — namespace S
// ─────────────────────────────────────────────────────────────────────────────
const S = {
    shell: {
        position: "fixed", top: 0, left: 0, right: 0,
        zIndex: 200,
        background: "rgba(6, 6, 6, 0.85)",
        backdropFilter: "blur(16px) saturate(140%)",
        WebkitBackdropFilter: "blur(16px) saturate(140%)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
    },
    spacer: { height: 64 },
    inner: {
        maxWidth: 1440, margin: "0 auto",
        padding: "0 clamp(14px, 2vw, 28px)",
        height: 64,
        display: "flex", alignItems: "center", gap: 16,
    },

    // Brand
    brand: {
        display: "inline-flex", alignItems: "center", gap: 10,
        textDecoration: "none", color: "inherit",
        flexShrink: 0,
    },
    brandDot: {
        width: 10, height: 10, borderRadius: "50%",
        background: "var(--brand-primary, #A7F5C8)",
        boxShadow: "0 0 12px var(--brand-primary, #A7F5C8)",
    },
    brandName: {
        fontFamily: "var(--brand-font, 'Gotham', sans-serif)",
        fontSize: 16, fontWeight: 900,
        letterSpacing: "0.16em",
        color: "var(--brand-text, #ede9e0)",
    },

    // Desktop nav
    nav: {
        display: "flex", alignItems: "center", gap: 4,
        flex: 1,
        marginLeft: "clamp(20px, 4vw, 48px)",
    },
    navLink: {
        position: "relative",
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "10px 14px",
        borderRadius: 10,
        color: "rgba(237, 233, 224, 0.55)",
        textDecoration: "none",
        fontSize: 12, fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        transition: "color .25s ease, background .25s ease",
    },
    navLinkActive: {
        color: "var(--brand-primary, #A7F5C8)",
        background: "rgba(167, 245, 200, 0.08)",
    },
    navIcon: { display: "inline-flex" },
    navLabel: {},
    activeBar: {
        position: "absolute",
        bottom: -1, left: "50%",
        transform: "translateX(-50%)",
        width: "60%", height: 2,
        background: "var(--brand-primary, #A7F5C8)",
        borderRadius: 999,
    },
    unreadBadge: {
        position: "absolute",
        top: 4, right: 6,
        minWidth: 16, height: 16,
        padding: "0 4px",
        borderRadius: 999,
        background: "#ef4444",
        color: "#fff",
        fontSize: 9, fontWeight: 800,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
    },

    // Right
    right: { display: "inline-flex", alignItems: "center", gap: 10, flexShrink: 0 },
    balance: {
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "7px 12px",
        borderRadius: 999,
        background: "rgba(167, 245, 200, 0.10)",
        border: "1px solid rgba(167, 245, 200, 0.22)",
        color: "var(--brand-primary, #A7F5C8)",
        textDecoration: "none",
        fontSize: 12, fontWeight: 800,
        letterSpacing: "0.04em",
    },
    balanceNum: { fontVariantNumeric: "tabular-nums" },

    // Bell + notif dropdown
    notifWrap: { position: "relative" },
    iconBtn: {
        position: "relative",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 38, height: 38,
        borderRadius: 999,
        background: "rgba(255, 255, 255, 0.04)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        color: "var(--brand-text, #ede9e0)",
        cursor: "pointer",
        transition: "background .25s ease",
    },
    iconBadge: {
        position: "absolute",
        top: -2, right: -2,
        minWidth: 16, height: 16,
        padding: "0 4px",
        borderRadius: 999,
        background: "#ef4444",
        color: "#fff",
        fontSize: 9, fontWeight: 800,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
    },
    notifMenu: {
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        width: "min(360px, calc(100vw - 24px))",
        background: "rgba(10, 10, 10, 0.96)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: 14,
        boxShadow: "0 24px 60px -10px rgba(0, 0, 0, 0.7)",
        zIndex: 300,
        overflow: "hidden",
    },
    notifHead: {
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
    },
    notifTitle: {
        fontSize: 11, fontWeight: 800,
        letterSpacing: "0.18em", textTransform: "uppercase",
        color: "var(--brand-text, #ede9e0)",
    },
    notifMarkAll: {
        background: "transparent", border: "none", cursor: "pointer",
        color: "var(--brand-primary, #A7F5C8)",
        fontFamily: "inherit", fontSize: 11, fontWeight: 700,
        letterSpacing: "0.04em",
    },
    notifList: { maxHeight: 380, overflowY: "auto" },
    notifEmpty: {
        padding: "24px 16px", textAlign: "center",
        fontSize: 12, color: "rgba(237, 233, 224, 0.5)",
    },
    notifItem: {
        display: "flex", gap: 12, alignItems: "flex-start",
        width: "100%", textAlign: "left",
        padding: "12px 16px",
        background: "transparent", border: "none",
        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
        cursor: "pointer", fontFamily: "inherit",
    },
    notifItemUnread: { background: "rgba(167, 245, 200, 0.06)" },
    notifAvatar: {
        flexShrink: 0, width: 34, height: 34,
        borderRadius: "50%", overflow: "hidden",
        background: "rgba(167, 245, 200, 0.10)",
        border: "1px solid rgba(167, 245, 200, 0.20)",
        display: "grid", placeItems: "center",
        fontSize: 16,
    },
    notifAvatarImg: { width: "100%", height: "100%", objectFit: "cover" },
    notifTextWrap: { flex: 1, minWidth: 0 },
    notifActor: { fontSize: 13, fontWeight: 700 },
    notifText: { fontSize: 13, color: "var(--brand-text, #ede9e0)", lineHeight: 1.45 },
    notifTextRead: { fontSize: 13, color: "rgba(237, 233, 224, 0.55)", lineHeight: 1.45 },
    notifTime: {
        display: "block", marginTop: 5,
        fontSize: 10, letterSpacing: "0.04em",
        color: "rgba(237, 233, 224, 0.4)",
    },
    notifDot: {
        flexShrink: 0, width: 7, height: 7, marginTop: 6,
        borderRadius: "50%",
        background: "var(--brand-primary, #A7F5C8)",
        boxShadow: "0 0 6px var(--brand-primary, #A7F5C8)",
    },

    userWrap: { position: "relative" },
    userBtn: {
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "5px 10px 5px 5px",
        borderRadius: 999,
        background: "rgba(255, 255, 255, 0.04)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        color: "var(--brand-text, #ede9e0)",
        cursor: "pointer", fontFamily: "inherit",
        fontSize: 12, fontWeight: 700,
        transition: "background .25s ease",
    },
    avatar: {
        width: 26, height: 26, borderRadius: "50%",
        background: "linear-gradient(135deg, #25D366 0%, #2E8F6E 100%)",
        color: "#fff", fontWeight: 900, fontSize: 12,
        display: "grid", placeItems: "center",
    },
    userName: { letterSpacing: "0.04em" },

    userMenu: {
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        minWidth: 240,
        background: "rgba(10, 10, 10, 0.96)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: 14,
        padding: 6,
        boxShadow: "0 24px 60px -10px rgba(0, 0, 0, 0.7)",
        zIndex: 300,
    },
    userMenuHead: {
        padding: "12px 14px 14px",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        marginBottom: 6,
    },
    userMenuName: { fontSize: 14, fontWeight: 800, lineHeight: 1.2 },
    userMenuEmail: {
        fontSize: 11, color: "rgba(237, 233, 224, 0.5)",
        marginTop: 4, wordBreak: "break-all",
    },
    roleBadge: {
        display: "inline-block",
        marginTop: 8,
        padding: "3px 10px",
        borderRadius: 999,
        background: "rgba(167, 245, 200, 0.12)",
        color: "var(--brand-primary, #A7F5C8)",
        fontSize: 10, fontWeight: 800, letterSpacing: "0.18em",
        textTransform: "uppercase",
    },
    userMenuItem: {
        display: "inline-flex", alignItems: "center", gap: 10,
        width: "100%", padding: "10px 14px",
        borderRadius: 10,
        color: "rgba(237, 233, 224, 0.85)",
        textDecoration: "none",
        fontFamily: "inherit", fontSize: 13, fontWeight: 600,
        cursor: "pointer", background: "transparent",
    },
    userMenuLogout: {
        color: "#fca5a5",
        borderTop: "1px solid rgba(255, 255, 255, 0.06)",
        marginTop: 6, paddingTop: 12,
    },

    // Login CTA (anónimo)
    loginCta: {
        display: "inline-flex", alignItems: "center",
        padding: "9px 18px",
        borderRadius: 999,
        background: "linear-gradient(135deg, #25D366 0%, #2E8F6E 100%)",
        color: "#fff",
        textDecoration: "none",
        fontFamily: "inherit",
        fontSize: 12, fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        boxShadow: "0 8px 20px -6px rgba(46, 143, 110, 0.5)",
        transition: "box-shadow .25s ease, transform .2s ease",
    },

    // Hamburger
    hamburger: {
        display: "none",  // shown only on mobile via inline-style media query below
        width: 40, height: 40,
        background: "rgba(255, 255, 255, 0.05)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: 10,
        color: "var(--brand-text, #ede9e0)",
        cursor: "pointer", placeItems: "center",
        alignItems: "center", justifyContent: "center",
    },

    // Mobile drawer
    mobileBackdrop: (open) => ({
        position: "fixed", inset: 0,
        background: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        transition: "opacity .3s ease",
        zIndex: 380,
    }),
    mobileDrawer: (open) => ({
        position: "fixed",
        top: 0, right: 0, bottom: 0,
        width: "min(320px, 88vw)",
        background: "rgba(8, 8, 8, 0.98)",
        backdropFilter: "blur(20px)",
        borderLeft: "1px solid rgba(255, 255, 255, 0.06)",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform .35s cubic-bezier(.2,.8,.2,1)",
        zIndex: 400,
        display: "flex", flexDirection: "column",
    }),
    mobileHeader: {
        height: 64,
        padding: "0 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
    },
    mobileClose: {
        background: "transparent", border: "none", color: "inherit",
        padding: 8, cursor: "pointer",
    },
    mobileNav: {
        flex: 1,
        padding: 12,
        display: "flex", flexDirection: "column", gap: 4,
        overflowY: "auto",
    },
    mobileNavLink: {
        display: "inline-flex", alignItems: "center", gap: 14,
        padding: "13px 16px",
        borderRadius: 12,
        color: "rgba(237, 233, 224, 0.85)",
        textDecoration: "none",
        fontFamily: "inherit",
        fontSize: 14, fontWeight: 700,
        letterSpacing: "0.06em",
        cursor: "pointer",
    },
    mobileNavLinkActive: {
        color: "var(--brand-primary, #A7F5C8)",
        background: "rgba(167, 245, 200, 0.10)",
    },
    mobileDivider: {
        border: "none",
        borderTop: "1px solid rgba(255, 255, 255, 0.06)",
        margin: "10px 4px",
    },
};

// ── Estilos responsive inyectados una sola vez ──
// Las clases topnav-* las uso como hooks (no en CSS-in-JS) para que la
// media query las pueda flipear sin re-renders.
if (typeof window !== "undefined" && !document.getElementById("topnav-responsive-css")) {
    const styleEl = document.createElement("style");
    styleEl.id = "topnav-responsive-css";
    styleEl.textContent = `
        /* Hamburguesa visible en celu Y web (acceso a internas vía drawer). */
        .topnav-hamburger { display: inline-flex !important; }
        @media (max-width: 900px) {
            .topnav-nav { display: none !important; }
            .topnav-balance { display: none !important; }
            .topnav-username { display: none !important; }
        }
    `;
    document.head.appendChild(styleEl);
}
