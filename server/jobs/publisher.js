"use strict";

const cron = require("node-cron");
const db = require("../db");
const { IG_USER_ID } = require("../lib/meta-config");

const GRAPH = "https://graph.facebook.com/v21.0";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_DEFAULT_MS = 120 * 1000;
const POLL_TIMEOUT_REEL_MS = 5 * 60 * 1000;
const TICK_BATCH_SIZE = 5;
const MAX_ATTEMPTS = 3;

function mockMode() {
  const v = String(process.env.IG_PUBLISHER_MOCK || "").toLowerCase();
  if (v === "fail") return "fail";
  if (v === "true" || v === "1" || v === "success") return "success";
  return null;
}

// Wrapper sobre fetch que respeta IG_PUBLISHER_MOCK para poder testear sin token real.
// MOCK SOLO se activa si IG_PUBLISHER_MOCK={true|fail}; en producción debe quedar vacío.
async function igFetch(url, options = {}) {
  const mode = mockMode();
  if (mode === "fail") {
    throw new Error("[IG_PUBLISHER_MOCK=fail] simulated IG fetch failure");
  }
  if (mode === "success") {
    if (url.includes("/media_publish")) {
      return { id: "mock_media_" + Date.now() };
    }
    if (/[?&]fields=status_code/.test(url)) {
      return { status_code: "FINISHED" };
    }
    return { id: "mock_creation_" + Math.floor(Math.random() * 1e9) };
  }
  const res = await fetch(url, options);
  let data = {};
  try { data = await res.json(); } catch { /* noop */ }
  if (!res.ok) {
    const detail = data?.error?.message || JSON.stringify(data).slice(0, 300);
    throw new Error(`IG API ${res.status}: ${detail}`);
  }
  return data;
}

const { getIgToken } = require("../lib/ig-token");

async function igAccessToken() {
  return await getIgToken();
}

async function createContainer(params) {
  const token = await igAccessToken();
  const body = { ...params, access_token: token };
  const data = await igFetch(`${GRAPH}/${IG_USER_ID}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!data?.id) throw new Error("Container sin id en respuesta IG");
  return String(data.id);
}

async function waitContainerReady(creationId, { timeoutMs = POLL_TIMEOUT_DEFAULT_MS } = {}) {
  const token = await igAccessToken();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const url = `${GRAPH}/${creationId}?fields=status_code&access_token=${encodeURIComponent(token)}`;
    const data = await igFetch(url, { method: "GET" });
    const status = data?.status_code;
    if (status === "FINISHED") return true;
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(`Container ${creationId} status=${status}`);
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`Container ${creationId} no llegó a FINISHED en ${timeoutMs}ms`);
}

async function publishContainer(creationId) {
  const token = await igAccessToken();
  const data = await igFetch(`${GRAPH}/${IG_USER_ID}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: creationId, access_token: token }),
  });
  if (!data?.id) throw new Error("media_publish sin id en respuesta IG");
  return String(data.id);
}

async function publishToInstagram(post) {
  const { kind, caption, media_urls } = post;
  if (!Array.isArray(media_urls) || media_urls.length === 0) {
    throw new Error("media_urls vacío");
  }

  let creationId;
  let timeoutMs = POLL_TIMEOUT_DEFAULT_MS;

  if (kind === "image") {
    creationId = await createContainer({
      image_url: media_urls[0],
      caption: caption || "",
    });
  } else if (kind === "reel") {
    timeoutMs = POLL_TIMEOUT_REEL_MS;
    creationId = await createContainer({
      media_type: "REELS",
      video_url: media_urls[0],
      caption: caption || "",
    });
  } else if (kind === "story_image") {
    creationId = await createContainer({
      media_type: "STORIES",
      image_url: media_urls[0],
    });
  } else if (kind === "story_video") {
    timeoutMs = POLL_TIMEOUT_REEL_MS;
    creationId = await createContainer({
      media_type: "STORIES",
      video_url: media_urls[0],
    });
  } else if (kind === "carousel") {
    if (media_urls.length < 2 || media_urls.length > 10) {
      throw new Error("carousel requiere entre 2 y 10 medios");
    }
    const childIds = [];
    for (const url of media_urls) {
      const isVideo = /\.(mp4|mov)(\?|$)/i.test(url);
      const childId = await createContainer(
        isVideo
          ? { media_type: "VIDEO", video_url: url, is_carousel_item: true }
          : { image_url: url, is_carousel_item: true }
      );
      childIds.push(childId);
    }
    creationId = await createContainer({
      media_type: "CAROUSEL",
      caption: caption || "",
      children: childIds.join(","),
    });
  } else {
    throw new Error(`kind no soportado: ${kind}`);
  }

  // Marca el creation_id en DB para visibilidad mientras polleamos
  await db.query(
    `UPDATE ig_scheduled_posts SET ig_creation_id = $1 WHERE id = $2`,
    [creationId, post.id]
  );

  await waitContainerReady(creationId, { timeoutMs });
  const mediaId = await publishContainer(creationId);
  return { ig_creation_id: creationId, ig_media_id: mediaId };
}

let tickRunning = false;

async function tickPublisher() {
  if (tickRunning) {
    return { processed: 0, skipped: "already_running" };
  }
  tickRunning = true;
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let retried = 0;
  try {
    const candidates = await db.query(
      `SELECT id FROM ig_scheduled_posts
         WHERE status = 'pending' AND scheduled_at <= NOW() AND attempts < $1
         ORDER BY scheduled_at ASC
         LIMIT $2`,
      [MAX_ATTEMPTS, TICK_BATCH_SIZE]
    );

    for (const row of candidates.rows) {
      // lock optimista
      const locked = await db.query(
        `UPDATE ig_scheduled_posts
           SET status = 'publishing'
         WHERE id = $1 AND status = 'pending'
         RETURNING *`,
        [row.id]
      );
      const post = locked.rows[0];
      if (!post) continue; // otro proceso lo tomó

      processed++;
      try {
        const { ig_creation_id, ig_media_id } = await publishToInstagram(post);
        await db.query(
          `UPDATE ig_scheduled_posts
             SET status = 'published',
                 ig_creation_id = COALESCE($1, ig_creation_id),
                 ig_media_id = $2,
                 published_at = NOW(),
                 last_error = NULL
           WHERE id = $3`,
          [ig_creation_id, ig_media_id, post.id]
        );
        // Si venía de una idea aprobada, marcarla published
        if (post.idea_id) {
          await db.query(
            `UPDATE ig_content_ideas SET status = 'published'
              WHERE id = $1 AND status IN ('approved','scheduled')`,
            [post.idea_id]
          );
        }
        succeeded++;
        console.log(`[IG-PUBLISHER] post ${post.id} publicado → media_id=${ig_media_id}`);
      } catch (e) {
        const newAttempts = (post.attempts || 0) + 1;
        const willFail = newAttempts >= MAX_ATTEMPTS;
        await db.query(
          `UPDATE ig_scheduled_posts
             SET status = $1,
                 attempts = $2,
                 last_error = $3
           WHERE id = $4`,
          [willFail ? "failed" : "pending", newAttempts, String(e.message || e).slice(0, 1000), post.id]
        );
        if (willFail) failed++; else retried++;
        console.warn(`[IG-PUBLISHER] post ${post.id} falló (attempt ${newAttempts}/${MAX_ATTEMPTS}): ${e.message}`);
      }
    }
  } finally {
    tickRunning = false;
  }
  return { processed, succeeded, failed, retried };
}

let cronTask = null;
function startPublisherCron() {
  if (cronTask) return cronTask;
  cronTask = cron.schedule(
    "* * * * *",
    async () => {
      try {
        const out = await tickPublisher();
        if (out.processed > 0) console.log("[IG-PUBLISHER cron]", out);
      } catch (e) {
        console.error("[IG-PUBLISHER cron ERROR]", e.message);
      }
    },
    { timezone: "America/Argentina/Buenos_Aires" }
  );
  return cronTask;
}

module.exports = {
  publishToInstagram,
  waitContainerReady,
  tickPublisher,
  startPublisherCron,
};
