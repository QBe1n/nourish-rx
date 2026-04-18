import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { MealPlan, Recipe, RecipeCost } from "@shared/schema";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sunrise,
  Sun,
  Moon,
  Cookie,
  Clock,
  Users,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Droplets,
  Sparkles,
  Loader2,
  ArrowRight,
  RefreshCw,
  Wallet,
  PiggyBank,
  ShoppingBag,
  DollarSign,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CONDITION_SUGGESTIONS = [
  "Type 2 Diabetes",
  "High Blood Pressure",
  "High Cholesterol",
  "IBS",
  "Acid Reflux",
  "PCOS",
  "Iron-deficiency anemia",
  "Fatty Liver",
  "Hypothyroidism",
  "Gout",
];

type Meal = "breakfast" | "lunch" | "dinner" | "snack";

const MEAL_META: Record<
  Meal,
  { label: string; Icon: typeof Sunrise; tint: string }
> = {
  breakfast: { label: "Breakfast", Icon: Sunrise, tint: "text-[#C98A2B]" },
  lunch: { label: "Lunch", Icon: Sun, tint: "text-primary" },
  dinner: { label: "Dinner", Icon: Moon, tint: "text-secondary" },
  snack: { label: "Snack", Icon: Cookie, tint: "text-[#8B6B3D]" },
};

type ImageState = { url?: string; loading: boolean; error: boolean };
type CostState = { cost?: RecipeCost; loading: boolean; error: boolean };

const fmtUSD = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n >= 100 ? 0 : 2,
  });

export default function Home() {
  const { toast } = useToast();
  const [condition, setCondition] = useState("");
  const [dietPreference, setDietPreference] = useState("none");
  const [allergies, setAllergies] = useState("");
  const resultsRef = useRef<HTMLDivElement>(null);
  const [images, setImages] = useState<Record<Meal, ImageState>>({
    breakfast: { loading: false, error: false },
    lunch: { loading: false, error: false },
    dinner: { loading: false, error: false },
    snack: { loading: false, error: false },
  });
  const [costs, setCosts] = useState<Record<Meal, CostState>>({
    breakfast: { loading: false, error: false },
    lunch: { loading: false, error: false },
    dinner: { loading: false, error: false },
    snack: { loading: false, error: false },
  });
  const [monthlyIncome, setMonthlyIncome] = useState<string>("");

  const mutation = useMutation<MealPlan, Error, void>({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/plan", {
        condition: condition.trim(),
        dietPreference,
        allergies: allergies.trim(),
      });
      return (await res.json()) as MealPlan;
    },
    onError: (err) => {
      toast({
        title: "Couldn't generate your plan",
        description: err.message || "Please try again in a moment.",
        variant: "destructive",
      });
    },
  });

  // Reset image state whenever a new plan arrives, then fire parallel image requests
  useEffect(() => {
    if (!mutation.data) return;
    if (resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    const plan = mutation.data;
    const meals: Array<[Meal, Recipe | undefined]> = [
      ["breakfast", plan.breakfast],
      ["lunch", plan.lunch],
      ["dinner", plan.dinner],
      ["snack", plan.snack],
    ];

    // Initialize loading state for meals that exist
    setImages({
      breakfast: { loading: !!plan.breakfast, error: false },
      lunch: { loading: !!plan.lunch, error: false },
      dinner: { loading: !!plan.dinner, error: false },
      snack: { loading: !!plan.snack, error: false },
    });
    setCosts({
      breakfast: { loading: !!plan.breakfast, error: false },
      lunch: { loading: !!plan.lunch, error: false },
      dinner: { loading: !!plan.dinner, error: false },
      snack: { loading: !!plan.snack, error: false },
    });

    // Fire all image requests in parallel
    meals.forEach(([meal, recipe]) => {
      if (!recipe) return;
      apiRequest("POST", "/api/image", {
        recipeName: recipe.name,
        description: recipe.description,
        meal,
      })
        .then((res) => res.json())
        .then((data: { image: string }) => {
          setImages((prev) => ({
            ...prev,
            [meal]: { url: data.image, loading: false, error: false },
          }));
        })
        .catch(() => {
          setImages((prev) => ({
            ...prev,
            [meal]: { loading: false, error: true },
          }));
        });
    });

    // Fire all cost requests in parallel
    meals.forEach(([meal, recipe]) => {
      if (!recipe) return;
      apiRequest("POST", "/api/cost", {
        recipeName: recipe.name,
        ingredients: recipe.ingredients,
        servings: recipe.servings,
        meal,
      })
        .then((res) => res.json())
        .then((data: RecipeCost) => {
          setCosts((prev) => ({
            ...prev,
            [meal]: { cost: data, loading: false, error: false },
          }));
        })
        .catch(() => {
          setCosts((prev) => ({
            ...prev,
            [meal]: { loading: false, error: true },
          }));
        });
    });
  }, [mutation.data]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!condition.trim()) {
      toast({
        title: "Tell me about your condition",
        description: "Enter a health condition, diagnosis, or concern.",
      });
      return;
    }
    mutation.mutate();
  };

  const plan = mutation.data;

  return (
    <div className="relative min-h-dvh grain bg-background">
      {/* Header */}
      <header className="relative z-10 border-b border-border/70 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Logo />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                document.getElementById("form")?.scrollIntoView({ behavior: "smooth" })
              }
              className="hidden text-sm text-muted-foreground hover:text-foreground sm:block"
              data-testid="link-build-plan"
            >
              Build a plan
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero + Form */}
      <section id="form" className="relative z-10 mx-auto max-w-6xl px-5 pb-12 pt-10 sm:px-8 sm:pb-16 sm:pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="secondary" className="mb-5 rounded-full bg-secondary/10 text-secondary hover:bg-secondary/15" data-testid="badge-tag">
            <Sparkles className="mr-1.5 h-3 w-3" />
            Personalized nutrition, in seconds
          </Badge>
          <h1 className="font-serif text-[clamp(2rem,1.2rem+3.5vw,3.25rem)] font-medium leading-[1.05] tracking-tight">
            Meal plans that understand <em className="not-italic text-primary">your health.</em>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-[17px]">
            Describe a condition, diagnosis, or dietary concern. We'll design a
            full day of meals — breakfast, lunch, dinner, and an optional snack —
            with recipes tuned to evidence-based guidelines.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mx-auto mt-10 max-w-2xl"
          data-testid="form-plan"
        >
          <Card className="overflow-hidden border-card-border bg-card p-6 shadow-sm sm:p-7">
            <div className="space-y-5">
              <div>
                <Label htmlFor="condition" className="text-sm font-medium">
                  Health condition or concern
                </Label>
                <Textarea
                  id="condition"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  placeholder="e.g. Type 2 diabetes with borderline high blood pressure"
                  rows={3}
                  className="mt-2 resize-none bg-background"
                  disabled={mutation.isPending}
                  data-testid="input-condition"
                />
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {CONDITION_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setCondition(s)}
                      disabled={mutation.isPending}
                      className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground hover-elevate active-elevate-2 disabled:opacity-50"
                      data-testid={`button-suggestion-${s.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="diet" className="text-sm font-medium">
                    Diet preference
                  </Label>
                  <Select
                    value={dietPreference}
                    onValueChange={setDietPreference}
                    disabled={mutation.isPending}
                  >
                    <SelectTrigger id="diet" className="mt-2 bg-background" data-testid="select-diet">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No preference</SelectItem>
                      <SelectItem value="vegetarian">Vegetarian</SelectItem>
                      <SelectItem value="vegan">Vegan</SelectItem>
                      <SelectItem value="pescatarian">Pescatarian</SelectItem>
                      <SelectItem value="halal">Halal</SelectItem>
                      <SelectItem value="kosher">Kosher</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="allergies" className="text-sm font-medium">
                    Allergies / avoid
                  </Label>
                  <Input
                    id="allergies"
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    placeholder="e.g. peanuts, shellfish"
                    className="mt-2 bg-background"
                    disabled={mutation.isPending}
                    data-testid="input-allergies"
                  />
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={mutation.isPending}
                className="w-full gap-2 text-base"
                data-testid="button-generate"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Designing your meals…
                  </>
                ) : (
                  <>
                    Generate my meal plan
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Not a substitute for medical advice. Always consult your clinician.
              </p>
            </div>
          </Card>
        </form>
      </section>

      {/* Loading skeleton */}
      {mutation.isPending && !plan && (
        <section className="relative z-10 mx-auto max-w-6xl px-5 pb-24 sm:px-8">
          <LoadingPreview />
        </section>
      )}

      {/* Results */}
      {plan && (
        <section
          ref={resultsRef}
          className="relative z-10 mx-auto max-w-6xl px-5 pb-24 sm:px-8"
          data-testid="section-results"
        >
          <PlanView
            plan={plan}
            images={images}
            costs={costs}
            monthlyIncome={monthlyIncome}
            onIncomeChange={setMonthlyIncome}
            onReset={() => mutation.reset()}
          />
        </section>
      )}

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/70 bg-background/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-6 text-xs text-muted-foreground sm:flex-row sm:px-8">
          <span>© NourishRx — evidence-informed meal planning</span>
          <span>This tool is for educational purposes only.</span>
        </div>
      </footer>
    </div>
  );
}

/* ───────────────────────── Loading preview ───────────────────────── */

function LoadingPreview() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse space-y-6" data-testid="loading-preview">
      <Card className="h-40 border-card-border bg-card" />
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="h-64 border-card-border bg-card" />
        <Card className="h-64 border-card-border bg-card" />
        <Card className="h-64 border-card-border bg-card" />
      </div>
    </div>
  );
}

/* ───────────────────────── Plan view ───────────────────────── */

function PlanView({
  plan,
  images,
  costs,
  monthlyIncome,
  onIncomeChange,
  onReset,
}: {
  plan: MealPlan;
  images: Record<Meal, ImageState>;
  costs: Record<Meal, CostState>;
  monthlyIncome: string;
  onIncomeChange: (v: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-10">
      {/* Overview */}
      <div className="mx-auto max-w-4xl">
        <div className="mb-3 flex items-center gap-2">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Your plan
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <h2
          className="text-center font-serif text-[clamp(1.5rem,1rem+2vw,2.25rem)] font-medium leading-tight"
          data-testid="text-condition-title"
        >
          A day of eating for{" "}
          <em className="not-italic text-primary">{plan.condition}</em>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-base text-muted-foreground">
          {plan.summary}
        </p>

        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            onClick={onReset}
            className="gap-2"
            data-testid="button-new-plan"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Start a new plan
          </Button>
        </div>
      </div>

      {/* Principles / Emphasize / Limit */}
      <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
        <PanelList
          title="Dietary principles"
          icon={<Sparkles className="h-4 w-4" />}
          items={plan.dietaryPrinciples}
          tone="primary"
        />
        <PanelList
          title="Foods to emphasize"
          icon={<CheckCircle2 className="h-4 w-4" />}
          items={plan.foodsToEmphasize}
          tone="secondary"
        />
        <PanelList
          title="Foods to limit"
          icon={<AlertTriangle className="h-4 w-4" />}
          items={plan.foodsToLimit}
          tone="destructive"
        />
      </div>

      {/* Financial layer */}
      <div className="mx-auto max-w-5xl">
        <BudgetPanel
          plan={plan}
          costs={costs}
          monthlyIncome={monthlyIncome}
          onIncomeChange={onIncomeChange}
        />
      </div>

      {/* Meals */}
      <div className="mx-auto max-w-5xl space-y-8">
        <MealBlock meal="breakfast" recipe={plan.breakfast} image={images.breakfast} cost={costs.breakfast} />
        <MealBlock meal="lunch" recipe={plan.lunch} image={images.lunch} cost={costs.lunch} />
        <MealBlock meal="dinner" recipe={plan.dinner} image={images.dinner} cost={costs.dinner} />
        {plan.snack && <MealBlock meal="snack" recipe={plan.snack} image={images.snack} cost={costs.snack} />}
      </div>

      {/* Hydration + disclaimer */}
      <div className="mx-auto max-w-4xl space-y-4">
        <Card className="flex items-start gap-3 border-card-border bg-card p-5">
          <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
            <Droplets className="h-4 w-4" />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">Hydration</div>
            <p className="text-sm text-muted-foreground" data-testid="text-hydration">
              {plan.hydrationTip}
            </p>
          </div>
        </Card>

        <p className="text-center text-xs italic text-muted-foreground" data-testid="text-disclaimer">
          {plan.disclaimer}
        </p>
      </div>
    </div>
  );
}

function PanelList({
  title,
  icon,
  items,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  tone: "primary" | "secondary" | "destructive";
}) {
  const toneClasses = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary/10 text-secondary",
    destructive: "bg-destructive/10 text-destructive",
  }[tone];

  return (
    <Card className="border-card-border bg-card p-5" data-testid={`panel-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="mb-3 flex items-center gap-2">
        <div className={`rounded-full p-1.5 ${toneClasses}`}>{icon}</div>
        <h3 className="font-serif text-base font-medium">{title}</h3>
      </div>
      <ul className="space-y-2 text-sm text-foreground/90">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 leading-relaxed">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ───────────────────────── Meal block ───────────────────────── */

function MealBlock({
  meal,
  recipe,
  image,
  cost,
}: {
  meal: Meal;
  recipe: Recipe;
  image: ImageState;
  cost: CostState;
}) {
  const { label, Icon, tint } = MEAL_META[meal];

  return (
    <Card
      className="overflow-hidden border-card-border bg-card"
      data-testid={`card-meal-${meal}`}
    >
      {/* Hero image */}
      <RecipeImage alt={recipe.name} state={image} meal={meal} />

      <div className="flex flex-col gap-0 border-b border-border/60 p-6 sm:p-7">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${tint}`} />
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </span>
        </div>
        <h3
          className="mt-2 font-serif text-[clamp(1.35rem,1rem+1.2vw,1.875rem)] font-medium leading-tight"
          data-testid={`text-recipe-name-${meal}`}
        >
          {recipe.name}
        </h3>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          {recipe.description}
        </p>

        {/* Stats strip */}
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <Stat icon={<Clock className="h-3.5 w-3.5" />} label="Prep" value={recipe.prepTime} />
          <Stat icon={<Flame className="h-3.5 w-3.5" />} label="Cook" value={recipe.cookTime} />
          <Stat icon={<Users className="h-3.5 w-3.5" />} label="Serves" value={String(recipe.servings)} />
          <Stat icon={<Sparkles className="h-3.5 w-3.5" />} label="Calories" value={`${recipe.calories} kcal`} />
          <CostStat state={cost} meal={meal} />
        </div>

        {/* Macros */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          <MacroChip label="Protein" value={recipe.macros.protein} />
          <MacroChip label="Carbs" value={recipe.macros.carbs} />
          <MacroChip label="Fat" value={recipe.macros.fat} />
          <MacroChip label="Fiber" value={recipe.macros.fiber} />
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-[1fr_1.4fr]">
        {/* Ingredients */}
        <div className="border-b border-border/60 p-6 md:border-b-0 md:border-r sm:p-7">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Ingredients
          </h4>
          <ul className="space-y-2 text-sm">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                <span>{ing}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Instructions */}
        <div className="p-6 sm:p-7">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Method
          </h4>
          <ol className="space-y-3 text-sm">
            {recipe.instructions.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-serif text-sm font-medium text-primary">
                  {i + 1}
                </span>
                <span className="pt-0.5 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {recipe.healthNotes && (
        <div className="border-t border-border/60 bg-accent/40 px-6 py-4 sm:px-7">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 rounded-full bg-secondary/15 p-1 text-secondary">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
            <p className="text-sm text-foreground/85">
              <span className="font-medium text-secondary">Why it works — </span>
              {recipe.healthNotes}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      {icon}
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </span>
  );
}

function MacroChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/60 px-3 py-2.5 text-center">
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-serif text-base font-medium leading-[1.35]">
        {value}
      </div>
    </div>
  );
}

/* ───────────────────────── Recipe image ───────────────────────── */

function RecipeImage({
  alt,
  state,
  meal,
}: {
  alt: string;
  state: ImageState;
  meal: Meal;
}) {
  if (state.url) {
    return (
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted sm:aspect-[16/9]">
        <img
          src={state.url}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover"
          data-testid={`img-meal-${meal}`}
        />
      </div>
    );
  }

  if (state.error) {
    return (
      <div
        className="flex aspect-[4/3] w-full items-center justify-center bg-muted/50 text-xs text-muted-foreground sm:aspect-[16/9]"
        data-testid={`img-meal-${meal}-error`}
      >
        Image unavailable
      </div>
    );
  }

  // Loading skeleton with subtle shimmer
  return (
    <div
      className="relative aspect-[4/3] w-full overflow-hidden bg-muted sm:aspect-[16/9]"
      data-testid={`img-meal-${meal}-loading`}
    >
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted via-accent/40 to-muted" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm">
          <Loader2 className="h-3 w-3 animate-spin" />
          Plating your {meal}…
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Per-meal cost chip ───────────────────────── */

function CostStat({ state, meal }: { state: CostState; meal: Meal }) {
  if (state.loading) {
    return (
      <span className="flex items-center gap-1.5" data-testid={`cost-meal-${meal}-loading`}>
        <DollarSign className="h-3.5 w-3.5" />
        <span className="text-muted-foreground">Cost</span>
        <span className="inline-block h-3 w-10 animate-pulse rounded bg-muted" />
      </span>
    );
  }
  if (state.error || !state.cost) {
    return (
      <span className="flex items-center gap-1.5" data-testid={`cost-meal-${meal}-error`}>
        <DollarSign className="h-3.5 w-3.5" />
        <span className="text-muted-foreground">Cost</span>
        <span className="text-muted-foreground/70">—</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5" data-testid={`cost-meal-${meal}`}>
      <DollarSign className="h-3.5 w-3.5" />
      <span className="text-muted-foreground">Cost</span>
      <span className="font-medium text-foreground">
        {fmtUSD(state.cost.perServingCost)}
        <span className="text-[11px] text-muted-foreground">/serving</span>
      </span>
    </span>
  );
}

/* ───────────────────────── Budget panel (50/30/20) ───────────────────────── */

function BudgetPanel({
  plan,
  costs,
  monthlyIncome,
  onIncomeChange,
}: {
  plan: MealPlan;
  costs: Record<Meal, CostState>;
  monthlyIncome: string;
  onIncomeChange: (v: string) => void;
}) {
  // Sum per-serving costs across meals that have loaded
  const mealsInPlan: Meal[] = [
    "breakfast",
    "lunch",
    "dinner",
    ...(plan.snack ? ["snack" as Meal] : []),
  ];
  const loaded = mealsInPlan.filter((m) => costs[m].cost);
  const anyLoading = mealsInPlan.some((m) => costs[m].loading);
  const allLoaded = loaded.length === mealsInPlan.length;

  const dailyCost = loaded.reduce(
    (sum, m) => sum + (costs[m].cost?.perServingCost ?? 0),
    0
  );
  const weeklyCost = dailyCost * 7;
  const monthlyCost = dailyCost * 30;

  const income = Math.max(0, parseFloat(monthlyIncome) || 0);
  const needs = income * 0.5;
  const wants = income * 0.3;
  const save = income * 0.2;

  // % of the 'needs' bucket consumed by food (using monthly food cost)
  const foodPctOfNeeds =
    income > 0 && allLoaded ? (monthlyCost / needs) * 100 : null;

  // Health flag color
  const pctTone =
    foodPctOfNeeds == null
      ? "text-muted-foreground"
      : foodPctOfNeeds <= 35
      ? "text-secondary"
      : foodPctOfNeeds <= 60
      ? "text-[#C98A2B]"
      : "text-destructive";

  return (
    <Card className="overflow-hidden border-card-border bg-card" data-testid="panel-budget">
      {/* Header */}
      <div className="border-b border-border/60 p-6 sm:p-7">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Financial layer
          </span>
        </div>
        <h3 className="mt-2 font-serif text-[clamp(1.35rem,1rem+1.2vw,1.875rem)] font-medium leading-tight">
          Budget & meal cost
        </h3>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Estimates based on U.S. mid-market grocery prices. Enter your monthly
          income and we'll show how this plan fits a 50/30/20 budget.
        </p>
      </div>

      {/* Cost summary */}
      <div className="grid gap-0 border-b border-border/60 sm:grid-cols-3">
        <CostTile
          label="Per day"
          value={loaded.length ? fmtUSD(dailyCost) : "—"}
          note={
            anyLoading
              ? `Calculating ${mealsInPlan.length - loaded.length} more…`
              : `${loaded.length} of ${mealsInPlan.length} meals`
          }
          testid="stat-cost-daily"
        />
        <CostTile
          label="Per week"
          value={loaded.length ? fmtUSD(weeklyCost) : "—"}
          note="7 days at this plan"
          testid="stat-cost-weekly"
        />
        <CostTile
          label="Per month"
          value={loaded.length ? fmtUSD(monthlyCost) : "—"}
          note="30 days at this plan"
          testid="stat-cost-monthly"
          highlight
        />
      </div>

      {/* Income input */}
      <div className="border-b border-border/60 p-6 sm:p-7">
        <Label htmlFor="income" className="text-sm font-medium">
          Your monthly after-tax income (USD)
        </Label>
        <div className="relative mt-2 max-w-xs">
          <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="income"
            type="number"
            inputMode="decimal"
            min={0}
            step={100}
            value={monthlyIncome}
            onChange={(e) => onIncomeChange(e.target.value)}
            placeholder="e.g. 5000"
            className="bg-background pl-9"
            data-testid="input-income"
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Used only in your browser — not stored or sent anywhere except to compute your split.
        </p>
      </div>

      {/* 50/30/20 breakdown */}
      {income > 0 && (
        <div className="p-6 sm:p-7" data-testid="panel-budget-breakdown">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <h4 className="font-serif text-lg font-medium">
              Your 50 / 30 / 20 split
            </h4>
            {foodPctOfNeeds != null && (
              <span
                className={`text-sm font-medium ${pctTone}`}
                data-testid="text-food-pct"
              >
                Food = {foodPctOfNeeds.toFixed(1)}% of your Needs
              </span>
            )}
          </div>

          {/* Stacked bar */}
          <div className="mb-5 flex h-3 w-full overflow-hidden rounded-full border border-border bg-background">
            <div className="bg-primary" style={{ width: "50%" }} title="Needs 50%" />
            <div className="bg-secondary" style={{ width: "30%" }} title="Wants 30%" />
            <div className="bg-[#C98A2B]" style={{ width: "20%" }} title="Save 20%" />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <BudgetBucket
              tone="primary"
              icon={<ShoppingBag className="h-4 w-4" />}
              label="Needs"
              pct={50}
              amount={needs}
              foodAmount={allLoaded ? monthlyCost : undefined}
              foodPct={foodPctOfNeeds ?? undefined}
              sublabel="Rent, utilities, groceries, transport"
            />
            <BudgetBucket
              tone="secondary"
              icon={<Sparkles className="h-4 w-4" />}
              label="Wants"
              pct={30}
              amount={wants}
              sublabel="Dining out, entertainment, subscriptions"
            />
            <BudgetBucket
              tone="amber"
              icon={<PiggyBank className="h-4 w-4" />}
              label="Save / Invest"
              pct={20}
              amount={save}
              sublabel="Emergency fund, retirement, investing"
            />
          </div>

          {/* Verdict */}
          {foodPctOfNeeds != null && (
            <div
              className="mt-5 rounded-md border border-border bg-accent/40 px-4 py-3 text-sm"
              data-testid="text-budget-verdict"
            >
              {foodPctOfNeeds <= 35 ? (
                <>
                  <span className="font-medium text-secondary">Comfortable fit. </span>
                  At {fmtUSD(monthlyCost)}/mo, this plan uses only {foodPctOfNeeds.toFixed(1)}% of your
                  Needs bucket ({fmtUSD(needs)}), leaving room for rent, utilities, and other essentials.
                </>
              ) : foodPctOfNeeds <= 60 ? (
                <>
                  <span className="font-medium text-[#C98A2B]">Manageable. </span>
                  Food would take {foodPctOfNeeds.toFixed(1)}% of your Needs ({fmtUSD(monthlyCost)} of {fmtUSD(needs)}).
                  Watch rent + utilities so the Needs bucket doesn't overflow.
                </>
              ) : (
                <>
                  <span className="font-medium text-destructive">Tight budget. </span>
                  Food alone is {foodPctOfNeeds.toFixed(1)}% of Needs ({fmtUSD(monthlyCost)} of {fmtUSD(needs)}).
                  Consider cheaper protein swaps, bulk grains, or scaling servings.
                </>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function CostTile({
  label,
  value,
  note,
  testid,
  highlight,
}: {
  label: string;
  value: string;
  note: string;
  testid: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`border-b border-border/60 p-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 ${
        highlight ? "bg-accent/40" : ""
      }`}
      data-testid={testid}
    >
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-serif text-[clamp(1.5rem,1.2rem+1vw,2rem)] font-medium leading-[1.2]">
        {value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{note}</div>
    </div>
  );
}

function BudgetBucket({
  tone,
  icon,
  label,
  pct,
  amount,
  sublabel,
  foodAmount,
  foodPct,
}: {
  tone: "primary" | "secondary" | "amber";
  icon: React.ReactNode;
  label: string;
  pct: number;
  amount: number;
  sublabel: string;
  foodAmount?: number;
  foodPct?: number;
}) {
  const tones = {
    primary: { pill: "bg-primary/10 text-primary", bar: "bg-primary" },
    secondary: { pill: "bg-secondary/10 text-secondary", bar: "bg-secondary" },
    amber: { pill: "bg-[#C98A2B]/15 text-[#C98A2B]", bar: "bg-[#C98A2B]" },
  }[tone];

  return (
    <div className="rounded-md border border-border bg-background/60 p-4">
      <div className="flex items-center gap-2">
        <div className={`rounded-full p-1.5 ${tones.pill}`}>{icon}</div>
        <span className="text-sm font-medium">{label}</span>
        <span className="ml-auto text-xs text-muted-foreground">{pct}%</span>
      </div>
      <div className="mt-3 font-serif text-xl font-medium">{fmtUSD(amount)}</div>
      <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>
      {foodAmount != null && foodPct != null && (
        <div className="mt-3 border-t border-border/60 pt-3">
          <div className="mb-1.5 flex justify-between text-[11px] text-muted-foreground">
            <span>Food this plan</span>
            <span className="font-medium text-foreground">{fmtUSD(foodAmount)}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full ${tones.bar}`}
              style={{ width: `${Math.min(100, foodPct).toFixed(1)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
