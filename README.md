# NourishRx 🌿

> Personalized, evidence-informed meal plans generated from a user's health condition — now with AI-generated cookbook-style food photography for every recipe.

NourishRx takes any disease, diagnosis, or dietary concern written in plain language and produces a **complete one-day meal plan** — breakfast, lunch, dinner, and an optional snack — with full recipes, macros, clinical rationale, and a photorealistic image of each dish.

Built for type 2 diabetes, hypertension, IBS, PCOS, high cholesterol, fatty liver, CKD, gout, celiac, and anything else a user might type.

![NourishRx breakfast card](./docs/screenshot-breakfast.png)

---

## ✨ Features

- **Condition-aware meal plans** — automatically applies the right framework (DASH for hypertension, low‑GI for diabetes, low‑FODMAP for IBS, Mediterranean for cardiovascular, renal diet for CKD, etc.)
- **AI-generated recipe photos** — every meal gets a photorealistic, overhead cookbook-style shot rendered with Nano Banana (Google's image model via the internal LLM API). Matched lighting/setting per meal (morning light for breakfast, golden-hour for dinner, etc.). Compressed server-side to ~150–250 KB JPEG.
- **Full recipes** — ingredients, step-by-step method, prep/cook time, servings, calories, macros (protein / carbs / fat / fiber)
- **"Why it works"** — each recipe includes a clinical rationale explaining how it supports the condition
- **Dietary principles + foods to emphasize/limit** — a full editorial-style overview of the day
- **Diet preferences** — vegetarian, vegan, pescatarian, halal, kosher
- **Allergy-safe** — strict avoidance of user-listed allergens
- **Hydration guidance** tuned to the condition
- **Medical disclaimer** on every plan
- **Parallel image loading** — the plan renders immediately; images stream in per-meal with a skeleton loader
- **Light + dark mode**, fully responsive, warm editorial cookbook palette (terracotta + forest on cream)

---

## 🧱 Tech Stack

| Layer           | Choice                                                                    |
| --------------- | ------------------------------------------------------------------------- |
| Frontend        | **React 18 + Vite + TypeScript**, Tailwind CSS v3, shadcn/ui, wouter      |
| Data/Forms      | TanStack Query v5, React Hook Form, Zod                                   |
| Backend         | **Python + FastAPI + Uvicorn** on port 5000                               |
| Text AI         | **Anthropic Claude** (Sonnet 4.6) via the `anthropic` Python SDK          |
| Image AI        | **Nano Banana** via `pplx-python-sdks-llm-api`, compressed with **Pillow**|
| Validation      | Zod (client) + Pydantic (server)                                          |
| Build           | `npm run build` produces `dist/public/` (static client), served by FastAPI|

The frontend is intentionally thin: the Python server's job is to proxy to the LLM, validate responses, compress images, and serve the built client.

---

## 📁 Project Structure

```
nourish-rx/
├── backend/                    # ⭐ Python FastAPI server
│   ├── app.py                  #   /api/plan, /api/image, static serving
│   ├── generate_image.py       #   LLM API helper (copied from skills/)
│   └── requirements.txt        #   Python deps
├── client/                     # Vite + React frontend
│   ├── index.html
│   ├── public/favicon.svg
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── index.css           # Design tokens (HSL palette, light/dark)
│       ├── components/
│       │   ├── logo.tsx
│       │   ├── theme-toggle.tsx
│       │   └── ui/             # shadcn/ui primitives
│       ├── hooks/
│       ├── lib/queryClient.ts
│       └── pages/
│           ├── home.tsx        # Form + plan rendering + image streaming
│           └── not-found.tsx
├── shared/
│   └── schema.ts               # Shared Zod types (also defined in Pydantic)
├── server/                     # (legacy Node Express, no longer used)
├── script/build.ts             # Client production build
├── docs/                       # README screenshots
├── components.json             # shadcn config
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
├── vite.config.ts
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js 20+** (for the frontend build)
- **npm 10+**
- **Python 3.11+**
- An **Anthropic API key** — [console.anthropic.com](https://console.anthropic.com/)
- An image-generation backend. **Nano Banana is accessed through Perplexity's internal `pplx-python-sdks-llm-api`, which is not publicly available.** To run outside the Perplexity sandbox, see [Adapting the Image Backend](#adapting-the-image-backend) below.

### 1. Install

```bash
git clone https://github.com/QBe1n/nourish-rx.git
cd nourish-rx

# Frontend dependencies
npm install

# Backend dependencies
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx
PORT=5000
```

### 3. Build the frontend

```bash
npm run build
```

This produces `dist/public/` — the FastAPI server serves those static files at the root path.

### 4. Run the backend

```bash
source .venv/bin/activate
python backend/app.py
```

Open http://localhost:5000. The Python server serves both the UI and the `/api/*` endpoints.

### Development loop

When iterating on the frontend, the current setup requires a rebuild after each change (`npm run build`) because the Python server serves the pre-built bundle. If you want hot-reload for the frontend, run Vite's dev server on a separate port and point `apiRequest` at `http://localhost:5000` via a Vite proxy — or keep the legacy Node-based dev loop in `server/` (unchanged from the original webapp template) and only switch to Python for image generation.

---

## 🧪 Using the App

1. Visit the homepage
2. In **"Health condition or concern"**, type anything:
   - `Type 2 diabetes`
   - `High blood pressure with borderline high cholesterol`
   - `IBS with lactose intolerance`
   - `Stage 3 chronic kidney disease, not on dialysis`
   - `PCOS and insulin resistance`
   - `Iron-deficiency anemia, vegetarian`
3. (Optional) Select a **diet preference** and list **allergies**
4. Click **Generate my meal plan**
5. Wait ~10–20 seconds for the text plan, then watch each recipe photo stream in over ~30s (all 3–4 requests run in parallel)
6. Click **Start a new plan** to reset

**Expected timing:**
- Text plan: ~15s
- Each image: ~25–40s (parallel, so total clock time ≈ slowest image)
- End-to-end: ~45–60s

---

## 🔌 API Reference

### `POST /api/plan`

Generate a full meal plan.

**Request body:**

```json
{
  "condition": "Type 2 diabetes with hypertension",
  "dietPreference": "none | vegetarian | vegan | pescatarian | halal | kosher",
  "allergies": "peanuts, shellfish"
}
```

Only `condition` is required (2–500 chars). `dietPreference` defaults to `"none"`, `allergies` to `""`.

**Response:** a validated `MealPlan` object (see [`shared/schema.ts`](./shared/schema.ts)).

```ts
type MealPlan = {
  condition: string;
  summary: string;
  dietaryPrinciples: string[];
  foodsToEmphasize: string[];
  foodsToLimit: string[];
  breakfast: Recipe;
  lunch: Recipe;
  dinner: Recipe;
  snack?: Recipe;
  hydrationTip: string;
  disclaimer: string;
};

type Recipe = {
  name: string;
  description: string;
  prepTime: string;
  cookTime: string;
  servings: number;
  calories: number;
  macros: { protein: string; carbs: string; fat: string; fiber: string };
  ingredients: string[];
  instructions: string[];
  healthNotes: string;
  imageUrl?: string;    // filled in client-side after /api/image calls
};
```

### `POST /api/image`

Generate a food-photography image for one recipe.

**Request body:**

```json
{
  "recipeName": "Lemon-Ginger Chicken Rice Bowl",
  "description": "Tender sliced chicken breast over jasmine rice with zucchini and carrots",
  "meal": "lunch"
}
```

**Response:**

```json
{ "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAS..." }
```

The server prompts the image model with a meal-specific setting (morning light for breakfast, golden-hour for dinner, etc.), renders at 4:3, then resizes to max 1200px wide and re-encodes as JPEG q=82 — typically ~150–250 KB per image.

### `GET /api/health`

Simple liveness check: `{"status": "ok"}`.

### Example `curl`

```bash
# Plan
curl -X POST http://localhost:5000/api/plan \
  -H "Content-Type: application/json" \
  -d '{"condition":"High cholesterol","dietPreference":"vegetarian","allergies":"tree nuts"}'

# Image for one recipe
curl -X POST http://localhost:5000/api/image \
  -H "Content-Type: application/json" \
  -d '{"recipeName":"Mediterranean Lentil Bowl","description":"Warm lentils with roasted vegetables","meal":"lunch"}' \
  -o /tmp/image.json
```

---

## 🔄 Adapting the Image Backend

The current `backend/generate_image.py` uses `pplx-python-sdks-llm-api` (Perplexity internal). To run standalone, swap it for any image provider. Minimal replacement:

```python
# backend/generate_image.py (OpenAI version)
import base64
import httpx
import os

async def generate_image(prompt: str, *, aspect_ratio: str = "4:3", **_) -> bytes:
    size = {"1:1": "1024x1024", "4:3": "1536x1152", "16:9": "1792x1024"}.get(aspect_ratio, "1024x1024")
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(
            "https://api.openai.com/v1/images/generations",
            headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"},
            json={"model": "gpt-image-1", "prompt": prompt, "size": size, "n": 1},
        )
        r.raise_for_status()
        return base64.b64decode(r.json()["data"][0]["b64_json"])
```

Then `pip install httpx`, set `OPENAI_API_KEY`, and drop the `pplx-python-sdks-llm-api` line from `requirements.txt`. The rest of the app is unchanged.

Other options: Anthropic's upcoming image API, Replicate (Flux, SDXL), Stability AI, fal.ai, or a local ComfyUI server.

---

## 🎨 Design System

The palette was derived from the subject matter — food, wellness, warmth.

| Token          | Light                | Dark                 |
| -------------- | -------------------- | -------------------- |
| Background     | Warm cream `#FBF5EA` | Roasted `#1C1611`    |
| Primary        | Terracotta `#B3541E` | `#DC7E37`            |
| Secondary      | Forest `#2C4A33`     | Sage `#6BAE78`       |
| Display font   | **Boska** (serif)    | via Fontshare        |
| Body font      | **Work Sans**        | via Google Fonts     |

See [`client/src/index.css`](./client/src/index.css) for the full HSL token system.

---

## 🔐 Security & Safety Notes

- The system prompt instructs the model to **never claim to cure or treat disease**; every plan ships with a medical disclaimer.
- User-provided allergies are passed verbatim to Claude with strict "never include" instructions.
- The server validates model output before returning it — malformed JSON yields a 502, never leaks to the client.
- Image prompts explicitly exclude text, labels, logos, and people to avoid awkward generations.
- `ANTHROPIC_API_KEY` lives only on the server; the client never sees it.

**This app is for educational purposes only and is not a substitute for professional medical or nutritional advice.**

---

## 🛠 Development Notes

- **Frontend** — everything lives in `client/src/pages/home.tsx`: form, plan mutation, parallel image fetches, recipe cards, macro chips.
- **Hash routing** — `wouter` with `useHashLocation` for sandbox-iframe compatibility.
- **Image streaming** — when `/api/plan` returns, the `useEffect` in `home.tsx` fires 3–4 parallel `/api/image` requests and updates per-meal state as each arrives. Each recipe card shows a shimmering skeleton with a "Plating your breakfast…" pill until its image lands.
- **No persistence** — the app is stateless. Every request goes straight to the LLM.
- **Adjusting image style** — edit `build_image_prompt()` in `backend/app.py`. Each meal has its own `setting` string (lighting, surface, styling).
- **Adjusting the model** — edit `model="claude_sonnet_4_6"` in `backend/app.py` or `aspect_ratio`/`model` in the `generate_image()` call.
- **Image compression** — `compress_image()` downscales to max 1200px and re-encodes as progressive JPEG q=82. Tune `max_width` / `quality` if you want sharper or smaller.

---

## 📦 Deployment

### Any Python host (Render, Railway, Fly.io, Heroku, DO App Platform)

1. Push this repo
2. Build command: `npm ci && npm run build && pip install -r backend/requirements.txt`
3. Start command: `python backend/app.py`
4. Env vars: `ANTHROPIC_API_KEY`, `PORT` (some hosts set this automatically)
5. Expose the port

### Docker (illustrative)

```dockerfile
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends nodejs npm && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN pip install --no-cache-dir -r backend/requirements.txt
ENV PORT=5000
EXPOSE 5000
CMD ["python", "backend/app.py"]
```

### Vercel / Netlify

Not recommended in one piece — image generation takes ~30s per call, which exceeds most serverless function timeouts. Split: deploy the static frontend (`dist/public`) to Vercel/Netlify, and the FastAPI backend to a long-running host (Fly.io, Railway). Point the frontend `apiRequest` base URL at the backend host.

---

## 🗺 Roadmap Ideas

- Multi-day plans (3 / 7 day)
- Grocery list generator (dedupe ingredients across meals)
- Save plans to an account (requires auth + DB)
- Print-friendly / PDF export
- Nutrient targets (sodium, potassium, added sugars) with visual tracking
- Swap-a-meal — regenerate a single meal without redoing the whole plan
- Stream images progressively (use SSE or chunked encoding for faster perceived time)

---

## 📄 License

MIT

---

## 🙏 Credits

- Fonts: [Boska](https://www.fontshare.com/fonts/boska) · [Work Sans](https://fonts.google.com/specimen/Work+Sans)
- UI: [shadcn/ui](https://ui.shadcn.com/) · [lucide-react](https://lucide.dev/)
- Text LLM: [Anthropic Claude](https://www.anthropic.com/)
- Image LLM: Google Nano Banana (via Perplexity's LLM API proxy)
