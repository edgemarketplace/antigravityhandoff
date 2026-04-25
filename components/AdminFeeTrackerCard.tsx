"use client";

import Link from "next/link";
import { useState } from "react";
import { centsToUsd, getFeeNudge, getGrowthPlanComparison, getProjectedFreePlanFee } from "@/lib/smart-upgrade";

type AdminFeeTrackerCardProps = {
  tenantSlug: string;
  currentPlan: "free" | "growth";
  monthlyOrderCount: number;
  monthlyGmvCents: number;
  monthlyFeeCents: number;
};

export function AdminFeeTrackerCard({
  tenantSlug,
  currentPlan,
  monthlyOrderCount,
  monthlyGmvCents,
  monthlyFeeCents,
}: AdminFeeTrackerCardProps) {
  const nudge = getFeeNudge(monthlyFeeCents);
  const projectedFeeCents = getProjectedFreePlanFee(monthlyGmvCents);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  async function startUpgradeCheckout() {
    setIsUpgrading(true);
    setUpgradeError(null);

    try {
      const response = await fetch(`/api/admin/billing/upgrade/start?tenant=${encodeURIComponent(tenantSlug)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });

      const payload = (await response.json()) as {
        success: boolean;
        message?: string;
        checkout_url?: string;
      };

      if (!response.ok || !payload.success || !payload.checkout_url) {
        throw new Error(payload.message ?? "Could not start Growth checkout.");
      }

      window.location.href = payload.checkout_url;
    } catch (error) {
      setUpgradeError(error instanceof Error ? error.message : "Could not start Growth checkout.");
      setIsUpgrading(false);
    }
  }

  const nudgeToneClass =
    nudge.level === "urgent"
      ? "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
      : nudge.level === "strong"
        ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
        : nudge.level === "soft"
          ? "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"
          : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300";

  return (
    <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div>
        <p className="text-xs tracking-[0.18em] text-zinc-500 uppercase">Smart upgrade engine</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">Fee tracker</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Revenue</p>
          <p className="mt-1 text-lg font-semibold">{centsToUsd(monthlyGmvCents)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Orders</p>
          <p className="mt-1 text-lg font-semibold">{monthlyOrderCount.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Fees paid</p>
          <p className="mt-1 text-lg font-semibold">{centsToUsd(monthlyFeeCents)}</p>
        </div>
      </div>

      {currentPlan === "free" ? (
        <div className="space-y-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900/60 dark:bg-orange-950/30">
          <p className="text-sm font-medium text-orange-950 dark:text-orange-200">{getGrowthPlanComparison(monthlyFeeCents)}</p>
          <p className="text-xs text-orange-800 dark:text-orange-300">
            At current GMV pace, projected free-plan fee is <strong>{centsToUsd(projectedFeeCents)}</strong> this month.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={isUpgrading}
              onClick={startUpgradeCheckout}
              className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUpgrading ? "Opening checkout..." : "Upgrade to Growth"}
            </button>
            <Link
              href={`/admin?tenant=${encodeURIComponent(tenantSlug)}#upgrade-growth`}
              className="text-sm font-medium text-orange-700 underline underline-offset-4 dark:text-orange-300"
            >
              Open billing settings
            </Link>
          </div>
          {upgradeError ? <p className="text-xs text-red-700 dark:text-red-300">{upgradeError}</p> : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          Growth is active. 5% fee accumulation is disabled for this tenant.
        </div>
      )}

      <div className={`rounded-2xl border p-4 ${nudgeToneClass}`}>
        <p className="text-sm font-semibold">{nudge.title}</p>
        <p className="mt-1 text-sm">{nudge.body}</p>
      </div>
    </section>
  );
}
