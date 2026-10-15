"""
Centralized AI client config using OpenRouter exclusively.
All agents import from here.
"""
import asyncio
import json
import re
import logging
import sys
import os
import httpx
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import settings

logger = logging.getLogger("chd.ai_client")

SYSTEM_INSTRUCTION = (
    "You are a clinical AI assistant supporting board-certified cardiologists. "
    "Always respond with medically precise, evidence-based analysis. "
    "Never speculate beyond available data. Always output valid JSON. "
    "Do not include any markdown formatting, code fences, or explanatory text outside the JSON."
)

# Throttler to prevent multiple parallel agents from instantly triggering OpenRouter Free Tier burst limits.
openrouter_semaphore = asyncio.Semaphore(1)

async def generate_structured_response(
    prompt: str,
    schema_description: str,
    use_pro: bool = False,
    image_parts: list = None,
) -> dict:
    """Call OpenRouter API for JSON generation."""
    model_name = settings.openrouter_advanced_model if use_pro else settings.openrouter_primary_model

    full_prompt = (
        f"{prompt}\n\nREQUIRED OUTPUT SCHEMA:\n{schema_description}\n\n"
        "Respond ONLY with a valid JSON object matching the schema above."
        "Do not wrap inside markdown code blocks."
    )

    messages = [
        {"role": "system", "content": SYSTEM_INSTRUCTION},
        {"role": "user", "content": full_prompt}
    ]

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000", 
        "X-Title": "CHD Predictor AI"
    }

    payload = {
        "model": model_name,
        "messages": messages,
        "temperature": settings.openrouter_temperature,
    }

    # Ensure we only send one request at a time with a padding interval
    async with openrouter_semaphore:
        await asyncio.sleep(1.5)

        max_retries = 2
        for attempt in range(max_retries):
            try:
                async with httpx.AsyncClient(timeout=120.0) as client:
                    resp = await client.post("https://openrouter.ai/api/v1/chat/completions", json=payload, headers=headers)
                    
                    # Check for rate limit explicitly to apply backoff
                    if resp.status_code == 429:
                        delay = 2
                        logger.warning(f"OpenRouter 429 Rate Limit hit. Retrying in {delay} seconds (Attempt {attempt + 1}/{max_retries})...")
                        await asyncio.sleep(delay)
                        continue

                    resp.raise_for_status()
                    data = resp.json()
                    
                    if "choices" not in data or len(data["choices"]) == 0:
                        raise ValueError(f"No choices returned from OpenRouter: {data}")
                        
                    text = data["choices"][0]["message"]["content"]
                    
                    try:
                        return json.loads(text)
                    except json.JSONDecodeError:
                        json_match = re.search(r"\{.*\}", text, re.DOTALL)
                        if json_match:
                            return json.loads(json_match.group())
                        raise ValueError(f"OpenRouter returned unparseable JSON")
            except Exception as e:
                logger.warning(f"OpenRouter attempt {attempt + 1} failed: {e}")
                if attempt == max_retries - 1:
                    raise RuntimeError(f"OpenRouter failed after retries: {e}")
                
                # Brief pause for arbitrary network errors before retrying
                await asyncio.sleep(2)

        raise RuntimeError("OpenRouter failed after retries")


# ── Legacy compatibility ────────────────────────────────────────────────────────
def get_flash_model():
    return None

def get_pro_model():
    return None

def get_langchain_flash():
    return None

def get_langchain_pro():
    return None

def get_embeddings():
    return None
