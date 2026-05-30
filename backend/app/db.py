from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any, Iterable

DB_PATH = Path(__file__).resolve().parents[1] / "storage" / "app.db"


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _connect() as conn:
        conn.executescript(
            """
            PRAGMA journal_mode=WAL;

            CREATE TABLE IF NOT EXISTS sessions (
              id TEXT PRIMARY KEY,
              created_at TEXT NOT NULL,
              target_role TEXT,
              level TEXT,
              language TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS questions (
              id TEXT PRIMARY KEY,
              session_id TEXT NOT NULL,
              created_at TEXT NOT NULL,
              category TEXT,
              difficulty TEXT,
              question TEXT NOT NULL,
              expected_points TEXT,
              FOREIGN KEY (session_id) REFERENCES sessions(id)
            );

            CREATE TABLE IF NOT EXISTS answers (
              id TEXT PRIMARY KEY,
              session_id TEXT NOT NULL,
              question_id TEXT NOT NULL,
              created_at TEXT NOT NULL,
              transcript TEXT,
              audio_path TEXT,
              FOREIGN KEY (session_id) REFERENCES sessions(id),
              FOREIGN KEY (question_id) REFERENCES questions(id)
            );

            CREATE TABLE IF NOT EXISTS evaluations (
              id TEXT PRIMARY KEY,
              answer_id TEXT NOT NULL,
              created_at TEXT NOT NULL,
              rubric_version TEXT NOT NULL,
              overall_score REAL NOT NULL,
              scores_json TEXT NOT NULL,
              feedback TEXT NOT NULL,
              strengths TEXT,
              improvements TEXT,
              followup_questions TEXT,
              FOREIGN KEY (answer_id) REFERENCES answers(id)
            );

            CREATE TABLE IF NOT EXISTS documents (
              id TEXT PRIMARY KEY,
              session_id TEXT NOT NULL,
              created_at TEXT NOT NULL,
              doc_type TEXT NOT NULL, -- resume|cover_letter|other
              filename TEXT,
              mime_type TEXT,
              content_text TEXT NOT NULL,
              source_path TEXT,
              extracted_ok INTEGER NOT NULL DEFAULT 1,
              warning TEXT,
              FOREIGN KEY (session_id) REFERENCES sessions(id)
            );
            """
        )

        # lightweight "migration" for existing sqlite files
        cols = {r["name"] for r in conn.execute("PRAGMA table_info(documents)").fetchall()}
        if "extracted_ok" not in cols:
            conn.execute("ALTER TABLE documents ADD COLUMN extracted_ok INTEGER NOT NULL DEFAULT 1")
        if "warning" not in cols:
            conn.execute("ALTER TABLE documents ADD COLUMN warning TEXT")
        conn.commit()


def execute(sql: str, params: Iterable[Any] = ()) -> None:
    with _connect() as conn:
        conn.execute(sql, tuple(params))
        conn.commit()


def fetch_one(sql: str, params: Iterable[Any] = ()) -> dict[str, Any] | None:
    with _connect() as conn:
        cur = conn.execute(sql, tuple(params))
        row = cur.fetchone()
        return dict(row) if row else None


def fetch_all(sql: str, params: Iterable[Any] = ()) -> list[dict[str, Any]]:
    with _connect() as conn:
        cur = conn.execute(sql, tuple(params))
        rows = cur.fetchall()
        return [dict(r) for r in rows]
