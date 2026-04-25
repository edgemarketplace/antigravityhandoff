import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getSupabaseAuthClient } from "@/lib/supabase-auth";

export const ADMIN_READ_ROLES = ["owner", "admin", "staff"] as const;
export const ADMIN_WRITE_ROLES = ["owner", "admin"] as const;

export type AdminRole = (typeof ADMIN_READ_ROLES)[number];

type MembershipRow = {
  tenant_id: string;
  user_id: string;
  role: AdminRole;
};

type AuthenticatedUser = {
  id: string;
  email: string | null;
};

export type TenantMembershipResult =
  | {
      ok: true;
      user: AuthenticatedUser;
      membership: MembershipRow;
    }
  | {
      ok: false;
      status: 401 | 403;
      message: string;
    };

function parseCookieHeader(cookieHeader: string | null): Map<string, string> {
  if (!cookieHeader) {
    return new Map();
  }

  const cookieMap = new Map<string, string>();
  const parts = cookieHeader.split(";");

  for (const part of parts) {
    const [rawName, ...rawValueParts] = part.split("=");
    const name = rawName?.trim();
    if (!name) continue;

    const rawValue = rawValueParts.join("=").trim();
    if (!rawValue) continue;

    const unquoted = rawValue.replace(/^"|"$/g, "");
    cookieMap.set(name, unquoted);
  }

  return cookieMap;
}

function extractAccessTokenFromAuthCookie(cookieValue: string): string | null {
  const decoded = decodeURIComponent(cookieValue);

  try {
    const parsed = JSON.parse(decoded) as unknown;

    if (Array.isArray(parsed) && typeof parsed[0] === "string" && parsed[0].length > 0) {
      return parsed[0];
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      "access_token" in parsed &&
      typeof (parsed as { access_token?: unknown }).access_token === "string"
    ) {
      return (parsed as { access_token: string }).access_token;
    }
  } catch {
    if (decoded.length > 0) {
      return decoded;
    }
  }

  return null;
}

function getAccessTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  const cookies = parseCookieHeader(request.headers.get("cookie"));

  const directToken = cookies.get("sb-access-token") ?? cookies.get("supabase-access-token");
  if (directToken) {
    const token = decodeURIComponent(directToken);
    if (token) return token;
  }

  for (const [name, value] of cookies.entries()) {
    if (!name.endsWith("-auth-token")) continue;

    const token = extractAccessTokenFromAuthCookie(value);
    if (token) return token;
  }

  return null;
}

export async function getAuthenticatedUserFromRequest(request: Request): Promise<AuthenticatedUser | null> {
  const accessToken = getAccessTokenFromRequest(request);
  if (!accessToken) {
    return null;
  }

  const supabaseAuth = getSupabaseAuthClient();
  const { data, error } = await supabaseAuth.auth.getUser(accessToken);

  if (error || !data.user) {
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email ?? null,
  };
}

export async function requireTenantMembership(
  request: Request,
  tenantId: string,
  allowedRoles: readonly AdminRole[],
): Promise<TenantMembershipResult> {
  const user = await getAuthenticatedUserFromRequest(request);

  if (!user) {
    return {
      ok: false,
      status: 401,
      message: "Unauthorized: sign in required.",
    };
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("members")
    .select("tenant_id,user_id,role")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      status: 403,
      message: "Forbidden: you are not a member of this tenant.",
    };
  }

  const membership = data as MembershipRow;
  if (!allowedRoles.includes(membership.role)) {
    return {
      ok: false,
      status: 403,
      message: `Forbidden: ${membership.role} role cannot access this resource.`,
    };
  }

  return {
    ok: true,
    user,
    membership,
  };
}
