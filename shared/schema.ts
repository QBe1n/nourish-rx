import { z } from "zod";

// Request schema — user submits a health condition or concern
export const planRequestSchema = z.object({
  condition: z.string().min(2, "Please describe your condition").max(500),
  // Optional filters
  dietPreference: z
    .enum(["none", "vegetarian", "vegan", "pescatarian", "halal", "kosher"])
    .optional()
    .default("none"),
  allergies: z.string().max(300).optional().default(""),
});

export type PlanRequest = z.infer<typeof planRequestSchema>;

// Recipe structure for a single meal
export const recipeSchema = z.object({
  name: z.string(),
  description: z.string(),
  prepTime: z.string(), // e.g. "15 min"
  cookTime: z.string(),
  servings: z.number(),
  calories: z.number(),
  macros: z.object({
    protein: z.string(), // e.g. "28g"
    carbs: z.string(),
    fat: z.string(),
    fiber: z.string(),
  }),
  ingredients: z.array(z.string()),
  instructions: z.array(z.string()),
  healthNotes: z.string(), // why this meal is good for the condition
  imageUrl: z.string().optional(), // filled in client-side after plan arrives
});

export type Recipe = z.infer<typeof recipeSchema>;

// Full meal plan response
export const mealPlanSchema = z.object({
  condition: z.string(),
  summary: z.string(), // 2-3 sentence overview
  dietaryPrinciples: z.array(z.string()), // key rules for this condition
  foodsToEmphasize: z.array(z.string()),
  foodsToLimit: z.array(z.string()),
  breakfast: recipeSchema,
  lunch: recipeSchema,
  dinner: recipeSchema,
  snack: recipeSchema.optional(),
  hydrationTip: z.string(),
  disclaimer: z.string(),
});

export type MealPlan = z.infer<typeof mealPlanSchema>;
