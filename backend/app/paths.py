from __future__ import annotations

import os
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[1]


def storage_dir() -> Path:
    raw = os.getenv("STORAGE_DIR", "").strip()
    if raw:
        path = Path(raw)
    else:
        path = _BACKEND_ROOT / "storage"
    path.mkdir(parents=True, exist_ok=True)
    return path
