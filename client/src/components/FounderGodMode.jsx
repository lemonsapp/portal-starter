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

function Panel({ title, children, color = "#60a5fa" }) {
  return (
    <div style={{
      borderRadius: 24,
      padding: 20,
      background: "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))",
      border: `1px solid ${color}24`,
      boxShadow: `0 14px 34px ${color}10`,
      backdropFilter: "blur(12px)",
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "1px",
        color: "rgba(255,255,255,0.42)",
        marginBottom: 14,
      }}>
        {title.toUpperCase()}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, color = "#fff" }) {
  return (
    <div style={{ padding: "12px 0" }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 950, color }}>
        {value}
      </div>
    </div>
  );
}

function Alert({ text, color }) {
  return (
    <div style={{
      padding: "10px 12px",
      borderRadius: 14,
      background: `${color}12`,
      border: `1px solid ${color}22`,
      color: "#fff",
      fontSize: 13,
      lineHeight: 1.45,
    }}>
      {text}
    </div>
  );
}

function Priority({ level, impact, action, color }) {
  return (
    <div style={{
      padding: "12px 14px",
      borderRadius: 16,
      background: `${color}12`,
      border: `1px solid ${color}22`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, fontWeight: 900, color }}>{level}</div>
        <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.5)" }}>
          Impacto estimado: {impact}
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>
        {action}
      </div>
    </div>
  );
}

export default function FounderGodMode({ metrics, monthly = [], totalCapital = 0 }) {
  if (!metrics) return null;

  const executive = Number(metrics.executive_total_profit || 0);
  const external = Number(metrics.external_profit || 0);
  const addIncome = Number(metrics.additional_income_usd || 0);
  const totalKg = Number(metrics.total_kg || 0);

  const today = new Date();
  const day = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  const currentMonth = Number(monthly?.[0]?.net || executive || 0);
  const prevMonth = Number(monthly?.[1]?.net || 0);
  const projectedClose = day > 0 ? (currentMonth / day) * daysInMonth : currentMonth;
  const trendVsPrev = prevMonth !== 0 ? ((currentMonth - prevMonth) / Math.abs(prevMonth)) * 100 : 0;
  const usdPerKg = totalKg > 0 ? currentMonth / totalKg : 0;
  const capitalRatio = totalCapital > 0 ? (currentMonth / totalCapital) * 100 : 0;

  let score = 50;
  if (currentMonth > 0) score += 15;
  if (projectedClose > currentMonth) score += 10;
  if (trendVsPrev > 0) score += 10;
  if (addIncome > 0) score += 5;
  if (external > 0) score += 5;
  if (usdPerKg > 5) score += 5;
  if (capitalRatio > 3) score += 5;
  score = Math.max(0, Math.min(100, score));

  const alerts = [];
  const priorities = [];

  if (currentMonth < 1000) {
    alerts.push({ color: "#ef4444", text: "El neto del mes está bajo para el punto actual. Hay que empujar ventas o márgenes." });
    priorities.push({
      level: "PROBLEMA CRÍTICO",
      impact: "+USD 1.200/mes",
      action: "Subir foco comercial en cierres rápidos y clientes con mayor ticket.",
      color: "#ef4444",
    });
  } else {
    alerts.push({ color: "#22c55e", text: "El mes está generando neto positivo. Hay base para escalar." });
    priorities.push({
      level: "ESCALADO",
      impact: "+USD 700/mes",
      action: "Mantener courier firme y acelerar campañas de recompra.",
      color: "#22c55e",
    });
  }

  if (external < 300) {
    alerts.push({ color: "#60a5fa", text: "Externas todavía tienen espacio de mejora. Falta exprimir mejor esa línea." });
    priorities.push({
      level: "OPORTUNIDAD DE GANANCIA",
      impact: "+USD 500/mes",
      action: "Revisar comisión por kg, frecuencia de cierres y volumen por cliente externo.",
      color: "#60a5fa",
    });
  }

  if (addIncome <= 0) {
    alerts.push({ color: "#a78bfa", text: "Los ingresos adicionales están bajos o nulos. Hay plata dormida ahí." });
    priorities.push({
      level: "LÍNEA SECUNDARIA",
      impact: "+USD 300/mes",
      action: "Activar una línea clara de ingresos extra fuera de cargas.",
      color: "#a78bfa",
    });
  }

  if (usdPerKg < 4) {
    alerts.push({ color: "#f97316", text: "La rentabilidad por kilo está floja. Puede haber pricing bajo o costos altos." });
    priorities.push({
      level: "AJUSTE NECESARIO",
      impact: "+USD 900/mes",
      action: "Revisar pricing por origen/servicio y descuentos mal aplicados.",
      color: "#f97316",
    });
  }

  return (
    <div style={{
      marginBottom: 18,
      display: "grid",
      gridTemplateColumns: "0.95fr 1.05fr",
      gap: 14,
    }}>
      <Panel title="God Mode / Estado actual" color="#a78bfa">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 16 }}>
          <Stat label="Business Score" value={`${score}/100`} color={score >= 75 ? "#22c55e" : score >= 55 ? "#f5e03a" : "#ef4444"} />
          <Stat label="Proyección cierre" value={usd(projectedClose)} color="#60a5fa" />
          <Stat label="Trend vs mes anterior" value={pct(trendVsPrev)} color={trendVsPrev >= 0 ? "#22c55e" : "#ef4444"} />
          <Stat label="Rend. sobre capital" value={pct(capitalRatio)} color="#34d399" />
        </div>

        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {alerts.map((a, i) => (
            <Alert key={i} text={a.text} color={a.color} />
          ))}
        </div>
      </Panel>

      <Panel title="Acciones recomendadas" color="#22c55e">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {priorities.map((p, i) => (
            <Priority key={i} level={p.level} impact={p.impact} action={p.action} color={p.color} />
          ))}
        </div>
      </Panel>
    </div>
  );
}
