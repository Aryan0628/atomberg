# ai/auth.py
# Zero-trust HMAC-SHA256 request validation.
# Every request from Next.js must carry a signed token. No IP whitelist — token is the only trust anchor.

import hmac
import hashlib
import time
import os
from fastapi import Request, HTTPException

_SECRET = os.environ.get("AI_SERVICE_SECRET", "")
if not _SECRET:
    raise RuntimeError(
        "AI_SERVICE_SECRET environment variable is not set. "
        "The service cannot start without a signing secret."
    )


async def verify_service_token(request: Request) -> None:
    token = request.headers.get("X-Service-Token")
    timestamp_str = request.headers.get("X-Timestamp")

    if not token or not timestamp_str:
        raise HTTPException(status_code=401, detail="Missing service auth headers")

    try:
        timestamp = int(timestamp_str)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid timestamp")

    # Reject requests older than 30 seconds — prevents replay attacks
    if abs(time.time() - timestamp) > 30:
        raise HTTPException(status_code=401, detail="Request timestamp expired")

    body = await request.body()
    expected = hmac.new(
        _SECRET.encode(),
        f"{timestamp_str}{body.decode('utf-8')}".encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(token, expected):
        raise HTTPException(status_code=401, detail="Invalid service token")
