import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type TenantContext = {
  id: string;
  slug: string;
  name: string;
  primary_color: string | null;
  logo_url: string | null;
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
    .select("id,slug,name,primary_color,logo_url")
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
