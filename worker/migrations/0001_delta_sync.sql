CREATE TABLE IF NOT EXISTS sync_codes (
    code TEXT PRIMARY KEY,
    total_hits INTEGER NOT NULL DEFAULT 0,
    total_score INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_totals (
    code TEXT NOT NULL,
    date TEXT NOT NULL,
    hits INTEGER NOT NULL DEFAULT 0,
    score INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (code, date)
);

CREATE TABLE IF NOT EXISTS sync_events (
    event_id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    session_id TEXT NOT NULL,
    total_hits INTEGER NOT NULL,
    total_score INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_events_code ON sync_events (code, created_at);
