# ai/review_graph.py
# LangGraph StateGraph — Annual Performance Review Synthesis pipeline.
#
# 4-node sequential pipeline:
#   review_enricher  →  review_scorer  →  review_analyzer  →  review_composer
#
#   Node 1 (enricher):  Pure Python — normalise raw check-in data
#   Node 2 (scorer):    Pure Python — compute weighted scores, grade, trend
#   Node 3 (analyzer):  Gemini Flash — sentiment + per-quarter narratives (1 LLM call)
#   Node 4 (composer):  Gemini Flash — full professional review draft (1 LLM call)
#
# Design principle: deterministic computation always runs first so the LLM
# receives clean, pre-computed numbers rather than raw JSON it must parse itself.
# This gives more accurate and consistent outputs at lower token cost.

from typing import TypedDict, Optional, Any
from langgraph.graph import StateGraph, END

from nodes.review_enricher import review_enricher_node
from nodes.review_scorer import review_scorer_node
from nodes.review_analyzer import review_analyzer_node
from nodes.review_composer import review_composer_node


class ReviewState(TypedDict, total=False):
    # ── Request inputs ────────────────────────────────────────────────────────
    employee: dict           # {id, name, department, designation}
    cycle: dict              # {name, fiscalYear}
    goals: list              # goals with nested checkins list

    # ── Node 1: review_enricher outputs ──────────────────────────────────────
    enriched_checkins: list[dict]
    quarters_present: list[str]
    narrative_texts: dict
    checkin_completion_rate: float
    total_goals: int

    # ── Node 2: review_scorer outputs ─────────────────────────────────────────
    annual_weighted_score: float
    performance_grade: str
    trend: str
    quarter_averages: list
    goal_achievements: list[dict]
    recommended_rating: str

    # ── Node 3: review_analyzer outputs ──────────────────────────────────────
    sentiment_profile: dict
    quarterly_narratives: dict[str, Optional[str]]
    strengths: list[str]
    development_areas: list[str]

    # ── Node 4: review_composer output ───────────────────────────────────────
    draft_review: str


def build_review_graph() -> Any:
    g = StateGraph(ReviewState)

    g.add_node("review_enricher", review_enricher_node)
    g.add_node("review_scorer", review_scorer_node)
    g.add_node("review_analyzer", review_analyzer_node)
    g.add_node("review_composer", review_composer_node)

    g.set_entry_point("review_enricher")
    g.add_edge("review_enricher", "review_scorer")
    g.add_edge("review_scorer", "review_analyzer")
    g.add_edge("review_analyzer", "review_composer")
    g.add_edge("review_composer", END)

    return g.compile()


review_graph = build_review_graph()
