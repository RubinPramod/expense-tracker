PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bank','credit_card','cash','wallet','other')),
  institution TEXT,
  currency TEXT NOT NULL DEFAULT 'INR',
  opening_balance_minor INTEGER,
  last_reconciled_balance_minor INTEGER,
  last_reconciled_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES categories(id),
  direction TEXT NOT NULL CHECK (direction IN ('expense','income','both')),
  is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS merchants (
  id TEXT PRIMARY KEY NOT NULL,
  canonical_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS merchant_aliases (
  id TEXT PRIMARY KEY NOT NULL,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  alias_normalized TEXT NOT NULL UNIQUE,
  alias_original TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS counterparties (
  id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  flow TEXT NOT NULL CHECK (flow IN ('expense','income','transfer')),
  kind TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  occurred_at TEXT NOT NULL,
  posted_at TEXT,
  account_id TEXT REFERENCES accounts(id),
  source_account_id TEXT REFERENCES accounts(id),
  destination_account_id TEXT REFERENCES accounts(id),
  category_id TEXT REFERENCES categories(id),
  purpose TEXT NOT NULL DEFAULT 'unknown' CHECK (purpose IN ('office','personal','shared','business','unknown')),
  merchant_id TEXT REFERENCES merchants(id),
  counterparty_id TEXT REFERENCES counterparties(id),
  description_original TEXT NOT NULL,
  description_normalized TEXT NOT NULL,
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'needs_review' CHECK (status IN ('draft','needs_review','confirmed','voided')),
  linked_transaction_id TEXT REFERENCES transactions(id),
  user_edited INTEGER NOT NULL DEFAULT 0 CHECK (user_edited IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_transactions_occurred_at ON transactions(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_account_date ON transactions(account_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference);

CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY NOT NULL,
  source_type TEXT NOT NULL,
  source_label TEXT,
  account_id TEXT REFERENCES accounts(id),
  file_hash TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft','parsed','reviewing','committed','cancelled','failed')),
  row_count INTEGER NOT NULL DEFAULT 0,
  rows_seen INTEGER NOT NULL DEFAULT 0,
  rows_created INTEGER NOT NULL DEFAULT 0,
  rows_skipped INTEGER NOT NULL DEFAULT 0,
  rows_review INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  committed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_import_batches_hash ON import_batches(file_hash);

CREATE TABLE IF NOT EXISTS import_rows (
  id TEXT PRIMARY KEY NOT NULL,
  import_batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  disposition TEXT NOT NULL CHECK (disposition IN ('new','duplicate','invalid','needs_review','committed','skipped')),
  error TEXT,
  transaction_id TEXT REFERENCES transactions(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transaction_sources (
  id TEXT PRIMARY KEY NOT NULL,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  import_batch_id TEXT REFERENCES import_batches(id),
  source_type TEXT NOT NULL,
  source_record_key TEXT,
  source_description TEXT,
  source_payload_hash TEXT,
  source_occurred_at TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sources_key ON transaction_sources(source_type, source_record_key);
CREATE INDEX IF NOT EXISTS idx_sources_transaction ON transaction_sources(transaction_id);

CREATE TABLE IF NOT EXISTS duplicate_candidates (
  id TEXT PRIMARY KEY NOT NULL,
  transaction_id_a TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  transaction_id_b TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  score REAL NOT NULL CHECK (score >= 0 AND score <= 1),
  reasons_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','same_transaction','keep_both','not_duplicate')),
  reviewed_at TEXT,
  UNIQUE(transaction_id_a, transaction_id_b)
);

CREATE TABLE IF NOT EXISTS categorization_rules (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  match_field TEXT NOT NULL DEFAULT 'description' CHECK (match_field IN ('description','merchant','reference','counterparty')),
  operator TEXT NOT NULL DEFAULT 'contains' CHECK (operator IN ('contains','equals','starts_with')),
  pattern TEXT NOT NULL DEFAULT '',
  merchant_alias_pattern TEXT,
  category_id TEXT REFERENCES categories(id),
  purpose TEXT CHECK (purpose IN ('office','personal','shared','business','unknown')),
  flow TEXT CHECK (flow IN ('expense','income','transfer')),
  kind TEXT,
  counterparty_name TEXT,
  priority INTEGER NOT NULL DEFAULT 100,
  is_builtin INTEGER NOT NULL DEFAULT 0 CHECK (is_builtin IN (0,1)),
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recurring_schedules (
  id TEXT PRIMARY KEY NOT NULL,
  label TEXT NOT NULL,
  amount_minor INTEGER,
  currency TEXT NOT NULL DEFAULT 'INR',
  cadence TEXT NOT NULL CHECK (cadence IN ('weekly','monthly','yearly')),
  due_day INTEGER,
  lead_days INTEGER NOT NULL DEFAULT 1,
  next_due_at TEXT,
  account_id TEXT REFERENCES accounts(id),
  category_id TEXT REFERENCES categories(id),
  merchant_id TEXT REFERENCES merchants(id),
  purpose TEXT CHECK (purpose IN ('office','personal','shared','business','unknown')),
  status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested','active','paused','ended')),
  requires_confirmation INTEGER NOT NULL DEFAULT 1 CHECK (requires_confirmation IN (0,1)),
  notification_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS classification_history (
  id TEXT PRIMARY KEY NOT NULL,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  previous_category_id TEXT,
  previous_purpose TEXT NOT NULL,
  previous_status TEXT NOT NULL,
  previous_user_edited INTEGER NOT NULL,
  rule_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_metadata (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
