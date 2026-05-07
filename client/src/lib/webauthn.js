// client/src/lib/webauthn.js
// Helpers para login biométrico (WebAuthn / Passkeys).
// Wrappea @simplewebauthn/browser + helpers de soporte y de localStorage.
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

// ── Detección de soporte ─────────────────────────────────────────────────────
export function supportsWebAuthn() {
  return typeof window !== "undefined"
    && typeof window.PublicKeyCredential !== "undefined"
    && typeof window.navigator?.credentials?.get === "function";
}

export async function supportsPlatformBiometric() {
  if (!supportsWebAuthn()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// ── Display label según plataforma (cosmético, browser elige el método real) ─
export function detectPlatformBiometricLabel() {
  if (typeof navigator === "undefined") return "biometría";
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  if (/iPhone/.test(ua)) return "Face ID";
  if (/iPad/.test(ua) || /Mac/.test(platform)) return "Touch ID";
  if (/Windows/.test(ua)) return "Windows Hello";
  if (/Android/.test(ua)) return "huella";
  return "biometría";
}

// ── Registrar nueva credential (user logueado) ───────────────────────────────
// Devuelve {credentialId, label} si OK, throw con mensaje user-friendly si falla.
export async function registerBiometric({ token, label }) {
  // 1) Pedir options al server
  const optsRes = await fetch(`${API}/auth/webauthn/register/options`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });
  if (!optsRes.ok) {
    const err = await optsRes.json().catch(() => ({}));
    throw new Error(err.error || "No se pudieron obtener las opciones de registro");
  }
  const options = await optsRes.json();

  // 2) Llamar al browser para crear la credential (acá pide Face ID)
  let attResp;
  try {
    attResp = await startRegistration({ optionsJSON: options });
  } catch (e) {
    if (e?.name === "InvalidStateError") {
      throw new Error("Este dispositivo ya está registrado");
    }
    if (e?.name === "NotAllowedError") {
      throw new Error("Cancelaste o la operación expiró");
    }
    throw new Error(e?.message || "Falló el registro biométrico");
  }

  // 3) Mandar response al server para verificar y guardar
  const verRes = await fetch(`${API}/auth/webauthn/register/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ response: attResp, label: label || undefined }),
  });
  if (!verRes.ok) {
    const err = await verRes.json().catch(() => ({}));
    throw new Error(err.error || "El servidor no pudo verificar el registro");
  }
  const data = await verRes.json();
  return { credentialId: data.credential_id, label: data.label };
}

// ── Login con credential ─────────────────────────────────────────────────────
// Devuelve {token, user} si OK, throw si falla.
export async function loginWithBiometric({ email } = {}) {
  // 1) Pedir options (con email opcional)
  const optsRes = await fetch(`${API}/auth/webauthn/login/options`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email || undefined }),
  });
  if (!optsRes.ok) {
    const err = await optsRes.json().catch(() => ({}));
    throw new Error(err.error || "No se pudieron obtener las opciones de login");
  }
  const options = await optsRes.json();

  // 2) Browser pide biometría
  let asseResp;
  try {
    asseResp = await startAuthentication({ optionsJSON: options });
  } catch (e) {
    if (e?.name === "NotAllowedError") {
      throw new Error("Cancelaste o la operación expiró");
    }
    throw new Error(e?.message || "Falló la autenticación biométrica");
  }

  // 3) Verify en server
  const verRes = await fetch(`${API}/auth/webauthn/login/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response: asseResp }),
  });
  if (!verRes.ok) {
    const err = await verRes.json().catch(() => ({}));
    throw new Error(err.error || "El servidor no pudo verificar el login");
  }
  return await verRes.json(); // { token, user }
}

// ── Helpers de localStorage para "este dispositivo tiene biometría activada" ─
const LS_BIOM_ENABLED = "biometric_enabled"; // "1" | undefined
const LS_LAST_EMAIL = "biometric_last_email"; // string | undefined
const LS_DISMISSED = "biometric_dismissed"; // "permanent" | timestamp ms (= "remind in 7 days")

export function markBiometricEnabled(email) {
  try {
    localStorage.setItem(LS_BIOM_ENABLED, "1");
    if (email) localStorage.setItem(LS_LAST_EMAIL, email);
    localStorage.removeItem(LS_DISMISSED);
  } catch {}
}

export function isBiometricEnabledLocally() {
  try {
    return localStorage.getItem(LS_BIOM_ENABLED) === "1";
  } catch {
    return false;
  }
}

export function getLastBiometricEmail() {
  try { return localStorage.getItem(LS_LAST_EMAIL) || ""; } catch { return ""; }
}

export function dismissBiometricPrompt(mode /* "permanent" | "remind7days" */) {
  try {
    if (mode === "permanent") localStorage.setItem(LS_DISMISSED, "permanent");
    else localStorage.setItem(LS_DISMISSED, String(Date.now()));
  } catch {}
}

export function shouldShowBiometricPrompt() {
  try {
    const v = localStorage.getItem(LS_DISMISSED);
    if (!v) return true;
    if (v === "permanent") return false;
    const ts = Number(v);
    if (!Number.isFinite(ts)) return true;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - ts >= sevenDays;
  } catch {
    return true;
  }
}
