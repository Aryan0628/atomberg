# ai/golden_goals.py
# 20 golden standard SMART goals — one per thrust area, seeded from company best practices.
# Embeddings are computed once at service startup via gemini-embedding-001 and cached in memory.

import os
import numpy as np
import httpx
from typing import Optional

GOLDEN_GOALS: list[str] = [
    # Sales Revenue (3)
    "Achieve 50L quarterly revenue through direct enterprise sales by end of Q1",
    "Acquire 15 new enterprise clients in financial services sector by Q2 close",
    "Increase cross-sell revenue from existing accounts by 25% within fiscal year",
    # Customer Experience (3)
    "Reduce average customer response TAT from 72 hours to 48 hours by Q2",
    "Achieve customer satisfaction CSAT score of 4.5 out of 5 in quarterly survey",
    "Implement real-time order tracking system reducing inbound support calls by 40%",
    # Operational Excellence (3)
    "Achieve 99.5% production uptime through preventive maintenance by year end",
    "Reduce mean time to repair MTTR from 4 hours to 2 hours by Q3",
    "Reduce defect rate from 2% to 0.5% through Six Sigma process by Q4",
    # Safety & Compliance (2)
    "Maintain zero safety incidents across all production floors for entire fiscal year",
    "Complete ISO 27001 certification audit with zero major non-conformities by Q2",
    # People Development (2)
    "Mentor 3 junior team members to independent project ownership by Q3",
    "Achieve 90% team completion rate for mandatory compliance training by Q1 end",
    # Cost Efficiency (2)
    "Reduce operational costs by 12L versus previous quarter budget allocation",
    "Negotiate vendor contracts reducing procurement spend by 15% by Q2",
    # Innovation (2)
    "Deliver 8 new product features with user adoption above 70% by year end",
    "File 2 patent applications for novel product mechanisms by Q3",
    # Digital Transformation (3)
    "Automate 80% of manual reporting processes using internal tools by Q4",
    "Migrate legacy CRM to Salesforce with 100% data integrity by Q2",
    "Achieve 95% adoption of new ERP system across all departments by Q3",
]

# In-memory cache — populated at startup
_embeddings: Optional[np.ndarray] = None


def _embed(texts: list[str]) -> np.ndarray:
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY", "")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set.")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key={api_key}"
    payload = {
        "requests": [
            {"model": "models/gemini-embedding-001", "content": {"parts": [{"text": t}]}}
            for t in texts
        ]
    }
    response = httpx.post(url, json=payload, timeout=60.0)
    response.raise_for_status()
    return np.array([e["values"] for e in response.json()["embeddings"]])


def load_golden_embeddings() -> None:
    global _embeddings
    _embeddings = _embed(GOLDEN_GOALS)


def find_best_match(goal_text: str) -> dict:
    if _embeddings is None:
        return {"title": "", "similarity": 0.0}

    goal_vec = _embed([goal_text])[0]
    # Cosine similarity: dot product of unit vectors
    norms = np.linalg.norm(_embeddings, axis=1) * np.linalg.norm(goal_vec)
    similarities = np.dot(_embeddings, goal_vec) / np.where(norms == 0, 1, norms)
    best_idx = int(np.argmax(similarities))
    return {
        "title": GOLDEN_GOALS[best_idx],
        "similarity": round(float(similarities[best_idx]), 4),
    }
