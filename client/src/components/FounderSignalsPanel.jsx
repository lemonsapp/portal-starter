import React from "react";

function fmtUsd(v) {
  const n = Number(v || 0);
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtKg(v) {
  const n = Number(v || 0);
  return `${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
}

function SignalCard({ title, value, sub, color = "#60a5fa", icon = "◈" }) {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 22,
        padding: "16px 16px 14px",
        background: "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))",
        border: `1px solid ${color}2a`,
        boxShadow: `0 14px 34px ${color}12`,
        overflow: "hidden",
        minHeight: 122,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -20,
          right: -10,
          width: 90,
          height: 90,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${color}30, transparent 70%)`,
          filter: "blur(12px)",
          pointerEvents: "none",
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.9px", color: "rgba(255,255,255,0.42)" }}>
          {title.toUpperCase()}
        </div>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 12,
            display: "grid",
            placeItems: "center",
            background: `${color}18`,
            border: `1px solid ${color}33`,
            color,
            fontWeight: 900,
          }}
        >
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 950, color: "#fff", letterSpacing: "-0.7px" }}>
        {value}
      </div>
      {sub ? (
        <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.4, color: "rgba(255,255,255,0.42)" }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function AlertRow({ color, title, text }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        padding: "12px 14px",
        borderRadius: 16,
        background: `${color}10`,
        border: `1px solid ${color}22`,
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: color,
          marginTop: 5,
          boxShadow: `0 0 14px ${color}`,
          flexShrink: 0,
        }}
      />
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.45 }}>{text}</div>
      </div>
    </div>
  );
}

function ProgressBar({ value, color }) {
  const safe = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div
      style={{
        height: 10,
        borderRadius: 999,
        background: "rgba(255,255,255,0.06)",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        style={{
          width: `${safe}%`,
          height: "100%",
          borderRadius: 999,
          background: `linear-gradient(90deg, ${color}, ${color}aa)`,
          boxShadow: `0 0 18px ${color}55`,
        }}
      />
    </div>
  );
}

export default function FounderSignalsPanel({
  metrics,
  monthly = [],
  data,
  totalCapital,
  fxRate,
}) {
  if (!metrics) return null;

  const executive = Number(metrics.executive_total_profit || 0);
  const courier = Number(metrics.courier_profit || 0);
  const external = Number(metrics.external_profit || 0);
  const addIncome = Number(metrics.additional_income_usd || 0);
  const totalKg = Number(metrics.total_kg || 0);
  const deliveredRevenue = Number(data?.stats?.delivered_revenue || 0);
  const totalRevenue = Number(
    (data?.by_origin || []).reduce((acc, row) => acc + Number(row.revenue || 0), 0)
  );

  const latestMonth = monthly?.[0] || null;
  const monthNet = Number(latestMonth?.net || 0);
  const monthIncome = Number(latestMonth?.total_income || 0);
  const monthOut = latestMonth?.total_out != null
    ? Number(latestMonth.total_out || 0)
    : Number(latestMonth?.cost_usd || 0) + Number(latestMonth?.empresa_usd || 0) + Number(latestMonth?.personal_usd || 0);

  const courierShare = executive > 0 ? (courier / executive) * 100 : 0;
  const externalShare = executive > 0 ? (external / executive) * 100 : 0;
  const addShare = executive > 0 ? (addIncome / executive) * 100 : 0;

  let healthScore = 50;
  if (executive > 0) healthScore += 20;
  if (monthNet > 0) healthScore += 15;
  if (totalCapital > 0) healthScore += 10;
  if (external >= 0) healthScore += 5;
  healthScore = Math.max(0, Math.min(100, healthScore));

  const alerts = [];
  if (executive >= 2000) {
    alerts.push({
      color: "#22c55e",
      title: "Mes fuerte",
      text: `El neto ejecutivo va en ${fmtUsd(executive)}. Hay margen para acelerar captación, volumen y fidelización.`,
    });
  } else if (executive > 0) {
    alerts.push({
      color: "#f5e03a",
      title: "Mes positivo pero ajustado",
      text: `El neto ejecutivo está en ${fmtUsd(executive)}. Conviene empujar revenue, adicionales y optimización de costos.`,
    });
  } else {
    alerts.push({
      color: "#ef4444",
      title: "Mes en alerta",
      text: `El neto ejecutivo va en ${fmtUsd(executive)}. Hay que revisar rentabilidad y caja de inmediato.`,
    });
  }

  if (external < 300) {
    alerts.push({
      color: "#60a5fa",
      title: "Externas con margen limitado",
      text: `Las externas muestran ${fmtUsd(external)}. Hay espacio para subir comisión, volumen o frecuencia.`,
    });
  }

  if (addIncome <= 0) {
    alerts.push({
      color: "#a78bfa",
      title: "Adicionales dormidos",
      text: "Este mes casi no hay ingresos adicionales. Conviene activarlos como línea paralela fuerte de caja.",
    });
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.25fr 0.95fr",
        gap: 14,
        marginBottom: 18,
      }}
    >
      <div
        style={{
          borderRadius: 28,
          padding: 20,
          background: "linear-gradient(135deg, rgba(12,18,34,0.98), rgba(18,28,52,0.95))",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 16px 50px rgba(0,0,0,0.28)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(circle at 12% 16%, rgba(96,165,250,0.12), transparent 22%), radial-gradient(circle at 86% 16%, rgba(245,224,58,0.12), transparent 22%), radial-gradient(circle at 70% 84%, rgba(34,197,94,0.10), transparent 22%)",
          }}
        />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1px", color: "rgba(255,255,255,0.42)" }}>
              EXECUTIVE SIGNALS
            </div>
            <div style={{ fontSize: 26, fontWeight: 1000, letterSpacing: "-1px", color: "#fff", marginTop: 4 }}>
              Informe inteligente del mes
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.44)", marginTop: 6 }}>
              Resumen ejecutivo de resultado, estructura de ingresos, salud general y capital visible.
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
            <SignalCard
              title="Health score"
              value={`${healthScore}/100`}
              sub="Indicador ejecutivo compuesto"
              icon="◎"
              color={healthScore >= 75 ? "#22c55e" : healthScore >= 55 ? "#f5e03a" : "#ef4444"}
            />
            <SignalCard
              title="Revenue entregado"
              value={fmtUsd(deliveredRevenue)}
              sub="Solo entregados"
              icon="✓"
              color="#22c55e"
            />
            <SignalCard
              title="Revenue total visible"
              value={fmtUsd(totalRevenue)}
              sub="Suma de estimados"
              icon="◈"
              color="#60a5fa"
            />
            <SignalCard
              title="Capital visible"
              value={fmtUsd(totalCapital || 0)}
              sub={fxRate ? `TC actual: $${Number(fxRate).toLocaleString("es-AR")}` : "Sin TC configurado"}
              icon="🏦"
              color="#34d399"
            />
          </div>

          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.42)", marginBottom: 6 }}>
                SHARE COURIER
              </div>
              <ProgressBar value={courierShare} color="#f5e03a" />
              <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: "#fff" }}>{courierShare.toFixed(1)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.42)", marginBottom: 6 }}>
                SHARE EXTERNAS
              </div>
              <ProgressBar value={externalShare} color="#60a5fa" />
              <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: "#fff" }}>{externalShare.toFixed(1)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.42)", marginBottom: 6 }}>
                SHARE ADICIONALES
              </div>
              <ProgressBar value={addShare} color="#a78bfa" />
              <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: "#fff" }}>{addShare.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          borderRadius: 28,
          padding: 20,
          background: "linear-gradient(135deg, rgba(10,16,30,0.98), rgba(17,22,36,0.96))",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 16px 50px rgba(0,0,0,0.26)",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1px", color: "rgba(255,255,255,0.42)", marginBottom: 8 }}>
          ALERTAS Y LECTURA RÁPIDA
        </div>
        <div style={{ fontSize: 24, fontWeight: 1000, letterSpacing: "-1px", color: "#fff", marginBottom: 14 }}>
          Focus del founder
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {alerts.map((a, i) => (
            <AlertRow key={i} color={a.color} title={a.title} text={a.text} />
          ))}
        </div>

        <div
          style={{
            marginTop: 16,
            borderRadius: 18,
            padding: "14px 14px 12px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.42)", marginBottom: 8 }}>
            SNAPSHOT MENSUAL
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)" }}>Entró</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#4ade80" }}>{fmtUsd(monthIncome)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)" }}>Salió</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#f87171" }}>{fmtUsd(monthOut)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)" }}>Neto mensual</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: monthNet >= 0 ? "#22c55e" : "#ef4444" }}>
                {fmtUsd(monthNet)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)" }}>KG total</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#fff" }}>{fmtKg(totalKg)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
