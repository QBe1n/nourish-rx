# NourishRx 🌿

> Personalized, evidence-informed meal plans generated from a user's health condition.

NourishRx takes any disease, diagnosis, or dietary concern written in plain language and produces a **complete one-day meal plan** — breakfast, lunch, dinner, and an optional snack — with full recipes, macros, and clinical rationale tailored to that condition.

Built for type 2 diabetes, hypertension, IBS, PCOS, high cholesterol, fatty liver, CKD, gout, celiac, and anything else a user might type.

![NourishRx screenshot](./docs/screenshot.png)

---

## ✨ Features

- **Condition-aware meal plans** — automatically applies the right framework (DASH for hypertension, low‑GI for diabetes, low‑FODMAP for IBS, Mediterranean for cardiovascular, renal diet for CKD, etc.)
- **Full recipes** — ingredients, step-by-step method, prep/cook time, servings, calories, and macros (protein / carbs / fat / fiber) per meal
- **"Why it works"** — each recipe includes a clinical rationale explaining how it supports the condition
- **Dietary principles + foods to emphasize/limit** — a full editorial-style overview of the day
- **Diet preferences** — vegetarian, vegan, pescatarian, halal, kosher
- **Allergy-safe** — strict avoidance of user-listed allergens
- **Hydration guidance** tuned to the condition
- **Medical disclaimer** on every plan
- **Light + dark mode**, fully responsive, no generic AI aesthetic — warm editorial cookbook palette (terracotta + forest on cream)

---

## 🧱 Tech Stack

| Layer        | Choice                                                                |
| ------------ | --------------------------------------------------------------------- |
| Frontend     | **React 18 + Vite + TypeScript**, Tailwind CSS v3, shadcn/ui, wouter  |
| Data/Forms   | TanStack Query v5, React Hook Form, Zod                               |
| Backend      | **Express** (Node) on port 5000, same-origin with Vite in dev         |
| AI           | **Anthropic Claude** (Sonnet 4.6) via `@anthropic-ai/sdk`             |
| Validation   | Zod schemas shared between client & server (`shared/schema.ts`)       |
| Build/Deploy | `tsx` build script → static client in `dist/public`, bundled server   |

The frontend is intentionally thin: the Express server's only job is to proxy to the LLM, validate the response against a strict Zod schema, and return JSON.

---

## 📁 Project Structure

```
nourish-rx/
├── client/                 # Vite + React frontend
│   ├── index.html
│   ├── public/
│   │   └── favicon.svg
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── index.css       # Design tokens (HSL palette, light/dark)
│       ├── components/
│       │   ├── logo.tsx
│       │   ├── theme-toggle.tsx
│       │   └── ui/         # shadcn/ui primitives
│       ├── hooks/
│       ├── lib/
│       │   └── queryClient.ts
│       └── pages/
│           ├── home.tsx    # Everything lives here — form + results
│           └── not-found.tsx
├── server/
│   ├── index.ts            # Express bootstrap
│   ├── routes.ts           # POST /api/plan → Claude → validated JSON
│   ├── storage.ts          # (stub — app is stateless)
│   ├── static.ts           # Production static serving
│   └── vite.ts             # Vite middleware for dev
├── shared/
│   └── schema.ts           # PlanRequest, Recipe, MealPlan Zod schemas
├── script/
│   └── build.ts            # Client + server production build
├── components.json         # shadcn config
├── drizzle.config.ts       # (unused — retained from template)
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
├── vite.config.ts
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js 20+**
- **npm 10+**
- An **Anthropic API key** — [console.anthropic.com](https://console.anthropic.com/)

### 1. Install

```bash
git clone https://github.com/<your-username>/nourish-rx.git
cd nourish-rx
npm install
```

### 2. Configure environment

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Then edit `.env` and add your Anthropic key:

```env
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx
PORT=5000          # optional — defaults to 5000
NODE_ENV=development
```

The `@anthropic-ai/sdk` picks up `ANTHROPIC_API_KEY` from the environment automatically — no extra wiring needed.

### 3. Run in development

```bash
npm run dev
```

This starts **Express + Vite on the same port** (`http://localhost:5000`). Edits to client or server files hot-reload automatically.

Open http://localhost:5000 in your browser.

### 4. Build for production

```bash
npm run build
```

Produces:

- `dist/public/` — static client bundle (HTML/CSS/JS)
- `dist/index.cjs` — bundled Express server

### 5. Run in production

```bash
NODE_ENV=production node dist/index.cjs
```

The server serves the static client from `dist/public` and exposes `/api/plan`.

---

## 🧪 Using the App

1. Visit the homepage
2. In **"Health condition or concern"**, type anything — single condition, multiple conditions, or a free-form description. Examples:
   - `Type 2 diabetes`
   - `High blood pressure with borderline high cholesterol`
   - `IBS with lactose intolerance`
   - `Stage 3 chronic kidney disease, not on dialysis`
   - `PCOS and insulin resistance`
   - `Iron-deficiency anemia, vegetarian`
3. (Optional) Select a **diet preference** — vegetarian, vegan, pescatarian, halal, kosher
4. (Optional) List **allergies** (comma-separated) — e.g. `peanuts, shellfish, sesame`
5. Click **Generate my meal plan**
6. Wait ~10–20 seconds while Claude composes the plan
7. Browse the full day — each meal has ingredients, steps, macros, and a "why it works" clinical rationale

Click **Start a new plan** to reset and try another condition.

---

## 🔌 API Reference

There's exactly one endpoint.

### `POST /api/plan`

**Request body:**

```json
{
  "condition": "Type 2 diabetes with hypertension",
  "dietPreference": "none" | "vegetarian" | "vegan" | "pescatarian" | "halal" | "kosher",
  "allergies": "peanuts, shellfish"
}
```

Only `condition` is required (2–500 chars). `dietPreference` defaults to `"none"`, `allergies` defaults to `""`.

**Response:** a validated `MealPlan` object.

```ts
type MealPlan = {
  condition: string;
  summary: string;                    // 2–3 sentence overview
  dietaryPrinciples: string[];        // 4–6 rules
  foodsToEmphasize: string[];         // 6–10 foods
  foodsToLimit: string[];             // 4–8 foods
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
  prepTime: string;                   // e.g. "10 min"
  cookTime: string;
  servings: number;
  calories: number;                   // per serving
  macros: { protein: string; carbs: string; fat: string; fiber: string };
  ingredients: string[];
  instructions: string[];
  healthNotes: string;                // why this meal supports the condition
};
```

See [`shared/schema.ts`](./shared/schema.ts) for the canonical Zod definitions — these are validated both on the request (before calling the LLM) and on the response (before returning to the client).

**Error responses:**

| Status | Meaning                                                 |
| ------ | ------------------------------------------------------- |
| `400`  | Invalid request body (fails Zod validation)             |
| `500`  | LLM call failed or threw                                |
| `502`  | LLM returned empty or non-conformant JSON               |

### Example `curl`

```bash
curl -X POST http://localhost:5000/api/plan \
  -H "Content-Type: application/json" \
  -d '{
    "condition": "High cholesterol",
    "dietPreference": "vegetarian",
    "allergies": "tree nuts"
  }'
```

---

## 🎨 Design System

The palette was derived from the subject matter — food, wellness, warmth — not from a generic template.

| Token          | Light               | Dark                |
| -------------- | ------------------- | ------------------- |
| Background     | Warm cream `#FBF5EA`| Roasted `#1C1611`   |
| Primary        | Terracotta `#B3541E`| `#DC7E37`           |
| Secondary      | Forest `#2C4A33`    | Sage `#6BAE78`      |
| Display font   | **Boska** (serif)   | via Fontshare       |
| Body font      | **Work Sans**       | via Google Fonts    |

See [`client/src/index.css`](./client/src/index.css) for the full HSL token system.

---

## 🔐 Security & Safety Notes

- The system prompt instructs the model to **never claim to cure or treat disease** and to include a medical disclaimer on every plan
- User-provided allergies are passed verbatim to the model with strict "never include" instructions
- The server validates model output with Zod before returning it — malformed JSON results in a 502, never leaks to the user
- `ANTHROPIC_API_KEY` lives only on the server; the client never sees it

**This app is for educational purposes only and is not a substitute for professional medical or nutritional advice.**

---

## 🛠 Development Notes

- **Everything is in `client/src/pages/home.tsx`** — single-file page on purpose. Form, mutation, loading state, plan rendering, recipe cards, macro chips.
- **Hash routing** — `wouter` with `useHashLocation` so the app works inside sandboxed iframes after deployment.
- **No persistence** — the app is stateless. `server/storage.ts` is a stub retained in case you want to log plans or add user accounts later.
- **Adding a new diet preference** — update the enum in `shared/schema.ts` and the `<SelectItem>` list in `home.tsx`.
- **Swapping the model** — change the `model` string in `server/routes.ts`. The SDK call already requests JSON-only output.
- **Adjusting the system prompt** — edit `SYSTEM_PROMPT` in `server/routes.ts`. Keep the "JSON only, no markdown" rule.

---

## 📦 Deployment

### Static + Node server (any Node host)

```bash
npm run build
NODE_ENV=production ANTHROPIC_API_KEY=sk-ant-... node dist/index.cjs
```

Expose port 5000.

### Render, Railway, Fly.io, etc.

1. Push this repo
2. Set build command: `npm ci && npm run build`
3. Set start command: `node dist/index.cjs`
4. Add `ANTHROPIC_API_KEY` as a secret
5. Expose port 5000

### Vercel / Netlify

The Express layer needs a long-running process, so split or rewrite the `/api/plan` route as a serverless function that uses the same `shared/schema.ts` and calls `@anthropic-ai/sdk`. Deploy `dist/public` as the static site.

---

## 🗺 Roadmap Ideas

- Multi-day plans (3 / 7 day)
- Grocery list generator
- Save plans to an account (requires auth + DB)
- Print-friendly / PDF export
- Nutrient targets (sodium, potassium, added sugars) with visual tracking
- Integration with wearables / CGM data

---

## 📄 License

MIT

---

## 🙏 Credits

- Fonts: [Boska](https://www.fontshare.com/fonts/boska) · [Work Sans](https://fonts.google.com/specimen/Work+Sans)
- UI: [shadcn/ui](https://ui.shadcn.com/) · [lucide-react](https://lucide.dev/)
- LLM: [Anthropic Claude](https://www.anthropic.com/)
