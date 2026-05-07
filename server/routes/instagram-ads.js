"use strict";
const express = require("express");
const router = express.Router();
const db = require("../db");
const { authRequired, requireRole } = require("../auth");
const {
  getMetaUserToken,
  setMetaUserToken,
  getDefaultAdAccountId,
  setDefaultAdAccountId,
  getMetaPageId,
  setMetaPageId,
  healthcheckMetaUserToken,
} = require("../lib/meta-token");
const { IG_USER_ID } = require("../lib/meta-config");

const GRAPH = "https://graph.facebook.com/v21.0";

let _schemaReady = false;
async function ensureAdsSchema() {
  if (_schemaReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS ig_ad_campaigns (
      id SERIAL PRIMARY KEY,
      campaign_id TEXT UNIQUE NOT NULL,
      adset_id TEXT,
      ad_id TEXT,
      creative_id TEXT,
      ad_account_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      objective TEXT,
      daily_budget_minor BIGINT,
      ig_media_id TEXT,
      link_url TEXT,
      name TEXT,
      status TEXT DEFAULT 'PAUSED',
      created_by_user_id INTEGER,
      meta JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS ig_ad_campaigns_created_by_idx ON ig_ad_campaigns(created_by_user_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS ig_ad_campaigns_kind_idx ON ig_ad_campaigns(kind)`);
  _schemaReady = true;
}

async function recordCampaign(row) {
  try {
    await ensureAdsSchema();
    await db.query(
      `INSERT INTO ig_ad_campaigns
        (campaign_id, adset_id, ad_id, creative_id, ad_account_id, kind, objective,
         daily_budget_minor, ig_media_id, link_url, name, status, created_by_user_id, meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (campaign_id) DO UPDATE SET
         adset_id = EXCLUDED.adset_id,
         ad_id = EXCLUDED.ad_id,
         creative_id = EXCLUDED.creative_id,
         status = EXCLUDED.status,
         updated_at = NOW()`,
      [
        row.campaign_id,
        row.adset_id || null,
        row.ad_id || null,
        row.creative_id || null,
        row.ad_account_id,
        row.kind,
        row.objective || null,
        row.daily_budget_minor || null,
        row.ig_media_id || null,
        row.link_url || null,
        row.name || null,
        row.status || "PAUSED",
        row.created_by_user_id || null,
        row.meta ? JSON.stringify(row.meta) : "{}",
      ]
    );
  } catch (e) {
    console.error("[ig-ads] recordCampaign failed:", e.message);
  }
}

async function graphGET(path, params = {}) {
  const tok = await getMetaUserToken();
  if (!tok) throw Object.assign(new Error("meta_user_token no configurado"), { status: 503 });
  const url = new URL(`${GRAPH}${path.startsWith("/") ? "" : "/"}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  url.searchParams.set("access_token", tok);
  const r = await fetch(url.toString());
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.error) {
    const err = new Error(j?.error?.message || `Graph API error ${r.status}`);
    err.status = r.status >= 400 ? r.status : 400;
    err.meta = j?.error || {};
    throw err;
  }
  return j;
}

async function graphPOST(path, body = {}) {
  const tok = await getMetaUserToken();
  if (!tok) throw Object.assign(new Error("meta_user_token no configurado"), { status: 503 });
  const url = `${GRAPH}${path.startsWith("/") ? "" : "/"}${path}`;
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined && v !== null) {
      form.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    }
  }
  form.set("access_token", tok);
  const r = await fetch(url, { method: "POST", body: form });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.error) {
    const err = new Error(j?.error?.message || `Graph API error ${r.status}`);
    err.status = r.status >= 400 ? r.status : 400;
    err.meta = j?.error || {};
    throw err;
  }
  return j;
}

// ─────────────────────────────────────────────────────────────────────────────
// Token & config admin
// ─────────────────────────────────────────────────────────────────────────────

router.get("/token/user/status", authRequired, requireRole(["admin"], "instagram"), async (_req, res) => {
  try {
    const info = await healthcheckMetaUserToken();
    const adAccount = await getDefaultAdAccountId();
    const pageId = await getMetaPageId();
    res.json({ ok: true, info, default_ad_account_id: adAccount, page_id: pageId });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

router.post("/token/user", authRequired, requireRole(["admin"], "instagram"), async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token || typeof token !== "string") return res.status(400).json({ error: "token requerido" });
    await setMetaUserToken(token);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

router.post("/ad-account", authRequired, requireRole(["admin"], "instagram"), async (req, res) => {
  try {
    const { ad_account_id } = req.body || {};
    if (!ad_account_id) return res.status(400).json({ error: "ad_account_id requerido" });
    await setDefaultAdAccountId(ad_account_id);
    res.json({ ok: true, ad_account_id });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

router.get("/page-id", authRequired, requireRole(["operator","admin"], "instagram"), async (_req, res) => {
  try {
    res.json({ page_id: await getMetaPageId() });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

router.post("/page-id", authRequired, requireRole(["admin"], "instagram"), async (req, res) => {
  try {
    const { page_id } = req.body || {};
    if (!page_id) return res.status(400).json({ error: "page_id requerido" });
    await setMetaPageId(String(page_id));
    res.json({ ok: true, page_id });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Listados (read-only)
// ─────────────────────────────────────────────────────────────────────────────

router.get("/accounts", authRequired, requireRole(["operator","admin"], "instagram"), async (_req, res) => {
  try {
    const j = await graphGET("/me/adaccounts", {
      fields: "id,name,currency,timezone_name,account_status,amount_spent,balance,disable_reason",
    });
    res.json({ accounts: j.data || [] });
  } catch (e) {
    res.status(e.status || 500).json({ error: String(e?.message || e), meta: e.meta });
  }
});

router.get("/campaigns", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    const adAccount = req.query.ad_account_id || (await getDefaultAdAccountId());
    if (!adAccount) return res.status(400).json({ error: "ad_account_id no configurado" });
    const j = await graphGET(`/${adAccount}/campaigns`, {
      fields: "id,name,status,effective_status,objective,buying_type,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time,special_ad_categories",
      limit: 50,
    });
    res.json({ ad_account_id: adAccount, campaigns: j.data || [] });
  } catch (e) {
    res.status(e.status || 500).json({ error: String(e?.message || e), meta: e.meta });
  }
});

// IMPORTANTE: /campaigns/local debe ir ANTES de /campaigns/:id para no ser
// interceptado por el matcher con :id="local".
router.get("/campaigns/local", authRequired, requireRole(["operator","admin"], "instagram"), async (_req, res) => {
  try {
    await ensureAdsSchema();
    const { rows } = await db.query(
      `SELECT c.id, c.campaign_id, c.adset_id, c.ad_id, c.creative_id, c.ad_account_id,
              c.kind, c.objective, c.daily_budget_minor, c.ig_media_id, c.link_url,
              c.name, c.status, c.created_at, c.updated_at,
              c.created_by_user_id, u.email AS created_by_email
         FROM ig_ad_campaigns c
         LEFT JOIN users u ON u.id = c.created_by_user_id
        ORDER BY c.created_at DESC
        LIMIT 100`
    );
    res.json({ campaigns: rows });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// POST /campaigns/archive-expired
// Archiva en Meta todas las campañas con status=ACTIVE y stop_time vencido.
// body: { ad_account_id?, dry_run?: bool (default true) }
router.post("/campaigns/archive-expired", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    const { ad_account_id, dry_run = true } = req.body || {};
    const adAccount = ad_account_id || (await getDefaultAdAccountId());
    if (!adAccount) return res.status(400).json({ error: "ad_account_id no configurado" });

    const j = await graphGET(`/${adAccount}/campaigns`, {
      fields: "id,name,status,effective_status,stop_time",
      limit: 200,
    });
    const all = j.data || [];
    const now = new Date();
    const expired = all.filter(c =>
      c.status === "ACTIVE" && c.stop_time && new Date(c.stop_time) < now
    );

    if (dry_run) {
      return res.json({
        ok: true,
        dry_run: true,
        ad_account_id: adAccount,
        scanned: all.length,
        would_archive: expired.length,
        campaigns: expired.map(c => ({ id: c.id, name: c.name, stop_time: c.stop_time })),
      });
    }

    const results = [];
    for (const c of expired) {
      let finalStatus = null;
      let lastErr = null;
      for (const tryStatus of ["ARCHIVED", "PAUSED"]) {
        try {
          await graphPOST(`/${c.id}`, { status: tryStatus });
          finalStatus = tryStatus;
          break;
        } catch (e) {
          lastErr = String(e?.message || e);
        }
      }
      if (finalStatus) {
        results.push({ id: c.id, name: c.name, ok: true, status: finalStatus });
        try {
          await db.query(
            `UPDATE ig_ad_campaigns SET status=$2, updated_at=NOW() WHERE campaign_id=$1`,
            [c.id, finalStatus]
          );
        } catch {}
      } else {
        results.push({ id: c.id, name: c.name, ok: false, error: lastErr });
      }
    }
    res.json({
      ok: true,
      dry_run: false,
      ad_account_id: adAccount,
      scanned: all.length,
      archived: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
      results,
    });
  } catch (e) {
    res.status(e.status || 500).json({ error: String(e?.message || e), meta: e.meta });
  }
});

router.get("/campaigns/:id", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    const j = await graphGET(`/${req.params.id}`, {
      fields: "id,name,status,effective_status,objective,buying_type,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time",
    });
    res.json(j);
  } catch (e) {
    res.status(e.status || 500).json({ error: String(e?.message || e), meta: e.meta });
  }
});

router.get("/campaigns/:id/insights", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    const datePreset = req.query.date_preset || "last_30d";
    const j = await graphGET(`/${req.params.id}/insights`, {
      fields: "impressions,reach,clicks,spend,cpm,cpc,ctr,frequency,actions,cost_per_action_type",
      date_preset: datePreset,
    });
    res.json({ insights: j.data || [] });
  } catch (e) {
    res.status(e.status || 500).json({ error: String(e?.message || e), meta: e.meta });
  }
});

router.get("/insights", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    const adAccount = req.query.ad_account_id || (await getDefaultAdAccountId());
    if (!adAccount) return res.status(400).json({ error: "ad_account_id no configurado" });
    const datePreset = req.query.date_preset || "last_30d";
    const j = await graphGET(`/${adAccount}/insights`, {
      fields: "impressions,reach,clicks,spend,cpm,cpc,ctr,frequency",
      date_preset: datePreset,
    });
    res.json({ ad_account_id: adAccount, insights: j.data || [] });
  } catch (e) {
    res.status(e.status || 500).json({ error: String(e?.message || e), meta: e.meta });
  }
});

router.get("/campaigns/:id/adsets", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    const j = await graphGET(`/${req.params.id}/adsets`, {
      fields: "id,name,status,effective_status,daily_budget,lifetime_budget,billing_event,optimization_goal,bid_strategy,start_time,end_time,targeting",
      limit: 50,
    });
    res.json({ adsets: j.data || [] });
  } catch (e) {
    res.status(e.status || 500).json({ error: String(e?.message || e), meta: e.meta });
  }
});

router.get("/adsets/:id/ads", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    const j = await graphGET(`/${req.params.id}/ads`, {
      fields: "id,name,status,effective_status,creative,preview_shareable_link,created_time",
      limit: 50,
    });
    res.json({ ads: j.data || [] });
  } catch (e) {
    res.status(e.status || 500).json({ error: String(e?.message || e), meta: e.meta });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Mutaciones (pausar/reactivar)
// ─────────────────────────────────────────────────────────────────────────────

router.patch("/campaigns/:id/status", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["ACTIVE","PAUSED"].includes(status)) {
      return res.status(400).json({ error: "status debe ser ACTIVE o PAUSED" });
    }
    const j = await graphPOST(`/${req.params.id}`, { status });
    res.json({ ok: true, result: j });
  } catch (e) {
    res.status(e.status || 500).json({ error: String(e?.message || e), meta: e.meta });
  }
});

router.patch("/adsets/:id/status", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["ACTIVE","PAUSED"].includes(status)) {
      return res.status(400).json({ error: "status debe ser ACTIVE o PAUSED" });
    }
    const j = await graphPOST(`/${req.params.id}`, { status });
    res.json({ ok: true, result: j });
  } catch (e) {
    res.status(e.status || 500).json({ error: String(e?.message || e), meta: e.meta });
  }
});

router.patch("/ads/:id/status", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["ACTIVE","PAUSED"].includes(status)) {
      return res.status(400).json({ error: "status debe ser ACTIVE o PAUSED" });
    }
    const j = await graphPOST(`/${req.params.id}`, { status });
    res.json({ ok: true, result: j });
  } catch (e) {
    res.status(e.status || 500).json({ error: String(e?.message || e), meta: e.meta });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Promover post de IG existente (boost)
// ─────────────────────────────────────────────────────────────────────────────

router.get("/posts/promotable", authRequired, requireRole(["operator","admin"], "instagram"), async (_req, res) => {
  try {
    const j = await graphGET(`/${IG_USER_ID}/media`, {
      fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
      limit: 25,
    });
    res.json({ posts: j.data || [] });
  } catch (e) {
    res.status(e.status || 500).json({ error: String(e?.message || e), meta: e.meta });
  }
});

// POST /promote-post
// Crea Campaign → AdSet → AdCreative → Ad (todo en PAUSED) para boost de post IG existente.
// body: {
//   ig_media_id (req), daily_budget (req, en moneda mayor ej 1500 ARS),
//   days = 7, link_url = permalink IG,
//   countries = ["AR"], age_min = 18, age_max = 65,
//   objective = "OUTCOME_TRAFFIC" | "OUTCOME_ENGAGEMENT" | "OUTCOME_AWARENESS",
//   ad_account_id (opcional, default = configurado)
// }
router.post("/promote-post", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  const created = {};
  try {
    const {
      ig_media_id,
      daily_budget,
      days = 7,
      link_url,
      countries = ["AR"],
      age_min = 18,
      age_max = 65,
      objective = "OUTCOME_TRAFFIC",
      call_to_action = "LEARN_MORE",
      ad_account_id,
    } = req.body || {};

    if (!ig_media_id) return res.status(400).json({ error: "ig_media_id requerido" });
    if (!daily_budget || Number(daily_budget) <= 0) {
      return res.status(400).json({ error: "daily_budget (> 0) requerido" });
    }
    const adAccount = ad_account_id || (await getDefaultAdAccountId());
    if (!adAccount) return res.status(400).json({ error: "ad_account_id no configurado" });
    const pageId = await getMetaPageId();
    const igUserId = IG_USER_ID;

    // Optimization goal según objective
    const OPT_GOAL = {
      OUTCOME_TRAFFIC: "LINK_CLICKS",
      OUTCOME_ENGAGEMENT: "POST_ENGAGEMENT",
      OUTCOME_AWARENESS: "REACH",
    };
    const optGoal = OPT_GOAL[objective] || "LINK_CLICKS";
    const validObjectives = Object.keys(OPT_GOAL);
    if (!validObjectives.includes(objective)) {
      return res.status(400).json({ error: `objective debe ser uno de ${validObjectives.join(", ")}` });
    }

    // 1) Resolver permalink. Meta con System User token acepta el V2 id (el
    // mismo `id` que devuelve /{ig_user}/media) directo como
    // source_instagram_media_id; el ig_id legacy NO funciona con este token.
    const mediaInfo = await graphGET(`/${ig_media_id}`, { fields: "ig_id,permalink,media_type,caption" });
    const igIdNumeric = ig_media_id;
    const permalink = link_url || mediaInfo.permalink;

    // Budget: API espera la unidad menor (cents). ARS no usa decimales en práctica
    // pero la API igual usa la convención: 1 ARS = 100.
    const dailyBudgetMinor = Math.round(Number(daily_budget) * 100);

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + Number(days) * 24 * 60 * 60 * 1000);
    const baseName = `Boost ${ig_media_id.slice(-8)} ${startTime.toISOString().slice(0, 10)}`;

    // 2) Campaign
    const campaign = await graphPOST(`/${adAccount}/campaigns`, {
      name: `${baseName} — Campaign`,
      objective,
      status: "PAUSED",
      special_ad_categories: [],
      buying_type: "AUCTION",
      is_adset_budget_sharing_enabled: false,
    });
    created.campaign_id = campaign.id;

    // 3) AdSet
    const targeting = {
      geo_locations: { countries: Array.isArray(countries) ? countries : [countries] },
      age_min: Number(age_min),
      age_max: Number(age_max),
      publisher_platforms: ["instagram"],
      instagram_positions: ["stream", "story", "explore", "reels"],
      targeting_automation: { advantage_audience: 0 },
    };
    const adset = await graphPOST(`/${adAccount}/adsets`, {
      name: `${baseName} — AdSet`,
      campaign_id: campaign.id,
      daily_budget: dailyBudgetMinor,
      billing_event: "IMPRESSIONS",
      optimization_goal: optGoal,
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      status: "PAUSED",
    });
    created.adset_id = adset.id;

    // 4) AdCreative usando source_instagram_media_id (forma oficial para boost de IG).
    // - object_story_spec junto con source_instagram_media_id → error_subcode 1487929 ("ambiguous").
    // - OUTCOME_TRAFFIC sin call_to_action → error_subcode 2446383 ("se requiere CTA").
    //   Por eso CTA va top-level solo cuando el objective lo exige.
    const creativeBody = {
      name: `${baseName} — Creative`,
      source_instagram_media_id: igIdNumeric,
    };
    if (objective === "OUTCOME_TRAFFIC") {
      creativeBody.call_to_action = { type: call_to_action, value: { link: permalink } };
    }
    const creative = await graphPOST(`/${adAccount}/adcreatives`, creativeBody);
    created.creative_id = creative.id;

    // 5) Ad
    const ad = await graphPOST(`/${adAccount}/ads`, {
      name: `${baseName} — Ad`,
      adset_id: adset.id,
      creative: { creative_id: creative.id },
      status: "PAUSED",
    });
    created.ad_id = ad.id;

    await recordCampaign({
      campaign_id: campaign.id,
      adset_id: adset.id,
      ad_id: ad.id,
      creative_id: creative.id,
      ad_account_id: adAccount,
      kind: "promote_post",
      objective,
      daily_budget_minor: dailyBudgetMinor,
      ig_media_id,
      link_url: permalink,
      name: baseName,
      status: "PAUSED",
      created_by_user_id: req.user?.id || null,
      meta: { ig_id_numeric: igIdNumeric, days, countries, age_min, age_max },
    });

    res.json({
      ok: true,
      ad_account_id: adAccount,
      ig_media_id,
      ig_id_numeric: igIdNumeric,
      permalink,
      ...created,
      hint: "Todo creado en PAUSED. Activá la campaña desde el panel para que empiece a correr.",
    });
  } catch (e) {
    res.status(e.status || 500).json({
      error: String(e?.message || e),
      meta: e.meta,
      partial: created,
      hint: "Si quedaron objetos creados parcialmente (campaign/adset/creative), borralos manualmente o pausá la campaña.",
    });
  }
});

// POST /campaigns/create
// Wizard a partir de un post de IG existente (sin subir imagen — la app no
// tiene capability /adimages aprobada). Permite override de targeting, CTA,
// link de destino y nombre custom de campaña.
// body: {
//   ig_media_id (req), name (req),
//   daily_budget (req), days = 7,
//   countries = ["AR"], age_min = 18, age_max = 65,
//   objective = "OUTCOME_TRAFFIC",
//   call_to_action = "LEARN_MORE",
//   link_url (opcional, default = permalink del post),
//   ad_account_id (opcional)
// }
router.post("/campaigns/create", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  const created = {};
  try {
    const {
      ig_media_id,
      name,
      link_url,
      daily_budget,
      days = 7,
      countries = ["AR"],
      age_min = 18,
      age_max = 65,
      objective = "OUTCOME_TRAFFIC",
      call_to_action = "LEARN_MORE",
      ad_account_id,
    } = req.body || {};

    if (!ig_media_id) return res.status(400).json({ error: "ig_media_id requerido — elegí un post de IG existente" });
    if (!name) return res.status(400).json({ error: "name requerido" });
    if (!daily_budget || Number(daily_budget) <= 0) {
      return res.status(400).json({ error: "daily_budget (> 0) requerido" });
    }

    const adAccount = ad_account_id || (await getDefaultAdAccountId());
    if (!adAccount) return res.status(400).json({ error: "ad_account_id no configurado" });
    const pageId = await getMetaPageId();
    if (!pageId) return res.status(400).json({ error: "meta_page_id no configurado" });
    const igUserId = IG_USER_ID;

    const OPT_GOAL = {
      OUTCOME_TRAFFIC: "LINK_CLICKS",
      OUTCOME_ENGAGEMENT: "POST_ENGAGEMENT",
      OUTCOME_AWARENESS: "REACH",
    };
    const optGoal = OPT_GOAL[objective] || "LINK_CLICKS";
    if (!OPT_GOAL[objective]) {
      return res.status(400).json({ error: `objective debe ser uno de ${Object.keys(OPT_GOAL).join(", ")}` });
    }

    const VALID_CTA = new Set([
      "LEARN_MORE","SHOP_NOW","SIGN_UP","CONTACT_US","SUBSCRIBE",
      "DOWNLOAD","BOOK_TRAVEL","GET_QUOTE","APPLY_NOW","ORDER_NOW","SEND_MESSAGE",
    ]);
    if (!VALID_CTA.has(call_to_action)) {
      return res.status(400).json({ error: `call_to_action inválido` });
    }

    // Resolver permalink (informativo). Con System User token, Meta acepta el
    // V2 id (el `id` que devuelve /{ig_user}/media) directo como
    // source_instagram_media_id. El ig_id legacy NO funciona con este token.
    const mediaInfo = await graphGET(`/${ig_media_id}`, { fields: "ig_id,permalink,media_type,caption" });
    const igIdNumeric = ig_media_id;
    const permalink = link_url || mediaInfo.permalink;

    const dailyBudgetMinor = Math.round(Number(daily_budget) * 100);
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + Number(days) * 24 * 60 * 60 * 1000);
    const dateTag = startTime.toISOString().slice(0, 10);

    // 1) Campaign
    const campaign = await graphPOST(`/${adAccount}/campaigns`, {
      name: `${name} — Campaign (${dateTag})`,
      objective,
      status: "PAUSED",
      special_ad_categories: [],
      buying_type: "AUCTION",
      is_adset_budget_sharing_enabled: false,
    });
    created.campaign_id = campaign.id;

    // 2) AdSet
    const targeting = {
      geo_locations: { countries: Array.isArray(countries) ? countries : [countries] },
      age_min: Number(age_min),
      age_max: Number(age_max),
      publisher_platforms: ["instagram"],
      instagram_positions: ["stream", "story", "explore", "reels"],
      targeting_automation: { advantage_audience: 0 },
    };
    const adset = await graphPOST(`/${adAccount}/adsets`, {
      name: `${name} — AdSet`,
      campaign_id: campaign.id,
      daily_budget: dailyBudgetMinor,
      billing_event: "IMPRESSIONS",
      optimization_goal: optGoal,
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      status: "PAUSED",
    });
    created.adset_id = adset.id;

    // 3) AdCreative usando el post de IG como fuente.
    // - object_story_spec con source_instagram_media_id → error_subcode 1487929.
    // - OUTCOME_TRAFFIC requiere call_to_action top-level → error_subcode 2446383.
    const creativeBody = {
      name: `${name} — Creative`,
      source_instagram_media_id: igIdNumeric,
    };
    if (objective === "OUTCOME_TRAFFIC") {
      creativeBody.call_to_action = { type: call_to_action, value: { link: permalink } };
    }
    const creative = await graphPOST(`/${adAccount}/adcreatives`, creativeBody);
    created.creative_id = creative.id;

    // 4) Ad
    const ad = await graphPOST(`/${adAccount}/ads`, {
      name: `${name} — Ad`,
      adset_id: adset.id,
      creative: { creative_id: creative.id },
      status: "PAUSED",
    });
    created.ad_id = ad.id;

    await recordCampaign({
      campaign_id: campaign.id,
      adset_id: adset.id,
      ad_id: ad.id,
      creative_id: creative.id,
      ad_account_id: adAccount,
      kind: "wizard_post",
      objective,
      daily_budget_minor: dailyBudgetMinor,
      ig_media_id,
      link_url: permalink,
      name,
      status: "PAUSED",
      created_by_user_id: req.user?.id || null,
      meta: { ig_id_numeric: igIdNumeric, call_to_action, days, countries, age_min, age_max },
    });

    res.json({
      ok: true,
      ad_account_id: adAccount,
      kind: "wizard_post",
      ig_media_id,
      ig_id_numeric: igIdNumeric,
      permalink,
      ...created,
      hint: "Todo creado en PAUSED. Revisá el creative y activá la campaña desde el panel.",
    });
  } catch (e) {
    res.status(e.status || 500).json({
      error: String(e?.message || e),
      meta: e.meta,
      partial: created,
      hint: "Si quedaron objetos creados parcialmente, borralos desde Ads Manager o dejalos en PAUSED.",
    });
  }
});

// ─── CLAWFU SKILLS — generación de ad creative con frameworks ────────────────
const { loadSkill: _loadSkillAds, findSkillsForObjective: _findSkillsAds, buildSkillsPrompt: _buildSkillsPromptAds } = require("../lib/clawfu");
const { askClaude: _askClaudeAds } = require("../lib/claude");

const _ADS_AI_KEY = process.env.AI_API_KEY || null;
function _requireAIKeyAds(req, res, next) {
  const key = req.headers["x-ai-api-key"] || req.query._key;
  if (!_ADS_AI_KEY || key !== _ADS_AI_KEY) return res.status(403).json({ error: "Invalid API key" });
  next();
}

const ADS_BRAND_PROMPT = `Sos copywriter senior de Lemon's Logística Internacional (Argentina), especializado en Meta Ads.

Lemon's:
- Courier puerta a puerta desde China (15-25 días), USA (7-12 días), Europa (10-18 días).
- Asesoramiento aduanero, importación con o sin CUIT.
- Compras asistidas en Amazon, AliExpress, Alibaba, eBay, Shein, Temu.

Tono: argentino, directo, profesional. Usá vos. Headlines cortos y punzantes. Primary text apunta al dolor real.`;

async function runAdCreativeGenerator(body, res) {
  try {
    const {
      producto,
      oferta = "",
      audiencia = "emprendedores argentinos que importan productos",
      dolor = "",
      objetivo = "venta directa",
      skill_names,
      lang,
    } = body || {};

    if (!producto || typeof producto !== "string") return res.status(400).json({ error: "producto requerido (string)" });

    let skills = [];
    if (Array.isArray(skill_names) && skill_names.length) {
      skills = skill_names.map(n => _loadSkillAds(n, lang || null)).filter(Boolean);
    }
    if (!skills.length) {
      const objCombined = `${objetivo} ${producto} ${dolor} ${oferta}`.trim();
      skills = _findSkillsAds(objCombined, 4, ["acquisition", "content", "funnels", "growth"], lang || null);
    }

    const systemPrompt = ADS_BRAND_PROMPT + _buildSkillsPromptAds(skills) +
      `\n\nFormato de output: SOLO JSON válido sin markdown ni texto extra. Schema: { "headline": string, "primary_text": string, "description": string, "cta": string, "visual_brief": string, "variants": string[] }.`;

    const userMessage = `Generá creative para Meta Ads.\nProducto: ${producto}\nOferta: ${oferta || "(sin oferta específica)"}\nAudiencia: ${audiencia}\nDolor del cliente: ${dolor || "(no especificado)"}\nObjetivo: ${objetivo}\n\nDevolvé JSON con: { headline (≤40 chars), primary_text (texto principal del ad, hasta 125 chars idealmente), description (line link), cta (botón sugerido — Shop Now / Learn More / Sign Up / etc.), visual_brief (descripción concreta de la imagen ideal con foco en problema-solución), variants (array de 3 alternativas del primary_text para A/B testing) }.`;

    const { text } = await _askClaudeAds({
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      max_tokens: 2000,
    });

    let generated = null;
    let parseWarning = null;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      generated = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch (e) {
      parseWarning = "JSON inválido en respuesta de Claude — devuelvo raw text";
      generated = { raw: text };
    }

    res.json({
      ok: true,
      generated,
      skills_used: skills.map(s => ({
        name: s.name,
        category: s.category,
        description: s.description,
        ...(s.name_es ? { name_es: s.name_es } : {}),
        ...(s.description_es ? { description_es: s.description_es } : {}),
        ...(s.category_es ? { category_es: s.category_es } : {}),
      })),
      ...(parseWarning ? { warning: parseWarning } : {}),
    });
  } catch (e) {
    console.error("[generate-ad-creative ERROR]", e.message);
    res.status(500).json({ error: e.message || "Error generando creative" });
  }
}

router.post("/generate-ad-creative", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  await runAdCreativeGenerator(req.body, res);
});

router.post("/ai/generate-ad-creative", _requireAIKeyAds, async (req, res) => {
  await runAdCreativeGenerator(req.body, res);
});

module.exports = router;
