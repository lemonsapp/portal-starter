// useFeatureFlag — hook skeleton para feature flags.
//
// Sprint 1 (esqueleto): retorna true para todos los flags conocidos. La
// idea es que los componentes ya empiecen a chequear con este hook
// (`if (!useFeatureFlag('chat')) return null`) y en Sprint 4 se conecte a
// /api/config/public para que el admin pueda apagar/prender features.
//
// Flags conocidos (spec § 11): chat, stories, friends, coins, webauthn.

const KNOWN_FLAGS = ["chat", "stories", "friends", "coins", "webauthn"];

const DEFAULTS = {
  chat:     true,
  stories:  true,
  friends:  true,
  coins:    true,
  webauthn: true,
};

export function useFeatureFlag(name) {
  if (!KNOWN_FLAGS.includes(name)) {
    if (typeof console !== "undefined") {
      console.warn(`[featureFlags] flag desconocido: "${name}". Conocidos:`, KNOWN_FLAGS);
    }
    return true;
  }
  return DEFAULTS[name];
}

export const KNOWN_FEATURE_FLAGS = KNOWN_FLAGS;
