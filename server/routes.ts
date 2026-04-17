import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import Anthropic from "@anthropic-ai/sdk";
import { planRequestSchema, mealPlanSchema, type MealPlan } from "@shared/schema";

const SYSTEM_PROMPT = `You are NourishRx, a board-certified clinical nutritionist and registered dietitian.
Given a user's health condition or concern, you produce an evidence-informed single-day meal plan with full recipes.

CRITICAL RULES:
1. Always follow current nutritional guidelines (e.g. DASH for hypertension, Mediterranean for cardiovascular, low-FODMAP for IBS, low-GI for diabetes, renal diet for CKD, gluten-free for celiac).
2. Tailor sodium, sugar, fiber, protein, potassium, and fat content to the specific condition.
3. Respect stated diet preferences and allergies strictly. Never include an allergen.
4. Provide realistic home recipes with common ingredients. Include accurate calorie and macro estimates.
5. Never claim to cure or treat disease. Include a clear disclaimer to consult a healthcare provider.
6. If the condition is unsafe for self-management (e.g. severe eating disorders, acute pancreatitis, dialysis without dietitian supervision), still provide general guidance but emphasize professional care in the disclaimer.
7. Return ONLY valid JSON that matches the provided schema. No markdown, no code fences, no commentary.`;

const JSON_SCHEMA_HINT = `{
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
}`;

function buildUserPrompt(
  condition: string,
  dietPreference: string,
  allergies: string,
): string {
  const parts: string[] = [];
  parts.push(`Health condition / concern: ${condition}`);
  if (dietPreference && dietPreference !== "none") {
    parts.push(`Diet preference: ${dietPreference}`);
  }
  if (allergies && allergies.trim()) {
    parts.push(`Allergies / foods to avoid: ${allergies}`);
  }
  parts.push("");
  parts.push(
    "Generate a complete one-day meal plan (breakfast, lunch, dinner, plus an optional snack) with full recipes. Return ONLY the JSON object below — no prose, no markdown fences.",
  );
  parts.push("");
  parts.push("SCHEMA:");
  parts.push(JSON_SCHEMA_HINT);
  return parts.join("\n");
}

function extractJson(text: string): string {
  // Strip markdown code fences if the model included them
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  // Otherwise take from first { to last }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1);
  }
  return text.trim();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  const anthropic = new Anthropic();

  app.post("/api/plan", async (req: Request, res: Response) => {
    const parsed = planRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const { condition, dietPreference, allergies } = parsed.data;

    try {
      const message = await anthropic.messages.create({
        model: "claude_sonnet_4_6",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: buildUserPrompt(
              condition,
              dietPreference ?? "none",
              allergies ?? "",
            ),
          },
        ],
      });

      // Extract text from content blocks
      const textBlock = message.content.find(
        (b): b is Anthropic.TextBlock => b.type === "text",
      );
      if (!textBlock) {
        return res.status(502).json({ error: "Empty response from model" });
      }

      const jsonStr = extractJson(textBlock.text);
      let plan: MealPlan;
      try {
        plan = mealPlanSchema.parse(JSON.parse(jsonStr));
      } catch (e) {
        console.error("Schema validation failed:", e);
        console.error("Raw text:", textBlock.text.slice(0, 1000));
        return res
          .status(502)
          .json({ error: "Model returned invalid plan format" });
      }

      res.json(plan);
    } catch (err: any) {
      console.error("Plan generation error:", err);
      res.status(500).json({
        error: "Failed to generate meal plan",
        message: err?.message ?? "Unknown error",
      });
    }
  });

  return httpServer;
}
