# ai/nodes/redundancy_embedder.py
# Node 1 of the Semantic Redundancy Detection pipeline.
#
# Responsibility: batch-embed the new goal AND all existing cycle goals in a
# single Gemini batchEmbedContents API call. One HTTP request regardless of
# how many existing goals there are — minimal latency, minimal API cost.
#
# Uses gemini-embedding-001 (same model as golden_goals.py for consistency).

import os
import numpy as np
import httpx
from typing import Any

_EMBED_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-embedding-001:batchEmbedContents"
)
_MODEL_NAME = "models/gemini-embedding-001"


def _goal_to_text(title: str, description: str = "", thrust_area: str = "") -> str:
    """Concatenate goal fields into a single embedding-ready string."""
    parts = [title]
    if description:
        parts.append(description)
    if thrust_area:
        parts.append(thrust_area)
    return " | ".join(parts)


def _batch_embed(texts: list[str], api_key: str) -> np.ndarray:
    payload = {
        "requests": [
            {"model": _MODEL_NAME, "content": {"parts": [{"text": t}]}}
            for t in texts
        ]
    }
    resp = httpx.post(f"{_EMBED_URL}?key={api_key}", json=payload, timeout=60.0)
    resp.raise_for_status()
    return np.array([e["values"] for e in resp.json()["embeddings"]], dtype=np.float32)


def redundancy_embedder_node(state: dict[str, Any]) -> dict[str, Any]:
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY", "")

    new_goal: dict = state.get("new_goal", {})
    existing_goals: list[dict] = state.get("existing_goals", [])

    # Graceful short-circuit: nothing to compare against
    if not existing_goals or not api_key:
        return {
            **state,
            "new_goal_embedding": [],
            "existing_embeddings": [],
            "embedding_error": not api_key,
        }

    new_text = _goal_to_text(
        new_goal.get("title", ""),
        new_goal.get("description", ""),
        new_goal.get("thrust_area", ""),
    )
    existing_texts = [
        _goal_to_text(g.get("title", ""), g.get("description", ""), g.get("thrust_area", ""))
        for g in existing_goals
    ]

    # One batch call: new goal first, then all existing goals
    all_texts = [new_text] + existing_texts

    try:
        embeddings = _batch_embed(all_texts, api_key)
        new_emb = embeddings[0].tolist()
        existing_embs = embeddings[1:].tolist()
    except Exception:
        new_emb = []
        existing_embs = []

    return {
        **state,
        "new_goal_embedding": new_emb,
        "existing_embeddings": existing_embs,
        "embedding_error": False,
    }
