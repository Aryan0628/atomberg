#!/usr/bin/env python3
"""
AI Pipeline Benchmarking Script
Tests both pipelines directly (no HTTP overhead) and records wall-clock time.
"""

import time
import json
import sys
import os
import warnings

warnings.filterwarnings("ignore")

# ── Bootstrap env so nodes can reach Gemini ───────────────────────────────────
# Load from env only — never hard-code credentials in source.
# Set GEMINI_API_KEY in your shell or a .env file before running this script.
if not os.environ.get("GEMINI_API_KEY"):
    print(f"\033[31mERROR: GEMINI_API_KEY is not set. Export it before running:\033[0m")
    print(f"  export GEMINI_API_KEY=your_key_here\n")
    sys.exit(1)

# ── Colour helpers ─────────────────────────────────────────────────────────────
GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[31m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

def hr(char="─", width=60): print(char * width)

def fmt(ms: float) -> str:
    return f"{ms/1000:.2f}s" if ms >= 1000 else f"{ms:.0f}ms"

# ══════════════════════════════════════════════════════════════════════════════
# EXAMPLE INPUTS
# ══════════════════════════════════════════════════════════════════════════════

REVIEW_INPUT = {
    "employee": {
        "id": "emp_rahul_001",
        "name": "Rahul Sharma",
        "department": "Sales",
        "designation": "Senior Sales Executive",
    },
    "cycle": {"name": "FY 2026-27", "fiscalYear": "2026-27"},
    "goals": [
        {
            "id": "goal_001",
            "title": "Sales Revenue Achievement",
            "thrustArea": "Sales Revenue",
            "uomType": "NUMERIC_MIN",
            "target": 5000000,       # 50L
            "weightage": 40,
            "checkins": [
                {
                    "quarter": "Q1",
                    "actualValue": 4200000,
                    "progressStatus": "ON_TRACK",
                    "employeeNote": "Strong enterprise pipeline this quarter. Closed 3 major accounts.",
                    "whatWentWell": "New consultative approach resonated with enterprise buyers.",
                    "blockers": "Delayed approvals from procurement added 2 weeks to cycle.",
                    "selfRating": 4,
                    "managerComment": "Solid performance. Pipeline looks promising for Q2.",
                    "managerRating": 4,
                    "scorePercentage": 84.0,
                },
                {
                    "quarter": "Q2",
                    "actualValue": 4800000,
                    "progressStatus": "ON_TRACK",
                    "employeeNote": "Exceeded Q2 target after closing the Bangalore enterprise deal.",
                    "whatWentWell": "Referral from existing client accelerated deal close.",
                    "blockers": "Pricing flexibility was a constraint on mid-market segment.",
                    "selfRating": 5,
                    "managerComment": "Excellent recovery. Keep momentum in H2.",
                    "managerRating": 5,
                    "scorePercentage": 96.0,
                },
                {
                    "quarter": "Q3",
                    "actualValue": 3900000,
                    "progressStatus": "AT_RISK",
                    "employeeNote": "Slower Q3 due to festive season purchasing freeze at clients.",
                    "whatWentWell": "Pipeline for Q4 is strong with 5 proposals submitted.",
                    "blockers": "Customer budget freeze Oct–Nov impacted closures.",
                    "selfRating": 3,
                    "managerComment": "Understood. Focus on converting Q4 pipeline early.",
                    "managerRating": 3,
                    "scorePercentage": 78.0,
                },
            ],
        },
        {
            "id": "goal_002",
            "title": "Customer TAT Reduction",
            "thrustArea": "Customer Experience",
            "uomType": "NUMERIC_MAX",
            "target": 48,            # hours
            "weightage": 30,
            "checkins": [
                {
                    "quarter": "Q1",
                    "actualValue": 52,
                    "progressStatus": "AT_RISK",
                    "employeeNote": "Response times were above target due to team bandwidth.",
                    "whatWentWell": "Implemented a triage system that improved P1 response.",
                    "blockers": "Understaffed support team in Q1.",
                    "selfRating": 3,
                    "managerComment": "Work on the SLA breaches systematically.",
                    "managerRating": 3,
                    "scorePercentage": 92.3,
                },
                {
                    "quarter": "Q2",
                    "actualValue": 44,
                    "progressStatus": "ON_TRACK",
                    "employeeNote": "TAT improved significantly after new ticket routing.",
                    "whatWentWell": "Automated routing cut manual triage from 2h to 15min.",
                    "blockers": None,
                    "selfRating": 4,
                    "managerComment": "Great improvement. This is the right direction.",
                    "managerRating": 4,
                    "scorePercentage": 109.0,
                },
            ],
        },
        {
            "id": "goal_003",
            "title": "Zero Safety Incidents",
            "thrustArea": "Safety & Compliance",
            "uomType": "ZERO",
            "target": 0,
            "weightage": 20,
            "checkins": [
                {
                    "quarter": "Q1",
                    "actualValue": 0,
                    "progressStatus": "COMPLETED",
                    "employeeNote": "All safety protocols followed. Monthly audits passed.",
                    "whatWentWell": "Team safety training completed with 100% participation.",
                    "blockers": None,
                    "selfRating": 5,
                    "managerComment": "Excellent discipline. Keep it up.",
                    "managerRating": 5,
                    "scorePercentage": 100.0,
                },
                {
                    "quarter": "Q2",
                    "actualValue": 0,
                    "progressStatus": "COMPLETED",
                    "employeeNote": "Another clean quarter. Participated in BBS audit.",
                    "whatWentWell": "Proactive near-miss reporting increased by 40%.",
                    "blockers": None,
                    "selfRating": 5,
                    "managerComment": "Perfect safety record. Benchmark for the team.",
                    "managerRating": 5,
                    "scorePercentage": 100.0,
                },
            ],
        },
        {
            "id": "goal_004",
            "title": "Training Completion",
            "thrustArea": "People Development",
            "uomType": "TIMELINE",
            "target": None,
            "weightage": 10,
            "checkins": [
                {
                    "quarter": "Q2",
                    "actualValue": None,
                    "progressStatus": "COMPLETED",
                    "employeeNote": "Completed Sandler Sales Training 5 days ahead of schedule.",
                    "whatWentWell": "Training directly applicable — closed a deal using new framework.",
                    "blockers": None,
                    "selfRating": 5,
                    "managerComment": "Great initiative and early completion.",
                    "managerRating": 5,
                    "scorePercentage": 100.0,
                }
            ],
        },
    ],
}

REDUNDANCY_INPUTS = [
    {
        "label": "HIGH similarity (near-duplicate)",
        "new_goal": {
            "title": "Achieve quarterly sales revenue of 50 lakhs from enterprise accounts",
            "description": "Close enterprise deals to achieve 50L quarterly revenue target",
            "thrust_area": "Sales Revenue",
        },
        "existing_goals": [
            {
                "id": "eg_001",
                "title": "Quarterly Revenue Achievement — 50L target",
                "description": "Drive enterprise sales to hit 50 lakh quarterly revenue",
                "thrust_area": "Sales Revenue",
                "owner_name": "Priya Mehta",
                "owner_department": "Sales",
            },
            {
                "id": "eg_002",
                "title": "Improve customer satisfaction score to 4.5",
                "description": "Increase CSAT from 4.1 to 4.5 through service improvements",
                "thrust_area": "Customer Experience",
                "owner_name": "Deepa Nair",
                "owner_department": "Operations",
            },
            {
                "id": "eg_003",
                "title": "Reduce production defects to zero",
                "description": "Eliminate defects in production line through quality controls",
                "thrust_area": "Operational Excellence",
                "owner_name": "Arjun Patel",
                "owner_department": "Operations",
            },
        ],
    },
    {
        "label": "LOW similarity (no match expected)",
        "new_goal": {
            "title": "Launch digital onboarding portal for new employees",
            "description": "Build a self-service onboarding experience reducing HR overhead by 30%",
            "thrust_area": "Digital Transformation",
        },
        "existing_goals": [
            {
                "id": "eg_004",
                "title": "Increase direct sales revenue from enterprise segment",
                "description": "Close mid-market and enterprise deals to grow top line",
                "thrust_area": "Sales Revenue",
                "owner_name": "Vikram Singh",
                "owner_department": "Sales",
            },
            {
                "id": "eg_005",
                "title": "Zero workplace safety incidents in FY26",
                "description": "Maintain ISO 45001 compliance and zero LTI record",
                "thrust_area": "Safety & Compliance",
                "owner_name": "Sneha Roy",
                "owner_department": "Engineering",
            },
        ],
    },
]


# ══════════════════════════════════════════════════════════════════════════════
# PIPELINE TESTS
# ══════════════════════════════════════════════════════════════════════════════

def test_review_pipeline():
    hr("═")
    print(f"{BOLD}{CYAN}  PIPELINE 1 — Annual Review Synthesis (LangGraph 4-node){RESET}")
    hr("═")
    print(f"  Employee : {REVIEW_INPUT['employee']['name']} ({REVIEW_INPUT['employee']['department']})")
    print(f"  Cycle    : {REVIEW_INPUT['cycle']['name']}")
    print(f"  Goals    : {len(REVIEW_INPUT['goals'])} goals | "
          f"{sum(len(g['checkins']) for g in REVIEW_INPUT['goals'])} check-ins")
    print()

    # Node-level timings
    node_times: dict[str, float] = {}

    # ── Patch nodes to record time ─────────────────────────────────────────────
    from nodes import review_enricher, review_scorer, review_analyzer, review_composer

    orig_enricher  = review_enricher.review_enricher_node
    orig_scorer    = review_scorer.review_scorer_node
    orig_analyzer  = review_analyzer.review_analyzer_node
    orig_composer  = review_composer.review_composer_node

    def timed(name, fn):
        def wrapper(state):
            t0 = time.perf_counter()
            result = fn(state)
            node_times[name] = (time.perf_counter() - t0) * 1000
            return result
        return wrapper

    review_enricher.review_enricher_node  = timed("1. review_enricher  (pure Python)", orig_enricher)
    review_scorer.review_scorer_node      = timed("2. review_scorer     (pure Python)", orig_scorer)
    review_analyzer.review_analyzer_node  = timed("3. review_analyzer   (Gemini Flash)", orig_analyzer)
    review_composer.review_composer_node  = timed("4. review_composer   (Gemini Flash)", orig_composer)

    # Rebuild graph with patched nodes
    from langgraph.graph import StateGraph, END
    g = StateGraph(dict)
    g.add_node("review_enricher",  review_enricher.review_enricher_node)
    g.add_node("review_scorer",    review_scorer.review_scorer_node)
    g.add_node("review_analyzer",  review_analyzer.review_analyzer_node)
    g.add_node("review_composer",  review_composer.review_composer_node)
    g.set_entry_point("review_enricher")
    g.add_edge("review_enricher", "review_scorer")
    g.add_edge("review_scorer",   "review_analyzer")
    g.add_edge("review_analyzer", "review_composer")
    g.add_edge("review_composer", END)
    graph = g.compile()

    t_start = time.perf_counter()
    try:
        result = graph.invoke(REVIEW_INPUT)
        total_ms = (time.perf_counter() - t_start) * 1000

        # ── Node timings table ─────────────────────────────────────────────────
        print(f"  {'Node':<42} {'Time':>8}  {'Bar'}")
        hr()
        max_ms = max(node_times.values()) if node_times else 1
        for node, ms in node_times.items():
            bar_len = int((ms / max_ms) * 30)
            bar = "█" * bar_len
            colour = GREEN if ms < 500 else YELLOW if ms < 2000 else RED
            print(f"  {node:<42} {colour}{fmt(ms):>8}{RESET}  {colour}{bar}{RESET}")
        hr()
        print(f"  {'TOTAL WALL TIME':<42} {BOLD}{fmt(total_ms):>8}{RESET}")
        print()

        # ── Key outputs ────────────────────────────────────────────────────────
        score = result.get("annual_weighted_score", 0)
        grade = result.get("performance_grade", "?")
        trend = result.get("trend", "?")
        rating = result.get("recommended_rating", "?")
        quarters = result.get("quarters_present", [])
        completion = result.get("checkin_completion_rate", 0)

        score_colour = GREEN if score >= 80 else YELLOW if score >= 60 else RED
        print(f"  {BOLD}Results:{RESET}")
        print(f"  Annual Score       : {score_colour}{BOLD}{score:.1f}%{RESET}  Grade: {BOLD}{grade}{RESET}")
        print(f"  Trend              : {trend}")
        print(f"  Recommended Rating : {rating}")
        print(f"  Quarters present   : {', '.join(quarters)} ({len(quarters)}/4)")
        print(f"  Check-in completion: {completion*100:.0f}%")

        strengths = result.get("strengths", [])
        dev_areas = result.get("development_areas", [])
        if strengths:
            print(f"\n  {GREEN}Strengths ({len(strengths)}):{RESET}")
            for s in strengths[:3]:
                print(f"    • {s}")
        if dev_areas:
            print(f"\n  {YELLOW}Development Areas ({len(dev_areas)}):{RESET}")
            for d in dev_areas[:2]:
                print(f"    • {d}")

        draft = result.get("draft_review", "")
        if draft:
            preview = draft[:280].replace("\n", " ")
            print(f"\n  {CYAN}Draft Review Preview:{RESET}")
            print(f"  \"{preview}…\"")

        goal_achs = result.get("goal_achievements", [])
        if goal_achs:
            print(f"\n  Goal Performance:")
            for g in goal_achs:
                bar_len = int(g["avg_score"] / 100 * 20)
                colour = GREEN if g["avg_score"] >= 80 else YELLOW if g["avg_score"] >= 60 else RED
                print(f"    {g['title'][:30]:<30} {colour}{'█'*bar_len}{'░'*(20-bar_len)} {g['avg_score']:.1f}%{RESET}  w={g['weightage']}%")

        print(f"\n  {GREEN}✓ Review pipeline PASSED{RESET}")
        return True, total_ms

    except Exception as e:
        total_ms = (time.perf_counter() - t_start) * 1000
        print(f"  {RED}✗ FAILED after {fmt(total_ms)}: {e}{RESET}")
        import traceback; traceback.print_exc()
        return False, total_ms
    finally:
        # Restore original nodes
        review_enricher.review_enricher_node  = orig_enricher
        review_scorer.review_scorer_node      = orig_scorer
        review_analyzer.review_analyzer_node  = orig_analyzer
        review_composer.review_composer_node  = orig_composer


def test_redundancy_pipeline():
    hr("═")
    print(f"{BOLD}{CYAN}  PIPELINE 2 — Semantic Goal Redundancy Detection (LangGraph 3-node){RESET}")
    hr("═")

    from redundancy_graph import build_redundancy_graph
    from nodes import redundancy_embedder, redundancy_ranker, redundancy_recommender

    all_passed = True
    timings = []

    for idx, case in enumerate(REDUNDANCY_INPUTS):
        print(f"\n  [{idx+1}/{len(REDUNDANCY_INPUTS)}] {BOLD}{case['label']}{RESET}")
        print(f"  New goal  : \"{case['new_goal']['title']}\"")
        print(f"  Compare vs: {len(case['existing_goals'])} existing goals")

        node_times: dict[str, float] = {}

        orig_embedder    = redundancy_embedder.redundancy_embedder_node
        orig_ranker      = redundancy_ranker.redundancy_ranker_node
        orig_recommender = redundancy_recommender.redundancy_recommender_node

        def timed(name, fn):
            def wrapper(state):
                t0 = time.perf_counter()
                result = fn(state)
                node_times[name] = (time.perf_counter() - t0) * 1000
                return result
            return wrapper

        redundancy_embedder.redundancy_embedder_node     = timed("1. redundancy_embedder  (Gemini Embed)", orig_embedder)
        redundancy_ranker.redundancy_ranker_node         = timed("2. redundancy_ranker    (cosine/NumPy)", orig_ranker)
        redundancy_recommender.redundancy_recommender_node = timed("3. redundancy_recommender (Gemini Flash)", orig_recommender)

        from langgraph.graph import StateGraph, END as GEND

        def _should_recommend(state):
            return "redundancy_recommender" if state.get("has_redundancy") else GEND

        g = StateGraph(dict)
        g.add_node("redundancy_embedder",    redundancy_embedder.redundancy_embedder_node)
        g.add_node("redundancy_ranker",      redundancy_ranker.redundancy_ranker_node)
        g.add_node("redundancy_recommender", redundancy_recommender.redundancy_recommender_node)
        g.set_entry_point("redundancy_embedder")
        g.add_edge("redundancy_embedder", "redundancy_ranker")
        g.add_conditional_edges("redundancy_ranker", _should_recommend,
                                {"redundancy_recommender": "redundancy_recommender", GEND: GEND})
        g.add_edge("redundancy_recommender", GEND)
        graph = g.compile()

        t_start = time.perf_counter()
        try:
            result = graph.invoke({
                "new_goal": case["new_goal"],
                "existing_goals": case["existing_goals"],
            })
            total_ms = (time.perf_counter() - t_start) * 1000
            timings.append(total_ms)

            print()
            max_ms = max(node_times.values()) if node_times else 1
            for node, ms in node_times.items():
                bar_len = int((ms / max_ms) * 24)
                bar = "█" * bar_len
                colour = GREEN if ms < 500 else YELLOW if ms < 2000 else RED
                ran = "  (skipped)" if node not in node_times else ""
                print(f"    {node:<44} {colour}{fmt(ms):>8}{RESET}  {colour}{bar}{ran}{RESET}")

            has_red = result.get("has_redundancy", False)
            matches = result.get("matches", []) or result.get("raw_matches", [])

            recommender_ran = "redundancy_recommender" in node_times
            skip_note = f"  {CYAN}(recommender skipped — no match, 0 extra LLM calls){RESET}" if not recommender_ran else ""

            hr()
            print(f"    {'TOTAL':44} {BOLD}{fmt(total_ms):>8}{RESET}{skip_note}")
            print()

            if has_red and matches:
                print(f"    {RED}Redundancy detected — {len(matches)} match(es):{RESET}")
                for m in matches:
                    lvl_colour = RED if m.get("match_level") == "near_duplicate" else YELLOW
                    print(f"      • {lvl_colour}{m.get('match_level','?').upper():20}{RESET} "
                          f"{m.get('similarity',0)*100:.1f}%  \"{m.get('goal_title','')[:50]}\"")
                    if m.get("recommendation"):
                        print(f"        → {m['recommendation'][:100]}")
                print(f"    {GREEN}✓ Redundancy pipeline PASSED{RESET}")
            else:
                print(f"    {GREEN}No redundancy found — clean goal{RESET}")
                print(f"    {GREEN}✓ Redundancy pipeline PASSED{RESET}")

        except Exception as e:
            total_ms = (time.perf_counter() - t_start) * 1000
            timings.append(total_ms)
            print(f"    {RED}✗ FAILED after {fmt(total_ms)}: {e}{RESET}")
            import traceback; traceback.print_exc()
            all_passed = False
        finally:
            redundancy_embedder.redundancy_embedder_node     = orig_embedder
            redundancy_ranker.redundancy_ranker_node         = orig_ranker
            redundancy_recommender.redundancy_recommender_node = orig_recommender

    avg = sum(timings) / len(timings) if timings else 0
    return all_passed, avg, timings


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print()
    print(f"{BOLD}  AtomQuest AI Pipeline Benchmark{RESET}")
    print(f"  Model: gemini-flash-latest + gemini-embedding-001")
    print()

    # Change into ai/ dir so relative imports work
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, ".")

    overall_start = time.perf_counter()

    r_ok, r_time = test_review_pipeline()
    print()

    red_ok, red_avg, red_times = test_redundancy_pipeline()

    overall_ms = (time.perf_counter() - overall_start) * 1000

    # ── Summary ────────────────────────────────────────────────────────────────
    print()
    hr("═")
    print(f"{BOLD}{CYAN}  BENCHMARK SUMMARY{RESET}")
    hr("═")
    r_colour   = GREEN if r_ok   else RED
    red_colour = GREEN if red_ok else RED
    print(f"  Annual Review Synthesis   : {r_colour}{'PASS' if r_ok else 'FAIL'}{RESET}  {fmt(r_time)}")
    for i, t in enumerate(red_times):
        case_label = REDUNDANCY_INPUTS[i]["label"]
        print(f"  Redundancy ({case_label[:20]:<20}): {red_colour}{'PASS' if red_ok else 'FAIL'}{RESET}  {fmt(t)}")
    hr()
    print(f"  Total test suite wall time: {BOLD}{fmt(overall_ms)}{RESET}")
    print()
