import { useState, useEffect, useMemo } from "react";
import SkillBadges from "./SkillBadges.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

const C = {
  lemon: "#f5e03a",
  orange: "#ff5500",
  green: "#3ddc97",
  red: "#ff5470",
  surface: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.08)",
  ghost: "rgba(255,255,255,0.45)",
  faint: "rgba(255,255,255,0.07)",
};

function Label({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", color: C.ghost, marginBottom: 6 }}>{children}</div>;
}

function StatusBadge({ status }) {
  const map = {
    ACTIVE: { bg: "rgba(61,220,151,0.15)", color: C.green, label: "Activa" },
    PAUSED: { bg: "rgba(255,84,112,0.12)", color: C.red, label: "Pausada" },
    DELETED: { bg: "rgba(255,255,255,0.05)", color: C.ghost, label: "Eliminada" },
    ARCHIVED: { bg: "rgba(255,255,255,0.05)", color: C.ghost, label: "Archivada" },
    EXPIRED: { bg: "rgba(255,255,255,0.05)", color: C.ghost, label: "Finalizada" },
  };
  const m = map[status] || { bg: "rgba(255,255,255,0.05)", color: C.ghost, label: status || "—" };
  return (
    <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 6, background: m.bg, color: m.color, letterSpacing: "1px", textTransform: "uppercase" }}>
      {m.label}
    </span>
  );
}

function fmtCurrency(amountStr, currency = "ARS") {
  if (amountStr === null || amountStr === undefined) return "—";
  const n = Number(amountStr);
  if (Number.isNaN(n)) return "—";
  const value = n / 100;
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${value.toFixed(0)} ${currency}`;
  }
}

function fmtBudget(daily, lifetime, currency) {
  if (daily) return `${fmtCurrency(daily, currency)}/día`;
  if (lifetime) return `${fmtCurrency(lifetime, currency)} total`;
  return "—";
}

export default function InstagramAdsPanel() {
  const [tokenStatus, setTokenStatus] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [defaultAccountId, setDefaultAccountId] = useState("");
  const [campaigns, setCampaigns] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [datePreset, setDatePreset] = useState("last_30d");
  const [expandedCampaign, setExpandedCampaign] = useState(null);
  const [campaignInsights, setCampaignInsights] = useState({});
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [boostModal, setBoostModal] = useState(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [localCampaigns, setLocalCampaigns] = useState([]);

  async function loadStatus() {
    try {
      const r = await fetch(`${API}/api/instagram-ads/token/user/status`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const j = await r.json();
      setTokenStatus(j);
      if (j?.default_ad_account_id) setDefaultAccountId(j.default_ad_account_id);
    } catch (e) {
      setTokenStatus({ ok: false, error: String(e?.message || e) });
    }
  }

  async function loadAccounts() {
    try {
      const r = await fetch(`${API}/api/instagram-ads/accounts`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const j = await r.json();
      if (r.ok) setAccounts(j.accounts || []);
      else setMsg(`Error: ${j.error || r.status}`);
    } catch (e) {
      setMsg(String(e?.message || e));
    }
  }

  async function loadCampaigns() {
    if (!defaultAccountId) return;
    setLoading(true);
    setMsg("");
    try {
      const r = await fetch(`${API}/api/instagram-ads/campaigns?ad_account_id=${encodeURIComponent(defaultAccountId)}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const j = await r.json();
      if (r.ok) setCampaigns(j.campaigns || []);
      else setMsg(`Error: ${j.error || r.status}`);
    } catch (e) {
      setMsg(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function loadInsights() {
    if (!defaultAccountId) return;
    try {
      const r = await fetch(`${API}/api/instagram-ads/insights?ad_account_id=${encodeURIComponent(defaultAccountId)}&date_preset=${datePreset}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const j = await r.json();
      if (r.ok) setInsights(j.insights?.[0] || null);
    } catch (e) {
      console.error(e);
    }
  }

  async function loadCampaignInsights(campaignId) {
    try {
      const r = await fetch(`${API}/api/instagram-ads/campaigns/${campaignId}/insights?date_preset=${datePreset}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const j = await r.json();
      if (r.ok) setCampaignInsights(prev => ({ ...prev, [campaignId]: j.insights?.[0] || null }));
    } catch (e) { console.error(e); }
  }

  async function toggleStatus(campaignId, currentStatus) {
    const newStatus = currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE";
    if (!confirm(`¿${newStatus === "ACTIVE" ? "Reactivar" : "Pausar"} esta campaña?`)) return;
    try {
      const r = await fetch(`${API}/api/instagram-ads/campaigns/${campaignId}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const j = await r.json();
      if (r.ok) {
        setMsg(`Campaña ${newStatus === "ACTIVE" ? "reactivada" : "pausada"}`);
        loadCampaigns();
      } else {
        setMsg(`Error: ${j.error || r.status}`);
      }
    } catch (e) {
      setMsg(String(e?.message || e));
    }
  }

  async function setAdAccount(id) {
    try {
      const r = await fetch(`${API}/api/instagram-ads/ad-account`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ad_account_id: id }),
      });
      if (r.ok) {
        setDefaultAccountId(id);
        setMsg("Ad account predeterminada actualizada");
      }
    } catch (e) { setMsg(String(e?.message || e)); }
  }

  async function loadPosts() {
    setPostsLoading(true);
    setMsg("");
    try {
      const r = await fetch(`${API}/api/instagram-ads/posts/promotable`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const j = await r.json();
      if (r.ok) setPosts(j.posts || []);
      else setMsg(`Error: ${j.error || r.status}`);
    } catch (e) {
      setMsg(String(e?.message || e));
    } finally {
      setPostsLoading(false);
    }
  }

  async function submitBoost(form) {
    try {
      const r = await fetch(`${API}/api/instagram-ads/promote-post`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (r.ok) {
        setBoostModal(null);
        setMsg(`✅ Boost creado en PAUSED. Campaign ${j.campaign_id} — activala desde la lista.`);
        loadCampaigns();
        loadLocalCampaigns();
        return true;
      } else {
        setMsg(`Error: ${j.error || r.status}`);
        return false;
      }
    } catch (e) {
      setMsg(String(e?.message || e));
      return false;
    }
  }

  async function loadLocalCampaigns() {
    try {
      const r = await fetch(`${API}/api/instagram-ads/campaigns/local`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const j = await r.json();
      if (r.ok) setLocalCampaigns(j.campaigns || []);
    } catch (e) {
      console.error(e);
    }
  }

  async function submitWizard(form) {
    try {
      const r = await fetch(`${API}/api/instagram-ads/campaigns/create`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (r.ok) {
        setWizardOpen(false);
        setMsg(`✅ Campaña creada en PAUSED. Campaign ${j.campaign_id} — activala desde la lista.`);
        loadCampaigns();
        loadLocalCampaigns();
        return true;
      } else {
        setMsg(`Error: ${j.error || r.status}`);
        return false;
      }
    } catch (e) {
      setMsg(String(e?.message || e));
      return false;
    }
  }

  useEffect(() => {
    loadStatus();
    loadAccounts();
    loadLocalCampaigns();
  }, []);

  useEffect(() => {
    if (defaultAccountId) {
      loadCampaigns();
      loadInsights();
    }
  }, [defaultAccountId, datePreset]);

  const tokenOK = tokenStatus?.ok && tokenStatus?.info?.has_ads_management;
  const currentAccount = accounts.find(a => a.id === defaultAccountId);
  const currency = currentAccount?.currency || "ARS";

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ borderTop: "1px solid " + C.border, paddingTop: 24, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "2px", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", marginBottom: 4 }}>
          📊 Meta Ads
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
          Campañas, presupuesto y métricas. Marketing API.
        </div>
      </div>

      {/* Estado del token */}
      <div style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <Label>Estado del token Marketing API</Label>
        {!tokenStatus && <div style={{ color: C.ghost }}>Cargando…</div>}
        {tokenStatus && !tokenStatus.ok && (
          <div style={{ color: C.red, fontSize: 13 }}>❌ Token no configurado o inválido. Pídele al admin que lo configure.</div>
        )}
        {tokenOK && (
          <div style={{ color: C.green, fontSize: 13 }}>
            ✅ Token activo · type: {tokenStatus.info.type} · scopes ads OK
          </div>
        )}
        {tokenStatus?.ok && !tokenOK && (
          <div style={{ color: C.red, fontSize: 13 }}>⚠️ Token sin scope ads_management. Hay que regenerarlo con los permisos correctos.</div>
        )}
      </div>

      {/* Selector de ad account */}
      {accounts.length > 0 && (
        <div style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <Label>Cuenta publicitaria</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {accounts
              .slice()
              .sort((a, b) => (a.account_status === 1 ? -1 : 1) - (b.account_status === 1 ? -1 : 1))
              .map(a => {
                const disabled = a.account_status !== 1;
                const isNumericName = /^\d+$/.test(a.name || "");
                const display = a.id === "act_193639144087759" ? "Lemons Ads (principal)" : (isNumericName ? `Cuenta ${a.id.replace("act_", "").slice(-6)}` : a.name);
                return (
                  <button
                    key={a.id}
                    onClick={() => !disabled && setAdAccount(a.id)}
                    disabled={disabled}
                    title={disabled ? "Cuenta inhabilitada — saldo pendiente en Meta" : ""}
                    style={{
                      padding: "8px 12px", borderRadius: 8,
                      border: "1px solid " + (a.id === defaultAccountId ? C.lemon : C.border),
                      background: a.id === defaultAccountId ? "rgba(245,224,58,0.08)" : C.faint,
                      color: disabled ? C.ghost : "#fff",
                      fontSize: 12, fontWeight: 600,
                      cursor: disabled ? "not-allowed" : "pointer",
                      opacity: disabled ? 0.5 : 1,
                      textDecoration: disabled ? "line-through" : "none",
                    }}
                  >
                    {display} · {a.currency}
                    {disabled && <span style={{ color: C.red, marginLeft: 6, textDecoration: "none" }}>(inhab.)</span>}
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Insights agregados */}
      {tokenOK && defaultAccountId && (
        <div style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Label>Resumen de la cuenta</Label>
            <select
              value={datePreset}
              onChange={e => setDatePreset(e.target.value)}
              style={{ background: C.faint, color: "#fff", border: "1px solid " + C.border, padding: "4px 8px", borderRadius: 6, fontSize: 12 }}
            >
              <option value="today">Hoy</option>
              <option value="yesterday">Ayer</option>
              <option value="last_7d">Últimos 7 días</option>
              <option value="last_30d">Últimos 30 días</option>
              <option value="this_month">Este mes</option>
              <option value="last_month">Mes anterior</option>
            </select>
          </div>
          {!insights && <div style={{ color: C.ghost, fontSize: 13 }}>Sin datos en este rango</div>}
          {insights && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
              <Metric label="Gasto" value={`${currency} ${Number(insights.spend || 0).toLocaleString("es-AR")}`} />
              <Metric label="Impresiones" value={Number(insights.impressions || 0).toLocaleString("es-AR")} />
              <Metric label="Alcance" value={Number(insights.reach || 0).toLocaleString("es-AR")} />
              <Metric label="Clicks" value={Number(insights.clicks || 0).toLocaleString("es-AR")} />
              <Metric label="CTR" value={`${Number(insights.ctr || 0).toFixed(2)}%`} />
              <Metric label="CPC" value={`${currency} ${Number(insights.cpc || 0).toFixed(0)}`} />
              <Metric label="CPM" value={`${currency} ${Number(insights.cpm || 0).toFixed(0)}`} />
              <Metric label="Frecuencia" value={Number(insights.frequency || 0).toFixed(2)} />
            </div>
          )}
        </div>
      )}

      {/* Promover post */}
      {tokenOK && defaultAccountId && (
        <div style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <Label>🚀 Promover post existente</Label>
              <div style={{ fontSize: 11, color: C.ghost }}>Boost de un post de IG con presupuesto + targeting. Crea todo en PAUSED.</div>
            </div>
            <button
              onClick={loadPosts}
              disabled={postsLoading}
              style={{ background: C.faint, color: "#fff", border: "1px solid " + C.border, padding: "6px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
            >
              {postsLoading ? "…" : posts.length ? "↻ Recargar" : "Cargar posts"}
            </button>
          </div>
          {posts.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
              {posts.map(p => {
                const thumb = p.thumbnail_url || p.media_url;
                const caption = (p.caption || "").slice(0, 60);
                return (
                  <button
                    key={p.id}
                    onClick={() => setBoostModal({ post: p })}
                    style={{
                      background: C.faint, border: "1px solid " + C.border, borderRadius: 10,
                      padding: 0, overflow: "hidden", cursor: "pointer", textAlign: "left",
                      display: "flex", flexDirection: "column",
                    }}
                  >
                    {thumb ? (
                      <img src={thumb} alt="" style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", aspectRatio: "1/1", background: "rgba(255,255,255,0.04)" }} />
                    )}
                    <div style={{ padding: 8 }}>
                      <div style={{ fontSize: 10, color: C.ghost, marginBottom: 2 }}>
                        {p.media_type} · ❤ {p.like_count ?? 0} · 💬 {p.comments_count ?? 0}
                      </div>
                      <div style={{ fontSize: 11, color: "#fff", lineHeight: 1.3 }}>{caption}{caption.length === 60 ? "…" : ""}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Nueva campaña desde cero */}
      {tokenOK && defaultAccountId && (
        <div style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <Label>✨ Nueva campaña desde cero</Label>
              <div style={{ fontSize: 11, color: C.ghost }}>Link ad sin post existente. Imagen + título + texto + URL + CTA. Se crea en PAUSED.</div>
            </div>
            <button
              onClick={() => setWizardOpen(true)}
              style={{ background: C.lemon, color: "#000", border: "none", padding: "8px 14px", borderRadius: 6, fontSize: 12, fontWeight: 800, cursor: "pointer" }}
            >
              + Crear
            </button>
          </div>
        </div>
      )}

      {/* ✨ Generador de copy con frameworks expertos (clawfu-skills) */}
      {tokenOK && <AdCopyGenerator />}

      {/* Creadas desde el portal */}
      {tokenOK && localCampaigns.length > 0 && (
        <div style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <Label>Creadas desde el portal ({localCampaigns.length})</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {localCampaigns.slice(0, 10).map(lc => (
              <div key={lc.id} style={{ background: C.faint, border: "1px solid " + C.border, borderRadius: 8, padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#fff", marginBottom: 2 }}>{lc.name || lc.campaign_id}</div>
                  <div style={{ fontSize: 10, color: C.ghost, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <span>{lc.kind === "boost_post" ? "Boost post" : "Link ad"}</span>
                    <span>{lc.objective}</span>
                    {lc.created_by_email && <span>por {lc.created_by_email}</span>}
                    <span>{new Date(lc.created_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
                <StatusBadge status={lc.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Campañas */}
      {tokenOK && defaultAccountId && (
        <div style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Label>Campañas ({campaigns.length})</Label>
            <button
              onClick={loadCampaigns}
              disabled={loading}
              style={{ background: C.faint, color: "#fff", border: "1px solid " + C.border, padding: "6px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
            >
              {loading ? "…" : "↻ Recargar"}
            </button>
          </div>
          {campaigns.length === 0 && !loading && (
            <div style={{ color: C.ghost, fontSize: 13 }}>No hay campañas en esta cuenta</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {campaigns.map(c => {
              const expanded = expandedCampaign === c.id;
              const ci = campaignInsights[c.id];
              return (
                <div key={c.id} style={{ background: C.faint, border: "1px solid " + C.border, borderRadius: 10, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 4 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: C.ghost, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                        <span>{c.objective}</span>
                        <span>{fmtBudget(c.daily_budget, c.lifetime_budget, currency)}</span>
                        <StatusBadge status={
                          c.status === "ACTIVE" && c.stop_time && new Date(c.stop_time) < new Date()
                            ? "EXPIRED"
                            : (c.effective_status || c.status)
                        } />
                        {c.stop_time && (
                          <span style={{ color: new Date(c.stop_time) < new Date() ? C.red : C.ghost }}>
                            {new Date(c.stop_time) < new Date() ? "Venció " : "Hasta "}
                            {new Date(c.stop_time).toLocaleDateString("es-AR")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => {
                          if (expanded) { setExpandedCampaign(null); }
                          else { setExpandedCampaign(c.id); if (!ci) loadCampaignInsights(c.id); }
                        }}
                        style={{ background: C.faint, color: "#fff", border: "1px solid " + C.border, padding: "6px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer" }}
                      >
                        {expanded ? "▲" : "▼"}
                      </button>
                      <button
                        onClick={() => toggleStatus(c.id, c.status)}
                        style={{
                          background: c.status === "ACTIVE" ? "rgba(255,84,112,0.12)" : "rgba(61,220,151,0.12)",
                          color: c.status === "ACTIVE" ? C.red : C.green,
                          border: "1px solid " + (c.status === "ACTIVE" ? "rgba(255,84,112,0.3)" : "rgba(61,220,151,0.3)"),
                          padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
                        }}
                      >
                        {c.status === "ACTIVE" ? "⏸ Pausar" : "▶ Activar"}
                      </button>
                    </div>
                  </div>
                  {expanded && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid " + C.border }}>
                      {!ci && <div style={{ color: C.ghost, fontSize: 12 }}>Cargando métricas…</div>}
                      {ci && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8 }}>
                          <Metric small label="Gasto" value={`${currency} ${Number(ci.spend || 0).toLocaleString("es-AR")}`} />
                          <Metric small label="Impresiones" value={Number(ci.impressions || 0).toLocaleString("es-AR")} />
                          <Metric small label="Clicks" value={Number(ci.clicks || 0).toLocaleString("es-AR")} />
                          <Metric small label="CTR" value={`${Number(ci.ctr || 0).toFixed(2)}%`} />
                          <Metric small label="CPC" value={`${currency} ${Number(ci.cpc || 0).toFixed(0)}`} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {msg && <div style={{ marginTop: 12, color: msg.startsWith("Error") ? C.red : C.green, fontSize: 12 }}>{msg}</div>}

      {boostModal && (
        <BoostModal
          post={boostModal.post}
          currency={currency}
          onClose={() => setBoostModal(null)}
          onSubmit={submitBoost}
        />
      )}

      {wizardOpen && (
        <CreateAdWizard
          currency={currency}
          posts={posts}
          loadPosts={loadPosts}
          onClose={() => setWizardOpen(false)}
          onSubmit={submitWizard}
        />
      )}
    </div>
  );
}

function BoostModal({ post, currency, onClose, onSubmit }) {
  const [dailyBudget, setDailyBudget] = useState(1500);
  const [days, setDays] = useState(7);
  const [objective, setObjective] = useState("OUTCOME_TRAFFIC");
  const [countries, setCountries] = useState("AR");
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(65);
  const [submitting, setSubmitting] = useState(false);

  const total = Number(dailyBudget) * Number(days);

  async function handleSubmit() {
    if (!dailyBudget || dailyBudget <= 0) return;
    setSubmitting(true);
    const ok = await onSubmit({
      ig_media_id: post.id,
      daily_budget: Number(dailyBudget),
      days: Number(days),
      objective,
      countries: countries.split(",").map(s => s.trim().toUpperCase()).filter(Boolean),
      age_min: Number(ageMin),
      age_max: Number(ageMax),
    });
    setSubmitting(false);
  }

  const thumb = post.thumbnail_url || post.media_url;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#1a1a1a", border: "1px solid " + C.border, borderRadius: 12,
          padding: 20, maxWidth: 480, width: "100%", maxHeight: "90vh", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>🚀 Promover post</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.ghost, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          {thumb && <img src={thumb} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8 }} />}
          <div style={{ flex: 1, fontSize: 12, color: C.ghost, lineHeight: 1.4 }}>
            {(post.caption || "").slice(0, 140)}{(post.caption || "").length > 140 ? "…" : ""}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Field label={`Presupuesto diario (${currency})`}>
            <input type="number" min="100" value={dailyBudget} onChange={e => setDailyBudget(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Días">
            <input type="number" min="1" max="30" value={days} onChange={e => setDays(e.target.value)} style={inputStyle} />
          </Field>
        </div>

        <div style={{ fontSize: 11, color: C.lemon, marginBottom: 12 }}>
          Total estimado: {currency} {total.toLocaleString("es-AR")}
        </div>

        <Field label="Objetivo">
          <select value={objective} onChange={e => setObjective(e.target.value)} style={inputStyle}>
            <option value="OUTCOME_TRAFFIC">Tráfico (clicks al perfil)</option>
            <option value="OUTCOME_ENGAGEMENT">Interacciones (likes / comentarios)</option>
            <option value="OUTCOME_AWARENESS">Reconocimiento (alcance)</option>
          </select>
        </Field>

        <Field label="Países (códigos ISO, separados por coma)">
          <input value={countries} onChange={e => setCountries(e.target.value)} placeholder="AR, UY, CL" style={inputStyle} />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <Field label="Edad mín">
            <input type="number" min="13" max="65" value={ageMin} onChange={e => setAgeMin(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Edad máx">
            <input type="number" min="13" max="65" value={ageMax} onChange={e => setAgeMax(e.target.value)} style={inputStyle} />
          </Field>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} disabled={submitting} style={{ flex: 1, ...btnGhost }}>Cancelar</button>
          <button onClick={handleSubmit} disabled={submitting} style={{ flex: 2, ...btnPrimary }}>
            {submitting ? "Creando…" : "Crear boost (PAUSED)"}
          </button>
        </div>

        <div style={{ marginTop: 12, fontSize: 10, color: C.ghost, lineHeight: 1.4 }}>
          La campaña se crea en estado PAUSED. Activala desde la lista para que empiece a correr.
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", boxSizing: "border-box",
  background: C.faint, color: "#fff", border: "1px solid " + C.border,
  padding: "8px 10px", borderRadius: 6, fontSize: 13,
};

// ─────────────────────────────────────────────────────────────────────────────
// ✨ AD COPY GENERATOR — clawfu-skills
// ─────────────────────────────────────────────────────────────────────────────

function _copy(text, onDone) {
  try { navigator.clipboard.writeText(String(text || "")); if (onDone) onDone(); } catch {}
}

function AdCopyGenerator() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    producto: "Lemon's — courier desde China/USA/Europa",
    oferta: "",
    audiencia: "emprendedores argentinos que importan productos",
    dolor: "",
    objetivo: "venta directa",
  });
  const [allSkills, setAllSkills] = useState([]);
  const [forcedSkills, setForcedSkills] = useState([]);
  const [skillsExpanded, setSkillsExpanded] = useState(false);
  const [skillFilter, setSkillFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [activeVariant, setActiveVariant] = useState(null);

  useEffect(() => {
    if (!open || allSkills.length) return;
    fetch(`${API}/api/instagram-content/skills?lang=es`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json()).then(d => setAllSkills(d?.skills || [])).catch(() => {});
  }, [open]);

  const filteredSkills = useMemo(() => {
    const q = skillFilter.trim().toLowerCase();
    if (!q) return allSkills.slice(0, 60);
    return allSkills.filter(s =>
      (s.name_es || s.name).toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      (s.category_es || s.category).toLowerCase().includes(q) ||
      (s.description_es || s.description || "").toLowerCase().includes(q)
    ).slice(0, 60);
  }, [allSkills, skillFilter]);

  function toggleSkill(name) {
    setForcedSkills(s => s.includes(name) ? s.filter(n => n !== name) : (s.length >= 5 ? s : [...s, name]));
  }

  async function generate() {
    if (!form.producto.trim()) { setError("Ingresá el producto"); return; }
    setError("");
    setLoading(true);
    setResult(null);
    setActiveVariant(null);
    try {
      const body = { ...form, lang: "es" };
      if (forcedSkills.length) body.skill_names = forcedSkills;
      const r = await fetch(`${API}/api/instagram-ads/generate-ad-creative`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) { setError(d?.error || "Error al generar"); return; }
      setResult(d);
    } catch { setError("Error de red"); }
    finally { setLoading(false); }
  }

  function flash(key) {
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(c => c === key ? null : c), 1200);
  }

  const g = result?.generated || {};
  const isRaw = !!g.raw && !g.headline;
  const variants = Array.isArray(g.variants) ? g.variants : [];

  return (
    <div style={{ background: C.surface, border: "1px solid rgba(245,224,58,0.25)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "1.5px", padding: "2px 8px", borderRadius: 6, background: C.lemon, color: "#0b1020" }}>NUEVO</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>✨ Generador de copy con frameworks expertos</span>
          </div>
          <div style={{ fontSize: 11, color: C.ghost }}>Genera headline + 3 variantes de primary text usando 173 frameworks de marketing/copywriting. Útil para escribir el copy del post antes de subirlo a IG.</div>
        </div>
        <button onClick={() => setOpen(o => !o)}
          style={{ background: C.faint, color: "#fff", border: "1px solid " + C.border, padding: "8px 14px", borderRadius: 6, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
          {open ? "▾ Cerrar" : "▸ Abrir generador"}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid " + C.border, display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <Label>Producto *</Label>
            <input value={form.producto} onChange={e => setForm(f => ({ ...f, producto: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <Label>Oferta (opcional)</Label>
            <input value={form.oferta} onChange={e => setForm(f => ({ ...f, oferta: e.target.value }))} placeholder="Ej: primera importación con 20% off" style={inputStyle} />
          </div>
          <div>
            <Label>Audiencia</Label>
            <input value={form.audiencia} onChange={e => setForm(f => ({ ...f, audiencia: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <Label>Dolor del cliente (opcional)</Label>
            <textarea value={form.dolor} onChange={e => setForm(f => ({ ...f, dolor: e.target.value }))} placeholder="Ej: no sé cuánto va a costarme aduana" rows={2} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div>
            <Label>Objetivo</Label>
            <select value={form.objetivo} onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))} style={inputStyle}>
              <option value="awareness">Awareness (reconocimiento)</option>
              <option value="lead">Lead (captar contacto)</option>
              <option value="venta directa">Venta directa</option>
              <option value="remarketing">Remarketing</option>
            </select>
          </div>

          <div>
            <button onClick={() => setSkillsExpanded(s => !s)}
              style={{ background: "transparent", color: C.ghost, border: "1px solid " + C.border, padding: "8px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", width: "100%", textAlign: "left" }}>
              {skillsExpanded ? "▾" : "▸"} Forzar skills específicos ({forcedSkills.length}/5) — opcional
            </button>
            {skillsExpanded && (
              <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: "rgba(0,0,0,0.25)", border: "1px solid " + C.border }}>
                <input placeholder="Buscar skill…" value={skillFilter} onChange={e => setSkillFilter(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }} />
                <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                  {filteredSkills.map(s => {
                    const checked = forcedSkills.includes(s.name);
                    const dispName = s.name_es || s.name;
                    const dispCat = (s.category_es || s.category).replace(/^skills\//i, "");
                    const dispDesc = s.description_es || s.description || "";
                    return (
                      <label key={s.name} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 8px", borderRadius: 6, background: checked ? "rgba(245,224,58,0.08)" : "transparent", cursor: "pointer", fontSize: 11 }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleSkill(s.name)} style={{ marginTop: 2 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: "#fff" }}>{dispName} <span style={{ fontWeight: 400, opacity: 0.5, fontSize: 10 }}>· {dispCat}</span></div>
                          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: 2, lineHeight: 1.3 }}>{dispDesc.slice(0, 200)}{dispDesc.length > 200 ? "…" : ""}</div>
                        </div>
                      </label>
                    );
                  })}
                  {!filteredSkills.length && <div style={{ fontSize: 11, color: C.ghost, padding: 8 }}>No hay skills que coincidan</div>}
                </div>
              </div>
            )}
          </div>

          {error && <div style={{ padding: 10, borderRadius: 8, background: "rgba(255,84,112,0.08)", border: "1px solid rgba(255,84,112,0.3)", color: "#fca5a5", fontSize: 12 }}>{error}</div>}

          <button onClick={generate} disabled={loading || !form.producto.trim()}
            style={{ ...btnPrimary, height: 42, opacity: (loading || !form.producto.trim()) ? 0.5 : 1, padding: "0 16px" }}>
            {loading ? "✨ Generando con Claude…" : "✨ Generar creative"}
          </button>

          {result && (
            <div style={{ padding: 14, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(245,224,58,0.2)", display: "flex", flexDirection: "column", gap: 12 }}>
              {result.warning && <div style={{ padding: 8, borderRadius: 6, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24", fontSize: 11 }}>⚠ {result.warning}</div>}

              {isRaw ? (
                <div>
                  <Label>Output crudo (Claude no devolvió JSON)</Label>
                  <textarea readOnly value={g.raw} rows={8} style={{ ...inputStyle, fontFamily: "monospace", fontSize: 11, resize: "vertical" }} />
                </div>
              ) : (
                <>
                  {g.headline && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <Label>Headline</Label>
                        <button onClick={() => { _copy(g.headline); flash("h"); }} style={{ ...btnGhost, padding: "5px 10px", fontSize: 11 }}>{copiedKey === "h" ? "✓" : "📋"} copiar</button>
                      </div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", lineHeight: 1.35, padding: 12, borderRadius: 8, background: "rgba(245,224,58,0.06)", border: "1px solid rgba(245,224,58,0.2)" }}>{g.headline}</div>
                    </div>
                  )}

                  {g.primary_text && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <Label>Primary text {activeVariant != null ? `(usando variante #${activeVariant + 1})` : "(original)"}</Label>
                        <button onClick={() => { _copy(activeVariant != null ? variants[activeVariant] : g.primary_text); flash("p"); }} style={{ ...btnGhost, padding: "5px 10px", fontSize: 11 }}>{copiedKey === "p" ? "✓" : "📋"} copiar</button>
                      </div>
                      <textarea readOnly value={activeVariant != null ? variants[activeVariant] : g.primary_text} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
                    </div>
                  )}

                  {g.description && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <Label>Description (line link)</Label>
                        <button onClick={() => { _copy(g.description); flash("d"); }} style={{ ...btnGhost, padding: "5px 10px", fontSize: 11 }}>{copiedKey === "d" ? "✓" : "📋"} copiar</button>
                      </div>
                      <input readOnly value={g.description} style={inputStyle} />
                    </div>
                  )}

                  {g.cta && (
                    <div>
                      <Label>CTA sugerido</Label>
                      <span style={{ display: "inline-block", padding: "5px 12px", borderRadius: 6, background: "rgba(61,220,151,0.12)", border: "1px solid rgba(61,220,151,0.3)", color: C.green, fontSize: 12, fontWeight: 700 }}>{g.cta}</span>
                    </div>
                  )}

                  {g.visual_brief && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <Label>Visual brief (para diseñar la imagen)</Label>
                        <button onClick={() => { _copy(g.visual_brief); flash("vb"); }} style={{ ...btnGhost, padding: "5px 10px", fontSize: 11 }}>{copiedKey === "vb" ? "✓" : "📋"} copiar</button>
                      </div>
                      <div style={{ padding: 10, borderRadius: 8, background: "rgba(0,0,0,0.25)", border: "1px solid " + C.border, fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, fontStyle: "italic" }}>{g.visual_brief}</div>
                    </div>
                  )}

                  {variants.length > 0 && (
                    <div>
                      <Label>Variantes A/B ({variants.length})</Label>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {variants.map((v, i) => (
                          <div key={i} style={{ padding: 10, borderRadius: 8, background: activeVariant === i ? "rgba(245,224,58,0.06)" : "rgba(255,255,255,0.03)", border: "1px solid " + (activeVariant === i ? "rgba(245,224,58,0.4)" : C.border) }}>
                            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1px", color: C.ghost, marginBottom: 4 }}>VARIANTE #{i + 1}</div>
                            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", marginBottom: 8, lineHeight: 1.4 }}>{v}</div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => setActiveVariant(activeVariant === i ? null : i)}
                                style={{ ...btnGhost, padding: "5px 10px", fontSize: 11, background: activeVariant === i ? "rgba(245,224,58,0.15)" : C.faint, color: activeVariant === i ? C.lemon : "#fff" }}>
                                {activeVariant === i ? "✓ Seleccionada" : "Usar esta variante"}
                              </button>
                              <button onClick={() => { _copy(v); flash(`v${i}`); }} style={{ ...btnGhost, padding: "5px 10px", fontSize: 11 }}>{copiedKey === `v${i}` ? "✓ copiada" : "📋 copiar"}</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div>
                <Label>Frameworks aplicados</Label>
                <SkillBadges skills={result.skills_used} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const btnGhost = {
  background: C.faint, color: "#fff", border: "1px solid " + C.border,
  padding: "10px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
};

const btnPrimary = {
  background: C.lemon, color: "#000", border: "none",
  padding: "10px", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: "pointer",
};

function Metric({ label, value, small }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: small ? 8 : 10 }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "1px", color: C.ghost, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: small ? 13 : 16, fontWeight: 700, color: "#fff" }}>{value}</div>
    </div>
  );
}

function CreateAdWizard({ currency, posts, loadPosts, onClose, onSubmit }) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [objective, setObjective] = useState("OUTCOME_TRAFFIC");
  const [dailyBudget, setDailyBudget] = useState(1500);
  const [days, setDays] = useState(7);

  const [countries, setCountries] = useState("AR");
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(65);

  const [selectedPostId, setSelectedPostId] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [callToAction, setCallToAction] = useState("LEARN_MORE");

  useEffect(() => {
    if (step === 3 && (!posts || posts.length === 0)) loadPosts?.();
  }, [step]);

  const total = Number(dailyBudget) * Number(days);

  const step1Valid = name.trim().length > 0 && Number(dailyBudget) > 0 && Number(days) > 0;
  const step2Valid = countries.trim().length > 0 && Number(ageMin) >= 13 && Number(ageMax) <= 65 && Number(ageMin) <= Number(ageMax);
  const canStep3 = selectedPostId !== "";

  function next() {
    if (step === 1 && step1Valid) setStep(2);
    else if (step === 2 && step2Valid) setStep(3);
  }
  function back() {
    if (step > 1) setStep(step - 1);
  }

  async function handleSubmit() {
    if (!canStep3) return;
    setSubmitting(true);
    const body = {
      ig_media_id: selectedPostId,
      name: name.trim(),
      objective,
      daily_budget: Number(dailyBudget),
      days: Number(days),
      countries: countries.split(",").map(s => s.trim().toUpperCase()).filter(Boolean),
      age_min: Number(ageMin),
      age_max: Number(ageMax),
      call_to_action: callToAction,
      ...(linkUrl.trim() ? { link_url: linkUrl.trim() } : {}),
    };
    const ok = await onSubmit(body);
    setSubmitting(false);
    if (!ok) return;
  }

  const progress = (step / 3) * 100;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#1a1a1a", border: "1px solid " + C.border, borderRadius: 12,
          padding: 20, maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>✨ Nueva campaña — paso {step} de 3</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.ghost, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ height: 4, background: C.faint, borderRadius: 2, overflow: "hidden", marginBottom: 18 }}>
          <div style={{ width: `${progress}%`, height: "100%", background: C.lemon, transition: "width 0.2s" }} />
        </div>

        {step === 1 && (
          <>
            <div style={{ fontSize: 12, color: C.ghost, marginBottom: 12 }}>Objetivo y presupuesto</div>
            <Field label="Nombre de la campaña">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Promo abril — landing" style={inputStyle} />
            </Field>
            <Field label="Objetivo">
              <select value={objective} onChange={e => setObjective(e.target.value)} style={inputStyle}>
                <option value="OUTCOME_TRAFFIC">Tráfico (clicks al link)</option>
                <option value="OUTCOME_ENGAGEMENT">Interacciones</option>
                <option value="OUTCOME_AWARENESS">Reconocimiento (alcance)</option>
              </select>
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <Field label={`Presupuesto diario (${currency})`}>
                <input type="number" min="100" value={dailyBudget} onChange={e => setDailyBudget(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Días">
                <input type="number" min="1" max="30" value={days} onChange={e => setDays(e.target.value)} style={inputStyle} />
              </Field>
            </div>
            <div style={{ fontSize: 11, color: C.lemon, marginBottom: 12 }}>
              Total estimado: {currency} {total.toLocaleString("es-AR")}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ fontSize: 12, color: C.ghost, marginBottom: 12 }}>Audiencia</div>
            <Field label="Países (códigos ISO, separados por coma)">
              <input value={countries} onChange={e => setCountries(e.target.value)} placeholder="AR, UY, CL" style={inputStyle} />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Edad mín">
                <input type="number" min="13" max="65" value={ageMin} onChange={e => setAgeMin(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Edad máx">
                <input type="number" min="13" max="65" value={ageMax} onChange={e => setAgeMax(e.target.value)} style={inputStyle} />
              </Field>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div style={{ fontSize: 11, color: C.ghost, marginBottom: 8 }}>Paso 3/3 · Elegí un post de IG</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Label>Posts disponibles</Label>
              <button onClick={loadPosts} style={{ background: C.faint, color: "#fff", border: "1px solid " + C.border, padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>↻</button>
            </div>
            {(!posts || posts.length === 0) && (
              <div style={{ color: C.ghost, fontSize: 12, marginBottom: 12 }}>Cargando posts… (si tarda, presioná ↻)</div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8, marginBottom: 12, maxHeight: 240, overflowY: "auto" }}>
              {(posts || []).map(p => {
                const thumb = p.thumbnail_url || p.media_url;
                const sel = selectedPostId === p.id;
                return (
                  <button key={p.id} onClick={() => setSelectedPostId(p.id)} style={{
                    background: C.faint, border: "2px solid " + (sel ? C.lemon : C.border),
                    borderRadius: 8, padding: 0, overflow: "hidden", cursor: "pointer",
                  }}>
                    {thumb ? <img src={thumb} alt="" style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block" }} /> : <div style={{ aspectRatio: "1/1", background: "rgba(255,255,255,0.04)" }} />}
                  </button>
                );
              })}
            </div>
            <Field label="Botón (CTA)">
              <select value={callToAction} onChange={e => setCallToAction(e.target.value)} style={inputStyle}>
                <option value="LEARN_MORE">Más información</option>
                <option value="SHOP_NOW">Comprar ahora</option>
                <option value="SIGN_UP">Registrarse</option>
                <option value="CONTACT_US">Contactanos</option>
                <option value="GET_QUOTE">Pedir cotización</option>
                <option value="ORDER_NOW">Pedir ahora</option>
                <option value="SEND_MESSAGE">Enviar mensaje</option>
              </select>
            </Field>
            <Field label="URL destino del CTA (opcional, override del permalink)">
              <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://lemonsarg.com (dejar vacío = lleva al post)" style={inputStyle} />
            </Field>
          </>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {step > 1 && (
            <button onClick={back} disabled={submitting} style={{ flex: 1, ...btnGhost }}>← Atrás</button>
          )}
          {step < 3 && (
            <button
              onClick={next}
              disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid)}
              style={{ flex: 2, ...btnPrimary, opacity: ((step === 1 && !step1Valid) || (step === 2 && !step2Valid)) ? 0.5 : 1 }}
            >
              Siguiente →
            </button>
          )}
          {step === 3 && (
            <button
              onClick={handleSubmit}
              disabled={submitting || !canStep3}
              style={{ flex: 2, ...btnPrimary, opacity: (canStep3 && !submitting) ? 1 : 0.4 }}
            >
              {submitting ? "Creando…" : "Crear campaña (PAUSED)"}
            </button>
          )}
        </div>

        {step === 3 && (
          <div style={{ marginTop: 10, fontSize: 10, color: C.ghost, lineHeight: 1.4 }}>
            La imagen del ad será la del post elegido. La capability /adimages está bloqueada por Meta (App Review pendiente).
          </div>
        )}

        <div style={{ marginTop: 12, fontSize: 10, color: C.ghost, lineHeight: 1.4 }}>
          La campaña se crea en estado PAUSED. Activala desde la lista de Campañas para que empiece a correr.
        </div>
      </div>
    </div>
  );
}
