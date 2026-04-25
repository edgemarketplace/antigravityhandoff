import { NextResponse } from "next/server";
import { ADMIN_READ_ROLES, ADMIN_WRITE_ROLES, requireTenantMembership } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveTenantFromRequest } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

type TenantSettingsPayload = {
  name?: string;
  primary_color?: string | null;
  logo_url?: string | null;
  custom_domain?: string | null;
  payment_mode?: "edge_payments" | "byo_stripe";
  payment_application_fee_percent?: number;
};

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizePaymentMode(value: unknown): "edge_payments" | "byo_stripe" | null {
  if (value !== "edge_payments" && value !== "byo_stripe") return null;
  return value;
}

function normalizeFeePercent(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }

  return Number(parsed.toFixed(2));
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

  return NextResponse.json({
    success: true,
    settings: {
      name: tenant.name,
      slug: tenant.slug,
      custom_domain: tenant.custom_domain,
      primary_color: tenant.primary_color,
      logo_url: tenant.logo_url,
      payment_mode: tenant.payment_mode,
      payment_application_fee_percent: Number(tenant.payment_application_fee_percent ?? 1),
    },
  });
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

  const body = (await request.json()) as TenantSettingsPayload;
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = normalizeString(body.name);
    if (!name) {
      return NextResponse.json({ success: false, message: "Name cannot be empty." }, { status: 400 });
    }
    updates.name = name;
  }

  if (body.primary_color !== undefined) {
    updates.primary_color = normalizeString(body.primary_color);
  }

  if (body.logo_url !== undefined) {
    updates.logo_url = normalizeString(body.logo_url);
  }

  if (body.custom_domain !== undefined) {
    updates.custom_domain = normalizeString(body.custom_domain)?.toLowerCase() ?? null;
  }

  if (body.payment_mode !== undefined) {
    const mode = normalizePaymentMode(body.payment_mode);
    if (!mode) {
      return NextResponse.json(
        { success: false, message: "payment_mode must be 'edge_payments' or 'byo_stripe'." },
        { status: 400 },
      );
    }
    updates.payment_mode = mode;
  }

  if (body.payment_application_fee_percent !== undefined) {
    const fee = normalizeFeePercent(body.payment_application_fee_percent);
    if (fee === null) {
      return NextResponse.json(
        { success: false, message: "payment_application_fee_percent must be between 0 and 100." },
        { status: 400 },
      );
    }
    updates.payment_application_fee_percent = fee;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, message: "No update fields were provided." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("tenants")
    .update(updates)
    .eq("id", tenant.id)
    .select("id,slug,name,custom_domain,primary_color,logo_url,payment_mode,payment_application_fee_percent")
    .single();

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, settings: data });
}
