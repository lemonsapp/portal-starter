const express = require("express");
const router = express.Router();
const db = require("../db");
const { authRequired, requireRole } = require("../auth");

function num(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

function round2(v) {
  return Math.round((num(v) + Number.EPSILON) * 100) / 100;
}

function pctDiff(current, previous) {
  const c = num(current);
  const p = num(previous);
  if (!p && !c) return 0;
  if (!p) return 100;
  return ((c - p) / Math.abs(p)) * 100;
}

function currentMonthCode() {
  return new Date().toISOString().slice(0, 7);
}

function buildMonthRange(month) {
  const safe = /^\d{4}-\d{2}$/.test(String(month || "").trim())
    ? String(month).trim()
    : currentMonthCode();

  const [y, m] = safe.split("-").map(Number);
  const from = `${safe}-01`;
  const to = new Date(y, m, 0).toISOString().slice(0, 10);

  const prevDate = new Date(y, m - 2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
  const prevFrom = `${prevMonth}-01`;
  const prevTo = new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 0).toISOString().slice(0, 10);

  return { month: safe, from, to, prevMonth, prevFrom, prevTo };
}

async function getOperatorCosts() {
  try {
    const q = await db.query(`
      SELECT usa_normal, usa_express, usa_tech_premium, china_normal, china_express, europa_normal
      FROM operator_costs
      LIMIT 1
    `);
    return q.rows[0] || {
      usa_normal: 0,
      usa_express: 0,
      usa_tech_premium: 0,
      china_normal: 0,
      china_express: 0,
      europa_normal: 0,
    };
  } catch {
    return {
      usa_normal: 0,
      usa_express: 0,
      usa_tech_premium: 0,
      china_normal: 0,
      china_express: 0,
      europa_normal: 0,
    };
  }
}

async function runMetricsRange(dateFrom, dateTo) {
  const [
    courierQ,
    externalQ,
    incomeQ,
    expensesQ,
    shipQ,
    clientsQ
  ] = await Promise.all([
    db.query(`
      SELECT
        COALESCE(SUM(amount_usd), 0)              AS collected,
        COALESCE(SUM(COALESCE(cost_usd, 0)), 0)   AS cost_usd,
        COALESCE(SUM(COALESCE(profit_usd, 0)), 0) AS profit_usd
      FROM payments
      WHERE created_at >= $1 AND created_at <= $2::date + INTERVAL '1 day'
    `, [dateFrom, dateTo]),

    db.query(`
      SELECT
        COALESCE(SUM(i.weight_kg * i.tariff_per_kg) FILTER (WHERE i.is_commission = TRUE), 0) AS commission_usd,
        COALESCE(SUM(i.weight_kg) FILTER (WHERE i.is_commission = TRUE), 0) AS commission_kg,
        COALESCE(SUM(i.weight_kg), 0) AS total_kg
      FROM ext_items i
      JOIN ext_boxes b ON b.id = i.box_id
      WHERE b.date_received >= $1 AND b.date_received <= $2
    `, [dateFrom, dateTo]),

    db.query(`
      SELECT COALESCE(SUM(amount) FILTER (WHERE currency='USD'), 0) AS income_usd
      FROM additional_income
      WHERE date >= $1 AND date <= $2
    `, [dateFrom, dateTo]),

    db.query(`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE currency='USD' AND type='empresa'), 0)  AS empresa_usd,
        COALESCE(SUM(amount) FILTER (WHERE currency='USD' AND type='personal'), 0) AS personal_usd
      FROM expenses
      WHERE date >= $1 AND date <= $2
    `, [dateFrom, dateTo]),

    db.query(`
      SELECT
        COUNT(*) AS total_shipments,
        COUNT(*) FILTER (WHERE status='Entregado') AS delivered,
        COALESCE(SUM(weight_kg), 0) AS total_kg
      FROM shipments
      WHERE date_in >= $1 AND date_in <= $2
    `, [dateFrom, dateTo]),

    db.query(`
      SELECT COUNT(DISTINCT user_id) AS active_clients
      FROM shipments
      WHERE date_in >= $1 AND date_in <= $2
    `, [dateFrom, dateTo]),
  ]);

  const courier = courierQ.rows[0] || {};
  const external = externalQ.rows[0] || {};
  const income = incomeQ.rows[0] || {};
  const expenses = expensesQ.rows[0] || {};
  const ships = shipQ.rows[0] || {};
  const clients = clientsQ.rows[0] || {};

  const collected       = num(courier.collected);
  const cost_usd        = num(courier.cost_usd);
  const courier_profit  = num(courier.profit_usd);
  const commission_usd  = num(external.commission_usd);
  const commission_kg   = num(external.commission_kg);
  const income_usd      = num(income.income_usd);
  const empresa_usd     = num(expenses.empresa_usd);
  const personal_usd    = num(expenses.personal_usd);
  const courier_kg      = num(ships.total_kg);

  const total_income = collected + commission_usd + income_usd;
  const total_out    = cost_usd + empresa_usd + personal_usd;
  const net_profit   = total_income - total_out;
  const margin       = total_income > 0 ? (net_profit / total_income) * 100 : 0;
  const executive_total_profit = courier_profit + commission_usd + income_usd;
  const total_kg = courier_kg + commission_kg;
  const usd_per_kg = total_kg > 0 ? executive_total_profit / total_kg : 0;

  return {
    total_income: round2(total_income),
    collected: round2(collected),
    commission_usd: round2(commission_usd),
    income_usd: round2(income_usd),
    additional_income_usd: round2(income_usd),
    total_out: round2(total_out),
    cost_usd: round2(cost_usd),
    empresa_usd: round2(empresa_usd),
    personal_usd: round2(personal_usd),
    net_profit: round2(net_profit),
    total_profit: round2(net_profit),
    executive_total_profit: round2(executive_total_profit),
    courier_profit: round2(courier_profit),
    external_profit: round2(commission_usd),
    margin: round2(margin),
    courier_kg: round2(courier_kg),
    commission_kg: round2(commission_kg),
    external_kg: round2(commission_kg),
    total_kg: round2(total_kg),
    total_shipments: num(ships.total_shipments),
    delivered: num(ships.delivered),
    active_clients: num(clients.active_clients),
    usd_per_kg: round2(usd_per_kg),
  };
}

async function runMetricsAllTime() {
  const [
    courierQ,
    externalQ,
    incomeQ,
    expensesQ,
    shipQ,
    clientsQ
  ] = await Promise.all([
    db.query(`
      SELECT
        COALESCE(SUM(amount_usd), 0)              AS collected,
        COALESCE(SUM(COALESCE(cost_usd, 0)), 0)   AS cost_usd,
        COALESCE(SUM(COALESCE(profit_usd, 0)), 0) AS profit_usd
      FROM payments
    `),
    db.query(`
      SELECT
        COALESCE(SUM(i.weight_kg * i.tariff_per_kg) FILTER (WHERE i.is_commission = TRUE), 0) AS commission_usd,
        COALESCE(SUM(i.weight_kg) FILTER (WHERE i.is_commission = TRUE), 0) AS commission_kg,
        COALESCE(SUM(i.weight_kg), 0) AS total_kg
      FROM ext_items i
      JOIN ext_boxes b ON b.id = i.box_id
    `),
    db.query(`
      SELECT COALESCE(SUM(amount) FILTER (WHERE currency='USD'), 0) AS income_usd
      FROM additional_income
    `),
    db.query(`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE currency='USD' AND type='empresa'), 0)  AS empresa_usd,
        COALESCE(SUM(amount) FILTER (WHERE currency='USD' AND type='personal'), 0) AS personal_usd
      FROM expenses
    `),
    db.query(`
      SELECT
        COUNT(*) AS total_shipments,
        COUNT(*) FILTER (WHERE status='Entregado') AS delivered,
        COALESCE(SUM(weight_kg), 0) AS total_kg
      FROM shipments
    `),
    db.query(`
      SELECT COUNT(DISTINCT user_id) AS active_clients
      FROM shipments
    `),
  ]);

  const courier = courierQ.rows[0] || {};
  const external = externalQ.rows[0] || {};
  const income = incomeQ.rows[0] || {};
  const expenses = expensesQ.rows[0] || {};
  const ships = shipQ.rows[0] || {};
  const clients = clientsQ.rows[0] || {};

  const collected       = num(courier.collected);
  const cost_usd        = num(courier.cost_usd);
  const courier_profit  = num(courier.profit_usd);
  const commission_usd  = num(external.commission_usd);
  const commission_kg   = num(external.commission_kg);
  const income_usd      = num(income.income_usd);
  const empresa_usd     = num(expenses.empresa_usd);
  const personal_usd    = num(expenses.personal_usd);
  const courier_kg      = num(ships.total_kg);

  const total_income = collected + commission_usd + income_usd;
  const total_out    = cost_usd + empresa_usd + personal_usd;
  const net_profit   = total_income - total_out;
  const margin       = total_income > 0 ? (net_profit / total_income) * 100 : 0;
  const executive_total_profit = courier_profit + commission_usd + income_usd;
  const total_kg = courier_kg + commission_kg;
  const usd_per_kg = total_kg > 0 ? executive_total_profit / total_kg : 0;

  return {
    total_income: round2(total_income),
    collected: round2(collected),
    commission_usd: round2(commission_usd),
    income_usd: round2(income_usd),
    additional_income_usd: round2(income_usd),
    total_out: round2(total_out),
    cost_usd: round2(cost_usd),
    empresa_usd: round2(empresa_usd),
    personal_usd: round2(personal_usd),
    net_profit: round2(net_profit),
    total_profit: round2(net_profit),
    executive_total_profit: round2(executive_total_profit),
    courier_profit: round2(courier_profit),
    external_profit: round2(commission_usd),
    margin: round2(margin),
    courier_kg: round2(courier_kg),
    commission_kg: round2(commission_kg),
    external_kg: round2(commission_kg),
    total_kg: round2(total_kg),
    total_shipments: num(ships.total_shipments),
    delivered: num(ships.delivered),
    active_clients: num(clients.active_clients),
    usd_per_kg: round2(usd_per_kg),
  };
}

function statusFrom({ netMonth, marginMonth, healthScore, trendPct }) {
  if (netMonth <= 0 || marginMonth < 8 || healthScore < 35) return "critical";
  if (trendPct <= -12 || marginMonth < 12 || healthScore < 55) return "attention";
  if (netMonth > 0 && marginMonth >= 18 && healthScore >= 75) return "solid";
  return "stable";
}

function statusLabel(status) {
  if (status === "solid") return "Sólido";
  if (status === "stable") return "Estable";
  if (status === "attention") return "Atención";
  return "Crítico";
}

function statusColor(status) {
  if (status === "solid") return "#22c55e";
  if (status === "stable") return "#60a5fa";
  if (status === "attention") return "#f59e0b";
  return "#ef4444";
}

function buildSummary({ status, netMonth, trendPct, marginMonth, monthUsdPerKg, allTimeUsdPerKg, externalSharePct, additionalSharePct, isCurrentMonth }) {
  const base =
    status === "solid" ? "El negocio está sólido." :
    status === "stable" ? "El negocio está estable." :
    status === "attention" ? "El negocio necesita atención." :
    "El negocio está en zona crítica.";

  const pace =
    trendPct >= 8 ? "El ritmo mensual viene acelerando fuerte." :
    trendPct > 0 ? "El ritmo mensual viene mejorando." :
    trendPct <= -8 ? "El ritmo mensual viene cayendo fuerte." :
    trendPct < 0 ? "El ritmo mensual está por debajo del mes anterior." :
    "El ritmo mensual está estable.";

  const rent =
    marginMonth >= 18 ? "La rentabilidad del mes está sana." :
    marginMonth >= 12 ? "La rentabilidad del mes está aceptable." :
    "La rentabilidad del mes está presionada.";

  const kgText =
    monthUsdPerKg >= allTimeUsdPerKg ? "La ganancia por kilo está arriba del histórico." :
    "La ganancia por kilo está por debajo del histórico.";

  const mix =
    additionalSharePct > 35 ? "Hay demasiada dependencia de ingresos adicionales." :
    externalSharePct < 10 ? "La línea externa está aportando poco." :
    "La estructura del resultado está razonablemente equilibrada.";

  const closing = isCurrentMonth
    ? `Neto del mes: USD ${round2(netMonth)}.`
    : `Mes cerrado analizado: USD ${round2(netMonth)} de neto.`;

  return `${base} ${pace} ${rent} ${kgText} ${mix} ${closing}`;
}

router.get("/dashboard/founder-intelligence", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const { month, from, to, prevMonth, prevFrom, prevTo } = buildMonthRange(req.query.month);
    const currentMonth = currentMonthCode();
    const isCurrentMonth = month === currentMonth;

    const [monthMetrics, previousMonthMetrics, allTime, operatorCosts] = await Promise.all([
      runMetricsRange(from, to),
      runMetricsRange(prevFrom, prevTo),
      runMetricsAllTime(),
      getOperatorCosts(),
    ]);

    const monthNet = num(monthMetrics.net_profit);
    const prevNet = num(previousMonthMetrics.net_profit);
    const trendPct = round2(pctDiff(monthNet, prevNet));
    const monthExec = num(monthMetrics.executive_total_profit);
    const monthMargin = num(monthMetrics.margin);
    const monthUsdPerKg = num(monthMetrics.usd_per_kg);
    const allTimeUsdPerKg = num(allTime.usd_per_kg);

    let healthScore = 50;
    if (num(allTime.executive_total_profit) > 0) healthScore += 20;
    if (monthNet > 0) healthScore += 15;
    if (num(monthMetrics.external_profit) > 0) healthScore += 5;
    if (monthMargin >= 15) healthScore += 5;
    if (monthUsdPerKg >= Math.max(allTimeUsdPerKg, 0.01)) healthScore += 5;
    healthScore = Math.max(0, Math.min(100, healthScore));

    const status = statusFrom({ netMonth: monthNet, marginMonth: monthMargin, healthScore, trendPct });
    const externalSharePct = monthExec > 0 ? (num(monthMetrics.external_profit) / monthExec) * 100 : 0;
    const additionalSharePct = monthExec > 0 ? (num(monthMetrics.additional_income_usd) / monthExec) * 100 : 0;

    const now = new Date();
    const day = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const projectedNet = isCurrentMonth && day > 0 ? round2((monthNet / day) * daysInMonth) : monthNet;
    const projectedExec = isCurrentMonth && day > 0 ? round2((monthExec / day) * daysInMonth) : monthExec;

    const alerts = [];

    if (monthNet <= 0) {
      alerts.push({
        severity: "critical",
        title: "Neto mensual en rojo",
        text: "El mes seleccionado no está generando neto positivo."
      });
    }

    if (trendPct <= -12) {
      alerts.push({
        severity: "warning",
        title: "Caída fuerte vs mes anterior",
        text: `El neto del mes está ${Math.abs(trendPct).toFixed(1)}% abajo respecto al mes anterior.`
      });
    }

    if (monthMargin < 12) {
      alerts.push({
        severity: "warning",
        title: "Margen mensual bajo",
        text: `El margen actual está en ${monthMargin.toFixed(1)}%, por debajo de una zona cómoda.`
      });
    }

    if (monthUsdPerKg < allTimeUsdPerKg * 0.88 && allTimeUsdPerKg > 0) {
      alerts.push({
        severity: "warning",
        title: "Profit por kilo por debajo del histórico",
        text: `El mes viene con USD ${monthUsdPerKg.toFixed(2)}/kg frente a USD ${allTimeUsdPerKg.toFixed(2)}/kg histórico.`
      });
    }

    if (externalSharePct < 10 && monthExec > 0) {
      alerts.push({
        severity: "warning",
        title: "Línea externa débil",
        text: "La contribución de externas en el resultado del mes es baja."
      });
    }

    if (additionalSharePct > 35 && monthExec > 0) {
      alerts.push({
        severity: "warning",
        title: "Demasiada dependencia de ingresos adicionales",
        text: "El resultado del mes depende demasiado de ingresos fuera de la operación principal."
      });
    }

    if (projectedNet > prevNet * 1.08 && projectedNet > 0) {
      alerts.push({
        severity: "positive",
        title: "Proyección de cierre positiva",
        text: "Si sostenés este ritmo, el cierre quedaría por encima del mes anterior."
      });
    }

    const actions = [];

    if (monthMargin < 14) {
      actions.push({
        priority: "high",
        title: "Revisar pricing y costos",
        text: "Hay que defender margen: revisar tarifa final por ruta, costo/kg y desvíos de gastos empresa/personal."
      });
    }

    if (externalSharePct < 10) {
      actions.push({
        priority: "high",
        title: "Empujar la línea externa",
        text: "Externas hoy aportan poco al resultado. Conviene activar más cierres, comisión o volumen externo."
      });
    }

    if (monthUsdPerKg < allTimeUsdPerKg * 0.88 && allTimeUsdPerKg > 0) {
      actions.push({
        priority: "high",
        title: "Subir rentabilidad por kilo",
        text: "Priorizá clientes o rutas con mejor profit/kg y frená volumen flojo de margen."
      });
    }

    if (projectedNet < prevNet && isCurrentMonth) {
      actions.push({
        priority: "medium",
        title: "Corregir ritmo de cierre",
        text: "El mes proyecta cerrar por debajo del anterior. Hace falta empujar volumen, margen o ambas."
      });
    }

    if (num(monthMetrics.active_clients) < 8 && num(monthMetrics.total_shipments) > 0) {
      actions.push({
        priority: "medium",
        title: "Diversificar clientes activos",
        text: "Hay poca base activa para sostener escala. Conviene abrir más recurrencia."
      });
    }

    const topClientsQ = await db.query(`
      SELECT
        u.id,
        u.client_number,
        u.name,
        COUNT(DISTINCT pi.shipment_id) AS shipments,
        COALESCE(SUM(pi.profit_usd), 0) AS profit_usd,
        COALESCE(SUM(s.weight_kg), 0) AS total_kg
      FROM payment_items pi
      JOIN payments p ON p.id = pi.payment_id
      JOIN shipments s ON s.id = pi.shipment_id
      JOIN users u ON u.id = s.user_id
      WHERE p.created_at >= $1 AND p.created_at <= $2::date + INTERVAL '1 day'
      GROUP BY u.id, u.client_number, u.name
      ORDER BY profit_usd DESC, total_kg DESC
      LIMIT 5
    `, [from, to]);

    const topClients = (topClientsQ.rows || []).map(r => {
      const profit = num(r.profit_usd);
      const totalKg = num(r.total_kg);
      return {
        client_number: r.client_number,
        name: r.name,
        shipments: num(r.shipments),
        profit_usd: round2(profit),
        total_kg: round2(totalKg),
        profit_per_kg: round2(totalKg > 0 ? profit / totalKg : 0),
      };
    });

    const c = {
      usa_normal: num(operatorCosts.usa_normal),
      usa_express: num(operatorCosts.usa_express),
      usa_tech_premium: num(operatorCosts.usa_tech_premium),
      china_normal: num(operatorCosts.china_normal),
      china_express: num(operatorCosts.china_express),
      europa_normal: num(operatorCosts.europa_normal),
    };

    const costExpr = `
      CASE
        WHEN s.origin='USA'   AND s.service='NORMAL'       THEN ${c.usa_normal}
        WHEN s.origin='USA'   AND s.service='EXPRESS'      THEN ${c.usa_express}
        WHEN s.origin='USA'   AND s.service='TECH_PREMIUM' THEN ${c.usa_tech_premium}
        WHEN s.origin='CHINA' AND s.service='NORMAL'       THEN ${c.china_normal}
        WHEN s.origin='CHINA' AND s.service='EXPRESS'      THEN ${c.china_express}
        WHEN s.origin='EUROPA'                             THEN ${c.europa_normal}
        ELSE 0
      END
    `;

    const laneQ = await db.query(`
      SELECT
        COALESCE(s.origin, '-') AS origin,
        COALESCE(s.service, '-') AS service,
        COUNT(*) AS shipments,
        COALESCE(SUM(s.weight_kg), 0) AS total_kg,
        COALESCE(SUM(s.estimated_usd), 0) AS revenue,
        COALESCE(SUM(s.weight_kg * (${costExpr})), 0) AS cost,
        COALESCE(SUM(s.estimated_usd), 0) - COALESCE(SUM(s.weight_kg * (${costExpr})), 0) AS profit
      FROM shipments s
      WHERE s.date_in >= $1 AND s.date_in <= $2
      GROUP BY s.origin, s.service
      ORDER BY profit DESC, revenue DESC
      LIMIT 8
    `, [from, to]);

    const lanePerformance = (laneQ.rows || []).map(r => {
      const profit = num(r.profit);
      const totalKg = num(r.total_kg);
      return {
        origin: r.origin,
        service: r.service,
        shipments: num(r.shipments),
        total_kg: round2(totalKg),
        revenue: round2(r.revenue),
        cost: round2(r.cost),
        profit: round2(profit),
        profit_per_kg: round2(totalKg > 0 ? profit / totalKg : 0),
      };
    });

    const bestLane = lanePerformance.length
      ? [...lanePerformance].sort((a, b) => num(b.profit_per_kg) - num(a.profit_per_kg))[0]
      : null;

    const weakestLane = lanePerformance.length
      ? [...lanePerformance].sort((a, b) => num(a.profit_per_kg) - num(b.profit_per_kg))[0]
      : null;

    if (bestLane && bestLane.profit_per_kg > 0) {
      alerts.push({
        severity: "opportunity",
        title: "Ruta con mejor rentabilidad",
        text: `${bestLane.origin} ${bestLane.service} está liderando con USD ${bestLane.profit_per_kg.toFixed(2)}/kg.`
      });
    }

    if (weakestLane && lanePerformance.length > 1 && weakestLane.profit_per_kg < bestLane.profit_per_kg) {
      actions.push({
        priority: "medium",
        title: "Revisar ruta más débil",
        text: `${weakestLane.origin} ${weakestLane.service} es la ruta más floja en profit/kg dentro del mes seleccionado.`
      });
    }

    const summary = buildSummary({
      status,
      netMonth: monthNet,
      trendPct,
      marginMonth,
      monthUsdPerKg,
      allTimeUsdPerKg,
      externalSharePct,
      additionalSharePct,
      isCurrentMonth,
    });

    res.json({
      ok: true,
      month,
      previous_month: prevMonth,
      is_current_month: isCurrentMonth,
      status,
      status_label: statusLabel(status),
      status_color: statusColor(status),
      summary,
      health: {
        score: healthScore,
        color: statusColor(status),
      },
      forecast: {
        projected_net_profit: round2(projectedNet),
        projected_executive_profit: round2(projectedExec),
        trend_vs_previous_pct: round2(trendPct),
        day,
        days_in_month: daysInMonth,
        is_current_month: isCurrentMonth,
      },
      derived: {
        month_usd_per_kg: round2(monthUsdPerKg),
        all_time_usd_per_kg: round2(allTimeUsdPerKg),
        external_share_pct: round2(externalSharePct),
        additional_share_pct: round2(additionalSharePct),
      },
      month_metrics: monthMetrics,
      previous_month_metrics: previousMonthMetrics,
      all_time: allTime,
      alerts,
      actions,
      top_clients: topClients,
      lane_performance: lanePerformance,
    });
  } catch (err) {
    console.error("[FOUNDER INTELLIGENCE ERROR]", err);
    res.status(500).json({ error: "Error generando founder intelligence" });
  }
});

module.exports = router;
