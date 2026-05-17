# ai/nodes/review_analyzer.py
# Node 3 of the Annual Review Synthesis pipeline — single Gemini Flash call.
#
# Responsibility: one structured LLM call that produces:
#   - Sentiment profile (overall tone, recurring themes)
#   - Per-quarter narrative paragraph (only for quarters with data)
#   - 3-5 key strengths
#   - 2-3 development areas
#
# By batching all of this into one call we stay well within free-tier limits
# and keep latency under 5s.

import os
import json
import re
import httpx
from typing import Any


_GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-flash-latest:generateContent"
)


def _build_prompt(state: dict[str, Any]) -> str:
    employee = state.get("employee", {})
    cycle = state.get("cycle", {})
    enriched: list[dict] = state.get("enriched_checkins", [])
    narrative_texts: dict = state.get("narrative_texts", {})
    goal_achievements: list[dict] = state.get("goal_achievements", [])
    annual_score: float = state.get("annual_weighted_score", 0)
    grade: str = state.get("performance_grade", "")
    trend: str = state.get("trend", "")
    quarters: list[str] = state.get("quarters_present", [])

    # Compact check-in data per quarter
    quarter_data: dict[str, list[str]] = {}
    for ci in enriched:
        q = ci["quarter"]
        parts = [f"Goal: {ci['goal_title']} (Score: {ci['score_pct']:.0f}%)"]
        if ci["what_went_well"]:
            parts.append(f"  Went well: {ci['what_went_well']}")
        if ci["blockers"]:
            parts.append(f"  Blockers: {ci['blockers']}")
        if ci["employee_note"]:
            parts.append(f"  Employee note: {ci['employee_note']}")
        if ci["manager_comment"]:
            parts.append(f"  Manager comment: {ci['manager_comment']}")
        if ci["self_rating"] is not None:
            parts.append(f"  Self-rating: {ci['self_rating']}/5")
        quarter_data.setdefault(q, []).append("\n".join(parts))

    goal_summary = "\n".join(
        f"- {g['title']} | {g['weightage']}% weight | Avg score: {g['avg_score']}% | {g['status_summary']}"
        for g in goal_achievements
    )

    quarter_blocks = "\n\n".join(
        f"=== {q} ===\n" + "\n---\n".join(items)
        for q, items in sorted(quarter_data.items())
    )

    return f"""You are a senior HR business partner writing a structured analysis for an annual performance review.

EMPLOYEE: {employee.get('name', 'Unknown')} | {employee.get('designation', '')} | {employee.get('department', '')} dept
CYCLE: {cycle.get('name', '')} ({cycle.get('fiscalYear', '')})
OVERALL SCORE: {annual_score:.1f}% | GRADE: {grade} | TREND: {trend}
QUARTERS WITH DATA: {', '.join(quarters) if quarters else 'None'}

GOAL PERFORMANCE SUMMARY:
{goal_summary}

CHECK-IN DATA BY QUARTER:
{quarter_blocks if quarter_blocks else 'No check-in data available.'}

---

Using ONLY the data above, respond with valid JSON matching this exact schema:

{{
  "sentiment_profile": {{
    "overall": "<positive|neutral|mixed|negative>",
    "confidence_level": "<high|medium|low — based on data completeness>",
    "recurring_strengths_themes": ["<theme1>", "<theme2>"],
    "recurring_blocker_themes": ["<theme1>", "<theme2>"],
    "self_awareness_score": "<high|medium|low — based on alignment between self-rating and actual score>"
  }},
  "quarterly_narratives": {{
    "Q1": "<2-3 sentence professional narrative for Q1, or null if no Q1 data>",
    "Q2": "<2-3 sentence professional narrative for Q2, or null if no Q2 data>",
    "Q3": "<2-3 sentence professional narrative for Q3, or null if no Q3 data>",
    "Q4": "<2-3 sentence professional narrative for Q4, or null if no Q4 data>"
  }},
  "strengths": [
    "<specific, evidence-backed strength statement 1>",
    "<specific, evidence-backed strength statement 2>",
    "<specific, evidence-backed strength statement 3>"
  ],
  "development_areas": [
    "<specific, constructive development area 1 with suggested action>",
    "<specific, constructive development area 2 with suggested action>"
  ]
}}

Rules:
- Be specific — reference actual goals and scores, not generic HR language.
- Quarterly narratives must reference that quarter's actual data.
- If a quarter has no data, set it to null.
- Keep each narrative to 2-3 sentences maximum.
- Strengths must be evidence-backed (cite goal names or scores).
- Development areas must be constructive and actionable.
- Output ONLY the JSON object — no markdown fences, no explanation."""


def review_analyzer_node(state: dict[str, Any]) -> dict[str, Any]:
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY", "")

    _default = {
        "sentiment_profile": {
            "overall": "neutral",
            "confidence_level": "low",
            "recurring_strengths_themes": [],
            "recurring_blocker_themes": [],
            "self_awareness_score": "low",
        },
        "quarterly_narratives": {"Q1": None, "Q2": None, "Q3": None, "Q4": None},
        "strengths": ["Performance data is limited — manual review recommended."],
        "development_areas": ["Ensure check-ins are completed each quarter for accurate assessment."],
    }

    if not api_key:
        return {**state, **_default}

    try:
        prompt = _build_prompt(state)
        resp = httpx.post(
            f"{_GEMINI_URL}?key={api_key}",
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=30.0,
        )
        resp.raise_for_status()
        raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        raw = re.sub(r"^```(?:json)?\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)
        parsed = json.loads(raw)

        return {
            **state,
            "sentiment_profile": parsed.get("sentiment_profile", _default["sentiment_profile"]),
            "quarterly_narratives": parsed.get("quarterly_narratives", _default["quarterly_narratives"]),
            "strengths": parsed.get("strengths", _default["strengths"]),
            "development_areas": parsed.get("development_areas", _default["development_areas"]),
        }
    except Exception:
        return {**state, **_default}
