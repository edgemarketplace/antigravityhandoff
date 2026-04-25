import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveTenantFromRequest } from "@/lib/tenant-context";
import { ADMIN_READ_ROLES, ADMIN_WRITE_ROLES, requireTenantMembership } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

type ProductPayload = {
  printify_id?: string;
  title?: string;
  description?: string | null;
  price?: number;
  image_url?: string | null;
};

function normalizePrice(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Number(numeric.toFixed(2));
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizePayload(body: ProductPayload) {
  const title = normalizeString(body.title);
  const description = normalizeString(body.description);
  const imageUrl = normalizeString(body.image_url);
  const printifyId = normalizeString(body.printify_id) ?? `manual-${crypto.randomUUID()}`;
  const price = normalizePrice(body.price);

  return {
    printify_id: printifyId,
    title,
    description,
    price,
    image_url: imageUrl,
  };
}

export async function GET(request: Request) {
  const tenant = await resolveTenantFromRequest(request);
  if (!tenant) {
    return NextResponse.json({ success: false, message: "Tenant context not found." }, { status: 400 });
  }

  const auth = await requireTenantMembership(request, tenant.id, ADMIN_READ_ROLES);
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select("printify_id,title,description,price,image_url,variants,created_at")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, tenant, products: data ?? [] });
}

export async function POST(request: Request) {
  const tenant = await resolveTenantFromRequest(request);
  if (!tenant) {
    return NextResponse.json({ success: false, message: "Tenant context not found." }, { status: 400 });
  }

  const auth = await requireTenantMembership(request, tenant.id, ADMIN_WRITE_ROLES);
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  const body = (await request.json()) as ProductPayload;
  const payload = normalizePayload(body);

  if (!payload.title) {
    return NextResponse.json({ success: false, message: "Product title is required." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("products")
    .insert({
      tenant_id: tenant.id,
      printify_id: payload.printify_id,
      title: payload.title,
      description: payload.description,
      price: payload.price,
      image_url: payload.image_url,
      variants: [],
    })
    .select("printify_id,title,description,price,image_url,variants,created_at")
    .single();

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, product: data });
}

export async function PATCH(request: Request) {
  const tenant = await resolveTenantFromRequest(request);
  if (!tenant) {
    return NextResponse.json({ success: false, message: "Tenant context not found." }, { status: 400 });
  }

  const auth = await requireTenantMembership(request, tenant.id, ADMIN_WRITE_ROLES);
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  const body = (await request.json()) as ProductPayload;
  const printifyId = normalizeString(body.printify_id);

  if (!printifyId) {
    return NextResponse.json({ success: false, message: "printify_id is required for update." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (typeof body.title === "string") {
    const title = normalizeString(body.title);
    if (!title) {
      return NextResponse.json({ success: false, message: "title cannot be empty." }, { status: 400 });
    }
    updates.title = title;
  }

  if (typeof body.description === "string") {
    updates.description = normalizeString(body.description);
  }

  if (typeof body.image_url === "string") {
    updates.image_url = normalizeString(body.image_url);
  }

  if (body.price !== undefined) {
    updates.price = normalizePrice(body.price);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, message: "No update fields were provided." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("products")
    .update(updates)
    .eq("tenant_id", tenant.id)
    .eq("printify_id", printifyId)
    .select("printify_id,title,description,price,image_url,variants,created_at")
    .single();

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, product: data });
}

export async function DELETE(request: Request) {
  const tenant = await resolveTenantFromRequest(request);
  if (!tenant) {
    return NextResponse.json({ success: false, message: "Tenant context not found." }, { status: 400 });
  }

  const auth = await requireTenantMembership(request, tenant.id, ADMIN_WRITE_ROLES);
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  const requestUrl = new URL(request.url);
  const printifyId = normalizeString(requestUrl.searchParams.get("printify_id"));

  if (!printifyId) {
    return NextResponse.json({ success: false, message: "printify_id query parameter is required." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("tenant_id", tenant.id)
    .eq("printify_id", printifyId);

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, printify_id: printifyId });
}
