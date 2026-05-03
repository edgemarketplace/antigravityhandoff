import { NextResponse } from "next/server";
import { fetchPrintifyProducts } from "@/lib/printify";
import { createTenantProduct } from "@/lib/firebase-data";
import { resolveTenantFromRequest } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const tenant = await resolveTenantFromRequest(request);
    if (!tenant) {
      return NextResponse.json({ success: false, message: "Tenant context not found." }, { status: 400 });
    }

    const printifyProducts = await fetchPrintifyProducts();

    for (const product of printifyProducts) {
      const firstEnabledVariant = product.variants?.find((variant) => variant.is_enabled) ?? product.variants?.[0];

      await createTenantProduct({
        tenant_id: tenant.id,
        printify_id: product.id,
        title: product.title,
        description: product.description ?? null,
        price: firstEnabledVariant ? Number((firstEnabledVariant.price / 100).toFixed(2)) : 0,
        image_url: product.images?.[0]?.src ?? null,
        image_urls: (product.images ?? []).map((image) => image.src),
        variants: product.variants ?? [],
      });
    }

    return NextResponse.json({
      success: true,
      synced: printifyProducts.length,
      message: `Synced ${printifyProducts.length} products successfully.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync failure.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
