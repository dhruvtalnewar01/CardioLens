"""Gemini rate limit management with Redis token bucket."""
import time
from typing import Dict

RATE_LIMITS: Dict[str, Dict[str, int]] = {
    "gemini-1.5-flash": {"rpm": 15, "rpd": 1500, "tpd": 1_000_000},
    "gemini-1.5-pro":   {"rpm": 2,  "rpd": 50,   "tpd": 32_000},
}

MODEL_ASSIGNMENT: Dict[str, str] = {
    "biomarker_agent":          "gemini-1.5-flash",
    "imaging_agent_text":       "gemini-1.5-flash",
    "imaging_agent_multimodal": "gemini-1.5-pro",
    "ecg_agent":                "gemini-1.5-flash",
    "history_agent":            "gemini-1.5-flash",
    "risk_synthesis":           "gemini-1.5-pro",
    "intervention_agent":       "gemini-1.5-pro",
    "report_agent":             "gemini-1.5-pro",
}


class InMemoryRateLimiter:
    """Simple in-memory token bucket (use Redis in production)."""

    def __init__(self):
        self._buckets: Dict[str, list] = {}

    async def acquire(self, model: str) -> bool:
        limits = RATE_LIMITS.get(model)
        if not limits:
            return True

        now = time.time()
        key = model
        if key not in self._buckets:
            self._buckets[key] = []

        # Remove timestamps older than 60s
        self._buckets[key] = [t for t in self._buckets[key] if now - t < 60]

        if len(self._buckets[key]) >= limits["rpm"]:
            return False

        self._buckets[key].append(now)
        return True

    def get_wait_time(self, model: str) -> float:
        limits = RATE_LIMITS.get(model)
        if not limits or model not in self._buckets:
            return 0.0

        now = time.time()
        window = [t for t in self._buckets[model] if now - t < 60]
        if len(window) < limits["rpm"]:
            return 0.0

        oldest = min(window)
        return 60.0 - (now - oldest)


rate_limiter = InMemoryRateLimiter()
