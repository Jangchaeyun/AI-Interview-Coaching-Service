from __future__ import annotations

import datetime as dt
import uuid
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from .. import db
from ..services.text_extract import extract_text_from_file

router = APIRouter(tags=["documents"])

STORAGE_DIR = Path(__file__).resolve().parents[2] / "storage"
DOCS_DIR = STORAGE_DIR / "docs"


class DocumentResponse(BaseModel):
    id: str
    session_id: str
    created_at: str
    doc_type: str
    filename: str | None
    mime_type: str | None
    text_length: int
    extracted_ok: bool
    warning: str | None


@router.post("/documents", response_model=DocumentResponse)
async def upload_document(
    session_id: Annotated[str, Form(...)],
    doc_type: Annotated[Literal["resume", "cover_letter", "other"], Form(...)],
    text: Annotated[str | None, Form()] = None,
    file: UploadFile | None = File(None),
):
    sess = db.fetch_one("SELECT id FROM sessions WHERE id = ?", (session_id,))
    if not sess:
        raise HTTPException(status_code=404, detail="session not found")

    created_at = dt.datetime.utcnow().isoformat()
    doc_id = str(uuid.uuid4())

    filename = file.filename if file else None
    mime_type = file.content_type if file else None

    source_path: str | None = None
    content_text = (text or "").strip()
    extracted_ok = True
    warning: str | None = None

    if file is not None:
        DOCS_DIR.mkdir(parents=True, exist_ok=True)
        ext = Path(filename or "").suffix or ".bin"
        save_path = DOCS_DIR / f"{doc_id}{ext}"
        save_path.write_bytes(await file.read())
        source_path = str(save_path.relative_to(STORAGE_DIR))
        extracted = extract_text_from_file(save_path)
        if extracted.strip():
            content_text = extracted.strip()
        else:
            extracted_ok = False
            warning = (
                "파일 업로드는 완료됐지만, 문서에서 텍스트를 추출하지 못했습니다. "
                "스캔 PDF(이미지 기반)일 수 있어요. "
                "텍스트를 붙여넣어 다시 업로드하거나, OCR을 적용해 주세요."
            )

    if not content_text:
        if file is None:
            raise HTTPException(
                status_code=400,
                detail="텍스트가 비어 있습니다. 텍스트를 붙여넣거나 파일을 업로드해 주세요.",
            )
        # 파일은 저장했지만 텍스트를 못 뽑은 경우: 업로드는 성공 처리(경고 포함)
        content_text = ""

    db.execute(
        """
        INSERT INTO documents(
          id, session_id, created_at, doc_type, filename, mime_type, content_text, source_path, extracted_ok, warning
        )
        VALUES(?,?,?,?,?,?,?,?,?,?)
        """,
        (
            doc_id,
            session_id,
            created_at,
            doc_type,
            filename,
            mime_type,
            content_text,
            source_path,
            1 if extracted_ok else 0,
            warning,
        ),
    )

    return DocumentResponse(
        id=doc_id,
        session_id=session_id,
        created_at=created_at,
        doc_type=doc_type,
        filename=filename,
        mime_type=mime_type,
        text_length=len(content_text),
        extracted_ok=extracted_ok,
        warning=warning,
    )


@router.get("/sessions/{session_id}/documents", response_model=list[DocumentResponse])
def list_documents(session_id: str):
    rows = db.fetch_all(
        "SELECT id, session_id, created_at, doc_type, filename, mime_type, content_text, extracted_ok, warning FROM documents WHERE session_id=? ORDER BY created_at DESC",
        (session_id,),
    )
    return [
        DocumentResponse(
            id=r["id"],
            session_id=r["session_id"],
            created_at=r["created_at"],
            doc_type=r["doc_type"],
            filename=r["filename"],
            mime_type=r["mime_type"],
            text_length=len(r["content_text"] or ""),
            extracted_ok=bool(r.get("extracted_ok", 1)),
            warning=r.get("warning"),
        )
        for r in rows
    ]

