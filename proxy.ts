import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type TenantDomainMapping =
  | string
  | {
      slug: string;
      tenantId?: string;
    };

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "edgecommerce.com";

function normalizeHost(value: string): string {
  return value.trim().toLowerCase().replace(/:\d+$/, "");
}

function readCustomDomainMap(): Record<string, TenantDomainMapping> {
  const raw = process.env.TENANT_CUSTOM_DOMAIN_MAP;

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, TenantDomainMapping>;
    return parsed;
  } catch {
    return {};
  }
}

function getHost(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    return normalizeHost(forwardedHost);
  }

  return normalizeHost(request.nextUrl.host);
}

function getTenantFromHost(host: string): { slug: string; tenantId?: string } | null {
  if (!host || host === "localhost" || host.startsWith("127.")) {
    return null;
  }

  const customDomainMap = readCustomDomainMap();
  const customDomainMatch = customDomainMap[host];

  if (customDomainMatch) {
    if (typeof customDomainMatch === "string") {
      return { slug: customDomainMatch };
    }

    return { slug: customDomainMatch.slug, tenantId: customDomainMatch.tenantId };
  }

  if (!host.endsWith(ROOT_DOMAIN)) {
    return null;
  }

  const suffix = `.${ROOT_DOMAIN}`;
  if (!host.endsWith(suffix)) {
    return null;
  }

  const subdomain = host.slice(0, -suffix.length);
  if (!subdomain || subdomain === "www") {
    return null;
  }

  return { slug: subdomain };
}

export function proxy(request: NextRequest) {
  const host = getHost(request);
  const tenant = getTenantFromHost(host);

  if (!tenant) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  const alreadyTenantRouted = url.pathname.startsWith("/stores/");

  if (!alreadyTenantRouted) {
    const suffix = url.pathname === "/" ? "" : url.pathname;
    url.pathname = `/stores/${tenant.slug}${suffix}`;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-slug", tenant.slug);
  if (tenant.tenantId) {
    requestHeaders.set("x-tenant-id", tenant.tenantId);
  }

  return NextResponse.rewrite(url, {
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
