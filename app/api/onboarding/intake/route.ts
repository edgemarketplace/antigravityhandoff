import { NextResponse } from "next/server";
import { createIntake, runOnboardingProvisioning, type IntakeInput } from "@/lib/onboarding-engine";

export const dynamic = "force-dynamic";

function normalizeString(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function parseImageList(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

async function parseInput(request: Request): Promise<IntakeInput> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const csvFile = form.get("product_csv_file");

    let csvText = normalizeString(form.get("product_csv"));
    if (!csvText && csvFile instanceof File) {
      csvText = await csvFile.text();
    }

    return {
      businessName: normalizeString(form.get("business_name")),
      industry: normalizeString(form.get("industry")),
      brandTone: normalizeString(form.get("brand_tone")),
      adminEmail: normalizeString(form.get("admin_email")),
      existingStoreUrl: normalizeString(form.get("existing_store_url")) || null,
      productCsv: csvText || null,
      productImages: parseImageList(normalizeString(form.get("product_images"))),
    };
  }

  const body = (await request.json()) as Partial<IntakeInput>;
  return {
    businessName: (body.businessName ?? "").trim(),
    industry: (body.industry ?? "").trim(),
    brandTone: (body.brandTone ?? "").trim(),
    adminEmail: (body.adminEmail ?? "").trim(),
    existingStoreUrl: body.existingStoreUrl?.trim() || null,
    productCsv: body.productCsv?.trim() || null,
    productImages: (body.productImages ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 20),
  };
}

function validateInput(input: IntakeInput): string | null {
  if (!input.businessName) return "business_name is required";
  if (!input.industry) return "industry is required";
  if (!input.brandTone) return "brand_tone is required";
  if (!input.adminEmail) return "admin_email is required";
  return null;
}

export async function POST(request: Request) {
  try {
    const input = await parseInput(request);
    const validationError = validateInput(input);

    if (validationError) {
      return NextResponse.json({ success: false, message: validationError }, { status: 400 });
    }

    const intake = await createIntake(input);
    const result = await runOnboardingProvisioning(intake.id);

    return NextResponse.json({
      success: true,
      intake,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit onboarding intake";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
