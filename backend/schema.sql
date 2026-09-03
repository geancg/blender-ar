-- AR Exporter — schema do banco D1

CREATE TABLE IF NOT EXISTS files (
  id          TEXT    PRIMARY KEY,
  device_id   TEXT    NOT NULL,
  filename    TEXT    NOT NULL,
  size        INTEGER DEFAULT 0,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER,           -- NULL = permanente (Pro)
  is_pro      INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS scans (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id     TEXT    NOT NULL,
  scanned_at  INTEGER NOT NULL,
  user_agent  TEXT
);

CREATE TABLE IF NOT EXISTS tokens (
  token       TEXT    PRIMARY KEY,
  created_at  INTEGER NOT NULL,
  label       TEXT    DEFAULT ''  -- ex: "Gumroad #1234"
);

CREATE INDEX IF NOT EXISTS idx_files_device  ON files(device_id);
CREATE INDEX IF NOT EXISTS idx_files_expires ON files(expires_at);
CREATE INDEX IF NOT EXISTS idx_scans_file    ON scans(file_id);
