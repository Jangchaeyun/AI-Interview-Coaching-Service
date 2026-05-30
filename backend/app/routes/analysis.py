from __future__ import annotations

import datetime as dt
import json
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import db
from ..services.llm import call_llm, as_json

router = APIRouter(tags=["analysis"])


class EvaluateAnswerRequest(BaseModel):
    transcript: str | None = None


class EvaluationResponse(BaseModel):
    id: str
    answer_id: str
    created_at: str
    rubric_version: str
    overall_score: float
    scores: dict[str, float]
    feedback: str
    strengths: list[str]
    improvements: list[str]
    followup_questions: list[str]
    used_mock: bool


@router.post("/answers/{answer_id}/evaluate", response_model=EvaluationResponse)
def evaluate_answer(answer_id: str, req: EvaluateAnswerRequest):
    ans = db.fetch_one("SELECT * FROM answers WHERE id = ?", (answer_id,))
    if not ans:
        raise HTTPException(status_code=404, detail="answer not found")

    transcript = req.transcript if req.transcript is not None else ans.get("transcript")

    result = call_llm(
        "evaluate_answer",
        {
            "question_id": ans["question_id"],
            "session_id": ans["session_id"],
            "transcript": transcript or "",
        },
    )
    data = result.data

    eval_id = str(uuid.uuid4())
    created_at = dt.datetime.utcnow().isoformat()
    db.execute(
        """
        INSERT INTO evaluations(
          id, answer_id, created_at, rubric_version,
          overall_score, scores_json, feedback, strengths, improvements, followup_questions
        ) VALUES(?,?,?,?,?,?,?,?,?,?)
        """,
        (
            eval_id,
            answer_id,
            created_at,
            data.get("rubric_version") or "v1",
            float(data.get("overall_score") or 0.0),
            as_json(data.get("scores") or {}),
            data.get("feedback") or "",
            as_json(data.get("strengths") or []),
            as_json(data.get("improvements") or []),
            as_json(data.get("followup_questions") or []),
        ),
    )

    return EvaluationResponse(
        id=eval_id,
        answer_id=answer_id,
        created_at=created_at,
        rubric_version=data.get("rubric_version") or "v1",
        overall_score=float(data.get("overall_score") or 0.0),
        scores=data.get("scores") or {},
        feedback=data.get("feedback") or "",
        strengths=data.get("strengths") or [],
        improvements=data.get("improvements") or [],
        followup_questions=data.get("followup_questions") or [],
        used_mock=result.used_mock,
    )


class SessionReport(BaseModel):
    session_id: str
    overall_average: float
    by_dimension: dict[str, float]
    answer_count: int


@router.get("/sessions/{session_id}/report", response_model=SessionReport)
def session_report(session_id: str):
    sess = db.fetch_one("SELECT id FROM sessions WHERE id = ?", (session_id,))
    if not sess:
        raise HTTPException(status_code=404, detail="session not found")

    rows = db.fetch_all(
        """
        SELECT e.overall_score, e.scores_json
        FROM evaluations e
        JOIN answers a ON a.id = e.answer_id
        WHERE a.session_id = ?
        """,
        (session_id,),
    )
    if not rows:
        return SessionReport(session_id=session_id, overall_average=0.0, by_dimension={}, answer_count=0)

    overall_avg = sum(float(r["overall_score"]) for r in rows) / len(rows)
    sums: dict[str, float] = {}
    counts: dict[str, int] = {}
    for r in rows:
        scores = json.loads(r["scores_json"] or "{}")
        for k, v in scores.items():
            sums[k] = sums.get(k, 0.0) + float(v)
            counts[k] = counts.get(k, 0) + 1
    by_dim = {k: round(sums[k] / counts[k], 2) for k in sums.keys()}

    return SessionReport(
        session_id=session_id,
        overall_average=round(overall_avg, 2),
        by_dimension=by_dim,
        answer_count=len(rows),
    )
