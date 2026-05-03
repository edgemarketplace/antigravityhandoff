import Link from "next/link";
import { ProductGrid } from "@/components/ProductGrid";
import { SyncButton } from "@/components/SyncButton";

const categories = [
  "All Templates",
  "Fashion",
  "Wellness",
  "Beauty",
  "Local Services",
  "Food & Beverage",
  "Events",
  "Digital Products",
];

const highlightCards = [
  {
    tag: "NEW",
    title: "Premium Theme Drops",
    copy: "Professionally-designed storefront templates with conversion-focused sections.",
  },
  {
    tag: "FAST",
    title: "7-Day Store Launch",
    copy: "Pick a template, connect products, and publish with onboarding and admin built in.",
  },
  {
    tag: "SCALE",
    title: "Growth-Ready Stack",
    copy: "Payments, shipping, and automation patterns included for real operations.",
  },
];

const trustStats = [
  { label: "Template styles", value: "20+" },
  { label: "Launch window", value: "7 days" },
  { label: "Managed sync", value: "24/7" },
  { label: "Checkout ready", value: "Stripe" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <main className="mx-auto w-full max-w-[1380px] space-y-8 px-4 py-8 md:space-y-12 md:px-8 md:py-10">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_-32px_rgba(2,6,23,0.35)]">
          <div className="grid gap-8 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white md:p-10 lg:grid-cols-[1.15fr_1fr] lg:items-center">
            <div className="space-y-6">
              <p className="text-[11px] font-semibold tracking-[0.24em] uppercase text-slate-300">EDGE MARKETPLACE HUB</p>
              <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
                Modern commerce templates with a professional storefront feel.
              </h1>
              <p className="max-w-xl text-sm text-slate-300 md:text-base">
                Inspired by leading ecommerce layouts: clean merchandising, clear hierarchy, and fast paths to launch.
                Browse templates, onboard a test store, and manage everything from one admin.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="#templates"
                  className="rounded-full bg-white px-5 py-2.5 text-xs font-semibold tracking-[0.14em] text-slate-900 uppercase transition hover:bg-slate-100"
                >
                  Browse Templates
                </Link>
                <Link
                  href="/onboarding"
                  className="rounded-full border border-slate-400/40 bg-white/10 px-5 py-2.5 text-xs font-semibold tracking-[0.14em] uppercase transition hover:bg-white/20"
                >
                  Start Onboarding
                </Link>
                <Link
                  href="/admin"
                  className="rounded-full border border-slate-400/40 bg-white/10 px-5 py-2.5 text-xs font-semibold tracking-[0.14em] uppercase transition hover:bg-white/20"
                >
                  Open Admin
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
              <p className="mb-4 text-[11px] font-semibold tracking-[0.2em] uppercase text-slate-300">Template categories</p>
              <div className="grid grid-cols-2 gap-2 text-xs md:text-sm">
                {categories.map((category) => (
                  <div
                    key={category}
                    className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 font-medium text-slate-100"
                  >
                    {category}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {highlightCards.map((card) => (
            <article key={card.title} className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="mb-3 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] text-slate-600 uppercase">
                {card.tag}
              </p>
              <h3 className="text-base font-semibold tracking-tight text-slate-900">{card.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{card.copy}</p>
            </article>
          ))}
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-r from-blue-900 via-slate-900 to-slate-800 p-6 text-white md:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <p className="mb-3 text-[11px] font-semibold tracking-[0.2em] uppercase text-blue-200">Limited offer</p>
              <h2 className="text-3xl font-semibold leading-tight md:text-4xl">Launch a polished template storefront this week.</h2>
              <p className="mt-3 max-w-2xl text-sm text-slate-200 md:text-base">
                Professional design system, dark-blue visual identity, and admin workflows ready for test-store onboarding.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="#templates"
                  className="rounded-full bg-white px-5 py-2.5 text-xs font-semibold tracking-[0.14em] text-slate-900 uppercase transition hover:bg-slate-100"
                >
                  Explore Catalog
                </Link>
                <Link
                  href="/onboarding"
                  className="rounded-full border border-white/30 px-5 py-2.5 text-xs font-semibold tracking-[0.14em] uppercase transition hover:bg-white/10"
                >
                  Begin Setup
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {trustStats.map((stat) => (
                <div key={stat.label} className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                  <p className="text-2xl font-semibold tracking-tight">{stat.value}</p>
                  <p className="text-[11px] tracking-[0.12em] text-slate-200 uppercase">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="templates" className="space-y-6">
          <div className="flex flex-col gap-4 border-b border-slate-300 pb-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">Template library</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">Featured storefront templates</h2>
              <p className="mt-1 text-sm text-slate-600">
                Curated marketplace-style browsing with live product sync and production-minded storefront architecture.
              </p>
            </div>
            <SyncButton />
          </div>

          <ProductGrid />
        </section>
      </main>
    </div>
  );
}
