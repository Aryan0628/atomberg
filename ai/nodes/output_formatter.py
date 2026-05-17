# ai/nodes/output_formatter.py
# Aggregates all node outputs into the final structured response.
# Computes the overall score from SMART sub-scores + BRD penalty.

from typing import Any


def output_formatter_node(state: dict[str, Any]) -> dict[str, Any]:
    smart: dict[str, int] = state.get("smart_scores", {})
    brd_issues: list[str] = state.get("brd_issues", [])

    # Weighted SMART average — measurable and specific matter most for HR goals
    weights = {"specific": 0.25, "measurable": 0.25, "achievable": 0.20, "relevant": 0.15, "time_bound": 0.15}
    raw_score = sum(smart.get(k, 5) * w for k, w in weights.items())

    # Each BRD violation deducts 1 point (max penalty: 3)
    brd_penalty = min(len(brd_issues), 3)
    overall = max(1, round(raw_score - brd_penalty))

    return {
        **state,
        "overall_score": overall,
    }
