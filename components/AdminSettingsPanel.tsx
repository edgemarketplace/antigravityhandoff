"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type PaymentMode = "edge_payments" | "byo_stripe";

type SettingsState = {
  name: string;
  slug: string;
  custom_domain: string;
  primary_color: string;
  logo_url: string;
  payment_mode: PaymentMode;
  payment_application_fee_percent: number;
};

type AdminSettingsPanelProps = {
  tenantSlug: string;
  initialSettings: SettingsState;
  initialStripeAccountRef: string | null;
  initialStripeAccountStatus: string | null;
};

export function AdminSettingsPanel({
  tenantSlug,
  initialSettings,
  initialStripeAccountRef,
  initialStripeAccountStatus,
}: AdminSettingsPanelProps) {
  const [form, setForm] = useState<SettingsState>(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [stripeAccountRef, setStripeAccountRef] = useState<string | null>(initialStripeAccountRef);
  const [stripeAccountStatus, setStripeAccountStatus] = useState<string | null>(initialStripeAccountStatus);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/settings?tenant=${tenantSlug}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          custom_domain: form.custom_domain || null,
          primary_color: form.primary_color || null,
          logo_url: form.logo_url || null,
          payment_mode: form.payment_mode,
          payment_application_fee_percent: Number(form.payment_application_fee_percent),
        }),
      });

      const payload = (await response.json()) as {
        success: boolean;
        message?: string;
        settings?: Partial<SettingsState>;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.message ?? "Could not update tenant settings.");
      }

      if (payload.settings) {
        const next = payload.settings;
        setForm((current) => ({
          ...current,
          ...next,
          custom_domain: next.custom_domain ?? current.custom_domain,
          primary_color: next.primary_color ?? current.primary_color,
          logo_url: next.logo_url ?? current.logo_url,
          payment_application_fee_percent:
            typeof next.payment_application_fee_percent === "number"
              ? next.payment_application_fee_percent
              : current.payment_application_fee_percent,
        }));
      }

      setMessage("Settings saved.");
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Could not update tenant settings.";
      setError(reason);
    } finally {
      setIsSaving(false);
    }
  }

  async function launchConnect(endpoint: "/api/admin/payments/connect/start" | "/api/admin/payments/connect/refresh") {
    setIsConnecting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`${endpoint}?tenant=${tenantSlug}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });

      const payload = (await response.json()) as {
        success: boolean;
        message?: string;
        account_id?: string;
        account_status?: string;
        onboarding_url?: string;
      };

      if (!response.ok || !payload.success || !payload.onboarding_url) {
        throw new Error(payload.message ?? "Could not start Stripe Connect onboarding.");
      }

      setStripeAccountRef(payload.account_id ?? stripeAccountRef);
      setStripeAccountStatus(payload.account_status ?? stripeAccountStatus);
      setMessage("Stripe Connect onboarding link generated.");

      window.open(payload.onboarding_url, "_blank", "noopener,noreferrer");
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Could not start Stripe Connect onboarding.";
      setError(reason);
    } finally {
      setIsConnecting(false);
    }
  }

  return (
    <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div>
        <p className="text-xs tracking-[0.18em] text-zinc-500 uppercase">Admin settings</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">Store profile + payments</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">Store name</span>
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">Tenant slug</span>
          <input value={form.slug} readOnly className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/60" />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">Custom domain</span>
          <input
            value={form.custom_domain}
            onChange={(event) => setForm((current) => ({ ...current, custom_domain: event.target.value }))}
            placeholder="shop.example.com"
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">Theme color</span>
          <input
            value={form.primary_color}
            onChange={(event) => setForm((current) => ({ ...current, primary_color: event.target.value }))}
            placeholder="#f97316"
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <label className="space-y-1 text-sm md:col-span-2">
          <span className="text-zinc-600 dark:text-zinc-300">Logo URL</span>
          <input
            value={form.logo_url}
            onChange={(event) => setForm((current) => ({ ...current, logo_url: event.target.value }))}
            placeholder="https://..."
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>

      <div className="space-y-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="text-sm font-medium">Payments</p>
        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setForm((current) => ({ ...current, payment_mode: "edge_payments" }))}
            className={`rounded-xl border p-3 text-left text-sm ${
              form.payment_mode === "edge_payments"
                ? "border-orange-400 bg-orange-50 text-orange-900 dark:border-orange-500/70 dark:bg-orange-950/40 dark:text-orange-200"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          >
            <p className="font-medium">Edge Payments (recommended)</p>
            <p className="mt-1 text-xs opacity-80">Managed Stripe flow with platform fee.</p>
          </button>

          <button
            type="button"
            onClick={() => setForm((current) => ({ ...current, payment_mode: "byo_stripe" }))}
            className={`rounded-xl border p-3 text-left text-sm ${
              form.payment_mode === "byo_stripe"
                ? "border-orange-400 bg-orange-50 text-orange-900 dark:border-orange-500/70 dark:bg-orange-950/40 dark:text-orange-200"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          >
            <p className="font-medium">BYO Stripe (advanced)</p>
            <p className="mt-1 text-xs opacity-80">Use an existing merchant account with no platform fee.</p>
          </button>
        </div>

        <label className="space-y-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">Application fee (%)</span>
          <input
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={form.payment_application_fee_percent}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                payment_application_fee_percent: Number(event.target.value || 0),
              }))
            }
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <div className="rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-700">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">Stripe Connect</p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
            Account: <code>{stripeAccountRef ?? "not connected"}</code>
          </p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
            Status: <code>{stripeAccountStatus ?? "pending"}</code>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={isConnecting} onClick={() => launchConnect("/api/admin/payments/connect/start")}>
              {isConnecting ? "Opening..." : "Start Connect onboarding"}
            </Button>
            <Button type="button" variant="outline" disabled={isConnecting || !stripeAccountRef} onClick={() => launchConnect("/api/admin/payments/connect/refresh")}>
              Refresh onboarding link
            </Button>
          </div>
        </div>
      </div>

      {message ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p> : null}
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <div className="flex justify-end">
        <Button type="button" disabled={isSaving} onClick={onSave}>
          {isSaving ? "Saving..." : "Save settings"}
        </Button>
      </div>
    </section>
  );
}
