import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type TenantContext = {
  id: string;
  slug: string;
  name: string;
  custom_domain: string | null;
  primary_color: string | null;
  logo_url: string | null;
  payment_mode: "edge_payments" | "byo_stripe";
  payment_application_fee_percent: number;
  current_plan: "free" | "growth";
  monthly_order_count: number;
  monthly_gmv_cents: number;
  monthly_fee_cents: number;
  last_billing_reset: string | null;
};

function normalizeTenantSlug(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length ? trimmed : null;
}

export async function resolveTenantBySlug(slug: string | null): Promise<TenantContext | null> {
  const normalizedSlug = normalizeTenantSlug(slug);
  if (!normalizedSlug) return null;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("tenants")
    .select(
      "id,slug,name,custom_domain,primary_color,logo_url,payment_mode,payment_application_fee_percent,current_plan,monthly_order_count,monthly_gmv_cents,monthly_fee_cents,last_billing_reset",
    )
    .eq("slug", normalizedSlug)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as TenantContext;
}

export function getTenantSlugFromRequest(request: Request): string | null {
  const fromHeader = normalizeTenantSlug(request.headers.get("x-tenant-slug"));
  if (fromHeader) return fromHeader;

  const requestUrl = new URL(request.url);
  return normalizeTenantSlug(requestUrl.searchParams.get("tenant"));
}

export async function resolveTenantFromRequest(request: Request): Promise<TenantContext | null> {
  const slug = getTenantSlugFromRequest(request);
  return resolveTenantBySlug(slug);
}
