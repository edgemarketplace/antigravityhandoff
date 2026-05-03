import { randomUUID } from "node:crypto";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { createTenantProduct, updateTenantById } from "@/lib/firebase-data";
import type { ProductRow, TenantContext } from "@/lib/firebase-types";

export type IntakeInput = {
  businessName: string;
  industry: string;
  brandTone: string;
  adminEmail: string;
  existingStoreUrl?: string | null;
  productCsv?: string | null;
  productImages?: string[];
};

type ParsedProduct = {
  title: string;
  description: string;
  price: number;
  category: string;
  tags: string[];
  image_url: string | null;
};

type OnboardingIntakeRow = {
  id: string;
  business_name: string;
  industry: string;
  brand_tone: string;
  admin_email: string;
  existing_store_url: string | null;
  product_csv: string | null;
  product_images: string[];
  status: "submitted" | "processing" | "provisioning" | "completed" | "failed";
  tenant_id: string | null;
  extracted_products?: unknown;
  ai_brand_summary?: string;
  ai_collections?: string[];
  ai_homepage_copy?: unknown;
  created_at: string;
  updated_at: string;
};

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

function sanitizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function toPrice(value: string): number {
  const numeric = Number(value.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return 29;
  return Number(numeric.toFixed(2));
}

function csvToRows(csv: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < csv.length; i += 1) {
    const ch = csv[i];
    if (ch === '"') {
      if (inQuotes && csv[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && csv[i + 1] === "\n") i += 1;
      row.push(current);
      current = "";
      if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
      row = [];
      continue;
    }
    current += ch;
  }
  if (current.length || row.length) {
    row.push(current);
    if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
  }
  return rows;
}

function parseProductCsv(csv: string): ParsedProduct[] {
  const rows = csvToRows(csv);
  if (!rows.length) return [];
  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const titleIdx = headers.findIndex((h) => ["title", "name", "product"].includes(h));
  const descIdx = headers.findIndex((h) => ["description", "desc", "details"].includes(h));
  const priceIdx = headers.findIndex((h) => ["price", "amount", "cost"].includes(h));
  const categoryIdx = headers.findIndex((h) => ["category", "collection", "type"].includes(h));
  const tagsIdx = headers.findIndex((h) => ["tags", "keywords"].includes(h));
  const imageIdx = headers.findIndex((h) => ["image", "image_url", "photo"].includes(h));

  return rows
    .slice(1)
    .map((cells) => {
      const rawTitle = sanitizeText(cells[titleIdx] ?? "");
      if (!rawTitle) return null;
      const cleanTitle = titleCase(rawTitle);
      const category = titleCase(sanitizeText(cells[categoryIdx] ?? "General")) || "General";
      const description =
        sanitizeText(cells[descIdx] ?? "") ||
        `${cleanTitle} built for ${category.toLowerCase()} shoppers who want quality and fast delivery.`;
      const tags = sanitizeText(cells[tagsIdx] ?? "")
        .split(/[|,]/)
        .map((tag) => sanitizeText(tag).toLowerCase())
        .filter(Boolean)
        .slice(0, 8);
      return {
        title: cleanTitle,
        description,
        price: toPrice(cells[priceIdx] ?? ""),
        category,
        tags,
        image_url: sanitizeText(cells[imageIdx] ?? "") || null,
      } satisfies ParsedProduct;
    })
    .filter((row): row is ParsedProduct => Boolean(row));
}

function parseImageProducts(productImages: string[], industry: string): ParsedProduct[] {
  return productImages.slice(0, 20).map((image, idx) => {
    const category = titleCase(industry || "General");
    const title = `${category} Signature Item ${idx + 1}`;
    return {
      title,
      description: `${title} is crafted for modern ${category.toLowerCase()} customers with a premium finish and practical design.`,
      price: 39,
      category,
      tags: [category.toLowerCase(), "featured", "new"],
      image_url: image,
    };
  });
}

export function generateBrandSummary(input: IntakeInput) {
  const tone = input.brandTone || "modern";
  const industry = titleCase(input.industry || "General");
  const businessName = titleCase(input.businessName);
  return {
    summary: `${businessName} is a ${tone} ${industry.toLowerCase()} brand focused on fast-launch ecommerce. The store voice is ${tone}, conversion-focused, and built to ship quickly with transparent pricing.`,
    collections: [`${industry} Essentials`, `${industry} Best Sellers`, `${industry} New Arrivals`],
    homepageCopy: {
      heroTitle: `${businessName} — Ready to Shop`,
      heroSubtitle: `Discover curated ${industry.toLowerCase()} products with fast checkout and reliable shipping.`,
      ctaPrimary: "Shop Now",
      ctaSecondary: "Browse Collections",
    },
  };
}

function buildProductSet(input: IntakeInput): ParsedProduct[] {
  const fromCsv = input.productCsv ? parseProductCsv(input.productCsv) : [];
  if (fromCsv.length) return fromCsv;
  const fromImages = parseImageProducts(input.productImages ?? [], input.industry);
  if (fromImages.length) return fromImages;
  const fallbackCategory = titleCase(input.industry || "General");
  return [{
    title: `${fallbackCategory} Starter Kit`,
    description: `A launch-ready ${fallbackCategory.toLowerCase()} product bundle for first-time shoppers.`,
    price: 49,
    category: fallbackCategory,
    tags: [fallbackCategory.toLowerCase(), "starter", "featured"],
    image_url: null,
  }];
}

function uniqueSlug(base: string): string {
  return `${base}-${randomUUID().slice(0, 6)}`;
}

async function sendAutomationEmail(params: {
  tenantId: string;
  recipient: string;
  subject: string;
  body: string;
  eventType: "welcome" | "first_sale" | "upgrade_nudge" | "shipping_confirmation";
  dedupeKey: string;
}) {
  const db = getFirebaseAdminDb();
  await db.collection("email_automation_events").doc(params.dedupeKey).set({
    tenant_id: params.tenantId,
    event_type: params.eventType,
    recipient: params.recipient,
    subject: params.subject,
    payload: { body: params.body },
    dedupe_key: params.dedupeKey,
    created_at: new Date().toISOString(),
  }, { merge: true });

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.NOTIFY_FROM_EMAIL;
  if (resendApiKey && fromEmail) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromEmail, to: [params.recipient], subject: params.subject, html: `<div style=\"font-family:Inter,Arial,sans-serif;line-height:1.5\">${params.body}</div>` }),
    }).catch(() => undefined);
  }
}

export async function runOnboardingProvisioning(intakeId: string) {
  const db = getFirebaseAdminDb();
  const intakeRef = db.collection("onboarding_intakes").doc(intakeId);
  const intakeSnap = await intakeRef.get();
  if (!intakeSnap.exists) throw new Error("Onboarding intake not found");

  const intake = intakeSnap.data() as OnboardingIntakeRow;
  await intakeRef.set({ status: "processing", updated_at: new Date().toISOString() }, { merge: true });

  const intakeInput: IntakeInput = {
    businessName: intake.business_name,
    industry: intake.industry,
    brandTone: intake.brand_tone,
    adminEmail: intake.admin_email,
    existingStoreUrl: intake.existing_store_url,
    productCsv: intake.product_csv,
    productImages: Array.isArray(intake.product_images) ? intake.product_images : [],
  };

  const ai = generateBrandSummary(intakeInput);
  const products = buildProductSet(intakeInput);
  const baseSlug = slugify(intake.business_name || "edge-store") || "edge-store";
  const slug = uniqueSlug(baseSlug);

  const tenantId = randomUUID();
  const tenant: TenantContext = {
    id: tenantId,
    slug,
    name: titleCase(intake.business_name),
    custom_domain: null,
    primary_color: "#f97316",
    logo_url: null,
    plan: "growth",
    theme_name: "edge-vibrant",
    payment_mode: "edge",
    shipping_mode: "edge",
    payment_fee_percent: 5,
    shipping_markup_percent: 10,
    onboarding_status: "in_progress",
    onboarding_progress: { intake: true, ai: true, products: false, provisioning: false, admin: false, emails: false, shipping: true },
    onboarding_completed_at: null,
    current_plan: "free",
    monthly_order_count: 0,
    monthly_gmv_cents: 0,
    monthly_fee_cents: 0,
    last_billing_reset: new Date().toISOString(),
  };

  await db.collection("tenants").doc(tenantId).set(tenant);

  await db.collection("members").doc(`${tenantId}_${intake.admin_email}`).set({
    tenant_id: tenantId,
    user_id: intake.admin_email,
    email: intake.admin_email,
    role: "owner"
  });

  const productRows: ProductRow[] = [];
  for (let index = 0; index < products.length; index += 1) {
    const product = products[index]!;
    const row = await createTenantProduct({
      tenant_id: tenantId,
      printify_id: `ai-${slug}-${index + 1}`,
      title: product.title,
      description: product.description,
      price: product.price,
      image_url: product.image_url,
      image_urls: product.image_url ? [product.image_url] : null,
      variants: [],
    });
    productRows.push(row);
  }

  await intakeRef.set({
    tenant_id: tenantId,
    extracted_products: productRows,
    ai_brand_summary: ai.summary,
    ai_collections: ai.collections,
    ai_homepage_copy: ai.homepageCopy,
    status: "provisioning",
    updated_at: new Date().toISOString(),
  }, { merge: true });

  await sendAutomationEmail({
    tenantId,
    recipient: intake.admin_email,
    subject: `${tenant.name} is almost live 🚀`,
    body: `<h2>Welcome to Edge Market Hub</h2><p>Your store <strong>${tenant.name}</strong> has been provisioned with ${productRows.length} products and default Edge Payments + Edge Shipping enabled.</p><p>Open your admin dashboard and review launch checklist.</p>`,
    eventType: "welcome",
    dedupeKey: `welcome-${tenantId}`,
  });

  await updateTenantById(tenantId, {
    onboarding_status: "ready_to_launch",
    onboarding_progress: { intake: true, ai: true, products: true, provisioning: true, admin: false, emails: true, shipping: true },
    onboarding_completed_at: new Date().toISOString(),
  });

  await intakeRef.set({ status: "completed", updated_at: new Date().toISOString() }, { merge: true });

  return { intakeId, tenantId, tenantSlug: tenant.slug, productsImported: productRows.length, ai };
}

export async function createIntake(input: IntakeInput) {
  const now = new Date().toISOString();
  const id = randomUUID();
  const row: OnboardingIntakeRow = {
    id,
    business_name: sanitizeText(input.businessName),
    industry: sanitizeText(input.industry),
    brand_tone: sanitizeText(input.brandTone),
    admin_email: sanitizeText(input.adminEmail).toLowerCase(),
    existing_store_url: input.existingStoreUrl ? sanitizeText(input.existingStoreUrl) : null,
    product_csv: input.productCsv ? input.productCsv : null,
    product_images: input.productImages ?? [],
    status: "submitted",
    tenant_id: null,
    created_at: now,
    updated_at: now,
  };

  await getFirebaseAdminDb().collection("onboarding_intakes").doc(id).set(row);
  return { id, status: row.status, created_at: row.created_at };
}
