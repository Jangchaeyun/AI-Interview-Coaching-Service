# AI 면접 코칭 서비스 (MVP)

취업 준비생 대상 **AI 면접 코칭 서비스**의 실행 가능한 MVP입니다.

## 포함 기능

- 예상 질문 생성
- 이력서/자기소개서 업로드(파일/텍스트) 기반 질문 생성
- 음성 녹음(브라우저) + 업로드
- 답변 평가 + 피드백 제공
- 면접 점수 분석(세션 리포트)

> 현재 MVP는 **STT(음성→텍스트)** 를 포함하지 않습니다.  
> 음성 업로드는 저장되지만, 평가 품질을 위해 텍스트 답변을 함께 입력하는 흐름입니다. (추후 Whisper 등으로 확장 가능)

## 실행 방법 (Windows / PowerShell)

### 1) 백엔드 실행 (FastAPI)

```powershell
cd "d:\Project\AI Interview Coaching Service\backend"
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

확인: `http://localhost:8000/api/health`

### 2) 프론트 실행 (Next.js)

새 PowerShell에서:

```powershell
cd "d:\Project\AI Interview Coaching Service\frontend"
npm run dev
```

접속: `http://localhost:3000`

## 사용 흐름(추천)

1) **세션 시작**  
2) **이력서/자기소개서 업로드** (PDF/DOCX/TXT 또는 텍스트 붙여넣기)  
3) **예상 질문 생성** → 문서 내용(프로젝트/기술/경험)을 반영해 질문 생성  
4) 답변 작성/녹음 → 업로드 → 평가 → 세션 리포트

## API 개요

- `POST /api/sessions`: 세션 생성
- `POST /api/documents` (multipart): 문서 업로드(이력서/자소서/텍스트)
- `GET /api/sessions/{session_id}/documents`: 문서 목록
- `POST /api/questions/generate`: 예상 질문 생성
- `GET /api/sessions/{session_id}/questions`: 질문 목록
- `POST /api/answers` (multipart): 답변 업로드(텍스트/오디오)
- `POST /api/answers/{answer_id}/evaluate`: 답변 평가/피드백 저장
- `GET /api/sessions/{session_id}/report`: 세션 점수 분석 리포트

## 데이터 저장

- sqlite: `backend/storage/app.db`
- 업로드 음성: `backend/storage/audio/*`
- 업로드 문서: `backend/storage/docs/*`

## 배포

프로덕션 배포는 **Render 통합 Docker**를 권장합니다. 자세한 절차는 [DEPLOY.md](./DEPLOY.md)를 참고하세요.

- 통합 배포: 루트 `Dockerfile` + `render.yaml`
- 분리 배포: `frontend` → Vercel, `backend` → Render (`backend/Dockerfile`)

