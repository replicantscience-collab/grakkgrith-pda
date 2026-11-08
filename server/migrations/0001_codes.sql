-- Item codes: who holds what. Codes themselves are never stored, only their hashes.
CREATE TABLE IF NOT EXISTS holders (
  id TEXT PRIMARY KEY,          -- sha256 of the PDA's secret key
  data TEXT NOT NULL            -- name, staysOut, district, timestamps
);
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  holder TEXT NOT NULL,
  status TEXT NOT NULL,
  data TEXT NOT NULL            -- card, grade, kind, trail, previous holders
);
CREATE INDEX IF NOT EXISTS items_holder ON items (holder, status);
CREATE TABLE IF NOT EXISTS codes (
  hash TEXT PRIMARY KEY,        -- sha256 of the code
  item TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  holder TEXT NOT NULL,
  item TEXT,
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS events_holder ON events (holder, seq);
CREATE TABLE IF NOT EXISTS hits (
  bucket TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS hits_bucket ON hits (bucket, at);
