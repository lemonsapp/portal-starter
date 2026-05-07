import React from "react";

function usd(v) {
  return `$${Number(v || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function pct(v) {
  return `${Number(v || 0).toFixed(1)}%`;
}

function kg(v) {
  return `${Number(v || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} kg`;
}

function MainCard({ title, value, sub, color = "#22c55e" }) {
  return (
    <div style={{
      position: "relative",
      borderRadius: 24,
      padding: 18,
      overflow: "hidden",
      background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
      border: `1px solid ${color}24`,
      boxShadow: `0 18px 40px ${color}12`,
      backdropFilter: "blur(14px)",
    }}>
      <div style={{
        position: "absolute",
        top: -24,
        right: -18,
        width: 90,
        height: 90,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color}24, transparent 70%)`,
        pointerEvents: "none",
      }} />
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1px", color: "rgba(255,255,255,0.40)", marginBottom: 8 }}>
        {title.toUpperCase()}
      </div>
      <div style={{ fontSize: 40, fontWeight: 1000, letterSpacing: "-1.2px", color: "#fff", lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.42)", lineHeight: 1.45 }}>
        {sub}
      </div>
    </div>
  );
}

function MiniCard({ title, value, color = "#fff" }) {
  return (
    <div style={{
      borderRadius: 16,
      padding: "12px 14px",
      background: "rgba(8,12,22,0.72)",
      border: "1px solid rgba(255,255,255,0.06)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
    }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.38)", marginBottom: 6 }}>
        {title.toUpperCase()}
      </div>
      <div style={{ fontSize: 18, fontWeight: 900, color }}>
        {value}
      </div>
    </div>
  );
}

export default function FounderDashboardHero({
  netMonth = 0,
  prevNet = 0,
  totalCapital = 0,
  monthKg = 0,
  trend = 0,
  statusLabel = "Estable",
  statusColor = "#60a5fa",
  statusNote = "Sin cambios relevantes.",
}) {
  const kgYield = monthKg > 0 ? netMonth / monthKg : 0;
  const trendColor = trend >= 0 ? "#22c55e" : "#ef4444";

  return (
    <div style={{
      marginTop: 14,
      marginBottom: 18,
      borderRadius: 30,
      padding: 24,
      overflow: "hidden",
      background: "linear-gradient(135deg, #0a0f1f, #0f1b34)",
      border: "1px solid rgba(255,255,255,0.08)",
      boxShadow: "0 28px 80px rgba(0,0,0,0.34)",
      position: "relative",
    }}>
      <div style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        background:
          "radial-gradient(circle at 10% 12%, rgba(245,224,58,0.12), transparent 24%), radial-gradient(circle at 84% 18%, rgba(239,68,68,0.10), transparent 20%), radial-gradient(circle at 60% 80%, rgba(34,197,94,0.08), transparent 24%)",
      }} />

      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "1.2px", color: "rgba(255,255,255,0.45)" }}>
              FOUNDER MODE 5.0
            </div>
            <div style={{ marginTop: 6, fontSize: 42, fontWeight: 1000, letterSpacing: "-1.8px", color: "#fff" }}>
              Centro de control financiero
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: "rgba(255,255,255,0.44)", maxWidth: 840 }}>
              Vista ejecutiva premium para leer el negocio en segundos: resultado actual, referencia del mes pasado, tendencia, capital y rendimiento real.
            </div>
          </div>

          <div style={{
            minWidth: 280,
            borderRadius: 18,
            padding: "14px 16px",
            background: `${statusColor}14`,
            border: `1px solid ${statusColor}28`,
            boxShadow: `0 10px 26px ${statusColor}10`,
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1px", color: "rgba(255,255,255,0.42)", marginBottom: 6 }}>
              ESTADO DEL NEGOCIO
            </div>
            <div style={{ fontSize: 22, fontWeight: 1000, color: statusColor }}>
              {statusLabel}
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.45 }}>
              {statusNote}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
          <MainCard
            title="Neto actual"
            value={usd(netMonth)}
            sub="Resultado del mes seleccionado"
            color={netMonth >= 0 ? "#22c55e" : "#ef4444"}
          />
          <MainCard
            title="Mes pasado"
            value={usd(prevNet)}
            sub="Referencia automática"
            color="#60a5fa"
          />
          <MainCard
            title="Trend"
            value={pct(trend)}
            sub="Vs mes anterior"
            color={trendColor}
          />
          <MainCard
            title="Capital visible"
            value={usd(totalCapital)}
            sub="Caja + cuentas"
            color="#34d399"
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          <MiniCard title="Kg actual" value={kg(monthKg)} />
          <MiniCard title="Rentabilidad por kg" value={usd(kgYield)} color="#f97316" />
          <MiniCard title="Estado" value={statusLabel} color={statusColor} />
        </div>

        <div style={{
          marginTop: 14,
          padding: "14px 18px",
          borderRadius: 16,
          background: netMonth > 0
            ? "linear-gradient(90deg, rgba(34,197,94,0.12), transparent)"
            : "linear-gradient(90deg, rgba(239,68,68,0.12), transparent)",
          border: `1px solid ${netMonth > 0 ? "#22c55e22" : "#ef444422"}`
        }}>
          <div style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#fff",
            lineHeight: 1.5
          }}>
            {netMonth > 0
              ? "El negocio está generando utilidad. Es momento de escalar volumen y optimizar margen."
              : "El negocio está en zona de riesgo. Ajustar pricing o volumen urgente."}
          </div>
        </div>
      </div>
    </div>
  );
}
