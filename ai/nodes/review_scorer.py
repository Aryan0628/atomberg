# ai/nodes/review_scorer.py
# Node 2 of the Annual Review Synthesis pipeline — pure Python, zero LLM cost.
#
# Responsibility: compute all quantitative metrics from the enriched check-in
# data. Downstream LLM nodes receive clean numbers, never raw floats from JSON.
#
# Outputs:
#   annual_weighted_score  — weightage-adjusted average across all check-ins
#   performance_grade      — A / B+ / B / C / D / F
#   trend                  — improving | stable | declining | insufficient_data
#   goal_achievements      — per-goal summary for the review narrative

from typing import Any


_GRADE_THRESHOLDS = [
    (95, "A+"), (90, "A"), (85, "A-"),
    (80, "B+"), (75, "B"), (70, "B-"),
    (65, "C+"), (60, "C"), (55, "C-"),
    (50, "D"),
]

_RATING_MAP = {
    "A+": "Exceptional",
    "A":  "Exceptional",
    "A-": "Exceeds Expectations",
    "B+": "Exceeds Expectations",
    "B":  "Meets Expectations",
    "B-": "Meets Expectations",
    "C+": "Partially Meets Expectations",
    "C":  "Partially Meets Expectations",
    "C-": "Needs Improvement",
    "D":  "Needs Improvement",
}


def _grade(score: float) -> str:
    for threshold, grade in _GRADE_THRESHOLDS:
        if score >= threshold:
            return grade
    return "F"


def review_scorer_node(state: dict[str, Any]) -> dict[str, Any]:
    goals: list[dict] = state.get("goals", [])
    enriched: list[dict] = state.get("enriched_checkins", [])

    # ── Per-goal aggregation ──────────────────────────────────────────────────
    goal_map: dict[str, dict] = {}
    for goal in goals:
        title = goal["title"]
        goal_map[title] = {
            "title": title,
            "thrust_area": goal.get("thrustArea", ""),
            "weightage": float(goal.get("weightage", 0)),
            "uom_type": goal.get("uomType", ""),
            "target": goal.get("target"),
            "scores": [],      # list of scorePercentage values
            "statuses": [],    # list of progressStatus strings
        }

    for ci in enriched:
        title = ci["goal_title"]
        if title in goal_map:
            goal_map[title]["scores"].append(ci["score_pct"])
            goal_map[title]["statuses"].append(ci["progress_status"])

    goal_achievements: list[dict] = []
    for gd in goal_map.values():
        scores = gd["scores"]
        avg = round(sum(scores) / len(scores), 1) if scores else 0.0
        completed = any(s == "COMPLETED" for s in gd["statuses"])
        on_track = any(s in ("ON_TRACK", "COMPLETED") for s in gd["statuses"])
        goal_achievements.append({
            "title": gd["title"],
            "thrust_area": gd["thrust_area"],
            "weightage": gd["weightage"],
            "uom_type": gd["uom_type"],
            "target": gd["target"],
            "avg_score": avg,
            "check_in_count": len(scores),
            "status_summary": "completed" if completed else "on_track" if on_track else "at_risk",
        })

    # ── Annual weighted score ─────────────────────────────────────────────────
    total_weight = sum(g["weightage"] for g in goal_achievements if g["avg_score"] > 0)
    if total_weight > 0:
        annual_score = sum(
            g["avg_score"] * g["weightage"] / total_weight
            for g in goal_achievements
            if g["avg_score"] > 0
        )
    else:
        annual_score = 0.0
    annual_score = round(annual_score, 1)

    # ── Quarterly trend (Q1 → Q4 direction) ──────────────────────────────────
    quarters = ["Q1", "Q2", "Q3", "Q4"]
    quarter_avgs: list[tuple[str, float]] = []
    for q in quarters:
        qscores = [ci["score_pct"] for ci in enriched if ci["quarter"] == q]
        if qscores:
            quarter_avgs.append((q, round(sum(qscores) / len(qscores), 1)))

    if len(quarter_avgs) >= 2:
        first, last = quarter_avgs[0][1], quarter_avgs[-1][1]
        delta = last - first
        trend = "improving" if delta > 5 else "declining" if delta < -5 else "stable"
    elif len(quarter_avgs) == 1:
        trend = "insufficient_data"
    else:
        trend = "no_data"

    grade = _grade(annual_score)
    recommended_rating = _RATING_MAP.get(grade, "Needs Improvement")

    return {
        **state,
        "annual_weighted_score": annual_score,
        "performance_grade": grade,
        "trend": trend,
        "quarter_averages": quarter_avgs,
        "goal_achievements": goal_achievements,
        "recommended_rating": recommended_rating,
    }
