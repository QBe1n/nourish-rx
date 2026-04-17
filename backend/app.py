"""NourishRx FastAPI backend.

Endpoints:
  POST /api/plan   → generate a full condition-aware meal plan (Claude text)
  POST /api/image  → generate a food-photography image for one recipe (Nano Banana)

Also serves the built Vite client from ../dist/public in production mode.
"""

from __future__ import annotations

import base64
import io
import json
import os
import re
from pathlib import Path
from typing import Any, Literal, Optional

from PIL import Image
from anthropic import Anthropic
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from generate_image import generate_image

# ─────────────────────────────────────────────────────────────────────────────
# System prompt + schema hint for meal plan generation
# ─────────────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are NourishRx, a board-certified clinical nutritionist and registered dietitian.
Given a user's health condition or concern, you produce an evidence-informed single-day meal plan with full recipes.

CRITICAL RULES:
1. Always follow current nutritional guidelines (e.g. DASH for hypertension, Mediterranean for cardiovascular, low-FODMAP for IBS, low-GI for diabetes, renal diet for CKD, gluten-free for celiac).
2. Tailor sodium, sugar, fiber, protein, potassium, and fat content to the specific condition.
3. Respect stated diet preferences and allergies strictly. Never include an allergen.
4. Provide realistic home recipes with common ingredients. Include accurate calorie and macro estimates.
5. Never claim to cure or treat disease. Include a clear disclaimer to consult a healthcare provider.
6. If the condition is unsafe for self-management (e.g. severe eating disorders, acute pancreatitis, dialysis without dietitian supervision), still provide general guidance but emphasize professional care in the disclaimer.
7. Return ONLY valid JSON that matches the provided schema. No markdown, no code fences, no commentary."""

JSON_SCHEMA_HINT = """{
  "condition": "string — echo the user's condition in clean form",
  "summary": "2-3 sentence overview of the dietary approach",
  "dietaryPrinciples": ["array of 4-6 key rules, one sentence each"],
  "foodsToEmphasize": ["array of 6-10 specific foods"],
  "foodsToLimit": ["array of 4-8 specific foods"],
  "breakfast": { recipe },
  "lunch": { recipe },
  "dinner": { recipe },
  "snack": { recipe } (optional, include if helpful),
  "hydrationTip": "one sentence about fluid intake tailored to condition",
  "disclaimer": "medical disclaimer sentence"
}

Each recipe object MUST have:
{
  "name": "string",
  "description": "one-sentence appetizing description",
  "prepTime": "e.g. '10 min'",
  "cookTime": "e.g. '20 min'",
  "servings": number,
  "calories": number (per serving),
  "macros": { "protein": "28g", "carbs": "35g", "fat": "12g", "fiber": "8g" },
  "ingredients": ["array of strings with quantities, e.g. '1 cup rolled oats'"],
  "instructions": ["array of step-by-step instructions, 4-8 steps"],
  "healthNotes": "1-2 sentences explaining why this meal supports the condition"
}"""


# ─────────────────────────────────────────────────────────────────────────────
# Request / response models
# ─────────────────────────────────────────────────────────────────────────────


DietPreference = Literal[
    "none", "vegetarian", "vegan", "pescatarian", "halal", "kosher"
]


class PlanRequest(BaseModel):
    condition: str = Field(..., min_length=2, max_length=500)
    dietPreference: DietPreference = "none"
    allergies: str = Field(default="", max_length=300)


class ImageRequest(BaseModel):
    recipeName: str = Field(..., min_length=2, max_length=200)
    description: str = Field(default="", max_length=500)
    meal: Literal["breakfast", "lunch", "dinner", "snack"] = "lunch"


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


def build_user_prompt(condition: str, diet: str, allergies: str) -> str:
    parts = [f"Health condition / concern: {condition}"]
    if diet and diet != "none":
        parts.append(f"Diet preference: {diet}")
    if allergies and allergies.strip():
        parts.append(f"Allergies / foods to avoid: {allergies}")
    parts.append("")
    parts.append(
        "Generate a complete one-day meal plan (breakfast, lunch, dinner, plus an optional snack) "
        "with full recipes. Return ONLY the JSON object below — no prose, no markdown fences."
    )
    parts.append("")
    parts.append("SCHEMA:")
    parts.append(JSON_SCHEMA_HINT)
    return "\n".join(parts)


def extract_json(text: str) -> str:
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        return fence.group(1).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start : end + 1]
    return text.strip()


def build_image_prompt(recipe_name: str, description: str, meal: str) -> str:
    """Craft a food-photography prompt that matches the app's warm editorial feel."""
    # Meal-specific lighting/setting
    setting = {
        "breakfast": "morning light, wooden surface, linen napkin, editorial cookbook styling",
        "lunch": "bright natural daylight, rustic ceramic plate, linen tablecloth, editorial cookbook styling",
        "dinner": "warm golden-hour light, matte ceramic plate, dark wood table, editorial cookbook styling",
        "snack": "soft overhead daylight, simple ceramic plate, warm cream linen, editorial cookbook styling",
    }.get(meal, "natural light, ceramic plate, editorial cookbook styling")

    desc_clean = (description or "").strip().rstrip(".")

    return (
        f"Overhead 3/4 angle food photograph of {recipe_name}"
        + (f" — {desc_clean}" if desc_clean else "")
        + f". {setting}. Shallow depth of field, appetizing, "
        "beautifully plated, real food, photorealistic, high detail, no text, no labels, no logos, no people."
    )


# ─────────────────────────────────────────────────────────────────────────────
# App
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(title="NourishRx API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

anthropic_client = Anthropic()

STATIC_DIR = Path(__file__).resolve().parent.parent / "dist" / "public"


@app.post("/api/plan")
async def generate_plan(req: PlanRequest) -> JSONResponse:
    user_prompt = build_user_prompt(
        req.condition, req.dietPreference, req.allergies
    )

    try:
        message = anthropic_client.messages.create(
            model="claude_sonnet_4_6",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
    except Exception as exc:
        print(f"[plan] LLM call failed: {exc}")
        raise HTTPException(
            status_code=500, detail=f"Failed to generate meal plan: {exc}"
        )

    # Extract first text block
    text_block: Optional[str] = None
    for block in message.content:
        if getattr(block, "type", None) == "text":
            text_block = block.text
            break
    if not text_block:
        raise HTTPException(status_code=502, detail="Empty response from model")

    json_str = extract_json(text_block)
    try:
        plan: dict[str, Any] = json.loads(json_str)
    except json.JSONDecodeError as exc:
        print(f"[plan] JSON parse failed: {exc}")
        print(f"[plan] Raw (first 1200): {text_block[:1200]}")
        raise HTTPException(
            status_code=502, detail="Model returned invalid plan format"
        )

    # Light shape sanity-check
    required_keys = {
        "condition",
        "summary",
        "dietaryPrinciples",
        "foodsToEmphasize",
        "foodsToLimit",
        "breakfast",
        "lunch",
        "dinner",
        "hydrationTip",
        "disclaimer",
    }
    missing = required_keys - plan.keys()
    if missing:
        raise HTTPException(
            status_code=502,
            detail=f"Model response missing required keys: {sorted(missing)}",
        )

    return JSONResponse(plan)


def compress_image(png_bytes: bytes, max_width: int = 1200, quality: int = 82) -> bytes:
    """Downscale and re-encode as JPEG to keep payload small."""
    img = Image.open(io.BytesIO(png_bytes))
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGB")
    if img.width > max_width:
        new_h = round(img.height * max_width / img.width)
        img = img.resize((max_width, new_h), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality, optimize=True, progressive=True)
    return buf.getvalue()


@app.post("/api/image")
async def generate_recipe_image(req: ImageRequest) -> JSONResponse:
    prompt = build_image_prompt(req.recipeName, req.description, req.meal)
    print(f"[image] START {req.meal}: {req.recipeName}")
    try:
        raw = await generate_image(prompt, aspect_ratio="4:3")
        compressed = compress_image(raw)
        print(
            f"[image] DONE  {req.meal}: {len(raw)//1024} KB raw → {len(compressed)//1024} KB jpeg"
        )
    except Exception as exc:
        print(f"[image] Generation failed: {exc}")
        raise HTTPException(
            status_code=502, detail=f"Failed to generate image: {exc}"
        )

    b64 = base64.b64encode(compressed).decode()
    return JSONResponse({"image": f"data:image/jpeg;base64,{b64}"})


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


# ─────────────────────────────────────────────────────────────────────────────
# Static serving — in production the built client lives at ../dist/public
# ─────────────────────────────────────────────────────────────────────────────

if STATIC_DIR.exists():
    # Mount /assets directly
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.exists():
        app.mount(
            "/assets",
            StaticFiles(directory=str(assets_dir)),
            name="assets",
        )

    @app.get("/favicon.svg")
    async def favicon() -> FileResponse:
        fav = STATIC_DIR / "favicon.svg"
        if fav.exists():
            return FileResponse(str(fav), media_type="image/svg+xml")
        raise HTTPException(status_code=404)

    @app.get("/")
    async def index() -> FileResponse:
        return FileResponse(str(STATIC_DIR / "index.html"))

    # SPA fallback — any unmatched GET returns index.html
    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str) -> FileResponse:
        # Avoid intercepting /api/* (those are defined above and will match first)
        return FileResponse(str(STATIC_DIR / "index.html"))


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "5000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
