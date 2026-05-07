const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/landing-stats", async (_req, res) => {
  try {
    const usersRes = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM users
      WHERE COALESCE(role, 'client') = 'client'
        AND COALESCE(active, true) = true
    `);

    const shipmentsRes = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM shipments
      WHERE status = 'Entregado'
    `);

    const baseClients = 400;
    const baseShipments = 3000;

    const totalClients = baseClients + Number(usersRes.rows?.[0]?.total || 0);
    const totalShipments = baseShipments + Number(shipmentsRes.rows?.[0]?.total || 0);

    res.json({
      ok: true,
      totalClients,
      totalShipments,
      baseClients,
      baseShipments,
      dbClients: Number(usersRes.rows?.[0]?.total || 0),
      dbDeliveredShipments: Number(shipmentsRes.rows?.[0]?.total || 0)
    });
  } catch (error) {
    console.error("landing-stats error:", error);
    res.status(500).json({
      ok: false,
      error: "No se pudieron obtener las estadísticas del landing"
    });
  }
});

module.exports = router;

// ── Endpoint ETZ AI — datos completos del negocio ────────────────────────────
router.get("/etz-business-data", async (req, res) => {
  const key = req.headers["x-ai-api-key"] || req.query.key;
  if (key !== "lemons_ai_2026KENOPAZENENE_xK9mPqR7vL3nZ") return res.status(401).json({ error: "No autorizado" });
  try {
    const db = require("../db");

    // Lee TC actual de app_settings; fallback 1400 si no existe (compat retro)
    const fxQ = await db.query(`SELECT value FROM app_settings WHERE key='fx_usd_ars' LIMIT 1`).catch(()=>({rows:[]}));
    const fxRaw = Number(fxQ.rows?.[0]?.value);
    const fxRate = Number.isFinite(fxRaw) && fxRaw > 0 ? fxRaw : 1400;

    const [
      shipmentStats, recentShipments, clientStats, topClients,
      paymentStats, expenseStats, waStats, recentPayments,
      pendingDelivery, shipmentByOrigin, allClients,
      stats90, expensesAll, operatorCosts, accounts, recentConvs
    ] = await Promise.all([
      db.query(`SELECT status, COUNT(*) as count, COALESCE(SUM(weight_kg),0) as kg FROM shipments GROUP BY status ORDER BY count DESC`),
      db.query(`SELECT s.code, s.status, s.origin, s.service, s.weight_kg, s.tracking, s.estimated_usd, u.name as client_name, u.client_number, s.created_at FROM shipments s LEFT JOIN users u ON u.id=s.user_id ORDER BY s.created_at DESC LIMIT 30`),
      db.query(`SELECT role, COUNT(*) as count FROM users GROUP BY role`),
      db.query(`SELECT u.name, u.client_number, u.phone, u.email, COUNT(s.id) as envios, COALESCE(SUM(s.weight_kg),0) as kg_total, COALESCE(SUM(s.estimated_usd),0) as usd_total FROM users u LEFT JOIN shipments s ON s.user_id=u.id WHERE u.role='client' GROUP BY u.id ORDER BY envios DESC LIMIT 20`),
      db.query(`SELECT COUNT(*) as total, COALESCE(SUM(amount_usd),0) as ingresos, COALESCE(SUM(profit_usd),0) as ganancia, COALESCE(AVG(amount_usd),0) as promedio FROM payments WHERE created_at > NOW() - INTERVAL '30 days'`),
      db.query(`SELECT category, COALESCE(SUM(CASE WHEN currency='ARS' THEN amount/${fxRate} ELSE amount END),0) as total_usd, currency FROM expenses WHERE date > NOW() - INTERVAL '30 days' AND category != 'Cargas Externas' GROUP BY category, currency ORDER BY total_usd DESC`),
      db.query(`SELECT mode, COUNT(*) as count, SUM(unread_count) as unread FROM wa_conversations GROUP BY mode`),
      db.query(`SELECT p.id, p.amount_usd, p.profit_usd, p.cost_usd, p.method, p.created_at, u.name as client_name, u.client_number FROM payments p LEFT JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC LIMIT 20`),
      db.query(`SELECT s.code, s.status, s.origin, s.service, s.weight_kg, s.estimated_usd, s.tracking, u.name as client_name, u.phone, u.client_number, s.created_at FROM shipments s LEFT JOIN users u ON u.id=s.user_id WHERE s.status IN ('Listo para entrega','En tránsito','Recibido en depósito') ORDER BY s.created_at DESC`),
      db.query(`SELECT origin, service, COUNT(*) as count, COALESCE(SUM(weight_kg),0) as kg_total FROM shipments GROUP BY origin, service ORDER BY count DESC`),
      db.query(`SELECT u.name, u.client_number, u.phone, u.email, u.created_at FROM users u WHERE u.role='client' ORDER BY u.created_at DESC LIMIT 100`),
      db.query(`SELECT COUNT(*) as total, COALESCE(SUM(amount_usd),0) as ingresos, COALESCE(SUM(profit_usd),0) as ganancia FROM payments WHERE created_at > NOW() - INTERVAL '90 days'`),
      db.query(`SELECT category, COALESCE(SUM(CASE WHEN currency='ARS' THEN amount/${fxRate} ELSE amount END),0) as total_usd FROM expenses WHERE category != 'Cargas Externas' GROUP BY category ORDER BY total_usd DESC`),
      db.query(`SELECT origin, service, cost_per_kg FROM operator_costs ORDER BY origin, service`).catch(()=>({rows:[]})),
      db.query(`SELECT name, balance_usd FROM accounts ORDER BY balance_usd DESC`).catch(()=>({rows:[]})),
      db.query(`SELECT phone, contact_name, mode, last_message, last_message_at, unread_count FROM wa_conversations ORDER BY last_message_at DESC LIMIT 20`).catch(()=>({rows:[]})),
    ]);

    const totalGastos30 = expenseStats.rows.reduce((a,r)=>a+Number(r.total_usd||0),0);
    const totalGastosAll = expensesAll.rows.reduce((a,r)=>a+Number(r.total_usd||0),0);

    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      shipments: {
        byStatus: shipmentStats.rows,
        recent: recentShipments.rows,
        byOrigin: shipmentByOrigin.rows,
        pending: pendingDelivery.rows,
        totals: {
          total: shipmentStats.rows.reduce((a,r)=>a+Number(r.count),0),
          enTransito: Number(shipmentStats.rows.find(r=>r.status==="En tránsito")?.count||0),
          listoEntrega: Number(shipmentStats.rows.find(r=>r.status==="Listo para entrega")?.count||0),
          entregados: Number(shipmentStats.rows.find(r=>r.status==="Entregado")?.count||0),
          recibidos: Number(shipmentStats.rows.find(r=>r.status==="Recibido en depósito")?.count||0),
        }
      },
      clients: {
        total: clientStats.rows.find(r=>r.role==="client")?.count||0,
        top: topClients.rows,
        all: allClients.rows,
      },
      finances: {
        last30days: {
          ...paymentStats.rows[0],
          gastos: totalGastos30,
          neta: Number(paymentStats.rows[0]?.ganancia||0) - totalGastos30,
        },
        last90days: stats90.rows[0],
        expensesByCategory: expenseStats.rows,
        expensesHistorical: expensesAll.rows,
        totalGastos: totalGastosAll,
        recentPayments: recentPayments.rows,
        operatorCosts: operatorCosts.rows,
        accounts: accounts.rows,
        fxRate,
      },
      whatsapp: {
        byMode: waStats.rows,
        recentConversations: recentConvs.rows,
        waiting: Number(waStats.rows.find(r=>r.mode==="waiting_operator")?.count||0),
        withOperator: Number(waStats.rows.find(r=>r.mode==="operator")?.count||0),
        bot: Number(waStats.rows.find(r=>r.mode==="bot")?.count||0),
        totalUnread: waStats.rows.reduce((a,r)=>a+Number(r.unread||0),0),
        sinLeer: waStats.rows.reduce((a,r)=>a+Number(r.unread||0),0),
      }
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});
