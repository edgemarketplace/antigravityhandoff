"use client"

import { useMemo, useState } from "react"
import {
  checkSubdomain,
  connectStripe,
  createFirstProduct,
  createOnboarding,
  launchReadiness,
  launchStore,
  reserveSubdomain,
  saveShipping,
  saveStep,
  selectPlan,
  type PlanType,
} from "@modules/onboarding/api"

type WizardStep = 1 | 2 | 3 | 4 | 5

export default function EdgeOnboardingPage() {
  const [step, setStep] = useState<WizardStep>(1)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  const [planType, setPlanType] = useState<PlanType>("free")
  const [storeName, setStoreName] = useState("")
  const [ownerName, setOwnerName] = useState("")
  const [email, setEmail] = useState("")
  const [subdomain, setSubdomain] = useState("")
  const [onboardingId, setOnboardingId] = useState("")

  const [firstProductName, setFirstProductName] = useState("")
  const [firstProductPrice, setFirstProductPrice] = useState("29.99")
  const [shippingMode, setShippingMode] = useState<"flat" | "free" | "manual" | "printify">("flat")

  const persistedId = useMemo(() => {
    if (typeof window === "undefined") return ""
    return window.localStorage.getItem("edge_onboarding_id") || ""
  }, [])

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(true)
    setMessage("")
    try {
      await fn()
      setMessage(`${label}: done`)
    } catch (e) {
      setMessage(`${label}: ${e instanceof Error ? e.message : "failed"}`)
    } finally {
      setBusy(false)
    }
  }

  function requireOnboardingId() {
    const id = onboardingId || persistedId
    if (!id) throw new Error("No onboardingId yet. Complete step 1 first.")
    return id
  }

  return (
    <div className="content-container py-10 max-w-3xl grid gap-5">
      <h1 className="text-2xl font-semibold">Edge Onboarding Wizard</h1>
      <p className="text-sm text-ui-fg-subtle">Fast path: plan -> store -> product -> shipping -> payments -> launch.</p>

      <div className="text-xs">Step {step} / 5</div>

      {step === 1 && (
        <div className="grid gap-3 border rounded p-4">
          <h2 className="font-medium">1) Plan + Business Basics</h2>
          <select className="border rounded px-3 py-2" value={planType} onChange={(e) => setPlanType(e.target.value as PlanType)}>
            <option value="free">Free (5% fee)</option>
            <option value="paid">Paid ($99 + 0.5% fee)</option>
          </select>
          <input className="border rounded px-3 py-2" placeholder="Store name" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Owner name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button
            className="bg-black text-white rounded px-4 py-2 disabled:opacity-60"
            disabled={busy || !storeName}
            onClick={() =>
              run("Create onboarding", async () => {
                const created = await createOnboarding({ storeName, ownerName, email, planType })
                if (!created.ok || !created.tenant?.id) throw new Error(created.error || "create failed")
                const id = created.tenant.id
                setOnboardingId(id)
                window.localStorage.setItem("edge_onboarding_id", id)
                await selectPlan(id, planType)
                await saveStep(id, "plan", { planType })
                setSubdomain(created.tenant.subdomain)
                setStep(2)
              })
            }
          >
            {busy ? "Working..." : "Continue"}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-3 border rounded p-4">
          <h2 className="font-medium">2) Store URL</h2>
          <input className="border rounded px-3 py-2" placeholder="Desired subdomain" value={subdomain} onChange={(e) => setSubdomain(e.target.value)} />
          <div className="flex gap-2">
            <button
              className="border rounded px-4 py-2"
              disabled={busy || !subdomain}
              onClick={() =>
                run("Check subdomain", async () => {
                  const r = await checkSubdomain(subdomain)
                  if (!r.available) throw new Error(r.reason || "unavailable")
                  setSubdomain(r.normalized)
                })
              }
            >
              Check
            </button>
            <button
              className="bg-black text-white rounded px-4 py-2 disabled:opacity-60"
              disabled={busy || !subdomain}
              onClick={() =>
                run("Reserve subdomain", async () => {
                  const id = requireOnboardingId()
                  const r = await reserveSubdomain(id, subdomain)
                  if (!r.ok) throw new Error(r.reason || "reserve failed")
                  await saveStep(id, "store_basics", { subdomain: r.normalized || subdomain })
                  setStep(3)
                })
              }
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-3 border rounded p-4">
          <h2 className="font-medium">3) First Product</h2>
          <input className="border rounded px-3 py-2" placeholder="Product name" value={firstProductName} onChange={(e) => setFirstProductName(e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Price" value={firstProductPrice} onChange={(e) => setFirstProductPrice(e.target.value)} />
          <button
            className="bg-black text-white rounded px-4 py-2 disabled:opacity-60"
            disabled={busy || !firstProductName}
            onClick={() =>
              run("Save first product", async () => {
                const id = requireOnboardingId()
                const price = Number(firstProductPrice)
                if (!Number.isFinite(price)) throw new Error("Invalid price")
                await createFirstProduct(id, firstProductName, price)
                await saveStep(id, "first_product", { title: firstProductName, price })
                setStep(4)
              })
            }
          >
            Continue
          </button>
        </div>
      )}

      {step === 4 && (
        <div className="grid gap-3 border rounded p-4">
          <h2 className="font-medium">4) Shipping + Payments</h2>
          <select className="border rounded px-3 py-2" value={shippingMode} onChange={(e) => setShippingMode(e.target.value as "flat" | "free" | "manual" | "printify")}>
            <option value="flat">Flat rate</option>
            <option value="free">Free shipping</option>
            <option value="manual">Manual</option>
            <option value="printify">Printify</option>
          </select>
          <div className="flex gap-2">
            <button
              className="border rounded px-4 py-2"
              disabled={busy}
              onClick={() =>
                run("Save shipping", async () => {
                  const id = requireOnboardingId()
                  await saveShipping(id, shippingMode)
                  await saveStep(id, "shipping", { shippingMode })
                })
              }
            >
              Save shipping
            </button>
            <button
              className="border rounded px-4 py-2"
              disabled={busy}
              onClick={() =>
                run("Connect Stripe", async () => {
                  const id = requireOnboardingId()
                  await connectStripe(id)
                  await saveStep(id, "payments", {})
                })
              }
            >
              Mark Stripe connected
            </button>
            <button className="bg-black text-white rounded px-4 py-2" disabled={busy} onClick={() => setStep(5)}>
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="grid gap-3 border rounded p-4">
          <h2 className="font-medium">5) Review + Launch</h2>
          <button
            className="border rounded px-4 py-2"
            disabled={busy}
            onClick={() =>
              run("Check readiness", async () => {
                const id = requireOnboardingId()
                const readiness = await launchReadiness(id)
                if (!readiness.readiness?.ready) {
                  throw new Error(`Missing: ${(readiness.readiness?.missing || []).join(", ") || "unknown"}`)
                }
              })
            }
          >
            Check readiness
          </button>
          <button
            className="bg-green-700 text-white rounded px-4 py-2"
            disabled={busy}
            onClick={() =>
              run("Launch store", async () => {
                const id = requireOnboardingId()
                const launched = await launchStore(id)
                if (!launched.ok) throw new Error(launched.reason || "launch failed")
              })
            }
          >
            Launch
          </button>
        </div>
      )}

      {!!(onboardingId || persistedId) && (
        <div className="text-xs text-ui-fg-subtle">onboardingId: {onboardingId || persistedId}</div>
      )}
      {!!message && <div className="text-sm border rounded p-3">{message}</div>}
    </div>
  )
}
