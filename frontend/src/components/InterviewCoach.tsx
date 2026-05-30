"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { FeedbackPanel } from "@/components/FeedbackPanel";
import { apiGet, apiPostForm, apiPostJson } from "@/lib/api";

type Session = {
  id: string;
  created_at: string;
  target_role?: string | null;
  level?: string | null;
  language: "ko" | "en";
};

type Question = {
  id: string;
  session_id: string;
  created_at: string;
  category?: string | null;
  difficulty?: string | null;
  question: string;
  expected_points: string[];
};

type Answer = {
  id: string;
  session_id: string;
  question_id: string;
  created_at: string;
  transcript?: string | null;
  audio_url?: string | null;
};

type Evaluation = {
  id: string;
  answer_id: string;
  created_at: string;
  rubric_version: string;
  overall_score: number;
  scores: Record<string, number>;
  feedback: string;
  strengths: string[];
  improvements: string[];
  followup_questions: string[];
  used_mock: boolean;
};

type Report = {
  session_id: string;
  overall_average: number;
  by_dimension: Record<string, number>;
  answer_count: number;
};

type DocumentSummary = {
  id: string;
  session_id: string;
  created_at: string;
  doc_type: "resume" | "cover_letter" | "other";
  filename?: string | null;
  mime_type?: string | null;
  text_length: number;
  extracted_ok: boolean;
  warning?: string | null;
};

function formatScore(v: number) {
  if (!Number.isFinite(v)) return "-";
  return v.toFixed(1);
}

const SCORE_LABEL_KO: Record<string, string> = {
  clarity: "명확성",
  structure: "구조",
  relevance: "관련성",
  evidence: "근거",
  delivery: "전달력",
};

function scoreLabel(key: string) {
  return SCORE_LABEL_KO[key] ?? key;
}

function clamp01(v: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function Card({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/70 p-5 shadow-[0_1px_0_0_rgba(16,24,40,0.04),0_16px_48px_-20px_rgba(16,24,40,0.24)] backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold tracking-tight text-zinc-900">
            {title}
          </div>
          {subtitle ? (
            <div className="mt-1 text-xs leading-5 text-zinc-600">{subtitle}</div>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "info";
}) {
  const cls =
    tone === "success"
      ? "border-emerald-200/60 bg-emerald-50 text-emerald-800"
      : tone === "warning"
        ? "border-amber-200/60 bg-amber-50 text-amber-800"
        : tone === "info"
          ? "border-indigo-200/60 bg-indigo-50 text-indigo-800"
          : "border-zinc-200/60 bg-zinc-50 text-zinc-700";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        cls,
      )}
    >
      {children}
    </span>
  );
}

function Button({
  children,
  variant = "primary",
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  onClick?: () => void;
}) {
  const base =
    "inline-flex h-10 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-zinc-300 disabled:cursor-not-allowed disabled:opacity-50";
  const v =
    variant === "primary"
      ? "bg-gradient-to-b from-zinc-900 to-zinc-800 text-white shadow-sm hover:from-zinc-800 hover:to-zinc-700"
      : variant === "secondary"
        ? "border border-zinc-200/80 bg-white/60 text-zinc-900 shadow-sm hover:bg-white"
        : "text-zinc-700 hover:bg-zinc-100/80";
  return (
    <button className={cn(base, v)} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

function ProgressBar({
  value,
  tone = "zinc",
}: {
  value: number; // 0..100
  tone?: "zinc" | "indigo" | "emerald" | "amber";
}) {
  const w = `${Math.round(clamp01(value / 100) * 100)}%`;
  const bar =
    tone === "indigo"
      ? "from-indigo-500 to-indigo-600"
      : tone === "emerald"
        ? "from-emerald-500 to-emerald-600"
        : tone === "amber"
          ? "from-amber-500 to-amber-600"
          : "from-zinc-700 to-zinc-900";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
      <div
        className={cn("h-full rounded-full bg-gradient-to-r", bar)}
        style={{ width: w }}
      />
    </div>
  );
}

function StepGuide({
  steps,
  current,
}: {
  steps: { id: number; label: string; hint: string; done: boolean }[];
  current: number;
}) {
  return (
    <div className="rounded-3xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur">
      <p className="text-sm font-semibold text-zinc-900">4단계로 진행해요</p>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => (
          <li
            key={s.id}
            className={cn(
              "rounded-2xl border p-3 transition",
              current === s.id
                ? "border-indigo-300 bg-indigo-50/90 ring-2 ring-indigo-200/60"
                : s.done
                  ? "border-emerald-200/80 bg-emerald-50/60"
                  : "border-zinc-200/70 bg-white/60 opacity-80",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  s.done
                    ? "bg-emerald-600 text-white"
                    : current === s.id
                      ? "bg-indigo-600 text-white"
                      : "bg-zinc-200 text-zinc-700",
                )}
              >
                {s.done ? "✓" : s.id}
              </span>
              <span className="text-sm font-semibold text-zinc-900">{s.label}</span>
            </div>
            <p className="mt-2 pl-9 text-xs leading-5 text-zinc-600">{s.hint}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function InterviewCoach() {
  const [targetRole, setTargetRole] = useState("백엔드 개발자");
  const [level, setLevel] = useState("junior");
  const [session, setSession] = useState<Session | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    null,
  );
  const selectedQuestion = useMemo(
    () => questions.find((q) => q.id === selectedQuestionId) || null,
    [questions, selectedQuestionId],
  );

  const [transcript, setTranscript] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [resumeText, setResumeText] = useState("");
  const [coverText, setCoverText] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [docNotice, setDocNotice] = useState<string | null>(null);
  const [docTab, setDocTab] = useState<"resume" | "cover_letter">("resume");

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasResumeUploaded = documents.some((d) => d.doc_type === "resume");
  const hasUsableResume = documents.some(
    (d) => d.doc_type === "resume" && d.extracted_ok && d.text_length > 30,
  );

  const currentStep = useMemo(() => {
    if (!session) return 1;
    if (!questions.length) return 2;
    if (!evaluation) return 3;
    return 4;
  }, [session, questions.length, evaluation]);

  const stepItems = useMemo(
    () => [
      {
        id: 1,
        label: "시작",
        hint: "직무·경력을 입력하고 연습을 시작합니다.",
        done: !!session,
      },
      {
        id: 2,
        label: "서류",
        hint: "이력서를 올리면 질문이 더 정확해집니다. (자소서는 선택)",
        done: hasResumeUploaded,
      },
      {
        id: 3,
        label: "질문·답변",
        hint: "맞춤 질문을 만들고 답변을 작성합니다.",
        done: !!evaluation,
      },
      {
        id: 4,
        label: "결과",
        hint: "점수·피드백으로 개선점을 확인합니다.",
        done: !!evaluation,
      },
    ],
    [session, hasResumeUploaded, evaluation],
  );

  // audio recording (browser)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  useEffect(() => {
    if (!session) return;
    void refreshDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  async function createSession() {
    setError(null);
    setDocNotice(null);
    setBusy("세션 생성 중...");
    try {
      const s = await apiPostJson<Session>("/api/sessions", {
        target_role: targetRole,
        level,
        language: "ko",
      });
      setSession(s);
      setQuestions([]);
      setSelectedQuestionId(null);
      setTranscript("");
      setAnswer(null);
      setEvaluation(null);
      setReport(null);
      setDocuments([]);
      setResumeText("");
      setCoverText("");
      setResumeFile(null);
      setCoverFile(null);
      setAudioBlob(null);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      setDocNotice("연습이 시작됐어요. 다음으로 이력서를 업로드하면 질문이 더 정확해집니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "세션 생성 실패");
    } finally {
      setBusy(null);
    }
  }

  async function refreshDocuments() {
    if (!session) return;
    try {
      const docs = await apiGet<DocumentSummary[]>(
        `/api/sessions/${session.id}/documents`,
      );
      setDocuments(docs);
    } catch {
      // 문서 목록 조회 실패는 UX 상 치명적이지 않으므로 무시
    }
  }

  async function uploadDocument(docType: "resume" | "cover_letter") {
    if (!session) return;
    setError(null);
    setDocNotice(null);
    setBusy(docType === "resume" ? "이력서 업로드 중..." : "자기소개서 업로드 중...");
    try {
      const form = new FormData();
      form.set("session_id", session.id);
      form.set("doc_type", docType);

      const file = docType === "resume" ? resumeFile : coverFile;
      const text = docType === "resume" ? resumeText : coverText;
      if (text.trim()) form.set("text", text.trim());
      if (file) form.set("file", file);

      await apiPostForm<DocumentSummary>("/api/documents", form);
      await refreshDocuments();
      setDocNotice(
        docType === "resume"
          ? "이력서가 저장됐어요. 아래 「맞춤 질문 만들기」를 눌러 주세요."
          : "자소서가 저장됐어요. 질문 생성 시 함께 반영됩니다.",
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "문서 업로드 실패 (PDF가 스캔본이면 텍스트 추출이 안 될 수 있어요)",
      );
    } finally {
      setBusy(null);
    }
  }

  async function generateQuestions() {
    if (!session) return;
    setError(null);
    setBusy("질문 생성 중...");
    try {
      const resp = await apiPostJson<{ questions: Question[]; used_mock: boolean }>(
        "/api/questions/generate",
        {
          session_id: session.id,
          target_role: targetRole,
          categories: ["자기소개", "경험", "문제해결", "협업", "직무역량"],
          count: 8,
          language: "ko",
        },
      );
      setQuestions(resp.questions);
      setSelectedQuestionId(resp.questions[0]?.id ?? null);
      setDocNotice(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "질문 생성 실패");
    } finally {
      setBusy(null);
    }
  }

  async function submitAnswerAndEvaluate() {
    if (!session || !selectedQuestion) return;
    if (!transcript.trim() && !audioBlob) {
      setError("답변 텍스트를 입력하거나, 음성을 녹음한 뒤 제출해 주세요.");
      return;
    }
    setError(null);
    setBusy("답변 제출 및 평가 중...");
    try {
      const form = new FormData();
      form.set("session_id", session.id);
      form.set("question_id", selectedQuestion.id);
      if (transcript.trim()) form.set("transcript", transcript.trim());
      if (audioBlob) form.set("audio", audioBlob, "answer.webm");
      const a = await apiPostForm<Answer>("/api/answers", form);
      setAnswer(a);
      const ev = await apiPostJson<Evaluation>(`/api/answers/${a.id}/evaluate`, {
        transcript: transcript.trim() || undefined,
      });
      setEvaluation(ev);
    } catch (e) {
      setError(e instanceof Error ? e.message : "제출/평가 실패");
    } finally {
      setBusy(null);
    }
  }

  async function startRecording() {
    setError(null);
    setEvaluation(null);
    setAnswer(null);
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };
      recorder.start();
      setIsRecording(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "마이크 권한이 필요합니다(브라우저에서 허용).",
      );
    }
  }

  function stopRecording() {
    const r = mediaRecorderRef.current;
    if (!r) return;
    r.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }

  async function uploadAnswer() {
    if (!session || !selectedQuestion) return;
    setError(null);
    setBusy("답변 업로드 중...");
    try {
      const form = new FormData();
      form.set("session_id", session.id);
      form.set("question_id", selectedQuestion.id);
      if (transcript.trim()) form.set("transcript", transcript.trim());
      if (audioBlob) form.set("audio", audioBlob, "answer.webm");

      const a = await apiPostForm<Answer>("/api/answers", form);
      setAnswer(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setBusy(null);
    }
  }

  async function evaluate() {
    if (!answer) return;
    setError(null);
    setBusy("평가 중...");
    try {
      const ev = await apiPostJson<Evaluation>(`/api/answers/${answer.id}/evaluate`, {
        transcript: transcript.trim() || undefined,
      });
      setEvaluation(ev);
    } catch (e) {
      setError(e instanceof Error ? e.message : "평가 실패");
    } finally {
      setBusy(null);
    }
  }

  async function refreshReport() {
    if (!session) return;
    setError(null);
    setBusy("리포트 계산 중...");
    try {
      const r = await apiGet<Report>(`/api/sessions/${session.id}/report`);
      setReport(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "리포트 실패");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-6">
      <StepGuide steps={stepItems} current={currentStep} />

      {error ? (
        <div className="rounded-2xl border border-red-200/70 bg-red-50/90 p-4 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      {docNotice && !error ? (
        <div className="rounded-2xl border border-indigo-200/70 bg-indigo-50/80 p-4 text-sm text-indigo-950">
          {docNotice}
        </div>
      ) : null}

      <Card
        title="1단계 · 시작하기"
        subtitle="지원 직무와 경력만 입력하면 됩니다."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-zinc-800">
            지원 직무
            <input
              className="h-12 w-full rounded-2xl border border-zinc-200/80 bg-white px-4 text-base text-zinc-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="예: 백엔드 개발자"
              disabled={!!session}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-zinc-800">
            경력
            <select
              className="h-12 w-full rounded-2xl border border-zinc-200/80 bg-white px-4 text-base text-zinc-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              disabled={!!session}
            >
              <option value="junior">신입·주니어</option>
              <option value="mid">경력(미들)</option>
              <option value="senior">시니어</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!session ? (
            <Button onClick={createSession} disabled={!!busy}>
              면접 연습 시작하기
            </Button>
          ) : (
            <>
              <Badge tone="success">연습 중</Badge>
              <span className="text-sm text-zinc-600">
                {targetRole} · {level === "junior" ? "신입·주니어" : level === "mid" ? "경력" : "시니어"}
              </span>
            </>
          )}
        </div>
      </Card>

      <Card
        title="2단계 · 이력서 올리기 (권장)"
        subtitle="파일 또는 텍스트 붙여넣기. 스캔 PDF는 아래 칸에 내용을 붙여넣는 것이 가장 확실합니다."
      >
        {!session ? (
          <p className="text-sm text-zinc-600">먼저 1단계에서 「면접 연습 시작하기」를 눌러 주세요.</p>
        ) : (
          <div className="grid gap-4">
            <div className="flex gap-2">
              <button
                type="button"
                className={cn(
                  "rounded-2xl px-4 py-2 text-sm font-semibold transition",
                  docTab === "resume"
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
                )}
                onClick={() => setDocTab("resume")}
              >
                이력서 {hasResumeUploaded ? "✓" : ""}
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-2xl px-4 py-2 text-sm font-semibold transition",
                  docTab === "cover_letter"
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
                )}
                onClick={() => setDocTab("cover_letter")}
              >
                자기소개서 (선택)
              </button>
            </div>

            {docTab === "resume" ? (
              <div className="grid gap-3 rounded-2xl border border-zinc-200/70 bg-white p-4">
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  className="block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                  onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
                />
                <textarea
                  className="min-h-32 w-full rounded-2xl border border-zinc-200 bg-zinc-50/50 px-4 py-3 text-sm leading-6 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                  placeholder="이력서 내용을 여기에 붙여넣어도 됩니다. (스캔 PDF일 때 추천)"
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                />
                <Button
                  onClick={() => uploadDocument("resume")}
                  disabled={!!busy || (!resumeFile && !resumeText.trim())}
                >
                  이력서 저장
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 rounded-2xl border border-zinc-200/70 bg-white p-4">
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  className="block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                  onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                />
                <textarea
                  className="min-h-32 w-full rounded-2xl border border-zinc-200 bg-zinc-50/50 px-4 py-3 text-sm leading-6 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                  placeholder="자기소개서 내용 붙여넣기 (선택)"
                  value={coverText}
                  onChange={(e) => setCoverText(e.target.value)}
                />
                <Button
                  onClick={() => uploadDocument("cover_letter")}
                  disabled={!!busy || (!coverFile && !coverText.trim())}
                >
                  자소서 저장
                </Button>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-indigo-200/60 bg-indigo-50/50 p-4">
              <div className="text-sm text-zinc-800">
                {hasUsableResume
                  ? "이력서가 반영되었습니다. 이제 맞춤 질문을 만들어 보세요."
                  : "이력서 없이도 질문을 만들 수 있지만, 업로드하면 훨씬 정확합니다."}
              </div>
              <Button onClick={generateQuestions} disabled={!!busy}>
                맞춤 질문 만들기 →
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card
        title="3단계 · 질문에 답하기"
        subtitle="질문을 고른 뒤, 답변을 쓰고 한 번에 피드백을 받으세요."
      >
        {!questions.length ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-white/60 p-6 text-center">
            <p className="text-sm text-zinc-600">아직 질문이 없습니다.</p>
            <div className="mt-4">
              <Button onClick={generateQuestions} disabled={!session || !!busy}>
                맞춤 질문 만들기
              </Button>
            </div>
          </div>
        ) : (
          <>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="grid gap-2 lg:col-span-2">
              <label className="text-xs font-medium text-zinc-700">
                질문 선택
              </label>
              <select
                className="h-11 w-full rounded-2xl border border-zinc-200/80 bg-white/70 px-4 text-sm outline-none ring-1 ring-transparent transition focus:border-zinc-300 focus:ring-zinc-200"
                value={selectedQuestionId ?? ""}
                onChange={(e) => {
                  setSelectedQuestionId(e.target.value);
                  setAnswer(null);
                  setEvaluation(null);
                  setTranscript("");
                  setAudioBlob(null);
                  if (audioUrl) URL.revokeObjectURL(audioUrl);
                  setAudioUrl(null);
                }}
              >
                {questions.map((q, idx) => (
                  <option key={q.id} value={q.id}>
                    {idx + 1}. {q.category ? `[${q.category}] ` : ""}
                    {q.question.slice(0, 50)}
                    {q.question.length > 50 ? "..." : ""}
                  </option>
                ))}
              </select>

              <div className="rounded-2xl border border-zinc-200/70 bg-gradient-to-b from-white/80 to-zinc-50/80 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="info">{selectedQuestion?.category ?? "카테고리"}</Badge>
                  <Badge tone="neutral">{selectedQuestion?.difficulty ?? "난이도"}</Badge>
                </div>
                <div className="mt-3 text-base font-semibold leading-7 text-zinc-900">
                  {selectedQuestion?.question}
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <div className="text-xs font-medium text-zinc-700">
                답변 포인트(예상)
              </div>
              <ul className="grid gap-2 rounded-2xl border border-zinc-200/70 bg-white/60 p-4 text-sm text-zinc-800">
                {(selectedQuestion?.expected_points ?? []).map((p, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                    <span className="leading-6">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

              <div className="mt-6 border-t border-zinc-200/70 pt-6">
                <p className="text-sm font-semibold text-zinc-900">내 답변 작성</p>
                <p className="mt-1 text-xs text-zinc-600">
                  답변을 입력한 뒤 아래 버튼 한 번으로 피드백을 받을 수 있어요.
                </p>
                <textarea
                  className="mt-3 min-h-44 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm leading-7 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                  placeholder="예: (상황) … (과제) … (행동) … (결과) …"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    onClick={submitAnswerAndEvaluate}
                    disabled={!selectedQuestion || !!busy}
                  >
                    답변 제출하고 피드백 받기
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={!selectedQuestion || !!busy}
                  >
                    {isRecording ? "녹음 중지" : "음성으로 연습 (선택)"}
                  </Button>
                </div>
                {audioUrl ? (
                  <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                    <audio controls src={audioUrl} className="w-full" />
                  </div>
                ) : null}
                <p className="mt-2 text-xs text-zinc-500">
                  음성만 올리면 텍스트가 없어 평가가 부정확할 수 있어요. 텍스트 입력을 권장합니다.
                </p>
              </div>
          </>
        )}
      </Card>

      <Card
        title="4단계 · 결과 확인"
        subtitle="점수와 피드백을 보고, 답변을 고친 뒤 다시 평가할 수 있어요."
        right={
          evaluation ? (
            <Button variant="secondary" onClick={submitAnswerAndEvaluate} disabled={!!busy}>
              다시 평가하기
            </Button>
          ) : null
        }
      >
        {!evaluation ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-white/60 p-6 text-center text-sm text-zinc-600">
            3단계에서 답변을 작성하고 「답변 제출하고 피드백 받기」를 눌러 주세요.
          </div>
        ) : (
          <FeedbackPanel evaluation={evaluation} />
        )}
      </Card>

      {evaluation ? (
        <Card
          title="전체 연습 요약 (선택)"
          subtitle="여러 질문에 답변·평가를 반복한 뒤, 평균 점수를 확인할 수 있어요."
          right={
            <Button variant="ghost" onClick={refreshReport} disabled={!!busy}>
              요약 보기
            </Button>
          }
        >
        {!report ? (
          <p className="text-sm text-zinc-600">
            「요약 보기」를 누르면 지금까지의 평균 점수를 확인합니다.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200/70 bg-white/60 p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-zinc-800">
                  Overall 평균
                </div>
                <div className="text-xs text-zinc-500">
                  {report.answer_count}개 평가 기준
                </div>
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div className="text-3xl font-bold tracking-tight text-zinc-900">
                  {formatScore(report.overall_average)}
                </div>
                <div className="w-2/3">
                  <ProgressBar value={report.overall_average} tone="indigo" />
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200/70 bg-white/60 p-4">
              <div className="text-xs font-semibold text-zinc-800">차원별 평균</div>
              <div className="mt-3 grid gap-3">
                {Object.entries(report.by_dimension).map(([k, v]) => (
                  <div key={k} className="grid gap-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="text-zinc-600">{scoreLabel(k)}</div>
                      <div className="font-semibold text-zinc-900">
                        {formatScore(v)}
                      </div>
                    </div>
                    <ProgressBar value={v} tone="zinc" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        </Card>
      ) : null}

      {busy ? (
        <div className="sticky bottom-4 z-10">
          <div className="mx-auto max-w-2xl rounded-2xl border border-zinc-200/70 bg-white/80 px-4 py-3 text-sm text-zinc-800 shadow-lg backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div className="font-medium">{busy}</div>
              <div className="h-2 w-24 overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-zinc-900" />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

