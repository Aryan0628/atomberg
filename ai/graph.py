# ai/graph.py
# LangGraph StateGraph — 4-node multi-agent pipeline for goal quality evaluation.
#
# Flow: brd_enforcer → smart_analyzer → semantic_matcher → output_formatter → END
#
# Node responsibilities:
#   brd_enforcer:     Deterministic BRD constraint checks (no LLM)
#   smart_analyzer:   Gemini 1.5 Flash — SMART criteria scoring + improved title
#   semantic_matcher: Gemini embeddings — cosine similarity vs 20 golden goals
#   output_formatter: Weighted score aggregation + BRD penalty

from typing import TypedDict, Optional, Any
from langgraph.graph import StateGraph, END

from nodes.brd_enforcer import brd_enforcer_node
from nodes.smart_analyzer import smart_analyzer_node
from nodes.semantic_matcher import semantic_matcher_node
from nodes.output_formatter import output_formatter_node


class GoalEvalState(TypedDict, total=False):
    # ── Input fields ──────────────────────────────────────────
    title: str
    description: str
    uom_type: str
    target: Optional[float]
    weightage: float
    thrust_area: str

    # ── Node outputs ──────────────────────────────────────────
    brd_issues: list[str]
    smart_scores: dict[str, int]
    suggestions: list[str]
    improved_title: str
    verdict: str
    semantic_match: dict[str, Any]

    # ── Final output ─────────────────────────────────────────
    overall_score: int


def build_graph() -> Any:
    g = StateGraph(GoalEvalState)

    g.add_node("brd_enforcer", brd_enforcer_node)
    g.add_node("smart_analyzer", smart_analyzer_node)
    g.add_node("semantic_matcher", semantic_matcher_node)
    g.add_node("output_formatter", output_formatter_node)

    g.set_entry_point("brd_enforcer")
    g.add_edge("brd_enforcer", "smart_analyzer")
    g.add_edge("smart_analyzer", "semantic_matcher")
    g.add_edge("semantic_matcher", "output_formatter")
    g.add_edge("output_formatter", END)

    return g.compile()


# Compiled graph — imported by main.py
goal_eval_graph = build_graph()
