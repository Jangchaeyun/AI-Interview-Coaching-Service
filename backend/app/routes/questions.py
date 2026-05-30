from __future__ import annotations

import datetime as dt
import uuid
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .. import db
from ..services.llm import call_llm, as_json

router = APIRouter(tags=["questions"])


class GenerateQuestionsRequest(BaseModel):
    session_id: str
    target_role: str | None = None
    categories: list[str] = Field(default_factory=list)
    count: int = 8
    language: Literal["ko", "en"] = "ko"


class QuestionResponse(BaseModel):
    id: str
    session_id: str
    created_at: str
    category: str | None
    difficulty: str | None
    question: str
    expected_points: list[str]


class GenerateQuestionsResponse(BaseModel):
    questions: list[QuestionResponse]
    used_mock: bool


@router.post("/questions/generate", response_model=GenerateQuestionsResponse)
def generate_questions(req: GenerateQuestionsRequest):
    sess = db.fetch_one("SELECT id FROM sessions WHERE id = ?", (req.session_id,))
    if not sess:
        raise HTTPException(status_code=404, detail="session not found")

    docs = db.fetch_all(
        "SELECT doc_type, content_text FROM documents WHERE session_id = ? ORDER BY created_at DESC",
        (req.session_id,),
    )
    resume_text = next((d["content_text"] for d in docs if d["doc_type"] == "resume"), "")
    cover_text = next((d["content_text"] for d in docs if d["doc_type"] == "cover_letter"), "")
    other_texts = "\n\n".join(d["content_text"] for d in docs if d["doc_type"] == "other")

    result = call_llm(
        "generate_questions",
        {
            "target_role": req.target_role,
            "categories": req.categories,
            "count": req.count,
            "language": req.language,
            "resume_text": resume_text,
            "cover_letter_text": cover_text,
            "other_text": other_texts,
        },
    )
    questions_out: list[QuestionResponse] = []
    created_at = dt.datetime.utcnow().isoformat()
    for q in result.data.get("questions", []):
        qid = str(uuid.uuid4())
        expected_points = q.get("expected_points") or []
        db.execute(
            "INSERT INTO questions(id, session_id, created_at, category, difficulty, question, expected_points) VALUES(?,?,?,?,?,?,?)",
            (
                qid,
                req.session_id,
                created_at,
                q.get("category"),
                q.get("difficulty"),
                q.get("question"),
                as_json(expected_points),
            ),
        )
        questions_out.append(
            QuestionResponse(
                id=qid,
                session_id=req.session_id,
                created_at=created_at,
                category=q.get("category"),
                difficulty=q.get("difficulty"),
                question=q.get("question"),
                expected_points=expected_points,
            )
        )

    return GenerateQuestionsResponse(questions=questions_out, used_mock=result.used_mock)


@router.get("/sessions/{session_id}/questions", response_model=list[QuestionResponse])
def list_questions(session_id: str):
    rows = db.fetch_all(
        "SELECT * FROM questions WHERE session_id = ? ORDER BY created_at ASC",
        (session_id,),
    )
    return [
        QuestionResponse(
            id=r["id"],
            session_id=r["session_id"],
            created_at=r["created_at"],
            category=r["category"],
            difficulty=r["difficulty"],
            question=r["question"],
            expected_points=__import__("json").loads(r["expected_points"] or "[]"),
        )
        for r in rows
    ]
