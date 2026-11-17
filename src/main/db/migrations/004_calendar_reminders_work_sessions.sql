CREATE TABLE IF NOT EXISTS calendar_events (
    id          TEXT PRIMARY KEY CHECK(length(id) = 36),
    task_id     TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    title       TEXT NOT NULL CHECK(trim(title) != ''),
    description TEXT NOT NULL DEFAULT '',
    start_at    TEXT NOT NULL,
    end_at      TEXT NOT NULL,
    all_day     INTEGER NOT NULL DEFAULT 0 CHECK(all_day IN (0, 1)),
    location    TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_task_id
    ON calendar_events(task_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_start_at
    ON calendar_events(start_at);

CREATE INDEX IF NOT EXISTS idx_calendar_events_end_at
    ON calendar_events(end_at);


CREATE TABLE IF NOT EXISTS task_reminders (
    id           TEXT PRIMARY KEY CHECK(length(id) = 36),
    task_id      TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    remind_at    TEXT NOT NULL,
    dismissed_at TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_task_reminders_task_id
    ON task_reminders(task_id);

CREATE INDEX IF NOT EXISTS idx_task_reminders_remind_at
    ON task_reminders(remind_at);

CREATE INDEX IF NOT EXISTS idx_task_reminders_dismissed_at
    ON task_reminders(dismissed_at);


CREATE TABLE IF NOT EXISTS work_sessions (
    id         TEXT PRIMARY KEY CHECK(length(id) = 36),
    task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title      TEXT NOT NULL CHECK(trim(title) != ''),
    note       TEXT NOT NULL DEFAULT '',
    start_at   TEXT NOT NULL,
    end_at     TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'planned'
               CHECK(status IN ('planned', 'completed', 'cancelled')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_work_sessions_task_id
    ON work_sessions(task_id);

CREATE INDEX IF NOT EXISTS idx_work_sessions_start_at
    ON work_sessions(start_at);

CREATE INDEX IF NOT EXISTS idx_work_sessions_end_at
    ON work_sessions(end_at);

CREATE INDEX IF NOT EXISTS idx_work_sessions_status
    ON work_sessions(status);
