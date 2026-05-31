# 배포 가이드

프로젝트는 **한 번에 배포(권장)** 또는 **프론트/백엔드 분리 배포**를 지원합니다.

## 방법 A — Render 통합 배포 (권장, 무료 시작 가능)

Next.js + FastAPI + Nginx를 **하나의 Docker 이미지**로 묶었습니다.  
브라우저는 같은 도메인에서 `/` (웹) · `/api` (API)를 사용하므로 CORS 설정이 단순합니다.

### 1. GitHub에 코드 푸시

```powershell
cd "d:\Project\AI Interview Coaching Service"
git add .
git commit -m "Add production deployment configuration"
git push origin main
```

### 2. Render에서 Blueprint 배포

1. [Render](https://render.com) 로그인 → **New** → **Blueprint**
2. GitHub 저장소 `Jangchaeyun/AI-Interview-Coaching-Service` 연결
3. `render.yaml`이 자동으로 인식되면 **Apply**
4. 배포 완료 후 표시되는 URL 접속 (예: `https://ai-interview-coaching.onrender.com`)

헬스 체크: `https://<your-app>.onrender.com/api/health`

> 무료 플랜은 재배포 시 SQLite·업로드 파일이 초기화될 수 있습니다.  
> 데이터를 유지하려면 Render **유료 인스턴스 + disk** (`render.yaml` 주석 참고)를 사용하세요.

### 로컬에서 Docker 테스트

```powershell
docker build -t ai-interview-coaching .
docker run --rm -p 10000:10000 -e PORT=10000 ai-interview-coaching
```

접속: http://localhost:10000

---

## 방법 B — Vercel(프론트) + Render(백엔드만)

### 백엔드 (Render)

1. **New** → **Web Service** → 같은 GitHub 저장소
2. **Root Directory**: `backend`
3. **Runtime**: Docker (`backend/Dockerfile`)
4. 환경 변수:
   - `ALLOWED_ORIGINS` = `https://<vercel-도메인>`
   - `STORAGE_DIR` = `/var/data` (유료 + disk 사용 시)

### 프론트엔드 (Vercel)

1. [Vercel](https://vercel.com) → Import GitHub 저장소
2. **Root Directory**: `frontend`
3. 환경 변수:
   - `NEXT_PUBLIC_API_BASE` = `https://<render-백엔드-URL>` (끝에 `/` 없음)

---

## 환경 변수 요약

| 변수 | 용도 |
|------|------|
| `NEXT_PUBLIC_API_BASE` | 프론트가 호출할 API 주소. 통합 Docker 배포 시 **비우거나 미설정** (같은 출처 `/api`) |
| `STORAGE_DIR` | DB·업로드 저장 경로 (기본: `backend/storage`) |
| `ALLOWED_ORIGINS` | CORS 허용 도메인 (쉼표 구분). 미설정 시 `*` |
| `PORT` | Render가 주입하는 공개 포트 (통합 이미지에서 Nginx가 사용) |
