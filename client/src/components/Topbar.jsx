import { useEffect, useState } from "react";
import { useUser } from "../context/UserContext.jsx";
import { useNavigate } from "react-router-dom";
import { CountUp } from "./MotionPop.jsx";
import { useBranding } from "../lib/branding.js";

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

/* =====================================================================
   Topbar — premium dark, glass surface + Holistic palette.
   Rationale: SVG icons en lugar de emojis para los actions (bell,
   envelope, chevron, logout). Logo respeta useBranding.name. Dropdowns
   refinados con tipografía mono + sans bien jerarquizada.
   ===================================================================== */

const Icon = ({ name }) => {
    const props = {
        width: 18, height: 18, viewBox: "0 0 24 24",
        fill: "none", stroke: "currentColor",
        strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round",
        "aria-hidden": "true",
    };
    switch (name) {
        case "bell":     return <svg {...props}><path d="M6 8a6 6 0 1 1 12 0c0 4 1.5 5 2 6H4c.5-1 2-2 2-6"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>;
        case "envelope": return <svg {...props}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>;
        case "user":     return <svg {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>;
        case "coins":    return <svg {...props}><ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M3 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/><ellipse cx="17" cy="14" rx="4" ry="2"/><path d="M13 14v4c0 1.1 1.8 2 4 2s4-.9 4-2v-4"/></svg>;
        case "logout":   return <svg {...props}><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>;
        case "chevron":  return <svg {...props} width="12" height="12"><path d="m6 9 6 6 6-6"/></svg>;
        default:         return null;
    }
};

const ANN_CFG = {
    urgente: { color: "var(--h-danger)",  bg: "var(--h-danger-soft)",     border: "rgba(239,68,68,.3)",   label: "Urgente" },
    linea:   { color: "var(--h-green)",   bg: "var(--h-green-soft)",      border: "var(--h-green-mid)",   label: "Líneas" },
    feriado: { color: "var(--h-info)",    bg: "rgba(59,130,246,.1)",      border: "rgba(59,130,246,.3)",  label: "Feriado" },
    tip:     { color: "var(--h-warn)",    bg: "rgba(245,158,11,.1)",      border: "rgba(245,158,11,.3)",  label: "Tip" },
    novedad: { color: "var(--h-sand)",    bg: "var(--h-sand-soft)",       border: "var(--h-sand-mid)",    label: "Novedad" },
    general: { color: "var(--h-green)",   bg: "var(--h-green-soft)",      border: "var(--h-green-mid)",   label: "Anuncio" },
};

export default function Topbar() {
    const userCtx  = useUser();
    const branding = useBranding();
    const navigate = useNavigate();
    const [me, setMe] = useState(null);
    const [profileData, setProfileData] = useState(null);
    const [scrolled, setScrolled] = useState(false);
    const [userDrop, setUserDrop] = useState(false);
    const [notifs, setNotifs] = useState([]);
    const [notifOpen, setNotifOpen] = useState(false);
    const [unread, setUnread] = useState(0);
    const [privUnread, setPrivUnread] = useState(0);

    /* ── Data fetching (unchanged from previous Topbar) ── */
    useEffect(() => {
        if (!getToken()) return;
        const loadNotifs = () => {
            fetch(`${API}/api/notifications`, { headers: { Authorization: `Bearer ${getToken()}` } })
                .then(r => r.json()).then(d => { if (d.ok) { setNotifs(d.notifications); setUnread(d.unread); } }).catch(() => {});
            fetch(`${API}/api/chat/private/unread/count`, { headers: { Authorization: `Bearer ${getToken()}` } })
                .then(r => r.json()).then(d => { if (d.ok) setPrivUnread(d.total || 0); }).catch(() => {});
        };
        loadNotifs();
        const iv = setInterval(loadNotifs, 30000);
        return () => clearInterval(iv);
    }, []);

    useEffect(() => {
        const token = getToken();
        if (!token) return;
        fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json()).then(d => {
                if (d.user) {
                    setMe(d.user);
                    fetch(`${API}/profile`, { headers: { Authorization: `Bearer ${token}` } })
                        .then(r => r.json()).then(d => { if (d.profile) setProfileData(d); }).catch(() => {});
                }
            }).catch(() => {});
    }, []);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 10);
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
        if (!notifOpen) return;
        const handler = () => setNotifOpen(false);
        document.addEventListener("click", handler);
        return () => document.removeEventListener("click", handler);
    }, [notifOpen]);

    useEffect(() => {
        if (!userDrop) return;
        const handler = () => setUserDrop(false);
        document.addEventListener("click", handler);
        return () => document.removeEventListener("click", handler);
    }, [userDrop]);

    async function markAllRead() {
        await fetch(`${API}/api/notifications/read`, {
            method: "POST",
            headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });
        setNotifs(n => n.map(x => ({ ...x, read: true })));
        setUnread(0);
    }

    function logout() {
        localStorage.removeItem("token");
        sessionStorage.removeItem("token");
        window.location.href = "/";
    }

    const isStaff   = me?.role === "operator" || me?.role === "admin";
    const roleLabel = me?.role === "admin" ? "Admin" : isStaff ? "Operador" : "Cliente";

    const displayName = userCtx?.displayName || me?.name || "";
    const nameStyle   = userCtx?.nameStyle  || { color: "var(--h-text-1)" };
    const avatarUrl   = profileData?.profile?.avatar_url || null;
    const avatarKey   = profileData?.profile?.avatar_key || "avatar_lemon";
    const avatarEmoji = ({ avatar_lemon: "🪙", avatar_rocket: "🚀", avatar_globe: "🌍", avatar_diamond: "💎", avatar_fire: "🔥", avatar_crown: "👑" })[avatarKey] || "🪙";
    const avatarBg    = ({
        avatar_lemon: "var(--h-green)", avatar_rocket: "var(--h-info)",
        avatar_globe: "var(--h-success)", avatar_diamond: "#a78bfa",
        avatar_fire: "var(--h-sand)", avatar_crown: "var(--h-green)",
    })[avatarKey] || "var(--h-green)";
    const balance     = profileData?.coins?.balance || 0;

    const brandName = (branding?.name || "Holistic").toUpperCase();

    return (
        <>
            <style>{`
                .h-tb {
                    position: sticky; top: 0; z-index: 500;
                    height: var(--h-topbar-h, 64px);
                    background: ${scrolled
                        ? "color-mix(in srgb, var(--h-bg-0) 96%, transparent)"
                        : "color-mix(in srgb, var(--h-bg-0) 80%, transparent)"};
                    backdrop-filter: blur(24px) saturate(140%);
                    -webkit-backdrop-filter: blur(24px) saturate(140%);
                    border-bottom: 1px solid var(--h-line-1);
                    transition: background var(--h-trans-base), box-shadow var(--h-trans-base);
                    box-shadow: ${scrolled ? "0 8px 32px rgba(0,0,0,.4)" : "none"};
                }
                .h-tb::before {
                    content: '';
                    position: absolute; top: 0; left: 0; right: 0; height: 1px;
                    background: linear-gradient(90deg,
                        transparent,
                        var(--h-green-mid),
                        var(--h-sand-mid),
                        var(--h-green-mid),
                        transparent);
                    opacity: ${scrolled ? "1" : "0"};
                    transition: opacity var(--h-trans-base);
                }
                .h-tb__inner {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 0 var(--h-sp-7);
                    height: 100%;
                    gap: var(--h-sp-3);
                }

                /* ── Logo ── */
                .h-tb__logo {
                    display: inline-flex; align-items: center; gap: 12px;
                    text-decoration: none;
                    flex-shrink: 0;
                    color: var(--h-text-1);
                    transition: opacity var(--h-trans-base);
                }
                .h-tb__logo:hover { opacity: 0.85; }
                .h-tb__logo-img {
                    width: 32px; height: 32px;
                    object-fit: contain;
                    filter: drop-shadow(0 0 10px var(--h-green-glow));
                }
                .h-tb__logo-name {
                    font-family: var(--h-font-display);
                    font-size: 22px;
                    letter-spacing: 4px;
                    font-weight: 400;
                }
                .h-tb__logo-dot {
                    width: 6px; height: 6px;
                    border-radius: 50%;
                    background: var(--h-green);
                    box-shadow: 0 0 10px var(--h-green-glow);
                    animation: h-tb-pulse 2.4s ease-in-out infinite;
                }
                @keyframes h-tb-pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50%      { opacity: 0.3; transform: scale(0.7); }
                }

                /* ── Right cluster ── */
                .h-tb__right {
                    display: flex; align-items: center; gap: 10px;
                    flex-shrink: 0;
                }

                /* ── Icon button (bell, envelope) ── */
                .h-tb__iconbtn {
                    position: relative;
                    width: 38px; height: 38px;
                    border-radius: var(--h-r-md);
                    background: var(--h-bg-2);
                    border: 1px solid var(--h-line-1);
                    color: var(--h-text-2);
                    display: grid; place-items: center;
                    cursor: pointer;
                    transition: all var(--h-trans-base);
                }
                .h-tb__iconbtn:hover {
                    background: var(--h-bg-3);
                    border-color: var(--h-line-2);
                    color: var(--h-text-1);
                    transform: translateY(-1px);
                }
                .h-tb__iconbtn--accent {
                    background: var(--h-green-soft);
                    border-color: var(--h-green-mid);
                    color: var(--h-green);
                }
                .h-tb__iconbtn--accent:hover {
                    background: var(--h-green-mid);
                    color: var(--h-green);
                }
                .h-tb__iconbadge {
                    position: absolute;
                    top: -3px; right: -3px;
                    min-width: 16px; height: 16px;
                    padding: 0 4px;
                    border-radius: var(--h-r-full);
                    background: var(--h-danger);
                    color: #fff;
                    font-family: var(--h-font-mono);
                    font-size: 9px;
                    font-weight: 700;
                    display: grid; place-items: center;
                    border: 2px solid var(--h-bg-0);
                }
                .h-tb__iconbadge--success {
                    background: var(--h-green);
                    color: var(--h-bg-0);
                }

                /* ── User button ── */
                .h-tb__userbtn {
                    display: flex; align-items: center; gap: 12px;
                    padding: 6px 14px 6px 6px;
                    border-radius: var(--h-r-md);
                    background: var(--h-bg-2);
                    border: 1px solid var(--h-line-1);
                    color: var(--h-text-1);
                    cursor: pointer;
                    transition: all var(--h-trans-base);
                    position: relative;
                    height: 44px;
                }
                .h-tb__userbtn:hover {
                    background: var(--h-bg-3);
                    border-color: var(--h-line-2);
                    transform: translateY(-1px);
                }
                .h-tb__avatar {
                    width: 32px; height: 32px;
                    border-radius: var(--h-r-full);
                    flex-shrink: 0;
                    overflow: hidden;
                    display: grid; place-items: center;
                    font-size: 16px;
                    background: var(--avatar-bg, var(--h-green));
                }
                .h-tb__avatar img {
                    width: 100%; height: 100%; object-fit: cover;
                }
                .h-tb__userinfo {
                    display: flex; flex-direction: column;
                    gap: 2px; min-width: 0;
                }
                .h-tb__usermeta {
                    display: flex; align-items: center; gap: 8px;
                }
                .h-tb__role {
                    font-family: var(--h-font-mono);
                    font-size: 9px;
                    letter-spacing: 1.5px;
                    text-transform: uppercase;
                    padding: 2px 7px;
                    border-radius: var(--h-r-xs);
                    background: var(--h-green-soft);
                    border: 1px solid var(--h-green-mid);
                    color: var(--h-green);
                    font-weight: 600;
                }
                .h-tb__name {
                    font-family: var(--h-font-sans);
                    font-size: 13px;
                    font-weight: 700;
                    line-height: 1;
                }
                .h-tb__sub {
                    font-family: var(--h-font-mono);
                    font-size: 10px;
                    color: var(--h-text-3);
                    letter-spacing: 0.5px;
                    line-height: 1;
                }
                .h-tb__chev {
                    color: var(--h-text-3);
                    transition: transform var(--h-trans-base);
                }
                .h-tb__userbtn[aria-expanded="true"] .h-tb__chev {
                    transform: rotate(180deg);
                }

                /* ── Dropdown ── */
                .h-tb__drop {
                    position: absolute;
                    top: calc(100% + 8px);
                    right: 0;
                    min-width: 280px;
                    background: var(--h-bg-glass);
                    border: 1px solid var(--h-line-2);
                    border-radius: var(--h-r-lg);
                    box-shadow: var(--h-el-4);
                    backdrop-filter: blur(28px) saturate(140%);
                    -webkit-backdrop-filter: blur(28px) saturate(140%);
                    overflow: hidden;
                    z-index: 9999;
                    animation: h-tb-drop 240ms var(--h-ease-out);
                }
                @keyframes h-tb-drop {
                    from { opacity: 0; transform: translateY(-8px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .h-tb__drop-head {
                    padding: 16px 18px;
                    background: var(--h-bg-2);
                    border-bottom: 1px solid var(--h-line-1);
                    display: flex; align-items: center; gap: 12px;
                }
                .h-tb__drop-head-name {
                    font-family: var(--h-font-sans);
                    font-size: 15px;
                    font-weight: 700;
                    color: var(--h-text-1);
                    line-height: 1.1;
                }
                .h-tb__drop-head-balance {
                    font-family: var(--h-font-mono);
                    font-size: 11px;
                    font-weight: 700;
                    color: var(--h-green);
                    letter-spacing: 0.5px;
                    margin-top: 2px;
                }
                .h-tb__drop-head-email {
                    font-family: var(--h-font-mono);
                    font-size: 10px;
                    color: var(--h-text-3);
                    letter-spacing: 0.3px;
                    margin-top: 2px;
                }
                .h-tb__drop-item {
                    display: flex; align-items: center; gap: 12px;
                    padding: 12px 18px;
                    width: 100%;
                    background: transparent;
                    border: 0;
                    border-bottom: 1px solid var(--h-line-1);
                    color: var(--h-text-2);
                    font-family: var(--h-font-sans);
                    font-size: 13px;
                    font-weight: 600;
                    text-align: left;
                    text-decoration: none;
                    cursor: pointer;
                    transition: all var(--h-trans-fast);
                }
                .h-tb__drop-item:last-child { border-bottom: 0; }
                .h-tb__drop-item:hover {
                    background: var(--h-bg-2);
                    color: var(--h-text-1);
                    padding-left: 22px;
                }
                .h-tb__drop-item--danger {
                    color: var(--h-danger);
                }
                .h-tb__drop-item--danger:hover {
                    background: var(--h-danger-soft);
                    color: var(--h-danger);
                }

                /* ── Notif drop ── */
                .h-tb__nf {
                    position: absolute;
                    top: calc(100% + 8px);
                    right: 0;
                    width: 360px;
                    max-height: 480px;
                    background: var(--h-bg-glass);
                    border: 1px solid var(--h-line-2);
                    border-radius: var(--h-r-lg);
                    box-shadow: var(--h-el-4);
                    backdrop-filter: blur(28px) saturate(140%);
                    -webkit-backdrop-filter: blur(28px) saturate(140%);
                    overflow: hidden;
                    z-index: 9999;
                    animation: h-tb-drop 240ms var(--h-ease-out);
                }
                .h-tb__nf-head {
                    padding: 14px 18px;
                    border-bottom: 1px solid var(--h-line-1);
                    display: flex; align-items: center; justify-content: space-between;
                    background: var(--h-bg-2);
                }
                .h-tb__nf-title {
                    font-family: var(--h-font-display);
                    font-size: 16px;
                    letter-spacing: 2px;
                    color: var(--h-text-1);
                }
                .h-tb__nf-mark {
                    font-family: var(--h-font-mono);
                    font-size: 10px;
                    font-weight: 700;
                    letter-spacing: 1px;
                    color: var(--h-green);
                    background: transparent;
                    border: 0;
                    cursor: pointer;
                    padding: 4px 8px;
                    border-radius: var(--h-r-xs);
                    transition: background var(--h-trans-fast);
                }
                .h-tb__nf-mark:hover { background: var(--h-green-soft); }
                .h-tb__nf-list { overflow-y: auto; max-height: 400px; }
                .h-tb__nf-empty {
                    padding: 36px 18px;
                    text-align: center;
                    color: var(--h-text-3);
                    font-family: var(--h-font-mono);
                    font-size: 11px;
                    letter-spacing: 0.5px;
                }

                /* ── Logout button ── */
                .h-tb__logout {
                    display: inline-flex; align-items: center; gap: 8px;
                    padding: 0 16px;
                    height: 38px;
                    border-radius: var(--h-r-md);
                    background: var(--h-bg-2);
                    border: 1px solid var(--h-line-1);
                    color: var(--h-text-2);
                    font-family: var(--h-font-mono);
                    font-size: 11px;
                    font-weight: 600;
                    letter-spacing: 1.5px;
                    text-transform: uppercase;
                    cursor: pointer;
                    transition: all var(--h-trans-base);
                }
                .h-tb__logout:hover {
                    background: var(--h-danger-soft);
                    border-color: rgba(239,68,68,0.25);
                    color: var(--h-danger);
                }

                @media (max-width: 768px) {
                    .h-tb__inner { padding: 0 12px; gap: 8px; }
                    .h-tb__hide-mobile { display: none !important; }
                    .h-tb__logout span { display: none; }
                    .h-tb__logout { width: 38px; padding: 0; justify-content: center; }
                }
                @media (max-width: 600px) {
                    .h-tb__userinfo { display: none; }
                    .h-tb__chev { display: none; }
                    .h-tb__userbtn { padding: 6px; }
                }
            `}</style>

            <div className="h-tb">
                <div className="h-tb__inner">

                    {/* Logo + brand name dinámico */}
                    <a href="/inicio" className="h-tb__logo">
                        {branding?.logo_url
                            ? <img src={branding.logo_url} alt={brandName} className="h-tb__logo-img" />
                            : <img src="/icons/icon.svg" alt={brandName} className="h-tb__logo-img" />
                        }
                        <span className="h-tb__logo-name">{brandName}</span>
                        <span className="h-tb__logo-dot" aria-hidden="true" />
                    </a>

                    {/* Right cluster */}
                    <div className="h-tb__right">
                        {me && (
                            <button
                                className={`h-tb__iconbtn${privUnread > 0 ? " h-tb__iconbtn--accent" : ""}`}
                                onClick={() => navigate("/chats")}
                                title={privUnread > 0 ? `${privUnread} mensajes sin leer` : "Mensajes privados"}
                                type="button"
                                aria-label="Mensajes privados"
                            >
                                <Icon name="envelope" />
                                {privUnread > 0 && (
                                    <span className="h-tb__iconbadge h-tb__iconbadge--success">
                                        {privUnread > 9 ? "9+" : privUnread}
                                    </span>
                                )}
                            </button>
                        )}

                        {me && (
                            <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
                                <button
                                    className="h-tb__iconbtn"
                                    onClick={() => setNotifOpen(o => !o)}
                                    type="button"
                                    aria-label="Notificaciones"
                                    aria-expanded={notifOpen}
                                >
                                    <Icon name="bell" />
                                    {unread > 0 && (
                                        <span className="h-tb__iconbadge">
                                            {unread > 9 ? "9+" : unread}
                                        </span>
                                    )}
                                </button>

                                {notifOpen && (
                                    <div className="h-tb__nf" onClick={e => e.stopPropagation()}>
                                        <div className="h-tb__nf-head">
                                            <span className="h-tb__nf-title">NOTIFICACIONES</span>
                                            {unread > 0 && (
                                                <button onClick={markAllRead} className="h-tb__nf-mark" type="button">
                                                    Marcar todo leído
                                                </button>
                                            )}
                                        </div>
                                        <div className="h-tb__nf-list">
                                            {notifs.length === 0 && (
                                                <div className="h-tb__nf-empty">Sin notificaciones</div>
                                            )}
                                            {notifs.map(n => {
                                                const isAnn = typeof n.type === "string" && n.type.startsWith("ann_");
                                                const annCat = isAnn ? n.type.replace("ann_", "") : null;
                                                const annStyle = isAnn ? (ANN_CFG[annCat] || ANN_CFG.general) : null;
                                                return (
                                                    <a key={n.id} href={n.link || "#"}
                                                       onClick={() => {
                                                           setNotifOpen(false);
                                                           if (!n.read) {
                                                               setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
                                                               setUnread(u => Math.max(0, u - 1));
                                                               fetch(`${API}/api/notifications/read`, {
                                                                   method: "POST",
                                                                   headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
                                                                   body: JSON.stringify({ ids: [n.id] }),
                                                               }).catch(() => {});
                                                           }
                                                       }}
                                                       style={{
                                                           display: "flex", gap: 12, padding: "14px 18px",
                                                           borderBottom: "1px solid var(--h-line-1)",
                                                           background: n.read ? "transparent" : (isAnn ? annStyle.bg : "var(--h-green-soft)"),
                                                           textDecoration: "none",
                                                           transition: "all 0.15s",
                                                           alignItems: "flex-start",
                                                           borderLeft: isAnn && !n.read ? `2px solid ${annStyle.color}` : "2px solid transparent",
                                                       }}
                                                    >
                                                        <div style={{
                                                            flexShrink: 0, width: 38, height: 38,
                                                            borderRadius: isAnn ? "var(--h-r-sm)" : "var(--h-r-full)",
                                                            overflow: "hidden",
                                                            border: `1px solid ${isAnn ? annStyle.border : "var(--h-green-mid)"}`,
                                                            background: isAnn ? annStyle.bg : "var(--h-green-soft)",
                                                            display: "grid", placeItems: "center",
                                                            fontSize: 17,
                                                        }}>
                                                            {isAnn
                                                                ? <span>📢</span>
                                                                : (n.actor_avatar
                                                                    ? <img src={n.actor_avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                                                                    : <span>{n.type === "follow" ? "👤" : n.type === "delivery" ? "📦" : n.type === "like" ? "❤️" : n.type === "comment" ? "💬" : "🔔"}</span>
                                                                  )
                                                            }
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            {isAnn ? (
                                                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                                                                    <span style={{
                                                                        fontFamily: "var(--h-font-mono)",
                                                                        fontSize: 9, fontWeight: 700, letterSpacing: "1.2px",
                                                                        padding: "2px 7px", borderRadius: 4,
                                                                        color: annStyle.color, background: annStyle.bg,
                                                                        border: `1px solid ${annStyle.border}`,
                                                                        textTransform: "uppercase",
                                                                    }}>{annStyle.label}</span>
                                                                    <span style={{ fontSize: 10, color: "var(--h-text-3)", fontFamily: "var(--h-font-mono)", letterSpacing: "0.5px" }}>{branding.name}</span>
                                                                </div>
                                                            ) : (n.actor_name && (
                                                                <span style={{
                                                                    fontSize: 13, fontWeight: 700,
                                                                    color: n.actor_name_color || "var(--h-green)",
                                                                    textShadow: n.actor_glow > 0 && n.actor_glow_color ? `0 0 ${n.actor_glow * 2}px ${n.actor_glow_color}` : "none",
                                                                    marginRight: 6,
                                                                }}>{n.actor_name}</span>
                                                            ))}
                                                            <div style={{
                                                                fontSize: isAnn ? 13 : 12,
                                                                fontWeight: isAnn ? 600 : 400,
                                                                color: n.read ? "var(--h-text-3)" : "var(--h-text-1)",
                                                                lineHeight: 1.4, marginTop: isAnn ? 0 : 2,
                                                            }}>{isAnn ? n.title : n.body}</div>
                                                            {isAnn && n.body && (
                                                                <div style={{ fontSize: 11, color: n.read ? "var(--h-text-4)" : "var(--h-text-2)", lineHeight: 1.5, marginTop: 3 }}>{n.body}</div>
                                                            )}
                                                            <div style={{ fontSize: 9, color: "var(--h-text-4)", marginTop: 5, letterSpacing: "0.5px", fontFamily: "var(--h-font-mono)" }}>
                                                                {new Date(n.created_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                                            </div>
                                                        </div>
                                                        {!n.read && (
                                                            <div style={{
                                                                width: 7, height: 7, borderRadius: "50%",
                                                                background: isAnn ? annStyle.color : "var(--h-green)",
                                                                flexShrink: 0, marginTop: 6,
                                                                boxShadow: isAnn ? `0 0 6px ${annStyle.color}` : "0 0 6px var(--h-green-glow)",
                                                            }} />
                                                        )}
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* User dropdown */}
                        {me && (
                            <div style={{ position: "relative" }}>
                                <button
                                    className="h-tb__userbtn"
                                    onClick={e => { e.stopPropagation(); setUserDrop(o => !o); }}
                                    type="button"
                                    aria-expanded={userDrop}
                                    aria-label="Menú de usuario"
                                >
                                    <div className="h-tb__avatar" style={{ "--avatar-bg": avatarBg }}>
                                        {avatarUrl
                                            ? <img src={avatarUrl} alt={displayName} />
                                            : <span aria-hidden="true">{avatarEmoji}</span>
                                        }
                                    </div>
                                    <div className="h-tb__userinfo h-tb__hide-mobile">
                                        <div className="h-tb__usermeta">
                                            <span className="h-tb__role">{roleLabel}</span>
                                            <span className="h-tb__name" style={nameStyle}>{displayName}</span>
                                        </div>
                                        <div className="h-tb__sub">#{me.client_number} · {me.email}</div>
                                    </div>
                                    <span className="h-tb__chev"><Icon name="chevron" /></span>
                                </button>

                                {userDrop && (
                                    <div className="h-tb__drop" onClick={e => e.stopPropagation()}>
                                        <div className="h-tb__drop-head">
                                            <div className="h-tb__avatar" style={{ "--avatar-bg": avatarBg, width: 44, height: 44, fontSize: 20 }}>
                                                {avatarUrl
                                                    ? <img src={avatarUrl} alt={displayName} />
                                                    : <span aria-hidden="true">{avatarEmoji}</span>
                                                }
                                            </div>
                                            <div>
                                                <div className="h-tb__drop-head-name">{me.name}</div>
                                                <div className="h-tb__drop-head-balance">
                                                    <CountUp value={balance}>{balance.toLocaleString()}</CountUp> COINS
                                                </div>
                                                <div className="h-tb__drop-head-email">{me.email}</div>
                                            </div>
                                        </div>
                                        <a href={me?.username ? `/perfil/${me.username}` : "/perfil"}
                                           className="h-tb__drop-item"
                                           onClick={() => setUserDrop(false)}>
                                            <Icon name="user" />Mi Perfil
                                        </a>
                                        <a href="/coins" className="h-tb__drop-item" onClick={() => setUserDrop(false)}>
                                            <Icon name="coins" />Coins
                                        </a>
                                        <button className="h-tb__drop-item h-tb__drop-item--danger"
                                                onClick={() => { setUserDrop(false); logout(); }}
                                                type="button">
                                            <Icon name="logout" />Cerrar sesión
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        <button className="h-tb__logout" onClick={logout} type="button">
                            <Icon name="logout" /><span>Salir</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
