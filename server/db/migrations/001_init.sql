-- APEX Gym initial schema.
-- Conventions: money = INTEGER rupiah; *_date = gym-local YYYY-MM-DD; *_at = UTC ISO-8601 timestamp.

CREATE TABLE users (
  id             TEXT PRIMARY KEY,
  role           TEXT NOT NULL CHECK (role IN ('MEMBER', 'COACH', 'ADMIN')),
  name           TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  email          TEXT NOT NULL COLLATE NOCASE UNIQUE,
  phone          TEXT NOT NULL,
  phone_digits   TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  avatar_url     TEXT,
  is_active      INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  failed_logins  INTEGER NOT NULL DEFAULT 0,
  locked_until   TEXT,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE sessions (
  token_hash   TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  ip           TEXT,
  user_agent   TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

CREATE TABLE membership_plans (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  duration_days INTEGER NOT NULL CHECK (duration_days > 0),
  price         INTEGER NOT NULL CHECK (price > 0),
  period_label  TEXT NOT NULL,
  features      TEXT NOT NULL DEFAULT '[]',
  is_popular    INTEGER NOT NULL DEFAULT 0,
  is_active     INTEGER NOT NULL DEFAULT 1,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE pt_packages (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  session_count INTEGER NOT NULL CHECK (session_count > 0),
  price         INTEGER NOT NULL CHECK (price > 0),
  description   TEXT NOT NULL DEFAULT '',
  is_popular    INTEGER NOT NULL DEFAULT 0,
  is_active     INTEGER NOT NULL DEFAULT 1,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE member_profiles (
  user_id               TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan_id               TEXT REFERENCES membership_plans(id),
  plan_name             TEXT NOT NULL DEFAULT 'Belum ada paket',
  start_date            TEXT,
  end_date              TEXT,
  suspended             INTEGER NOT NULL DEFAULT 0 CHECK (suspended IN (0, 1)),
  assigned_coach_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  health_notes          TEXT,
  fitness_goal          TEXT NOT NULL DEFAULT 'Kebugaran Umum',
  pt_sessions_remaining INTEGER NOT NULL DEFAULT 0 CHECK (pt_sessions_remaining >= 0),
  referral_code         TEXT NOT NULL UNIQUE,
  referred_by           TEXT REFERENCES users(id) ON DELETE SET NULL,
  version               INTEGER NOT NULL DEFAULT 1,
  updated_at            TEXT NOT NULL
);
CREATE INDEX idx_member_coach ON member_profiles(assigned_coach_id);

CREATE TABLE coach_profiles (
  user_id                 TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name               TEXT NOT NULL,
  title                   TEXT NOT NULL,
  specialties             TEXT NOT NULL DEFAULT '[]',
  certifications          TEXT NOT NULL DEFAULT '[]',
  experience_years        INTEGER NOT NULL DEFAULT 0 CHECK (experience_years >= 0),
  bio                     TEXT NOT NULL DEFAULT '',
  photo_url               TEXT,
  commission_rate_percent INTEGER NOT NULL DEFAULT 40 CHECK (commission_rate_percent BETWEEN 0 AND 100),
  price_per_session       INTEGER NOT NULL DEFAULT 0 CHECK (price_per_session >= 0),
  is_public_approved      INTEGER NOT NULL DEFAULT 0,
  version                 INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE coach_availability (
  coach_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week  INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   TEXT NOT NULL,
  end_time     TEXT NOT NULL,
  is_available INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (coach_id, day_of_week),
  CHECK (end_time > start_time)
);

CREATE TABLE payments (
  id                 TEXT PRIMARY KEY,
  invoice_number     TEXT NOT NULL UNIQUE,
  member_id          TEXT REFERENCES users(id) ON DELETE SET NULL,
  customer_name      TEXT NOT NULL,
  amount             INTEGER NOT NULL CHECK (amount > 0),
  source             TEXT NOT NULL CHECK (source IN ('MEMBERSHIP', 'PT_PACKAGE', 'DAILY_PASS')),
  item_id            TEXT,
  package_name       TEXT NOT NULL,
  -- Duration / session count captured at purchase time, so later price-list edits never change what was bought
  item_quantity      INTEGER,
  status             TEXT NOT NULL CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'EXPIRED', 'REFUNDED')),
  method             TEXT NOT NULL CHECK (method IN ('QRIS', 'TRANSFER_BCA', 'MANUAL_CASH')),
  provider           TEXT NOT NULL CHECK (provider IN ('CASH', 'SIMULATOR', 'MIDTRANS', 'LEGACY')),
  provider_order_id  TEXT UNIQUE,
  provider_ref       TEXT,
  checkout_url       TEXT,
  notes              TEXT,
  created_at         TEXT NOT NULL,
  paid_at            TEXT,
  applied_at         TEXT,
  refunded_at        TEXT,
  refund_reason      TEXT,
  created_by         TEXT,
  confirmed_by       TEXT,
  updated_at         TEXT NOT NULL
);
CREATE INDEX idx_payments_member ON payments(member_id, created_at);
CREATE INDEX idx_payments_status ON payments(status, created_at);

-- Raw provider notifications; event_key makes webhook processing idempotent
CREATE TABLE payment_events (
  id          TEXT PRIMARY KEY,
  payment_id  TEXT REFERENCES payments(id) ON DELETE SET NULL,
  provider    TEXT NOT NULL,
  event_key   TEXT NOT NULL UNIQUE,
  status      TEXT NOT NULL,
  payload     TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE TABLE counters (
  name  TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);

CREATE TABLE expenses (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  amount      INTEGER NOT NULL CHECK (amount > 0),
  category    TEXT NOT NULL CHECK (category IN ('SALARY', 'RENT', 'ELECTRICITY', 'EQUIPMENT_MAINTENANCE', 'MARKETING', 'OTHER')),
  expense_date TEXT NOT NULL,
  notes       TEXT,
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_expenses_date ON expenses(expense_date);

CREATE TABLE check_ins (
  id             TEXT PRIMARY KEY,
  member_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  member_name    TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('GRANTED', 'DENIED')),
  reason         TEXT,
  remaining_days INTEGER,
  method         TEXT NOT NULL CHECK (method IN ('QR', 'MANUAL')),
  scanned_by     TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_checkins_member ON check_ins(member_id, created_at);
CREATE INDEX idx_checkins_time ON check_ins(created_at);

-- Each QR token id can open the gate once (replay protection)
CREATE TABLE qr_tokens_used (
  jti        TEXT PRIMARY KEY,
  member_id  TEXT NOT NULL,
  used_at    TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE exercises (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL,
  primary_muscle  TEXT NOT NULL,
  equipment       TEXT NOT NULL,
  difficulty      TEXT NOT NULL,
  instructions    TEXT NOT NULL DEFAULT '[]',
  form_tips       TEXT NOT NULL DEFAULT '',
  common_mistakes TEXT NOT NULL DEFAULT '',
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE workout_programs (
  id                    TEXT PRIMARY KEY,
  title                 TEXT NOT NULL,
  description           TEXT NOT NULL DEFAULT '',
  target                TEXT NOT NULL,
  level                 TEXT NOT NULL,
  frequency_per_week    INTEGER NOT NULL CHECK (frequency_per_week BETWEEN 1 AND 7),
  duration_weeks        INTEGER NOT NULL CHECK (duration_weeks BETWEEN 1 AND 52),
  assigned_to_member_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_by_coach_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  days                  TEXT NOT NULL DEFAULT '[]',
  created_at            TEXT NOT NULL
);

CREATE TABLE workout_logs (
  id               TEXT PRIMARY KEY,
  member_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date         TEXT NOT NULL,
  title            TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 1 AND 600),
  mood_rating      INTEGER NOT NULL CHECK (mood_rating BETWEEN 1 AND 5),
  notes            TEXT NOT NULL DEFAULT '',
  total_volume_kg  REAL NOT NULL DEFAULT 0,
  exercises        TEXT NOT NULL DEFAULT '[]',
  pr_achieved      INTEGER NOT NULL DEFAULT 0,
  coach_feedback   TEXT,
  created_at       TEXT NOT NULL
);
CREATE INDEX idx_workout_logs_member ON workout_logs(member_id, log_date);

CREATE TABLE food_items (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  indonesian_name TEXT NOT NULL,
  serving_size    TEXT NOT NULL,
  calories        REAL NOT NULL,
  protein         REAL NOT NULL,
  carbs           REAL NOT NULL,
  fat             REAL NOT NULL,
  category        TEXT NOT NULL
);

CREATE TABLE meal_plans (
  member_id              TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  id                     TEXT NOT NULL UNIQUE,
  title                  TEXT NOT NULL,
  coach_id               TEXT REFERENCES users(id) ON DELETE SET NULL,
  target_calories        INTEGER NOT NULL,
  target_protein         INTEGER NOT NULL,
  target_carbs           INTEGER NOT NULL,
  target_fat             INTEGER NOT NULL,
  meals                  TEXT NOT NULL DEFAULT '[]',
  shopping_list          TEXT NOT NULL DEFAULT '[]',
  hydration_target_liters REAL NOT NULL DEFAULT 2.5,
  supplements_advice     TEXT NOT NULL DEFAULT '',
  disclaimer             TEXT NOT NULL DEFAULT '',
  daily_checked          TEXT NOT NULL DEFAULT '[false,false,false,false,false,false,false]',
  version                INTEGER NOT NULL DEFAULT 1,
  updated_at             TEXT NOT NULL
);

CREATE TABLE weekly_checkins (
  id                     TEXT PRIMARY KEY,
  member_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checkin_date           TEXT NOT NULL,
  weight_kg              REAL NOT NULL,
  energy_score           INTEGER NOT NULL CHECK (energy_score BETWEEN 1 AND 5),
  sleep_hours            REAL NOT NULL,
  stress_score           INTEGER NOT NULL CHECK (stress_score BETWEEN 1 AND 5),
  diet_adherence_percent INTEGER NOT NULL CHECK (diet_adherence_percent BETWEEN 0 AND 100),
  notes                  TEXT NOT NULL DEFAULT '',
  coach_reply            TEXT,
  replied_by             TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at             TEXT NOT NULL
);
CREATE INDEX idx_weekly_member ON weekly_checkins(member_id, checkin_date);

CREATE TABLE body_measurements (
  id               TEXT PRIMARY KEY,
  member_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  measured_date    TEXT NOT NULL,
  weight_kg        REAL NOT NULL,
  chest_cm         REAL,
  waist_cm         REAL,
  arm_cm           REAL,
  thigh_cm         REAL,
  body_fat_percent REAL,
  created_at       TEXT NOT NULL
);
CREATE INDEX idx_measurements_member ON body_measurements(member_id, measured_date);

CREATE TABLE progress_photos (
  id          TEXT PRIMARY KEY,
  member_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  photo_date  TEXT NOT NULL,
  weight_kg   REAL NOT NULL DEFAULT 0,
  storage_key TEXT NOT NULL UNIQUE,
  mime_type   TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes  INTEGER NOT NULL,
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_photos_member ON progress_photos(member_id);

CREATE TABLE training_sessions (
  id               TEXT PRIMARY KEY,
  member_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coach_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_date     TEXT NOT NULL,
  session_time     TEXT NOT NULL,
  starts_at        TEXT NOT NULL,
  ends_at          TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
  notes            TEXT,
  coach_feedback   TEXT,
  rating           INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  review_comment   TEXT,
  cancelled_by     TEXT,
  cancelled_at     TEXT,
  credit_refunded  INTEGER,
  created_at       TEXT NOT NULL
);
-- Last line of defence against double booking (the service also checks overlaps)
CREATE UNIQUE INDEX uq_session_coach_slot ON training_sessions(coach_id, starts_at) WHERE status = 'SCHEDULED';
CREATE UNIQUE INDEX uq_session_member_slot ON training_sessions(member_id, starts_at) WHERE status = 'SCHEDULED';
CREATE INDEX idx_sessions_coach_time ON training_sessions(coach_id, starts_at);
CREATE INDEX idx_sessions_member_time ON training_sessions(member_id, starts_at);

CREATE TABLE chat_messages (
  id               TEXT PRIMARY KEY,
  thread_member_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text             TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 2000),
  created_at       TEXT NOT NULL
);
CREATE INDEX idx_chat_thread ON chat_messages(thread_member_id, created_at);

CREATE TABLE satisfaction_surveys (
  id           TEXT PRIMARY KEY,
  member_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  survey_month TEXT NOT NULL,
  survey_date  TEXT NOT NULL,
  cleanliness  INTEGER NOT NULL CHECK (cleanliness BETWEEN 1 AND 5),
  equipment    INTEGER NOT NULL CHECK (equipment BETWEEN 1 AND 5),
  atmosphere   INTEGER NOT NULL CHECK (atmosphere BETWEEN 1 AND 5),
  service      INTEGER NOT NULL CHECK (service BETWEEN 1 AND 5),
  nps_score    INTEGER NOT NULL CHECK (nps_score BETWEEN 0 AND 10),
  suggestions  TEXT NOT NULL DEFAULT '',
  is_complaint INTEGER NOT NULL DEFAULT 0,
  UNIQUE (member_id, survey_month)
);

CREATE TABLE feedback_tickets (
  id             TEXT PRIMARY KEY,
  member_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  member_name    TEXT NOT NULL,
  ticket_date    TEXT NOT NULL,
  category       TEXT NOT NULL CHECK (category IN ('Fasilitas', 'Kebersihan', 'Pelayanan', 'Coach', 'Lainnya')),
  text           TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('BARU', 'DIPROSES', 'SELESAI')),
  admin_response TEXT,
  resolved_at    TEXT,
  created_at     TEXT NOT NULL
);

CREATE TABLE articles (
  id                TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  category          TEXT NOT NULL,
  read_time_minutes INTEGER NOT NULL,
  summary           TEXT NOT NULL,
  content           TEXT NOT NULL,
  published_date    TEXT NOT NULL,
  tags              TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE announcements (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('INFO', 'PENTING', 'GYM_TUTUP', 'PROMO')),
  target_role  TEXT NOT NULL CHECK (target_role IN ('ALL', 'MEMBER', 'COACH')),
  start_date   TEXT NOT NULL,
  end_date     TEXT NOT NULL,
  is_pinned    INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 0,
  version      INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  CHECK (end_date >= start_date)
);

CREATE TABLE audit_logs (
  id         TEXT PRIMARY KEY,
  actor_id   TEXT,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action     TEXT NOT NULL,
  details    TEXT NOT NULL,
  ip         TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_audit_time ON audit_logs(created_at);

CREATE TABLE testimonials (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  role                TEXT NOT NULL,
  duration_member     TEXT NOT NULL,
  rating              INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text                TEXT NOT NULL,
  highlight           TEXT NOT NULL,
  approved_for_public INTEGER NOT NULL DEFAULT 0,
  avatar_url          TEXT
);

CREATE TABLE group_classes (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  category         TEXT NOT NULL,
  day_of_week      INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time       TEXT NOT NULL,
  end_time         TEXT NOT NULL,
  coach_id         TEXT NOT NULL REFERENCES users(id),
  room             TEXT NOT NULL,
  max_capacity     INTEGER NOT NULL CHECK (max_capacity BETWEEN 1 AND 200),
  intensity        TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  version          INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL,
  CHECK (end_time > start_time)
);

CREATE TABLE class_enrollments (
  class_id   TEXT NOT NULL REFERENCES group_classes(id) ON DELETE CASCADE,
  member_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (class_id, member_id)
);

CREATE TABLE equipment (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  category          TEXT NOT NULL,
  location          TEXT NOT NULL,
  status            TEXT NOT NULL CHECK (status IN ('OPERATIONAL', 'NEEDS_SERVICE', 'UNDER_MAINTENANCE')),
  last_service_date TEXT,
  next_service_date TEXT
);

CREATE TABLE equipment_reports (
  id                TEXT PRIMARY KEY,
  equipment_id      TEXT NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  member_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
  member_name       TEXT NOT NULL,
  issue_description TEXT NOT NULL,
  report_date       TEXT NOT NULL,
  status            TEXT NOT NULL CHECK (status IN ('PENDING', 'IN_PROGRESS', 'RESOLVED')),
  admin_notes       TEXT,
  created_at        TEXT NOT NULL
);

CREATE TABLE referral_rewards (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  points_required INTEGER NOT NULL CHECK (points_required > 0),
  description     TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN ('MEMBERSHIP', 'COACHING', 'MERCHANDISE')),
  is_active       INTEGER NOT NULL DEFAULT 1
);

-- Append-only points ledger; the balance is SUM(delta). (ref_type, ref_id, member_id) makes every grant one-shot.
CREATE TABLE points_ledger (
  id         TEXT PRIMARY KEY,
  member_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta      INTEGER NOT NULL CHECK (delta <> 0),
  reason     TEXT NOT NULL,
  ref_type   TEXT NOT NULL,
  ref_id     TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (ref_type, ref_id, member_id)
);

CREATE TABLE reward_claims (
  id         TEXT PRIMARY KEY,
  member_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_id  TEXT NOT NULL REFERENCES referral_rewards(id),
  created_at TEXT NOT NULL,
  UNIQUE (member_id, reward_id)
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
