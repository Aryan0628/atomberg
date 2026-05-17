# ai/nodes/redundancy_recommender.py
# Node 3 (final) of the Semantic Redundancy Detection pipeline.
#
# Responsibility: for each match above the threshold, generate a specific,
# actionable recommendation via a single Gemini Flash call.
#
# This node is SKIPPED (returns immediately) when has_redundancy is False,
# saving an LLM call on every non-duplicate goal submission.

import os
import json
import re
import httpx
from typing import Any

_GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-flash-latest:generateContent"
)


def redundancy_recommender_node(state: dict[str, Any]) -> dict[str, Any]:
    # Fast path: no matches — skip LLM entirely
    if not state.get("has_redundancy"):
        return {**state, "matches": []}

    raw_matches: list[dict] = state.get("raw_matches", [])
    new_goal: dict = state.get("new_goal", {})
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY", "")

    # Attach default recommendations in case LLM call fails
    for m in raw_matches:
        pct = round(m["similarity"] * 100)
        m["recommendation"] = (
            f"{m['owner_name']} in {m['owner_department']} is working on a "
            f"{pct}% similar goal (\"{m['goal_title']}\"). "
            "Consider converting both into a Shared Departmental KPI to eliminate "
            "duplicate effort and align cross-functional teams."
        )

    if not api_key:
        return {**state, "matches": raw_matches}

    # One Gemini call covers all matches in the response
    matches_text = "\n".join(
        f"{i+1}. \"{m['goal_title']}\" owned by {m['owner_name']} "
        f"({m['owner_department']}) — {round(m['similarity']*100)}% similar — "
        f"{m['match_level'].replace('_', ' ')}"
        for i, m in enumerate(raw_matches)
    )

    prompt = f"""You are an organizational effectiveness consultant reviewing duplicate goals in a company's performance management system.

NEW GOAL BEING SUBMITTED:
Title: {new_goal.get('title', '')}
Description: {new_goal.get('description', 'Not provided')}
Thrust Area: {new_goal.get('thrust_area', '')}

SIMILAR EXISTING GOALS DETECTED:
{matches_text}

For each similar goal, write ONE clear, specific recommendation (2 sentences max) that:
1. Names the existing goal owner and their department
2. Suggests a concrete action (merge into Shared KPI / coordinate / split ownership)
3. Explains the organizational benefit (no redundancy / clearer ownership / cross-team alignment)

Respond with ONLY valid JSON — an array of recommendation strings in the same order as the similar goals listed above:
["<recommendation for match 1>", "<recommendation for match 2>", ...]"""

    try:
        resp = httpx.post(
            f"{_GEMINI_URL}?key={api_key}",
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=20.0,
        )
        resp.raise_for_status()
        raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        raw = re.sub(r"^```(?:json)?\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)
        recommendations: list[str] = json.loads(raw)

        for i, m in enumerate(raw_matches):
            if i < len(recommendations) and recommendations[i]:
                m["recommendation"] = recommendations[i]
    except Exception:
        pass  # Keep the default recommendations generated above

    return {**state, "matches": raw_matches}
