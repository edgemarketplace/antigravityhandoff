import type { TenantContext } from "@/lib/firebase-types";
import { findTenantBySlug } from "@/lib/firebase-data";

function normalizeTenantSlug(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length ? trimmed : null;
}

export type { TenantContext };

export async function resolveTenantBySlug(slug: string | null): Promise<TenantContext | null> {
  const normalizedSlug = normalizeTenantSlug(slug);
  if (!normalizedSlug) return null;
  return findTenantBySlug(normalizedSlug);
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
