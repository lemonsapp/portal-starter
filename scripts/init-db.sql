-- portal-starter — schema bootstrap
-- Aplicar UNA VEZ contra una Neon vacía:  psql $DATABASE_URL < scripts/init-db.sql
--
-- Este script crea las tablas que NO se auto-crean con migraciones inline en
-- el código. Las que sí se auto-crean (user_stories, user_profiles, profile_items,
-- coupons, referrals, announcements, broadcast_notifications, custom_emojis, etc.)
-- se crean al primer boot del server.
--
-- Origen de columnas: extraídas del backup de lemons-portal abril 2026 +
-- rastreo de queries en server/index.js + server/routes/. Algunas columnas
-- legacy de Lemons (client_number, first_shipment_bonus_given, invite_code en
-- users) se mantienen para compatibilidad con el código actual; se limpian
-- en Sprint 3 cuando se refactorice /auth/register.

BEGIN;

-- ── users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                            SERIAL PRIMARY KEY,
  client_number                 INT UNIQUE,
  name                          TEXT NOT NULL,
  username                      TEXT UNIQUE,
  email                         TEXT UNIQUE NOT NULL,
  password_hash                 TEXT NOT NULL,
  role                          TEXT NOT NULL DEFAULT 'client',  -- client | operator | admin
  phone                         TEXT,
  email_verified                BOOLEAN NOT NULL DEFAULT FALSE,
  active                        BOOLEAN NOT NULL DEFAULT TRUE,
  invite_code                   TEXT,
  referrer_id                   INT REFERENCES users(id),
  first_shipment_bonus_given    BOOLEAN NOT NULL DEFAULT FALSE,  -- legacy Lemons; cleanup en Sprint 3
  scopes                        TEXT,                            -- "operator,admin,…" CSV; null para clients
  last_seen_at                  TIMESTAMPTZ,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email     ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username  ON users(LOWER(username));

-- ── invite codes ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invite_codes (
  id          SERIAL PRIMARY KEY,
  code        TEXT UNIQUE NOT NULL,
  created_by  INT REFERENCES users(id),
  used_by     INT REFERENCES users(id),
  used_at     TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── auth: email verification + password reset ────────────────────────────────
CREATE TABLE IF NOT EXISTS email_verifications (
  id           SERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL,
  token        TEXT,                   -- legacy: algunos verifies usaban token plano (deprecated)
  expires_at   TIMESTAMPTZ NOT NULL,
  verified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_resets (
  id           SERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  used_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── coins ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coins (
  user_id        INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance        INT NOT NULL DEFAULT 0,
  total_earned   INT NOT NULL DEFAULT 0,
  peak_balance   INT NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coin_transactions (
  id           SERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,          -- earn | spend | gift | adjust
  amount       INT NOT NULL,
  reason       TEXT,
  shipment_id  INT,                    -- legacy Lemons (FK opcional, no fuerza)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coin_tx_user ON coin_transactions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS coin_redemptions (
  id           SERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_key     TEXT NOT NULL,
  cost         INT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coin_missions (
  id                  SERIAL PRIMARY KEY,
  slug                TEXT UNIQUE NOT NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  icon                TEXT,
  coins_reward        INT NOT NULL DEFAULT 0,
  mission_type        TEXT NOT NULL,   -- daily | weekly | once | streak
  requirement_type    TEXT,
  requirement_value   INT,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS user_missions (
  id              SERIAL PRIMARY KEY,
  user_id         INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_slug    TEXT NOT NULL,
  progress        INT NOT NULL DEFAULT 0,
  completed_at    TIMESTAMPTZ,
  claimed_at      TIMESTAMPTZ,
  period          TEXT,                 -- ej "2026-W19" para misiones semanales
  UNIQUE(user_id, mission_slug, period)
);

CREATE TABLE IF NOT EXISTS coin_gifts (
  id          SERIAL PRIMARY KEY,
  from_user   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      INT NOT NULL,
  message     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── gamification ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_spin (
  id           SERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  spun_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  coins_won    INT NOT NULL DEFAULT 0,
  prize_label  TEXT
);
CREATE INDEX IF NOT EXISTS idx_daily_spin_user_date ON daily_spin(user_id, spun_at DESC);

CREATE TABLE IF NOT EXISTS login_streaks (
  user_id      INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  streak       INT NOT NULL DEFAULT 0,
  last_login   DATE,
  week_days    JSONB DEFAULT '[]'::jsonb,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── chat ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id           SERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id      INT,                       -- nullable → sala global
  message      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_date ON chat_messages(room_id, created_at DESC);

CREATE TABLE IF NOT EXISTS chat_private_messages (
  id              SERIAL PRIMARY KEY,
  from_user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message         TEXT NOT NULL,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_pm_pair  ON chat_private_messages(from_user_id, to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_pm_to_unread ON chat_private_messages(to_user_id) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS chat_friendships (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending | accepted | blocked
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS chat_rooms (
  id              SERIAL PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  icon            TEXT,
  coins_required  INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_room_access (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id     INT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, room_id)
);

CREATE TABLE IF NOT EXISTS chat_user_roles (
  id           SERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id      INT REFERENCES chat_rooms(id) ON DELETE CASCADE,
  role         TEXT NOT NULL,            -- mod | admin
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_powers (
  id            SERIAL PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  icon          TEXT,
  category      TEXT,
  coins_price   INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_chat_powers (
  id            SERIAL PRIMARY KEY,
  user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  power_slug    TEXT NOT NULL,
  purchased_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, power_slug)
);

-- ── posts / likes / comments / follows ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_posts (
  id           SERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  media_url    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_posts_user ON user_posts(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS post_likes (
  id          SERIAL PRIMARY KEY,
  post_id     INT NOT NULL REFERENCES user_posts(id) ON DELETE CASCADE,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_comments (
  id          SERIAL PRIMARY KEY,
  post_id     INT NOT NULL REFERENCES user_posts(id) ON DELETE CASCADE,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_follows (
  id            SERIAL PRIMARY KEY,
  follower_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(follower_id, followee_id)
);

-- ── webauthn ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id              SERIAL PRIMARY KEY,
  user_id         INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id   TEXT UNIQUE NOT NULL,
  public_key      TEXT NOT NULL,
  counter         BIGINT NOT NULL DEFAULT 0,
  transports      TEXT,
  device_label    TEXT,
  last_used_at    TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,                          -- soft delete; NULL = activa
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id           SERIAL PRIMARY KEY,
  user_id      INT REFERENCES users(id) ON DELETE CASCADE,
  challenge    TEXT NOT NULL,
  type         TEXT NOT NULL,         -- registration | authentication
  consumed_at  TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── notificaciones por usuario (1-a-1; las broadcast viven en broadcast_notifications) ──
CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,           -- friend_request | message | post_like | comment | system
  title       TEXT,
  body        TEXT,
  link        TEXT,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  data        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE read = FALSE;

-- ── presence (last_seen_at ya está en users; columna creada por migración inline si falta) ──
-- ── Sprint 2 NEW: app_config + app_config_history + feed_posts ──────────────

CREATE TABLE IF NOT EXISTS app_config (
  key              TEXT PRIMARY KEY,
  value_encrypted  TEXT,                                       -- iv:authTag:ciphertext en base64 (AES-256-GCM)
  is_secret        BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by       INT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS app_config_history (
  id                SERIAL PRIMARY KEY,
  key               TEXT NOT NULL,
  old_value_hash    TEXT,                                      -- SHA-256 hex del valor previo (NUNCA el valor en sí)
  new_value_hash    TEXT,                                      -- SHA-256 hex del nuevo
  changed_by        INT REFERENCES users(id),
  changed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_app_config_hist_key ON app_config_history(key, changed_at DESC);

CREATE TABLE IF NOT EXISTS feed_posts (
  id          SERIAL PRIMARY KEY,
  type        TEXT NOT NULL DEFAULT 'post',  -- post | story | update
  title       TEXT,
  body        TEXT,
  media_url   TEXT,
  author_id   INT REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ                     -- nullable; para stories que expiran 24hs
);
-- expires_at IS NULL → post permanente; expires_at en futuro → story activa.
-- Filtro de "activos" se hace en el WHERE de la query (no en index predicate
-- porque NOW() no es IMMUTABLE — Postgres lo rechaza).
CREATE INDEX IF NOT EXISTS idx_feed_posts_created  ON feed_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_posts_expires  ON feed_posts(expires_at) WHERE expires_at IS NOT NULL;

-- ─── Seed mínimo ──────────────────────────────────────────────────────────────
-- Sala default para que el chat funcione out-of-the-box. El admin puede crear
-- más salas desde el panel; el frontend usa slug='general' como sala principal.
INSERT INTO chat_rooms (slug, name, description, icon, coins_required, is_active)
VALUES ('general', 'Sala general', 'Charlá con toda la comunidad', '💬', 0, TRUE)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
