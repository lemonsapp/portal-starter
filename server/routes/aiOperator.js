const express = require("express");
const router = express.Router();

// ── Deduplicación de mensajes ─────────────────────────────────────────────────
const processedMessages = new Set();
function isDuplicate(msgId) {
  if (!msgId) return false;
  if (processedMessages.has(msgId)) return true;
  processedMessages.add(msgId);
  setTimeout(() => processedMessages.delete(msgId), 5 * 60 * 1000);
  return false;
}

// ── Cooldown notificaciones al operador ───────────────────────────────────────
const operatorNotifCooldown = new Map();
function canNotifyOperator(phone) {
  const last = operatorNotifCooldown.get(phone);
  const now = Date.now();
  if (last && now - last < 60 * 1000) return false; // 1 minuto de cooldown
  operatorNotifCooldown.set(phone, now);
  setTimeout(() => operatorNotifCooldown.delete(phone), 60 * 1000);
  return true;
}
const db = require("../db");

const OPERATOR_PHONE = "5491126497979";
const APP_URL = String(process.env.APP_URL || "https://api.lemonsarg.com").replace(/\/$/, "");
const AI_WRITE_URL = `${APP_URL}/api/ai/write/shipment`;

const PUBLIC_RATES = {
  USA_NORMAL: 45,
  USA_EXPRESS: 55,
  CHINA_NORMAL: 58,
  CHINA_EXPRESS: 68,
  EUROPA_NORMAL: 58,
};

const REQUIRED_OPERATOR_FIELDS = [
  "client_number",
  "origin",
  "service",
  "weight_kg",
  "tracking",
  "description",
];

function normalizeText(v) {
  return String(v || "").trim();
}

function normalizePhone(v) {
  return String(v || "").replace(/\D/g, "");
}

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function looksLikeRealPhone(v) {
  const n = normalizePhone(v);
  return n.length >= 10 && n.length <= 15;
}

function upperNoAccents(v) {
  return normalizeText(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function normalizeNameForLabel(name) {
  return upperNoAccents(name).replace(/\s+/g, " ").trim();
}

function normalizeOrigin(v) {
  const s = upperNoAccents(v);
  if (["USA", "US", "U", "MIAMI"].includes(s)) return "USA";
  if (["CHINA", "CN", "CHN"].includes(s)) return "CHINA";
  if (["EUROPA", "EUROPE", "EU", "EUR"].includes(s)) return "EUROPA";
  return null;
}

function normalizeService(v, origin = null) {
  const s0 = upperNoAccents(v).replace(/\s+/g, "_");
  let s = s0;
  if (["NORMAL", "N"].includes(s)) s = "NORMAL";
  if (["EXPRESS", "E"].includes(s)) s = "EXPRESS";
  if (origin === "EUROPA") return "NORMAL";
  return ["NORMAL", "EXPRESS"].includes(s) ? s : null;
}

function parseWeight(v) {
  const raw = normalizeText(v).toLowerCase().replace(",", ".");
  const cleaned = raw.replace("kg", "").replace("kgs", "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function volumeDiscount(kg) {
  const n = Number(kg || 0);
  if (n >= 100) return 7;
  if (n >= 50) return 5;
  if (n >= 10) return 3;
  return 0;
}

function getPublicRate(origin, service) {
  if (origin === "USA" && service === "NORMAL") return PUBLIC_RATES.USA_NORMAL;
  if (origin === "USA" && service === "EXPRESS") return PUBLIC_RATES.USA_EXPRESS;
  if (origin === "CHINA" && service === "NORMAL") return PUBLIC_RATES.CHINA_NORMAL;
  if (origin === "CHINA" && service === "EXPRESS") return PUBLIC_RATES.CHINA_EXPRESS;
  if (origin === "EUROPA") return PUBLIC_RATES.EUROPA_NORMAL;
  return null;
}

function billableWeight(weightKg, chargeRealWeight = false) {
  const w = Number(weightKg);
  if (!Number.isFinite(w) || w <= 0) return null;
  if (chargeRealWeight && w < 1) return w;
  return Math.max(w, 1);
}

function applyVolumeDiscount(rate, billableKg) {
  const r = Number(rate);
  const kg = Number(billableKg);
  if (!Number.isFinite(r) || !Number.isFinite(kg)) return null;

  let discount = 0;
  if (kg >= 100) discount = 7;
  else if (kg >= 50) discount = 5;
  else if (kg >= 10) discount = 3;

  return Number((r - discount).toFixed(2));
}

function computeEstimated(weightKg, finalRate) {
  const w = Number(weightKg);
  const r = Number(finalRate);
  if (!Number.isFinite(w) || !Number.isFinite(r)) return null;
  return Number((w * r).toFixed(2));
}

function estimateQuote(origin, service, weightKg) {
  const normalizedOrigin = normalizeOrigin(origin);
  const normalizedService = normalizeService(service, normalizedOrigin);

  if (!normalizedOrigin || !normalizedService) return null;

  const baseRate = getPublicRate(normalizedOrigin, normalizedService);
  if (!baseRate) return null;

  const billable = billableWeight(weightKg);
  if (!billable) return null;

  const discount = volumeDiscount(billable);
  const finalRate = Number((baseRate - discount).toFixed(2));
  const estimated = computeEstimated(billable, finalRate);

  return {
    base_rate: baseRate,
    volume_discount: discount,
    final_rate: finalRate,
    estimated_usd: estimated
  };
}

function buildPackageCode({ origin, service, clientName, manualCode = null }) {
  if (manualCode) return String(manualCode);
  const name = normalizeNameForLabel(clientName || "CLIENTE");
  if (origin === "CHINA" && service === "NORMAL") return `HY-AUREL-LEMON-${name}`;
  if (origin === "CHINA" && service === "EXPRESS") return `1504-CN-${name}`;
  if (origin === "USA" && service === "EXPRESS") return `1504-U-${name}`;
  if (origin === "USA" && service === "NORMAL") return `IC105/IC/LEMON-${name}`;
  if (origin === "EUROPA") return `LEMONS GROUP - 1CB81842 - ${name}`;
  return `LEMONS-${name}`;
}

function buildLabelCode(origin, service, customerName) {
  return buildPackageCode({ origin, service, clientName: customerName });
}

function buildWelcome() {
  return [
    "Hola 👋 Bienvenido a Lemon's",
    "",
    "Te acompaño para resolver consultas sobre importaciones, envíos internacionales y preparación de carga.",
    "",
    "Elegí cómo querés avanzar:",
    "1️⃣ Ya soy cliente activo",
    "2️⃣ Soy cliente nuevo",
    "",
    'También podés escribir "menú", "cancelar" o "atrás" en cualquier momento.',
  ].join("\n");
}

function buildClientVerifyAsk() {
  return [
    "Perfecto. Para validar tu cuenta pasame estos 2 datos:",
    "",
    "• Número de cliente",
    "• Mail registrado",
    "",
    "Ejemplo:",
    "43",
    "cliente@mail.com",
  ].join("\n");
}

function buildMainMenu() {
  return [
    "Perfecto. Elegí qué necesitás:",
    "",
    "1️⃣ Ver cómo funciona el servicio y tarifas",
    "2️⃣ Cotizar un envío",
    "3️⃣ Ya tengo carga lista para enviar al depósito",
    "4️⃣ Ver mis cargas y seguimiento",
    "5️⃣ Hablar con un operador",
    "",
    'Si querés volver al inicio, escribí "menú".',
  ].join("\n");
}

function buildInfoMessage() {
  return [
    "📦 ¿Cómo trabajamos en Lemon's?",
    "",
    "Operamos envíos desde:",
    "🇺🇸 USA",
    "🇨🇳 China",
    "🇪🇺 Europa",
    "",
    "✈️ Modalidades disponibles:",
    "• NORMAL → prioriza costo",
    "• EXPRESS → prioriza velocidad",
    "",
    "📏 Peso mínimo facturable: 1 kg",
    "",
    "💰 Tarifas públicas de referencia:",
    `• USA Normal: ${PUBLIC_RATES.USA_NORMAL} USD/kg`,
    `• USA Express: ${PUBLIC_RATES.USA_EXPRESS} USD/kg`,
    `• China Normal: ${PUBLIC_RATES.CHINA_NORMAL} USD/kg`,
    `• China Express: ${PUBLIC_RATES.CHINA_EXPRESS} USD/kg`,
    `• Europa Normal: ${PUBLIC_RATES.EUROPA_NORMAL} USD/kg`,
    "",
    "📉 Descuentos por volumen:",
    "• desde 10 kg: -3 USD/kg",
    "• desde 50 kg: -5 USD/kg",
    "• desde 100 kg: -7 USD/kg",
    "",
    "Si querés una estimación concreta de tu carga, elegí la opción 2.",
  ].join("\n");
}

function buildModeHelpMessage(origin) {
  if (origin === "USA") {
    return [
      "Te explico la diferencia para que elijas tranquilo 👇",
      "",
      "🇺🇸 USA NORMAL",
      "• opción más económica",
      "• tiempo estimado: 7 a 10 días",
      "",
      "🇺🇸 USA EXPRESS",
      "• opción más rápida",
      "• tiempo estimado: 72 hs",
      "",
      "👉 Si priorizás velocidad, conviene EXPRESS.",
      "👉 Si querés cuidar más el costo, conviene NORMAL.",
      "",
      "Decime cuál preferís: NORMAL o EXPRESS.",
    ].join("\n");
  }

  if (origin === "CHINA") {
    return [
      "Te explico la diferencia para que elijas tranquilo 👇",
      "",
      "🇨🇳 CHINA NORMAL",
      "• opción más económica",
      "• tiempo estimado: 20 a 25 días",
      "",
      "🇨🇳 CHINA EXPRESS",
      "• opción más rápida",
      "• tiempo estimado: 8 días hábiles",
      "",
      "👉 Si priorizás velocidad, conviene EXPRESS.",
      "👉 Si querés cuidar más el costo, conviene NORMAL.",
      "",
      "Decime cuál preferís: NORMAL o EXPRESS.",
    ].join("\n");
  }

  if (origin === "EUROPA") {
    return [
      "En Europa trabajamos con modalidad NORMAL.",
      "• tiempo estimado: 20 días hábiles",
      "",
      "Si querés, seguimos con esa modalidad.",
    ].join("\n");
  }

  return [
    "Trabajamos con NORMAL y EXPRESS según origen.",
    "Primero decime el país de origen y te explico la diferencia.",
  ].join("\n");
}

function buildEstimateMessage(draft, q) {
  return [
    "✅ Cotización estimada",
    "",
    `📦 Producto: ${draft.product_type}`,
    `🌍 Origen: ${draft.origin}`,
    `✈️ Modalidad: ${draft.mode}`,
    `⚖️ Peso estimado: ${draft.weight_kg} kg`,
    "",
    `• Tarifa pública base: ${q.base_rate} USD/kg`,
    `• Descuento por volumen: ${q.volume_discount} USD/kg`,
    `• Tarifa estimada final: ${q.final_rate} USD/kg`,
    `• Total estimado: ${q.estimated_usd} USD`,
    "",
    "⚠️ Esta cotización es aproximada.",
    "Para una validación 100% correcta necesitamos:",
    "• factura / invoice",
    "• valor total de la mercadería",
    "• confirmar volumen real",
    "",
    "Además, según el tipo de producto, pueden requerirse permisos o certificados específicos. Eso lo revisa el operador.",
    "",
    "¿Tenés factura o invoice para adjuntar? Respondé SI o NO.",
  ].join("\n");
}

function buildMaritimeIntro() {
  return [
    "Perfecto. Para una cotización marítima necesito primero:",
    "• proforma",
    "• invoice",
    "",
    "Cuando me lo confirmes, aviso al operador para que te responda con la información correcta.",
  ].join("\n");
}

function buildDepositReadyMessage(draft) {
  const label = buildLabelCode(draft.origin, draft.mode, draft.customer_name);
  const mediaKey =
    draft.origin === "USA" ? "USA" :
    draft.origin === "CHINA" ? "CHINA" :
    "EUROPA";

  return [
    "Perfecto. Ya podés preparar el envío al depósito.",
    "",
    `👤 Nombre de atención: ${draft.customer_name}`,
    `🌍 Origen: ${draft.origin}`,
    `✈️ Modalidad: ${draft.mode}`,
    `🏷️ Código de rótulo: ${label}`,
    "",
    "Pegá ese código por fuera de la caja.",
    "Ahora te envío la dirección / imagen del depósito correspondiente.",
    "",
    `[[SEND_MEDIA:${mediaKey}]]`,
    "",
    "Una vez enviado el producto, mandanos el código de tracking y el rótulo utilizado para poder seguirlo.",
    "El día que se entregue en nuestro depósito, envianos confirmación y ahí tu envío ya queda activo.",
    "",
    "¿Querés hacer algo más?",
    "1️⃣ Volver al menú principal",
    "2️⃣ Hablar con un operador",
  ].join("\n");
}

function parseYesNo(msg) {
  const s = upperNoAccents(msg);
  if (["SI", "SÍ", "YES"].includes(s)) return "SI";
  if (["NO"].includes(s)) return "NO";
  return null;
}

function parseClientCredentials(msg) {
  const lines = String(msg || "").split("\n").map((x) => x.trim()).filter(Boolean);

  if (lines.length >= 2) {
    const clientNumber = Number(lines[0]);
    const email = normalizeEmail(lines[1]);
    if (Number.isFinite(clientNumber) && email.includes("@")) {
      return { client_number: clientNumber, email };
    }
  }

  const parts = String(msg || "").trim().split(/\s+/);
  if (parts.length >= 2) {
    const clientNumber = Number(parts[0]);
    const email = normalizeEmail(parts[1]);
    if (Number.isFinite(clientNumber) && email.includes("@")) {
      return { client_number: clientNumber, email };
    }
  }

  return null;
}

function customerNeedsModeHelp(msg) {
  const s = normalizeText(msg).toLowerCase();
  return (
    s.includes("diferencia") ||
    s.includes("diferencias") ||
    s.includes("que diferencia") ||
    s.includes("qué diferencia") ||
    s.includes("cual conviene") ||
    s.includes("cuál conviene") ||
    s.includes("no se") ||
    s.includes("no sé") ||
    s.includes("no entiendo") ||
    s.includes("explicame") ||
    s.includes("explícame") ||
    s.includes("como es") ||
    s.includes("cómo es") ||
    s.includes("que cambia") ||
    s.includes("qué cambia") ||
    s.includes("cual elijo") ||
    s.includes("cuál elijo")
  );
}

function isMenuCommand(msg) {
  const s = normalizeText(msg).toLowerCase();
  return [
    "cancelar",
    "salir",
    "menu",
    "menú",
    "menu principal",
    "menú principal",
    "inicio",
    "volver al menu",
    "volver al menú",
    "volver al menu principal",
    "volver al menú principal",
  ].includes(s);
}

function isBotReactivationCommand(msg) {
  const s = String(msg || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return [
    "bot", "guia", "guiame", "guia del bot", "quiero el bot",
    "activar bot", "volver al bot", "quiero guia", "me guia el bot",
    "cancelar", "quiero cancelar", "salir del operador"
  ].some((p) => s.includes(p));
}


function isBackCommand(msg) {
  const s = normalizeText(msg).toLowerCase();
  return [
    "atras",
    "atrás",
    "volver",
    "volver atras",
    "volver atrás",
    "un paso atras",
    "un paso atrás",
  ].includes(s);
}

function previousStepFor(step) {
  const map = {
    welcome: "welcome",
    client_verify: "welcome",
    new_client_name: "welcome",
    main_menu: "main_menu",
    info: "main_menu",
    quote_product_type: "main_menu",
    quote_origin: "quote_product_type",
    quote_mode: "quote_origin",
    quote_weight: "quote_mode",
    quote_weight_under1kg: "quote_weight",
    quote_weight_multi: "quote_weight_under1kg",
    quote_type: "quote_weight",
    quote_invoice: "quote_type",
    quote_goods_value: "quote_invoice",
    quote_maritime_proforma: "quote_type",
    quote_maritime_invoice: "quote_maritime_proforma",
    quote_ask_deposit: "quote_operator_wait",
    quote_operator_wait: "main_menu",
    client_tracking_list: "main_menu",
    client_tracking_detail: "client_tracking_list",
    deposit_name: "main_menu",
    deposit_origin: "deposit_name",
    deposit_mode: "deposit_origin",
    deposit_ready: "deposit_mode",
    deposit_operator_email: "deposit_ready",
    op_create_shipment_collect: "operator_menu",
    op_create_shipment_confirm: "op_create_shipment_collect",
  };
  return map[step] || "welcome";
}

function promptForStep(step, draft = {}) {
  if (step === "welcome") return buildWelcome();
  if (step === "client_verify") return buildClientVerifyAsk();
  if (step === "new_client_name") return "Perfecto. Decime tu nombre para atenderte y seguir con la operación.";
  if (step === "main_menu") return buildMainMenu();
  if (step === "info") return buildInfoMessage();
  if (step === "quote_product_type") return "Perfecto. Decime el tipo de producto que querés traer.";
  if (step === "quote_origin") return "Bien. ¿Cuál es el país de origen de la carga?";
  if (step === "quote_mode") {
    if (draft.origin === "EUROPA") return "Perfecto. Europa trabaja con modalidad NORMAL. ¿Sabés aproximadamente cuál es el peso de la carga?";
    return "Perfecto. ¿Qué modalidad querés? Respondé NORMAL o EXPRESS.";
  }
  if (step === "quote_weight") return "Bien. ¿Sabés aproximadamente cuál es el peso de tu carga?";
  if (step === "quote_type") return "¿La cotización que necesitás es AÉREA o MARÍTIMA?";
  if (step === "quote_invoice") {
    const q = draft.quote_preview || estimateQuote(draft.origin, draft.mode, draft.weight_kg);
    if (q) return buildEstimateMessage(draft, q);
    return "¿Tenés factura o invoice para adjuntar? Respondé SI o NO.";
  }
  if (step === "quote_goods_value") return "Perfecto. ¿Sabés el valor total de la mercadería? Si lo sabés, escribilo. Si no, poné NO.";
  if (step === "quote_maritime_proforma") return buildMaritimeIntro() + "\n\n¿Tenés proforma? Respondé SI o NO.";
  if (step === "quote_maritime_invoice") return "¿Tenés invoice? Respondé SI o NO.";
  if (step === "client_tracking_list") return "Mandame el código exacto del paquete para ver su seguimiento.";
  if (step === "client_tracking_detail") return "Mandame otro código de paquete o escribí menú para volver.";
  if (step === "deposit_name") return "Perfecto. Decime tu nombre para atenderte y preparar tu rótulo.";
  if (step === "deposit_origin") return "Bien. ¿Cuál es el país de origen de la carga? Respondé USA, CHINA o EUROPA.";
  if (step === "deposit_mode") return "¿Ya sabés qué modalidad querés? Respondé NORMAL o EXPRESS.";
  if (step === "deposit_ready") return buildDepositReadyMessage(draft);
  if (step === "deposit_operator_email") return "Perfecto. Antes de avisarle al operador, pasame un email de contacto.";
  if (step === "operator_menu") return buildOperatorMenu();
  if (step === "op_create_shipment_collect") return buildTemplateMessage();
  if (step === "op_create_shipment_confirm") return buildPreviewMessage(draft.preview);
  return buildWelcome();
}

async function getClientShipments(userId) {
  const q = await db.query(
    `
    SELECT
      id,
      code,
      description,
      status,
      origin,
      service,
      tracking,
      box_code,
      weight_kg,
      estimated_usd,
      date_in,
      delivered_at,
      updated_at
    FROM shipments
    WHERE user_id = $1
    ORDER BY COALESCE(updated_at, date_in, NOW()) DESC
    LIMIT 30
    `,
    [userId]
  );
  return q.rows || [];
}

function buildClientShipmentsListMessage(clientName, rows) {
  if (!rows || !rows.length) {
    return [
      `Perfecto${clientName ? ", " + clientName : ""}.`,
      "",
      "No encontré cargas asociadas a tu cuenta por ahora.",
      "",
      'Si querés, escribí "menú" para volver al inicio.'
    ].join("\n");
  }

  const lines = rows.slice(0, 15).map((r, i) => {
    return [
      `${i + 1}. 📦 ${r.code || "SIN-CODIGO"}`,
      `   Estado: ${r.status || "-"}`,
      `   Producto: ${r.description || "-"}`,
      `   Origen: ${r.origin || "-"} | Modalidad: ${r.service || "-"}`,
      r.tracking ? `   Tracking: ${r.tracking}` : `   Tracking: -`,
      r.box_code ? `   Box: ${r.box_code}` : `   Box: -`,
    ].join("\n");
  });

  return [
    `📋 Estas son tus cargas registradas${clientName ? " en Lemon's, " + clientName : ""}:`,
    "",
    lines.join("\n\n"),
    "",
    "Si querés ver el detalle de una carga puntual, respondé el código exacto del paquete.",
    'Ejemplo: USA-N-0004',
    "",
    'También podés escribir "menú" para volver.'
  ].join("\n");
}

async function getClientShipmentByCode(userId, code) {
  const q = await db.query(
    `
    SELECT
      id,
      code,
      description,
      status,
      origin,
      service,
      tracking,
      box_code,
      weight_kg,
      estimated_usd,
      date_in,
      delivered_at,
      updated_at
    FROM shipments
    WHERE user_id = $1
      AND UPPER(code) = UPPER($2)
    LIMIT 1
    `,
    [userId, String(code || "").trim()]
  );
  return q.rows[0] || null;
}

function buildClientShipmentDetailMessage(row) {
  if (!row) {
    return [
      "No encontré una carga con ese código dentro de tu cuenta.",
      "",
      "Mandame el código exacto del paquete como figura en tu listado.",
      'O escribí "menú" para volver.'
    ].join("\n");
  }

  return [
    `📦 Seguimiento de ${row.code || "-"}`,
    "",
    `Estado actual: ${row.status || "-"}`,
    `Producto: ${row.description || "-"}`,
    `Origen: ${row.origin || "-"}`,
    `Modalidad: ${row.service || "-"}`,
    `Peso: ${row.weight_kg || "-"} kg`,
    row.tracking ? `Tracking: ${row.tracking}` : `Tracking: -`,
    row.box_code ? `Box: ${row.box_code}` : `Box: -`,
    row.estimated_usd ? `Estimado: ${row.estimated_usd} USD` : `Estimado: -`,
    row.date_in ? `Ingresó: ${row.date_in}` : null,
    row.delivered_at ? `Entregado: ${row.delivered_at}` : null,
    "",
    'Si querés consultar otra carga, mandame otro código.',
    'O escribí "menú" para volver.'
  ].filter(Boolean).join("\n");
}


function detectOperatorCommand(lower) {
  const s = String(lower || "").trim();
  if (s === "dashboard" || s.startsWith("dashboard ")) return "dashboard";
  if (s === "buscar" || s.startsWith("buscar ")) return "buscar";
  if (s === "estado envio" || s.startsWith("estado envio ")) return "estado_envio";
  if (s === "crear envio" || s === "cargar envio nuevo" || s === "nuevo envio") return "crear_envio";
  if (s === "clientes") return "clientes";
  if (s === "envios") return "envios";
  if (s.startsWith("test ")) return "test";
  if (s === "plantilla envio") return "plantilla_envio";
  return null;
}

function buildOperatorMenu() {
  return [
    "🍋 MODO OPERADOR PRO",
    "",
    "Opciones:",
    "📊 dashboard",
    "🔍 buscar <id / tel / nombre / mail>",
    "📦 estado envio <id / codigo / tracking>",
    "🆕 crear envio",
    "👥 clientes",
    "📦 envios",
    "🧪 test <id>",
    "",
    "Dashboard acepta:",
    "• ganancias",
    "• gastos",
    "• informacion general",
    "",
    'Podés escribir otra opción en cualquier momento y te llevo directo.',
    'También: "menú", "atrás", "cancelar".',
  ].join("\n");
}

function buildCreateShipmentIntro() {
  return [
    "🆕 CREAR ENVÍO",
    "",
    "Mandame lo que tengas:",
    "• foto del paquete (si tu bot ya extrae texto OCR)",
    "• o texto pegado",
    "• o datos sueltos",
    "",
    "Puedo detectar automáticamente:",
    "• país de origen",
    "• NORMAL / EXPRESS",
    "• tracking",
    "• nombre en etiqueta",
    "",
    "Si me falta algo, te lo voy a pedir.",
    "También te voy a preguntar si se cobra por kg mínimo o peso real.",
  ].join("\n");
}

function buildTemplateMessage() {
  return buildCreateShipmentIntro();
}

function inferOriginServiceFromText(text) {
  const raw = String(text || "");
  const up = upperNoAccents(raw);

  if (up.includes("HY-AUREL-LEMON-")) return { origin: "CHINA", service: "NORMAL" };
  if (up.includes("IC105/IC/LEMON-")) return { origin: "USA", service: "NORMAL" };
  if (up.includes("LEMONS GROUP - 1CB81842") || up.includes("LEMON GROUP - 1CB81842")) {
    return { origin: "EUROPA", service: "NORMAL" };
  }
  if (up.includes("1504-")) return { origin: null, service: "EXPRESS", ambiguous_1504: true };

  return { origin: null, service: null };
}

function parseChargeMode(text) {
  const s = upperNoAccents(text);
  if (s.includes("REAL") || s.includes("PESO REAL") || s.includes("COBRAR REAL") || s.includes("PESO REAL")) return true;
  if (s.includes("MINIMO") || s.includes("MINIMO 1 KG") || s.includes("POR KG MINIMO") || s.includes("KG MINIMO")) return false;
  // Detectar "1" como mínimo y "2" como real en contexto de la pregunta
  if (s.trim() === "2") return true;   // opción 2 = peso real
  if (s.trim() === "1") return false;  // opción 1 = mínimo 1kg
  return null;
}

function extractClientNameFromLabel(text) {
  const up = upperNoAccents(text);

  const prefixes = [
    "HY-AUREL-LEMON-",
    "IC105/IC/LEMON-",
    "1504-",
    "LEMONS GROUP - 1CB81842 - ",
    "LEMON GROUP - 1CB81842 - "
  ];

  for (const prefix of prefixes) {
    const idx = up.indexOf(prefix);
    if (idx >= 0) {
      const value = up.slice(idx + prefix.length).split("\n")[0].trim();
      if (value) return normalizeText(value).replace(/\s+/g, " ").trim();
    }
  }

  return null;
}

function normalizeClientNameLoose(name) {
  return upperNoAccents(name).replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

async function findClientByLooseName(name) {
  const target = normalizeClientNameLoose(name);
  if (!target) return null;

  const q = await db.query(`
    SELECT id, name, client_number, email, phone, active
    FROM users
    WHERE active = true
    ORDER BY id DESC
    LIMIT 300
  `);

  for (const row of q.rows) {
    const candidate = normalizeClientNameLoose(row.name || "");
    if (candidate && (candidate.includes(target) || target.includes(candidate))) {
      return row;
    }
  }
  return null;
}

async function getOperatorDashboardStats() {
  const result = {
    users_total: 0,
    active_clients: 0,
    shipments_total: 0,
    shipments_active: 0,
    shipments_delivered: 0,
    revenue_estimated: 0,
    expenses_by_category: {},
    expenses_total: 0,
    payments_total: 0,
    profit_total: 0,
  };

  try {
    const uq = await db.query(`SELECT COUNT(*)::int AS total FROM users`);
    result.users_total = uq.rows[0]?.total || 0;
  } catch {}

  try {
    const cq = await db.query(`SELECT COUNT(DISTINCT user_id)::int AS total FROM shipments`);
    result.active_clients = cq.rows[0]?.total || 0;
  } catch {}

  try {
    const sq = await db.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status != 'Entregado')::int AS active,
        COUNT(*) FILTER (WHERE status = 'Entregado')::int AS delivered,
        COALESCE(SUM(estimated_usd), 0) AS revenue
      FROM shipments
    `);
    result.shipments_total = sq.rows[0]?.total || 0;
    result.shipments_active = sq.rows[0]?.active || 0;
    result.shipments_delivered = sq.rows[0]?.delivered || 0;
    result.revenue_estimated = Number(sq.rows[0]?.revenue || 0);
  } catch {}

  try {
    const eq = await db.query(`
      SELECT COALESCE(category,'Sin categoría') AS category, COALESCE(SUM(amount),0) AS total
      FROM expenses
      GROUP BY category
      ORDER BY total DESC
    `);
    for (const row of eq.rows) {
      result.expenses_by_category[row.category] = Number(row.total || 0);
      result.expenses_total += Number(row.total || 0);
    }
  } catch {}

  try {
    const pq = await db.query(`
      SELECT
        COUNT(*)::int AS total,
        COALESCE(SUM(amount_usd),0) AS total_usd,
        COALESCE(SUM(profit_usd),0) AS total_profit
      FROM payments
    `);
    result.payments_total = Number(pq.rows[0]?.total_usd || 0);
    result.profit_total = Number(pq.rows[0]?.total_profit || 0);
  } catch {}

  return result;
}

function buildDashboardChooserMessage() {
  return [
    "📊 DASHBOARD",
    "",
    "Decime qué querés ver:",
    "• ganancias",
    "• gastos",
    "• informacion general",
    "",
    'También podés escribir otra opción como "buscar" o "crear envio".',
  ].join("\n");
}

function buildDashboardAnswer(kind, stats) {
  if (kind === "ganancias") {
    const recommendation =
      stats.profit_total > 0
        ? "Recomendación: seguí empujando entregas y cobranzas para sostener margen positivo."
        : "Recomendación: revisar costos, tarifas y cobranzas porque la ganancia está baja o nula.";

    return [
      "💰 DASHBOARD — GANANCIAS",
      "",
      `Ganancia neta total registrada: USD ${Number(stats.profit_total || 0).toFixed(2)}`,
      `Facturación total registrada: USD ${Number(stats.payments_total || 0).toFixed(2)}`,
      `Ingresos estimados por envíos: USD ${Number(stats.revenue_estimated || 0).toFixed(2)}`,
      "",
      recommendation,
    ].join("\n");
  }

  if (kind === "gastos") {
    const lines = Object.entries(stats.expenses_by_category || {}).map(
      ([k, v]) => `• ${k}: ${Number(v).toFixed(2)}`
    );

    return [
      "🧾 DASHBOARD — GASTOS",
      "",
      ...(lines.length ? lines : ["No encontré gastos cargados por categoría."]),
      "",
      `Total gastos registrados: ${Number(stats.expenses_total || 0).toFixed(2)}`,
      "",
      "Recomendación: compará esta estructura contra ganancias para ver qué área está consumiendo más.",
    ].join("\n");
  }

  const recommendation =
    Number(stats.shipments_active || 0) > Number(stats.shipments_delivered || 0)
      ? "Recomendación: priorizar cierres operativos y entregas para convertir cargas activas en cobranzas."
      : "Recomendación: reforzar captación y activación comercial para aumentar volumen.";

  return [
    "📊 DASHBOARD — INFORMACIÓN GENERAL",
    "",
    `Usuarios totales: ${stats.users_total}`,
    `Clientes activos con cargas: ${stats.active_clients}`,
    `Envíos totales: ${stats.shipments_total}`,
    `Envíos activos: ${stats.shipments_active}`,
    `Envíos entregados: ${stats.shipments_delivered}`,
    `Ingresos estimados: USD ${Number(stats.revenue_estimated || 0).toFixed(2)}`,
    `Ganancia neta registrada: USD ${Number(stats.profit_total || 0).toFixed(2)}`,
    `Gastos registrados: ${Number(stats.expenses_total || 0).toFixed(2)}`,
    "",
    recommendation,
  ].join("\n");
}

async function searchClientFull(term) {
  const t = normalizeText(term);
  if (!t) return null;

  let client = null;

  if (/^\d+$/.test(t)) client = await getActiveClientByNumber(Number(t));

  if (!client) {
    const q = await db.query(`
      SELECT id, name, client_number, email, phone, active, created_at
      FROM users
      WHERE
        CAST(COALESCE(client_number,0) AS TEXT) = $1
        OR regexp_replace(COALESCE(phone,''), '\\D', '', 'g') = $2
        OR LOWER(COALESCE(email,'')) = LOWER($3)
        OR COALESCE(name,'') ILIKE $4
      ORDER BY id DESC
      LIMIT 1
    `, [t, normalizePhone(t), t, `%${t}%`]);
    client = q.rows[0] || null;
  }

  if (!client) return null;

  const out = { client, coins: null, shipment_stats: null, payment_stats: null, recent_shipments: [] };

  try {
    const cq = await db.query(`
      SELECT balance, total_earned
      FROM lemon_coins
      WHERE user_id = $1
      LIMIT 1
    `, [client.id]);
    out.coins = cq.rows[0] || { balance: 0, total_earned: 0 };
  } catch {
    out.coins = { balance: 0, total_earned: 0 };
  }

  try {
    const sq = await db.query(`
      SELECT
        COUNT(*)::int AS total_shipments,
        COALESCE(SUM(weight_kg),0) AS total_kg,
        COALESCE(SUM(estimated_usd),0) AS total_estimated_usd,
        COUNT(*) FILTER (WHERE status = 'Entregado')::int AS delivered,
        COUNT(*) FILTER (WHERE status != 'Entregado')::int AS active
      FROM shipments
      WHERE user_id = $1
    `, [client.id]);
    out.shipment_stats = sq.rows[0];
  } catch {}

  try {
    const pq = await db.query(`
      SELECT
        COUNT(*)::int AS total_payments,
        COALESCE(SUM(total_usd),0) AS total_paid_usd
      FROM payments
      WHERE user_id = $1
    `, [client.id]);
    out.payment_stats = pq.rows[0] || { total_payments: 0, total_paid_usd: 0 };
  } catch {
    out.payment_stats = { total_payments: 0, total_paid_usd: 0 };
  }

  try {
    const rq = await db.query(`
      SELECT code, status, weight_kg, tracking, estimated_usd
      FROM shipments
      WHERE user_id = $1
      ORDER BY id DESC
      LIMIT 5
    `, [client.id]);
    out.recent_shipments = rq.rows || [];
  } catch {}

  return out;
}

function buildClientFullMessage(data) {
  if (!data?.client) {
    return "Incorrecto. No encontré ese usuario. Elegí otro ID, teléfono, nombre o mail.";
  }

  const c = data.client;
  const coins = data.coins || {};
  const ss = data.shipment_stats || {};
  const ps = data.payment_stats || {};
  const recent = data.recent_shipments || [];

  const lines = [
    `👤 CLIENTE #${c.client_number || "-"}`,
    "",
    `Nombre: ${c.name || "-"}`,
    `Mail: ${c.email || "-"}`,
    `Teléfono: ${c.phone || "-"}`,
    `Activo: ${c.active ? "SI" : "NO"}`,
    "",
    `🍋 Coins: ${Number(coins.balance || 0).toFixed(2)}`,
    `🍋 Coins ganados: ${Number(coins.total_earned || 0).toFixed(2)}`,
    "",
    `📦 Cargas movidas: ${ss.total_shipments || 0}`,
    `⚖️ Kg movidos: ${Number(ss.total_kg || 0).toFixed(2)}`,
    `🚚 Activas: ${ss.active || 0}`,
    `✅ Entregadas: ${ss.delivered || 0}`,
    `💰 Total estimado: USD ${Number(ss.total_estimated_usd || 0).toFixed(2)}`,
    `💵 Total pagado: USD ${Number(ps.total_paid_usd || 0).toFixed(2)}`,
    "",
    "Últimas cargas:"
  ];

  if (recent.length) {
    for (const r of recent) {
      lines.push(`• ${r.code || "-"} | ${r.status || "-"} | ${Number(r.weight_kg || 0).toFixed(2)} kg | ${r.tracking || "-"} | USD ${Number(r.estimated_usd || 0).toFixed(2)}`);
    }
  } else {
    lines.push("• Sin cargas registradas");
  }

  return lines.join("\n");
}

async function getShipmentFullByAny(term) {
  const t = normalizeText(term);
  if (!t) return null;

  let q;
  if (/^\d+$/.test(t)) {
    q = await db.query(`SELECT * FROM shipments WHERE id = $1 LIMIT 1`, [Number(t)]);
    if (q.rows[0]) {
      const ev = await db.query(
        `SELECT old_status, new_status, created_at
         FROM shipment_events
         WHERE shipment_id = $1
         ORDER BY created_at ASC`,
        [q.rows[0].id]
      );
      return { shipment: q.rows[0], events: ev.rows || [] };
    }
  }

  q = await db.query(`
    SELECT *
    FROM shipments
    WHERE UPPER(COALESCE(code,'')) = UPPER($1)
       OR UPPER(COALESCE(tracking,'')) = UPPER($1)
    LIMIT 1
  `, [t]);

  if (!q.rows[0]) return null;

  const ev = await db.query(
    `SELECT old_status, new_status, created_at
     FROM shipment_events
     WHERE shipment_id = $1
     ORDER BY created_at ASC`,
    [q.rows[0].id]
  );

  return { shipment: q.rows[0], events: ev.rows || [] };
}

function buildShipmentFullMessage(data) {
  if (!data?.shipment) {
    return "No encontré ese envío. Probá con ID, código o tracking.";
  }

  const s = data.shipment;
  const ev = data.events || [];

  const lines = [
    `📦 ENVÍO ${s.code || "#" + s.id}`,
    "",
    `ID: ${s.id}`,
    `Estado actual: ${s.status || "-"}`,
    `Origen: ${s.origin || "-"}`,
    `Servicio: ${s.service || "-"}`,
    `Peso: ${Number(s.weight_kg || 0).toFixed(2)} kg`,
    `Tracking: ${s.tracking || "-"}`,
    `Box: ${s.box_code || "-"}`,
    `Descripción: ${s.description || "-"}`,
    `Estimado: USD ${Number(s.estimated_usd || 0).toFixed(2)}`,
    "",
    "Historial:"
  ];

  if (ev.length) {
    for (const e of ev) {
      lines.push(`• ${e.old_status || "Creado"} → ${e.new_status || "-"} | ${e.created_at || "-"}`);
    }
  } else {
    lines.push("• Sin historial registrado");
  }

  return lines.join("\n");
}


// ─── HELPERS: gestión del borrador de operador ───────────────────────────────

function mergeDraft(base, incoming) {
  const out = Object.assign({}, base);
  for (const [k, v] of Object.entries(incoming || {})) {
    if (v !== null && v !== undefined && v !== "") out[k] = v;
  }
  return out;
}

function missingFields(draft) {
  const miss = [];
  if (!draft.client_number) miss.push("número de cliente");
  if (!draft.origin)        miss.push("origen (USA / CHINA / EUROPA)");
  if (!draft.service)       miss.push("modalidad (NORMAL / EXPRESS)");
  if (!draft.weight_kg)     miss.push("peso en kg");
  if (!draft.tracking)      miss.push("tracking");
  if (!draft.description)   miss.push("descripción del producto");
  return miss;
}

function buildAskMissingMessage(draft) {
  const miss = missingFields(draft);
  if (!miss.length) return "Ya tengo todo. Generando preview…";
  return [
    "Faltan algunos datos para crear el envío:",
    "",
    ...miss.map((m) => `• ${m}`),
    "",
    "Mandame los datos que faltan.",
  ].join("\n");
}

function parseLabeledMessage(text) {
  const out = {};
  const lines = String(text || "").split("\n");
  const MAP = {
    "cliente":     "client_number",
    "numero":      "client_number",
    "nro":         "client_number",
    "origen":      "origin",
    "modalidad":   "service",
    "servicio":    "service",
    "peso":        "weight_kg",
    "kg":          "weight_kg",
    "tracking":    "tracking",
    "descripcion": "description",
    "nombre":      "customer_name",
    "cliente nombre": "customer_name",
  };

  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const rawKey = line.slice(0, idx).trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const val = line.slice(idx + 1).trim();
    if (!val) continue;

    for (const [alias, field] of Object.entries(MAP)) {
      if (rawKey.includes(alias)) {
        if (field === "client_number") {
          const n = Number(val);
          if (Number.isFinite(n)) out[field] = n;
        } else if (field === "weight_kg") {
          const n = parseFloat(val.replace(",", ".").replace(/[^\d.]/g, ""));
          if (Number.isFinite(n)) out[field] = n;
        } else if (field === "origin") {
          const o = normalizeOrigin(val);
          if (o) out[field] = o;
        } else if (field === "service") {
          const s = normalizeService(val);
          if (s) out[field] = s;
        } else {
          out[field] = val;
        }
        break;
      }
    }
  }
  return out;
}

function parseShortFormat(text) {
  // Formato: "42 CHINA NORMAL 3.5 TRK-123 zapatillas"
  const out = {};
  const parts = String(text || "").trim().split(/\s+/);
  if (parts.length < 4) return out;

  const maybeNum = Number(parts[0]);
  if (!Number.isFinite(maybeNum) || maybeNum <= 0) return out;

  const maybeOrigin = normalizeOrigin(parts[1]);
  if (!maybeOrigin) return out;

  const maybeService = normalizeService(parts[2], maybeOrigin);
  if (!maybeService) return out;

  const maybeKg = parseFloat(String(parts[3]).replace(",", "."));
  if (!Number.isFinite(maybeKg)) return out;

  out.client_number = maybeNum;
  out.origin = maybeOrigin;
  out.service = maybeService;
  out.weight_kg = maybeKg;

  if (parts[4]) out.tracking = parts[4];
  if (parts.slice(5).length) out.description = parts.slice(5).join(" ");

  return out;
}

function parseSingleFieldReply(text, draft) {
  const out = {};
  const t = String(text || "").trim();

  if (!draft.origin) {
    const o = normalizeOrigin(t);
    if (o) { out.origin = o; return out; }
  }
  if (!draft.service) {
    const s = normalizeService(t, draft.origin);
    if (s) { out.service = s; return out; }
  }
  if (!draft.weight_kg) {
    const n = parseFloat(t.replace(",", ".").replace(/[^\d.]/g, ""));
    if (Number.isFinite(n) && n > 0) { out.weight_kg = n; return out; }
  }
  if (!draft.client_number) {
    const n = Number(t);
    if (Number.isFinite(n) && n > 0 && /^\d+$/.test(t)) { out.client_number = n; return out; }
  }
  if (!draft.tracking && /^[A-Z0-9\-]{4,}$/i.test(t) && t.length >= 4) {
    out.tracking = t.toUpperCase();
    return out;
  }
  if (!draft.description && t.length >= 3) {
    out.description = t;
    return out;
  }
  return out;
}

async function getActiveClientByNumber(clientNumber) {
  const q = await db.query(
    `SELECT id, name, client_number, email, phone, active
     FROM users
     WHERE client_number = $1
       AND COALESCE(active, true) = true
     LIMIT 1`,
    [clientNumber]
  );
  return q.rows[0] || null;
}

async function buildPreview(draft) {
  const client = await getActiveClientByNumber(draft.client_number);

  const costsQ = await db.query(`SELECT * FROM operator_costs LIMIT 1`);
  const oc = costsQ.rows[0] || {};
  function getCostPerKg(origin, service) {
    if (origin === "USA"    && service === "NORMAL")  return Number(oc.usa_normal    || 0);
    if (origin === "USA"    && service === "EXPRESS") return Number(oc.usa_express   || 0);
    if (origin === "CHINA"  && service === "NORMAL")  return Number(oc.china_normal  || 0);
    if (origin === "CHINA"  && service === "EXPRESS") return Number(oc.china_express || 0);
    if (origin === "EUROPA")                          return Number(oc.europa_normal || 0);
    return 0;
  }

  const weightKg   = Number(draft.weight_kg || 0);
  const billableKg = draft.charge_real_weight ? weightKg : Math.max(weightKg, 1);
  const baseRate   = getPublicRate(draft.origin, draft.service) || 0;
  const discount   = volumeDiscount(billableKg);
  const finalRate  = Number((baseRate - discount).toFixed(2));
  const estimatedUsd = Number((billableKg * finalRate).toFixed(2));
  const costPerKg  = getCostPerKg(draft.origin, draft.service);
  const costUsd    = Number((billableKg * costPerKg).toFixed(2));
  const profitUsd  = Number((estimatedUsd - costUsd).toFixed(2));

  const packageCode = buildPackageCode({
    origin: draft.origin,
    service: draft.service,
    clientName: client?.name || draft.customer_name || "CLIENTE",
  });

  return {
    client: client || { name: draft.customer_name || "-", client_number: draft.client_number },
    origin: draft.origin,
    service: draft.service,
    weight_kg: weightKg,
    billable_kg: billableKg,
    tracking: draft.tracking,
    description: draft.description,
    charge_real_weight: !!draft.charge_real_weight,
    base_rate: baseRate,
    volume_discount: discount,
    final_rate: finalRate,
    estimated_usd: estimatedUsd,
    cost_usd: costUsd,
    profit_usd: profitUsd,
    package_code: packageCode,
    client_number: draft.client_number,
    customer_name: client?.name || draft.customer_name || "-",
  };
}

function buildPreviewMessage(preview) {
  if (!preview) return "No pude generar el preview. Revisá los datos.";
  return [
    "📋 PREVIEW DEL ENVÍO",
    "",
    `Cliente: ${preview.customer_name} (#${preview.client_number || "-"})`,
    `Código paquete: ${preview.package_code}`,
    `Origen: ${preview.origin}`,
    `Servicio: ${preview.service}`,
    `Peso real: ${Number(preview.weight_kg || 0).toFixed(2)} kg`,
    `Peso facturable: ${Number(preview.billable_kg || 0).toFixed(2)} kg`,
    `Tracking: ${preview.tracking || "-"}`,
    `Descripción: ${preview.description || "-"}`,
    "",
    `Tarifa base: ${preview.base_rate} USD/kg`,
    `Descuento volumen: ${preview.volume_discount} USD/kg`,
    `Tarifa final: ${preview.final_rate} USD/kg`,
    `Estimado cliente: ${preview.estimated_usd} USD`,
    `Costo operación: ${preview.cost_usd} USD`,
    `Ganancia: ${preview.profit_usd} USD`,
    "",
    "Si está todo correcto, respondé: correcto",
    "Para corregir un dato específico decime, por ejemplo:",
    "  • cambiar tracking → TRK-NUEVO",
    "  • modificar peso → 5.2",
    "  • cliente 45",
    "  • origen CHINA",
    'O escribí "atrás" para volver al borrador completo.',
  ].join("\n");
}

async function createShipmentFromPreview(preview) {
  const clientQ = await db.query(
    `SELECT id FROM users WHERE client_number = $1 LIMIT 1`,
    [preview.client_number]
  );
  const userId = clientQ.rows[0]?.id;
  if (!userId) throw new Error(`Cliente #${preview.client_number} no encontrado`);

  const res = await db.query(
    `INSERT INTO shipments
       (user_id, client_name, code, origin, service, weight_kg, tracking,
        description, status, estimated_usd, date_in, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Recibido en depósito',$9,NOW(),NOW(),NOW())
     RETURNING id`,
    [
      userId,
      preview.customer_name,
      preview.package_code,
      preview.origin,
      preview.service,
      preview.weight_kg,
      preview.tracking,
      preview.description,
      preview.estimated_usd,
    ]
  );

  const shipmentId = res.rows[0]?.id;

  await db.query(
    `INSERT INTO shipment_events (shipment_id, old_status, new_status)
     VALUES ($1, NULL, 'Recibido en depósito')`,
    [shipmentId]
  );

  // Notificar al cliente por WhatsApp si tiene teléfono
  try {
    const uq = await db.query(`SELECT phone FROM users WHERE id = $1 LIMIT 1`, [userId]);
    const phone = uq.rows[0]?.phone;
    if (phone) {
      const msg = [
        "📦 Tu envío fue registrado en Lemon's",
        "",
        `Código: ${preview.package_code}`,
        `Tracking: ${preview.tracking || "-"}`,
        `Estado: Recibido en depósito`,
        `Estimado: ${preview.estimated_usd} USD`,
        "",
        "Te vamos a avisar cada vez que cambie el estado.",
      ].join("\n");
      await db.query(
        `INSERT INTO wa_notifications (phone, message, status, created_at)
         VALUES ($1, $2, 'pending', NOW())`,
        [phone.replace(/\D/g, ""), msg]
      );
    }
  } catch (e) {
    console.log("[CREATE SHIPMENT WA ERROR]", e?.message || e);
  }

  return shipmentId;
}

function buildOperatorTestWhatsappMessage(shipmentId, newStatus, estimatedUsd) {
  return [
    "📦 Actualización de tu envío",
    "",
    `ID: ${shipmentId}`,
    `Estado: ${newStatus}`,
    estimatedUsd ? `Estimado: ${Number(estimatedUsd).toFixed(2)} USD` : null,
    "",
    "Para más info escribinos.",
  ].filter(Boolean).join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
function enrichOperatorDraftFromText(text, draft = {}) {
  const labeled = parseLabeledMessage(text);
  const short = Object.keys(labeled).length ? {} : parseShortFormat(text);
  const single = (!Object.keys(labeled).length && !Object.keys(short).length)
    ? parseSingleFieldReply(text, draft)
    : {};

  let merged = mergeDraft(draft || {}, mergeDraft(labeled, mergeDraft(short, single)));

  const inferred = inferOriginServiceFromText(text);
  if (!merged.origin && inferred.origin) merged.origin = inferred.origin;
  if (!merged.service && inferred.service) merged.service = inferred.service;

  const trackingMatch = String(text || "").match(/\b[A-Z0-9\-]{8,}\b/);
  if (!merged.tracking && trackingMatch) merged.tracking = trackingMatch[0];

  if (!merged.customer_name) {
    const maybeName = extractClientNameFromLabel(text);
    if (maybeName) merged.customer_name = maybeName;
  }

  return mergeDraft(draft || {}, merged);
}
async function handleOperatorMode({ msg, lower, sessionKey, session, current, res, phone = "", rawChatId = "", actorName = "" }) {
  const direct = detectOperatorCommand(lower);

  if (isMenuCommand(msg)) {
    await clearDraft(sessionKey);
    await upsertDraft(sessionKey, "operator", "operator_menu", {});
    return res.json({ ok: true, result: { text: buildOperatorMenu() } });
  }

  if (direct === "dashboard") {
    await upsertDraft(sessionKey, "operator", "op_dashboard_menu", current || {});
    const rest = normalizeText(msg.replace(/^dashboard/i, ""));
    if (!rest) return res.json({ ok: true, result: { text: buildDashboardChooserMessage() } });

    const stats = await getOperatorDashboardStats();
    let kind = "informacion general";
    if (lower.includes("ganancia")) kind = "ganancias";
    else if (lower.includes("gasto")) kind = "gastos";
    return res.json({ ok: true, result: { text: buildDashboardAnswer(kind, stats) } });
  }

  if (session?.step === "op_dashboard_menu") {
    const stats = await getOperatorDashboardStats();
    if (lower.includes("ganancia")) return res.json({ ok: true, result: { text: buildDashboardAnswer("ganancias", stats) } });
    if (lower.includes("gasto")) return res.json({ ok: true, result: { text: buildDashboardAnswer("gastos", stats) } });
    if (lower.includes("informacion") || lower.includes("general")) {
      return res.json({ ok: true, result: { text: buildDashboardAnswer("informacion general", stats) } });
    }
    return res.json({ ok: true, result: { text: buildDashboardChooserMessage() } });
  }

  if (direct === "buscar") {
    const term = normalizeText(msg.replace(/^buscar/i, ""));
    if (!term) {
      await upsertDraft(sessionKey, "operator", "op_search_prompt", current || {});
      return res.json({ ok: true, result: { text: "Mandame ID, teléfono, nombre o mail del cliente que querés buscar." } });
    }
    const data = await searchClientFull(term);
    return res.json({ ok: true, result: { text: buildClientFullMessage(data) } });
  }

  if (session?.step === "op_search_prompt") {
    const data = await searchClientFull(msg);
    return res.json({ ok: true, result: { text: buildClientFullMessage(data) } });
  }

  if (direct === "estado_envio") {
    const term = normalizeText(msg.replace(/^estado envio/i, ""));
    if (!term) {
      await upsertDraft(sessionKey, "operator", "op_status_prompt", current || {});
      return res.json({ ok: true, result: { text: "Mandame ID, código o tracking del envío." } });
    }
    const data = await getShipmentFullByAny(term);
    return res.json({ ok: true, result: { text: buildShipmentFullMessage(data) } });
  }

  if (session?.step === "op_status_prompt") {
    const data = await getShipmentFullByAny(msg);
    return res.json({ ok: true, result: { text: buildShipmentFullMessage(data) } });
  }

  if (direct === "clientes") {
    const q = await db.query(`
      SELECT id, name, phone, email, client_number
      FROM users
      ORDER BY id DESC
      LIMIT 10
    `);
    const lines = q.rows.map((c) =>
      `• #${c.client_number || "-"} | ${c.name || "-"} | ${c.phone || "-"} | ${c.email || "-"}`
    );
    return res.json({
      ok: true,
      result: { text: ["👥 Últimos clientes", "", lines.join("\n") || "Sin datos"].join("\n") },
    });
  }

  if (direct === "envios") {
    const q = await db.query(`
      SELECT id, client_name, status, weight_kg, tracking
      FROM shipments
      ORDER BY id DESC
      LIMIT 10
    `);
    const lines = q.rows.map((s) =>
      `#${s.id} | ${s.client_name || "-"} | ${s.status || "-"} | ${s.weight_kg || 0} kg | ${s.tracking || "-"}`
    );
    return res.json({
      ok: true,
      result: { text: ["📦 Últimos envíos", "", lines.join("\n") || "Sin datos"].join("\n") },
    });
  }

  if (direct === "plantilla_envio") {
    return res.json({
      ok: true,
      result: { text: 'La opción "plantilla envio" fue eliminada. Usá "crear envio" y mandame foto OCR o texto.' }
    });
  }

  if (direct === "test") {
    try {
      const id = normalizeText(msg.replace(/^test\s+/i, ""));
      if (!id) return res.json({ ok: true, result: { text: "Pasame el ID. Ej: test 123" } });

      const q = await db.query(`SELECT * FROM shipments WHERE id = $1 LIMIT 1`, [id]);
      if (!q.rows.length) return res.json({ ok: true, result: { text: "No encontré ese envío." } });

      const s = q.rows[0];
      let next = null;
      if (s.status === "Recibido en depósito") next = "En preparación";
      else if (s.status === "En preparación") next = "En tránsito";
      else if (s.status === "En tránsito") next = "Listo para entrega";

      if (!next) {
        return res.json({ ok: true, result: { text: "Este envío ya está en estado final o no se puede avanzar." } });
      }

      await db.query(`UPDATE shipments SET status = $1, updated_at = NOW() WHERE id = $2`, [next, id]);
      await db.query(
        `INSERT INTO shipment_events (shipment_id, old_status, new_status) VALUES ($1, $2, $3)`,
        [id, s.status, next]
      );

      try {
        const uq = await db.query(`SELECT phone FROM users WHERE id = $1 LIMIT 1`, [s.user_id]);
        const outPhone = uq.rows[0]?.phone || null;
        if (outPhone) {
          await db.query(
            `INSERT INTO wa_notifications (phone, message, status, created_at) VALUES ($1, $2, 'pending', NOW())`,
            [outPhone, buildOperatorTestWhatsappMessage(id, next, s.estimated_usd)]
          );
        }
      } catch (e) {
        console.log("[TEST WA ERROR]", e?.message || e);
      }

      return res.json({ ok: true, result: { text: `✅ Envío #${id}\n\n${s.status} → ${next}` } });
    } catch (e) {
      console.error("[TEST COMMAND ERROR]", e);
      return res.json({ ok: true, result: { text: "Error ejecutando test." } });
    }
  }

  if (direct === "crear_envio") {
    await clearDraft(sessionKey);
    await upsertDraft(sessionKey, "operator", "op_create_shipment_collect", {});
    return res.json({ ok: true, result: { text: buildCreateShipmentIntro() } });
  }

  if (session?.step === "op_create_shipment_confirm") {

    // Detección de modificación de campo específico en el preview
    // El operador puede decir "cambiar tracking", "modificar peso", "cliente 43", etc.
    const fieldEditMap = {
      tracking:    ["tracking"],
      weight_kg:   ["peso", "weight", "kg", "kilo"],
      origin:      ["origen", "origin", "pais", "país"],
      service:     ["modalidad", "servicio", "service", "express", "normal"],
      description: ["descripcion", "descripción", "description", "producto"],
      client_number: ["cliente", "client", "numero de cliente", "número de cliente"],
      tracking:    ["tracking", "codigo de seguimiento", "código de seguimiento"],
    };

    let fieldToEdit = null;
    for (const [field, keywords] of Object.entries(fieldEditMap)) {
      if (keywords.some(k => lower.includes(k))) {
        fieldToEdit = field;
        break;
      }
    }

    // Si detectó un campo a modificar, volver al collect con ese campo borrado
    if (fieldToEdit && lower !== "correcto" && !isBackCommand(msg)) {
      const draft = { ...(current.draft || {}) };
      delete draft[fieldToEdit];

      // Intentar extraer el nuevo valor directamente del mensaje
      const newDraft = enrichOperatorDraftFromText(msg, draft);

      await upsertDraft(sessionKey, "operator", "op_create_shipment_collect", newDraft);

      const miss = [];
      if (!newDraft.client_number) miss.push("número de cliente");
      if (!newDraft.origin)        miss.push("origen");
      if (!newDraft.service)       miss.push("modalidad");
      if (!newDraft.weight_kg)     miss.push("peso");
      if (!newDraft.tracking)      miss.push("tracking");
      if (!newDraft.description)   miss.push("descripción");

      if (miss.length) {
        return res.json({
          ok: true,
          result: { text: `Perfecto. Actualizando ${fieldToEdit}.

Mandame el nuevo valor para: ${miss.join(", ")}.` }
        });
      }

      // Si tiene todo, regenerar preview directamente
      const preview = await buildPreview(newDraft);
      await upsertDraft(sessionKey, "operator", "op_create_shipment_confirm", { draft: newDraft, preview });
      return res.json({ ok: true, result: { text: "Dato actualizado.\n\n" + buildPreviewMessage(preview) } });

    }

    if (lower === "correcto") {
      const preview = current.preview;
      if (!preview) {
        await clearDraft(sessionKey);
        await upsertDraft(sessionKey, "operator", "operator_menu", {});
        return res.json({ ok: true, result: { text: 'Perdí el preview anterior. Volvé a escribir "crear envio".' } });
      }

      await createShipmentFromPreview(preview);
      await clearDraft(sessionKey);
      await upsertDraft(sessionKey, "operator", "operator_menu", {});

      return res.json({
        ok: true,
        result: {
          text: [
            "✅ Envío creado correctamente",
            "",
            `Cliente: ${preview.client.name} (#${preview.client.client_number})`,
            `Código paquete: ${preview.package_code}`,
            `Tracking: ${preview.tracking}`,
            `Estimado: ${preview.estimated_usd} USD`,
            "",
            "El sistema va a seguir notificando al cliente por WhatsApp según los estados.",
            "",
            'Escribí "menu" para seguir operando.',
          ].join("\n"),
        },
      });
    }

    if (isBackCommand(msg)) {
      await upsertDraft(sessionKey, "operator", "op_create_shipment_collect", current.draft || {});
      return res.json({ ok: true, result: { text: "Perfecto. Volvemos al borrador.\n\n" + buildAskMissingMessage(current.draft || {}) } });
    }

    return res.json({ ok: true, result: { text: buildPreviewMessage(current.preview) } });
  }

  if (session?.step === "op_create_shipment_collect") {
    let draft = enrichOperatorDraftFromText(msg, current || {});

    const inferredClientByName = !draft.client_number && draft.customer_name
      ? await findClientByLooseName(draft.customer_name)
      : null;

    if (!draft.client_number && inferredClientByName?.client_number) {
      draft.client_number = inferredClientByName.client_number;
    }

    if (!draft.origin || (draft.service === "EXPRESS" && !draft.origin && String(msg).includes("1504-"))) {
      const inf = inferOriginServiceFromText(msg);
      if (inf.ambiguous_1504 && !draft.origin) {
        await upsertDraft(sessionKey, "operator", "op_create_shipment_collect", draft);
        return res.json({
          ok: true,
          result: { text: "Detecté etiqueta 1504, que puede ser EXPRESS. Decime el país de origen: USA o CHINA." }
        });
      }
    }

    if (draft.origin === "EUROPA") draft.service = "NORMAL";

    if (draft.charge_real_weight === undefined) {
      const parsedCharge = parseChargeMode(msg);
      if (parsedCharge === null) {
        const miss = missingFields(draft);
        if (miss.length) {
          await upsertDraft(sessionKey, "operator", "op_create_shipment_collect", draft);
          return res.json({ ok: true, result: { text: buildAskMissingMessage(draft) + "\n\nAdemás, decime si la tarifa se cobra por kg mínimo o peso real." } });
        }

        await upsertDraft(sessionKey, "operator", "op_create_shipment_collect", draft);
        return res.json({
          ok: true,
          result: { text: 'Perfecto. Antes de generar el preview, decime si se cobra por "kg mínimo" o por "peso real".' }
        });
      }
      draft.charge_real_weight = parsedCharge;
    }

    const miss = missingFields(draft);
    if (miss.length) {
      await upsertDraft(sessionKey, "operator", "op_create_shipment_collect", draft);
      return res.json({ ok: true, result: { text: buildAskMissingMessage(draft) } });
    }

    const preview = await buildPreview(draft);
    await upsertDraft(sessionKey, "operator", "op_create_shipment_confirm", { draft, preview });
    return res.json({ ok: true, result: { text: buildPreviewMessage(preview) } });
  }

  await clearDraft(sessionKey);
  await upsertDraft(sessionKey, "operator", "operator_menu", {});
  return res.json({ ok: true, result: { text: buildOperatorMenu() } });
}

function buildOperatorContactAlert(draft, phoneOrSession) {
  const possiblePhone = draft.customer_phone || phoneOrSession || "";
  const cleanPhone = normalizePhone(possiblePhone);
  const customerPhone = looksLikeRealPhone(cleanPhone) ? cleanPhone : null;
  const rawChatId = draft.raw_chat_id || phoneOrSession || "-";
  const customerName = draft.customer_name || "Cliente";
  const clientEmail = draft.client_email || draft.contact_email || null;
  const isVerified = !!draft.verified_client;
  const clientNumber = draft.client_number || null;

  const lines = [
    "🍋 Nueva solicitud de cliente",
    `Nombre: ${customerName}`,
    `Teléfono: ${customerPhone || "no detectado"}`,
    `Chat ID: ${rawChatId}`,
    `Cliente verificado: ${isVerified ? "SI" : "NO"}`,
    `Cliente número: ${clientNumber || "nuevo"}`,
    `Mail: ${clientEmail || "no informado"}`,
    `Producto: ${draft.product_type || "-"}`,
    `Origen: ${draft.origin || "-"}`,
    `Modalidad: ${draft.mode || "-"}`,
    `Peso: ${draft.weight_kg || "-"}`,
    "",
  ];

  if (customerPhone) {
    lines.push(`Abrir chat: https://wa.me/${customerPhone}`);
  } else {
    lines.push("Abrir chat: no disponible por falta de número real");
  }

  lines.push("Responder desde WhatsApp del bot.");
  return lines.join("\n");
}

function isPrivileged(role) {
  return ["operator", "admin", "founder"].includes(String(role || "").toLowerCase());
}

async function ensureDraftsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_operator_drafts (
      id BIGSERIAL PRIMARY KEY,
      external_user_id TEXT UNIQUE NOT NULL,
      actor_role TEXT,
      step TEXT,
      draft_json JSONB,
      auto_mode BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    ALTER TABLE ai_operator_drafts
    ADD COLUMN IF NOT EXISTS auto_mode BOOLEAN NOT NULL DEFAULT FALSE
  `);
}

async function getDraft(externalUserId) {
  const q = await db.query(
    `SELECT * FROM ai_operator_drafts WHERE external_user_id = $1 LIMIT 1`,
    [externalUserId]
  );
  return q.rows[0] || null;
}

async function upsertDraft(externalUserId, actorRole, step, draftJson) {
  await db.query(
    `
    INSERT INTO ai_operator_drafts (external_user_id, actor_role, step, draft_json, updated_at)
    VALUES ($1, $2, $3, $4::jsonb, NOW())
    ON CONFLICT (external_user_id)
    DO UPDATE SET
      actor_role = EXCLUDED.actor_role,
      step = EXCLUDED.step,
      draft_json = EXCLUDED.draft_json,
      updated_at = NOW()
    `,
    [externalUserId, actorRole, step, JSON.stringify(draftJson || {})]
  );
}

async function clearDraft(externalUserId) {
  await db.query(`DELETE FROM ai_operator_drafts WHERE external_user_id = $1`, [externalUserId]);
}

async function getClientByPhone(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  const q = await db.query(
    `
    SELECT id, name, client_number, email, phone, active, created_at
    FROM users
    WHERE regexp_replace(COALESCE(phone,''), '\D', '', 'g') = $1
    ORDER BY id ASC
    LIMIT 1
    `,
    [normalized]
  );
  return q.rows[0] || null;
}

async function getClientByNumberAndEmail(clientNumber, email) {
  const q = await db.query(
    `
    SELECT id, name, client_number, email, phone, active
    FROM users
    WHERE client_number = $1
      AND LOWER(COALESCE(email, '')) = LOWER($2)
      AND COALESCE(active, true) = true
    LIMIT 1
    `,
    [clientNumber, email]
  );
  return q.rows[0] || null;
}

async function enqueueWhatsApp(phone, message) {
  const normalized = normalizePhone(phone);
  if (!normalized || !normalizeText(message)) return false;

  await db.query(
    `INSERT INTO wa_notifications (phone, message, status, created_at)
     VALUES ($1, $2, 'pending', NOW())`,
    [normalized, String(message)]
  );

  return true;
}

function baseDraft(existingClient, actorName, phone, rawChatId, sessionKey) {
  return {
    client_found: !!existingClient,
    customer_phone: looksLikeRealPhone(phone) ? normalizePhone(phone) : "",
    raw_chat_id: rawChatId || sessionKey,
    customer_name: actorName || existingClient?.name || null,
    verified_client: false,
    verify_attempts: 0,
    client_number: null,
    client_email: null,
  };
}

router.post("/message", async (req, res) => {
  try {
    await ensureDraftsTable();

    const { text, actorRole, externalUserId, phone, rawChatId, actorName } = req.body || {};
    const msg = normalizeText(text);
    const lower = msg.toLowerCase();
    const role = String(actorRole || "").toLowerCase();
    const sessionKey = String(externalUserId || rawChatId || phone || "internal");
    const session = await getDraft(sessionKey);
    const current = session?.draft_json || {};
    const existingClient = await getClientByPhone(phone || "");

    if (isPrivileged(role)) {
      return handleOperatorMode({ msg, lower, sessionKey, session, current, res, phone, rawChatId, actorName });
    }

    // Si el cliente esta esperando operador: solo reactivar si pide bot explicitamente
    // Si el session step es un paso activo del bot (main_menu, quote_*, etc), no bloquear
    const activeSteps = ["main_menu","info","quote_product_type","quote_origin","quote_mode",
      "quote_weight","quote_type","quote_invoice","quote_goods_value","quote_maritime_proforma",
      "quote_maritime_invoice","quote_weight_under1kg","quote_weight_multi","quote_ask_deposit","quote_operator_wait",
      "deposit_name","deposit_origin","deposit_mode","deposit_ready",
      "client_verify","new_client_name","client_tracking_list","client_tracking_detail"];
    const isActiveFlow = activeSteps.includes(session?.step);
    if (session?.actor_role === "waiting_operator" && !isActiveFlow) {
      if (isBotReactivationCommand(msg)) {
        await clearDraft(sessionKey);
        const draft = baseDraft(existingClient, actorName, phone, rawChatId, sessionKey);
        await upsertDraft(sessionKey, role || "guest", "main_menu", draft);
        return res.json({
          ok: true,
          result: { text: "Perfecto, te paso con el bot.\n\n" + buildMainMenu() }
        });
      }
      // No es reactivacion — callarse completamente, el operador atiende
      return res.json({ ok: true, result: { text: null } });
    }

    if (isMenuCommand(msg)) {
      const draft = baseDraft(existingClient, actorName, phone, rawChatId, sessionKey);
      await clearDraft(sessionKey);
      await upsertDraft(sessionKey, role || "guest", "welcome", draft);
      return res.json({ ok: true, result: { text: "Perfecto. Volvemos al inicio.\n\n" + buildWelcome() } });
    }

    if (isBackCommand(msg) && session?.step) {
      const prevStep = previousStepFor(session.step);
      const draft = { ...current };

      if (session.step === "quote_goods_value") delete draft.goods_value;
      if (session.step === "quote_invoice") delete draft.has_invoice;
      if (session.step === "quote_maritime_invoice") delete draft.has_invoice;
      if (session.step === "quote_maritime_proforma") delete draft.has_proforma;
      if (session.step === "quote_type") delete draft.quote_type;
      if (session.step === "quote_weight") delete draft.weight_kg;
      if (session.step === "quote_mode") delete draft.mode;
      if (session.step === "quote_origin") delete draft.origin;
      if (session.step === "quote_product_type") delete draft.product_type;
      if (session.step === "deposit_mode") delete draft.mode;
      if (session.step === "deposit_origin") delete draft.origin;
      if (session.step === "deposit_name") delete draft.customer_name;
      if (session.step === "deposit_operator_email") delete draft.contact_email;

      await upsertDraft(sessionKey, role || "guest", prevStep, draft);
      return res.json({ ok: true, result: { text: "Perfecto. Volvemos un paso atrás.\n\n" + promptForStep(prevStep, draft) } });
    }

    if (!session?.step) {
      const draft = baseDraft(existingClient, actorName, phone, rawChatId, sessionKey);
      await upsertDraft(sessionKey, role || "guest", "welcome", draft);
      return res.json({ ok: true, result: { text: buildWelcome() } });
    }

    if (session.step === "welcome") {
      if (msg === "1") {
        await upsertDraft(sessionKey, role || "guest", "client_verify", { ...current, verify_attempts: 0 });
        return res.json({ ok: true, result: { text: buildClientVerifyAsk() } });
      }

      if (msg === "2") {
        await upsertDraft(sessionKey, role || "guest", "new_client_name", { ...current, verified_client: false });
        return res.json({ ok: true, result: { text: "Perfecto. Decime tu nombre para atenderte y seguir con la operación." } });
      }

      return res.json({ ok: true, result: { text: buildWelcome() } });
    }

    if (session.step === "client_verify") {
      const parsed = parseClientCredentials(msg);
      if (!parsed) {
        return res.json({ ok: true, result: { text: "No pude leer los datos. Pasame número de cliente y mail, uno debajo del otro." } });
      }

      const match = await getClientByNumberAndEmail(parsed.client_number, parsed.email);
      if (match) {
        const draft = {
          ...current,
          verified_client: true,
          client_found: true,
          client_id: match.id,
          client_number: match.client_number,
          client_email: match.email,
          customer_name: match.name || current.customer_name || actorName || null,
        };
        await upsertDraft(sessionKey, role || "guest", "main_menu", draft);

        return res.json({
          ok: true,
          result: {
            text: [
              "Perfecto. Validé tus datos correctamente.",
              `• Cliente número: ${match.client_number}`,
              `• Mail: ${match.email || "-"}`,
              "",
              buildMainMenu(),
            ].join("\n"),
          },
        });
      }

      const attempts = Number(current.verify_attempts || 0) + 1;
      if (attempts < 2) {
        await upsertDraft(sessionKey, role || "guest", "client_verify", { ...current, verify_attempts: attempts });
        return res.json({ ok: true, result: { text: "No pude validar esos datos. Revisalos y pasamelos nuevamente." } });
      }

      await upsertDraft(sessionKey, role || "guest", "new_client_name", {
        ...current,
        verified_client: false,
        verify_attempts: attempts,
      });

      return res.json({ ok: true, result: { text: "No pude validar los datos después de dos intentos, así que seguimos como cliente nuevo.\n\nDecime tu nombre para continuar." } });
    }

    if (session.step === "new_client_name") {
      const draft = { ...current, customer_name: msg, verified_client: false, client_found: false };
      await upsertDraft(sessionKey, role || "guest", "main_menu", draft);
      return res.json({ ok: true, result: { text: `Perfecto, ${msg}.\n\n${buildMainMenu()}` } });
    }

    if (session.step === "main_menu") {
      if (msg === "1" || lower.includes("inform")) {
        await upsertDraft(sessionKey, role || "guest", "info", current);
        return res.json({ ok: true, result: { text: buildInfoMessage() } });
      }

      if (msg === "2") {
        await upsertDraft(sessionKey, role || "guest", "quote_product_type", current);
        return res.json({ ok: true, result: { text: "Perfecto. Decime el tipo de producto que querés traer." } });
      }

      if (msg === "3") {
        const nextStep = current.customer_name ? "deposit_origin" : "deposit_name";
        await upsertDraft(sessionKey, role || "guest", nextStep, current);
        if (nextStep === "deposit_name") {
          return res.json({ ok: true, result: { text: "Perfecto. Decime tu nombre para atenderte y preparar tu rótulo." } });
        }
        return res.json({ ok: true, result: { text: "Bien. ¿Cuál es el país de origen de la carga? Respondé USA, CHINA o EUROPA." } });
      }

      if (msg === "4" || lower.includes("seguimiento") || lower.includes("mis cargas")) {
        if (!current.verified_client || !current.client_id) {
          return res.json({
            ok: true,
            result: { text: "Para ver tus cargas y seguimiento primero necesitás validarte como cliente activo con tu número y mail." }
          });
        }

        const rows = await getClientShipments(current.client_id);
        await upsertDraft(sessionKey, role || "guest", "client_tracking_list", current);
        return res.json({
          ok: true,
          result: { text: buildClientShipmentsListMessage(current.customer_name, rows) }
        });
      }

      if (msg === "5" || lower.includes("operador") || lower.includes("hablar con operador")) {
        const draftOp = {
          ...current,
          customer_phone: looksLikeRealPhone(phone) ? normalizePhone(phone) : current.customer_phone || "",
          raw_chat_id: rawChatId || sessionKey,
        };
        await upsertDraft(sessionKey, role || "waiting_operator", "waiting_operator", draftOp);

        // Sincronizar con CRM para que wa_conversations quede en waiting_operator
        try {
          const crmPhone = looksLikeRealPhone(phone) ? normalizePhone(phone) : "";
          if (crmPhone) {
            await db.query(
              `UPDATE wa_conversations
               SET mode = 'waiting_operator',
                   needs_operator = TRUE,
                   updated_at = NOW()
               WHERE phone = $1`,
              [crmPhone]
            );
          }
        } catch (crmErr) {
          console.log("[CRM SYNC operator] error:", crmErr?.message);
        }

        if (canNotifyOperator(phone)) {
          await enqueueWhatsApp(OPERATOR_PHONE, [
            "Cliente solicita operador desde menu",
            "",
            "Nombre: " + (current.customer_name || actorName || "-"),
            "Telefono: " + (looksLikeRealPhone(phone) ? normalizePhone(phone) : "-"),
            "Cliente verificado: " + (current.verified_client ? "SI" : "NO"),
            current.client_number ? "Cliente #" + current.client_number : "",
            "",
            "Entra al CRM para atenderlo.",
          ].filter(Boolean).join("\n"));
        }
        return res.json({
          ok: true,
          result: { text: "Perfecto! Un operador te va a contestar a la brevedad.\n\nSi querés que te guíe el bot mientras esperás, escribí: guíame" }
        });
      }

      return res.json({ ok: true, result: { text: buildMainMenu() } });
    }

    if (session.step === "info") {
      if (msg === "1") return res.json({ ok: true, result: { text: buildInfoMessage() } });

      if (msg === "2") {
        await upsertDraft(sessionKey, role || "guest", "quote_product_type", current);
        return res.json({ ok: true, result: { text: "Perfecto. Decime el tipo de producto que querés traer." } });
      }

      if (msg === "3") {
        const nextStep = current.customer_name ? "deposit_origin" : "deposit_name";
        await upsertDraft(sessionKey, role || "guest", nextStep, current);
        if (nextStep === "deposit_name") {
          return res.json({ ok: true, result: { text: "Perfecto. Decime tu nombre para atenderte y preparar tu rótulo." } });
        }
        return res.json({ ok: true, result: { text: "Bien. ¿Cuál es el país de origen de la carga? Respondé USA, CHINA o EUROPA." } });
      }

      if (msg === "4" || lower.includes("seguimiento") || lower.includes("mis cargas")) {
        if (!current.verified_client || !current.client_id) {
          return res.json({
            ok: true,
            result: { text: "Para ver tus cargas y seguimiento primero necesitás validarte como cliente activo con tu número y mail." }
          });
        }

        const rows = await getClientShipments(current.client_id);
        await upsertDraft(sessionKey, role || "guest", "client_tracking_list", current);
        return res.json({
          ok: true,
          result: { text: buildClientShipmentsListMessage(current.customer_name, rows) }
        });
      }

      return res.json({ ok: true, result: { text: buildMainMenu() } });
    }


    if (session.step === "client_tracking_list") {
      if (!current.verified_client || !current.client_id) {
        await upsertDraft(sessionKey, role || "guest", "main_menu", current);
        return res.json({ ok: true, result: { text: "Para ver tus cargas primero necesitás estar validado como cliente." } });
      }

      const code = normalizeText(msg);
      const shipment = await getClientShipmentByCode(current.client_id, code);

      if (!shipment) {
        return res.json({
          ok: true,
          result: { text: "No encontré una carga con ese código dentro de tu cuenta.\n\nMandame el código exacto del paquete o escribí menú." }
        });
      }

      await upsertDraft(sessionKey, role || "guest", "client_tracking_detail", current);
      return res.json({
        ok: true,
        result: { text: buildClientShipmentDetailMessage(shipment) }
      });
    }

    if (session.step === "client_tracking_detail") {
      if (!current.verified_client || !current.client_id) {
        await upsertDraft(sessionKey, role || "guest", "main_menu", current);
        return res.json({ ok: true, result: { text: buildMainMenu() } });
      }

      const code = normalizeText(msg);
      const shipment = await getClientShipmentByCode(current.client_id, code);

      if (!shipment) {
        return res.json({
          ok: true,
          result: { text: "No encontré una carga con ese código dentro de tu cuenta.\n\nMandame otro código exacto o escribí menú." }
        });
      }

      return res.json({
        ok: true,
        result: { text: buildClientShipmentDetailMessage(shipment) }
      });
    }

    if (session.step === "quote_product_type") {
      const draft = { ...current, product_type: msg };
      await upsertDraft(sessionKey, role || "guest", "quote_origin", draft);
      return res.json({ ok: true, result: { text: "Bien. ¿Cuál es el país de origen de la carga?" } });
    }

    if (session.step === "quote_origin") {
      const origin = normalizeOrigin(msg);
      if (!origin) {
        return res.json({ ok: true, result: { text: "No pude identificar el país de origen. Respondé USA, CHINA o EUROPA." } });
      }

      const draft = { ...current, origin };
      await upsertDraft(sessionKey, role || "guest", "quote_mode", draft);

      if (origin === "EUROPA") {
        return res.json({ ok: true, result: { text: "Perfecto. Europa trabaja con modalidad NORMAL. ¿Sabés aproximadamente cuál es el peso de la carga?" } });
      }

      return res.json({ ok: true, result: { text: "Perfecto. ¿Qué modalidad querés? Respondé NORMAL o EXPRESS." } });
    }

    if (session.step === "quote_mode") {
      if (customerNeedsModeHelp(msg)) {
        return res.json({ ok: true, result: { text: buildModeHelpMessage(current.origin) } });
      }

      const mode = current.origin === "EUROPA" ? "NORMAL" : normalizeService(msg, current.origin);
      if (!mode) {
        return res.json({ ok: true, result: { text: "No pude identificar la modalidad. Respondé NORMAL o EXPRESS. Si querés, también podés preguntarme la diferencia." } });
      }

      const draft = { ...current, mode };
      await upsertDraft(sessionKey, role || "guest", "quote_weight", draft);
      return res.json({ ok: true, result: { text: "Bien. ¿Sabés aproximadamente cuál es el peso de tu carga?" } });
    }

    if (session.step === "quote_weight") {
      const weight = parseWeight(msg);
      if (!weight) {
        return res.json({ ok: true, result: { text: "No pude leer el peso. Mandámelo por ejemplo así: 3 kg" } });
      }

      // Si el peso es menor a 1kg, informar la política y preguntar si son varios productos
      if (weight < 1) {
        const draft = { ...current, weight_kg: weight };
        await upsertDraft(sessionKey, role || "guest", "quote_weight_under1kg", draft);
        return res.json({
          ok: true,
          result: {
            text: [
              `📏 El peso que indicaste es ${weight} kg.`,
              "",
              "Nuestro peso mínimo facturable es *1 kg* por envío.",
              "",
              "¿Cómo es tu caso?",
              "",
              "1️⃣ Es un solo producto de menos de 1 kg → se cobra 1 kg mínimo",
              "2️⃣ Son varios productos pequeños que juntos suman o superan 1 kg → cada uno se cobra por su peso real",
              "",
              "Respondé 1 o 2.",
            ].join("\n")
          }
        });
      }

      const draft = { ...current, weight_kg: weight };
      await upsertDraft(sessionKey, role || "guest", "quote_type", draft);
      return res.json({ ok: true, result: { text: "¿La cotización que necesitás es AÉREA o MARÍTIMA?" } });
    }

    if (session.step === "quote_weight_under1kg") {
      if (msg === "1") {
        // Un solo producto — cobrar 1kg mínimo
        const draft = { ...current, charge_real_weight: false };
        await upsertDraft(sessionKey, role || "guest", "quote_type", draft);
        return res.json({
          ok: true,
          result: {
            text: [
              `Perfecto. Se va a cotizar con el mínimo facturable de *1 kg*.`,
              `Tu peso real (${current.weight_kg} kg) se factura como 1 kg.`,
              "",
              "¿La cotización que necesitás es AÉREA o MARÍTIMA?"
            ].join("\n")
          }
        });
      }

      if (msg === "2") {
        // Varios productos — pedir el peso total sumado
        await upsertDraft(sessionKey, role || "guest", "quote_weight_multi", current);
        return res.json({
          ok: true,
          result: {
            text: [
              "Perfecto. Para varios productos pequeños, cada uno se cobra por su peso real.",
              "",
              "¿Cuál es el peso total sumado de todos los productos? (ej: 1.8 kg)"
            ].join("\n")
          }
        });
      }

      // Respuesta no reconocida
      return res.json({ ok: true, result: { text: "Respondé *1* si es un solo producto o *2* si son varios productos pequeños." } });
    }

    if (session.step === "quote_weight_multi") {
      const totalWeight = parseWeight(msg);
      if (!totalWeight || totalWeight <= 0) {
        return res.json({ ok: true, result: { text: "No pude leer el peso total. Mandámelo así: 1.8 kg" } });
      }

      const draft = { ...current, weight_kg: totalWeight, charge_real_weight: true };
      await upsertDraft(sessionKey, role || "guest", "quote_type", draft);
      return res.json({
        ok: true,
        result: {
          text: [
            `Perfecto. Cotizamos ${totalWeight} kg en total (peso real de cada producto).`,
            "",
            "¿La cotización que necesitás es AÉREA o MARÍTIMA?"
          ].join("\n")
        }
      });
    }

    if (session.step === "quote_type") {
      const s = upperNoAccents(msg);
      const quote_type = s.includes("MAR") ? "maritima" : "aerea";
      const draft = { ...current, quote_type };

      if (quote_type === "maritima") {
        await upsertDraft(sessionKey, role || "guest", "quote_maritime_proforma", draft);
        return res.json({ ok: true, result: { text: buildMaritimeIntro() + "\n\n¿Tenés proforma? Respondé SI o NO." } });
      }

      const q = estimateQuote(draft.origin, draft.mode, draft.weight_kg);
      await upsertDraft(sessionKey, role || "guest", "quote_invoice", { ...draft, quote_preview: q });
      return res.json({ ok: true, result: { text: buildEstimateMessage(draft, q) } });
    }

    if (session.step === "quote_invoice") {
      const yn = parseYesNo(msg);
      if (!yn) {
        return res.json({ ok: true, result: { text: "Respondé SI o NO. ¿Tenés factura o invoice para adjuntar?" } });
      }

      const draft = { ...current, has_invoice: yn };
      await upsertDraft(sessionKey, role || "guest", "quote_goods_value", draft);
      return res.json({ ok: true, result: { text: "Perfecto. ¿Sabés el valor total de la mercadería? Si lo sabés, escribilo. Si no, poné NO.\n\nSi tenés la factura en imagen, podés adjuntarla ahora o luego con el operador." } });
    }

    if (session.step === "quote_goods_value") {
      const draft = { ...current, goods_value: msg };
      const customerLabel = draft.customer_name || actorName || "Lead nuevo";
      const q = draft.quote_preview || estimateQuote(draft.origin, draft.mode, draft.weight_kg);

      const alert = [
        "🍋 Nueva solicitud de cotización",
        `Cliente: ${customerLabel}`,
        `Teléfono: ${draft.customer_phone || "no detectado"}`,
        `Chat ID: ${draft.raw_chat_id || sessionKey}`,
        draft.client_number ? `Cliente número: ${draft.client_number}` : "Cliente número: nuevo",
        draft.client_email ? `Mail: ${draft.client_email}` : "Mail: nuevo / no validado",
        `Producto: ${draft.product_type || "-"}`,
        `Origen: ${draft.origin || "-"}`,
        `Modalidad: ${draft.mode || "-"}`,
        `Peso estimado: ${draft.weight_kg || "-"} kg`,
        `Tipo: ${draft.quote_type || "aerea"}`,
        `Tarifa base pública: ${q?.base_rate ?? "-"} USD/kg`,
        `Descuento por volumen: ${q?.volume_discount ?? "-"} USD/kg`,
        `Tarifa estimada final: ${q?.final_rate ?? "-"} USD/kg`,
        `Total estimado: ${q?.estimated_usd ?? "-"} USD`,
        `Invoice: ${draft.has_invoice || "-"}`,
        `Valor total mercadería: ${draft.goods_value || "-"}`,
        "",
        "Responderle cuando el operador esté disponible.",
      ].join("\n");

      await enqueueWhatsApp(OPERATOR_PHONE, alert);
      await upsertDraft(sessionKey, role || "guest", "quote_ask_deposit", draft);

      return res.json({ ok: true, result: { text: "Perfecto. Ya preparé tu solicitud y le avisé al operador. Apenas se conecte, te va a responder con la información correcta.\n\n¿Ya tenés la carga lista para enviar al depósito?\n\n1️⃣ Sí, quiero ver la dirección y el rótulo\n2️⃣ No todavía" } });
    }

    if (session.step === "quote_maritime_proforma") {
      const yn = parseYesNo(msg);
      if (!yn) {
        return res.json({ ok: true, result: { text: "Respondé SI o NO. ¿Tenés proforma?" } });
      }

      const draft = { ...current, has_proforma: yn };
      await upsertDraft(sessionKey, role || "guest", "quote_maritime_invoice", draft);
      return res.json({ ok: true, result: { text: "¿Tenés invoice? Respondé SI o NO." } });
    }

    if (session.step === "quote_maritime_invoice") {
      const yn = parseYesNo(msg);
      if (!yn) {
        return res.json({ ok: true, result: { text: "Respondé SI o NO. ¿Tenés invoice?" } });
      }

      const draft = { ...current, has_invoice: yn };
      const customerLabel = draft.customer_name || actorName || "Lead nuevo";

      const alert = [
        "🍋 Nueva solicitud de cotización marítima",
        `Cliente: ${customerLabel}`,
        `Teléfono: ${draft.customer_phone || "no detectado"}`,
        `Chat ID: ${draft.raw_chat_id || sessionKey}`,
        draft.client_number ? `Cliente número: ${draft.client_number}` : "Cliente número: nuevo",
        draft.client_email ? `Mail: ${draft.client_email}` : "Mail: nuevo / no validado",
        `Producto: ${draft.product_type || "-"}`,
        `Origen: ${draft.origin || "-"}`,
        `Modalidad: ${draft.mode || "-"}`,
        `Peso estimado: ${draft.weight_kg || "-"} kg`,
        `Proforma: ${draft.has_proforma || "-"}`,
        `Invoice: ${draft.has_invoice || "-"}`,
        "",
        "El cliente pide cotización marítima. Responderle como operador.",
      ].join("\n");

      await enqueueWhatsApp(OPERATOR_PHONE, alert);
      await upsertDraft(sessionKey, role || "guest", "quote_ask_deposit", draft);

      return res.json({ ok: true, result: { text: "Perfecto. Ya le avisé al operador que necesitás cotización marítima. Apenas se conecte, te va a responder con la información correcta.\n\n¿Ya tenés la carga lista para enviar al depósito?\n\n1️⃣ Sí, quiero ver la dirección y el rótulo\n2️⃣ No todavía" } });
    }

    if (session.step === "deposit_name") {
      const draft = { ...current, customer_name: msg };
      await upsertDraft(sessionKey, role || "guest", "deposit_origin", draft);
      return res.json({ ok: true, result: { text: "Bien. ¿Cuál es el país de origen de la carga? Respondé USA, CHINA o EUROPA." } });
    }

    if (session.step === "deposit_origin") {
      const origin = normalizeOrigin(msg);
      if (!origin) {
        return res.json({ ok: true, result: { text: "No pude identificar el país. Respondé USA, CHINA o EUROPA." } });
      }

      const draft = { ...current, origin };
      if (origin === "EUROPA") {
        draft.mode = "NORMAL";
        await upsertDraft(sessionKey, role || "guest", "deposit_ready", draft);
        return res.json({ ok: true, result: { text: buildDepositReadyMessage(draft) } });
      }

      await upsertDraft(sessionKey, role || "guest", "deposit_mode", draft);
      return res.json({ ok: true, result: { text: "¿Ya sabés qué modalidad querés? Respondé NORMAL o EXPRESS." } });
    }

    if (session.step === "deposit_mode") {
      if (customerNeedsModeHelp(msg)) {
        return res.json({ ok: true, result: { text: buildModeHelpMessage(current.origin) } });
      }

      const mode = normalizeService(msg, current.origin);
      if (!mode) {
        return res.json({ ok: true, result: { text: "No pude identificar la modalidad. Respondé NORMAL o EXPRESS. Si querés, también podés preguntarme la diferencia." } });
      }

      const draft = { ...current, mode };
      await upsertDraft(sessionKey, role || "guest", "deposit_ready", draft);
      return res.json({ ok: true, result: { text: buildDepositReadyMessage(draft) } });
    }

    if (session.step === "deposit_ready") {
      if (msg === "1") {
        await clearDraft(sessionKey);
        await upsertDraft(sessionKey, role || "guest", "main_menu", {
          ...current,
          customer_phone: looksLikeRealPhone(phone) ? normalizePhone(phone) : current.customer_phone || "",
          raw_chat_id: rawChatId || sessionKey,
        });
        return res.json({ ok: true, result: { text: buildMainMenu() } });
      }

      if (msg === "2") {
        const draft = {
          ...current,
          customer_phone: looksLikeRealPhone(phone) ? normalizePhone(phone) : current.customer_phone || "",
          raw_chat_id: rawChatId || sessionKey,
        };

        if (draft.verified_client && draft.client_email) {
          const alert = buildOperatorContactAlert(draft, phone || sessionKey);
          await enqueueWhatsApp(OPERATOR_PHONE, alert);
          await clearDraft(sessionKey);
          await upsertDraft(sessionKey, role || "guest", "quote_operator_wait", draft);
          return res.json({ ok: true, result: { text: "Perfecto. Ya le avisé al operador y apenas se conecte te va a responder con la información correcta." } });
        }

        await clearDraft(sessionKey);
        await upsertDraft(sessionKey, role || "guest", "deposit_operator_email", draft);
        return res.json({ ok: true, result: { text: "Perfecto. Antes de avisarle al operador, pasame un email de contacto." } });
      }

      return res.json({ ok: true, result: { text: "Perfecto, ¿alguna cosa más que necesites?\n\n1. Volver al menú principal\n2. Hablar con un operador" } });
    }

    if (session.step === "deposit_operator_email") {
      const email = normalizeEmail(msg);
      if (!email || !email.includes("@")) {
        return res.json({ ok: true, result: { text: "No pude identificar el mail. Pasame un email de contacto válido." } });
      }

      const draft = { ...current, contact_email: email };
      const alert = buildOperatorContactAlert(draft, phone || sessionKey);
      await enqueueWhatsApp(OPERATOR_PHONE, alert);
      await clearDraft(sessionKey);
      await upsertDraft(sessionKey, role || "guest", "quote_operator_wait", draft);

      return res.json({ ok: true, result: { text: "Perfecto. Ya le avisé al operador y apenas se conecte te va a responder con la información correcta." } });
    }

    if (session.step === "quote_ask_deposit") {
      if (msg === "1") {
        // Quiere ver dirección del depósito — copiar flujo deposit
        const draft = { ...current };
        // Si ya tenemos origin y mode del flujo de cotización, usarlos
        if (draft.origin && (draft.mode || draft.origin === "EUROPA")) {
          draft.mode = draft.mode || "NORMAL";
          await upsertDraft(sessionKey, role || "guest", "deposit_ready", draft);
          return res.json({ ok: true, result: { text: buildDepositReadyMessage(draft) } });
        }
        // Si falta origin, pedirlo
        if (!draft.origin) {
          await upsertDraft(sessionKey, role || "guest", "deposit_origin", draft);
          return res.json({ ok: true, result: { text: "¿Cuál es el país de origen de la carga? Respondé USA, CHINA o EUROPA." } });
        }
        // Si falta mode
        if (!draft.mode) {
          await upsertDraft(sessionKey, role || "guest", "deposit_mode", draft);
          return res.json({ ok: true, result: { text: "¿Qué modalidad querés? Respondé NORMAL o EXPRESS." } });
        }
        await upsertDraft(sessionKey, role || "guest", "deposit_ready", draft);
        return res.json({ ok: true, result: { text: buildDepositReadyMessage(draft) } });
      }

      // No tiene carga lista — ir al wait normal
      await upsertDraft(sessionKey, role || "guest", "quote_operator_wait", current);
      return res.json({ ok: true, result: { text: "Perfecto. Cuando estés listo para enviar la carga al depósito, escribime y te mando la dirección y el rótulo.\n\n¿Necesitás algo más?\n\n1️⃣ Ver información del servicio\n2️⃣ Hacer otra cotización\n3️⃣ Ya tengo carga para el depósito" } });
    }

    if (session.step === "quote_operator_wait") {
      if (msg === "1") {
        await clearDraft(sessionKey);
        await upsertDraft(sessionKey, role || "guest", "info", {
          ...current,
          customer_phone: looksLikeRealPhone(phone) ? normalizePhone(phone) : current.customer_phone || "",
          raw_chat_id: rawChatId || sessionKey,
        });
        return res.json({ ok: true, result: { text: buildInfoMessage() } });
      }

      if (msg === "2") {
        await clearDraft(sessionKey);
        await upsertDraft(sessionKey, role || "guest", "quote_product_type", {
          ...current,
          customer_phone: looksLikeRealPhone(phone) ? normalizePhone(phone) : current.customer_phone || "",
          raw_chat_id: rawChatId || sessionKey,
        });
        return res.json({ ok: true, result: { text: "Perfecto. Arrancamos de nuevo. Decime el tipo de producto que querés traer." } });
      }

      if (msg === "3") {
        await clearDraft(sessionKey);
        await upsertDraft(sessionKey, role || "guest", "deposit_name", {
          ...current,
          customer_phone: looksLikeRealPhone(phone) ? normalizePhone(phone) : current.customer_phone || "",
          raw_chat_id: rawChatId || sessionKey,
        });
        return res.json({ ok: true, result: { text: "Perfecto. Decime tu nombre para atenderte y preparar tu rótulo." } });
      }

      await clearDraft(sessionKey);
      await upsertDraft(sessionKey, role || "guest", "main_menu", {
        ...current,
        customer_phone: looksLikeRealPhone(phone) ? normalizePhone(phone) : current.customer_phone || "",
        raw_chat_id: rawChatId || sessionKey,
      });
      return res.json({ ok: true, result: { text: buildMainMenu() } });
    }

    const draft = baseDraft(existingClient, actorName, phone, rawChatId, sessionKey);
    await clearDraft(sessionKey);
    await upsertDraft(sessionKey, role || "guest", "welcome", draft);
    return res.json({ ok: true, result: { text: buildWelcome() } });
  } catch (err) {
    console.error("AI_OPERATOR_ERROR:", err);
    return res.status(500).json({ ok: false, error: err.message || "Error interno" });
  }
});

module.exports = router;
