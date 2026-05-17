# ai/nodes/semantic_matcher.py
# Gemini text-embedding-004 + cosine similarity against 20 golden standard company goals.
# Finds the closest golden goal to give contextual benchmarking feedback.

from typing import Any
from golden_goals import find_best_match


def semantic_matcher_node(state: dict[str, Any]) -> dict[str, Any]:
    goal_text = f"{state.get('title', '')} {state.get('description', '')}".strip()

    try:
        match = find_best_match(goal_text)
    except Exception:
        match = {"title": "", "similarity": 0.0}

    return {**state, "semantic_match": match}
