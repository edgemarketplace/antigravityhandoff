import { NextResponse } from "next/server";
import { ADMIN_READ_ROLES, ADMIN_WRITE_ROLES, requireTenantMembership } from "@/lib/admin-auth";
import { updateTenantById } from "@/lib/firebase-data";
import { resolveTenantFromRequest } from "@/lib/tenant-context";
import type { TenantContext } from "@/lib/firebase-types";

export const dynamic = "force-dynamic";

type TenantSettingsPayload = {
  name?: string;
  primary_color?: string | null;
  logo_url?: string | null;
  custom_domain?: string | null;
  payment_mode?: "edge" | "external";
  shipping_mode?: "edge" | "external";
  payment_fee_percent?: number;
  shipping_markup_percent?: number;
};

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeMode(value: unknown): "edge" | "external" | null {
  if (value !== "edge" && value !== "external") return null;
  return value;
}

function normalizePercent(value: unknown): number | null {
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
      plan: tenant.plan,
      payment_mode: tenant.payment_mode,
      shipping_mode: tenant.shipping_mode,
      payment_fee_percent: Number(tenant.payment_fee_percent ?? 5),
      shipping_markup_percent: Number(tenant.shipping_markup_percent ?? 10),
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
    const mode = normalizeMode(body.payment_mode);
    if (!mode) {
      return NextResponse.json({ success: false, message: "payment_mode must be 'edge' or 'external'." }, { status: 400 });
    }
    updates.payment_mode = mode;

    if (mode === "edge" && body.payment_fee_percent === undefined) {
      updates.payment_fee_percent = 5;
    }
    if (mode === "external" && body.payment_fee_percent === undefined) {
      updates.payment_fee_percent = 0;
    }
  }

  if (body.shipping_mode !== undefined) {
    const mode = normalizeMode(body.shipping_mode);
    if (!mode) {
      return NextResponse.json({ success: false, message: "shipping_mode must be 'edge' or 'external'." }, { status: 400 });
    }
    updates.shipping_mode = mode;

    if (mode === "edge" && body.shipping_markup_percent === undefined) {
      updates.shipping_markup_percent = 10;
    }
    if (mode === "external" && body.shipping_markup_percent === undefined) {
      updates.shipping_markup_percent = 0;
    }
  }

  if (body.payment_fee_percent !== undefined) {
    const fee = normalizePercent(body.payment_fee_percent);
    if (fee === null) {
      return NextResponse.json(
        { success: false, message: "payment_fee_percent must be between 0 and 100." },
        { status: 400 },
      );
    }
    updates.payment_fee_percent = fee;
  }

  if (body.shipping_markup_percent !== undefined) {
    const markup = normalizePercent(body.shipping_markup_percent);
    if (markup === null) {
      return NextResponse.json(
        { success: false, message: "shipping_markup_percent must be between 0 and 100." },
        { status: 400 },
      );
    }
    updates.shipping_markup_percent = markup;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, message: "No update fields were provided." }, { status: 400 });
  }

  const next = await updateTenantById(tenant.id, updates as Partial<TenantContext>);

  if (!next) {
    return NextResponse.json({ success: false, message: "Tenant not found." }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    settings: {
      id: next.id,
      slug: next.slug,
      name: next.name,
      custom_domain: next.custom_domain,
      primary_color: next.primary_color,
      logo_url: next.logo_url,
      plan: next.plan,
      payment_mode: next.payment_mode,
      shipping_mode: next.shipping_mode,
      payment_fee_percent: Number(next.payment_fee_percent ?? 5),
      shipping_markup_percent: Number(next.shipping_markup_percent ?? 10),
    },
  });
}
