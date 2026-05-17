# ai/redundancy_graph.py
# LangGraph StateGraph — Semantic Goal Redundancy Detection pipeline.
#
# 3-node pipeline with a conditional skip on the final LLM node:
#   redundancy_embedder  →  redundancy_ranker  →  redundancy_recommender
#
#   Node 1 (embedder):      Gemini Embedding API — batch embed new + existing goals
#   Node 2 (ranker):        Pure Python/NumPy — cosine similarity + threshold filter
#   Node 3 (recommender):   Gemini Flash — generate recommendations (SKIPPED if no matches)
#
# The conditional edge after the ranker is the key architectural choice: if the
# ranker finds no matches above the 0.85 threshold, the graph jumps directly to
# END without burning an LLM call. For the common case (no duplicate), the total
# cost is just one batch embedding API call.

from typing import TypedDict, Any
from langgraph.graph import StateGraph, END

from nodes.redundancy_embedder import redundancy_embedder_node
from nodes.redundancy_ranker import redundancy_ranker_node
from nodes.redundancy_recommender import redundancy_recommender_node


class RedundancyState(TypedDict, total=False):
    # ── Request inputs ────────────────────────────────────────────────────────
    new_goal: dict           # {title, description, thrust_area}
    existing_goals: list     # [{id, title, description, thrust_area, owner_name, owner_department}]

    # ── Node 1: embedder outputs ──────────────────────────────────────────────
    new_goal_embedding: list[float]
    existing_embeddings: list[list[float]]
    embedding_error: bool

    # ── Node 2: ranker outputs ────────────────────────────────────────────────
    has_redundancy: bool
    raw_matches: list[dict]

    # ── Node 3: recommender output ────────────────────────────────────────────
    matches: list[dict]      # Final matches with recommendation text attached


def _should_recommend(state: RedundancyState) -> str:
    """Conditional edge: only call the LLM recommender when matches were found."""
    return "redundancy_recommender" if state.get("has_redundancy") else END


def build_redundancy_graph() -> Any:
    g = StateGraph(RedundancyState)

    g.add_node("redundancy_embedder", redundancy_embedder_node)
    g.add_node("redundancy_ranker", redundancy_ranker_node)
    g.add_node("redundancy_recommender", redundancy_recommender_node)

    g.set_entry_point("redundancy_embedder")
    g.add_edge("redundancy_embedder", "redundancy_ranker")

    # Conditional: go to recommender only when duplicates detected
    g.add_conditional_edges(
        "redundancy_ranker",
        _should_recommend,
        {"redundancy_recommender": "redundancy_recommender", END: END},
    )
    g.add_edge("redundancy_recommender", END)

    return g.compile()


redundancy_graph = build_redundancy_graph()
