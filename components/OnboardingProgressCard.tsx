type OnboardingProgressCardProps = {
  onboardingStatus: string;
  onboardingProgress: Record<string, boolean> | null;
  productCount: number;
  hasDomain: boolean;
  paymentMode: "edge" | "external";
  shippingMode: "edge" | "external";
};

export function OnboardingProgressCard({
  onboardingStatus,
  onboardingProgress,
  productCount,
  hasDomain,
  paymentMode,
  shippingMode,
}: OnboardingProgressCardProps) {
  const progress = onboardingProgress ?? {};

  const readinessChecklist = [
    { label: "At least 3 products loaded", done: productCount >= 3 },
    { label: "Payments configured", done: paymentMode === "edge" || paymentMode === "external" },
    { label: "Shipping configured", done: shippingMode === "edge" || shippingMode === "external" },
    { label: "Custom domain configured (optional)", done: hasDomain },
  ];

  return (
    <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Onboarding progress</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">Store readiness checklist</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Current status: <strong>{onboardingStatus}</strong></p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {Object.entries(progress).map(([key, done]) => (
          <div key={key} className={`rounded-xl border px-3 py-2 text-sm ${done ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200" : "border-zinc-300 dark:border-zinc-700"}`}>
            {done ? "✓" : "○"} {key}
          </div>
        ))}
      </div>

      <ul className="space-y-2 text-sm">
        {readinessChecklist.map((item) => (
          <li key={item.label} className="flex items-center justify-between rounded-xl border border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <span>{item.label}</span>
            <span className={item.done ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500"}>{item.done ? "Ready" : "Pending"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
