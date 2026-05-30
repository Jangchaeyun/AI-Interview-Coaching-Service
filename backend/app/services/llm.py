from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class LlmResult:
    data: dict[str, Any]
    used_mock: bool


def _mock_generate_questions(payload: dict[str, Any]) -> LlmResult:
    import re

    role = payload.get("target_role") or "해당 직무"
    categories = payload.get("categories") or [
        "자기소개",
        "경험",
        "문제해결",
        "협업",
        "직무역량",
    ]
    n = int(payload.get("count") or 8)
    resume_text = (payload.get("resume_text") or "").strip()
    cover_text = (payload.get("cover_letter_text") or "").strip()
    other_text = (payload.get("other_text") or "").strip()

    corpus = "\n\n".join(x for x in [resume_text, cover_text, other_text] if x).strip()
    corpus_lower = corpus.lower()
    lines = [ln.strip() for ln in corpus.splitlines() if ln.strip()]

    TECH_KEYWORDS = [
        ("Python", ["python"]),
        ("FastAPI", ["fastapi"]),
        ("Django", ["django"]),
        ("Spring", ["spring"]),
        ("Java", ["java"]),
        ("Kotlin", ["kotlin"]),
        ("JavaScript/TypeScript", ["javascript", "typescript"]),
        ("React", ["react"]),
        ("Next.js", ["next.js", "nextjs", " next "]),
        ("Node.js", ["node.js", "nodejs", " node "]),
        ("PostgreSQL", ["postgres", "postgresql"]),
        ("MySQL", ["mysql"]),
        ("Redis", ["redis"]),
        ("Kafka", ["kafka"]),
        ("Docker", ["docker"]),
        ("Kubernetes", ["kubernetes", "k8s"]),
        ("AWS", ["aws"]),
        ("GCP", ["gcp"]),
        ("Azure", ["azure"]),
        ("Prometheus/Grafana", ["prometheus", "grafana"]),
    ]

    def pick_techs(limit: int = 4) -> list[str]:
        hits = [label for label, keys in TECH_KEYWORDS if any(k in corpus_lower for k in keys)]
        return hits[:limit]

    def pick_metrics(limit: int = 3) -> list[str]:
        found: list[str] = []
        for ln in lines:
            if re.search(r"\d+(\.\d+)?\s*%|\d+\s*(ms|초|분|시간|일|주|개월|년|건|명|배)", ln):
                snippet = ln[:90] + ("…" if len(ln) > 90 else "")
                found.append(snippet)
            if len(found) >= limit:
                break
        return found

    def pick_projects(limit: int = 3) -> list[str]:
        candidates: list[str] = []
        for ln in lines:
            if any(k in ln for k in ("프로젝트", "서비스", "플랫폼", "시스템", "개발", "구축", "담당")):
                if 8 <= len(ln) <= 120:
                    candidates.append(ln)
        # 중복 제거(순서 유지)
        seen: set[str] = set()
        out: list[str] = []
        for c in candidates:
            key = c[:40]
            if key in seen:
                continue
            seen.add(key)
            out.append(c)
            if len(out) >= limit:
                break
        return out

    def pick_motivation_snippet() -> str:
        for ln in lines:
            if any(k in ln for k in ("지원", "동기", "관심", "목표", "성장", "기여")):
                return ln[:100] + ("…" if len(ln) > 100 else "")
        return ""

    def excerpt(s: str, max_len: int = 48) -> str:
        s = s.strip().replace("\n", " ")
        if len(s) <= max_len:
            return s
        return s[: max_len - 1] + "…"

    techs = pick_techs()
    metrics = pick_metrics()
    projects = pick_projects()
    motivation = pick_motivation_snippet()
    has_docs = bool(corpus.strip())

    def tech_phrase() -> str:
        if not techs:
            return "이력서에 적힌 기술 스택"
        if len(techs) == 1:
            return techs[0]
        return f"{techs[0]}·{techs[1]}" + (f" 등({len(techs)}종)" if len(techs) > 2 else "")

    def project_phrase(idx: int = 0) -> str:
        if projects:
            return f"「{excerpt(projects[idx % len(projects)])}」"
        return "이력서에 적힌 대표 프로젝트"

    def metric_phrase(idx: int = 0) -> str:
        if metrics:
            return f"「{excerpt(metrics[idx % len(metrics)], 56)}」"
        return "이력서에 적힌 성과 지표"

    # 카테고리별 구체 질문 템플릿(문서 기반 + 직무)
    def build_question(cat: str, i: int) -> tuple[str, list[str]]:
        tp = tech_phrase()
        pj = project_phrase(i)
        mt = metric_phrase(i)

        if cat in ("자기소개", "소개"):
            if has_docs and motivation:
                q = (
                    f"{role} 지원을 고려할 때, 자소서/이력서에 적으신 "
                    f"「{excerpt(motivation)}」 내용을 바탕으로, "
                    f"지원 동기와 {tp} 경험이 어떻게 연결되는지 1분 내로 설명해 주세요."
                )
            elif has_docs and techs:
                q = (
                    f"이력서에 {tp} 경험이 보입니다. "
                    f"{role}로서 왜 이 기술/경험이 지원 직무에 적합한지, "
                    f"구체 사례 1개와 함께 소개해 주세요."
                )
            else:
                q = (
                    f"{role} 지원 동기, 본인의 핵심 강점 2가지, "
                    f"그 강점을 증명하는 경험 1건을 1분 내로 말해 주세요."
                )
            expected = [
                "왜 이 직무/회사인지(동기)",
                "강점 2가지 + 근거 사례",
                "입사 후 기여(구체 행동 1개)",
            ]

        elif cat in ("경험", "프로젝트"):
            if has_docs and projects:
                q = (
                    f"이력서의 {pj} 항목을 기준으로 답변해 주세요. "
                    f"(1) 당시 서비스/팀 목표, (2) 본인 역할과 책임 범위, "
                    f"(3) {tp}를 활용한 핵심 기술 결정, (4) 정량 성과(전/후 지표)를 말해 주세요."
                )
            elif has_docs and techs:
                q = (
                    f"{tp}를 사용한 프로젝트 경험 1건을 골라, "
                    f"문제 정의 → 본인이 한 일 → 결과(수치) 순으로 설명해 주세요."
                )
            else:
                q = (
                    f"{role}로서 가장 기여도가 컸던 프로젝트 1건을 골라, "
                    f"STAR(상황-과제-행동-결과)로 3분 내 설명해 주세요."
                )
            expected = [
                "프로젝트 목표/배경",
                "본인 역할(owned 범위)",
                "기술 선택 이유/트레이드오프",
                "성과 수치(전/후)",
            ]

        elif cat in ("문제해결", "트러블슈팅"):
            if has_docs and (metrics or techs):
                q = (
                    f"이력서에 {mt if metrics else '성과/개선 내용'}이 언급되어 있습니다. "
                    f"해당 이슈의 (1) 증상과 영향도, (2) 원인 분석 과정, "
                    f"(3) {tp} 관점의 해결책, (4) 재발 방지(모니터링/테스트)를 단계별로 설명해 주세요."
                )
            elif has_docs and projects:
                q = (
                    f"{pj} 수행 중 겪은 기술적 문제(성능/장애/버그) 1건을 골라, "
                    f"가설 → 검증 → 해결 → 재발 방지까지 설명해 주세요."
                )
            else:
                q = (
                    "최근 겪은 기술 이슈 1건을 골라, "
                    "증상·원인·해결·재발방지를 각 1~2문장으로 말해 주세요."
                )
            expected = [
                "문제 정의(지표/영향)",
                "원인 분석(가설/검증)",
                "해결책과 대안 비교",
                "재발 방지 조치",
            ]

        elif cat in ("협업", "커뮤니케이션"):
            if has_docs and projects:
                q = (
                    f"{pj} 진행 중 PM/디자이너/다른 개발자와 의견이 갈렸던 경험이 있다면, "
                    f"갈등 원인, 조율 방식, 최종 합의 기준, 결과를 설명해 주세요."
                )
            else:
                q = (
                    "일정·품질·범위 중 하나에서 트레이드오프가 필요했던 상황을 예로 들어, "
                    "이해관계를 어떻게 정리하고 합의했는지 말해 주세요."
                )
            expected = [
                "갈등/이슈의 원인",
                "상대 입장 파악",
                "합의 과정(데이터/원칙)",
                "결과와 개선",
            ]

        elif cat in ("직무역량", "기술", "직무"):
            if has_docs and techs:
                q = (
                    f"이력서 기준 {tp} 경험이 있습니다. "
                    f"이 중 {role}에게 가장 중요한 역량 2가지를 고르고, "
                    f"각각에 대해 (사례 1개 + 수치 1개 + 부족했던 점/보완)을 설명해 주세요."
                )
            else:
                q = (
                    f"{role}에게 필요한 역량 2가지를 정의하고, "
                    f"본인 경험으로 각 역량을 어떻게 증명하는지 말해 주세요."
                )
            expected = [
                "역량 정의(왜 중요한가)",
                "사례 + 수치 근거",
                "부족점과 학습/보완",
            ]

        elif cat in ("동기", "가치관"):
            if has_docs and motivation:
                q = (
                    f"자소서에 「{excerpt(motivation)}」라고 적으셨는데, "
                    f"그 경험이 {role} 직무에서 어떤 가치관/일하는 방식으로 이어지는지 설명해 주세요."
                )
            else:
                q = f"{role} 직무를 3년 이상 지속하고 싶은 이유와, 그동안의 성장 목표를 말해 주세요."
            expected = ["가치관/동기", "구체 경험 연결", "앞으로의 목표"]

        else:
            if has_docs and projects:
                q = (
                    f"[{cat}] {pj}와 관련해, 본인이 가장 자랑하는 기여 1가지와 "
                    f"다시 한다면 바꿀 점 1가지를 말해 주세요."
                )
            else:
                q = f"[{cat}] 관련 경험 1건을 STAR로 설명하고, 배운 점 1가지를 덧붙여 주세요."
            expected = ["핵심 요약", "STAR 구조", "성과/수치", "회고"]

        return q.strip(), expected

    questions: list[dict[str, Any]] = []
    for i in range(n):
        cat = categories[i % len(categories)]
        difficulty = ["easy", "medium", "hard"][i % 3]
        q, expected = build_question(cat, i)
        questions.append(
            {
                "category": cat,
                "difficulty": difficulty,
                "question": q,
                "expected_points": expected,
            }
        )

    return LlmResult({"questions": questions}, used_mock=True)


def _mock_evaluate_answer(payload: dict[str, Any]) -> LlmResult:
    text = (payload.get("transcript") or "").strip()

    def has_any(keys: list[str]) -> bool:
        return any(k in text for k in keys)

    words = [w for w in text.replace("\n", " ").split(" ") if w.strip()]
    word_count = len(words)
    has_number = any(ch.isdigit() for ch in text)
    has_time = has_any(["주", "개월", "년", "일", "시간", "분", "초"])
    has_metric = has_number or has_any(["%", "퍼센트", "ms", "초", "분", "시간", "원", "만원", "억", "건", "명", "배", "latency", "qps", "tps", "rps"])
    has_star_markers = has_any(["STAR", "상황", "과제", "행동", "결과"])
    has_problem = has_any(["문제", "이슈", "장애", "버그", "오류", "지연", "느려", "성능", "개선", "원인"])
    has_action = has_any(["구현", "설계", "개선", "최적화", "분석", "도입", "리팩토링", "자동화", "모니터링", "테스트", "배포", "협업", "조율"])
    has_result = has_any(["결과", "성과", "개선", "감소", "증가", "향상", "절감", "달성", "해결"])

    # 점수(0~100): 단순하지만 피드백과 일관되게 산정
    clarity = 35 + min(word_count, 120) * 0.4  # 35~83
    if word_count < 20:
        clarity -= 12
    if "\n" in text:
        clarity += 3
    clarity = max(0.0, min(100.0, clarity))

    structure = 35.0
    structure += 22.0 if has_star_markers else 8.0
    structure += 12.0 if (has_problem and has_action and has_result) else 4.0
    structure += 6.0 if has_time else 0.0
    structure = max(0.0, min(100.0, structure))

    evidence = 30.0
    evidence += 35.0 if has_metric else 10.0
    evidence += 15.0 if has_problem else 5.0
    evidence += 10.0 if has_action else 5.0
    evidence = max(0.0, min(100.0, evidence))

    relevance = 55.0 if text else 25.0
    if has_problem or has_action:
        relevance += 10.0
    if word_count < 15:
        relevance -= 10.0
    relevance = max(0.0, min(100.0, relevance))

    delivery = 55.0
    delivery += 8.0 if "\n" in text else 0.0
    delivery += 5.0 if word_count >= 40 else 0.0
    delivery = max(0.0, min(100.0, delivery))

    scores = {
        "clarity": round(clarity, 1),
        "structure": round(structure, 1),
        "relevance": round(relevance, 1),
        "evidence": round(evidence, 1),
        "delivery": round(delivery, 1),
    }
    overall = round(
        max(
            0.0,
            min(
                100.0,
                clarity * 0.22
                + structure * 0.26
                + relevance * 0.16
                + evidence * 0.26
                + delivery * 0.10,
            ),
        ),
        1,
    )

    strengths: list[str] = []
    improvements: list[str] = []
    tips: list[str] = []

    if word_count >= 30:
        strengths.append("답변 길이가 너무 짧지 않아 핵심을 확장할 여지가 있습니다.")
    if has_problem:
        strengths.append("문제(상황/이슈)를 언급해 맥락을 잡으려는 시도가 있습니다.")
    if has_action:
        strengths.append("본인이 한 행동(개선/구현/분석)을 포함하고 있습니다.")
    if has_metric:
        strengths.append("수치/지표가 포함되어 설득력이 올라갈 가능성이 있습니다.")

    if not has_star_markers:
        improvements.append("구조가 보이지 않습니다. STAR 순서로 4문장만 먼저 만들고 확장하세요.")
        tips.append("템플릿: (상황) ~이었다. (과제) 목표는 ~였다. (행동) 나는 ~을 했다. (결과) 그 결과 ~가 ~만큼 변했다.")
    if not has_metric:
        improvements.append("근거가 약합니다. 결과를 수치 1개로 고정하세요(예: 응답시간 40%↓, 오류율 1.2%→0.3%).")
        tips.append("수치 후보: 처리량(QPS/TPS), latency(ms), 비용(원), 시간(분/시간), 전환율(%), 장애건수(건)")
    if word_count < 25:
        improvements.append("답변이 짧아 평가가 어렵습니다. '역할/결정/결과' 3가지를 반드시 포함해 주세요.")
    if not (has_problem and has_action and has_result):
        improvements.append("문제-행동-결과 연결이 약합니다. 각 단계가 이어지도록 '그래서/때문에'로 연결해보세요.")

    if not strengths and text:
        strengths = ["주제에서 크게 벗어나진 않지만, 근거/구조를 더 보강하면 좋겠습니다."]
    if not text:
        improvements = ["텍스트로 답변을 입력하거나, STT를 붙여 transcript를 만든 뒤 평가해보세요."]

    # 아주 단순한 "부분 인용": 사용자가 쓴 첫 문장 일부를 잡아서 '더 구체화' 가이드를 제공합니다.
    def excerpt(s: str, max_len: int = 80) -> str:
        s = s.strip().replace("\n", " ")
        if not s:
            return ""
        if len(s) <= max_len:
            return s
        return s[: max_len - 1] + "…"

    first_line = ""
    if text:
        first_line = text.splitlines()[0].strip() if text.splitlines() else text
    quoted = excerpt(first_line)

    # 개선된 답변 예시(바로 복사 가능한 4문장 템플릿)
    example_metric = "응답시간 40% 감소" if not has_metric else "전/후 지표(예: 1200ms→700ms)"
    improved_example = "\n".join(
        [
            "(상황) 프로젝트에서 [문제/상황] 때문에 지표가 나빠지고 있었습니다.",
            "(과제) 제 목표는 [목표 지표]를 [기간] 안에 개선하는 것이었습니다.",
            "(행동) 원인을 [방법]으로 분석하고, [대안 A/B]를 비교해 [선택]을 적용했습니다.",
            f"(결과) 그 결과 {example_metric}를 달성했고, 재발 방지를 위해 [모니터링/테스트]를 추가했습니다.",
        ]
    )

    # 피드백 본문은 '관찰 → 처방 → 바로쓰기 예시' 흐름으로 제공
    obs = []
    obs.append(f"- 길이: 약 {word_count}단어")
    obs.append(f"- STAR 구조 힌트: {'있음' if has_star_markers else '없음'}")
    obs.append(f"- 수치/지표: {'있음' if has_metric else '없음'}")
    obs.append(f"- 문제/행동/결과: {'있음' if (has_problem and has_action and has_result) else '불완전'}")

    feedback_parts = [
        "### 요약",
        "현재 답변은 **구조(STAR)** 와 **근거(수치/결과)** 를 더 명확히 하면 점수가 크게 오를 상태입니다.",
        "",
        "### 관찰",
        *obs,
        *(["", "### 현재 답변에서 특히 모호한 부분(예시)"] if quoted else []),
        *([f"- “{quoted}”"] if quoted else []),
        *(["- 위 문장을 더 구체적으로 만들려면: (1) 본인 역할, (2) 사용한 방법, (3) 전/후 지표를 1개씩 추가하세요."] if quoted else []),
        "",
        "### 다음 답변에서 바로 고칠 3가지",
        *(f"- {x}" for x in improvements[:3]),
    ]
    if tips:
        feedback_parts += ["", "### 바로쓰기 템플릿", *[f"- {t}" for t in tips[:2]]]

    feedback_parts += [
        "",
        "### 개선된 답변 예시(복사해서 채우기)",
        improved_example,
    ]

    feedback = "\n".join(feedback_parts).strip()

    return LlmResult(
        {
            "rubric_version": "mock-v1",
            "overall_score": overall,
            "scores": scores,
            "feedback": feedback,
            "strengths": strengths[:5],
            "improvements": improvements[:5],
            "followup_questions": [
                "당시 본인의 책임 범위(owned)가 어디까지였나요?",
                "대안은 무엇이었고, 왜 지금 선택이 최선이었나요?",
                "결과를 수치로 재현한다면, 전/후 지표는 어떻게 되나요?",
            ],
        },
        used_mock=True,
    )


def call_llm(task: str, payload: dict[str, Any]) -> LlmResult:
    """
    현재는 기본적으로 mock을 사용합니다.
    - 환경변수 OPENAI_API_KEY가 있고 openai SDK가 설치돼 있으면 실제 호출로 확장 가능.
    """
    if task == "generate_questions":
        return _mock_generate_questions(payload)
    if task == "evaluate_answer":
        return _mock_evaluate_answer(payload)
    return LlmResult({"error": f"unknown task: {task}"}, used_mock=True)


def as_json(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False)
