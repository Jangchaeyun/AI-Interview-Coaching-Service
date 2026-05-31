import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .db import init_db
from .paths import storage_dir
from .routes import analysis, documents, questions, sessions


def _cors_origins() -> list[str]:
    raw = os.getenv("ALLOWED_ORIGINS", "").strip()
    if raw:
        return [o.strip() for o in raw.split(",") if o.strip()]
    return ["*"]


def create_app() -> FastAPI:
    app = FastAPI(title="AI Interview Coaching Service API", version="0.1.0")
    # Note: dev server uses --reload; minor edits here should trigger reload.

    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(sessions.router, prefix="/api")
    app.include_router(documents.router, prefix="/api")
    app.include_router(questions.router, prefix="/api")
    app.include_router(analysis.router, prefix="/api")

    root = storage_dir()
    app.mount("/api/storage", StaticFiles(directory=str(root)), name="storage")

    @app.on_event("startup")
    def _startup() -> None:
        init_db()

    @app.get("/api/health")
    def health():
        return {"ok": True}

    return app


app = create_app()
