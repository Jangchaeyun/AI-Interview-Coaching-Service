import InterviewCoach from "@/components/InterviewCoach";

export default function Home() {
  return (
    <div
      suppressHydrationWarning
      className="min-h-dvh bg-[radial-gradient(80%_60%_at_50%_0%,rgba(99,102,241,0.20),rgba(255,255,255,0)_60%),radial-gradient(70%_55%_at_0%_20%,rgba(16,185,129,0.16),rgba(255,255,255,0)_55%),radial-gradient(70%_55%_at_100%_20%,rgba(245,158,11,0.12),rgba(255,255,255,0)_55%)] text-zinc-900"
    >
      <div className="mx-auto max-w-5xl px-4 py-10">
        <header className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/60 px-3 py-1 text-xs font-semibold text-zinc-700 shadow-sm backdrop-blur">
            취업 준비생용 · 면접 연습
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-zinc-900">
            AI 면접 코칭 서비스
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-zinc-600">
            시작 → 이력서 업로드 → 맞춤 질문 → 답변 작성 → 피드백 확인. 위에서부터 순서대로만 진행하면 됩니다.
          </p>
        </header>
        <InterviewCoach />
      </div>
    </div>
  );
}
