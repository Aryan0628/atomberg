# ai/nodes/review_composer.py
# Node 4 (final) of the Annual Review Synthesis pipeline — single Gemini Flash call.
#
# Responsibility: takes all structured outputs from nodes 1-3 and composes
# a complete, publication-ready annual performance review draft.
# The output is a polished 4-6 paragraph narrative a manager can copy, edit,
# and submit with minimal changes.

import os
import re
import httpx
from typing import Any


_GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-flash-latest:generateContent"
)

_RATING_CONTEXT = {
    "Exceptional":                 "far exceeded all expectations",
    "Exceeds Expectations":        "consistently exceeded expectations",
    "Meets Expectations":          "met expectations across all key areas",
    "Partially Meets Expectations":"partially met expectations with room for growth",
    "Needs Improvement":           "requires focused development to meet role expectations",
}


def _build_prompt(state: dict[str, Any]) -> str:
    employee = state.get("employee", {})
    cycle = state.get("cycle", {})
    score: float = state.get("annual_weighted_score", 0)
    grade: str = state.get("performance_grade", "")
    trend: str = state.get("trend", "")
    rating: str = state.get("recommended_rating", "Meets Expectations")
    rating_context = _RATING_CONTEXT.get(rating, "met expectations")

    goal_achievements: list[dict] = state.get("goal_achievements", [])
    quarterly_narratives: dict = state.get("quarterly_narratives", {})
    strengths: list[str] = state.get("strengths", [])
    development_areas: list[str] = state.get("development_areas", [])
    sentiment: dict = state.get("sentiment_profile", {})

    goal_lines = "\n".join(
        f"  • {g['title']} ({g['weightage']}% weight): {g['avg_score']}% avg score — {g['status_summary']}"
        for g in goal_achievements
    )
    qn_lines = "\n".join(
        f"  {q}: {text}" for q, text in quarterly_narratives.items() if text
    ) or "  No quarterly narratives available."

    strengths_lines = "\n".join(f"  • {s}" for s in strengths)
    dev_lines = "\n".join(f"  • {d}" for d in development_areas)

    return f"""You are a senior HR business partner. Write a complete, formal Annual Performance Review for the employee below.

EMPLOYEE: {employee.get('name', 'Unknown')}
ROLE: {employee.get('designation', 'Team Member')} — {employee.get('department', '')} department
REVIEW PERIOD: {cycle.get('name', 'FY')} ({cycle.get('fiscalYear', '')})
OVERALL SCORE: {score:.1f}% | GRADE: {grade} | TREND: {trend}
RECOMMENDED RATING: {rating} ({rating_context})

GOAL PERFORMANCE:
{goal_lines or '  No goals recorded.'}

QUARTERLY HIGHLIGHTS:
{qn_lines}

KEY STRENGTHS IDENTIFIED:
{strengths_lines or '  Insufficient data.'}

DEVELOPMENT AREAS:
{dev_lines or '  None identified.'}

SENTIMENT PROFILE: {sentiment.get('overall', 'neutral')} | Self-awareness: {sentiment.get('self_awareness_score', 'unknown')}

---

Write a professional annual performance review draft with these FOUR sections:

1. **Overall Performance Summary** (2-3 sentences): Opening summary citing the score, rating, and overall trajectory.

2. **Goal Achievement Highlights** (3-4 sentences): Reference specific goals by name, scores achieved, and any standout performance. Mention trend direction.

3. **Key Strengths** (2-3 sentences): Synthesise the identified strengths into a coherent narrative. Be specific — name goals or behaviours.

4. **Development Plan for Next Cycle** (2-3 sentences): Turn development areas into forward-looking growth suggestions. Constructive, not critical.

STRICT RULES:
- Write in third person ("Rahul demonstrated…" not "You demonstrated…")
- Use the employee's actual name: {employee.get('name', 'the employee')}
- Professional, formal HR tone — no casual language
- Do NOT invent facts not present in the data above
- Output ONLY the review text — no JSON, no headers, no markdown fences
- Total length: 250-350 words"""


def review_composer_node(state: dict[str, Any]) -> dict[str, Any]:
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY", "")

    _fallback_draft = (
        f"Performance review draft for {state.get('employee', {}).get('name', 'this employee')} "
        f"could not be generated automatically. Annual score: "
        f"{state.get('annual_weighted_score', 0):.1f}% ({state.get('performance_grade', 'N/A')}). "
        "Please compose the narrative manually using the structured data above."
    )

    if not api_key:
        return {**state, "draft_review": _fallback_draft}

    try:
        prompt = _build_prompt(state)
        resp = httpx.post(
            f"{_GEMINI_URL}?key={api_key}",
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=30.0,
        )
        resp.raise_for_status()
        draft = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        return {**state, "draft_review": draft}
    except Exception:
        return {**state, "draft_review": _fallback_draft}
