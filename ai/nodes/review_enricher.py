# ai/nodes/review_enricher.py
# Node 1 of the Annual Review Synthesis pipeline — pure Python, zero LLM cost.
#
# Responsibility: normalize the raw goals + check-ins payload into a flat,
# analysis-ready structure that every downstream node can consume without
# re-parsing the original request shape.

from typing import Any


def review_enricher_node(state: dict[str, Any]) -> dict[str, Any]:
    goals: list[dict] = state.get("goals", [])

    enriched_checkins: list[dict] = []
    quarters_present: set[str] = set()
    narrative_texts: dict[str, list] = {
        "what_went_well": [],
        "blockers": [],
        "employee_notes": [],
        "manager_comments": [],
        "self_ratings": [],
        "manager_ratings": [],
    }

    for goal in goals:
        weightage = float(goal.get("weightage", 0))
        title = goal.get("title", "")
        thrust = goal.get("thrustArea", "")
        uom = goal.get("uomType", "")
        target = goal.get("target")

        for ci in goal.get("checkins", []):
            quarter = ci.get("quarter", "")
            quarters_present.add(quarter)

            enriched = {
                "goal_title": title,
                "thrust_area": thrust,
                "uom_type": uom,
                "target": target,
                "goal_weightage": weightage,
                "quarter": quarter,
                "score_pct": float(ci.get("scorePercentage") or 0),
                "progress_status": ci.get("progressStatus", "NOT_STARTED"),
                "employee_note": ci.get("employeeNote") or "",
                "self_rating": ci.get("selfRating"),
                "what_went_well": ci.get("whatWentWell") or "",
                "blockers": ci.get("blockers") or "",
                "manager_comment": ci.get("managerComment") or "",
                "manager_rating": ci.get("managerRating"),
                "actual_value": ci.get("actualValue"),
            }
            enriched_checkins.append(enriched)

            # Collect narrative text pools for sentiment analysis
            if enriched["what_went_well"]:
                narrative_texts["what_went_well"].append(enriched["what_went_well"])
            if enriched["blockers"]:
                narrative_texts["blockers"].append(enriched["blockers"])
            if enriched["employee_note"]:
                narrative_texts["employee_notes"].append(enriched["employee_note"])
            if enriched["manager_comment"]:
                narrative_texts["manager_comments"].append(enriched["manager_comment"])
            if enriched["self_rating"] is not None:
                narrative_texts["self_ratings"].append(enriched["self_rating"])
            if enriched["manager_rating"] is not None:
                narrative_texts["manager_ratings"].append(enriched["manager_rating"])

    # Check-in completion rate: actual checkins vs max possible (goals × 4 quarters)
    total_possible = max(len(goals) * 4, 1)
    completion_rate = round(len(enriched_checkins) / total_possible, 3)

    return {
        **state,
        "enriched_checkins": enriched_checkins,
        "quarters_present": sorted(quarters_present),
        "narrative_texts": narrative_texts,
        "checkin_completion_rate": completion_rate,
        "total_goals": len(goals),
    }
