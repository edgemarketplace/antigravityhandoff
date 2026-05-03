"use client";

import Link from "next/link";

type Mode = "edge" | "external";

type AdminFeeTrackerCardProps = {
  tenantSlug: string;
  paymentMode: Mode;
  shippingMode: Mode;
  totalRevenue: number;
  stripeFeesPaid: number;
  edgeFeesPaid: number;
  shippingMarginPaid: number;
  platformFeesPaid: number;
  totalSavings: number;
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value.toFixed(2)));
}

export function AdminFeeTrackerCard({
  tenantSlug,
  paymentMode,
  shippingMode,
  totalRevenue,
  stripeFeesPaid,
  edgeFeesPaid,
  shippingMarginPaid,
  platformFeesPaid,
  totalSavings,
}: AdminFeeTrackerCardProps) {
  return (
    <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div>
        <p className="text-xs tracking-[0.18em] text-zinc-500 uppercase">Merchant dashboard</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">Revenue + fee breakdown</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Total revenue</p>
          <p className="mt-1 text-lg font-semibold">{money(totalRevenue)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Stripe fees paid</p>
          <p className="mt-1 text-lg font-semibold">{money(stripeFeesPaid)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Edge fees paid</p>
          <p className="mt-1 text-lg font-semibold">{money(edgeFeesPaid)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Shipping margin paid</p>
          <p className="mt-1 text-lg font-semibold">{money(shippingMarginPaid)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <p className="font-medium">You paid {money(platformFeesPaid)} in platform fees this month.</p>
        <p className="mt-1 text-zinc-600 dark:text-zinc-300">
          Payment mode: <strong>{paymentMode === "edge" ? "Edge Payments" : "Bring Your Own Payments"}</strong> · Shipping mode:{" "}
          <strong>{shippingMode === "edge" ? "Edge Shipping" : "Bring Your Own Shipping"}</strong>
        </p>
      </div>

      {totalSavings > 0 ? (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          You saved {money(totalSavings)} by using your own integrations.
        </div>
      ) : (
        <div className="rounded-2xl border border-orange-300 bg-orange-50 p-4 text-sm text-orange-900 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-200">
          Default setup is active for fastest launch. You can lower long-term cost any time in settings.
        </div>
      )}

      <Link href={`/admin?tenant=${encodeURIComponent(tenantSlug)}#upgrade-growth`} className="text-sm text-orange-600 underline underline-offset-4 dark:text-orange-300">
        Open monetization settings
      </Link>
    </section>
  );
}
