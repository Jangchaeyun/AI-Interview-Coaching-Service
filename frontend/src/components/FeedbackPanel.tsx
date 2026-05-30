"use client";

import { useMemo, useState } from "react";

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

function formatScore(v: number) {
  if (!Number.isFinite(v)) return "-";
  return v.toFixed(1);
}

function clamp01(v: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type FeedbackSection = {
  title: string;
  lines: string[];
  variant: "summary" | "observe" | "action" | "template" | "example" | "default";
};

function sectionVariant(title: string): FeedbackSection["variant"] {
  if (title.includes("예시")) return "example";
  if (title.includes("요약")) return "summary";
  if (title.includes("관찰") || title.includes("모호")) return "observe";
  if (title.includes("고칠") || title.includes("바로")) return "action";
  if (title.includes("템플릿")) return "template";
  return "default";
}

function parseFeedbackSections(feedback: string): FeedbackSection[] {
  const chunks = feedback.split(/^###\s+/m).filter(Boolean);
  if (!chunks.length && feedback.trim()) {
    return [{ title: "피드백", lines: feedback.split("\n"), variant: "default" }];
  }
  return chunks.map((chunk) => {
    const [first, ...rest] = chunk.split("\n");
    const title = first.trim();
    const body = rest.join("\n").trim();
    const lines = body ? body.split("\n") : [];
    return { title, lines, variant: sectionVariant(title) };
  });
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-zinc-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function IconSparkles({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l1.2 4.2L17.4 8.6 13.2 9.8 12 14l-1.2-4.2L6.6 8.6l4.2-1.4L12 3zM5 14l.8 2.8L8.6 17.6 5.8 18.4 5 21l-.8-2.6L1.4 17.6l2.8-.8L5 14zm14 0l.8 2.8 2.8.8-2.8.8L19 21l-.8-2.6-2.8-.8 2.8-.8L19 14z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconEye({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconTarget({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

function IconClipboard({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="8" y="4" width="10" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 8H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

const SECTION_STYLES: Record<
  FeedbackSection["variant"],
  { border: string; bg: string; icon: string; Icon: typeof IconSparkles }
> = {
  summary: {
    border: "border-indigo-200/80",
    bg: "bg-gradient-to-br from-indigo-50/90 via-white to-violet-50/60",
    icon: "text-indigo-600",
    Icon: IconSparkles,
  },
  observe: {
    border: "border-sky-200/70",
    bg: "bg-gradient-to-br from-sky-50/80 via-white to-zinc-50/80",
    icon: "text-sky-600",
    Icon: IconEye,
  },
  action: {
    border: "border-amber-200/80",
    bg: "bg-gradient-to-br from-amber-50/80 via-white to-orange-50/50",
    icon: "text-amber-700",
    Icon: IconTarget,
  },
  template: {
    border: "border-violet-200/70",
    bg: "bg-gradient-to-br from-violet-50/70 via-white to-fuchsia-50/40",
    icon: "text-violet-600",
    Icon: IconClipboard,
  },
  example: {
    border: "border-emerald-200/80",
    bg: "bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/50",
    icon: "text-emerald-700",
    Icon: IconClipboard,
  },
  default: {
    border: "border-zinc-200/70",
    bg: "bg-white/70",
    icon: "text-zinc-600",
    Icon: IconSparkles,
  },
};

function FeedbackSectionCard({ section }: { section: FeedbackSection }) {
  const style = SECTION_STYLES[section.variant];
  const { Icon } = style;
  const bullets = section.lines.filter((l) => l.trim().startsWith("- "));
  const paragraphs = section.lines.filter(
    (l) => l.trim() && !l.trim().startsWith("- "),
  );
  const isExample = section.variant === "example";
  const exampleText = isExample
    ? section.lines.filter((l) => l.trim()).join("\n")
    : "";

  const [copied, setCopied] = useState(false);

  async function copyExample() {
    if (!exampleText) return;
    try {
      await navigator.clipboard.writeText(exampleText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border p-4 shadow-sm",
        style.border,
        style.bg,
      )}
    >
      <header className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/80 bg-white/80 shadow-sm",
            style.icon,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold tracking-tight text-zinc-900">
            {section.title}
          </h4>
          {isExample ? (
            <p className="mt-0.5 text-xs text-zinc-500">
              아래 문장을 복사해 [ ] 부분만 채워 보세요.
            </p>
          ) : null}
        </div>
        {isExample ? (
          <button
            type="button"
            onClick={copyExample}
            className="shrink-0 rounded-xl border border-emerald-200/80 bg-white/90 px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50"
          >
            {copied ? "복사됨 ✓" : "예시 복사"}
          </button>
        ) : null}
      </header>

      <div className="mt-3 space-y-3 pl-0 sm:pl-12">
        {isExample && exampleText ? (
          <pre className="overflow-x-auto rounded-xl border border-emerald-200/60 bg-white/80 p-4 font-sans text-sm leading-7 whitespace-pre-wrap text-zinc-800">
            {exampleText}
          </pre>
        ) : (
          <>
        {paragraphs.map((line, i) => (
          <p key={i} className="text-sm leading-7 text-zinc-700">
            {renderInline(line)}
          </p>
        ))}

        {bullets.length > 0 ? (
          <ul className="grid gap-2">
            {bullets.map((line, i) => {
              const text = line.replace(/^\s*-\s*/, "");
              const numbered = section.variant === "action";
              return (
                <li
                  key={i}
                  className={cn(
                    "flex gap-3 rounded-xl border border-white/60 bg-white/50 px-3 py-2.5 text-sm leading-6 text-zinc-800",
                    numbered && "items-start",
                  )}
                >
                  {numbered ? (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-xs font-bold text-amber-800">
                      {i + 1}
                    </span>
                  ) : (
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                  )}
                  <span className="min-w-0 flex-1">{renderInline(text)}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
          </>
        )}
      </div>
    </article>
  );
}

function ProgressBar({
  value,
  tone = "zinc",
}: {
  value: number;
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
    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100/80">
      <div
        className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-500", bar)}
        style={{ width: w }}
      />
    </div>
  );
}

function scoreTone(score: number): "emerald" | "indigo" | "amber" {
  if (score >= 75) return "emerald";
  if (score >= 55) return "indigo";
  return "amber";
}

function scoreMessage(score: number) {
  if (score >= 85) return "훌륭해요! 실전 면접에도 충분히 쓸 수 있는 수준이에요.";
  if (score >= 75) return "좋은 답변이에요. 근거와 수치만 조금 더 보강해 보세요.";
  if (score >= 55) return "기본은 갖췄어요. STAR 구조로 한 번 더 정리해 보세요.";
  return "핵심은 잡혀 있어요. 아래 피드백대로 구조와 근거를 채워 보세요.";
}

export type EvaluationView = {
  overall_score: number;
  scores: Record<string, number>;
  feedback: string;
  strengths: string[];
  improvements: string[];
  followup_questions: string[];
};

export function FeedbackPanel({ evaluation }: { evaluation: EvaluationView }) {
  const sections = useMemo(
    () => parseFeedbackSections(evaluation.feedback),
    [evaluation.feedback],
  );
  const tone = scoreTone(evaluation.overall_score);

  const ringColor =
    tone === "emerald"
      ? "stroke-emerald-500"
      : tone === "indigo"
        ? "stroke-indigo-500"
        : "stroke-amber-500";

  const scoreBg =
    tone === "emerald"
      ? "from-emerald-500/10 to-teal-500/5"
      : tone === "indigo"
        ? "from-indigo-500/10 to-violet-500/5"
        : "from-amber-500/10 to-orange-500/5";

  const circumference = 2 * Math.PI * 52;
  const offset =
    circumference - (clamp01(evaluation.overall_score / 100) * circumference);

  return (
    <div className="grid gap-5">
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border border-white/80 bg-gradient-to-br p-6 shadow-sm",
          scoreBg,
          tone === "emerald"
            ? "border-emerald-200/60"
            : tone === "indigo"
              ? "border-indigo-200/60"
              : "border-amber-200/60",
        )}
      >
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/40 blur-2xl" />
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex h-36 w-36 shrink-0 items-center justify-center">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                className="stroke-zinc-200/80"
                strokeWidth="10"
              />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                className={cn(ringColor, "transition-all duration-700")}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold tracking-tight text-zinc-900">
                {formatScore(evaluation.overall_score)}
              </span>
              <span className="text-xs font-medium text-zinc-500">/ 100</span>
            </div>
          </div>
          <div className="max-w-md text-center sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              종합 점수
            </p>
            <p className="mt-1 text-lg font-semibold text-zinc-900">
              {scoreMessage(evaluation.overall_score)}
            </p>
            <div className="mt-4">
              <ProgressBar value={evaluation.overall_score} tone={tone} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4 lg:col-span-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            세부 점수
          </h4>
          <div className="mt-4 grid gap-4">
            {Object.entries(evaluation.scores).map(([k, v]) => (
              <div key={k}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-600">{scoreLabel(k)}</span>
                  <span className="font-semibold tabular-nums text-zinc-900">
                    {formatScore(v)}
                  </span>
                </div>
                <div className="mt-2">
                  <ProgressBar value={v} tone="zinc" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:col-span-3">
          <InsightList
            title="잘한 점"
            items={evaluation.strengths}
            emptyHint="평가 후 강점이 표시됩니다."
            variant="strength"
          />
          <InsightList
            title="개선 포인트"
            items={evaluation.improvements}
            emptyHint="구체적인 개선 항목이 여기에 나옵니다."
            variant="improve"
          />
          <InsightList
            title="꼬리 질문"
            items={evaluation.followup_questions}
            emptyHint="면접관이 이어서 물을 수 있는 질문입니다."
            variant="followup"
          />
        </div>
      </div>

      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
            <IconSparkles className="h-3.5 w-3.5" />
          </span>
          상세 코칭 피드백
        </h3>
        <div className="grid gap-3">
          {sections.map((section, i) => (
            <FeedbackSectionCard key={`${section.title}-${i}`} section={section} />
          ))}
        </div>
      </div>
    </div>
  );
}

function InsightList({
  title,
  items,
  emptyHint,
  variant,
}: {
  title: string;
  items: string[];
  emptyHint: string;
  variant: "strength" | "improve" | "followup";
}) {
  const styles =
    variant === "strength"
      ? {
          border: "border-emerald-200/70",
          bg: "from-emerald-50/80 to-white",
          dot: "bg-emerald-500",
          badge: "bg-emerald-100 text-emerald-800",
        }
      : variant === "improve"
        ? {
            border: "border-amber-200/70",
            bg: "from-amber-50/80 to-white",
            dot: "bg-amber-500",
            badge: "bg-amber-100 text-amber-800",
          }
        : {
            border: "border-indigo-200/70",
            bg: "from-indigo-50/80 to-white",
            dot: "bg-indigo-500",
            badge: "bg-indigo-100 text-indigo-800",
          };

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-2xl border bg-gradient-to-b p-4",
        styles.border,
        styles.bg,
      )}
    >
      <span
        className={cn(
          "inline-flex w-fit rounded-lg px-2 py-0.5 text-[11px] font-semibold",
          styles.badge,
        )}
      >
        {title}
      </span>
      <ul className="mt-3 flex flex-1 flex-col gap-2">
        {items.length ? (
          items.map((s, i) => (
            <li
              key={i}
              className="flex gap-2.5 rounded-xl border border-white/70 bg-white/60 px-3 py-2 text-sm leading-6 text-zinc-800"
            >
              <span
                className={cn("mt-2 h-1.5 w-1.5 shrink-0 rounded-full", styles.dot)}
              />
              <span>{s}</span>
            </li>
          ))
        ) : (
          <li className="text-sm leading-6 text-zinc-500">{emptyHint}</li>
        )}
      </ul>
    </div>
  );
}
