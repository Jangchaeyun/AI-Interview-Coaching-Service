from __future__ import annotations

import datetime as dt
import uuid
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from .. import db
from ..paths import storage_dir

router = APIRouter(tags=["sessions"])

STORAGE_DIR = storage_dir()
AUDIO_DIR = STORAGE_DIR / "audio"


class CreateSessionRequest(BaseModel):
    target_role: str | None = None
    level: str | None = Field(default=None, description="junior|mid|senior 등")
    language: Literal["ko", "en"] = "ko"


class SessionResponse(BaseModel):
    id: str
    created_at: str
    target_role: str | None
    level: str | None
    language: str


@router.post("/sessions", response_model=SessionResponse)
def create_session(req: CreateSessionRequest):
    session_id = str(uuid.uuid4())
    created_at = dt.datetime.utcnow().isoformat()
    db.execute(
        "INSERT INTO sessions(id, created_at, target_role, level, language) VALUES(?,?,?,?,?)",
        (session_id, created_at, req.target_role, req.level, req.language),
    )
    return SessionResponse(
        id=session_id,
        created_at=created_at,
        target_role=req.target_role,
        level=req.level,
        language=req.language,
    )


class AnswerResponse(BaseModel):
    id: str
    session_id: str
    question_id: str
    created_at: str
    transcript: str | None
    audio_url: str | None


@router.post("/answers", response_model=AnswerResponse)
async def create_answer(
    session_id: Annotated[str, Form(...)],
    question_id: Annotated[str, Form(...)],
    transcript: Annotated[str | None, Form()] = None,
    audio: UploadFile | None = File(None),
):
    sess = db.fetch_one("SELECT id FROM sessions WHERE id = ?", (session_id,))
    if not sess:
        raise HTTPException(status_code=404, detail="session not found")

    q = db.fetch_one("SELECT id FROM questions WHERE id = ? AND session_id = ?", (question_id, session_id))
    if not q:
        raise HTTPException(status_code=404, detail="question not found")

    created_at = dt.datetime.utcnow().isoformat()
    answer_id = str(uuid.uuid4())

    audio_path: str | None = None
    if audio is not None:
        AUDIO_DIR.mkdir(parents=True, exist_ok=True)
        safe_ext = Path(audio.filename or "").suffix or ".webm"
        file_path = AUDIO_DIR / f"{answer_id}{safe_ext}"
        content = await audio.read()
        file_path.write_bytes(content)
        audio_path = str(file_path.relative_to(STORAGE_DIR))

    db.execute(
        "INSERT INTO answers(id, session_id, question_id, created_at, transcript, audio_path) VALUES(?,?,?,?,?,?)",
        (answer_id, session_id, question_id, created_at, transcript, audio_path),
    )
    audio_url = f"/api/storage/{audio_path}" if audio_path else None
    return AnswerResponse(
        id=answer_id,
        session_id=session_id,
        question_id=question_id,
        created_at=created_at,
        transcript=transcript,
        audio_url=audio_url,
    )
