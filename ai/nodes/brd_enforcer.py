# ai/nodes/brd_enforcer.py
# Deterministic BRD rule validation — no LLM, pure Python.
# Checks mathematical constraints from the Business Requirements Document.

from typing import Any


def brd_enforcer_node(state: dict[str, Any]) -> dict[str, Any]:
    issues: list[str] = []
    uom_type: str = state.get("uom_type", "")
    target = state.get("target")
    weightage: float = float(state.get("weightage", 0))
    title: str = state.get("title", "")
    description: str = state.get("description", "")

    # Weightage bounds check
    if weightage < 10:
        issues.append(f"Weightage {weightage}% is below the minimum of 10%")
    if weightage > 100:
        issues.append(f"Weightage {weightage}% exceeds maximum of 100%")

    # UoM-specific target requirement
    if uom_type in ("NUMERIC_MIN", "NUMERIC_MAX", "PERCENTAGE") and not target:
        issues.append(f"UoM type '{uom_type}' requires a numeric target value")

    # Title length
    if len(title) < 10:
        issues.append("Goal title is too short — minimum 10 characters for clarity")
    if len(title) > 200:
        issues.append("Goal title exceeds 200 character limit")

    # Description
    if description and len(description) > 1000:
        issues.append("Description exceeds 1000 character limit")

    return {**state, "brd_issues": issues}
