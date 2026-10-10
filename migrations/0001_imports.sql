CREATE TABLE imports (
  id TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL,
  run_id TEXT,
  store_id TEXT,
  title TEXT
);

CREATE TABLE import_attempts (
  key TEXT PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX import_attempts_time ON import_attempts(created_at);
CREATE INDEX import_attempts_ip ON import_attempts(ip_hash, created_at);
