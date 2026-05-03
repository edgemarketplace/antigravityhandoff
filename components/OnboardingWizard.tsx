"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type Step = 1 | 2 | 3 | 4;

type StatusResponse = {
  success: boolean;
  message?: string;
  intake?: {
    id: string;
    status: string;
    ai_brand_summary?: string | null;
    ai_collections?: string[] | null;
  };
  tenant?: {
    slug: string;
    onboarding_status: string;
    onboarding_progress: Record<string, boolean>;
  } | null;
  result?: {
    tenantSlug: string;
    productsImported: number;
  };
};

export function OnboardingWizard() {
  const [step, setStep] = useState<Step>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<StatusResponse | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [brandTone, setBrandTone] = useState("Confident and modern");
  const [adminEmail, setAdminEmail] = useState("");
  const [existingStoreUrl, setExistingStoreUrl] = useState("");
  const [productCsv, setProductCsv] = useState("");
  const [productImages, setProductImages] = useState("");

  const progress = useMemo(() => {
    if (!success?.tenant?.onboarding_progress) return [];
    return Object.entries(success.tenant.onboarding_progress);
  }, [success]);

  const tenantSlug = success?.result?.tenantSlug ?? success?.tenant?.slug ?? null;

  async function submit() {
    setError(null);
    setIsSubmitting(true);

    try {
      const payload = {
        businessName,
        industry,
        brandTone,
        adminEmail,
        existingStoreUrl: existingStoreUrl || null,
        productCsv: productCsv || null,
        productImages: productImages
          .split(/[\n,]/)
          .map((entry) => entry.trim())
          .filter(Boolean),
      };

      const response = await fetch("/api/onboarding/intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as StatusResponse;
      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Onboarding failed");
      }

      setSuccess(data);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onboarding failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">AI onboarding</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Launch your store in under 1 hour</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Fast path: submit intake, auto-generate catalog, provision tenant, invite admin, and activate default Edge services.</p>
      </div>

      <div className="grid gap-2 text-xs md:grid-cols-4">
        {["Business", "Brand", "Products", "Launch"].map((label, idx) => (
          <div
            key={label}
            className={`rounded-xl border px-3 py-2 ${step >= idx + 1 ? "border-orange-400 bg-orange-50 text-orange-900 dark:border-orange-600 dark:bg-orange-950/40 dark:text-orange-200" : "border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"}`}
          >
            {idx + 1}. {label}
          </div>
        ))}
      </div>

      {step === 1 ? (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span>Business name</span>
            <input className="w-full rounded-xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" value={businessName} onChange={(event) => setBusinessName(event.target.value)} />
          </label>
          <label className="space-y-1 text-sm">
            <span>Industry</span>
            <input className="w-full rounded-xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" value={industry} onChange={(event) => setIndustry(event.target.value)} />
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span>Existing store URL (optional)</span>
            <input className="w-full rounded-xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" value={existingStoreUrl} onChange={(event) => setExistingStoreUrl(event.target.value)} />
          </label>
          <div className="md:col-span-2 flex justify-end">
            <Button type="button" onClick={() => setStep(2)}>
              Next
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span>Brand tone</span>
            <input className="w-full rounded-xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" value={brandTone} onChange={(event) => setBrandTone(event.target.value)} />
          </label>
          <label className="space-y-1 text-sm">
            <span>Admin email</span>
            <input className="w-full rounded-xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} />
          </label>
          <div className="md:col-span-2 flex justify-between">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button type="button" onClick={() => setStep(3)}>
              Next
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <label className="space-y-1 text-sm block">
            <span>Product CSV data (paste)</span>
            <textarea className="h-40 w-full rounded-xl border border-zinc-300 px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900" value={productCsv} onChange={(event) => setProductCsv(event.target.value)} placeholder="title,description,price,category,tags,image_url" />
          </label>
          <label className="space-y-1 text-sm block">
            <span>OR product image URLs (comma/newline separated)</span>
            <textarea className="h-24 w-full rounded-xl border border-zinc-300 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900" value={productImages} onChange={(event) => setProductImages(event.target.value)} />
          </label>
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button type="button" disabled={isSubmitting} onClick={submit}>
              {isSubmitting ? "Launching..." : "Launch store"}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 4 && success ? (
        <div className="space-y-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          <p className="font-semibold">Store provisioned ✅</p>
          <p>
            Tenant slug: <code>{tenantSlug ?? "pending"}</code>
          </p>
          <p>Imported products: {success.result?.productsImported ?? 0}</p>
          {success.intake?.ai_brand_summary ? <p>{success.intake.ai_brand_summary}</p> : null}
          {progress.length ? (
            <ul className="list-disc pl-5">
              {progress.map(([key, done]) => (
                <li key={key}>
                  {key}: {done ? "done" : "pending"}
                </li>
              ))}
            </ul>
          ) : null}
          {tenantSlug ? (
            <div className="flex flex-wrap gap-2">
              <a
                href={`/admin?tenant=${encodeURIComponent(tenantSlug)}`}
                className="inline-flex items-center rounded-lg border border-emerald-700 bg-emerald-700 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-800"
              >
                Open tenant admin
              </a>
              <a
                href={`/stores/${encodeURIComponent(tenantSlug)}`}
                className="inline-flex items-center rounded-lg border border-emerald-700 bg-transparent px-3 py-2 text-xs font-medium text-emerald-900 hover:bg-emerald-100 dark:text-emerald-100 dark:hover:bg-emerald-900/40"
              >
                Preview storefront
              </a>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
