import { Activity, Heart, Info, Scale, ShieldCheck } from "lucide-react";

interface BmiHealthCardProps {
  weightKg: number | null | undefined;
  heightCm: number | null | undefined;
  age?: number | null | undefined;
}

export type BmiCategory = "underweight" | "normal" | "overweight" | "obese";

export interface BmiStatus {
  bmi: number;
  category: BmiCategory;
  label: string;
  badgeClass: string;
  indicatorPositionPct: number; // 0 to 100
  color: string;
  recommendation: string;
}

export function calculateBmiStatus(weightKg: number, heightCm: number): BmiStatus {
  const heightMeters = heightCm / 100;
  const bmi = Number((weightKg / (heightMeters * heightMeters)).toFixed(1));

  let category: BmiCategory = "normal";
  let label = "Normal weight";
  let badgeClass = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
  let color = "#10b981"; // emerald-500
  let recommendation = "Your BMI is in a healthy range. Keep up your balanced meal plans and active lifestyle!";

  // Position percentage mapping for visual gauge (range: 12 to 40 BMI scale)
  // Scale range: 12 (0%) -> 18.5 (25%) -> 25 (50%) -> 30 (75%) -> 40 (100%)
  let indicatorPositionPct = 50;

  if (bmi < 18.5) {
    category = "underweight";
    label = "Underweight";
    badgeClass = "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";
    color = "#0284c7"; // sky-600
    recommendation = "Consider nutrient-dense, calorie-rich meals and consult with a healthcare professional or nutritionist.";
    // Map 12 to 18.5 -> 0% to 25%
    const clamped = Math.max(12, Math.min(18.5, bmi));
    indicatorPositionPct = ((clamped - 12) / (18.5 - 12)) * 25;
  } else if (bmi >= 18.5 && bmi < 25) {
    category = "normal";
    label = "Normal weight";
    badgeClass = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    color = "#10b981";
    recommendation = "Great job! Maintain your current routine with wholesome ingredients and high fiber choices.";
    // Map 18.5 to 25 -> 25% to 50%
    indicatorPositionPct = 25 + ((bmi - 18.5) / (25 - 18.5)) * 25;
  } else if (bmi >= 25 && bmi < 30) {
    category = "overweight";
    label = "Overweight";
    badgeClass = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    color = "#f59e0b"; // amber-500
    recommendation = "Focus on portion awareness, increasing whole foods, and keeping daily calorie targets aligned with your goals.";
    // Map 25 to 30 -> 50% to 75%
    indicatorPositionPct = 50 + ((bmi - 25) / (30 - 25)) * 25;
  } else {
    category = "obese";
    label = "Obese";
    badgeClass = "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
    color = "#f43f5e"; // rose-500
    recommendation = "Prioritize whole food choices, reduce refined sugars, and consider guidance from a certified dietitian.";
    // Map 30 to 40 -> 75% to 100%
    const clamped = Math.min(40, bmi);
    indicatorPositionPct = 75 + ((clamped - 30) / (40 - 30)) * 25;
  }

  return {
    bmi,
    category,
    label,
    badgeClass,
    indicatorPositionPct: Math.max(2, Math.min(98, indicatorPositionPct)),
    color,
    recommendation,
  };
}

export function BmiHealthCard({ weightKg, heightCm, age }: BmiHealthCardProps) {
  const hasValidInputs = weightKg && weightKg > 0 && heightCm && heightCm > 0;

  if (!hasValidInputs) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Scale className="h-6 w-6" />
        </div>
        <h3 className="mt-3 text-lg font-semibold text-card-foreground">BMI & Health Status</h3>
        <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
          Enter your weight and height in your profile settings below to view your personalized BMI health indicator and nutrition tips.
        </p>
      </div>
    );
  }

  const status = calculateBmiStatus(weightKg, heightCm);

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8 overflow-hidden relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-card-foreground">BMI Health Status</h2>
            <p className="text-xs text-muted-foreground">
              Calculated from {weightKg} kg & {heightCm} cm {age ? `• ${age} yrs` : ""}
            </p>
          </div>
        </div>

        <div className={`inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full border px-3.5 py-1.5 text-xs font-semibold ${status.badgeClass}`}>
          <Heart className="h-3.5 w-3.5 fill-current" />
          <span>{status.label}</span>
        </div>
      </div>

      <div className="mt-6 grid items-center gap-6 sm:grid-cols-12">
        {/* Metric display */}
        <div className="sm:col-span-4 flex flex-col items-center sm:items-start justify-center p-4 rounded-2xl bg-accent/40 border border-border/50">
          <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Body Mass Index</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold tracking-tight text-foreground">{status.bmi}</span>
            <span className="text-sm font-medium text-muted-foreground">kg/m²</span>
          </div>
          <span className="mt-1 text-xs font-medium text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> NutriGuard Health Index
          </span>
        </div>

        {/* Visual Gauge Scale */}
        <div className="sm:col-span-8 space-y-3">
          <div className="flex justify-between text-xs font-medium text-muted-foreground px-1">
            <span>Underweight (&lt;18.5)</span>
            <span>Normal (18.5-24.9)</span>
            <span>Overweight (25-29.9)</span>
            <span>Obese (≥30)</span>
          </div>

          {/* Bar track */}
          <div className="relative h-4 w-full rounded-full bg-input/40 overflow-visible p-0.5 border border-border">
            {/* Color Segments */}
            <div className="h-full w-full rounded-full flex overflow-hidden">
              <div className="h-full w-[25%] bg-sky-400 dark:bg-sky-500 opacity-80" />
              <div className="h-full w-[25%] bg-emerald-500 opacity-80" />
              <div className="h-full w-[25%] bg-amber-500 opacity-80" />
              <div className="h-full w-[25%] bg-rose-500 opacity-80" />
            </div>

            {/* Position Marker */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-500 ease-out z-10"
              style={{ left: `${status.indicatorPositionPct}%` }}
            >
              <div className="h-6 w-6 rounded-full bg-background border-2 border-primary shadow-md flex items-center justify-center">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: status.color }} />
              </div>
            </div>
          </div>

          {/* Recommendation quote */}
          <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground bg-background/60 p-3 rounded-2xl border border-border/60">
            <Info className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">{status.recommendation}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
