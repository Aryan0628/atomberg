# ai/nodes/smart_analyzer.py
# Gemini 1.5 Flash LLM call — evaluates goal against SMART criteria.
# Returns structured scores and an improved title suggestion.

import os
import json
import re
import httpx
from typing import Any

_PROMPT_TEMPLATE = """You are an expert HR performance management consultant evaluating employee goals for SMART criteria.

Goal Details:
- Title: {title}
- Description: {description}
- Thrust Area: {thrust_area}
- Measurement Type: {uom_type}
- Target Value: {target}
- Weightage: {weightage}%

Evaluate this goal strictly against SMART criteria and respond with ONLY valid JSON (no markdown, no explanation):

{{
  "smart_scores": {{
    "specific": <1-10 integer>,
    "measurable": <1-10 integer>,
    "achievable": <1-10 integer>,
    "relevant": <1-10 integer>,
    "time_bound": <1-10 integer>
  }},
  "suggestions": [<up to 3 specific actionable improvement strings>],
  "improved_title": "<rewritten goal title that is more SMART>",
  "verdict": "<one of: strong | acceptable | needs_work>"
}}

Scoring guide: 9-10=excellent, 7-8=good, 5-6=acceptable, 1-4=poor.
Be strict. Most goals have real weaknesses. If there is no target date, time_bound must be ≤4."""

def smart_analyzer_node(state: dict[str, Any]) -> dict[str, Any]:
    prompt = _PROMPT_TEMPLATE.format(
        title=state.get("title", ""),
        description=state.get("description", "") or "Not provided",
        thrust_area=state.get("thrust_area", ""),
        uom_type=state.get("uom_type", ""),
        target=state.get("target") or "Not specified",
        weightage=state.get("weightage", 0),
    )

    try:
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY", "")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={api_key}"
        resp = httpx.post(url, json={"contents": [{"parts": [{"text": prompt}]}]}, timeout=30.0)
        resp.raise_for_status()
        raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        # Strip markdown code fences if present
        raw = re.sub(r"^```(?:json)?\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)
        parsed = json.loads(raw)
    except Exception:
        # Graceful degradation — return neutral scores if LLM call fails
        parsed = {
            "smart_scores": {"specific": 5, "measurable": 5, "achievable": 5, "relevant": 5, "time_bound": 5},
            "suggestions": ["AI analysis temporarily unavailable — please review manually"],
            "improved_title": state.get("title", ""),
            "verdict": "acceptable",
        }

    return {
        **state,
        "smart_scores": parsed.get("smart_scores", {}),
        "suggestions": parsed.get("suggestions", []),
        "improved_title": parsed.get("improved_title", state.get("title", "")),
        "verdict": parsed.get("verdict", "acceptable"),
    }
