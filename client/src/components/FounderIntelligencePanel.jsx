import React from "react";

function usd(v) {
  return `$${Number(v || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function kg(v) {
  return `${Number(v || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} kg`;
}

function pct(v) {
  return `${Number(v || 0).toFixed(1)}%`;
}

function Pill({ text, color }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 12px",
      borderRadius: 999,
      background: `${color}18`,
      border: `1px solid ${color}35`,
      color,
      fontSize: 12,
      fontWeight: 900,
      letterSpacing: "0.4px",
      textTransform: "uppercase",
    }}>
      <span style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 12px ${color}`,
      }} />
      {text}
    </span>
  );
}

function Card({ title, value, sub, color = "#60a5fa" }) {
  return (
    <div style={{
      borderRadius: 20,
      padding: 16,
      background: "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))",
      border: `1px solid ${color}2a`,
      boxShadow: `0 14px 34px ${color}10`,
    }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1px", color: "rgba(255,255,255,0.42)", marginBottom: 8 }}>
        {title.toUpperCase()}
      </div>
      <div style={{ fontSize: 24, fontWeight: 950, color: "#fff", letterSpacing: "-0.6px" }}>
        {value}
      </div>
      {sub ? (
        <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.45, color: "rgba(255,255,255,0.42)" }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function Box({ title, children, color = "#60a5fa" }) {
  return (
    <div style={{
      borderRadius: 22,
      padding: 18,
      background: "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))",
      border: `1px solid ${color}2a`,
      boxShadow: `0 14px 36px ${color}10`,
      backdropFilter: "blur(12px)",
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "1px",
        color: "rgba(255,255,255,0.42)",
        marginBottom: 12,
      }}>
        {title.toUpperCase()}
      </div>
      {children}
    </div>
  );
}

function AlertRow({ severity, title, text }) {
  const color =
    severity === "critical" ? "#ef4444" :
    severity === "warning" ? "#f59e0b" :
    severity === "positive" ? "#22c55e" :
    "#60a5fa";

  return (
    <div style={{
      display: "flex",
      gap: 10,
      alignItems: "flex-start",
      padding: "12px 14px",
      borderRadius: 16,
      background: `${color}10`,
      border: `1px solid ${color}22`,
    }}>
      <div style={{
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: color,
        marginTop: 5,
        boxShadow: `0 0 14px ${color}`,
        flexShrink: 0,
      }} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.45 }}>{text}</div>
      </div>
    </div>
  );
}

function ActionRow({ priority, title, text }) {
  const color =
    priority === "high" ? "#ff5500" :
    priority === "medium" ? "#f5e03a" :
    "#60a5fa";

  return (
    <div style={{
      padding: "12px 14px",
      borderRadius: 16,
      background: `${color}10`,
      border: `1px solid ${color}20`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>{title}</div>
        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "1px", textTransform: "uppercase", color }}>
          {priority}
        </div>
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.45 }}>
        {text}
      </div>
    </div>
  );
}

export default function FounderIntelligencePanel({ intelligence, totalCapital = 0 }) {
  if (!intelligence?.ok) return null;

  const mm = intelligence.month_metrics || {};
  const all = intelligence.all_time || {};
  const d = intelligence.derived || {};
  const forecast = intelligence.forecast || {};
  const health = intelligence.health || {};
  const topClients = intelligence.top_clients || [];
  const lanes = intelligence.lane_performance || [];

  const capitalRatio = Number(totalCapital || 0) > 0
    ? (Number(mm.net_profit || 0) / Number(totalCapital || 0)) * 100
    : 0;

  return (
    <div style={{
      borderRadius: 26,
      padding: 20,
      background: "linear-gradient(135deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.02) 100%)",
      border: `1px solid ${intelligence.status_color || "#60a5fa"}33`,
      boxShadow: "0 16px 44px rgba(0,0,0,0.32)",
      overflow: "hidden",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "1.4px", color: "rgba(255,255,255,0.42)", marginBottom: 6 }}>
            FOUNDER INTELLIGENCE
          </div>
          <div style={{ fontSize: 30, fontWeight: 1000, letterSpacing: "-1px", color: "#fff", marginBottom: 8 }}>
            Capa ejecutiva del negocio
          </div>
          <div style={{ maxWidth: 900, fontSize: 13, lineHeight: 1.55, color: "rgba(255,255,255,0.5)" }}>
            {intelligence.summary}
          </div>
        </div>
        <Pill text={intelligence.status_label || intelligence.status || "Estado"} color={intelligence.status_color || "#60a5fa"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 16 }}>
        <Card
          title="Neto del mes"
          value={usd(mm.net_profit)}
          sub={`Margen ${pct(mm.margin)} · ${Number(mm.active_clients || 0)} clientes activos`}
          color={Number(mm.net_profit || 0) >= 0 ? "#22c55e" : "#ef4444"}
        />
        <Card
          title={forecast.is_current_month ? "Proyección cierre" : "Cierre del mes"}
          value={usd(forecast.projected_net_profit)}
          sub={forecast.is_current_month
            ? `Día ${forecast.day}/${forecast.days_in_month} · tendencia ${pct(forecast.trend_vs_previous_pct)}`
            : `Mes cerrado · tendencia ${pct(forecast.trend_vs_previous_pct)}`}
          color="#60a5fa"
        />
        <Card
          title="Profit por kg"
          value={`$${Number(d.month_usd_per_kg || 0).toFixed(2)}/kg`}
          sub={`Histórico $${Number(d.all_time_usd_per_kg || 0).toFixed(2)}/kg`}
          color="#f97316"
        />
        <Card
          title="Health score"
          value={`${Number(health.score || 0)}/100`}
          sub={`Capital ratio ${pct(capitalRatio)} · all time ${usd(all.executive_total_profit)}`}
          color={health.color || "#60a5fa"}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.95fr", gap: 14, marginBottom: 14 }}>
        <Box title="Alertas inteligentes" color="#f59e0b">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(intelligence.alerts || []).length ? (
              intelligence.alerts.slice(0, 5).map((a, i) => (
                <AlertRow key={i} severity={a.severity} title={a.title} text={a.text} />
              ))
            ) : (
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>No hay alertas relevantes en este momento.</div>
            )}
          </div>
        </Box>

        <Box title="Acciones sugeridas" color="#ff5500">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(intelligence.actions || []).length ? (
              intelligence.actions.slice(0, 5).map((a, i) => (
                <ActionRow key={i} priority={a.priority} title={a.title} text={a.text} />
              ))
            ) : (
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>No hay acciones urgentes. La estructura viene estable.</div>
            )}
          </div>
        </Box>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Box title="Top clientes por profit real" color="#22c55e">
          <div style={{ display: "grid", gap: 10 }}>
            {topClients.length ? topClients.map((c, i) => (
              <div key={i} style={{
                display: "grid",
                gridTemplateColumns: "1.6fr 1fr 1fr",
                gap: 10,
                alignItems: "center",
                padding: "12px 14px",
                borderRadius: 16,
                background: "rgba(255,255,255,0.035)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>
                    #{c.client_number} · {c.name}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", marginTop: 3 }}>
                    {c.shipments} envíos · {kg(c.total_kg)}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#22c55e" }}>
                  {usd(c.profit_usd)}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.52)", textAlign: "right" }}>
                  ${Number(c.profit_per_kg || 0).toFixed(2)}/kg
                </div>
              </div>
            )) : (
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>No hay pagos suficientes en este mes para rankear clientes.</div>
            )}
          </div>
        </Box>

        <Box title="Performance por ruta" color="#a78bfa">
          <div style={{ display: "grid", gap: 10 }}>
            {lanes.length ? lanes.map((l, i) => (
              <div key={i} style={{
                padding: "12px 14px",
                borderRadius: 16,
                background: "rgba(255,255,255,0.035)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>
                    {l.origin} · {l.service}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: Number(l.profit || 0) >= 0 ? "#22c55e" : "#ef4444" }}>
                    {usd(l.profit)}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.42)", lineHeight: 1.45 }}>
                  {l.shipments} envíos · {kg(l.total_kg)} · ingreso {usd(l.revenue)} · costo {usd(l.cost)} · ${Number(l.profit_per_kg || 0).toFixed(2)}/kg
                </div>
              </div>
            )) : (
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>No hay movimientos suficientes para comparar rutas.</div>
            )}
          </div>
        </Box>
      </div>
    </div>
  );
}
