# ai/nodes/redundancy_ranker.py
# Node 2 of the Semantic Redundancy Detection pipeline — pure Python/NumPy, no LLM.
#
# Responsibility: compute cosine similarity between the new goal and every
# existing goal, then filter and rank results above the redundancy threshold.
#
# Threshold tuning:
#   ≥ 0.92  →  near-duplicate (almost certainly the same goal)
#   ≥ 0.85  →  highly similar (strong candidate for shared KPI)
#   ≥ 0.75  →  related (worth surfacing as an FYI, lower priority)

import numpy as np
from typing import Any

# Only surface matches at or above this threshold
_REDUNDANCY_THRESHOLD = 0.85


def _cosine_similarity(a: list[float], b_matrix: list[list[float]]) -> np.ndarray:
    """Return cosine similarities between vector a and each row of b_matrix."""
    if not a or not b_matrix:
        return np.array([])
    vec_a = np.array(a, dtype=np.float32)
    mat_b = np.array(b_matrix, dtype=np.float32)
    dot = mat_b @ vec_a
    norm_a = np.linalg.norm(vec_a)
    norms_b = np.linalg.norm(mat_b, axis=1)
    denominator = norm_a * norms_b
    # Avoid division by zero for zero-vectors
    denominator = np.where(denominator == 0, 1.0, denominator)
    return dot / denominator


def redundancy_ranker_node(state: dict[str, Any]) -> dict[str, Any]:
    new_emb: list[float] = state.get("new_goal_embedding", [])
    existing_embs: list[list[float]] = state.get("existing_embeddings", [])
    existing_goals: list[dict] = state.get("existing_goals", [])

    if not new_emb or not existing_embs:
        return {**state, "has_redundancy": False, "raw_matches": []}

    similarities = _cosine_similarity(new_emb, existing_embs)

    raw_matches: list[dict] = []
    for idx, sim in enumerate(similarities):
        sim_float = float(sim)
        if sim_float >= _REDUNDANCY_THRESHOLD and idx < len(existing_goals):
            goal = existing_goals[idx]
            raw_matches.append({
                "goal_id": goal.get("id", ""),
                "goal_title": goal.get("title", ""),
                "owner_name": goal.get("owner_name", ""),
                "owner_department": goal.get("owner_department", ""),
                "thrust_area": goal.get("thrust_area", ""),
                "similarity": round(sim_float, 4),
                # Label based on similarity tier
                "match_level": (
                    "near_duplicate" if sim_float >= 0.92
                    else "highly_similar"
                ),
            })

    # Sort: highest similarity first
    raw_matches.sort(key=lambda m: m["similarity"], reverse=True)

    return {
        **state,
        "has_redundancy": len(raw_matches) > 0,
        "raw_matches": raw_matches,
    }
