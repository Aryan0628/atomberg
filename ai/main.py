# ai/main.py
# FastAPI entry point for the AtomQuest AI Goal Coach microservice.
# Deployed on Railway (Docker). Called from Next.js via HMAC-signed requests.

import os
from contextlib import asynccontextmanager
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

from golden_goals import load_golden_embeddings
from auth import verify_service_token
from graph import goal_eval_graph
from review_graph import review_graph
from redundancy_graph import redundancy_graph


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("⚡ Loading golden goal embeddings...")
    try:
        load_golden_embeddings()
        print("✅ AI service ready (embeddings loaded)")
    except Exception as e:
        print(f"⚠️  Embeddings unavailable — semantic matching disabled: {e}")
        print("✅ AI service ready (SMART analysis still active)")
    yield


app = FastAPI(
    title="AtomQuest AI Goal Coach",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow calls only from Vercel deployment — adjust origin in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "*").split(","),
    allow_methods=["POST"],
    allow_headers=["*"],
)


class GoalEvalRequest(BaseModel):
    title: str
    description: str = ""
    uom_type: str
    target: Optional[float] = None
    weightage: float = 20.0
    thrust_area: str = ""


class EmployeeInfo(BaseModel):
    id: str
    name: str
    department: str = ""
    designation: str = ""


class CycleInfo(BaseModel):
    name: str
    fiscalYear: str = ""


class CheckinData(BaseModel):
    quarter: str
    actualValue: Optional[float] = None
    scorePercentage: Optional[float] = None
    progressStatus: str = "NOT_STARTED"
    employeeNote: Optional[str] = None
    selfRating: Optional[int] = None
    whatWentWell: Optional[str] = None
    blockers: Optional[str] = None
    managerComment: Optional[str] = None
    managerRating: Optional[int] = None


class GoalWithCheckins(BaseModel):
    id: str
    title: str
    thrustArea: str = ""
    uomType: str = ""
    target: Optional[float] = None
    weightage: float
    checkins: list[CheckinData] = []


class ReviewSynthesisRequest(BaseModel):
    employee: EmployeeInfo
    cycle: CycleInfo
    goals: list[GoalWithCheckins]


class ExistingGoal(BaseModel):
    id: str
    title: str
    description: str = ""
    thrust_area: str = ""
    owner_name: str = ""
    owner_department: str = ""


class NewGoal(BaseModel):
    title: str
    description: str = ""
    thrust_area: str = ""


class RedundancyCheckRequest(BaseModel):
    new_goal: NewGoal
    existing_goals: list[ExistingGoal]


class NLPParseRequest(BaseModel):
    text: str


@app.get("/health")
async def health():
    return {"status": "ok", "service": "atomquest-ai-goal-coach"}


@app.post("/review/synthesize", dependencies=[Depends(verify_service_token)])
async def synthesize_review(payload: ReviewSynthesisRequest, request: Request):
    state = {
        "employee": payload.employee.model_dump(),
        "cycle": payload.cycle.model_dump(),
        "goals": [
            {**g.model_dump(exclude={"checkins"}), "checkins": [c.model_dump() for c in g.checkins]}
            for g in payload.goals
        ],
    }
    result = await review_graph.ainvoke(state)
    return {
        "annual_weighted_score": result.get("annual_weighted_score", 0),
        "performance_grade": result.get("performance_grade", ""),
        "trend": result.get("trend", "no_data"),
        "recommended_rating": result.get("recommended_rating", ""),
        "quarters_present": result.get("quarters_present", []),
        "checkin_completion_rate": result.get("checkin_completion_rate", 0),
        "goal_achievements": result.get("goal_achievements", []),
        "sentiment_profile": result.get("sentiment_profile", {}),
        "quarterly_narratives": result.get("quarterly_narratives", {}),
        "strengths": result.get("strengths", []),
        "development_areas": result.get("development_areas", []),
        "draft_review": result.get("draft_review", ""),
    }


@app.post("/goals/check-redundancy", dependencies=[Depends(verify_service_token)])
async def check_redundancy(payload: RedundancyCheckRequest, request: Request):
    state = {
        "new_goal": payload.new_goal.model_dump(),
        "existing_goals": [g.model_dump() for g in payload.existing_goals],
    }
    result = await redundancy_graph.ainvoke(state)
    return {
        "has_redundancy": result.get("has_redundancy", False),
        "matches": result.get("matches", result.get("raw_matches", [])),
    }


@app.post("/nlp/parse-goal", dependencies=[Depends(verify_service_token)])
async def parse_goal_nlp(payload: NLPParseRequest, request: Request):
    """Extract structured goal fields from a natural language description."""
    import json
    import re
    import httpx

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY not configured")

    prompt = f"""You are an HR goal-setting assistant. Extract structured goal fields from this natural language description.

User input: "{payload.text}"

Return ONLY valid JSON with these fields (no markdown, no explanation):
{{
  "title": "concise goal title (<=80 chars, SMART phrasing)",
  "thrustArea": "one of: Sales Revenue, Customer Experience, Operational Excellence, Safety & Compliance, People Development, Cost Efficiency, Innovation, Digital Transformation, Quality",
  "uomType": "one of: NUMERIC_MIN (higher is better), NUMERIC_MAX (lower is better e.g. cost/TAT/defects), TIMELINE (completion by date), ZERO (zero incidents = success), PERCENTAGE",
  "target": <number or null>,
  "uomUnit": "unit string (e.g. %, hours, L, incidents, features) or null",
  "targetDate": "ISO date string YYYY-MM-DD or null",
  "description": "one sentence clarifying the goal context"
}}

Rules:
- Reducing/cutting/lowering -> NUMERIC_MAX
- Achieving/increasing/growing -> NUMERIC_MIN
- Completing by a date -> TIMELINE
- Zero incidents/accidents/errors -> ZERO
- % target -> PERCENTAGE
- Extract numbers (e.g. "20%" -> 20, "48 hours" -> 48)
- Convert relative dates (Q1=March 31, Q2=June 30, Q3=Sept 30, Q4=Dec 31 of 2026)
- thrustArea must match one of the listed options exactly"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    resp = httpx.post(
        url,
        json={"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.1, "maxOutputTokens": 512}},
        timeout=15.0,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=503, detail=f"Gemini error {resp.status_code}")

    raw = resp.json().get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
    match = re.search(r"\{[\s\S]*\}", raw)
    if not match:
        raise HTTPException(status_code=503, detail="No structured output from AI")
    return json.loads(match.group(0))


@app.post("/evaluate", dependencies=[Depends(verify_service_token)])
async def evaluate_goal(payload: GoalEvalRequest, request: Request):
    state = {
        "title": payload.title,
        "description": payload.description,
        "uom_type": payload.uom_type,
        "target": payload.target,
        "weightage": payload.weightage,
        "thrust_area": payload.thrust_area,
    }

    result = await goal_eval_graph.ainvoke(state)

    return {
        "overall_score": result.get("overall_score", 5),
        "verdict": result.get("verdict", "acceptable"),
        "smart_scores": result.get("smart_scores", {}),
        "suggestions": result.get("suggestions", []),
        "improved_title": result.get("improved_title", payload.title),
        "semantic_match": result.get("semantic_match", {}),
        "brd_issues": result.get("brd_issues", []),
    }
